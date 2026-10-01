/**
 * Prix boutique en FCFA (XOF) — devise Côte d'Ivoire, sans centimes.
 * Ex : 80000 → « 80 000 F CFA ».
 */
export function formatPrice(price: number): string {
  const rounded = Number.isFinite(price) ? Math.round(price) : 0;
  return `${new Intl.NumberFormat("fr-FR").format(rounded)} F CFA`;
}

/** Variante compacte pour les badges serrés : « 80k ». */
export function formatPriceCompact(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (price >= 1_000) return `${Math.round(price / 1_000)}k`;
  return String(Math.round(price));
}

export function discountPercent(price: number, oldPrice: number | null): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round((1 - price / oldPrice) * 100);
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cnColorInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
