"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { ProductCard } from "@/components/shop/product-card";
import { discountPercent } from "@/lib/format";
import type { Product } from "@/lib/types";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function timeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  return {
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

/** Compte à rebours jusqu'à minuit, même style que la vente flash. */
function Countdown() {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => setTime(timeUntilMidnight());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="timer"
      aria-label="Les offres se terminent ce soir à minuit"
      className="inline-flex items-center gap-3 bg-white/5 border border-[#C9A961]/30 rounded-2xl px-4 py-3 backdrop-blur-sm"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#C9A961] sm:text-xs">
        <Zap className="w-3.5 h-3.5 fill-[#C9A961]" aria-hidden="true" />
        <span className="hidden sm:inline">Fin des offres</span>
        <span className="sm:hidden">Fin</span>
      </span>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5">
          <span className="flex flex-col items-center">
            <span className="countdown-digit inline-flex min-w-[2.6rem] justify-center bg-black text-[#C9A961] font-bold text-lg rounded-lg px-1.5 py-1 tabular-nums shadow-[0_0_12px_rgba(201,169,97,0.25)] sm:text-xl">
              {pad(time.hours)}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">
              Heures
            </span>
          </span>
          <span className="text-[#C9A961] font-bold text-lg -mt-4" aria-hidden="true">
            :
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex flex-col items-center">
            <span className="countdown-digit inline-flex min-w-[2.6rem] justify-center bg-black text-[#C9A961] font-bold text-lg rounded-lg px-1.5 py-1 tabular-nums shadow-[0_0_12px_rgba(201,169,97,0.25)] sm:text-xl">
              {pad(time.minutes)}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">
              Min
            </span>
          </span>
          <span className="text-[#C9A961] font-bold text-lg -mt-4" aria-hidden="true">
            :
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex flex-col items-center">
            <span className="countdown-digit inline-flex min-w-[2.6rem] justify-center bg-black text-[#C9A961] font-bold text-lg rounded-lg px-1.5 py-1 tabular-nums shadow-[0_0_12px_rgba(201,169,97,0.25)] sm:text-xl">
              {pad(time.seconds)}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">
              Sec
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

interface PromotionsPageProps {
  products: Product[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onQuickView: (p: Product) => void;
  onOpenProduct: (p: Product) => void;
}

export function PromotionsPage({
  products,
  loading,
  onNavigate,
  onQuickView,
  onOpenProduct,
}: PromotionsPageProps) {
  const promoProducts = useMemo(
    () =>
      products
        .filter((p) => p.oldPrice != null)
        .sort(
          (a, b) =>
            discountPercent(b.price, b.oldPrice) -
            discountPercent(a.price, a.oldPrice)
        ),
    [products]
  );

  return (
    <div className="bg-background">
      {/* Bandeau titre */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-fluid-h1 font-bold text-foreground">Promotions</h1>
            <p className="text-muted-foreground mt-2">
              Profitez de nos meilleures offres et réductions sur une sélection
              de produits.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bandeau countdown */}
        <div className="bg-black rounded-3xl overflow-hidden p-8 md:p-10 mb-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <span className="inline-block bg-[#C9A961] text-white text-sm font-bold px-4 py-2 rounded-full mb-3">
                Offre Limitée
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                Ventes flash — jusqu&apos;à -50%
              </h2>
              <p className="text-gray-400 mt-2 text-sm">
                Les prix remontent à la fin du compte à rebours.
              </p>
            </div>
            <Countdown />
          </div>
        </div>

        <p className="text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">
            {promoProducts.length}
          </span>{" "}
          produit{promoProducts.length > 1 ? "s" : ""} en promotion
        </p>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-square" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-1/3 bg-muted-foreground/15 rounded-full" />
                  <div className="h-4 w-3/4 bg-muted-foreground/15 rounded-full" />
                  <div className="h-5 w-1/3 bg-muted-foreground/15 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : promoProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune promotion pour le moment
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Revenez bientôt, de nouvelles offres arrivent !
            </p>
            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="inline-flex items-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            >
              Voir la boutique
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {promoProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={onQuickView}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
