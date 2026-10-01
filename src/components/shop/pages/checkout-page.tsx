"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useShopStore, selectCartTotal } from "@/lib/store";
import { computePromo, validatePromo, validatePromoRemote } from "@/lib/promos";
import { api, ApiError, type StoreSettingsPublic } from "@/lib/api";
import {
  DEFAULT_STORE_SETTINGS,
  useStoreSettings,
} from "@/lib/use-store-settings";
import { trackEvent } from "@/lib/analytics";
import type {
  CartItem,
  CheckoutAddress,
  OrderSnapshot,
  PromoDefinition,
  ShippingMethod,
  ShippingOption,
} from "@/lib/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

/** Prix affiché en FCFA — source unique : src/lib/format.ts. */
function priceLabel(price: number): string {
  return formatPrice(price);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const COUNTRIES = ["France", "Belgique", "Suisse", "Luxembourg"] as const;

/**
 * Options de livraison — les prix sont injectés depuis les réglages
 * de la boutique (GET /api/settings, pilotés par l'admin). L'estimation
 * affichée n'est jamais contractuelle : le débit réel est recalculé serveur.
 */
function buildShippingOptions(settings: StoreSettingsPublic): ShippingOption[] {
  return [
    {
      id: "standard",
      label: "Standard",
      description: "Livraison à domicile suivie",
      price: settings.shipping.standard,
      eta: "2 à 5 jours ouvrés",
    },
    {
      id: "express",
      label: "Express",
      description: "Livraison prioritaire à domicile",
      price: settings.shipping.express,
      eta: "24h à 48h",
    },
    {
      id: "pickup",
      label: "Point relais",
      description: "Retrait en point relais",
      price: settings.shipping.pickup,
      eta: "2 à 4 jours ouvrés",
    },
  ];
}

const STEPS = [
  "Informations",
  "Livraison",
  "Paiement",
  "Confirmation",
] as const;

/** standard = 0 si sous-total ≥ seuil de gratuité ou promo livraison offerte. */
function getShippingCost(
  method: ShippingMethod,
  subtotal: number,
  freeShippingPromo: boolean,
  settings: StoreSettingsPublic
): number {
  if (method === "express") return settings.shipping.express;
  if (method === "pickup") return settings.shipping.pickup;
  if (subtotal >= settings.freeShippingThreshold || freeShippingPromo) return 0;
  return settings.shipping.standard;
}

/** Formatage « 1234 5678 9012 3456 » : espaces tous les 4 chiffres, 16 max. */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Formatage « MM/AA » avec barre oblique automatique. */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/* La référence de commande est désormais générée côté SERVEUR
   (src/lib/order-pricing.ts — MC-XXXXXX unique garanti en base). */

const checkoutInfoSchema = z.object({
  email: z.email("Veuillez saisir une adresse email valide."),
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères."),
  lastName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  phone: z
    .string()
    .trim()
    .regex(/^$|^[+0-9 ().-]{6,20}$/, "Numéro de téléphone invalide."),
  line1: z
    .string()
    .trim()
    .min(5, "Veuillez saisir votre adresse (5 caractères minimum)."),
  line2: z.string().trim(),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, "Le code postal doit contenir exactement 5 chiffres."),
  city: z.string().trim().min(2, "Veuillez saisir votre ville."),
  country: z.enum(["France", "Belgique", "Suisse", "Luxembourg"]),
});

type CheckoutInfoValues = z.infer<typeof checkoutInfoSchema>;

const emptySubscribe = () => () => {};

interface CheckoutPageProps {
  onNavigate: (page: string) => void;
}

