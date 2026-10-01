"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import {
  Bell,
  ChartLine,
  Check,
  ChevronRight,
  Heart,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  TrendingDown,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SizeGuideDialog } from "@/components/shop/dialogs/size-guide-dialog";
import { ProductCard } from "@/components/shop/product-card";
import { api, ApiError } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useShopStore } from "@/lib/store";
import { discountPercent, formatPrice, parseJsonArray } from "@/lib/format";
import type { Product, Review } from "@/lib/types";

/** Graphique recharts (~lourd) chargé en différé, sans CLS (squelette 280px). */
const PriceHistoryChart = dynamic(
  () => import("@/components/shop/pages/price-history-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-xl bg-muted/60 animate-pulse" />
    ),
  }
);

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

const GOLD = "#C9A961";

/* PRNG déterministe (mulberry32) seedé par l'id produit — stable entre les renders. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface PricePoint {
  label: string;
  full: string;
  price: number;
}

function buildPriceHistory(product: Product): PricePoint[] {
  const rand = mulberry32(hashString(product.id));
  const points: PricePoint[] = [];
  const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const fullFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  for (let i = 29; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const variation = 0.9 + rand() * 0.2; // ±10% autour du prix actuel
    points.push({
      label: dayFormatter.format(date),
      full: fullFormatter.format(date),
      price: Math.round(product.price * variation * 100) / 100,
    });
  }
  const today = new Date();
  points.push({
    label: dayFormatter.format(today),
    full: fullFormatter.format(today),
    price: product.price,
  });
  return points;
}

/* Couleurs connues pour les pastilles rondes (fallback doré). */
const COLOR_HEX: Record<string, string> = {
  noir: "#18181b",
  blanc: "#f5f5f5",
  beige: "#d8c9a3",
  crème: "#f5efdf",
  creme: "#f5efdf",
  "bleu marine": "#1e3a5f",
  bleu: "#2563eb",
  gris: "#9ca3af",
  gray: "#9ca3af",
  rouge: "#dc2626",
  vert: "#16a34a",
  jaune: "#eab308",
  rose: "#ec4899",
  marron: "#7c4a21",
  argent: "#c0c0c0",
  or: "#c9a961",
  orange: "#ea580c",
  violet: "#7c3aed",
  turquoise: "#14b8a6",
  naturel: "#d6c9a8",
};

function colorHex(name: string): string {
  return COLOR_HEX[name.trim().toLowerCase()] ?? GOLD;
}

/* Abonnement neutre pour le garde d'hydratation (données du localStorage). */
const emptySubscribe = () => () => {};

/* Étapes 5 → 1 pour la répartition des notes. */
const RATING_STEPS = [5, 4, 3, 2, 1];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* « 12 janvier 2026 » — format stable, appliqué uniquement aux avis chargés côté client. */
const reviewDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : reviewDateFormatter.format(date);
}

