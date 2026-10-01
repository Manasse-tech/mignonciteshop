"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/shop/product-card";
import { useShopStore } from "@/lib/store";
import type { Product } from "@/lib/types";

/** Fidèle au pattern cart-page : aucune écriture d'état en rendu SSR. */
const emptySubscribe = () => () => {};

interface WishlistPageProps {
  products: Product[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onOpenProduct: (p: Product) => void;
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

export function WishlistPage({
  products,
  loading,
  onNavigate,
  onOpenProduct,
  onQuickView,
}: WishlistPageProps) {
  const wishlist = useShopStore((s) => s.wishlist);
  const toggleWishlist = useShopStore((s) => s.toggleWishlist);
  // Évite tout décalage d'hydratation : les favoris viennent du localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const wishlistProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return wishlist.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });
  }, [products, wishlist]);

  const handleClearAll = () => {
    const ids = [...wishlist];
    ids.forEach((id) => toggleWishlist(id));
    toast.info("Tous les favoris ont été retirés.", {
      description: "Votre liste d'envies est maintenant vide.",
    });
  };

  if (!mounted) {
    return (
      <div className="bg-background flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
          <div className="h-10 w-64 bg-muted rounded-full animate-pulse mb-8" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty =
    wishlist.length === 0 || (!loading && wishlistProducts.length === 0);

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
              Ma sélection
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3 flex-wrap">
              Mes favoris
              <span className="inline-flex items-center rounded-full bg-[#C9A961]/10 text-[#C9A961] text-sm font-semibold px-3.5 py-1.5">
                {wishlist.length}
              </span>
            </h1>
            <p className="text-muted-foreground">
              Retrouvez ici les articles que vous avez ajoutés à votre liste
              d&apos;envies.
            </p>
          </div>
          {wishlist.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm font-medium text-muted-foreground hover:text-red-500 transition-colors"
            >
              Tout retirer
            </button>
          )}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="p-8 bg-muted rounded-full mb-6">
              <Heart
                className="w-16 h-16 text-muted-foreground/40"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Aucun favoris pour l&apos;instant
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Explorez la boutique et cliquez sur le cœur d&apos;un produit pour
              l&apos;ajouter à votre liste d&apos;envies.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors"
            >
              Découvrir la boutique
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {wishlistProducts.map((product) => (
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