export function CheckoutPage({ onNavigate }: CheckoutPageProps) {
  const cart = useShopStore((s) => s.cart);
  // Évite tout décalage d'hydratation : le panier vient du localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const beginCheckoutFiredRef = useRef(false);

  // begin_checkout : une seule fois, au premier affichage de l'étape 1.
  useEffect(() => {
    if (beginCheckoutFiredRef.current || !mounted || cart.length === 0) return;
    beginCheckoutFiredRef.current = true;
    trackEvent("begin_checkout");
  }, [mounted, cart.length]);

  if (!mounted) {
    return <CheckoutSkeleton />;
  }

  // Étape 4 (Confirmation) : le snapshot existe → le panier vient d'être vidé.
  if (order) {
    return <ConfirmationView order={order} onNavigate={onNavigate} />;
  }

  if (cart.length === 0) {
    return <EmptyCartView onNavigate={onNavigate} />;
  }

  return (
    <CheckoutTunnel
      onNavigate={onNavigate}
      onComplete={(snapshot) => {
        setOrder(snapshot);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tunnel — étapes 1 à 3
// ---------------------------------------------------------------------------

interface CheckoutTunnelProps {
  onComplete: (order: OrderSnapshot) => void;
  onNavigate: (page: string) => void;
}

function CheckoutTunnel({ onComplete, onNavigate }: CheckoutTunnelProps) {
  const cart = useShopStore((s) => s.cart);
  const subtotal = useShopStore(selectCartTotal);
  const promoCode = useShopStore((s) => s.promo);
  const setPromo = useShopStore((s) => s.setPromo);
  const clearCart = useShopStore((s) => s.clearCart);

  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<CheckoutInfoValues | null>(null);
  const [shipping, setShipping] = useState<ShippingMethod>("standard");
  const [payMethod, setPayMethod] = useState<
    "card" | "mobile_money" | "paypal"
  >("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [cgvError, setCgvError] = useState(false);
  const cgvRef = useRef<HTMLDivElement | null>(null);
  const paidRef = useRef(false);

  // L'instance vit dans ce composant : les valeurs saisies sont conservées
  // quand on revient d'une étape ultérieure.
  const infoForm = useForm<CheckoutInfoValues>({
    resolver: zodResolver(checkoutInfoSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      line1: "",
      line2: "",
      postalCode: "",
      city: "",
      country: "France",
    },
    mode: "onTouched",
  });

  // Code promo persisté : revalidé à chaque rendu (ignoré silencieusement
  // s'il n'est plus valable pour ce sous-total, sans être retiré du store).
  const promoValidation = useMemo(
    () => validatePromo(promoCode ?? "", subtotal),
    [promoCode, subtotal]
  );
  const promo: PromoDefinition | null = promoValidation.ok
    ? promoValidation.promo ?? null
    : null;
  const promoComp = useMemo(
    () => computePromo(promo, subtotal),
    [promo, subtotal]
  );

  // Frais de livraison pilotés depuis l'admin (réglages serveur).
  const storeSettings = useStoreSettings();
  const shippingOptions = useMemo(
    () => buildShippingOptions(storeSettings),
    [storeSettings]
  );

  const shippingCost = getShippingCost(
    shipping,
    subtotal,
    promoComp.freeShipping,
    storeSettings
  );
  const total = round2(promoComp.discountedSubtotal + shippingCost);
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function handleInfoSubmit(values: CheckoutInfoValues): void {
    setInfo(values);
    setCardHolder((prev) =>
      prev.trim().length > 0 ? prev : `${values.firstName} ${values.lastName}`.trim()
    );
    setStep(2);
  }

  function clearCardError(key: string): void {
    setCardErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handlePay(): void {
    if (processing || paidRef.current || !info) return;

    // Conformité art. L221-13 / L221-13-1 : acceptation expresse des CGV
    // obligatoire AVANT toute commande (paiement bloqué sinon).
    if (!cgvAccepted) {
      setCgvError(true);
      toast.error("Veuillez accepter les conditions générales de vente", {
        description: "L'acceptation des CGV est requise pour finaliser votre commande.",
      });
      cgvRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Vérification légère du format des champs de carte (passerelle démo)
    // — UNIQUEMENT pour le paiement carte.
    const errors: Record<string, string> = {};
    const digits = cardNumber.replace(/\s/g, "");
    if (payMethod === "card") {
      if (!/^\d{16}$/.test(digits)) {
        errors.number = "Le numéro de carte doit contenir 16 chiffres.";
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        errors.expiry = "Date d'expiration invalide (format MM/AA).";
      }
      if (!/^\d{3}$/.test(cardCvc)) {
        errors.cvc = "Le code de sécurité doit contenir 3 chiffres.";
      }
      if (cardHolder.trim().length < 2) {
        errors.holder = "Veuillez saisir le nom du titulaire.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }
    setCardErrors({});
    setProcessing(true);

    // La commande est ENREGISTRÉE côté serveur (POST /api/orders —
    // recalcul prix/stock/promo/livraison en base), puis snapshot de
    // confirmation + clearCart() + setPromo(null) exécutés exactement
    // une fois (garde paidRef).
    const submitOrder = (): void => {
      if (paidRef.current) return;
      const address: CheckoutAddress = {
        line1: info.line1,
        line2: info.line2,
        postalCode: info.postalCode,
        city: info.city,
        country: info.country,
      };
      const isMobileMoney = payMethod === "mobile_money";
      api.orders
        .create({
          email: info.email,
          customerName: `${info.firstName} ${info.lastName}`.trim(),
          phone: info.phone || null,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          })),
          shippingMethod: shipping,
          promoCode: promo?.code ?? null,
          // mobile_money → commande créée NON PAYÉE : le règlement se fait
          // via le numéro marchand de la boutique, la référence sert de
          // justificatif (aucune simulation de débit).
          paymentMethod: isMobileMoney ? "mobile_money" : "card",
          // Autorisation bancaire côté serveur (passerelle carte de test).
          // Seuls les 4 derniers chiffres sont conservés sur la commande.
          card: isMobileMoney
            ? null
            : { number: digits, holder: cardHolder.trim() },
          address,
        })
        .then((result) => {
          if (paidRef.current) return;
          paidRef.current = true;
          const snapshot: OrderSnapshot = {
            reference: result.reference,
            email: info.email,
            customerName: `${info.firstName} ${info.lastName}`.trim(),
            items: cart.map((item) => ({ ...item })),
            // Montants RÉELS recalculés par le serveur.
            subtotal: result.subtotal,
            discount: result.discount,
            shippingCost: result.shippingCost,
            total: result.total,
            promoCode: promo?.code ?? null,
            shippingMethod: shipping,
            address,
            createdAt: new Date().toISOString(),
            paymentMethod: isMobileMoney ? "mobile_money" : "card",
          };
          trackEvent("purchase", {
            reference: snapshot.reference,
            total: snapshot.total,
          });
          clearCart();
          setPromo(null);
          onComplete(snapshot);
        })
        .catch((error: unknown) => {
          // Échec (stock insuffisant, promo refusée…) : le tunnel reste
          // utilisable — on réinitialise les verrous sans vider le panier.
          paidRef.current = false;
          setProcessing(false);
          const message =
            error instanceof ApiError
              ? error.message
              : "Le paiement n'a pas pu être finalisé. Réessayez.";
          toast.error(message);
        });
    };

    if (payMethod === "card") {
      // Petit délai d'autorisation (passerelle de test).
      window.setTimeout(submitOrder, 1200);
    } else {
      // Mobile money : aucune simulation de débit → commande immédiate.
      submitOrder();
    }
  }

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Finaliser ma commande
          </h1>
          <p className="text-muted-foreground inline-flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
            Paiement sécurisé — commande en tant qu&apos;invité, aucun compte
            requis.
          </p>
        </div>

        <Stepper current={step} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2">
            <div className="bg-card rounded-2xl border p-6 sm:p-8">
              {step === 1 && (
                <Form {...infoForm}>
                  <form
                    onSubmit={infoForm.handleSubmit(handleInfoSubmit)}
                    noValidate
                  >
                    <h2 className="text-xl font-semibold text-foreground">
                      Vos informations
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 mb-6">
                      Ces coordonnées servent à préparer votre commande et à
                      vous tenir informé de sa livraison.
                    </p>
                    <div className="grid gap-5">
                      <FormField
                        control={infoForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                autoComplete="email"
                                placeholder="vous@exemple.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                          control={infoForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prénom</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="given-name"
                                  placeholder="Camille"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={infoForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="family-name"
                                  placeholder="Durand"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={infoForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Téléphone{" "}
                              <span className="font-normal text-muted-foreground">
                                (facultatif)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                autoComplete="tel"
                                placeholder="+33 6 12 34 56 78"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="border-t border-border/60 pt-5">
                        <h3 className="font-semibold text-foreground mb-1">
                          Adresse de livraison
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Où souhaitez-vous recevoir votre commande ?
                        </p>
                      </div>
                      <FormField
                        control={infoForm.control}
                        name="line1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse</FormLabel>
                            <FormControl>
                              <Input
                                autoComplete="address-line1"
                                placeholder="12 rue des Lilas"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={infoForm.control}
                        name="line2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Complément d&apos;adresse{" "}
                              <span className="font-normal text-muted-foreground">
                                (facultatif)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                autoComplete="address-line2"
                                placeholder="Appartement 4B, bâtiment B"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                          control={infoForm.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code postal</FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="numeric"
                                  autoComplete="postal-code"
                                  placeholder="75011"
                                  maxLength={5}
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(
                                      event.target.value.replace(/\D/g, "").slice(0, 5)
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={infoForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ville</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="address-level2"
                                  placeholder="Paris"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={infoForm.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pays</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Sélectionnez votre pays" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COUNTRIES.map((country) => (
                                  <SelectItem key={country} value={country}>
                                    {country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3.5 font-semibold transition-colors"
                      >
                        Continuer vers la livraison
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </form>
                </Form>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Mode de livraison
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-6">
                    Choisissez la livraison qui vous convient.
                  </p>
                  <RadioGroup
                    value={shipping}
                    onValueChange={(value) => setShipping(value as ShippingMethod)}
                    aria-label="Mode de livraison"
                    className="gap-4"
                  >
                    {shippingOptions.map((option) => {
                      const selected = shipping === option.id;
                      const isFree =
                        option.id === "standard" &&
                        getShippingCost(
                          "standard",
                          subtotal,
                          promoComp.freeShipping,
                          storeSettings
                        ) === 0;
                      const Icon =
                        option.id === "express"
                          ? Zap
                          : option.id === "pickup"
                            ? Store
                            : Truck;
                      return (
                        <label
                          key={option.id}
                          htmlFor={`shipping-${option.id}`}
                          className={cn(
                            "flex items-center gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all",
                            selected
                              ? "border-[#C9A961] ring-2 ring-[#C9A961]/25 bg-[#C9A961]/5"
                              : "border-border hover:border-[#C9A961]/50"
                          )}
                        >
                          <RadioGroupItem
                            value={option.id}
                            id={`shipping-${option.id}`}
                          />
                          <span className="w-10 h-10 rounded-full bg-[#C9A961]/10 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold text-foreground">
                              {option.label}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {option.description}
                            </span>
                            {option.id === "standard" && (
                              <span className="block text-xs text-muted-foreground/80 mt-0.5">
                                Offerte dès {formatPrice(storeSettings.freeShippingThreshold)} d&apos;achat
                              </span>
                            )}
                          </span>
                          <span className="text-right shrink-0">
                            {isFree ? (
                              <span className="block font-semibold text-green-600 dark:text-green-400">
                                Offerte
                              </span>
                            ) : (
                              <span className="block font-semibold text-foreground">
                                {priceLabel(option.price)}
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {option.eta}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                  <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[#C9A961] transition-colors self-start sm:self-auto"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3.5 font-semibold transition-colors"
                    >
                      Continuer vers le paiement
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Paiement
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Aucune donnée bancaire réelle n&apos;est conservée : la
                    passerelle de test ne garde que les 4 derniers chiffres.
                  </p>
                  <div className="flex items-start gap-2.5 rounded-xl border border-[#C9A961]/30 bg-[#C9A961]/10 px-4 py-3 text-sm text-foreground/80">
                    <Info className="w-4 h-4 text-[#C9A961] mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Carte = passerelle de test : la commande est enregistrée
                      puis marquée « payée » automatiquement (validation par la
                      boutique, aucun débit réel). Le prestataire réel (Stripe)
                      sera branché avec ses clés.
                    </span>
                  </div>

                  <RadioGroup
                    value={payMethod}
                    onValueChange={(value) =>
                      setPayMethod(value as "card" | "mobile_money" | "paypal")
                    }
                    aria-label="Moyen de paiement"
                    className="mt-6 gap-4 sm:grid sm:grid-cols-2"
                  >
                    <label
                      htmlFor="payment-card"
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all",
                        payMethod === "card"
                          ? "border-[#C9A961] ring-2 ring-[#C9A961]/25 bg-[#C9A961]/5"
                          : "border-border hover:border-[#C9A961]/50"
                      )}
                    >
                      <RadioGroupItem value="card" id="payment-card" />
                      <span className="w-10 h-10 rounded-full bg-[#C9A961]/10 flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-foreground">
                          Carte bancaire
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Visa, Mastercard, CB
                        </span>
                      </span>
                    </label>
                    <label
                      htmlFor="payment-mobile-money"
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all",
                        payMethod === "mobile_money"
                          ? "border-[#C9A961] ring-2 ring-[#C9A961]/25 bg-[#C9A961]/5"
                          : "border-border hover:border-[#C9A961]/50"
                      )}
                    >
                      <RadioGroupItem
                        value="mobile_money"
                        id="payment-mobile-money"
                      />
                      <span className="w-10 h-10 rounded-full bg-[#C9A961]/10 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-foreground">
                          Mobile Money
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Wave, Orange Money, MTN, Moov
                        </span>
                      </span>
                    </label>
                    <div
                      aria-disabled="true"
                      className="flex items-center gap-4 rounded-2xl border border-border p-4 sm:p-5 opacity-60 cursor-not-allowed"
                    >
                      <RadioGroupItem value="paypal" disabled aria-label="PayPal" />
                      <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-foreground">PayPal</span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground mt-0.5">
                          Disponible prochainement
                        </span>
                      </span>
                    </div>
                  </RadioGroup>

                  {/* Mobile money : pas de simulation — le règlement se fait
                      via le numéro marchand, la référence commande sert de
                      justificatif. L'activation réelle se fait côté admin. */}
                  {payMethod === "mobile_money" && (
                    <div className="mt-6 grid gap-3">
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground/90">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          Paiement mobile money — configuration en cours chez le
                          prestataire. Votre commande sera enregistrée en
                          attente de paiement.
                          {storeSettings.payment.mobileMoneyEnabled &&
                            storeSettings.payment.mobileMoneyNumber && (
                              <>
                                {" "}Réglez via{" "}
                                <strong>
                                  {storeSettings.payment.mobileMoneyNumber}
                                </strong>{" "}
                                puis indiquez la référence commande.
                              </>
                            )}
                          {!storeSettings.payment.mobileMoneyEnabled &&
                            " La boutique vous indiquera le règlement (numéro marchand) après validation."}
                        </span>
                      </div>
                      {storeSettings.payment.instructions && (
                        <p className="text-xs text-muted-foreground px-1 whitespace-pre-line">
                          {storeSettings.payment.instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {payMethod === "card" && (
                    <div className="mt-6 grid gap-5">
                      <div className="grid gap-2">
                        <Label htmlFor="card-number">Numéro de carte</Label>
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="font-mono"
                          value={cardNumber}
                          onChange={(event) => {
                            setCardNumber(formatCardNumber(event.target.value));
                            clearCardError("number");
                          }}
                          aria-invalid={cardErrors.number ? true : undefined}
                        />
                        {cardErrors.number && (
                          <p className="text-destructive text-sm">{cardErrors.number}</p>
                        )}
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="card-expiry">Expiration</Label>
                          <Input
                            id="card-expiry"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            placeholder="MM/AA"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(event) => {
                              setCardExpiry(formatExpiry(event.target.value));
                              clearCardError("expiry");
                            }}
                            aria-invalid={cardErrors.expiry ? true : undefined}
                          />
                          {cardErrors.expiry && (
                            <p className="text-destructive text-sm">{cardErrors.expiry}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="card-cvc">CVC</Label>
                          <Input
                            id="card-cvc"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            placeholder="123"
                            maxLength={3}
                            value={cardCvc}
                            onChange={(event) => {
                              setCardCvc(event.target.value.replace(/\D/g, "").slice(0, 3));
                              clearCardError("cvc");
                            }}
                            aria-invalid={cardErrors.cvc ? true : undefined}
                          />
                          {cardErrors.cvc && (
                            <p className="text-destructive text-sm">{cardErrors.cvc}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="card-holder">Titulaire de la carte</Label>
                        <Input
                          id="card-holder"
                          autoComplete="cc-name"
                          placeholder="Prénom Nom"
                          value={cardHolder}
                          onChange={(event) => {
                            setCardHolder(event.target.value);
                            clearCardError("holder");
                          }}
                          aria-invalid={cardErrors.holder ? true : undefined}
                        />
                        {cardErrors.holder && (
                          <p className="text-destructive text-sm">{cardErrors.holder}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Conformité : acceptation expresse des CGV avant commande
                      (art. L221-13 Code de la consommation). */}
                  <div
                    ref={cgvRef}
                    className={cn(
                      "mt-8 flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                      cgvError
                        ? "border-destructive/60 bg-destructive/5"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <Checkbox
                      id="cgv-accept"
                      checked={cgvAccepted}
                      onCheckedChange={(checked) => {
                        setCgvAccepted(checked === true);
                        if (checked) setCgvError(false);
                      }}
                      aria-invalid={cgvError ? true : undefined}
                      aria-describedby={cgvError ? "cgv-error" : undefined}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="cgv-accept"
                      className="text-sm text-foreground/90 leading-relaxed cursor-pointer"
                    >
                      J&apos;accepte les{" "}
                      <button
                        type="button"
                        onClick={() => onNavigate("cgv")}
                        className="font-semibold text-[#C9A961] underline underline-offset-2 hover:text-[#b8994f]"
                      >
                        Conditions Générales de Vente
                      </button>{" "}
                      et je reconnais avoir pris connaissance de la politique de{" "}
                      <button
                        type="button"
                        onClick={() => onNavigate("privacy")}
                        className="font-semibold text-[#C9A961] underline underline-offset-2 hover:text-[#b8994f]"
                      >
                        confidentialité
                      </button>
                      , dont le droit de rétractation de 14 jours.
                    </label>
                  </div>
                  {cgvError && (
                    <p
                      id="cgv-error"
                      role="alert"
                      className="mt-2 text-sm text-destructive"
                    >
                      Vous devez accepter les conditions générales de vente pour
                      pouvoir commander.
                    </p>
                  )}

                  <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[#C9A961] transition-colors self-start sm:self-auto"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Retour
                    </button>
                    {/* Menton légale art. L221-13-1 : le bouton porte la mention
                        « commande avec paiement obligatoire ». */}
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={processing}
                      className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-6 sm:px-8 py-3.5 text-sm sm:text-base font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          Traitement en cours…
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="text-left leading-tight">
                            Commander avec paiement obligatoire
                            <span className="block sm:inline sm:ml-1.5 font-bold">
                              {priceLabel(total)}
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C9A961]" aria-hidden="true" />
                    Commande réelle et enregistrée — la passerelle de paiement
                    réelle sera branchée avec les clés du prestataire.
                  </p>
                </div>
              )}
            </div>
          </section>

          <SummarySidebar
            items={cart}
            itemsCount={itemsCount}
            subtotal={subtotal}
            promo={promo}
            discount={promoComp.discount}
            shippingCost={shippingCost}
            total={total}
            freeShippingThreshold={storeSettings.freeShippingThreshold}
            onRemovePromo={() => setPromo(null)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper visuel
// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Étapes de commande" className="mb-10">
      <ol className="flex items-start">
        {STEPS.map((label, index) => {
          const id = index + 1;
          const done = id < current;
          const active = id === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn("flex items-start", index < STEPS.length - 1 && "flex-1")}
            >
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                    done && "bg-[#C9A961] border-[#C9A961] text-white",
                    active &&
                      "bg-[#C9A961] border-[#C9A961] text-white ring-4 ring-[#C9A961]/20",
                    !done && !active && "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {done ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    id
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block",
                    active && "text-[#C9A961]",
                    done && !active && "text-foreground",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex-1 h-0.5 rounded-full mt-[17px] mx-2 sm:mx-3",
                    done ? "bg-[#C9A961]" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
        Étape {current} sur {STEPS.length} — {STEPS[current - 1]}
      </p>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Récapitulatif (sidebar sticky, visible sur les étapes 1 à 3)
// ---------------------------------------------------------------------------

interface SummarySidebarProps {
  items: CartItem[];
  itemsCount: number;
  subtotal: number;
  promo: PromoDefinition | null;
  discount: number;
  shippingCost: number;
  total: number;
  /** Seuil de livraison offerte (réglages boutique, chargés par le hook). */
  freeShippingThreshold: number;
  onRemovePromo: () => void;
}

function SummarySidebar({
  items,
  itemsCount,
  subtotal,
  promo,
  discount,
  shippingCost,
  total,
  freeShippingThreshold,
  onRemovePromo,
}: SummarySidebarProps) {
  return (
    <div>
      <div className="bg-card rounded-2xl border p-6 lg:sticky lg:top-32">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="font-semibold text-foreground text-lg">Récapitulatif</h2>
          <span className="text-sm text-muted-foreground">
            {itemsCount} article(s)
          </span>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-3 pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`}
              className="flex items-center gap-3"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1">
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quantité : {item.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                {priceLabel(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-5 pt-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span className="font-medium text-foreground">{priceLabel(subtotal)}</span>
          </div>
          {promo && discount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remise ({promo.code})</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                -{formatPrice(discount)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Livraison</span>
            {shippingCost === 0 ? (
              <span className="font-medium text-green-600 dark:text-green-400">
                Offerte
              </span>
            ) : (
              <span className="font-medium text-foreground">
                {priceLabel(shippingCost)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/80">
            Offerte dès {formatPrice(freeShippingThreshold)} d&apos;achat.
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

        {promo ? (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/10 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
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
                onClick={onRemovePromo}
                aria-label="Retirer le code promo"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <PromoCodeBox subtotal={subtotal} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Code promo (checkout) — le panier reste propriétaire de la saisie principale
// ---------------------------------------------------------------------------

interface PromoCodeBoxProps {
  subtotal: number;
}

function PromoCodeBox({ subtotal }: PromoCodeBoxProps) {
  const setPromo = useShopStore((s) => s.setPromo);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    // Validation SERVEUR : les codes créés depuis l'espace admin sont
    // immédiatement utilisables ici (source de vérité unique).
    const result = await validatePromoRemote(value, subtotal);
    if (result.ok && result.promo) {
      setPromo(result.promo.code);
      trackEvent("apply_promo", { code: result.promo.code });
      toast.success(result.promo.label);
      setValue("");
      setError(null);
      setOpen(false);
    } else {
      setError(result.error ?? "Ce code promo n'est pas valide.");
    }
    setChecking(false);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-5 pt-4 border-t border-border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[#C9A961] transition-colors"
        >
          <Tag className="w-4 h-4" aria-hidden="true" />
          Ajouter un code promo
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form onSubmit={handleSubmit} className="mt-3 flex items-start gap-2">
          <div className="flex-1">
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder="Code promo"
              aria-label="Code promo"
              className="h-11 uppercase"
            />
            {error && <p className="text-destructive text-sm mt-1.5">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={checking}
            className="h-11 shrink-0 rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white px-5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {checking ? "…" : "Appliquer"}
          </button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Étape 4 — Confirmation
// ---------------------------------------------------------------------------

interface ConfirmationViewProps {
  order: OrderSnapshot;
  onNavigate: (page: string) => void;
}

function ConfirmationView({ order, onNavigate }: ConfirmationViewProps) {
  const firstName = order.customerName.split(" ")[0] ?? order.customerName;
  // Label/ETA uniquement — le montant affiché vient du snapshot serveur.
  const shippingOption = buildShippingOptions(DEFAULT_STORE_SETTINGS).find(
    (option) => option.id === order.shippingMethod
  );
  const addressLines = [
    order.address.line1,
    order.address.line2,
    `${order.address.postalCode} ${order.address.city}`,
    order.address.country,
  ].filter((line) => line.trim().length > 0);

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col w-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
          <div className="rounded-full bg-[#C9A961] p-5 shadow-[0_0_0_12px_rgba(201,169,97,0.12)] mb-6">
            <Check className="w-10 h-10 text-white" strokeWidth={3} aria-hidden="true" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Merci {firstName} ! Votre commande est confirmée.
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            Référence de commande
          </p>
          <p className="font-mono text-xl font-bold tracking-widest text-[#C9A961] mb-8">
            {order.reference}
          </p>

          <div className="w-full max-w-xl bg-card rounded-2xl border p-6 text-left">
            <h2 className="font-semibold text-foreground mb-4">
              Récapitulatif de la commande
            </h2>
            <dl className="grid gap-4 text-sm">
              <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-3 items-start">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <ReceiptText className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
                  Référence
                </dt>
                <dd className="font-semibold font-mono text-foreground">
                  {order.reference}
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-3 items-start">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
                  Email
                </dt>
                <dd className="font-medium text-foreground break-all">{order.email}</dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-3 items-start">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
                  Adresse de livraison
                </dt>
                <dd className="font-medium text-foreground">
                  {addressLines.map((line, index) => (
                    <span key={`${line}-${index}`} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-3 items-start">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
                  Méthode de livraison
                </dt>
                <dd className="font-medium text-foreground">
                  {shippingOption
                    ? `${shippingOption.label} — ${shippingOption.eta}`
                    : order.shippingMethod}
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-3 items-start">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
                  {order.paymentMethod === "mobile_money"
                    ? "Total à régler"
                    : "Total payé"}
                </dt>
                <dd className="font-bold text-[#C9A961]">{priceLabel(order.total)}</dd>
              </div>
            </dl>
            {order.paymentMethod === "mobile_money" && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-foreground/90">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Règlement par Mobile Money : conservez la référence{" "}
                  <strong className="font-mono">{order.reference}</strong> — la
                  boutique vous transmet le numéro marchand et confirme la
                  réception de votre paiement.
                </span>
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-5 max-w-xl">
            Un email de confirmation avec votre récapitulatif a été envoyé à{" "}
            <span className="font-medium text-foreground">{order.email}</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => onNavigate("shop")}
              className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors"
            >
              Continuer mes achats
            </button>
            <button
              type="button"
              onClick={() => onNavigate("tracking")}
              className="inline-flex items-center justify-center gap-2 border border-border bg-card rounded-full px-8 py-3 font-semibold text-foreground hover:border-[#C9A961] hover:text-[#C9A961] transition-colors"
            >
              Suivre ma commande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// États auxiliaires : panier vide + squelette d'hydratation
// ---------------------------------------------------------------------------

interface EmptyCartViewProps {
  onNavigate: (page: string) => void;
}

function EmptyCartView({ onNavigate }: EmptyCartViewProps) {
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
            Parcourez la boutique et ajoutez vos articles préférés pour passer
            commande.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("shop")}
            className="inline-flex items-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            Retour à la boutique
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-10 w-64 bg-muted rounded-full animate-pulse mb-8" />
        <div className="h-12 w-full max-w-md bg-muted rounded-full animate-pulse mb-10" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-muted rounded-2xl animate-pulse" />
          <div className="h-80 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
