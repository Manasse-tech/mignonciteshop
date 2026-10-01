"use client";

import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";

const ADVANTAGES = [
  { icon: Truck, title: "Livraison Gratuite", subtitle: "À partir de 25 000 FCFA" },
  { icon: ShieldCheck, title: "Paiement Sécurisé", subtitle: "100% sécurisé" },
  { icon: RotateCcw, title: "Retour Facile", subtitle: "30 jours" },
  { icon: Headphones, title: "Support 24/7", subtitle: "Assistance dédiée" },
] as const;

export function Advantages() {
  return (
    <section id="avantages" className="py-12 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {ADVANTAGES.map((item) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className="p-3 bg-[#C9A961]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <item.icon
                  className="w-6 h-6 text-[#C9A961]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
