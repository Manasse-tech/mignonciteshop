"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShopStore } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

interface SearchDialogProps {
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (p: Product) => void;
  onNavigateShopWithSearch: (q: string) => void;
}

export function SearchDialog({
  products,
  open,
  onOpenChange,
  onOpenProduct,
  onNavigateShopWithSearch,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const addSearchHistory = useShopStore((s) => s.addSearchHistory);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category?.name.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [products, query]);

  const handleOpenProduct = (product: Product) => {
    addSearchHistory(query.trim());
    onOpenChange(false);
    setQuery("");
    onOpenProduct(product);
  };

  const handleSeeAll = () => {
    addSearchHistory(query.trim());
    onOpenChange(false);
    onNavigateShopWithSearch(query.trim());
    setQuery("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="p-5 pb-3">
          <DialogTitle className="text-lg font-semibold text-foreground mb-3">
            Rechercher un produit
          </DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) handleSeeAll();
            }}
          >
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                aria-label="Rechercher un produit"
                className="w-full h-11 pl-11 pr-4 rounded-full bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A961] transition-colors"
              />
            </div>
          </form>
        </div>

        <div className="max-h-80 overflow-y-auto px-3 pb-3">
          {!query.trim() ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Commencez à taper pour rechercher un produit...
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun produit trouvé pour «&nbsp;{query.trim()}&nbsp;»
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleOpenProduct(product)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {product.name}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {product.category?.name ?? ""}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-[#C9A961] flex-shrink-0">
                      {priceLabel(product.price)}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSeeAll}
                className="mt-2 w-full text-center text-sm font-medium text-[#C9A961] hover:text-[#b8994f] transition-colors py-2.5 rounded-xl hover:bg-muted"
              >
                Voir tous les résultats pour «&nbsp;{query.trim()}&nbsp;»
              </button>
            </>
          )}
        </div>
        <DialogDescription className="sr-only">
          Résultats de recherche de produits en direct
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
