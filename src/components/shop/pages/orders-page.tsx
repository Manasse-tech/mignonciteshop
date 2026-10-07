"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Package, RefreshCw } from "lucide-react";
import { api, type AccountOrder } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { MobileMoneyProof } from "@/components/shop/mobile-money-proof";

const STATUS: Record<string, { label: string; step: number }> = {
  pending: { label: "En attente", step: 0 },
  confirmed: { label: "Confirmée", step: 1 },
  processing: { label: "En préparation", step: 1 },
  shipped: { label: "Expédiée", step: 2 },
  delivered: { label: "Livrée", step: 3 },
  cancelled: { label: "Annulée", step: -1 },
};
const STEPS = ["Reçue", "Confirmée", "Expédiée", "Livrée"];

function price(n: number) {
  return `${n.toLocaleString("fr-FR")} F CFA`;
}

export function OrdersPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.account
      .orders()
      .then((r) => setOrders(r.orders))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erreur de chargement."));
  };
  useEffect(load, []);

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Mes commandes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Toutes les commandes passées avec {user?.email ?? "votre compte"}.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border px-4 py-2 hover:border-[#C9A961]"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {!orders && !error && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {orders && orders.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-6">Vous n&apos;avez pas encore passé de commande.</p>
          <button
            onClick={() => onNavigate("shop")}
            className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold"
          >
            Découvrir la boutique
          </button>
        </div>
      )}

      <div className="space-y-4">
        {orders?.map((o) => {
          const st = STATUS[o.status] ?? { label: o.status, step: 0 };
          const isOpen = open === o.id;
          const unpaidMM = o.paymentStatus !== "paid" && st.step >= 0;
          return (
            <div key={o.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : o.id)}
                className="w-full flex flex-wrap items-center gap-3 justify-between p-5 text-left"
              >
                <div>
                  <p className="font-mono font-semibold">{o.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("fr-FR", { dateStyle: "long" })} ·{" "}
                    {o.items.length} article(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold rounded-full px-3 py-1 ${
                      st.step < 0 ? "bg-destructive/15 text-destructive" : "bg-[#C9A961]/15 text-[#C9A961]"
                    }`}
                  >
                    {st.label}
                  </span>
                  <span
                    className={`text-xs rounded-full px-3 py-1 ${
                      o.paymentStatus === "paid" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.paymentStatus === "paid" ? "Payée" : "Non payée"}
                  </span>
                  <span className="font-bold">{price(o.total)}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {st.step >= 0 && (
                <div className="px-5 pb-4">
                  <div className="flex items-center">
                    {STEPS.map((s, i) => (
                      <div key={s} className="flex-1 flex flex-col items-center relative">
                        <div
                          className={`w-3 h-3 rounded-full z-10 ${i <= st.step ? "bg-[#C9A961]" : "bg-muted"}`}
                        />
                        {i > 0 && (
                          <div
                            className={`absolute top-1.5 right-1/2 w-full h-0.5 ${i <= st.step ? "bg-[#C9A961]" : "bg-muted"}`}
                          />
                        )}
                        <span className="text-[10px] mt-1 text-muted-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isOpen && (
                <div className="border-t border-border/60 p-5 space-y-3">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 text-sm">
                      {it.image && <img src={it.image} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                      <div className="flex-1">
                        <p className="font-medium">{it.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.quantity} × {price(it.unitPrice)}
                          {it.size ? ` · ${it.size}` : ""}
                          {it.color ? ` · ${it.color}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  <dl className="text-sm grid grid-cols-2 gap-1 pt-2 border-t border-border/60">
                    <dt className="text-muted-foreground">Sous-total</dt>
                    <dd className="text-right">{price(o.subtotal)}</dd>
                    {o.discount > 0 && (
                      <>
                        <dt className="text-muted-foreground">Remise</dt>
                        <dd className="text-right">-{price(o.discount)}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Livraison</dt>
                    <dd className="text-right">{price(o.shippingCost)}</dd>
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-right font-bold text-[#C9A961]">{price(o.total)}</dd>
                  </dl>
                  {unpaidMM && <MobileMoneyProof reference={o.reference} onVerified={load} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
