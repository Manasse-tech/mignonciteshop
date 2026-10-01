"use client";

import { useMemo } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { Category, Product } from "@/lib/types";

interface CategoriesPageProps {
  categories: Category[];
  products: Product[];
  loading: boolean;
  onNavigate: (page: string) => void;
  /** Ouvre la boutique avec la catégorie pré-filtrée. */
  onShopCategory: (slug: string) => void;
}

export function CategoriesPage({
  categories,
  products,
  loading,
  onNavigate,
  onShopCategory,
}: CategoriesPageProps) {
  // Nombre de produits et de promos par catégorie (oldPrice non null).
  const stats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; promos: number }
    >();
    for (const product of products) {
      const entry = map.get(product.categoryId) ?? { total: 0, promos: 0 };
      entry.total += 1;
      if (product.oldPrice != null) entry.promos += 1;
      map.set(product.categoryId, entry);
    }
    return map;
  }, [products]);

  return (
    <div className="bg-background">
      {/* Bandeau titre */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
              Nos Univers
            </p>
            <h1 className="text-fluid-h1 font-bold text-foreground">Catégories</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Explorez nos différentes catégories de produits et trouvez
              exactement ce que vous cherchez.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] bg-muted rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {categories.map((category, i) => {
              const stat = stats.get(category.id) ?? {
                total: category.productCount ?? 0,
                promos: 0,
              };
              return (
                <button
                  key={category.id}
                  type="button"
                  className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 text-left animate-fade-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                  onClick={() => onShopCategory(category.slug)}
                  aria-label={`Voir les produits de la catégorie ${category.name}`}
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
                      {stat.total} produits
                      {stat.promos > 0 ? ` · ${stat.promos} en promo` : ""}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[#C9A961] text-sm font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Découvrir{" "}
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => onNavigate("shop")}
            className="inline-flex items-center gap-2 border border-border bg-card text-foreground rounded-full px-8 py-3.5 text-sm font-semibold hover:border-[#C9A961] hover:text-[#C9A961] transition-colors shadow-sm"
          >
            Voir tous les produits
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
