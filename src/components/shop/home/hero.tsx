"use client";

import { ArrowRight, ChevronDown } from "lucide-react";

interface HeroProps {
  onNavigate: (page: string) => void;
}

export function Hero({ onNavigate }: HeroProps) {
  const scrollToAdvantages = () => {
    document
      .getElementById("avantages")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative min-h-[440px] sm:min-h-[560px] md:min-h-[620px] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/images/products/photo-1441986300917-64674bd600d8.jpg"
          alt="Boutique MignonciteShop"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#C9A961]/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[320px] h-[320px] rounded-full bg-[#C9A961]/10 blur-[100px] pointer-events-none" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
        <div className="max-w-2xl">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-4 animate-fade-up">
            Nouvelle Collection
          </p>
          <h1 className="text-fluid-hero font-bold text-white animate-fade-up">
            Découvrez
            <br />
            Notre
            <br />
            <span className="text-[#C9A961]">Univers</span>
          </h1>
          <p className="text-gray-200 text-base sm:text-lg mt-4 sm:mt-6 max-w-lg animate-fade-up">
            Des produits exceptionnels pour tous vos besoins. Qualité premium,
            prix imbattables.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 animate-fade-up">
            <button
              type="button"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white px-8 py-4 rounded-full font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-[#C9A961]/25"
              onClick={() => onNavigate("shop")}
            >
              Explorer la Boutique
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-semibold hover:bg-white/20 transition-colors"
              onClick={() => onNavigate("categories")}
            >
              Voir les Catégories
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 hover:text-[#C9A961] transition-colors"
        aria-label="Faire défiler vers le bas"
        onClick={scrollToAdvantages}
      >
        <ChevronDown className="w-7 h-7 animate-bounce" aria-hidden="true" />
      </button>
    </section>
  );
}
