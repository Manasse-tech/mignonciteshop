"use client";

import { useEffect, useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import { discountPercent } from "@/lib/format";
import type { Product } from "@/lib/types";

interface FlashSaleProps {
  products: Product[];
  onNavigate: (page: string) => void;
  onQuickView: (p: Product) => void;
}

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

export function FlashSale({ products, onNavigate, onQuickView }: FlashSaleProps) {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => setTime(timeUntilMidnight());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const topDiscounted = [...products]
    .map((p) => ({ product: p, discount: discountPercent(p.price, p.oldPrice) }))
    .filter((entry) => entry.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 3)
    .map((entry) => entry.product);

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-black rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 sm:p-10 md:p-14 flex flex-col justify-center">
              <span className="inline-block bg-[#C9A961] text-white text-sm font-bold px-4 py-2 rounded-full mb-4">
                Offre Limitée
              </span>
              <h2 className="text-[clamp(1.5rem,1.2rem+2.2vw,3rem)] font-bold text-white mt-4 leading-tight">
                Jusqu&apos;à -50% sur une sélection
              </h2>
              <p className="text-gray-400 mt-4 max-w-md">
                Profitez de nos meilleures offres avant qu&apos;il ne soit trop
                tard !
              </p>
              <div className="mt-6">
                <div
                  role="timer"
                  aria-label="Les offres se terminent ce soir à minuit"
                  className="inline-flex max-w-full items-center gap-2 sm:gap-3 bg-white/5 border border-[#C9A961]/30 rounded-2xl px-3 sm:px-4 py-3 backdrop-blur-sm"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#C9A961] sm:text-xs">
                    <Zap
                      className="w-3.5 h-3.5 fill-[#C9A961]"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Fin des offres</span>
                    <span className="sm:hidden">Fin</span>
                  </span>
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="flex flex-col items-center">
                        <span className="countdown-digit inline-flex min-w-[2.6rem] justify-center bg-black text-[#C9A961] font-bold text-lg rounded-lg px-1.5 py-1 tabular-nums shadow-[0_0_12px_rgba(201,169,97,0.25)] sm:text-xl">
                          {pad(time.hours)}
                        </span>
                        <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">
                          Heures
                        </span>
                      </span>
                      <span
                        className="text-[#C9A961] font-bold text-lg -mt-4"
                        aria-hidden="true"
                      >
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
                      <span
                        className="text-[#C9A961] font-bold text-lg -mt-4"
                        aria-hidden="true"
                      >
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
              </div>
              <div className="mt-8">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 gold-gradient btn-shine text-black px-8 py-4 rounded-full font-semibold hover:opacity-90 transition-opacity"
                  onClick={() => onNavigate("promotions")}
                >
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                  En profiter
                </button>
              </div>
            </div>

            <div className="min-w-0 p-6 sm:p-8 content-center self-center">
              {/* Mobile : carrousel horizontal — Desktop : grille 3 tuiles */}
              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none lg:grid lg:grid-cols-3 lg:gap-2 lg:snap-none lg:overflow-visible">
                {topDiscounted.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="group relative aspect-square w-[42vw] max-[380px]:w-[52vw] shrink-0 snap-start rounded-xl overflow-hidden lg:w-auto"
                    onClick={() => onQuickView(product)}
                    aria-label={`Aperçu rapide de ${product.name}`}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <span className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] rounded-full px-2 py-1 truncate">
                      {product.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
