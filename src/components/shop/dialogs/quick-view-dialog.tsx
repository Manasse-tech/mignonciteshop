"use client";

import { useState } from "react";
import { ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useShopStore } from "@/lib/store";
import { discountPercent, formatPrice, parseJsonArray } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

interface QuickViewDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct?: (p: Product) => void;
}

export function QuickViewDialog({
  product,
  open,
  onOpenChange,
  onOpenProduct,
}: QuickViewDialogProps) {
  if (!product) return null;
  return (
    <QuickViewContent
      key={product.id}
      product={product}
      open={open}
      onOpenChange={onOpenChange}
      onOpenProduct={onOpenProduct}
    />
  );
}

interface QuickViewContentProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct?: (p: Product) => void;
}

function QuickViewContent({
  product,
  open,
  onOpenChange,
  onOpenProduct,
}: QuickViewContentProps) {
  const addToCart = useShopStore((s) => s.addToCart);
  const sizes = parseJsonArray(product.sizes);
  const colors = parseJsonArray(product.colors);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    () => sizes[0] ?? null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    () => colors[0] ?? null
  );

  const outOfStock = product.stock <= 0;
  const discount = discountPercent(product.price, product.oldPrice);
  const filledStars = Math.round(product.rating);

  const handleAddToCart = () => {
    if (outOfStock) {
      toast.error("Produit en rupture de stock");
      return;
    }
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice,
      image: product.image,
      size: selectedSize,
      color: selectedColor,
    });
    toast.success("Ajouté au panier", {
      description: `${product.name} a été ajouté à votre panier.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-y-auto overflow-x-hidden gap-0 max-h-[92dvh]">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="relative aspect-square bg-muted overflow-hidden max-sm:h-56 max-sm:aspect-auto">
            <img
              src={product.image}
              alt={product.name}
              className={`w-full h-full object-cover ${outOfStock ? "grayscale opacity-70" : ""}`}
            />
            {discount > 0 && (
              <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full z-10 shadow-md">
                -{discount}%
              </span>
            )}
            {product.isFeatured && (
              <span className="absolute top-4 right-4 bg-[#C9A961] text-white text-xs font-bold px-3 py-1.5 rounded-full z-10 shadow-md">
                Vedette
              </span>
            )}
            {outOfStock && (
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 mx-auto w-fit bg-black/85 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">
                Rupture de stock
              </span>
            )}
          </div>

          <div className="p-6 flex flex-col min-w-0">
            <p className="text-xs text-[#C9A961] font-medium uppercase tracking-wider mb-1">
              {product.category?.name ?? ""}
            </p>
            <DialogTitle className="text-xl font-bold text-foreground mb-2 line-clamp-2">
              {product.name}
            </DialogTitle>
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 ${
                    i < filledStars
                      ? "fill-[#C9A961] text-[#C9A961]"
                      : "text-muted-foreground/40"
                  }`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                ({product.reviewCount} avis)
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-[#C9A961]">
                {priceLabel(product.price)}
              </span>
              {product.oldPrice && (
                <span className="text-sm text-muted-foreground/70 line-through">
                  {priceLabel(product.oldPrice)}
                </span>
              )}
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed line-clamp-4 mb-4">
              {product.description}
            </DialogDescription>

            {sizes.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Taille
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                        selectedSize === size
                          ? "border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]"
                          : "border-border text-foreground/70 hover:border-[#C9A961]/60"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Couleur
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                        selectedColor === color
                          ? "border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]"
                          : "border-border text-foreground/70 hover:border-[#C9A961]/60"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock}
                className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                Ajouter au panier
              </button>
              {onOpenProduct && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenProduct(product);
                  }}
                  className="rounded-full px-8 py-3 h-auto border-border"
                >
                  Voir la fiche produit
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
