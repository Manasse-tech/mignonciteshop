/**
 * Couche d'accès aux données — Firebase (UNIQUE backend de MignonciteShop).
 *
 * Toutes les lectures/écritures passent directement par Cloud Firestore et
 * Firebase Auth, protégées par les Security Rules (firestore.rules).
 * Il n'existe AUCUN autre backend. Images = URLs publiques dans Firestore
 * (aucun Firebase Storage — forfait Spark).
 *
 * L'interface publique est conservée à l'identique (mêmes signatures que la
 * couche précédente) afin de ne pas réécrire les composants UI.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  deleteDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { deleteUser, type User as FirebaseUser } from "firebase/auth";
import { fbAuth, fbDb, friendlyFirebaseError } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { computePromo as computePromoLocal, PROMO_CODES } from "@/lib/promos";
import type { Category, Product, Review } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function fail(error: unknown, fallback: string): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(friendlyFirebaseError(error) || fallback, 0);
}

/* ------------------------------------------------------------------------- */
/* Conversions Firestore → types UI                                          */
/* ------------------------------------------------------------------------- */

type DocData = Record<string, unknown>;

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
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

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapCategory(id: string, data: DocData): Category {
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: String(data.description ?? ""),
    image: String(data.image ?? ""),
    order: typeof data.order === "number" ? data.order : 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapProduct(
  id: string,
  data: DocData,
  category?: Category
): Product {
  const categoryName = String(data.categoryName ?? category?.name ?? "");
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: String(data.description ?? ""),
    details: String(data.details ?? ""),
    price: typeof data.price === "number" ? data.price : 0,
    oldPrice: nullableNumber(data.oldPrice),
    image: String(data.image ?? ""),
    gallery: JSON.stringify(toStringList(data.gallery)),
    categoryId: String(data.categoryId ?? ""),
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
    category:
      category ??
      ({
        id: String(data.categoryId ?? ""),
        name: categoryName,
        slug: categoryName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        description: "",
        image: "",
        order: 0,
        createdAt: toIso(undefined),
        updatedAt: toIso(undefined),
      } satisfies Category),
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function currentUser(): FirebaseUser | null {
  return fbAuth().currentUser;
}

function requireAuthUser(): FirebaseUser {
  const user = currentUser();
  if (!user) throw new ApiError("Veuillez vous connecter.", 401);
  return user;
}

/** Journal d'audit — chaque action admin est tracée (collection auditLogs). */
async function logAudit(action: string, target: string, details: unknown): Promise<void> {
  try {
    const user = currentUser();
    await addDoc(collection(fbDb(), "auditLogs"), {
      actor: user?.email ?? "système",
      action,
      target,
      details: JSON.stringify(details ?? {}),
      createdAt: serverTimestamp(),
    });
  } catch {
    // L'audit ne doit jamais bloquer une action admin.
  }
}

/* ------------------------------------------------------------------------- */
/* Types admin (contrats publics inchangés)                                  */
/* ------------------------------------------------------------------------- */

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  image: string;
  unitPrice: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface AdminOrder {
  id: string;
  reference: string;
  status: string; // pending | paid | shipped | delivered | cancelled
  email: string;
  customerName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  shippingMethod: string;
  shippingCost: number;
  subtotal: number;
  discount: number;
  total: number;
  promoCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  items: AdminOrderItem[];
}

export interface AdminStats {
  revenue: number;
  ordersCount: number;
  avgOrder: number;
  inventoryValue: number;
  lowStockThreshold: number;
  productsCount: number;
  activeProductsCount: number;
  lowStock: number;
  pendingReviews: number;
  pendingMessages: number;
  subscribersCount: number;
  recentOrders: AdminOrder[];
  topProducts: {
    id: string;
    name: string;
    image: string;
    soldCount: number;
    price: number;
    stock: number;
  }[];
  daily: { date: string; revenue: number; orders: number }[];
}

export interface AdminReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string | null;
  comment: string;
  isApproved: boolean;
  helpful: number;
  createdAt: string;
  product: { name: string; image: string };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  order: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPromo {
  id: string;
  code: string;
  label: string;
  type: string; // percent | freeship | amount
  value: number;
  minSubtotal: number;
  isActive: boolean;
  expiresAt: string | null;
  usageCount: number;
  maxUses: number | null;
  createdAt: string;
}

export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  createdAt: string;
}

export interface AdminSubscriber {
  id: string;
  email: string;
  createdAt: string;
}

export interface AdminStockAlert {
  id: string;
  email: string;
  productId: string;
  notified: boolean;
  createdAt: string;
  product: { name: string; image: string; stock: number };
}

export interface AdminCustomer {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminReport {
  days: number;
  revenue: number;
  ordersCount: number;
  avgOrder: number;
  newCustomers: number;
  statusBreakdown: Record<string, number>;
  shippingBreakdown: Record<string, number>;
  paymentBreakdown: Record<string, number>;
  salesByCategory: { name: string; revenue: number }[];
  topProducts: {
    id: string;
    name: string;
    image: string;
    stock: number;
    quantity: number;
    revenue: number;
  }[];
  promoUsage: Record<string, number>;
  inventoryValue: number;
  outOfStock: number;
  lowStockProducts: {
    id: string;
    name: string;
    image: string;
    stock: number;
    isActive: boolean;
  }[];
  pendingReviews: number;
  avgRating: number;
  analytics: {
    pageViews: number;
    events: { event: string; count: number }[];
  };
}

export interface AdminEmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  body: string;
  data: string;
  status: string;
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export interface AccountOrder {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  promoCode: string | null;
  createdAt: string;
  city: string;
  items: {
    id: string;
    productName: string;
    image: string;
    unitPrice: number;
    quantity: number;
    size: string | null;
    color: string | null;
  }[];
}

export interface TrackedOrder {
  reference: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  city: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  promoCode: string | null;
  items: {
    productName: string;
    image: string;
    quantity: number;
    unitPrice: number;
    size: string | null;
    color: string | null;
  }[];
}

export interface StoreSettingsPublic {
  shipping: { standard: number; express: number; pickup: number };
  freeShippingThreshold: number;
  payment: {
    mobileMoneyEnabled: boolean;
    mobileMoneyNumber: string;
    instructions: string;
  };
}

export interface AdminSettings {
  shippingStandard: number;
  shippingExpress: number;
  shippingPickup: number;
  freeShippingThreshold: number;
  lowStockThreshold: number;
  paymentMobileMoneyEnabled: boolean;
  paymentMobileMoneyNumber: string;
  paymentInstructions: string;
}

export interface LoyaltyTransactionView {
  id: string;
  type: string; // earn | redeem | adjust | expire
  points: number; // +/-
  reason: string; // order:MC-XXXXXX | ...
  orderId: string | null;
  createdAt: string;
}

export interface LoyaltyResponse {
  ok: boolean;
  account: {
    points: number;
    lifetimePoints: number;
    tier: string; // bronze | silver | gold
    tierLabel: string;
    updatedAt: string;
    createdAt: string;
  };
  nextTier: {
    tier: string;
    label: string;
    threshold: number;
    pointsRemaining: number;
    progress: number; // 0..100
  } | null;
  transactions: LoyaltyTransactionView[];
  rules: {
    pointsPerSpent: number;
    fcfaPer100Points: number;
    redeemMinPoints: number;
    redeemMaxRate: number;
    tiers: { tier: string; label: string; threshold: number; bonusMultiplier: number }[];
  };
}

export interface PaymentStatusResponse {
  ok: boolean;
  transaction: {
    id: string;
    reference: string;
    orderId: string | null;
    provider: string;
    amount: number;
    currency: string;
    status: string;
    providerTxId: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

/* ------------------------------------------------------------------------- */
/* Réglages boutique (settings/public)                                       */
/* ------------------------------------------------------------------------- */

export const SETTINGS_DEFAULTS: StoreSettingsPublic = {
  shipping: { standard: 2000, express: 5000, pickup: 1000 },
  freeShippingThreshold: 50000,
  payment: {
    mobileMoneyEnabled: true,
    mobileMoneyNumber: "+225 07 00 00 00 00",
    instructions:
      "Envoyez le montant exact au numéro marchand via Wave / Orange Money / MTN / Moov en indiquant la référence de commande. La boutique confirme la réception puis prépare l'expédition.",
  },
};

export const LOW_STOCK_DEFAULT = 5;

export const LOYALTY_RULES: LoyaltyResponse["rules"] = {
  pointsPerSpent: 100, // 1 point / 100 F CFA dépensés
  fcfaPer100Points: 1000, // 100 points = 1 000 F CFA de remise
  redeemMinPoints: 500,
  redeemMaxRate: 0.5,
  tiers: [
    { tier: "bronze", label: "Bronze", threshold: 0, bonusMultiplier: 1 },
    { tier: "silver", label: "Argent", threshold: 5000, bonusMultiplier: 1.1 },
    { tier: "gold", label: "Or", threshold: 20000, bonusMultiplier: 1.25 },
  ],
};

function tierFor(lifetime: number): { tier: string; label: string } {
  let current = LOYALTY_RULES.tiers[0];
  for (const t of LOYALTY_RULES.tiers) {
    if (lifetime >= t.threshold) current = t;
  }
  return { tier: current.tier, label: current.label };
}

async function readSettingsDoc(): Promise<DocData | null> {
  const snap = await getDoc(doc(fbDb(), "settings", "public"));
  return snap.exists() ? (snap.data() as DocData) : null;
}

/* ------------------------------------------------------------------------- */
/* Couche API publique                                                       */
/* ------------------------------------------------------------------------- */

async function fetchCategories(): Promise<Category[]> {
  try {
    const snap = await getDocs(
      query(collection(fbDb(), "categories"), orderBy("order", "asc"))
    );
    return snap.docs.map((d) => mapCategory(d.id, d.data()));
  } catch (error) {
    return fail(error, "Impossible de charger les catégories.");
  }
}

async function fetchCategoryMap(): Promise<Map<string, Category>> {
  const categories = await fetchCategories();
  return new Map(categories.map((c) => [c.id, c]));
}

export const api = {
  products: {
    async list(): Promise<Product[]> {
      try {
        // Filtrage "actif" uniquement (égalité) + tri client : aucune
        // dépendance à un index composite Firestore.
        const [catMap, snap] = await Promise.all([
          fetchCategoryMap(),
          getDocs(
            query(
              collection(fbDb(), "products"),
              where("isActive", "==", true),
              fsLimit(500)
            )
          ),
        ]);
        return snap.docs
          .map((d) =>
            mapProduct(d.id, d.data(), catMap.get(String(d.data().categoryId ?? "")))
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (error) {
        return fail(error, "Impossible de charger les produits.");
      }
    },
  },

  categories: {
    async list(): Promise<Category[]> {
      return fetchCategories();
    },
  },

  // -------------------------------------------------------------------------
  // Marketing (collections Firestore, écritures publiques encadrées)
  // -------------------------------------------------------------------------
  newsletter: {
    async subscribe(email: string): Promise<{ ok: boolean; message: string }> {
      try {
        const clean = email.trim().toLowerCase();
        const dup = await getDocs(
          query(collection(fbDb(), "newsletter"), where("email", "==", clean), fsLimit(1))
        );
        if (!dup.empty) {
          return { ok: true, message: "Vous êtes déjà inscrit(e) à la newsletter." };
        }
        await addDoc(collection(fbDb(), "newsletter"), {
          email: clean,
          createdAt: serverTimestamp(),
        });
        return { ok: true, message: "Merci ! Vous êtes inscrit(e) à la newsletter." };
      } catch (error) {
        return fail(error, "Inscription impossible.");
      }
    },
  },

  contact: {
    async send(data: {
      name: string;
      email: string;
      subject?: string;
      message: string;
    }): Promise<{ ok: boolean; message: string }> {
      try {
        await addDoc(collection(fbDb(), "messages"), {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          subject: data.subject?.trim() || null,
          message: data.message.trim(),
          createdAt: serverTimestamp(),
        });
        return {
          ok: true,
          message: "Message envoyé ! L'équipe vous répondra rapidement.",
        };
      } catch (error) {
        return fail(error, "Envoi impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Avis clients (lecture publique des approuvés, écriture authentifiée)
  // -------------------------------------------------------------------------
  reviews: {
    async list(productId: string): Promise<Review[]> {
      try {
        // Égalités seules + tri client : pas d'index composite requis.
        const snap = await getDocs(
          query(
            collection(fbDb(), "reviews"),
            where("productId", "==", productId),
            where("isApproved", "==", true),
            fsLimit(100)
          )
        );
        return snap.docs
          .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            productId: String(data.productId ?? productId),
            author: String(data.author ?? "Client"),
            rating: typeof data.rating === "number" ? data.rating : 5,
            title: (data.title as string | null) ?? null,
            comment: String(data.comment ?? ""),
            createdAt: toIso(data.createdAt),
          } satisfies Review;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (error) {
        return fail(error, "Impossible de charger les avis.");
      }
    },
    async create(data: {
      productId: string;
      rating: number;
      comment: string;
      author: string;
    }): Promise<{ ok: boolean; pending?: boolean }> {
      try {
        requireAuthUser();
        await addDoc(collection(fbDb(), "reviews"), {
          productId: data.productId,
          author: data.author.trim() || "Client",
          uid: currentUser()?.uid ?? null,
          rating: Math.min(5, Math.max(1, Math.round(data.rating))),
          title: null,
          comment: data.comment.trim(),
          isApproved: false, // modération avant publication
          helpful: 0,
          createdAt: serverTimestamp(),
        });
        return { ok: true, pending: true };
      } catch (error) {
        return fail(error, "Envoi de l'avis impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Commandes — transaction Firestore : prix et stock relus depuis la base,
  // remise et livraison recalculées (le client ne fixe jamais les montants).
  // -------------------------------------------------------------------------
  orders: {
    async create(data: {
      email: string;
      customerName: string;
      phone?: string | null;
      items: {
        productId: string;
        quantity: number;
        size?: string | null;
        color?: string | null;
      }[];
      shippingMethod: "standard" | "express" | "pickup";
      promoCode?: string | null;
      paymentMethod?: "card" | "paypal" | "transfer" | "mobile_money";
      card?: { number: string; holder: string } | null;
      notes?: string | null;
      address: {
        line1: string;
        line2?: string | null;
        postalCode: string;
        city: string;
        country: string;
      };
    }): Promise<{
      ok: boolean;
      reference: string;
      subtotal: number;
      discount: number;
      shippingCost: number;
      total: number;
    }> {
      const db = fbDb();
      if (!data.items.length) {
        throw new ApiError("Votre panier est vide.", 400);
      }

      try {
        const result = await runTransaction(db, async (tx) => {
          // 1) Réglages de livraison (source de vérité).
          const settingsSnap = await tx.get(doc(db, "settings", "public"));
          const settingsData = (settingsSnap.data() ?? {}) as DocData;
          const shippingCfg = (settingsData.shipping ?? {}) as Record<string, number>;
          const freeThreshold =
            typeof settingsData.freeShippingThreshold === "number"
              ? settingsData.freeShippingThreshold
              : SETTINGS_DEFAULTS.freeShippingThreshold;
          const shippingCostBase =
            data.shippingMethod === "express"
              ? (shippingCfg.express ?? SETTINGS_DEFAULTS.shipping.express)
              : data.shippingMethod === "pickup"
                ? (shippingCfg.pickup ?? SETTINGS_DEFAULTS.shipping.pickup)
                : (shippingCfg.standard ?? SETTINGS_DEFAULTS.shipping.standard);

          // 2) Produits : prix et stock RÉELS relus dans Firestore.
          const productIds = [...new Set(data.items.map((i) => i.productId))];
          const productSnaps = await Promise.all(
            productIds.map((id) => tx.get(doc(db, "products", id)))
          );
          const productById = new Map<string, DocData & { id: string }>();
          productSnaps.forEach((snap, idx) => {
            if (snap.exists()) {
              productById.set(productIds[idx], { ...snap.data(), id: snap.id });
            }
          });

          let subtotal = 0;
          const itemSnapshots: AdminOrderItem[] = [];
          for (const item of data.items) {
            const product = productById.get(item.productId);
            if (!product) {
              throw new ApiError("Un produit du panier n'existe plus.", 410);
            }
            if (product.isActive === false) {
              throw new ApiError(
                `« ${String(product.name)} » n'est plus disponible.`,
                409
              );
            }
            const stock = typeof product.stock === "number" ? product.stock : 0;
            if (stock < item.quantity) {
              throw new ApiError(
                `Stock insuffisant pour « ${String(product.name)} » (disponible : ${stock}).`,
                409
              );
            }
            const unitPrice =
              typeof product.price === "number" ? product.price : 0;
            subtotal += unitPrice * item.quantity;
            itemSnapshots.push({
              id: item.productId,
              orderId: "", // renseigné après création du document commande
              productId: item.productId,
              productName: String(product.name ?? ""),
              image: String(product.image ?? ""),
              unitPrice,
              quantity: item.quantity,
              size: item.size ?? null,
              color: item.color ?? null,
            });
          }

          // 3) Code promo — relu et validé depuis Firestore.
          let discount = 0;
          let freeShipping = false;
          let appliedPromo: { id: string; code: string } | null = null;
          if (data.promoCode) {
            const code = data.promoCode.trim().toUpperCase();
            const promoQuery = await getDocs(
              query(collection(db, "promos"), where("code", "==", code), fsLimit(1))
            );
            const promoDoc = promoQuery.docs[0];
            if (promoDoc) {
              const promo = promoDoc.data();
              const isActive = promo.isActive !== false;
              const notExpired =
                !(promo.expiresAt instanceof Timestamp) ||
                promo.expiresAt.toDate().getTime() > Date.now();
              const minOk =
                subtotal >= (typeof promo.minSubtotal === "number" ? promo.minSubtotal : 0);
              const maxOk =
                typeof promo.maxUses !== "number" ||
                (typeof promo.usageCount === "number" && promo.usageCount < promo.maxUses);
              if (isActive && notExpired && minOk && maxOk) {
                const computation = computePromoLocal(
                  {
                    code,
                    label: String(promo.label ?? ""),
                    type: (promo.type as "percent" | "freeship" | "amount") ?? "percent",
                    value: typeof promo.value === "number" ? promo.value : 0,
                    minSubtotal: typeof promo.minSubtotal === "number" ? promo.minSubtotal : 0,
                  },
                  subtotal
                );
                discount = computation.discount;
                freeShipping = computation.freeShipping;
                appliedPromo = { id: promoDoc.id, code };
              }
            }
          }

          // 4) Livraison + total.
          const shippingCost =
            subtotal >= freeThreshold || freeShipping ? 0 : shippingCostBase;
          const total = Math.max(0, subtotal - discount) + shippingCost;

          // 5) Référence commande.
          const reference = `MC-${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`;

          const user = currentUser();
          const isMobileMoney = data.paymentMethod === "mobile_money";
          const orderRef = doc(collection(db, "orders"));
          const orderData: DocData = {
            reference,
            uid: user?.uid ?? null,
            email: data.email.trim().toLowerCase(),
            customerName: data.customerName.trim(),
            phone: data.phone ?? null,
            addressLine1: data.address.line1,
            addressLine2: data.address.line2 ?? null,
            postalCode: data.address.postalCode,
            city: data.address.city,
            country: data.address.country,
            shippingMethod: data.shippingMethod,
            shippingCost,
            subtotal,
            discount,
            total,
            promoCode: appliedPromo?.code ?? null,
            paymentMethod: isMobileMoney ? "mobile_money" : "card",
            paymentStatus: "unpaid",
            status: "pending",
            transactionId: null,
            cardLast4: !isMobileMoney && data.card
              ? data.card.number.replace(/\s/g, "").slice(-4)
              : null,
            notes: data.notes ?? null,
            stockApplied: false,
            items: itemSnapshots.map(({ id: _id, orderId: _orderId, ...rest }) => rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          tx.set(orderRef, orderData);

          // 6) Document de suivi public (référence + email requis pour lire).
          const lookupId = `${reference}__${data.email.trim().toLowerCase()}`
            .replace(/[^a-z0-9_\-@.]/gi, "_");
          tx.set(doc(db, "orderLookups", lookupId), {
            reference,
            orderId: orderRef.id,
            email: data.email.trim().toLowerCase(),
            status: "pending",
            paymentStatus: "unpaid",
            shippingMethod: data.shippingMethod,
            city: data.address.city,
            country: data.address.country,
            subtotal,
            discount,
            shippingCost,
            total,
            promoCode: appliedPromo?.code ?? null,
            items: itemSnapshots.map((i) => ({
              productName: i.productName,
              image: i.image,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              size: i.size,
              color: i.color,
            })),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // 7) Usage du code promo (incrément transactionnel).
          if (appliedPromo) {
            const promoSnap = await tx.get(doc(db, "promos", appliedPromo.id));
            const currentUsage =
              promoSnap.exists() && typeof promoSnap.data().usageCount === "number"
                ? promoSnap.data().usageCount
                : 0;
            tx.update(doc(db, "promos", appliedPromo.id), {
              usageCount: currentUsage + 1,
            });
          }

          // 8) Fidélité — créditée pour les commandes avec compte connecté.
          const authUser = useAuthStore.getState().user;
          if (authUser) {
            const loyaltyRef = doc(db, "loyalty", authUser.id);
            const loyaltySnap = await tx.get(loyaltyRef);
            const prevLifetime =
              loyaltySnap.exists() && typeof loyaltySnap.data().lifetimePoints === "number"
                ? loyaltySnap.data().lifetimePoints
                : 0;
            const tier = tierFor(prevLifetime);
            const bonus = LOYALTY_RULES.tiers.find((t) => t.tier === tier.tier)
              ?.bonusMultiplier ?? 1;
            const earned = Math.floor((total / LOYALTY_RULES.pointsPerSpent) * bonus);
            const newLifetime = prevLifetime + earned;
            const newTier = tierFor(newLifetime);
            const prevPoints =
              loyaltySnap.exists() && typeof loyaltySnap.data().points === "number"
                ? loyaltySnap.data().points
                : 0;
            if (loyaltySnap.exists()) {
              tx.update(loyaltyRef, {
                points: prevPoints + earned,
                lifetimePoints: newLifetime,
                tier: newTier.tier,
                updatedAt: serverTimestamp(),
              });
            } else {
              tx.set(loyaltyRef, {
                points: earned,
                lifetimePoints: newLifetime,
                tier: newTier.tier,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            tx.set(doc(collection(db, "loyalty", authUser.id, "transactions")), {
              type: "earn",
              points: earned,
              reason: `order:${reference}`,
              orderId: orderRef.id,
              createdAt: serverTimestamp(),
            });
          }

          // 9) Journal e-mail (confirmation enregistrée — l'envoi réel
          //    nécessite une extension Firebase, cf. FIREBASE-SETUP.md).
          tx.set(doc(collection(db, "emailLogs")), {
            to: data.email.trim().toLowerCase(),
            subject: `Confirmation de commande ${reference}`,
            template: "order_confirmation",
            body: `Bonjour ${data.customerName}, votre commande ${reference} d'un montant de ${total} FCFA a bien été enregistrée.`,
            data: JSON.stringify({ reference, total }),
            status: "logged",
            createdAt: serverTimestamp(),
          });

          return { reference, subtotal, discount, shippingCost, total, orderId: orderRef.id };
        });

        return { ok: true, ...result };
      } catch (error) {
        return fail(error, "La commande n'a pas pu être enregistrée.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Alertes de réassort
  // -------------------------------------------------------------------------
  stockAlerts: {
    async subscribe(productId: string, email: string): Promise<{ ok: boolean }> {
      try {
        const clean = email.trim().toLowerCase();
        const dup = await getDocs(
          query(
            collection(fbDb(), "stockAlerts"),
            where("email", "==", clean),
            where("productId", "==", productId),
            fsLimit(1)
          )
        );
        if (!dup.empty) return { ok: true };
        await addDoc(collection(fbDb(), "stockAlerts"), {
          email: clean,
          productId,
          notified: false,
          createdAt: serverTimestamp(),
        });
        return { ok: true };
      } catch (error) {
        return fail(error, "Inscription à l'alerte impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Validation code promo — source de vérité : collection promos Firestore.
  // Fallback : codes de démonstration intégrés si Firestore indisponible.
  // -------------------------------------------------------------------------
  promos: {
    async validate(
      code: string,
      subtotal: number
    ): Promise<{
      ok: boolean;
      error?: string;
      promo?: {
        code: string;
        label: string;
        type: "percent" | "freeship" | "amount";
        value: number;
        minSubtotal: number;
      };
      discount?: number;
      freeShipping?: boolean;
    }> {
      const clean = code.trim().toUpperCase();
      if (!clean) return { ok: false, error: "Veuillez saisir un code." };
      try {
        const snap = await getDocs(
          query(collection(fbDb(), "promos"), where("code", "==", clean), fsLimit(1))
        );
        const promoDoc = snap.docs[0];
        if (!promoDoc) {
          // Fallback local (codes de démonstration).
          const local = PROMO_CODES.find((p) => p.code === clean);
          if (!local) return { ok: false, error: "Ce code promo n'est pas valide." };
          const result = validateLocal(local, subtotal);
          return result;
        }
        const promo = promoDoc.data();
        if (promo.isActive === false) {
          return { ok: false, error: "Ce code promo n'est plus actif." };
        }
        if (
          promo.expiresAt instanceof Timestamp &&
          promo.expiresAt.toDate().getTime() < Date.now()
        ) {
          return { ok: false, error: "Ce code promo a expiré." };
        }
        const minSubtotal = typeof promo.minSubtotal === "number" ? promo.minSubtotal : 0;
        if (subtotal < minSubtotal) {
          return {
            ok: false,
            error: `Ce code est valable dès ${Math.round(minSubtotal).toLocaleString("fr-FR")} FCFA d'achat.`,
          };
        }
        const definition = {
          code: clean,
          label: String(promo.label ?? ""),
          type: (promo.type as "percent" | "freeship" | "amount") ?? "percent",
          value: typeof promo.value === "number" ? promo.value : 0,
          minSubtotal,
        };
        const computation = computePromoLocal(definition, subtotal);
        return {
          ok: true,
          promo: definition,
          discount: computation.discount,
          freeShipping: computation.freeShipping,
        };
      } catch (error) {
        return fail(error, "Validation du code impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Fidélité — carte et historique du client connecté (Firestore loyalty/*)
  // -------------------------------------------------------------------------
  loyalty: {
    async get(): Promise<LoyaltyResponse> {
      const user = requireAuthUser();
      try {
        const [accountSnap, txSnap] = await Promise.all([
          getDoc(doc(fbDb(), "loyalty", user.uid)),
          getDocs(
            query(
              collection(fbDb(), "loyalty", user.uid, "transactions"),
              orderBy("createdAt", "desc"),
              fsLimit(20)
            )
          ),
        ]);
        const data = accountSnap.data() ?? {};
        const points = typeof data.points === "number" ? data.points : 0;
        const lifetimePoints =
          typeof data.lifetimePoints === "number" ? data.lifetimePoints : 0;
        const tier = tierFor(lifetimePoints);
        const next = LOYALTY_RULES.tiers.find((t) => t.threshold > lifetimePoints);
        return {
          ok: true,
          account: {
            points,
            lifetimePoints,
            tier: tier.tier,
            tierLabel: tier.label,
            updatedAt: toIso(data.updatedAt),
            createdAt: toIso(data.createdAt),
          },
          nextTier: next
            ? {
                tier: next.tier,
                label: next.label,
                threshold: next.threshold,
                pointsRemaining: next.threshold - lifetimePoints,
                progress: Math.min(100, Math.round((lifetimePoints / next.threshold) * 100)),
              }
            : null,
          transactions: txSnap.docs.map((d) => {
            const t = d.data();
            return {
              id: d.id,
              type: String(t.type ?? "earn"),
              points: typeof t.points === "number" ? t.points : 0,
              reason: String(t.reason ?? ""),
              orderId: (t.orderId as string | null) ?? null,
              createdAt: toIso(t.createdAt),
            };
          }),
          rules: LOYALTY_RULES,
        };
      } catch (error) {
        return fail(error, "Carte de fidélité indisponible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Paiements — structure réelle (transactions pending, webhook prestataire
  // à configurer via Cloud Functions — cf. FIREBASE-SETUP.md).
  // -------------------------------------------------------------------------
  payments: {
    async initiate(data: {
      orderId: string;
      provider:
        | "mobile_money_wave"
        | "mobile_money_orange"
        | "mobile_money_mtn"
        | "mobile_money_moov";
      phoneNumber?: string;
    }): Promise<{
      ok: boolean;
      transactionId: string;
      reference: string;
      status: string;
      instructions: string;
    }> {
      try {
        const orderSnap = await getDoc(doc(fbDb(), "orders", data.orderId));
        if (!orderSnap.exists()) throw new ApiError("Commande introuvable.", 404);
        const order = orderSnap.data();
        const settings = (await readSettingsDoc()) ?? {};
        const payment = (settings.payment ?? {}) as DocData;
        const reference = `MC-PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const created = await addDoc(collection(fbDb(), "paymentTransactions"), {
          reference,
          orderId: data.orderId,
          provider: data.provider,
          amount: typeof order.total === "number" ? order.total : 0,
          currency: "XOF",
          status: "pending",
          providerTxId: null,
          phoneNumber: data.phoneNumber ?? null,
          failureReason: null,
          metadata: "{}",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          ok: true,
          transactionId: created.id,
          reference,
          status: "pending",
          instructions:
            String(payment.instructions ?? "") ||
            "Envoyez le montant au numéro marchand de la boutique en indiquant la référence.",
        };
      } catch (error) {
        return fail(error, "Initialisation du paiement impossible.");
      }
    },
    async status(id: string): Promise<PaymentStatusResponse> {
      try {
        const snap = await getDoc(doc(fbDb(), "paymentTransactions", id));
        if (!snap.exists()) throw new ApiError("Transaction introuvable.", 404);
        const t = snap.data();
        return {
          ok: true,
          transaction: {
            id: snap.id,
            reference: String(t.reference ?? ""),
            orderId: (t.orderId as string | null) ?? null,
            provider: String(t.provider ?? ""),
            amount: typeof t.amount === "number" ? t.amount : 0,
            currency: String(t.currency ?? "XOF"),
            status: String(t.status ?? "pending"),
            providerTxId: (t.providerTxId as string | null) ?? null,
            failureReason: (t.failureReason as string | null) ?? null,
            createdAt: toIso(t.createdAt),
            updatedAt: toIso(t.updatedAt),
          },
        };
      } catch (error) {
        return fail(error, "Statut de paiement indisponible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Réglages publics (frais de livraison affichés panier / checkout)
  // -------------------------------------------------------------------------
  settings: {
    async get(): Promise<StoreSettingsPublic> {
      try {
        const data = await readSettingsDoc();
        if (!data) return SETTINGS_DEFAULTS;
        const shipping = (data.shipping ?? {}) as Record<string, unknown>;
        const payment = (data.payment ?? {}) as Record<string, unknown>;
        return {
          shipping: {
            standard: typeof shipping.standard === "number" ? shipping.standard : SETTINGS_DEFAULTS.shipping.standard,
            express: typeof shipping.express === "number" ? shipping.express : SETTINGS_DEFAULTS.shipping.express,
            pickup: typeof shipping.pickup === "number" ? shipping.pickup : SETTINGS_DEFAULTS.shipping.pickup,
          },
          freeShippingThreshold:
            typeof data.freeShippingThreshold === "number"
              ? data.freeShippingThreshold
              : SETTINGS_DEFAULTS.freeShippingThreshold,
          payment: {
            mobileMoneyEnabled: payment.mobileMoneyEnabled === true,
            mobileMoneyNumber: String(payment.mobileMoneyNumber ?? ""),
            instructions: String(payment.instructions ?? ""),
          },
        };
      } catch {
        return SETTINGS_DEFAULTS;
      }
    },
  },

  // -------------------------------------------------------------------------
  // Auth — réinitialisation de mot de passe via Firebase Auth
  // -------------------------------------------------------------------------
  auth: {
    async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
      try {
        const { useAuthStore } = await import("@/lib/auth-store");
        await useAuthStore.getState().sendPasswordReset(email);
        return {
          ok: true,
          message:
            "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
        };
      } catch (error) {
        return fail(error, "Demande impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Compte client (session requise) — historique + suppression RGPD
  // -------------------------------------------------------------------------
  account: {
    async orders(): Promise<{ orders: AccountOrder[] }> {
      const user = requireAuthUser();
      try {
        // Égalités seules (uid / email) + tri client : pas d'index composite.
        const snap = await getDocs(
          query(
            collection(fbDb(), "orders"),
            where("uid", "==", user.uid),
            fsLimit(100)
          )
        );
        // Commandes invitées passées avec le même email (avant connexion).
        const emailSnap = await getDocs(
          query(
            collection(fbDb(), "orders"),
            where("email", "==", user.email ?? ""),
            where("uid", "==", null),
            fsLimit(100)
          )
        );
        const seen = new Set<string>();
        const orders: AccountOrder[] = [];
        for (const d of [...snap.docs, ...emailSnap.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const data = d.data();
          const items = Array.isArray(data.items) ? data.items : [];
          orders.push({
            id: d.id,
            reference: String(data.reference ?? ""),
            status: String(data.status ?? "pending"),
            paymentStatus: String(data.paymentStatus ?? "unpaid"),
            shippingMethod: String(data.shippingMethod ?? "standard"),
            subtotal: typeof data.subtotal === "number" ? data.subtotal : 0,
            discount: typeof data.discount === "number" ? data.discount : 0,
            shippingCost: typeof data.shippingCost === "number" ? data.shippingCost : 0,
            total: typeof data.total === "number" ? data.total : 0,
            promoCode: (data.promoCode as string | null) ?? null,
            createdAt: toIso(data.createdAt),
            city: String(data.city ?? ""),
            items: items.map((item: DocData, index: number) => ({
              id: `${d.id}-${index}`,
              productName: String(item.productName ?? ""),
              image: String(item.image ?? ""),
              unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
              quantity: typeof item.quantity === "number" ? item.quantity : 1,
              size: (item.size as string | null) ?? null,
              color: (item.color as string | null) ?? null,
            })),
          });
        }
        orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { orders };
      } catch (error) {
        return fail(error, "Historique des commandes indisponible.");
      }
    },

    async deleteAccount(): Promise<{ ok: boolean; message: string }> {
      const user = requireAuthUser();
      try {
        // Données Firestore du compte (le profil est re-créé à la prochaine inscription).
        const batch = writeBatch(fbDb());
        batch.delete(doc(fbDb(), "users", user.uid));
        batch.delete(doc(fbDb(), "loyalty", user.uid));
        await batch.commit();
        // Commandes conservées (obligation comptable) — cf. dialogue de confirmation.
        await deleteUser(user);
        useAuthStore.getState().setUser(null);
        return { ok: true, message: "Votre compte a été supprimé." };
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code === "auth/requires-recent-login") {
          throw new ApiError(
            "Veuillez vous déconnecter, vous reconnecter, puis recommencer pour confirmer la suppression.",
            401
          );
        }
        return fail(error, "Suppression impossible.");
      }
    },
  },

  // -------------------------------------------------------------------------
  // Suivi de commande public — doc orderLookups/{reference}__{email}
  // (lecture publique mais nécessite référence ET email, comme avant).
  // -------------------------------------------------------------------------
  async track(reference: string, email: string): Promise<{ ok: boolean; order: TrackedOrder }> {
    try {
      const lookupId = `${reference.trim()}__${email.trim().toLowerCase()}`
        .replace(/[^a-z0-9_\-@.]/gi, "_");
      const snap = await getDoc(doc(fbDb(), "orderLookups", lookupId));
      if (!snap.exists()) {
        throw new ApiError(
          "Aucune commande ne correspond à cette référence et cet email.",
          404
        );
      }
      const data = snap.data();
      return {
        ok: true,
        order: {
          reference: String(data.reference ?? reference),
          status: String(data.status ?? "pending"),
          paymentStatus: String(data.paymentStatus ?? "unpaid"),
          shippingMethod: String(data.shippingMethod ?? "standard"),
          city: String(data.city ?? ""),
          country: String(data.country ?? ""),
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
          subtotal: typeof data.subtotal === "number" ? data.subtotal : 0,
          discount: typeof data.discount === "number" ? data.discount : 0,
          shippingCost: typeof data.shippingCost === "number" ? data.shippingCost : 0,
          total: typeof data.total === "number" ? data.total : 0,
          promoCode: (data.promoCode as string | null) ?? null,
          items: (Array.isArray(data.items) ? data.items : []).map((item: DocData) => ({
            productName: String(item.productName ?? ""),
            image: String(item.image ?? ""),
            quantity: typeof item.quantity === "number" ? item.quantity : 1,
            unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
            size: (item.size as string | null) ?? null,
            color: (item.color as string | null) ?? null,
          })),
        },
      };
    } catch (error) {
      return fail(error, "Suivi indisponible.");
    }
  },

  // -------------------------------------------------------------------------
  // Espace administrateur — collections Firestore (règles : rôle admin)
  // -------------------------------------------------------------------------
  admin: {
    async stats(): Promise<AdminStats> {
      try {
        const db = fbDb();
        const lowStockThreshold = await getLowStockThreshold();
        const [ordersSnap, productsSnap, pendingReviews, pendingMessages, subscribers] =
          await Promise.all([
            getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), fsLimit(300))),
            getDocs(query(collection(db, "products"), fsLimit(500))),
            getCountFromServer(
              query(collection(db, "reviews"), where("isApproved", "==", false))
            ),
            getCountFromServer(collection(db, "messages")),
            getCountFromServer(collection(db, "newsletter")),
          ]);

        const orders = ordersSnap.docs.map((d) => mapAdminOrder(d.id, d.data()));
        const validOrders = orders.filter((o) => o.status !== "cancelled");
        const revenue = validOrders.reduce((sum, o) => sum + o.total, 0);
        const products = productsSnap.docs.map((d) =>
          mapProduct(d.id, d.data())
        );

        const dailyMap = new Map<string, { revenue: number; orders: number }>();
        for (let i = 13; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dailyMap.set(date.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
        }
        for (const order of validOrders) {
          const key = order.createdAt.slice(0, 10);
          const entry = dailyMap.get(key);
          if (entry) {
            entry.revenue += order.total;
            entry.orders += 1;
          }
        }

        return {
          revenue,
          ordersCount: validOrders.length,
          avgOrder: validOrders.length ? Math.round(revenue / validOrders.length) : 0,
          inventoryValue: products.reduce(
            (sum, p) => sum + (p.isActive ? p.price * p.stock : 0),
            0
          ),
          lowStockThreshold,
          productsCount: products.length,
          activeProductsCount: products.filter((p) => p.isActive).length,
          lowStock: products.filter((p) => p.stock > 0 && p.stock <= lowStockThreshold).length,
          pendingReviews: pendingReviews.data().count,
          pendingMessages: pendingMessages.data().count,
          subscribersCount: subscribers.data().count,
          recentOrders: orders.slice(0, 5),
          topProducts: [...products]
            .sort((a, b) => b.soldCount - a.soldCount)
            .slice(0, 5)
            .map((p) => ({
              id: p.id,
              name: p.name,
              image: p.image,
              soldCount: p.soldCount,
              price: p.price,
              stock: p.stock,
            })),
          daily: [...dailyMap.entries()].map(([date, value]) => ({ date, ...value })),
        };
      } catch (error) {
        return fail(error, "Statistiques indisponibles.");
      }
    },

    async orders(): Promise<{ orders: AdminOrder[]; total: number; page: number; limit: number }> {
      try {
        const snap = await getDocs(
          query(collection(fbDb(), "orders"), orderBy("createdAt", "desc"), fsLimit(300))
        );
        const orders = snap.docs.map((d) => mapAdminOrder(d.id, d.data()));
        return { orders, total: orders.length, page: 1, limit: 300 };
      } catch (error) {
        return fail(error, "Commandes indisponibles.");
      }
    },

    /**
     * Changement de statut d'une commande.
     * pending → paid/shipped : le stock et les ventes sont décomptés
     * (le client ne peut pas le faire : protégé par les règles).
     * paid/shipped → cancelled : le stock est restitué.
     */
    async updateOrderStatus(id: string, status: string): Promise<{ ok: boolean }> {
      try {
        const db = fbDb();
        const orderRef = doc(db, "orders", id);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) throw new ApiError("Commande introuvable.", 404);
        const order = mapAdminOrder(id, orderSnap.data());
        const wasStockApplied = orderSnap.data().stockApplied === true;
        const shouldApply =
          (status === "paid" || status === "shipped") && !wasStockApplied;
        const shouldRestore =
          status === "cancelled" && wasStockApplied;

        const batch = writeBatch(db);
        batch.update(orderRef, {
          status,
          paymentStatus:
            status === "paid" || status === "shipped" || status === "delivered"
              ? "paid"
              : status === "cancelled"
                ? order.paymentStatus === "paid"
                  ? "refunded"
                  : "unpaid"
                : orderSnap.data().paymentStatus ?? "unpaid",
          stockApplied: shouldApply ? true : shouldRestore ? false : wasStockApplied,
          updatedAt: serverTimestamp(),
        });

        // Miroir de suivi public.
        const lookupId = `${order.reference}__${order.email}`.replace(
          /[^a-z0-9_\-@.]/gi,
          "_"
        );
        batch.update(doc(db, "orderLookups", lookupId), {
          status,
          paymentStatus:
            status === "paid" || status === "shipped" || status === "delivered"
              ? "paid"
              : status === "cancelled"
                ? "refunded"
                : order.paymentStatus,
          updatedAt: serverTimestamp(),
        });

        const productStock = new Map<string, number>();
        for (const item of order.items) {
          productStock.set(
            item.productId,
            (productStock.get(item.productId) ?? 0) + item.quantity
          );
        }
        for (const [productId, qty] of productStock) {
          const productRef = doc(db, "products", productId);
          if (shouldApply) {
            const productSnap = await getDoc(productRef);
            const current =
              productSnap.exists() && typeof productSnap.data().stock === "number"
                ? productSnap.data().stock
                : 0;
            const soldCurrent =
              productSnap.exists() && typeof productSnap.data().soldCount === "number"
                ? productSnap.data().soldCount
                : 0;
            batch.update(productRef, {
              stock: Math.max(0, current - qty),
              soldCount: soldCurrent + qty,
            });
          } else if (shouldRestore) {
            const productSnap = await getDoc(productRef);
            const current =
              productSnap.exists() && typeof productSnap.data().stock === "number"
                ? productSnap.data().stock
                : 0;
            const soldCurrent =
              productSnap.exists() && typeof productSnap.data().soldCount === "number"
                ? productSnap.data().soldCount
                : 0;
            batch.update(productRef, {
              stock: current + qty,
              soldCount: Math.max(0, soldCurrent - qty),
            });
          }
        }

        // Journal e-mail (notification de statut enregistrée).
        batch.set(doc(collection(db, "emailLogs")), {
          to: order.email,
          subject: `Votre commande ${order.reference} — statut mis à jour`,
          template: "order_status",
          body: `Le statut de votre commande ${order.reference} est désormais : ${status}.`,
          data: JSON.stringify({ reference: order.reference, status }),
          status: "logged",
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        await logAudit("order.status", order.reference, { from: order.status, to: status });
        return { ok: true };
      } catch (error) {
        return fail(error, "Mise à jour du statut impossible.");
      }
    },

    async products(): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
      try {
        const [catMap, snap] = await Promise.all([
          fetchCategoryMap(),
          getDocs(query(collection(fbDb(), "products"), orderBy("createdAt", "desc"), fsLimit(500))),
        ]);
        const products = snap.docs.map((d) =>
          mapProduct(d.id, d.data(), catMap.get(String(d.data().categoryId ?? "")))
        );
        return { products, total: products.length, page: 1, limit: 500 };
      } catch (error) {
        return fail(error, "Catalogue indisponible.");
      }
    },

    async createProduct(data: {
      name: string;
      categoryId: string;
      price: number;
      oldPrice?: number | null;
      stock: number;
      description?: string;
      details?: string;
      image: string;
      gallery?: string[];
      sizes?: string[];
      colors?: string[];
      isFeatured?: boolean;
      isNew?: boolean;
      isActive?: boolean;
    }): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const categorySnap = await getDoc(doc(fbDb(), "categories", data.categoryId));
        if (!categorySnap.exists()) {
          throw new ApiError("La catégorie choisie n'existe plus.", 409);
        }
        const category = categorySnap.data();
        const name = data.name.trim();
        const now = new Date();
        const slug = `${slugify(name)}-${now.getTime().toString(36)}`;
        await addDoc(collection(fbDb(), "products"), {
          name,
          slug,
          description: data.description?.trim() ?? "",
          details: data.details?.trim() ?? "",
          price: data.price,
          oldPrice: data.oldPrice ?? null,
          image: data.image,
          gallery: data.gallery ?? [],
          categoryId: data.categoryId,
          categoryName: String(category.name ?? ""),
          stock: data.stock,
          rating: 0,
          reviewCount: 0,
          soldCount: 0,
          isFeatured: data.isFeatured ?? false,
          isNew: data.isNew ?? false,
          isActive: data.isActive ?? true,
          sizes: data.sizes ?? [],
          colors: data.colors ?? [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAudit("product.create", name, { price: data.price, stock: data.stock });
        return { ok: true };
      } catch (error) {
        return fail(error, "Création du produit impossible.");
      }
    },

    /**
     * Mise à jour produit. `restockNotified` : nombre de clients inscrits à
     * l'alerte réassort marqués notifiés quand le stock repasse au-dessus de 0
     * (l'envoi réel des e-mails nécessite une extension Firebase — cf.
     * FIREBASE-SETUP.md).
     */
    async updateProduct(
      id: string,
      data: Partial<{
        name: string;
        price: number;
        oldPrice: number | null;
        stock: number;
        description: string;
        details: string;
        image: string;
        categoryId: string;
        gallery: string[];
        sizes: string[];
        colors: string[];
        isFeatured: boolean;
        isNew: boolean;
        isActive: boolean;
      }>
    ): Promise<{ ok: boolean; restockNotified?: number }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const productRef = doc(db, "products", id);
        const beforeSnap = await getDoc(productRef);
        if (!beforeSnap.exists()) throw new ApiError("Produit introuvable.", 404);
        const before = beforeSnap.data();

        const patch: DocData = { updatedAt: serverTimestamp() };
        if (data.name !== undefined) patch.name = data.name.trim();
        if (data.price !== undefined) patch.price = data.price;
        if (data.oldPrice !== undefined) patch.oldPrice = data.oldPrice;
        if (data.stock !== undefined) patch.stock = Math.max(0, Math.round(data.stock));
        if (data.description !== undefined) patch.description = data.description;
        if (data.details !== undefined) patch.details = data.details;
        if (data.image !== undefined) patch.image = data.image;
        if (data.gallery !== undefined) patch.gallery = data.gallery;
        if (data.sizes !== undefined) patch.sizes = data.sizes;
        if (data.colors !== undefined) patch.colors = data.colors;
        if (data.isFeatured !== undefined) patch.isFeatured = data.isFeatured;
        if (data.isNew !== undefined) patch.isNew = data.isNew;
        if (data.isActive !== undefined) patch.isActive = data.isActive;
        if (data.categoryId !== undefined) {
          const categorySnap = await getDoc(doc(db, "categories", data.categoryId));
          if (!categorySnap.exists()) {
            throw new ApiError("La catégorie choisie n'existe plus.", 409);
          }
          patch.categoryId = data.categoryId;
          patch.categoryName = String(categorySnap.data().name ?? "");
        }

        await updateDoc(productRef, patch);
        await logAudit("product.update", String(before.name ?? id), data);

        // Réassort : stock 0 → >0 déclenche le marquage des alertes.
        let restockNotified = 0;
        const stockBefore = typeof before.stock === "number" ? before.stock : 0;
        const stockAfter = typeof patch.stock === "number" ? patch.stock : stockBefore;
        if (stockBefore === 0 && stockAfter > 0) {
          const alertsSnap = await getDocs(
            query(
              collection(db, "stockAlerts"),
              where("productId", "==", id),
              where("notified", "==", false)
            )
          );
          if (!alertsSnap.empty) {
            const batch = writeBatch(db);
            alertsSnap.docs.forEach((alertDoc) => {
              batch.update(alertDoc.ref, { notified: true });
            });
            await batch.commit();
            restockNotified = alertsSnap.size;
          }
        }
        return { ok: true, restockNotified };
      } catch (error) {
        return fail(error, "Mise à jour du produit impossible.");
      }
    },

    async deleteProduct(id: string): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const productRef = doc(fbDb(), "products", id);
        const snap = await getDoc(productRef);
        await deleteDoc(productRef);
        await logAudit("product.delete", String(snap.data()?.name ?? id), {});
        return { ok: true };
      } catch (error) {
        return fail(error, "Suppression du produit impossible.");
      }
    },

    async categories(): Promise<{ categories: AdminCategory[] }> {
      try {
        const [categoriesSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(fbDb(), "categories"), orderBy("order", "asc"))),
          getDocs(query(collection(fbDb(), "products"), fsLimit(500))),
        ]);
        const counts = new Map<string, number>();
        productsSnap.docs.forEach((d) => {
          const catId = String(d.data().categoryId ?? "");
          counts.set(catId, (counts.get(catId) ?? 0) + 1);
        });
        const categories: AdminCategory[] = categoriesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ""),
            slug: String(data.slug ?? ""),
            description: String(data.description ?? ""),
            image: String(data.image ?? ""),
            order: typeof data.order === "number" ? data.order : 0,
            productCount: counts.get(d.id) ?? 0,
            createdAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
          };
        });
        return { categories };
      } catch (error) {
        return fail(error, "Catégories indisponibles.");
      }
    },

    async createCategory(data: {
      name: string;
      slug?: string;
      description?: string;
      image?: string;
      order?: number;
    }): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const name = data.name.trim();
        const slug = (data.slug?.trim() || slugify(name)) || `categorie-${Date.now().toString(36)}`;
        // Anti-doublon : slug unique.
        const dup = await getDocs(
          query(collection(fbDb(), "categories"), where("slug", "==", slug), fsLimit(1))
        );
        if (!dup.empty) {
          throw new ApiError(
            `Une catégorie avec un nom similaire existe déjà (slug « ${slug} »).`,
            409
          );
        }
        await addDoc(collection(fbDb(), "categories"), {
          name,
          slug,
          description: data.description?.trim() ?? "",
          image: data.image?.trim() ?? "",
          order: Math.max(0, Math.round(data.order ?? 0)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAudit("category.create", name, { slug });
        return { ok: true };
      } catch (error) {
        return fail(error, "Création de la catégorie impossible.");
      }
    },

    async updateCategory(
      id: string,
      data: Partial<{ name: string; slug: string; description: string; image: string; order: number }>
    ): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const categoryRef = doc(db, "categories", id);
        const beforeSnap = await getDoc(categoryRef);
        if (!beforeSnap.exists()) throw new ApiError("Catégorie introuvable.", 404);
        const before = beforeSnap.data();
        const patch: DocData = { updatedAt: serverTimestamp() };
        if (data.name !== undefined) patch.name = data.name.trim();
        if (data.slug !== undefined) patch.slug = data.slug.trim();
        if (data.description !== undefined) patch.description = data.description;
        if (data.image !== undefined) patch.image = data.image.trim();
        if (data.order !== undefined) patch.order = Math.max(0, Math.round(data.order));
        await updateDoc(categoryRef, patch);
        // Propagation du nom aux produits (nom dénormalisé).
        if (data.name !== undefined) {
          const productsSnap = await getDocs(
            query(collection(db, "products"), where("categoryId", "==", id))
          );
          if (!productsSnap.empty) {
            const batch = writeBatch(db);
            productsSnap.docs.forEach((p) => {
              batch.update(p.ref, { categoryName: data.name });
            });
            await batch.commit();
          }
        }
        await logAudit("category.update", String(before.name ?? id), data);
        return { ok: true };
      } catch (error) {
        return fail(error, "Mise à jour de la catégorie impossible.");
      }
    },

    async deleteCategory(id: string): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const productsSnap = await getDocs(
          query(collection(db, "products"), where("categoryId", "==", id), fsLimit(1))
        );
        if (!productsSnap.empty) {
          throw new ApiError(
            "Impossible de supprimer : des produits sont encore rattachés à cette catégorie.",
            409
          );
        }
        const snap = await getDoc(doc(db, "categories", id));
        await deleteDoc(doc(db, "categories", id));
        await logAudit("category.delete", String(snap.data()?.name ?? id), {});
        return { ok: true };
      } catch (error) {
        return fail(error, "Suppression de la catégorie impossible.");
      }
    },

    async reviews(status?: "pending" | "approved" | "all"): Promise<AdminReview[]> {
      try {
        const [catMap, productsSnap] = await Promise.all([
          Promise.resolve(null),
          getDocs(query(collection(fbDb(), "products"), fsLimit(500))),
        ]);
        void catMap;
        const productMap = new Map(
          productsSnap.docs.map((d) => [
            d.id,
            { name: String(d.data().name ?? ""), image: String(d.data().image ?? "") },
          ])
        );
        const base = collection(fbDb(), "reviews");
        const snap =
          status && status !== "all"
            ? await getDocs(
                query(base, where("isApproved", "==", status === "approved"), fsLimit(200))
              )
            : await getDocs(query(base, fsLimit(200)));
        const adminReviews = snap.docs
          .map((d) => {
          const data = d.data();
          const productId = String(data.productId ?? "");
          const product = productMap.get(productId) ?? { name: "Produit supprimé", image: "" };
          return {
            id: d.id,
            productId,
            author: String(data.author ?? ""),
            rating: typeof data.rating === "number" ? data.rating : 5,
            title: (data.title as string | null) ?? null,
            comment: String(data.comment ?? ""),
            isApproved: data.isApproved === true,
            helpful: typeof data.helpful === "number" ? data.helpful : 0,
            createdAt: toIso(data.createdAt),
            product,
          } satisfies AdminReview;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return adminReviews;
      } catch (error) {
        return fail(error, "Avis indisponibles.");
      }
    },

    /** Modération + recalcul de la note moyenne du produit concerné. */
    async setReviewApproval(id: string, isApproved: boolean): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const reviewRef = doc(db, "reviews", id);
        await updateDoc(reviewRef, { isApproved });
        const reviewSnap = await getDoc(reviewRef);
        const productId = String(reviewSnap.data()?.productId ?? "");
        if (productId) await recalcProductRating(productId);
        await logAudit("review.approval", id, { isApproved });
        return { ok: true };
      } catch (error) {
        return fail(error, "Modération impossible.");
      }
    },

    async deleteReview(id: string): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const reviewSnap = await getDoc(doc(db, "reviews", id));
        const productId = String(reviewSnap.data()?.productId ?? "");
        await deleteDoc(doc(db, "reviews", id));
        if (productId) await recalcProductRating(productId);
        await logAudit("review.delete", id, {});
        return { ok: true };
      } catch (error) {
        return fail(error, "Suppression de l'avis impossible.");
      }
    },

    async promos(): Promise<AdminPromo[]> {
      try {
        const snap = await getDocs(
          query(collection(fbDb(), "promos"), orderBy("createdAt", "desc"), fsLimit(200))
        );
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: String(data.code ?? ""),
            label: String(data.label ?? ""),
            type: String(data.type ?? "percent"),
            value: typeof data.value === "number" ? data.value : 0,
            minSubtotal: typeof data.minSubtotal === "number" ? data.minSubtotal : 0,
            isActive: data.isActive !== false,
            expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate().toISOString() : null,
            usageCount: typeof data.usageCount === "number" ? data.usageCount : 0,
            maxUses: nullableNumber(data.maxUses),
            createdAt: toIso(data.createdAt),
          } satisfies AdminPromo;
        });
      } catch (error) {
        return fail(error, "Codes promo indisponibles.");
      }
    },

    async createPromo(data: {
      code: string;
      label: string;
      type: "percent" | "freeship" | "amount";
      value: number;
      minSubtotal: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    }): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const code = data.code.trim().toUpperCase();
        const dup = await getDocs(
          query(collection(fbDb(), "promos"), where("code", "==", code), fsLimit(1))
        );
        if (!dup.empty) {
          throw new ApiError(`Le code « ${code} » existe déjà.`, 409);
        }
        await addDoc(collection(fbDb(), "promos"), {
          code,
          label: data.label.trim(),
          type: data.type,
          value: data.value,
          minSubtotal: data.minSubtotal,
          isActive: true,
          expiresAt: data.expiresAt ? Timestamp.fromDate(new Date(data.expiresAt)) : null,
          usageCount: 0,
          maxUses: data.maxUses ?? null,
          createdAt: serverTimestamp(),
        });
        await logAudit("promo.create", code, data);
        return { ok: true };
      } catch (error) {
        return fail(error, "Création du code promo impossible.");
      }
    },

    async updatePromo(
      id: string,
      data: Partial<{
        label: string;
        type: "percent" | "freeship" | "amount";
        value: number;
        minSubtotal: number;
        maxUses: number | null;
        expiresAt: string | null;
        isActive: boolean;
      }>
    ): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        const patch: DocData = {};
        if (data.label !== undefined) patch.label = data.label;
        if (data.type !== undefined) patch.type = data.type;
        if (data.value !== undefined) patch.value = data.value;
        if (data.minSubtotal !== undefined) patch.minSubtotal = data.minSubtotal;
        if (data.maxUses !== undefined) patch.maxUses = data.maxUses;
        if (data.expiresAt !== undefined) {
          patch.expiresAt = data.expiresAt ? Timestamp.fromDate(new Date(data.expiresAt)) : null;
        }
        if (data.isActive !== undefined) patch.isActive = data.isActive;
        await updateDoc(doc(fbDb(), "promos", id), patch);
        await logAudit("promo.update", id, data);
        return { ok: true };
      } catch (error) {
        return fail(error, "Mise à jour du code promo impossible.");
      }
    },

    async deletePromo(id: string): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        await deleteDoc(doc(fbDb(), "promos", id));
        await logAudit("promo.delete", id, {});
        return { ok: true };
      } catch (error) {
        return fail(error, "Suppression du code promo impossible.");
      }
    },

    async messages(): Promise<{
      messages: AdminContactMessage[];
      subscribers: AdminSubscriber[];
      stockAlerts: AdminStockAlert[];
    }> {
      try {
        const [messagesSnap, subscribersSnap, alertsSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(fbDb(), "messages"), orderBy("createdAt", "desc"), fsLimit(100))),
          getDocs(query(collection(fbDb(), "newsletter"), orderBy("createdAt", "desc"), fsLimit(200))),
          getDocs(query(collection(fbDb(), "stockAlerts"), orderBy("createdAt", "desc"), fsLimit(100))),
          getDocs(query(collection(fbDb(), "products"), fsLimit(500))),
        ]);
        const productMap = new Map(
          productsSnap.docs.map((d) => [
            d.id,
            {
              name: String(d.data().name ?? ""),
              image: String(d.data().image ?? ""),
              stock: typeof d.data().stock === "number" ? d.data().stock : 0,
            },
          ])
        );
        return {
          messages: messagesSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? ""),
              email: String(data.email ?? ""),
              subject: (data.subject as string | null) ?? null,
              message: String(data.message ?? ""),
              createdAt: toIso(data.createdAt),
            };
          }),
          subscribers: subscribersSnap.docs.map((d) => ({
            id: d.id,
            email: String(d.data().email ?? ""),
            createdAt: toIso(d.data().createdAt),
          })),
          stockAlerts: alertsSnap.docs.map((d) => {
            const data = d.data();
            const productId = String(data.productId ?? "");
            const product = productMap.get(productId) ?? { name: "Produit supprimé", image: "", stock: 0 };
            return {
              id: d.id,
              email: String(data.email ?? ""),
              productId,
              notified: data.notified === true,
              createdAt: toIso(data.createdAt),
              product,
            };
          }),
        };
      } catch (error) {
        return fail(error, "Messages indisponibles.");
      }
    },

    async customers(_q?: string): Promise<AdminCustomer[]> {
      try {
        const [usersSnap, ordersSnap] = await Promise.all([
          getDocs(query(collection(fbDb(), "users"), orderBy("createdAt", "desc"), fsLimit(500))),
          getDocs(query(collection(fbDb(), "orders"), fsLimit(500))),
        ]);
        const statsByEmail = new Map<string, { count: number; spent: number; last: string | null }>();
        ordersSnap.docs.forEach((d) => {
          const data = d.data();
          const email = String(data.email ?? "").toLowerCase();
          if (!email) return;
          const entry = statsByEmail.get(email) ?? { count: 0, spent: 0, last: null };
          if (data.status !== "cancelled") {
            entry.count += 1;
            entry.spent += typeof data.total === "number" ? data.total : 0;
          }
          const createdAtIso = toIso(data.createdAt);
          if (!entry.last || createdAtIso > entry.last) entry.last = createdAtIso;
          statsByEmail.set(email, entry);
        });
        return usersSnap.docs.map((d) => {
          const data = d.data();
          const email = String(data.email ?? "").toLowerCase();
          const stats = statsByEmail.get(email) ?? { count: 0, spent: 0, last: null };
          return {
            id: d.id,
            name: (data.name as string | null) || null,
            email: String(data.email ?? ""),
            role: data.role === "admin" ? "admin" : "customer",
            createdAt: toIso(data.createdAt),
            ordersCount: stats.count,
            totalSpent: stats.spent,
            lastOrderAt: stats.last,
          } satisfies AdminCustomer;
        });
      } catch (error) {
        return fail(error, "Clients indisponibles.");
      }
    },

    /** Le rôle admin d'un client ne peut être changé que par un admin (règles). */
    async setCustomerRole(id: string, role: "customer" | "admin"): Promise<{ ok: boolean }> {
      try {
        requireAuthUser();
        await updateDoc(doc(fbDb(), "users", id), { role });
        await logAudit("customer.role", id, { role });
        return { ok: true };
      } catch (error) {
        return fail(error, "Changement de rôle impossible.");
      }
    },

    async reports(days: 7 | 30 | 90 = 30): Promise<AdminReport> {
      try {
        const db = fbDb();
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceIso = since.toISOString();

        const [ordersSnap, productsSnap, usersSnap, pendingReviews, analyticsSnap] =
          await Promise.all([
            getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), fsLimit(500))),
            getDocs(query(collection(db, "products"), fsLimit(500))),
            getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), fsLimit(500))),
            getCountFromServer(query(collection(db, "reviews"), where("isApproved", "==", false))),
            getDocs(query(collection(db, "analytics"), orderBy("createdAt", "desc"), fsLimit(500))),
          ]);

        const catMap = await fetchCategoryMap();
        const lowStockThreshold = await getLowStockThreshold();

        const orders = ordersSnap.docs
          .map((d) => mapAdminOrder(d.id, d.data()))
          .filter((o) => o.createdAt >= sinceIso);
        const validOrders = orders.filter((o) => o.status !== "cancelled");
        const revenue = validOrders.reduce((sum, o) => sum + o.total, 0);
        const products = productsSnap.docs.map((d) => mapProduct(d.id, d.data()));

        const statusBreakdown: Record<string, number> = {};
        const shippingBreakdown: Record<string, number> = {};
        const paymentBreakdown: Record<string, number> = {};
        const promoUsage: Record<string, number> = {};
        const productAgg = new Map<string, { name: string; image: string; quantity: number; revenue: number }>();
        const categoryAgg = new Map<string, number>();
        for (const order of validOrders) {
          statusBreakdown[order.status] = (statusBreakdown[order.status] ?? 0) + 1;
          shippingBreakdown[order.shippingMethod] =
            (shippingBreakdown[order.shippingMethod] ?? 0) + 1;
          paymentBreakdown[order.paymentMethod] =
            (paymentBreakdown[order.paymentMethod] ?? 0) + 1;
          if (order.promoCode) {
            promoUsage[order.promoCode] = (promoUsage[order.promoCode] ?? 0) + 1;
          }
          for (const item of order.items) {
            const entry =
              productAgg.get(item.productId) ??
              { name: item.productName, image: item.image, quantity: 0, revenue: 0 };
            entry.quantity += item.quantity;
            entry.revenue += item.unitPrice * item.quantity;
            productAgg.set(item.productId, entry);
          }
        }
        // Chiffre par catégorie via le produit.
        for (const [productId, entry] of productAgg) {
          const product = products.find((p) => p.id === productId);
          const categoryName = product?.category?.name ?? "Autres";
          categoryAgg.set(categoryName, (categoryAgg.get(categoryName) ?? 0) + entry.revenue);
        }

        const events = new Map<string, number>();
        let pageViews = 0;
        analyticsSnap.docs.forEach((d) => {
          const event = String(d.data().event ?? "unknown");
          events.set(event, (events.get(event) ?? 0) + 1);
          if (event === "page_view") pageViews += 1;
        });

        const ratings = products.filter((p) => p.reviewCount > 0);
        const avgRating = ratings.length
          ? ratings.reduce((sum, p) => sum + p.rating, 0) / ratings.length
          : 0;

        return {
          days,
          revenue,
          ordersCount: validOrders.length,
          avgOrder: validOrders.length ? Math.round(revenue / validOrders.length) : 0,
          newCustomers: usersSnap.docs.filter(
            (d) => toIso(d.data().createdAt) >= sinceIso
          ).length,
          statusBreakdown,
          shippingBreakdown,
          paymentBreakdown,
          salesByCategory: [...categoryAgg.entries()]
            .map(([name, catRevenue]) => ({ name, revenue: catRevenue }))
            .sort((a, b) => b.revenue - a.revenue),
          topProducts: [...productAgg.entries()]
            .map(([id, entry]) => {
              const product = products.find((p) => p.id === id);
              return {
                id,
                name: entry.name,
                image: entry.image,
                stock: product?.stock ?? 0,
                quantity: entry.quantity,
                revenue: entry.revenue,
              };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10),
          promoUsage,
          inventoryValue: products.reduce((sum, p) => sum + p.price * p.stock, 0),
          outOfStock: products.filter((p) => p.stock === 0).length,
          lowStockProducts: products
            .filter((p) => p.stock <= lowStockThreshold)
            .map((p) => ({
              id: p.id,
              name: p.name,
              image: p.image,
              stock: p.stock,
              isActive: p.isActive,
            })),
          pendingReviews: pendingReviews.data().count,
          avgRating,
          analytics: {
            pageViews,
            events: [...events.entries()]
              .map(([event, count]) => ({ event, count }))
              .sort((a, b) => b.count - a.count),
          },
        };
      } catch (error) {
        return fail(error, "Rapport indisponible.");
      }
    },

    async settings(): Promise<AdminSettings> {
      try {
        const data = (await readSettingsDoc()) ?? {};
        const shipping = (data.shipping ?? {}) as Record<string, unknown>;
        const payment = (data.payment ?? {}) as Record<string, unknown>;
        return {
          shippingStandard: typeof shipping.standard === "number" ? shipping.standard : SETTINGS_DEFAULTS.shipping.standard,
          shippingExpress: typeof shipping.express === "number" ? shipping.express : SETTINGS_DEFAULTS.shipping.express,
          shippingPickup: typeof shipping.pickup === "number" ? shipping.pickup : SETTINGS_DEFAULTS.shipping.pickup,
          freeShippingThreshold:
            typeof data.freeShippingThreshold === "number"
              ? data.freeShippingThreshold
              : SETTINGS_DEFAULTS.freeShippingThreshold,
          lowStockThreshold:
            typeof data.lowStockThreshold === "number"
              ? data.lowStockThreshold
              : LOW_STOCK_DEFAULT,
          paymentMobileMoneyEnabled: payment.mobileMoneyEnabled === true,
          paymentMobileMoneyNumber: String(payment.mobileMoneyNumber ?? ""),
          paymentInstructions: String(payment.instructions ?? ""),
        };
      } catch (error) {
        return fail(error, "Réglages indisponibles.");
      }
    },

    async updateSettings(data: Partial<AdminSettings>): Promise<{ ok: boolean; settings: AdminSettings }> {
      try {
        requireAuthUser();
        const db = fbDb();
        const ref = doc(db, "settings", "public");
        const current = await api.admin.settings();
        const next: AdminSettings = { ...current, ...data };
        await setDoc(
          ref,
          {
            shipping: {
              standard: next.shippingStandard,
              express: next.shippingExpress,
              pickup: next.shippingPickup,
            },
            freeShippingThreshold: next.freeShippingThreshold,
            lowStockThreshold: next.lowStockThreshold,
            payment: {
              mobileMoneyEnabled: next.paymentMobileMoneyEnabled,
              mobileMoneyNumber: next.paymentMobileMoneyNumber,
              instructions: next.paymentInstructions,
            },
          },
          { merge: true }
        );
        await logAudit("settings.update", "settings/public", data);
        return { ok: true, settings: next };
      } catch (error) {
        return fail(error, "Mise à jour des réglages impossible.");
      }
    },

    /**
     * Export CSV — généré côté client depuis Firestore (aucun serveur).
     * Déclenche le téléchargement d'un fichier CSV.
     */
    async exportCsv(type: "orders" | "products" | "customers"): Promise<void> {
      try {
        let rows: string[][] = [];
        let filename = "export.csv";
        if (type === "orders") {
          const { orders } = await api.admin.orders();
          filename = "commandes.csv";
          rows = [
            ["Référence", "Date", "Client", "Email", "Téléphone", "Ville", "Statut", "Paiement", "Sous-total", "Remise", "Livraison", "Total", "Promo"],
            ...orders.map((o) => [
              o.reference,
              new Date(o.createdAt).toLocaleString("fr-FR"),
              o.customerName,
              o.email,
              o.phone ?? "",
              o.city,
              o.status,
              o.paymentStatus,
              String(o.subtotal),
              String(o.discount),
              String(o.shippingCost),
              String(o.total),
              o.promoCode ?? "",
            ]),
          ];
        } else if (type === "products") {
          const { products } = await api.admin.products();
          filename = "produits.csv";
          rows = [
            ["Nom", "Catégorie", "Prix", "Ancien prix", "Stock", "Vendus", "Actif", "Vedette", "Nouveau"],
            ...products.map((p) => [
              p.name,
              p.category?.name ?? "",
              String(p.price),
              p.oldPrice !== null ? String(p.oldPrice) : "",
              String(p.stock),
              String(p.soldCount),
              p.isActive ? "oui" : "non",
              p.isFeatured ? "oui" : "non",
              p.isNew ? "oui" : "non",
            ]),
          ];
        } else {
          const customers = await api.admin.customers();
          filename = "clients.csv";
          rows = [
            ["Nom", "Email", "Rôle", "Inscription", "Commandes", "Total dépensé"],
            ...customers.map((c) => [
              c.name ?? "",
              c.email,
              c.role,
              new Date(c.createdAt).toLocaleDateString("fr-FR"),
              String(c.ordersCount),
              String(c.totalSpent),
            ]),
          ];
        }
        const csv = rows
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
          )
          .join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        await logAudit("export.csv", type, {});
      } catch (error) {
        return fail(error, "Export impossible.");
      }
    },

    async emails(
      page = 1,
      limit = 25,
      q?: string,
      template?: string
    ): Promise<{ emails: AdminEmailLog[]; total: number; page: number; limit: number }> {
      try {
        const snap = await getDocs(
          query(collection(fbDb(), "emailLogs"), orderBy("createdAt", "desc"), fsLimit(200))
        );
        let emails: AdminEmailLog[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            to: String(data.to ?? ""),
            subject: String(data.subject ?? ""),
            template: String(data.template ?? ""),
            body: String(data.body ?? ""),
            data: String(data.data ?? "{}"),
            status: String(data.status ?? "logged"),
            createdAt: toIso(data.createdAt),
          };
        });
        const needle = q?.trim().toLowerCase();
        if (needle) {
          emails = emails.filter(
            (e) =>
              e.to.toLowerCase().includes(needle) ||
              e.subject.toLowerCase().includes(needle)
          );
        }
        if (template && template !== "all") {
          emails = emails.filter((e) => e.template === template);
        }
        const total = emails.length;
        const start = (page - 1) * limit;
        return { emails: emails.slice(start, start + limit), total, page, limit };
      } catch (error) {
        return fail(error, "Journal des e-mails indisponible.");
      }
    },

    async audit(
      page = 1,
      limit = 30,
      action?: string
    ): Promise<{ entries: AdminAuditEntry[]; total: number; page: number; limit: number }> {
      try {
        const snap = await getDocs(
          query(collection(fbDb(), "auditLogs"), orderBy("createdAt", "desc"), fsLimit(300))
        );
        let entries: AdminAuditEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            actor: String(data.actor ?? ""),
            action: String(data.action ?? ""),
            target: String(data.target ?? ""),
            details: String(data.details ?? "{}"),
            createdAt: toIso(data.createdAt),
          };
        });
        if (action && action !== "all") {
          entries = entries.filter((e) => e.action.startsWith(action));
        }
        const total = entries.length;
        const start = (page - 1) * limit;
        return { entries: entries.slice(start, start + limit), total, page, limit };
      } catch (error) {
        return fail(error, "Journal d'audit indisponible.");
      }
    },

    // -----------------------------------------------------------------------
    // Données initiales (catégories de référence + codes promo + réglages).
    // Action admin explicite : aucune écriture surprise en base.
    // -----------------------------------------------------------------------
    async seedInitialData(): Promise<{ categories: number; promos: number }> {
      try {
        requireAuthUser();
        const db = fbDb();

        // Réglages publics de base (livraison FCFA, paiement mobile money).
        await setDoc(
          doc(db, "settings", "public"),
          {
            ...SETTINGS_DEFAULTS,
            lowStockThreshold: LOW_STOCK_DEFAULT,
            adminExists: true,
          },
          { merge: true }
        );

        // Catégories initiales de référence (données de structure, pas des produits).
        const INITIAL_CATEGORIES: { name: string; slug: string; description: string }[] = [
          { name: "Vêtements", slug: "vetements", description: "Prêts-à-porter femme, homme et enfant." },
          { name: "Chaussures", slug: "chaussures", description: "Sandales, baskets, mocassins et talons." },
          { name: "Sacs", slug: "sacs", description: "Sacs à main, cabas et pochettes." },
          { name: "Accessoires", slug: "accessoires", description: "Bijoux, foulards, ceintures et lunettes." },
          { name: "Mode Homme", slug: "mode-homme", description: "Chemises, pantalons et ensembles homme." },
          { name: "Mode Femme", slug: "mode-femme", description: "Robes, ensembles et tenues femme." },
        ];
        let createdCategories = 0;
        for (let i = 0; i < INITIAL_CATEGORIES.length; i++) {
          const category = INITIAL_CATEGORIES[i];
          const dup = await getDocs(
            query(collection(db, "categories"), where("slug", "==", category.slug), fsLimit(1))
          );
          if (!dup.empty) continue;
          await addDoc(collection(db, "categories"), {
            ...category,
            image: "",
            order: i + 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          createdCategories += 1;
        }

        // Codes promo de démarrage (identiques aux codes de démonstration UI).
        let createdPromos = 0;
        for (const promo of PROMO_CODES) {
          const dup = await getDocs(
            query(collection(db, "promos"), where("code", "==", promo.code), fsLimit(1))
          );
          if (!dup.empty) continue;
          await addDoc(collection(db, "promos"), {
            code: promo.code,
            label: promo.label,
            type: promo.type,
            value: promo.value,
            minSubtotal: promo.minSubtotal,
            isActive: true,
            expiresAt: null,
            usageCount: 0,
            maxUses: null,
            createdAt: serverTimestamp(),
          });
          createdPromos += 1;
        }

        await logAudit("seed.initial", "catalogue", {
          categories: createdCategories,
          promos: createdPromos,
        });
        return { categories: createdCategories, promos: createdPromos };
      } catch (error) {
        return fail(error, "Initialisation impossible.");
      }
    },
  },
};

/* ------------------------------------------------------------------------- */
/* Helpers internes                                                          */
/* ------------------------------------------------------------------------- */

function validateLocal(
  promo: { code: string; label: string; type: "percent" | "freeship" | "amount"; value: number; minSubtotal: number },
  subtotal: number
): { ok: boolean; error?: string; promo?: typeof promo; discount?: number; freeShipping?: boolean } {
  if (subtotal < promo.minSubtotal) {
    return {
      ok: false,
      error: `Ce code est valable dès ${Math.round(promo.minSubtotal).toLocaleString("fr-FR")} FCFA d'achat.`,
    };
  }
  const computation = computePromoLocal(promo, subtotal);
  return { ok: true, promo, discount: computation.discount, freeShipping: computation.freeShipping };
}

async function getLowStockThreshold(): Promise<number> {
  try {
    const data = await readSettingsDoc();
    return typeof data?.lowStockThreshold === "number"
      ? data.lowStockThreshold
      : LOW_STOCK_DEFAULT;
  } catch {
    return LOW_STOCK_DEFAULT;
  }
}

function mapAdminOrder(id: string, data: DocData): AdminOrder {
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    id,
    reference: String(data.reference ?? ""),
    status: String(data.status ?? "pending"),
    email: String(data.email ?? ""),
    customerName: String(data.customerName ?? ""),
    phone: (data.phone as string | null) ?? null,
    addressLine1: String(data.addressLine1 ?? ""),
    addressLine2: (data.addressLine2 as string | null) ?? null,
    postalCode: String(data.postalCode ?? ""),
    city: String(data.city ?? ""),
    country: String(data.country ?? ""),
    shippingMethod: String(data.shippingMethod ?? "standard"),
    shippingCost: typeof data.shippingCost === "number" ? data.shippingCost : 0,
    subtotal: typeof data.subtotal === "number" ? data.subtotal : 0,
    discount: typeof data.discount === "number" ? data.discount : 0,
    total: typeof data.total === "number" ? data.total : 0,
    promoCode: (data.promoCode as string | null) ?? null,
    paymentMethod: String(data.paymentMethod ?? "card"),
    paymentStatus: String(data.paymentStatus ?? "unpaid"),
    notes: (data.notes as string | null) ?? null,
    createdAt: toIso(data.createdAt),
    items: items.map((item: DocData, index: number) => ({
      id: `${id}-${index}`,
      orderId: id,
      productId: String(item.productId ?? ""),
      productName: String(item.productName ?? ""),
      image: String(item.image ?? ""),
      unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      size: (item.size as string | null) ?? null,
      color: (item.color as string | null) ?? null,
    })),
  };
}

/** Recalcule la note moyenne et le nombre d'avis approuvés d'un produit. */
async function recalcProductRating(productId: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(
        collection(fbDb(), "reviews"),
        where("productId", "==", productId),
        where("isApproved", "==", true)
      )
    );
    const count = snap.size;
    const average = count
      ? snap.docs.reduce((sum, d) => sum + (typeof d.data().rating === "number" ? d.data().rating : 0), 0) / count
      : 0;
    await updateDoc(doc(fbDb(), "products", productId), {
      rating: Math.round(average * 10) / 10,
      reviewCount: count,
    });
  } catch {
    // Le produit a pu être supprimé entre-temps — on ignore.
  }
}
