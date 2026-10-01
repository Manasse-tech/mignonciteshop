"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Loader2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { TrackedOrder } from "@/lib/api";
import { formatPrice } from "@/lib/format";

interface TrackingPageProps {
  /** Optionnel : navigation SPA de l'orchestrateur (fallback : routeur interne). */
  onNavigate?: (page: string) => void;
}

type StepState = "done" | "current" | "pending";

const STATUS_LABELS: Record<string, string> = {
  pending: "En préparation",
  paid: "Payée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

/** Étapes de suivi dans l'ordre — la progression dérive du statut réel serveur. */
const STEP_DEFS: { status: string; label: string; description: string }[] = [
  {
    status: "pending",
    label: "Commande confirmée",
    description: "Votre commande a été enregistrée et est en cours de préparation.",
  },
  {
    status: "paid",
    label: "Paiement confirmé",
    description: "Votre paiement a été accepté — votre colis part très vite.",
  },
  {
    status: "shipped",
    label: "Expédiée",
    description: "Votre colis a été remis au transporteur.",
  },
  {
    status: "delivered",
    label: "Livrée",
    description: "Votre colis a été livré. Nous espérons qu'il vous plaira.",
  },
];

function buildSteps(status: string): { label: string; description: string; state: StepState }[] {
  // Commande annulée → timeline figée avec un message dédié.
  if (status === "cancelled") {
    return STEP_DEFS.map((step) => ({ ...step, state: "pending" as StepState }));
  }
  const currentIndex = STEP_DEFS.findIndex((step) => step.status === status);
  return STEP_DEFS.map((step, index) => ({
    label: step.label,
    description: step.description,
    state:
      index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A961]">
        <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span
          className="absolute h-6 w-6 rounded-full bg-[#C9A961]/30 animate-ping"
          aria-hidden="true"
        />
        <span className="relative h-3 w-3 rounded-full bg-[#C9A961]" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="h-6 w-6 rounded-full border-2 border-border bg-muted" aria-hidden="true" />
  );
}

export function TrackingPage({ onNavigate }: TrackingPageProps) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate =
    onNavigate ??
    ((page: string) =>
      router.push(page === "home" ? "/" : `/?page=${page}`, { scroll: true }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    const ref = reference.trim().toUpperCase();
    const mail = email.trim().toLowerCase();
    if (!ref || !mail) return;
    setLoading(true);
    setNotFound(false);
    try {
      const result = await api.track(ref, mail);
      setOrder(result.order);
    } catch {
      setOrder(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const steps = order ? buildSteps(order.status) : null;

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <header className="mb-10 text-center">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Aide &amp; Informations
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Suivi de commande
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Entrez votre numéro de commande et l&apos;email utilisé lors de
            l&apos;achat pour consulter l&apos;état réel de votre colis.
          </p>
        </header>

        {/* Formulaire de suivi */}
        <div className="max-w-xl mx-auto">
          <div className="bg-card rounded-2xl border p-6 sm:p-8 shadow-sm">
            <div className="w-fit p-3 bg-[#C9A961]/10 rounded-xl mb-5">
              <PackageSearch className="w-6 h-6 text-[#C9A961]" aria-hidden="true" />
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="order-reference"
                  className="text-sm font-medium text-foreground"
                >
                  Numéro de commande
                </Label>
                <Input
                  id="order-reference"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="ex : MC-7F3K2A"
                  autoComplete="off"
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="order-email"
                  className="text-sm font-medium text-foreground"
                >
                  Email de la commande
                </Label>
                <Input
                  id="order-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  className="h-12 rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ces informations figurent dans votre email de confirmation —
                  la double vérification protège vos commandes.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-shine w-full inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-6 h-12 font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PackageSearch className="w-4 h-4" aria-hidden="true" />
                )}
                {loading ? "Recherche…" : "Suivre ma commande"}
              </button>
            </form>
          </div>
        </div>

        {/* Commande introuvable */}
        {notFound && (
          <div className="max-w-xl mx-auto mt-8 animate-fade-up">
            <div className="bg-card rounded-2xl border border-red-200 dark:border-red-900 p-6 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                Aucune commande trouvée
              </p>
              <p className="text-xs text-muted-foreground">
                Vérifiez la référence (format MC-XXXXXX) et l&apos;email utilisé
                lors de la commande.
              </p>
            </div>
          </div>
        )}

        {/* Résultat : statut réel depuis le serveur */}
        {order && steps && (
          <div className="max-w-xl mx-auto mt-8 animate-fade-up">
            <div className="bg-card rounded-2xl border p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-8">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                    Commande
                  </p>
                  <p className="text-lg font-bold text-foreground">{order.reference}</p>
                </div>
                <span className="rounded-full bg-[#C9A961]/10 text-[#C9A961] text-xs font-semibold px-3.5 py-1.5">
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              {order.status === "cancelled" && (
                <p className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                  Cette commande a été annulée. Si le paiement avait été
                  encaissé, le remboursement a été effectué.
                </p>
              )}

              <ol>
                {steps.map((step, i) => (
                  <li key={step.label} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < steps.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-7 bottom-0 w-0.5 ${
                          step.state === "done" ? "bg-[#C9A961]/50" : "bg-border"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <StepIcon state={step.state} />
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-semibold ${
                          step.state === "pending"
                            ? "text-muted-foreground"
                            : step.state === "current"
                              ? "text-[#C9A961]"
                              : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Articles + montants (données réelles serveur) */}
              <div className="mt-6 border-t pt-5">
                <ul className="space-y-2 mb-4">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      <span className="flex-1 min-w-0 font-medium text-foreground truncate">
                        {item.quantity}× {item.productName}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm font-bold text-foreground border-t pt-3">
                  <span>Total TTC</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>

              <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/80 leading-relaxed">
                <Info
                  className="w-4 h-4 flex-shrink-0 text-[#C9A961]"
                  aria-hidden="true"
                />
                Statut mis à jour en temps réel par notre équipe logistique.
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-8">
          Besoin d&apos;aide ?{" "}
          <button
            type="button"
            onClick={() => navigate("contact")}
            className="font-medium text-[#C9A961] hover:underline underline-offset-2"
          >
            Contactez-nous
          </button>
        </p>
      </div>
    </div>
  );
}
