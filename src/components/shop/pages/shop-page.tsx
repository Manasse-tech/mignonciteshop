"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  PackageCheck,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ProductCard } from "@/components/shop/product-card";
import { useShopStore } from "@/lib/store";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

const PER_PAGE = 8;
const MAX_PRICE = 100000;

type SortKey = "recent" | "price-asc" | "price-desc" | "rating" | "sold";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Plus récents" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "rating", label: "Meilleures notes" },
  { value: "sold", label: "Plus vendus" },
];

interface ShopPageProps {
  products: Product[];
  categories: Category[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onOpenProduct: (p: Product) => void;
  onQuickView: (p: Product) => void;
  /** Recherche issue du header (préremplit le champ). */
  initialSearch?: string;
  /** Catégorie issue de l'URL (?category=slug). */
  initialCategory?: string;
}

export function ShopPage({
  products,
  categories,
  loading,
  onNavigate,
  onOpenProduct,
  onQuickView,
  initialSearch,
  initialCategory,
}: ShopPageProps) {
  // Remount des filtres quand la recherche / catégorie d'URL change (pas d'effet).
  const key = `${initialSearch ?? ""}|${initialCategory ?? ""}`;
  return (
    <ShopContent
      key={key}
      products={products}
      categories={categories}
      loading={loading}
      onNavigate={onNavigate}
      onOpenProduct={onOpenProduct}
      onQuickView={onQuickView}
      initialSearch={initialSearch}
      initialCategory={initialCategory}
    />
  );
}

type ShopContentProps = ShopPageProps;

function ShopContent({
  products,
  categories,
  loading,
  onNavigate,
  onOpenProduct,
  onQuickView,
  initialSearch,
  initialCategory,
}: ShopContentProps) {
  const shopView = useShopStore((s) => s.shopView);
  const setShopView = useShopStore((s) => s.setShopView);
  const addToCart = useShopStore((s) => s.addToCart);

  const [search, setSearch] = useState<string>(() => initialSearch ?? "");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => initialCategory ?? null
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE]);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyStock, setOnlyStock] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = products;
    if (selectedCategory) {
      list = list.filter((p) => p.category?.slug === selectedCategory);
    }
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.category?.name ?? "").toLowerCase().includes(query)
      );
    }
    list = list.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );
    if (onlyPromo) list = list.filter((p) => p.oldPrice != null);
    if (onlyStock) list = list.filter((p) => p.stock > 0);
    const sorted = [...list];
    switch (sortBy) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "sold":
        sorted.sort((a, b) => b.soldCount - a.soldCount);
        break;
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    return sorted;
  }, [products, search, selectedCategory, priceRange, onlyPromo, onlyStock, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  const resetFilters = () => {
    setSearch("");
    setSortBy("recent");
    setSelectedCategory(null);
    setPriceRange([0, MAX_PRICE]);
    setOnlyPromo(false);
    setOnlyStock(false);
    setPage(1);
  };

  const selectCategory = (slug: string | null) => {
    setSelectedCategory(slug);
    setPage(1);
  };

  const handleAddToList = (product: Product) => {
    if (product.stock <= 0) {
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

  const sidebar = (
    <SidebarFilters
      categories={categories}
      selectedCategory={selectedCategory}
      onSelectCategory={selectCategory}
      priceRange={priceRange}
      onPriceRange={(value) => {
        setPriceRange(value);
        setPage(1);
      }}
      onlyPromo={onlyPromo}
      onOnlyPromo={(value) => {
        setOnlyPromo(value);
        setPage(1);
      }}
      onlyStock={onlyStock}
      onOnlyStock={(value) => {
        setOnlyStock(value);
        setPage(1);
      }}
      onReset={resetFilters}
    />
  );

  return (
    <div className="bg-background">
      {/* Bandeau titre */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-fluid-h1 font-bold text-foreground">
              Notre Boutique
            </h1>
            <p className="text-muted-foreground mt-2">
              Découvrez notre sélection de produits
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Barre recherche + tri + filtres mobile */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un produit..."
              aria-label="Rechercher un produit"
              className="w-full h-12 pl-12 pr-4 rounded-full border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A961] transition-colors"
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as SortKey);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label="Trier les produits"
              className="w-full sm:w-48 h-12 rounded-full border-border bg-card text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="lg:hidden inline-flex items-center justify-center h-12 px-6 rounded-full bg-card border border-border text-sm font-medium"
              >
                <SlidersHorizontal
                  className="w-5 h-5 mr-2"
                  aria-hidden="true"
                />
                Filtres
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetTitle className="sr-only">Filtres de la boutique</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-8">
          {/* Sidebar desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-32 bg-card rounded-2xl p-6 shadow-sm space-y-8">
              {sidebar}
            </div>
          </aside>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {filtered.length}
                </span>{" "}
                produits
                <span className="text-muted-foreground/80 text-sm">
                  {" "}
                  · {pageItems.length} affichés
                </span>
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="hidden sm:flex items-center rounded-full border border-border bg-card p-1 shadow-sm"
                  role="group"
                  aria-label="Mode d'affichage"
                >
                  <button
                    type="button"
                    aria-pressed={shopView === "grid"}
                    aria-label="Affichage en grille"
                    title="Affichage en grille"
                    className={`p-2 rounded-full transition-all ${
                      shopView === "grid"
                        ? "bg-[#C9A961] text-white shadow-sm"
                        : "text-muted-foreground hover:text-[#C9A961]"
                    }`}
                    onClick={() => setShopView("grid")}
                  >
                    <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={shopView === "list"}
                    aria-label="Affichage en liste"
                    title="Affichage en liste"
                    className={`p-2 rounded-full transition-all ${
                      shopView === "list"
                        ? "bg-[#C9A961] text-white shadow-sm"
                        : "text-muted-foreground hover:text-[#C9A961]"
                    }`}
                    onClick={() => setShopView("list")}
                  >
                    <List className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              shopView === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 xl:gap-6">
                  {Array.from({ length: PER_PAGE }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from({ length: PER_PAGE }).map((_, i) => (
                    <ListSkeleton key={i} />
                  ))}
                </div>
              )
            ) : pageItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <div className="p-6 bg-muted rounded-full mb-4">
                  <Search
                    className="w-10 h-10 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Aucun produit trouvé
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Essayez de modifier vos filtres ou votre recherche pour
                  trouver ce que vous cherchez.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-6 py-3 text-sm font-semibold transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  Réinitialiser les filtres
                </button>
              </div>
            ) : shopView === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 xl:gap-6">
                {pageItems.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onQuickView={onQuickView}
                    onOpenProduct={onOpenProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {pageItems.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    onOpenProduct={onOpenProduct}
                    onQuickView={onQuickView}
                    onAdd={handleAddToList}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <nav
                className="flex items-center justify-center gap-2 mt-10"
                aria-label="Pagination"
              >
                <button
                  type="button"
                  disabled={safePage === 1}
                  aria-label="Page précédente"
                  className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-sm font-medium hover:border-[#C9A961] hover:text-[#C9A961] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-current={safePage === pageNumber ? "page" : undefined}
                      aria-label={`Page ${pageNumber}`}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                        safePage === pageNumber
                          ? "bg-[#C9A961] text-white shadow-sm"
                          : "border border-border bg-card text-foreground/70 hover:border-[#C9A961] hover:text-[#C9A961]"
                      }`}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  aria-label="Page suivante"
                  className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-sm font-medium hover:border-[#C9A961] hover:text-[#C9A961] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarFiltersProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  priceRange: [number, number];
  onPriceRange: (value: [number, number]) => void;
  onlyPromo: boolean;
  onOnlyPromo: (value: boolean) => void;
  onlyStock: boolean;
  onOnlyStock: (value: boolean) => void;
  onReset: () => void;
}

function SidebarFilters({
  categories,
  selectedCategory,
  onSelectCategory,
  priceRange,
  onPriceRange,
  onlyPromo,
  onOnlyPromo,
  onlyStock,
  onOnlyStock,
  onReset,
}: SidebarFiltersProps) {
  return (
    <div className="space-y-8">
      <div>
        <h4 className="font-semibold text-foreground mb-4">Catégories</h4>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`block w-full text-left px-4 py-2 rounded-lg transition-colors text-sm ${
              selectedCategory === null
                ? "text-[#C9A961] font-semibold"
                : "hover:bg-muted text-foreground/80"
            }`}
          >
            Toutes les catégories
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.slug)}
              className={`block w-full text-left px-4 py-2 rounded-lg transition-colors text-sm ${
                selectedCategory === category.slug
                  ? "text-[#C9A961] font-semibold"
                  : "hover:bg-muted text-foreground/80"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-4">Prix</h4>
        <Slider
          min={0}
          max={MAX_PRICE}
          step={500}
          value={priceRange}
          onValueChange={(value) =>
            onPriceRange([value[0] ?? 0, value[1] ?? MAX_PRICE])
          }
          aria-label="Fourchette de prix"
          className="mb-3"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-foreground mb-4">Filtres rapides</h4>
        <button
          type="button"
          aria-pressed={onlyPromo}
          onClick={() => onOnlyPromo(!onlyPromo)}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            onlyPromo
              ? "border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]"
              : "border-border text-muted-foreground hover:border-[#C9A961]/50"
          }`}
        >
          <Tag className="w-4 h-4" aria-hidden="true" />
          En promotion uniquement
        </button>
        <button
          type="button"
          aria-pressed={onlyStock}
          onClick={() => onOnlyStock(!onlyStock)}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            onlyStock
              ? "border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]"
              : "border-border text-muted-foreground hover:border-[#C9A961]/50"
          }`}
        >
          <PackageCheck className="w-4 h-4" aria-hidden="true" />
          En stock uniquement
        </button>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 text-sm text-red-500/70 hover:text-red-500 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
        Réinitialiser les filtres
      </button>
    </div>
  );
}

interface ProductListItemProps {
  product: Product;
  onOpenProduct: (p: Product) => void;
  onQuickView: (p: Product) => void;
  onAdd: (p: Product) => void;
}

function ProductListItem({
  product,
  onOpenProduct,
  onQuickView,
  onAdd,
}: ProductListItemProps) {
  const outOfStock = product.stock <= 0;
  const discount = discountPercent(product.price, product.oldPrice);
  const filledStars = Math.round(product.rating);

  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:ring-1 hover:ring-[#C9A961]/40 transition-all duration-300 flex flex-col sm:flex-row gap-4 p-4">
      <button
        type="button"
        onClick={() => onOpenProduct(product)}
        className="relative w-full sm:w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden bg-muted"
        aria-label={`Voir la fiche de ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
            outOfStock ? "grayscale opacity-70" : ""
          }`}
        />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            -{discount}%
          </span>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#C9A961] font-medium uppercase tracking-wider mb-1">
          {product.category?.name ?? ""}
        </p>
        <button
          type="button"
          onClick={() => onOpenProduct(product)}
          className="block text-left w-full"
        >
          <h3 className="font-semibold text-foreground mb-1.5 line-clamp-1 group-hover:text-[#C9A961] transition-colors">
            {product.name}
          </h3>
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
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
            <span className="text-xs text-muted-foreground ml-1">
              ({product.reviewCount})
            </span>
          </span>
          {outOfStock ? (
            <span className="text-xs text-red-500 font-medium">
              Rupture de stock
            </span>
          ) : product.stock < 20 ? (
            <span className="text-xs text-orange-500">
              Plus que {product.stock} en stock
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 hidden sm:block">
          {product.description}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground">
              {priceLabel(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground/70 line-through">
                {priceLabel(product.oldPrice)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onQuickView(product)}
              aria-label="Aperçu rapide"
              className="p-2.5 rounded-full border border-border bg-card text-muted-foreground hover:text-[#C9A961] hover:border-[#C9A961] transition-colors"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onAdd(product)}
              disabled={outOfStock}
              className="inline-flex items-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
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

function ListSkeleton() {
  return (
    <div className="bg-muted rounded-2xl p-4 flex gap-4 animate-pulse">
      <div className="w-40 h-40 rounded-xl bg-muted-foreground/15 flex-shrink-0" />
      <div className="flex-1 space-y-3 py-2">
        <div className="h-3 w-1/4 bg-muted-foreground/15 rounded-full" />
        <div className="h-4 w-2/3 bg-muted-foreground/15 rounded-full" />
        <div className="h-3 w-1/2 bg-muted-foreground/15 rounded-full" />
        <div className="h-5 w-1/4 bg-muted-foreground/15 rounded-full" />
      </div>
    </div>
  );
}
