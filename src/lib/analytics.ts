"use client";

/**
 * Fondation analytique — conventions « grandes entreprises ».
 *
 * Chaque action métier clé (vue produit, ajout panier, checkout, achat…)
 * émet un événement structuré, écrit directement dans la collection
 * Firestore `analytics` (UNIQUE backend) et consultable dans l'admin
 * (Rapports → Activité).
 *
 * Jamais bloquant : si l'écriture échoue, l'expérience utilisateur est
 * intacte (les erreurs sont silencieuses).
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { fbDb } from "@/lib/firebase";

export type AnalyticsEvent =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "purchase"
  | "apply_promo"
  | "search"
  | "wishlist_add"
  | "stock_alert"
  | "review_submitted"
  | "newsletter_signup"
  | "contact_submit";

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | null | undefined;
}

const isDev = process.env.NODE_ENV !== "production";

function send(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  const { page, productId, value, ...rest } = payload as {
    page?: string;
    productId?: string;
    value?: number;
  } & AnalyticsPayload;
  const entry = {
    event,
    page: typeof page === "string" ? page : undefined,
    productId: typeof productId === "string" ? productId : undefined,
    value: typeof value === "number" && Number.isFinite(value) ? value : undefined,
    meta: Object.keys(rest).length > 0 ? JSON.stringify(rest) : "{}",
  };
  if (isDev) {
    console.debug("[analytics]", { ...entry, ts: new Date().toISOString() });
  }
  try {
    void addDoc(collection(fbDb(), "analytics"), {
      ...entry,
      createdAt: serverTimestamp(),
    }).catch(() => undefined);
  } catch {
    // Ignoré volontairement (l'analytique ne doit jamais casser l'UX).
  }
}

export function trackPageView(page: string): void {
  send("page_view", { page });
}

export function trackEvent(event: AnalyticsEvent, payload?: AnalyticsPayload): void {
  send(event, payload);
}
