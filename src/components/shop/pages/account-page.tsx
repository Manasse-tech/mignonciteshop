"use client";

import { useEffect, useState } from "react";
import {
  Gift,
  History,
  Loader2,
  Lock,
  LogOut,
  Package,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { AccountOrder, LoyaltyResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En préparation", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  shipped: { label: "Expédiée", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  delivered: { label: "Livrée", className: "bg-[#C9A961]/15 text-[#a8873f] dark:text-[#C9A961]" },
  cancelled: { label: "Annulée", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

/** Étapes de suivi (barre de progression). */
const STATUS_STEPS = ["pending", "paid", "shipped", "delivered"] as const;

function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
        Commande annulée — le stock a été restitué et le paiement remboursé s'il
        avait été encaissé.
      </p>
    );
  }
  const currentIndex = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progression de la commande">
      {STATUS_STEPS.map((step, index) => {
        const done = index <= currentIndex;
        const label =
          step === "pending" ? "Préparée" : step === "paid" ? "Payée" : step === "shipped" ? "Expédiée" : "Livrée";
        return (
          <li key={step} className="flex-1 min-w-0">
            <div
              className={cn("h-1.5 rounded-full", done ? "bg-[#C9A961]" : "bg-muted")}
              aria-hidden="true"
            />
            <p
              className={cn(
                "mt-1 text-[10px] leading-tight",
                done ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const LOYALTY_TX_LABELS: Record<string, string> = {
  earn: "Gagné",
  redeem: "Échangé",
  adjust: "Ajustement",
  expire: "Expiré",
};

/**
 * Carte de fidélité — solde, palier, progression et historique.
 * Données réelles du backend (GET /api/loyalty, session requise).
 */
function LoyaltyCard({ loyalty }: { loyalty: LoyaltyResponse | null }) {
  if (!loyalty) return null;
  const { account, nextTier, transactions, rules } = loyalty;

  return (
    <section
      id="fidelite"
      className="bg-card rounded-2xl border p-6 scroll-mt-28"
      aria-label="Carte de fidélité"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
            Carte de fidélité
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            1 point par {rules.pointsPerSpent} F CFA dépensés · 100 points =
            {" "}
            {rules.fcfaPer100Points} F CFA de remise (prochainement au
            checkout).
          </p>
        </div>
        <Badge className="bg-[#C9A961]/15 text-[#a8873f] dark:text-[#C9A961] text-xs gap-1">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          Palier {account.tierLabel}
        </Badge>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
        <div>
          <p className="text-4xl font-bold text-foreground">
            {account.points.toLocaleString("fr-FR")}
            <span className="ml-1.5 text-base font-medium text-muted-foreground">
              points
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cumul historique : {account.lifetimePoints.toLocaleString("fr-FR")}{" "}
            points
          </p>

          {/* Progression vers le palier suivant */}
          <div className="mt-4">
            {nextTier ? (
              <>
                <div
                  className="h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={nextTier.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progression vers le palier ${nextTier.label}`}
                >
                  <div
                    className="h-full rounded-full bg-[#C9A961] transition-all"
                    style={{ width: `${Math.max(3, nextTier.progress)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Encore{" "}
                  <strong className="text-foreground">
                    {nextTier.pointsRemaining.toLocaleString("fr-FR")}
                  </strong>{" "}
                  points cumulés pour le palier {nextTier.label}.
                </p>
              </>
            ) : (
              <p className="text-xs font-medium text-[#a8873f] dark:text-[#C9A961]">
                Palier maximum atteint — merci pour votre fidélité !
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground text-sm mb-1.5">
            Comment ça marche ?
          </p>
          Chaque commande passée avec votre compte créditée automatiquement
          vos points (aucune action requise). Bonus de palier : ×1 (Bronze),
          ×1,1 (Argent dès 5 000 pts cumulés), ×1,25 (Or dès 20 000 pts).
        </div>
      </div>

      {/* Historique — 20 dernières transactions (serveur) */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-3">
          <History className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
          Dernières transactions
        </h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune transaction pour le moment — passez votre première commande
            pour cumuler des points.
          </p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1 admin-scroll">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm"
              >
                <span
                  className={cn(
                    "font-semibold shrink-0 w-16 text-right",
                    tx.points >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {tx.points >= 0 ? "+" : ""}
                  {tx.points}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground truncate">
                    {LOYALTY_TX_LABELS[tx.type] ?? tx.type}
                    {tx.reason.startsWith("order:") && (
                      <span className="text-muted-foreground font-mono text-xs">
                        {" "}
                        · {tx.reason.replace("order:", "cmd ")}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function AccountPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user, ready, hydrate, logout } = useAuthStore();
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  // Chargement des commandes dès qu'une session client est identifiée.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.account
      .orders()
      .then((result) => {
        if (!cancelled) setOrders(result.orders);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Carte de fidélité (backend réel) — silencieux si indisponible.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.loyalty
      .get()
      .then((data) => {
        if (!cancelled) setLoyalty(data);
      })
      .catch(() => {
        if (!cancelled) setLoyalty(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Le bouton Gift du header pose ce drapeau avant de naviguer :
  // on défile alors vers la carte de fidélité.
  useEffect(() => {
    if (!ready || !user) return;
    if (sessionStorage.getItem("mc_scroll_fidelite") !== "1") return;
    sessionStorage.removeItem("mc_scroll_fidelite");
    const timer = window.setTimeout(() => {
      document
        .getElementById("fidelite")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ready, user]);

  // Non connecté → invitation à se connecter.
  if (ready && !user) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="w-full max-w-md bg-card rounded-2xl border p-8 text-center">
          <div className="rounded-full bg-[#C9A961]/10 p-4 w-fit mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#C9A961]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Mon compte
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Connectez-vous pour retrouver l&apos;historique de vos commandes,
            suivre leurs livraisons et gérer vos données personnelles.
          </p>
          <Button
            onClick={() => onNavigate("login")}
            className="w-full rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white py-3 font-semibold"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="flex-1 flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
        Chargement du compte…
      </div>
    );
  }

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await api.account.deleteAccount();
      toast.success(result.message);
      await logout();
      onNavigate("home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* En-tête compte */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-[#C9A961]/10 p-3">
              <User className="w-7 h-7 text-[#C9A961]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Bonjour {user.name ?? "cher client"}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              onNavigate("home");
            }}
            className="rounded-full gap-2"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Déconnexion
          </Button>
        </header>

        {/* Carte de fidélité (points réels crédités à chaque commande) */}
        <LoyaltyCard loyalty={loyalty} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Historique des commandes */}
          <section className="lg:col-span-2 bg-card rounded-2xl border p-6" aria-label="Historique des commandes">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
              Mes commandes
            </h2>

            {orders === null ? (
              <div className="py-12 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
                Chargement…
              </div>
            ) : orders.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-muted-foreground text-sm mb-4">
                  Vous n&apos;avez pas encore de commande. Découvrez notre
                  sélection !
                </p>
                <Button
                  onClick={() => onNavigate("shop")}
                  className="rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white"
                >
                  Aller à la boutique
                </Button>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[32rem] overflow-y-auto pr-1 admin-scroll">
                {orders.map((order) => {
                  const badge = STATUS_LABELS[order.status] ?? {
                    label: order.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  return (
                    <li key={order.id} className="rounded-xl border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                        className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                        aria-expanded={expanded === order.id}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-mono font-semibold text-foreground text-sm">
                            {order.reference}
                          </span>
                          <Badge className={cn("text-[10px]", badge.className)}>
                            {badge.label}
                          </Badge>
                          <span className="ml-auto font-semibold text-foreground">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          · {order.items.length} article{order.items.length > 1 ? "s" : ""}
                        </p>
                        <StatusTimeline status={order.status} />
                      </button>

                      {expanded === order.id && (
                        <div className="border-t bg-muted/20 p-4 space-y-3">
                          <ul className="space-y-2">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex items-center gap-3 text-sm">
                                {/* Image de la ligne (snapshot commande) */}
                                <span className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                                  <img
                                    src={item.image}
                                    alt={item.productName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block font-medium text-foreground truncate">
                                    {item.productName}
                                    {(item.size || item.color) && (
                                      <span className="text-muted-foreground font-normal">
                                        {" "}
                                        ({[item.size, item.color].filter(Boolean).join(", ")})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Quantité : {item.quantity}
                                  </span>
                                </span>
                                <span className="font-medium shrink-0">
                                  {formatPrice(item.unitPrice * item.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="text-sm space-y-1 border-t pt-3">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Sous-total</span>
                              <span>{formatPrice(order.subtotal)}</span>
                            </div>
                            {order.discount > 0 && (
                              <div className="flex justify-between text-[#a8873f] dark:text-[#C9A961]">
                                <span>Remise {order.promoCode ? `(${order.promoCode})` : ""}</span>
                                <span>-{formatPrice(order.discount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>Livraison</span>
                              <span>
                                {order.shippingCost === 0 ? "Offerte" : formatPrice(order.shippingCost)}
                              </span>
                            </div>
                            <div className="flex justify-between font-bold text-foreground">
                              <span>Total TTC</span>
                              <span>{formatPrice(order.total)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Données personnelles (RGPD) */}
          <section className="bg-card rounded-2xl border p-6 space-y-5 self-start" aria-label="Données personnelles">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
              Mes données personnelles
            </h2>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground text-red-600 dark:text-red-400">
                Supprimer mon compte
              </h3>
              <p className="text-xs text-muted-foreground">
                Efface définitivement votre profil et vos préférences. Vos
                commandes sont conservées (obligation comptable), sans aucune
                réutilisation — article 17 RGPD.
              </p>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Supprimer mon compte
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation de suppression (irréversible) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement votre compte ?</DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong> : votre profil et
              vos préférences seront effacés. Vous serez immédiatement
              déconnecté(e). Vos commandes passées seront conservées
              (obligation comptable).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Suppression…" : "Oui, supprimer mon compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
