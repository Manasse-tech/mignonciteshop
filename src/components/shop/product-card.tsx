"use client";

import { Eye, Flame, GitCompareArrows, Heart, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { useShopStore } from "@/lib/store";
import { discountPercent, formatPrice, formatPriceCompact } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

/**
 * Zone d'actions basse de l'image (commune à toutes les cartes).
 * Desktop : révélée au survol (opacity + translate, 300 ms).
 * Tactile : toujours visible ([@media(hover:none)]).
 * Layout (container queries, seuil 280 px de largeur de carte) :
 *  - < 280 px  : [👁] [🛒 Ajouter]
 *  - ≥ 280 px  : [👁] [🛒 Ajouter au panier] [⇄]
 */
function CardActionBar({
  product,
  outOfStock,
  inCompare,
  onQuickView,
  onAddToCart,
  onToggleCompare,
}: {
  product: Product;
  outOfStock: boolean;
  inCompare: boolean;
  onQuickView: (p: Product) => void;
  onAddToCart: () => void;
  onToggleCompare: (e: React.MouseEvent) => void;
}) {
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70";
  const secondaryBase =
    "shrink-0 rounded-full border border-border/60 bg-background/95 text-foreground shadow-md backdrop-blur-sm transition-colors duration-200 hover:border-[#C9A961] hover:text-[#C9A961]";

  return (
    <div
      role="group"
      aria-label={`Actions pour ${product.name}`}
      className="absolute inset-x-3 bottom-3 z-30 flex items-stretch gap-2 opacity-0 invisible translate-y-3 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 [@media(hover:none)]:opacity-100 [@media(hover:none)]:visible [@media(hover:none)]:translate-y-0"
    >
      {/* Aperçu rapide — secondaire, icône seule, position constante (masqué < 160px) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onQuickView(product);
        }}
        title="Aperçu rapide"
        aria-label="Aperçu rapide"
        className={`hidden h-10 w-10 cursor-pointer place-items-center @min-[160px]:grid ${secondaryBase} ${focusRing}`}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Ajouter au panier — bouton principal, même style que le CTA fiche produit */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart();
        }}
        className={`flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#C9A961] text-black px-2 text-xs font-semibold shadow-md transition-all duration-200 hover:bg-[#b8994f] active:scale-[0.98] ${focusRing} ${
          outOfStock ? "opacity-60" : ""
        }`}
      >
        <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden truncate whitespace-nowrap @min-[280px]:inline">
          Ajouter au panier
        </span>
        <span className="truncate whitespace-nowrap @min-[280px]:hidden">Ajouter</span>
      </button>

      {/* Comparaison — secondaire, même zone, masquée sur les cartes étroites */}
      <button
        type="button"
        onClick={onToggleCompare}
        title={inCompare ? "Retirer du comparateur" : "Comparer ce produit"}
        aria-label={inCompare ? "Retirer du comparateur" : "Ajouter au comparateur"}
        aria-pressed={inCompare}
        className={`hidden h-10 w-10 cursor-pointer place-items-center rounded-full shadow-md backdrop-blur-sm transition-colors duration-200 @min-[280px]:grid ${focusRing} ${
          inCompare
            ? "border border-[#C9A961] bg-[#C9A961] text-black"
            : "border border-border/60 bg-background/95 text-foreground hover:border-[#C9A961] hover:text-[#C9A961]"
        }`}
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onQuickView: (p: Product) => void;
  /** Optionnel : ouverture de la fiche produit complète (boutons texte). */
  onOpenProduct?: (p: Product) => void;
}

export function ProductCard({
  product,
  onQuickView,
  onOpenProduct,
}: ProductCardProps) {
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleWishlist = useShopStore((s) => s.toggleWishlist);
  const toggleCompare = useShopStore((s) => s.toggleCompare);
  const wishlist = useShopStore((s) => s.wishlist);
  const compare = useShopStore((s) => s.compare);

  const outOfStock = product.stock <= 0;
  const discount = discountPercent(product.price, product.oldPrice);
  const inWishlist = wishlist.includes(product.id);
  const inCompare = compare.includes(product.id);
  const filledStars = Math.round(product.rating);
  const openProduct = onOpenProduct ?? onQuickView;

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
      size: null,
      color: null,
    });
    toast.success("Ajouté au panier", {
      description: `${product.name} a été ajouté à votre panier.`,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleWishlist(product.id);
    toast.success(added ? "Ajouté aux favoris" : "Retiré des favoris", {
      description: product.name,
    });
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleCompare(product.id);
    if (added) {
      toast.success("Ajouté au comparateur", {
        description: product.name,
      });
    } else {
      toast.error("Comparateur complet", {
        description: "Vous pouvez comparer jusqu'à 4 produits.",
      });
    }
  };

  return (
    /* @container : les container queries (@min-[280px]) s'adaptent à la largeur réelle de la carte */
    <div className="@container group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-1 hover:ring-[#C9A961]/40 transition-all duration-300">
      {/* ─── ZONE IMAGE ─── */}
      <div
        className="relative aspect-square overflow-hidden bg-muted cursor-pointer"
        onClick={() => onQuickView(product)}
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05] ${
            outOfStock ? "grayscale opacity-70" : ""
          }`}
        />

        {/* Badges — haut gauche, parfaitement alignés, non interactifs.
            « Vedette » masqué sous 180px de carte : ne jamais toucher le favori. */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1">
          {discount > 0 && (
            <span className="inline-flex h-8 items-center rounded-full bg-red-500 px-2.5 text-[10px] font-bold text-white shadow-sm">
              -{discount}%
            </span>
          )}
          {product.isFeatured && (
            <span className="hidden h-8 items-center rounded-full bg-[#C9A961] px-2.5 text-[10px] font-bold text-white shadow-sm @min-[180px]:inline-flex">
              Vedette
            </span>
          )}
        </div>

        {/* Favori — haut droite, toujours visible, jamais confondu avec les badges */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={inWishlist ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={inWishlist}
          className="absolute top-3 right-3 z-20 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-border/60 bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 after:absolute after:-inset-1.5 after:content-[''] hover:scale-110 hover:border-[#C9A961]/60 hover:text-[#C9A961] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70"
        >
          <Heart
            aria-hidden="true"
            className={`h-4 w-4 transition-colors duration-200 ${
              inWishlist ? "fill-[#C9A961] text-[#C9A961]" : ""
            }`}
          />
        </button>

        {outOfStock && (
          <>
            <div className="absolute inset-0 bg-background/60 backdrop-grayscale z-10" />
            <span className="absolute inset-x-0 top-1/2 z-20 mx-auto w-fit -translate-y-1/2 rounded-full bg-black/85 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
              Rupture de stock
            </span>
          </>
        )}

        {/* Actions — bas de l'image, à l'intérieur des limites (ne recouvre jamais les infos) */}
        <CardActionBar
          product={product}
          outOfStock={outOfStock}
          inCompare={inCompare}
          onQuickView={onQuickView}
          onAddToCart={handleAddToCart}
          onToggleCompare={handleToggleCompare}
        />
      </div>

      {/* ─── INFOS PRODUIT ─── */}
      <button
        type="button"
        className="block w-full cursor-pointer text-left p-3 @min-[280px]:p-4"
        onClick={() => openProduct(product)}
      >
        <p className="text-xs text-[#C9A961] font-medium uppercase tracking-wider mb-1 truncate">
          {product.category?.name ?? ""}
        </p>
        <h3 className="font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-[#C9A961] transition-colors">
          {product.name}
        </h3>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="inline-flex items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                aria-hidden="true"
                className={`w-3 h-3 ${
                  i < filledStars
                    ? "fill-[#C9A961] text-[#C9A961]"
                    : "text-muted-foreground/40"
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1 hidden @min-[200px]:inline">
              ({product.reviewCount})
            </span>
          </span>
          <span className="inline-flex items-center gap-1 flex-shrink-0 text-[10px] @min-[220px]:text-[11px] font-semibold text-orange-600 dark:text-orange-400">
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            {product.soldCount} vendus
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base @min-[240px]:text-lg font-bold text-foreground">
            {/* Prix compact « 80k F » sous 200px de carte, prix complet sinon */}
            <span className="@min-[200px]:hidden">
              {formatPriceCompact(product.price)} F
            </span>
            <span className="hidden @min-[200px]:inline">
              {priceLabel(product.price)}
            </span>
          </span>
          {product.oldPrice && (
            <span className="text-xs @min-[240px]:text-sm text-muted-foreground/70 line-through">
              <span className="@min-[200px]:hidden">
                {formatPriceCompact(product.oldPrice)} F
              </span>
              <span className="hidden @min-[200px]:inline">
                {priceLabel(product.oldPrice)}
              </span>
            </span>
          )}
        </div>
        {outOfStock ? (
          <p className="text-xs text-red-500 font-medium mt-1">Rupture de stock</p>
        ) : product.stock < 20 ? (
          <p className="text-xs text-orange-500 mt-1">
            Plus que {product.stock} en stock
          </p>
        ) : null}
      </button>
    </div>
  );
}
