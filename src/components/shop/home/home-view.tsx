"use client";

import { useMemo, useState } from "react";
import { Hero } from "@/components/shop/home/hero";
import { Advantages } from "@/components/shop/home/advantages";
import { CategoriesSection } from "@/components/shop/home/categories-section";
import { FeaturedSection } from "@/components/shop/home/featured-section";
import { FlashSale } from "@/components/shop/home/flash-sale";
import { NewArrivals } from "@/components/shop/home/new-arrivals";
import { Testimonials } from "@/components/shop/home/testimonials";
import { NewsletterSection } from "@/components/shop/home/newsletter-section";
import { QuickViewDialog } from "@/components/shop/dialogs/quick-view-dialog";
import { useShopStore } from "@/lib/store";
import type { Category, Product } from "@/lib/types";

interface HomeViewProps {
  products: Product[];
  categories: Category[];
  loading: boolean;
  onNavigate: (page: string) => void;
  /** Optionnel : ouverture de la fiche produit complète. */
  onOpenProduct?: (p: Product) => void;
}

export function HomeView({
  products,
  categories,
  loading,
  onNavigate,
  onOpenProduct,
}: HomeViewProps) {
  const [quickView, setQuickView] = useState<Product | null>(null);
  const addRecentlyViewed = useShopStore((s) => s.addRecentlyViewed);

  const openQuickView = (product: Product) => {
    addRecentlyViewed(product.id);
    setQuickView(product);
  };

  const featured = useMemo(
    () => products.filter((p) => p.isFeatured),
    [products]
  );

  const newArrivals = useMemo(
    () =>
      products
        .filter((p) => p.isNew)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 4),
    [products]
  );

  return (
    <>
      <Hero onNavigate={onNavigate} />
      <FlashSale
        products={products}
        onNavigate={onNavigate}
        onQuickView={openQuickView}
      />
      <CategoriesSection
        categories={categories}
        loading={loading}
        onSelectCategory={() => onNavigate("categories")}
      />
      <FeaturedSection
        products={featured}
        loading={loading}
        onQuickView={openQuickView}
        onNavigate={onNavigate}
      />
      <NewArrivals
        products={newArrivals}
        loading={loading}
        onQuickView={openQuickView}
      />
      <Advantages />
      <Testimonials />
      <NewsletterSection />

      <QuickViewDialog
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => {
          if (!open) setQuickView(null);
        }}
        onOpenProduct={onOpenProduct}
      />
    </>
  );
}
