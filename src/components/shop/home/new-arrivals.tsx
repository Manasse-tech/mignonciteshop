"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/shop/product-card";
import type { Product } from "@/lib/types";

interface NewArrivalsProps {
  products: Product[];
  loading: boolean;
  onQuickView: (p: Product) => void;
}

function ProductCardSkeleton() {
  return (
    <div className="bg-muted rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-1/3 bg-muted-foreground/15 rounded-full" />
        <div className="h-4 w-3/4 bg-muted-foreground/15 rounded-full" />
        <div className="h-3 w-1/2 bg-muted-foreground/15 rounded-full" />
        <div className="h-5 w-1/3 bg-muted-foreground/15 rounded-full" />
      </div>
    </div>
  );
}

export function NewArrivals({ products, loading, onQuickView }: NewArrivalsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Flèches desktop : défilement doux de ~85 % de la largeur visible. */
  const scrollByAmount = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  /** Carte ≈ 47vw mobile (≈ 2 visibles), largeur auto en grille sm+. */
  const itemClass =
    "w-[47vw] max-[380px]:w-[60vw] shrink-0 snap-start sm:w-auto";

  return (
    <section className="py-16 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Nouveautés
          </p>
          <h2 className="text-fluid-h2 font-bold text-foreground">
            Arrivages Récents
          </h2>
        </div>

        {/* Mobile : carrousel horizontal (bleed aux bords d'écran) — sm+ : grille */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 py-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4 lg:gap-6 sm:snap-none sm:overflow-visible sm:py-0"
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className={itemClass}>
                    <ProductCardSkeleton />
                  </div>
                ))
              : products.map((product) => (
                  <div key={product.id} className={itemClass}>
                    <ProductCard product={product} onQuickView={onQuickView} />
                  </div>
                ))}
          </div>

          {/* Flèches — desktop uniquement (masquées au tactile/mobile) */}
          <button
            type="button"
            aria-label="Nouveautés précédentes"
            onClick={() => scrollByAmount(-1)}
            className="hidden md:grid absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-card shadow-lg border border-border text-foreground hover:text-[#C9A961] hover:border-[#C9A961] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Nouveautés suivantes"
            onClick={() => scrollByAmount(1)}
            className="hidden md:grid absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-card shadow-lg border border-border text-foreground hover:text-[#C9A961] hover:border-[#C9A961] transition-colors"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
