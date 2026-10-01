"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { fbDb } from "@/lib/firebase";
import { api } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

/**
 * Sonde anti-faux-vide : Firestore peut rester PENDING sans jamais appeler
 * le callback d'erreur (API désactivée, réseau filtré). On vérifie alors
 * explicitement la joignabilité pour afficher un état ERROR honnête au lieu
 * d'un catalogue vide trompeur.
 */
function probeFirestore(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("firestore-timeout")),
      10_000
    );
    getDoc(doc(fbDb(), "settings", "public"))
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Catalogue temps réel — abonnement Firestore (UNIQUE backend).
 *
 * `onSnapshot` garantit que toute modification faite dans l'admin (produit,
 * catégorie) est répercutée IMMÉDIATEMENT en boutique (mission §14), sans
 * rechargement. Les listeners sont uniques par page (aucun polling réseau
 * inutile) et nettoyés au démontage.
 *
 * États gérés : LOADING (chargement), ERROR (Firestore indisponible avec
 * message actionable), EMPTY (boutique vide → inviter l'admin à créer).
 */
export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    // Rechargement manuel : re-resynchronisation ponctuelle via l'API
    // (utile après une action admin, le temps que le snapshot arrive).
    try {
      setError(null);
      const [productsList, categoriesList] = await Promise.all([
        api.products.list(),
        api.categories.list(),
      ]);
      setProducts(productsList);
      setCategories(categoriesList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubProducts: (() => void) | null = null;
    let unsubCategories: (() => void) | null = null;
    let pending = 2;

    const settle = () => {
      pending -= 1;
      if (pending <= 0 && active) setLoading(false);
    };

    try {
      // Catégories : ordre d'affichage.
      unsubCategories = onSnapshot(
        query(collection(fbDb(), "categories"), orderBy("order", "asc")),
        (snap) => {
          if (!active) return;
          setCategories(
            snap.docs.map((d) => mapCategoryDoc(d.id, d.data()))
          );
          settle();
        },
        (err) => {
          if (!active) return;
          setError(friendlyCatalogError(err));
          setLoading(false);
        }
      );

      // Produits publics : actifs uniquement (égalité seule + tri client —
      // aucune dépendance à un index composite Firestore).
      unsubProducts = onSnapshot(
        query(
          collection(fbDb(), "products"),
          where("isActive", "==", true)
        ),
        (snap) => {
          if (!active) return;
          const mapped = snap.docs
            .map((d) => mapProductDoc(d.id, d.data()))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setProducts(mapped);
          settle();
        },
        (err) => {
          if (!active) return;
          setError(friendlyCatalogError(err));
          setLoading(false);
        }
      );
    } catch (e) {
      // Initialisation Firebase impossible (rare) — reporté hors du corps
      // synchrone de l'effet pour éviter un rendu en cascade.
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      void Promise.resolve().then(() => {
        setError(message);
        setLoading(false);
      });
    }

    // Sonde de connectivité (cf. docstring de probeFirestore) :
    // Firestore muet ≠ Firestore vide — on l'affiche honnêtement.
    probeFirestore().catch((probeError) => {
      if (!active) return;
      setError(friendlyCatalogError(probeError));
      setLoading(false);
    });

    return () => {
      active = false;
      unsubProducts?.();
      unsubCategories?.();
    };
  }, []);

  return { products, categories, loading, error, refetch };
}

/* ------------------------------------------------------------------------- */
/* Conversion document Firestore → types UI                                  */
/* ------------------------------------------------------------------------- */

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapCategoryDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: String(data.description ?? ""),
    image: String(data.image ?? ""),
    order: typeof data.order === "number" ? data.order : 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  } satisfies Category;
}

function mapProductDoc(id: string, data: Record<string, unknown>): Product {
  const categoryId = String(data.categoryId ?? "");
  const categoryName = String(data.categoryName ?? "");
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: String(data.description ?? ""),
    details: String(data.details ?? ""),
    price: typeof data.price === "number" ? data.price : 0,
    oldPrice:
      typeof data.oldPrice === "number" && Number.isFinite(data.oldPrice)
        ? data.oldPrice
        : null,
    image: String(data.image ?? ""),
    gallery: JSON.stringify(toStringList(data.gallery)),
    categoryId,
    stock: typeof data.stock === "number" ? data.stock : 0,
    rating: typeof data.rating === "number" ? data.rating : 0,
    reviewCount: typeof data.reviewCount === "number" ? data.reviewCount : 0,
    soldCount: typeof data.soldCount === "number" ? data.soldCount : 0,
    isFeatured: data.isFeatured === true,
    isNew: data.isNew === true,
    isActive: data.isActive !== false,
    sizes: JSON.stringify(toStringList(data.sizes)),
    colors: JSON.stringify(toStringList(data.colors)),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    category: {
      id: categoryId,
      name: categoryName,
      slug: slugFromName(categoryName || "catalogue"),
      description: "",
      image: "",
      order: 0,
      createdAt: toIso(undefined),
      updatedAt: toIso(undefined),
    },
  };
}

function friendlyCatalogError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "permission-denied") {
    return "Accès refusé par les règles de sécurité Firestore. Vérifiez firestore.rules (voir FIREBASE-SETUP.md).";
  }
  if (code === "failed-precondition") {
    return "La base Firestore du projet n'est pas encore créée — suivez FIREBASE-SETUP.md (console Google Firebase).";
  }
  if (code === "unavailable") {
    return "Connexion à Firebase impossible — vérifiez votre connexion internet.";
  }
  return "Impossible de charger le catalogue.";
}
