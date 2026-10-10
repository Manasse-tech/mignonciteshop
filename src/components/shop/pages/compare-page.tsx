"use client";

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GitCompareArrows, Loader2, Sparkles, Star, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { useShopStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { analyzeComparison, type CompareAnalysis } from "@/lib/ai.functions";

function parseList(s: string): string[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
const price = (n: number) => `${n.toLocaleString("fr-FR")} F CFA`;

type Row = {
  label: string;
  value: (p: Product) => string;
  score?: (p: Product) => number; // plus grand = meilleur
};

const ROWS: Row[] = [
  { label: "Prix", value: (p) => price(p.price), score: (p) => -p.price },
  { label: "Ancien prix", value: (p) => (p.oldPrice ? price(p.oldPrice) : "—") },
  {
    label: "Remise",
    value: (p) => (p.oldPrice && p.oldPrice > p.price ? `-${Math.round((1 - p.price / p.oldPrice) * 100)} %` : "—"),
    score: (p) => (p.oldPrice && p.oldPrice > p.price ? 1 - p.price / p.oldPrice : 0),
  },
  { label: "Note", value: (p) => `${p.rating.toFixed(1)} / 5`, score: (p) => p.rating },
  { label: "Avis", value: (p) => String(p.reviewCount), score: (p) => p.reviewCount },
  { label: "Ventes", value: (p) => String(p.soldCount), score: (p) => p.soldCount },
  { label: "Stock", value: (p) => (p.stock > 0 ? `${p.stock} dispo.` : "Rupture"), score: (p) => p.stock },
  { label: "Catégorie", value: (p) => p.category?.name ?? "—" },
  { label: "Tailles", value: (p) => parseList(p.sizes).join(", ") || "—" },
  { label: "Couleurs", value: (p) => parseList(p.colors).join(", ") || "—" },
  { label: "Nouveauté", value: (p) => (p.isNew ? "Oui" : "Non") },
];

export function ComparePage({
  products,
  loading,
  onNavigate,
  onOpenProduct,
}: {
  products: Product[];
  loading: boolean;
  onNavigate: (p: string) => void;
  onOpenProduct: (p: Product) => void;
}) {
  const ids = useShopStore((s) => s.compare);
  const toggle = useShopStore((s) => s.toggleCompare);
  const user = useAuthStore((s) => s.user);
  const analyze = useServerFn(analyzeComparison);
  const [diffOnly, setDiffOnly] = useState(false);
  const [usage, setUsage] = useState("");
  const [ai, setAi] = useState<CompareAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const items = useMemo(
    () => ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [ids, products]
  );

  const rows = ROWS.filter((r) => !diffOnly || new Set(items.map(r.value)).size > 1);

  async function runAi() {
    setAiLoading(true);
    try {
      const payload = items.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        rating: p.rating,
        reviewCount: p.reviewCount,
        soldCount: p.soldCount,
        stock: p.stock,
        category: p.category?.name,
        sizes: parseList(p.sizes),
        colors: parseList(p.colors),
        description: p.description?.slice(0, 400),
      }));
      setAi(await analyze({ data: { products: payload, usage } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (items.length === 0)
    return (
      <div className="max-w-xl mx-auto text-center py-24 px-4">
        <GitCompareArrows className="w-12 h-12 mx-auto text-[#C9A961] mb-4" />
        <h1 className="text-3xl font-bold mb-3">Comparateur</h1>
        <p className="text-muted-foreground mb-6">
          Ajoutez jusqu&apos;à 4 produits avec l&apos;icône de comparaison sur les fiches pour les voir côte à côte.
        </p>
        <button
          onClick={() => onNavigate("shop")}
          className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold"
        >
          Parcourir la boutique
        </button>
      </div>
    );

  const best = (r: Row): Set<string> => {
    if (!r.score || items.length < 2) return new Set();
    const max = Math.max(...items.map(r.score));
    const winners = items.filter((p) => r.score!(p) === max);
    return winners.length === items.length ? new Set() : new Set(winners.map((p) => p.id));
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Comparateur</h1>
          <p className="text-sm text-muted-foreground">{items.length} / 4 produits — meilleures valeurs en doré.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
            Uniquement les différences
          </label>
          <button
            onClick={() => useShopStore.setState({ compare: [] })}
            className="text-sm rounded-full border border-border px-4 py-1.5 hover:border-destructive hover:text-destructive"
          >
            Tout retirer
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr>
              <th className="w-36" />
              {items.map((p) => (
                <th key={p.id} className="p-4 align-top text-left font-normal">
                  <div className="relative">
                    <button
                      onClick={() => toggle(p.id)}
                      aria-label={`Retirer ${p.name}`}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-muted hover:bg-destructive/15"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onOpenProduct(p)} className="block text-left">
                      <img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded-xl mb-2" />
                      <span className="font-semibold hover:text-[#C9A961]">{p.name}</span>
                    </button>
                    {ai?.bestValueId === p.id && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#C9A961]">
                        <Trophy className="w-3.5 h-3.5" /> Meilleur choix IA
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const winners = best(r);
              return (
                <tr key={r.label} className="border-t border-border/60">
                  <td className="p-3 text-muted-foreground font-medium">{r.label}</td>
                  {items.map((p) => (
                    <td
                      key={p.id}
                      className={`p-3 ${winners.has(p.id) ? "text-[#C9A961] font-semibold bg-[#C9A961]/5" : ""}`}
                    >
                      {r.label === "Note" && <Star className="inline w-3.5 h-3.5 mr-1 fill-current text-[#C9A961]" />}
                      {r.value(p)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-2xl border border-[#C9A961]/40 bg-[#C9A961]/5 p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C9A961]" /> Analyse IA
        </h2>
        {items.length < 2 ? (
          <p className="text-sm text-muted-foreground">Ajoutez au moins 2 produits pour lancer l&apos;analyse.</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">
            <button onClick={() => onNavigate("login")} className="underline text-[#C9A961]">Connectez-vous</button>{" "}
            pour obtenir une analyse personnalisée.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              placeholder="Votre usage (ex : cadeau, sport, budget serré…) — facultatif"
              className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm"
            />
            <button
              onClick={runAi}
              disabled={aiLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white px-6 h-10 text-sm font-semibold disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyser
            </button>
          </div>
        )}
        {ai && (
          <div className="space-y-4 pt-2">
            <p className="text-sm">{ai.verdict}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ai.perProduct.map((pp) => {
                const p = items.find((x) => x.id === pp.id);
                return (
                  <div key={pp.id} className="rounded-xl bg-card border border-border/60 p-3 text-xs space-y-1">
                    <p className="font-semibold text-sm">{p?.name ?? pp.id}</p>
                    {pp.strengths.map((s, i) => <p key={i} className="text-emerald-600">+ {s}</p>)}
                    {pp.weaknesses.map((s, i) => <p key={i} className="text-destructive">− {s}</p>)}
                  </div>
                );
              })}
            </div>
            <p className="text-sm font-medium">💡 {ai.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Barre flottante « Comparer (n) » */
export function CompareBar({ onNavigate, hidden }: { onNavigate: (p: string) => void; hidden: boolean }) {
  const count = useShopStore((s) => s.compare.length);
  if (hidden || count === 0) return null;
  return (
    <button
      onClick={() => onNavigate("compare")}
      className="fixed z-40 bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white px-6 py-3 text-sm font-semibold shadow-lg"
    >
      <GitCompareArrows className="w-4 h-4" /> Comparer ({count})
    </button>
  );
}