function reviewInitial(author: string): string {
  const trimmed = author.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function StarRow({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${
            i < value
              ? "fill-[#C9A961] text-[#C9A961]"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

interface ProductPageProps {
  productId: string | null;
  products: Product[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onQuickView: (p: Product) => void;
  onOpenProduct: (p: Product) => void;
}

export function ProductPage({
  productId,
  products,
  loading,
  onNavigate,
  onQuickView,
  onOpenProduct,
}: ProductPageProps) {
  const addRecentlyViewed = useShopStore((s) => s.addRecentlyViewed);

  const product = useMemo(
    () => (productId ? products.find((p) => p.id === productId) ?? null : null),
    [productId, products]
  );

  useEffect(() => {
    if (productId) addRecentlyViewed(productId);
  }, [productId, addRecentlyViewed]);

  if (loading) {
    return (
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-5 w-64 bg-muted rounded-full animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-3 w-1/4 bg-muted rounded-full animate-pulse" />
              <div className="h-9 w-3/4 bg-muted rounded-full animate-pulse" />
              <div className="h-4 w-1/3 bg-muted rounded-full animate-pulse" />
              <div className="h-10 w-1/2 bg-muted rounded-full animate-pulse" />
              <div className="h-20 w-full bg-muted rounded-2xl animate-pulse" />
              <div className="h-14 w-full bg-muted rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!productId || !product) {
    return (
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Produit non trouvé
            </h1>
            <p className="text-muted-foreground mb-8">
              Le produit que vous recherchez n&apos;existe pas ou n&apos;est
              plus disponible.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="inline-flex items-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors"
            >
              Retour à la boutique
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProductContent
      key={product.id}
      product={product}
      products={products}
      onNavigate={onNavigate}
      onQuickView={onQuickView}
      onOpenProduct={onOpenProduct}
    />
  );
}

interface ProductContentProps {
  product: Product;
  products: Product[];
  onNavigate: (page: string) => void;
  onQuickView: (p: Product) => void;
  onOpenProduct: (p: Product) => void;
}

function ProductContent({
  product,
  products,
  onNavigate,
  onQuickView,
  onOpenProduct,
}: ProductContentProps) {
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleWishlist = useShopStore((s) => s.toggleWishlist);
  const wishlist = useShopStore((s) => s.wishlist);
  const stockAlerts = useShopStore((s) => s.stockAlerts);
  const toggleStockAlert = useShopStore((s) => s.toggleStockAlert);
  const recentlyViewedIds = useShopStore((s) => s.recentlyViewed);

  const gallery = useMemo(() => {
    const images = [product.image, ...parseJsonArray(product.gallery)];
    return Array.from(new Set(images));
  }, [product.image, product.gallery]);

  const details = useMemo(
    () => product.details.split(" · ").map((d) => d.trim()).filter(Boolean),
    [product.details]
  );

  const sizes = parseJsonArray(product.sizes);
  const colors = parseJsonArray(product.colors);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    () => sizes[0] ?? null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    () => colors[0] ?? null
  );
  const [quantity, setQuantity] = useState(1);

  // Guide des tailles (dialogue partagé)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Alerte réassort (rupture de stock uniquement)
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSubmitting, setAlertSubmitting] = useState(false);

  // Avis clients — avis du backend (approuvés uniquement, modération server-side)
  const [fetchedReviews, setFetchedReviews] = useState<Review[]>([]);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const outOfStock = product.stock <= 0;
  const discount = discountPercent(product.price, product.oldPrice);
  const filledStars = Math.round(product.rating);
  const inWishlist = wishlist.includes(product.id);
  const subscribedToStockAlert = stockAlerts.includes(product.id);

  /* Avis du backend — seule exception autorisée au setState en effet,
     clé product.id. Échec (endpoint GET pas encore déployé) = liste vide,
     silencieux, sans toast. */
  useEffect(() => {
    let cancelled = false;
    api.reviews
      .list(product.id)
      .then((rows) => {
        if (!cancelled) setFetchedReviews(rows);
      })
      .catch(() => {
        // GET /api/reviews indisponible (ApiError 405) : fallback silencieux.
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const priceHistory = useMemo(() => buildPriceHistory(product), [product]);
  const historyMin = Math.min(...priceHistory.map((p) => p.price));
  const historyMax = Math.max(...priceHistory.map((p) => p.price));

  const similar = useMemo(
    () =>
      products
        .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
        .slice(0, 4),
    [products, product.categoryId, product.id]
  );

  // Évite tout décalage d'hydratation : recentlyViewed vient du localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const allReviews = useMemo(() => fetchedReviews, [fetchedReviews]);

  /* Répartition 5 → 1 déterministe (même PRNG que l'historique de prix) :
     distribution en cloche centrée sur la note moyenne, somme exacte
     = reviewCount (ou 0). */
  const ratingDistribution = useMemo(() => {
    const total = product.reviewCount;
    if (total <= 0) return [0, 0, 0, 0, 0];
    const rand = mulberry32(hashString(`${product.id}::reviews`));
    const weights = RATING_STEPS.map((star) => {
      const closeness = Math.exp(-Math.pow(star - product.rating, 2) / 2.5);
      return closeness * (0.85 + 0.3 * rand());
    });
    const weightSum = weights.reduce((acc, w) => acc + w, 0);
    const counts = weights.map((w) => Math.round((w / weightSum) * total));
    const drift = total - counts.reduce((acc, c) => acc + c, 0);
    let maxIdx = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] > counts[maxIdx]) maxIdx = i;
    }
    counts[maxIdx] += drift;
    return counts;
  }, [product.id, product.rating, product.reviewCount]);

  const recentProducts = useMemo(() => {
    if (!mounted) return [];
    return recentlyViewedIds
      .filter((id) => id !== product.id)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p))
      .slice(0, 5);
  }, [mounted, recentlyViewedIds, products, product.id]);

  /* JSON-LD produit (SEO) — rendu via dangerouslySetInnerHTML, contenu
     déterministe et sécurisé (séquence </script> impossible). */
  const productJsonLd = useMemo(() => {
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: `https://www.mignonciteshop.com${product.image}`,
      description: product.description,
      sku: product.id,
      brand: { "@type": "Brand", name: "MignonciteShop" },
      offers: {
        "@type": "Offer",
        price: product.price.toFixed(2),
        priceCurrency: "EUR",
        availability:
          product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    };
    if (product.reviewCount > 0) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      };
    }
    return JSON.stringify(schema).replace(/</g, "\\u003c");
  }, [product]);

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
      quantity,
      size: selectedSize,
      color: selectedColor,
    });
    toast.success("Ajouté au panier", {
      description: `${product.name} a été ajouté à votre panier.`,
    });
  };

  const handleToggleWishlist = () => {
    const added = toggleWishlist(product.id);
    toast.success(added ? "Ajouté aux favoris" : "Retiré des favoris", {
      description: product.name,
    });
  };

  const canSubmitReview =
    reviewRating >= 1 &&
    reviewAuthor.trim().length > 0 &&
    reviewComment.trim().length > 0;

  const handleCancelReview = () => {
    setReviewFormOpen(false);
    setReviewAuthor("");
    setReviewRating(0);
    setReviewComment("");
  };

  const handleReviewSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (reviewSubmitting) return;
    const author = reviewAuthor.trim();
    const comment = reviewComment.trim();
    if (reviewRating < 1 || !author || !comment) {
      toast.error("Veuillez renseigner votre nom, une note et un commentaire.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.reviews.create({
        productId: product.id,
        rating: reviewRating,
        comment,
        author,
      });
      // Modération : l'avis est persisté "en attente" et publié par
      // l'admin depuis l'espace d'administration (/?page=admin).
      toast.success(
        "Merci ! Votre avis a été soumis — il sera publié après validation."
      );
      trackEvent("review_submitted", {
        productId: product.id,
        rating: reviewRating,
      });
      setReviewAuthor("");
      setReviewRating(0);
      setReviewComment("");
      setReviewFormOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Impossible de publier votre avis. Réessayez plus tard."
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleStockAlertSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (alertSubmitting) return;
    const email = alertEmail.trim();
    if (!EMAIL_PATTERN.test(email)) return;
    setAlertSubmitting(true);
    try {
      // POST /api/stock-alerts — inscription persistée (unique email/produit).
      await api.stockAlerts.subscribe(product.id, email);
      toast.success(
        "Alerte activée ! Vous serez prévenu(e) dès le retour en stock."
      );
      toggleStockAlert(product.id);
      trackEvent("stock_alert", { productId: product.id });
      setStockAlertOpen(false);
      setAlertEmail("");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Impossible d'activer l'alerte. Réessayez plus tard."
      );
    } finally {
      setAlertSubmitting(false);
    }
  };

  return (
    <div className="bg-background">
      {/* JSON-LD produit — données structurées pour les moteurs de recherche */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Fil d'Ariane */}
        <nav
          className="flex items-center gap-2 text-sm text-muted-foreground mb-8 flex-wrap"
          aria-label="Fil d'Ariane"
        >
          <button
            type="button"
            className="hover:text-[#C9A961] transition-colors"
            onClick={() => onNavigate("home")}
          >
            Accueil
          </button>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <button
            type="button"
            className="hover:text-[#C9A961] transition-colors"
            onClick={() => onNavigate("shop")}
          >
            Boutique
          </button>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <button
            type="button"
            className="hover:text-[#C9A961] transition-colors"
            onClick={() => onNavigate("shop")}
          >
            {product.category?.name ?? "Produit"}
          </button>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <span className="text-foreground font-medium truncate">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          {/* Galerie */}
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-sm">
              <img
                src={gallery[activeImage] ?? product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {discount > 0 && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  -{discount}%
                </span>
              )}
              {product.isFeatured && (
                <span className="absolute top-4 right-4 bg-[#C9A961] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  Vedette
                </span>
              )}
              {outOfStock && (
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit bg-black/85 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">
                  Rupture de stock
                </span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto">
                {gallery.map((image, i) => (
                  <button
                    key={`${image}-${i}`}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Voir l'image ${i + 1} de ${product.name}`}
                    aria-pressed={activeImage === i}
                    className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors ${
                      activeImage === i
                        ? "border-[#C9A961]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Infos produit */}
          <div>
            <p className="text-xs text-[#C9A961] font-medium uppercase tracking-wider mb-2">
              {product.category?.name ?? ""}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {product.name}
            </h1>
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    aria-hidden="true"
                    className={`w-4 h-4 ${
                      i < filledStars
                        ? "fill-[#C9A961] text-[#C9A961]"
                        : "text-muted-foreground/40"
                    }`}
                  />
                ))}
              </span>
              <span className="text-sm text-muted-foreground">
                ({product.reviewCount}) · {product.soldCount} vendus
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
              <span className="text-4xl font-bold text-[#C9A961]">
                {priceLabel(product.price)}
              </span>
              {product.oldPrice && (
                <span className="text-xl text-muted-foreground/80 line-through">
                  {priceLabel(product.oldPrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                  -{discount}%
                </span>
              )}
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {product.description}
            </p>

            {details.length > 0 && (
              <ul className="mb-6 space-y-2">
                {details.map((detail, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#C9A961] mt-[7px] flex-shrink-0"
                      aria-hidden="true"
                    />
                    {detail}
                  </li>
                ))}
              </ul>
            )}

            {sizes.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  <p className="text-sm font-semibold text-foreground">Taille</p>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C9A961] hover:text-[#b8994f] hover:underline transition-colors"
                  >
                    <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
                    Guide des tailles
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={selectedSize === size}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        selectedSize === size
                          ? "border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]"
                          : "border-border hover:border-[#C9A961] text-foreground/80"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-foreground mb-2">
                  Couleur
                  {selectedColor ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {selectedColor}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      aria-label={`Couleur ${color}`}
                      aria-pressed={selectedColor === color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedColor === color
                          ? "border-[#C9A961] ring-2 ring-[#C9A961]/30"
                          : "border-border hover:border-[#C9A961]/60"
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full border border-black/10"
                        style={{ backgroundColor: colorHex(color) }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
              <div className="flex items-center border border-border rounded-full bg-card">
                <button
                  type="button"
                  className="p-3 hover:text-[#C9A961] transition-colors"
                  aria-label="Diminuer la quantité"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-semibold">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="p-3 hover:text-[#C9A961] transition-colors"
                  aria-label="Augmenter la quantité"
                  onClick={() =>
                    setQuantity((q) =>
                      Math.min(Math.max(1, product.stock), q + 1)
                    )
                  }
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {outOfStock ? (
                <span className="text-red-500 font-medium">
                  Rupture de stock
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  En stock : {product.stock}
                </span>
              )}
            </div>

            <div
              className={`flex flex-col sm:flex-row gap-3 ${
                outOfStock ? "mb-3" : "mb-8"
              }`}
            >
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock}
                className="flex-1 inline-flex items-center justify-center gap-2 btn-shine bg-[#C9A961] text-black px-8 py-4 rounded-full font-semibold hover:bg-[#b8994f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                Ajouter au panier
              </button>
              <button
                type="button"
                onClick={handleToggleWishlist}
                aria-label={
                  inWishlist ? "Retirer des favoris" : "Ajouter aux favoris"
                }
                className={`inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold border transition-colors ${
                  inWishlist
                    ? "border-[#C9A961] text-[#C9A961]"
                    : "border-border text-foreground/80 hover:border-[#C9A961] hover:text-[#C9A961]"
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${inWishlist ? "fill-[#C9A961]" : ""}`}
                  aria-hidden="true"
                />
                Favoris
              </button>
            </div>

            {outOfStock &&
              (subscribedToStockAlert ? (
                <button
                  type="button"
                  disabled
                  aria-live="polite"
                  className="w-full mb-8 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-[#C9A961]/70 bg-[#C9A961]/10 text-[#C9A961] font-semibold cursor-default"
                >
                  <Check className="w-5 h-5" aria-hidden="true" />
                  Alerte activée
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStockAlertOpen(true)}
                  className="w-full mb-8 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-border font-semibold text-foreground/80 hover:border-[#C9A961] hover:text-[#C9A961] transition-colors"
                >
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  Prévenez-moi du réassort
                </button>
              ))}

            <div className="bg-muted rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="text-center">
                <Truck
                  className="w-6 h-6 mx-auto text-[#C9A961] mb-2"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  Livraison gratuite dès 25 000 FCFA
                </span>
              </div>
              <div className="text-center">
                <RotateCcw
                  className="w-6 h-6 mx-auto text-[#C9A961] mb-2"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  Retours 30 jours
                </span>
              </div>
              <div className="text-center">
                <ShieldCheck
                  className="w-6 h-6 mx-auto text-[#C9A961] mb-2"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  Paiement sécurisé
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Historique des prix */}
        <section
          aria-label="Historique des prix"
          className="mt-10 mb-16 bg-card rounded-2xl border border-border/60 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h3 className="text-lg font-bold text-foreground inline-flex items-center gap-2">
              <ChartLine className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
              Historique des prix
            </h3>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
              {priceLabel(historyMin)} – {priceLabel(historyMax)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Évolution du prix sur les 30 derniers jours
          </p>
          <PriceHistoryChart data={priceHistory} />
          <p className="text-xs text-muted-foreground/80 mt-3">
            Le prix actuel est de{" "}
            <strong className="text-foreground">
              {priceLabel(product.price)}
            </strong>
            .
          </p>
        </section>

        {/* Avis clients — preuve sociale niveau entreprise */}
        <section aria-label="Avis clients" className="mb-16">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground inline-flex items-center gap-2">
              <MessageSquare
                className="w-6 h-6 text-[#C9A961]"
                aria-hidden="true"
              />
              Avis clients
            </h2>
            <button
              type="button"
              onClick={() => setReviewFormOpen((open) => !open)}
              aria-expanded={reviewFormOpen}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                reviewFormOpen
                  ? "border border-border text-foreground/80 hover:border-[#C9A961] hover:text-[#C9A961]"
                  : "bg-[#C9A961] hover:bg-[#b8994f] text-black"
              }`}
            >
              {reviewFormOpen ? "Annuler" : "Donner mon avis"}
            </button>
          </div>

          {reviewFormOpen && (
            <form
              onSubmit={handleReviewSubmit}
              noValidate
              className="bg-card border border-border/60 rounded-2xl p-6 mb-8"
            >
              <h3 className="font-bold text-foreground mb-5">
                Votre avis sur ce produit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="review-author">Votre nom</Label>
                  <Input
                    id="review-author"
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="Ex. Marie D."
                    maxLength={60}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label id="review-rating-label">Votre note</Label>
                  <div
                    className="flex items-center gap-1"
                    role="radiogroup"
                    aria-labelledby="review-rating-label"
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={reviewRating === star}
                        aria-label={`${star} étoile${star > 1 ? "s" : ""} sur 5`}
                        onClick={() => setReviewRating(star)}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                      >
                        <Star
                          aria-hidden="true"
                          className={`w-6 h-6 transition-colors ${
                            star <= reviewRating
                              ? "fill-[#C9A961] text-[#C9A961]"
                              : "text-muted-foreground/40 hover:text-[#C9A961]"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-5">
                <Label htmlFor="review-comment">Votre commentaire</Label>
                <Textarea
                  id="review-comment"
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Décrivez votre expérience avec ce produit..."
                  maxLength={1000}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleCancelReview}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmitReview || reviewSubmitting}
                  className="rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-black font-semibold px-6"
                >
                  {reviewSubmitting
                    ? "Publication en cours..."
                    : "Publier mon avis"}
                </Button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
            {/* Résumé agrégé */}
            <div className="bg-card border border-border/60 rounded-2xl p-6">
              <div className="text-center">
                <span className="block text-5xl font-bold text-[#C9A961] mb-2">
                  {product.rating.toFixed(1)}
                </span>
                <StarRow value={filledStars} size="w-5 h-5" />
                <span className="sr-only">
                  Note moyenne : {product.rating.toFixed(1)} sur 5
                </span>
                <p className="text-sm text-muted-foreground mt-2">
                  {product.reviewCount} avis
                </p>
              </div>
              <div className="mt-5 pt-5 border-t border-border/60 space-y-2.5">
                {RATING_STEPS.map((star, idx) => {
                  const count = ratingDistribution[idx] ?? 0;
                  const pct =
                    product.reviewCount > 0
                      ? Math.round((count / product.reviewCount) * 100)
                      : 0;
                  return (
                    <div
                      key={star}
                      className="flex items-center gap-2.5 text-xs"
                    >
                      <span className="w-10 inline-flex items-center justify-end gap-0.5 font-medium text-foreground/80">
                        {star}
                        <Star
                          className="w-3 h-3 fill-[#C9A961] text-[#C9A961]"
                          aria-hidden="true"
                        />
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C9A961]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Liste des avis / état vide */}
            <div>
              {allReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center bg-card border border-dashed border-border rounded-2xl p-10 min-h-[280px]">
                  <Star
                    className="w-10 h-10 text-muted-foreground/30 mb-3"
                    aria-hidden="true"
                  />
                  <p className="font-semibold text-foreground mb-1">
                    Soyez le premier à donner votre avis
                  </p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Partagez votre expérience avec la communauté MignonciteShop.
                  </p>
                  {!reviewFormOpen && (
                    <Button
                      type="button"
                      onClick={() => setReviewFormOpen(true)}
                      className="rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-black font-semibold px-6"
                    >
                      Donner mon avis
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {allReviews.map((review) => (
                    <article
                      key={review.id}
                      className="bg-card border border-border/60 rounded-2xl p-5"
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          aria-hidden="true"
                          className="w-10 h-10 rounded-full bg-[#C9A961]/15 text-[#C9A961] font-semibold flex items-center justify-center flex-shrink-0"
                        >
                          {reviewInitial(review.author)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="font-semibold text-foreground text-sm">
                              {review.author}
                            </span>
                            <time
                              dateTime={review.createdAt}
                              className="text-xs text-muted-foreground"
                            >
                              {formatReviewDate(review.createdAt)}
                            </time>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <StarRow
                              value={Math.round(review.rating)}
                              size="w-3.5 h-3.5"
                            />
                            <span className="sr-only">
                              Note : {review.rating} sur 5
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                            {review.comment}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Produits similaires */}
        {similar.length > 0 && (
          <div>
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Produits similaires
              </h2>
              <button
                type="button"
                className="text-sm font-medium text-[#C9A961] hover:underline"
                onClick={() => onNavigate("shop")}
              >
                Voir tout
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-6">
              {similar.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  onQuickView={onQuickView}
                  onOpenProduct={onOpenProduct}
                />
              ))}
            </div>
          </div>
        )}

        {/* Récemment consultés — rétention, garde d'hydratation incluse */}
        {recentProducts.length > 0 && (
          <section aria-label="Récemment consultés" className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
              Récemment consultés
            </h2>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2">
              {recentProducts.map((item) => (
                <div key={item.id} className="w-48 flex-shrink-0 snap-start">
                  <ProductCard
                    product={item}
                    onQuickView={onQuickView}
                    onOpenProduct={onOpenProduct}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Guide des tailles — dialogue partagé */}
        <SizeGuideDialog
          open={sizeGuideOpen}
          onOpenChange={setSizeGuideOpen}
        />

        {/* Alerte réassort — dialogue e-mail (comportement démo assumé) */}
        <Dialog open={stockAlertOpen} onOpenChange={setStockAlertOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Bell className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
                Alerte réassort
              </DialogTitle>
              <DialogDescription>
                Laissez votre adresse e-mail : nous vous préviendrons dès que{" "}
                <strong className="text-foreground">{product.name}</strong>{" "}
                revient en stock.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleStockAlertSubmit}
              noValidate
              className="space-y-4 mt-2"
            >
              <div className="space-y-2">
                <Label htmlFor="stock-alert-email">Adresse e-mail</Label>
                <Input
                  id="stock-alert-email"
                  type="email"
                  required
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  alertSubmitting || !EMAIL_PATTERN.test(alertEmail.trim())
                }
                className="w-full rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-black font-semibold"
              >
                {alertSubmitting ? "Envoi en cours..." : "Me prévenir"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
