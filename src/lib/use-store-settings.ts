"use client";

/**
 * Réglages publics de la boutique (frais de livraison + seuil de gratuité +
 * paiement mobile money) côté client — estimation affichée panier/checkout.
 *
 * Source : document Firestore `settings/public` (piloté par l'admin — UNIQUE
 * backend). Cache mémoire + sessionStorage pour éviter les lectures répétées ;
 * valeurs par défaut en fallback (premier rendu et hors-ligne). Le montant
 * réellement débité reste recalculé dans la transaction de commande — cette
 * estimation n'est jamais contractuelle.
 */

import { useEffect, useState } from "react";
import {
  api,
  SETTINGS_DEFAULTS,
  type StoreSettingsPublic,
} from "@/lib/api";

export { SETTINGS_DEFAULTS as DEFAULT_STORE_SETTINGS };

const CACHE_KEY = "mc-settings:shipping";
const CACHE_TTL_MS = 60_000;

let memoryCache: {
  data: StoreSettingsPublic;
  at: number;
} | null = null;

function readSessionCache(): StoreSettingsPublic | null {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.data;
  }
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: StoreSettingsPublic; at: number };
    if (Date.now() - parsed.at < CACHE_TTL_MS) {
      // Shape normalisé (les anciens caches n'ont pas la clé « payment »).
      const normalized: StoreSettingsPublic = {
        ...parsed.data,
        payment: parsed.data.payment ?? SETTINGS_DEFAULTS.payment,
      };
      memoryCache = { data: normalized, at: parsed.at };
      return normalized;
    }
  } catch {
    // sessionStorage indisponible → ignore silencieusement.
  }
  return null;
}

function writeSessionCache(data: StoreSettingsPublic): void {
  memoryCache = { data, at: Date.now() };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    // quota dépassé / mode privé → ignore silencieusement.
  }
}

/**
 * Renvoie les réglages courants (défauts au premier rendu, puis valeurs
 * Firestore dès que la lecture aboutit — sans décalage d'hydratation car les
 * valeurs par défaut sont identiques côté serveur).
 */
export function useStoreSettings(): StoreSettingsPublic {
  const [settings, setSettings] = useState<StoreSettingsPublic>(() => {
    return readSessionCache() ?? SETTINGS_DEFAULTS;
  });

  useEffect(() => {
    let cancelled = false;
    api.settings
      .get()
      .then((data) => {
        if (cancelled) return;
        // Tolérance aux anciens caches sessionStorage (shape sans « payment »).
        const normalized: StoreSettingsPublic = {
          ...data,
          payment: data.payment ?? SETTINGS_DEFAULTS.payment,
        };
        writeSessionCache(normalized);
        setSettings(normalized);
      })
      .catch(() => {
        // Défauts conservés en cas d'échec réseau.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
