"use client";

import { Gem, HeartHandshake, ShieldCheck, Truck } from "lucide-react";

const VALUES = [
  {
    icon: Gem,
    title: "Excellence",
    description:
      "Chaque produit est sélectionné avec exigence : matériaux nobles, finitions soignées et durabilité garantie.",
  },
  {
    icon: HeartHandshake,
    title: "Service client",
    description:
      "Une équipe dédiée vous accompagne avant, pendant et après votre commande, du lundi au vendredi.",
  },
  {
    icon: Truck,
    title: "Livraison rapide",
    description:
      "Expédition en 48h, livraison suivie et offerte dès 25 000 FCFA d'achat partout en Côte d'Ivoire.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    description:
      "Paiement 100% sécurisé, données chiffrées et retours gratuits sous 30 jours.",
  },
] as const;

const STATS = [
  { value: "10k+", label: "clients satisfaits" },
  { value: "500+", label: "produits" },
  { value: "4.8/5", label: "note moyenne" },
  { value: "48h", label: "livraison" },
] as const;

export function AboutPage() {
  return (
    <div className="bg-background">
      {/* Bandeau titre */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
              À propos de nous
            </p>
            <h1 className="text-4xl font-bold text-foreground">
              L&apos;histoire de MignonciteShop
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Récit */}
        <div className="max-w-3xl mx-auto space-y-4 text-muted-foreground leading-relaxed">
          <p>
            MignonciteShop est une boutique en ligne premium dédiée à offrir
            une expérience d&apos;achat exceptionnelle. Née d&apos;une passion
            pour les objets qui embellissent le quotidien, notre enseigne
            sélectionne avec soin chaque référence de son catalogue : mode,
            électronique, maison &amp; déco et sport &amp; loisirs. Notre
            mission est simple — rendre accessible le meilleur du design et de
            la qualité, sans jamais compromettre le prix juste.
          </p>
          <p>
            La qualité est au cœur de notre démarche. Chaque produit est
            examiné et validé par notre équipe avant d&apos;intégrer la
            boutique. Nous travaillons directement avec des marques et des
            ateliers reconnus afin de garantir des matériaux durables, des
            finitions impeccables et une conformité aux plus hautes exigences.
            Si un article ne nous convainc pas, il ne rejoint pas notre
            sélection.
          </p>
          <p>
            Notre engagement ne s&apos;arrête pas à la vente. Notre service
            client, joignable du lundi au vendredi de 9h à 18h, vous accompagne
            avant, pendant et après votre commande. Livraison suivie en 48h,
            retours gratuits sous 30 jours et paiement 100% sécurisé : nous
            mettons un point d&apos;honneur à ce que chaque étape de votre
            parcours soit sereine et transparente.
          </p>
          <p>
            Enfin, MignonciteShop s&apos;engage pour un commerce plus
            responsable : emballages recyclables, logistique optimisée pour
            réduire notre empreinte carbone et partenaires choisis pour leurs
            pratiques éthiques. Parce qu&apos;acheter doit rester un plaisir —
            pour vous comme pour la planète.
          </p>
        </div>

        {/* Valeurs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {VALUES.map((value) => (
            <div
              key={value.title}
              className="bg-card rounded-2xl border p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-fit p-3 bg-[#C9A961]/10 rounded-xl mb-4">
                <value.icon
                  className="w-6 h-6 text-[#C9A961]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {value.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>

        {/* Chiffres clés */}
        <div className="bg-black rounded-3xl overflow-hidden mt-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 p-10 md:p-14">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-[#C9A961]">
                  {stat.value}
                </p>
                <p className="text-gray-400 text-sm mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
