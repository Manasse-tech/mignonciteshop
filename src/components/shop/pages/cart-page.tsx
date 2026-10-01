"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ChevronDown,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useShopStore, selectCartTotal } from "@/lib/store";
import { computePromo, validatePromo, validatePromoRemote } from "@/lib/promos";
import { trackEvent } from "@/lib/analytics";
import { useStoreSettings } from "@/lib/use-store-settings";
import { formatPrice } from "@/lib/format";
import type { PromoDefinition } from "@/lib/types";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

const emptySubscribe = () => () => {};

interface CartPageProps {
  onNavigate: (page: string) => void;
}

export function CartPage({ onNavigate }: CartPageProps) {
  const cart = useShopStore((s) => s.cart);
  const updateQuantity = useShopStore((s) => s.updateQuantity);
  const removeFromCart = useShopStore((s) => s.removeFromCart);
  const subtotal = useShopStore(selectCartTotal);
  const promoCode = useShopStore((s) => s.promo);
  const setPromo = useShopStore((s) => s.setPromo);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  // Le code promo persisté est revalidé à chaque rendu : s'il n'est plus
  // valable pour ce sous-total, il est ignoré silencieusement (computePromo
  // renvoie une remise nulle) sans jamais être retiré du store.
  const promoValidation = useMemo(
    () => validatePromo(promoCode ?? "", subtotal),
    [promoCode, subtotal]
  );
  const promo: PromoDefinition | null = promoValidation.ok
    ? promoValidation.promo ?? null
    : null;
  const discount = computePromo(promo, subtotal).discount;
  // Frais de livraison pilotés depuis l'admin (réglages serveur).
  const storeSettings = useStoreSettings();
  // Évite tout décalage d'hydratation : le panier vient du localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className="bg-background flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="h-10 w-64 bg-muted rounded-full animate-pulse mb-8" />
          <div className="h-40 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Panier vide — véritable empty state (l'utilisateur est connecté à ce
  // stade : proposer « Se connecter » serait illogique).
  if (cart.length === 0) {
    return (
      <div className="bg-background flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col w-full">
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="p-8 bg-muted rounded-full mb-6">
              <ShoppingBag
                className="w-16 h-16 text-muted-foreground/40"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Votre panier est vide
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md">
              Parcourez la boutique et ajoutez vos articles préférés — ils
              apparaîtront ici, prêts pour la commande.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3.5 font-semibold transition-colors"
            >
              Découvrir la boutique
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shipping =
    subtotal >= storeSettings.freeShippingThreshold
      ? 0
      : storeSettings.shipping.standard;
  const total = subtotal - discount + shipping;

  async function handleApplyPromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (promoChecking) return;
    setPromoChecking(true);
    // Validation SERVEUR (source de vérité) : le code peut venir du back-office.
    const result = await validatePromoRemote(promoInput, subtotal);
    if (result.ok && result.promo) {
      setPromo(result.promo.code);
      setPromoInput("");
      setPromoError(null);
      toast.success(result.promo.label);
      trackEvent("apply_promo", { code: result.promo.code });
    } else {
      setPromoError(result.error ?? "Ce code promo n'est pas valide.");
    }
    setPromoChecking(false);
  }

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Votre panier
        </h1>
        <p className="text-muted-foreground mb-8">
          {cart.reduce((sum, item) => sum + item.quantity, 0)} article(s) dans
          votre panier
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lignes du panier */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div
                key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`}
                className="bg-card rounded-2xl border p-4 flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-24 h-24 rounded-xl object-cover bg-muted flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {priceLabel(item.price)}
                    {item.oldPrice ? (
                      <span className="ml-2 line-through text-muted-foreground/70">
                        {priceLabel(item.oldPrice)}
                      </span>
                    ) : null}
                  </p>
                  {(item.size || item.color) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.size ? `Taille : ${item.size}` : ""}
                      {item.size && item.color ? " · " : ""}
                      {item.color ? `Couleur : ${item.color}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="flex items-center border border-border rounded-full bg-card">
                    <button
                      type="button"
                      className="p-2.5 hover:text-[#C9A961] transition-colors"
                      aria-label={`Diminuer la quantité de ${item.name}`}
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                    >
                      <Minus className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="p-2.5 hover:text-[#C9A961] transition-colors"
                      aria-label={`Augmenter la quantité de ${item.name}`}
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="font-bold text-foreground w-20 text-right">
                    {priceLabel(item.price * item.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Supprimer ${item.name} du panier`}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                    onClick={() =>
                      removeFromCart(item.productId, item.size, item.color)
                    }
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground/70 hover:text-[#C9A961] transition-colors"
            >
              Continuer mes achats
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Résumé */}
          <div>
            <div className="bg-card rounded-2xl border p-6 lg:sticky lg:top-32">
              <h2 className="font-semibold text-foreground text-lg mb-4">
                Récapitulatif
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-medium text-foreground">
                    {priceLabel(subtotal)}
                  </span>
                </div>
                {promo && discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Remise ({promo.code})
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatPrice(discount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  {shipping === 0 ? (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Offerte
                    </span>
                  ) : (
                    <span className="font-medium text-foreground">
                      {priceLabel(shipping)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/80">
                  Offerte dès {formatPrice(storeSettings.freeShippingThreshold)} d&apos;achat.
                </p>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Total <span className="font-normal text-muted-foreground">(TTC)</span>
                  </span>
                  <span className="text-lg font-bold text-[#C9A961]">
                    {priceLabel(total)}
                  </span>
                </div>
              </div>
              {/* Code promo */}
              <div className="border-t border-border mt-4 pt-4">
                {promo ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/10 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag
                        className="w-4 h-4 text-[#C9A961] shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#C9A961] leading-tight">
                          {promo.code}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {promo.label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPromo(null)}
                      aria-label="Retirer le code promo"
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[#C9A961] transition-colors"
                      >
                        <Tag className="w-4 h-4" aria-hidden="true" />
                        Ajouter un code promo
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <form
                        onSubmit={handleApplyPromo}
                        className="mt-3 flex items-start gap-2"
                      >
                        <div className="flex-1">
                          <Input
                            value={promoInput}
                            onChange={(event) => {
                              setPromoInput(event.target.value);
                              setPromoError(null);
                            }}
                            placeholder="Code promo"
                            aria-label="Code promo"
                            className="h-11 uppercase"
                          />
                          {promoError && (
                            <p className="text-destructive text-sm mt-1.5">
                              {promoError}
                            </p>
                          )}
                        </div>
                        <button
                          type="submit"
                          disabled={promoChecking}
                          className="h-11 shrink-0 rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white px-5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {promoChecking ? "…" : "Appliquer"}
                        </button>
                      </form>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate("checkout")}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3.5 font-semibold transition-colors"
              >
                Passer commande
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
