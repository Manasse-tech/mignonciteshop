"use client";

import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/types";

interface CategoriesSectionProps {
  categories: Category[];
  loading: boolean;
  onSelectCategory: (slug: string) => void;
}

export function CategoriesSection({
  categories,
  loading,
  onSelectCategory,
}: CategoriesSectionProps) {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Explorez
          </p>
          <h2 className="text-fluid-h2 font-bold text-foreground">
            Nos Catégories
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] bg-muted rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {categories.map((category, i) => (
              <button
                key={category.id}
                type="button"
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 text-left animate-fade-up"
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() => onSelectCategory(category.slug)}
              >
                <img
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-xl font-bold text-white group-hover:text-[#C9A961] transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">
                    {category.productCount ?? 0} produits
                  </p>
                  <span className="inline-flex items-center gap-1 text-[#C9A961] text-sm font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Découvrir{" "}
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
