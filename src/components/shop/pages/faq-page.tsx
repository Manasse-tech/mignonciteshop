"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  PackageSearch,
  Ruler,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqEntry {
  question: string;
  answer: string;
}

interface FaqSection {
  id: string;
  title: string;
  icon: LucideIcon;
  entries: FaqEntry[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "livraison-retours",
    title: "Livraison & retours",
    icon: Truck,
    entries: [
      {
        question: "Quels sont les délais et frais de livraison ?",
        answer:
          "Les commandes sont expédiées sous 24 à 48 heures ouvrées. La livraison standard prend 2 à 5 jours ouvrés à 1 000 FCFA. La livraison en point relais est proposée à 500 FCFA et la livraison express à 2 500 FCFA (24 à 48 heures ouvrées).",
      },
      {
        question: "La livraison est-elle offerte ?",
        answer:
          "Oui, la livraison standard est offerte dès 25 000 FCFA d'achat. Le seuil est calculé sur le sous-total de votre panier et s'applique automatiquement à l'étape de récapitulatif, avant le paiement.",
      },
      {
        question: "Comment retourner un article ?",
        answer:
          "Vous disposez de 30 jours après réception pour retourner un article. Contactez notre service client à contact@mignonciteshop.com en précisant votre numéro de commande : nous vous indiquons la procédure et l'adresse de retour. L'article doit être neuf, non porté et dans son emballage d'origine.",
      },
      {
        question: "Quand suis-je remboursé(e) après un retour ?",
        answer:
          "Le remboursement est effectué sous 14 jours après réception et contrôle de l'article retourné, sur le moyen de paiement utilisé lors de la commande. Un email de confirmation vous est envoyé dès le traitement.",
      },
    ],
  },
  {
    id: "paiement-securite",
    title: "Paiement & sécurité",
    icon: ShieldCheck,
    entries: [
      {
        question: "Quels moyens de paiement acceptez-vous ?",
        answer:
          "Nous acceptons les cartes bancaires (Visa, Mastercard, CB). Le paiement est débité une seule fois, au moment de la validation de votre commande, du montant total (produits et livraison) diminué des éventuelles remises.",
      },
      {
        question: "Le paiement est-il sécurisé ?",
        answer:
          "Oui. Toutes les transactions sont chiffrées via un protocole SSL 256 bits. Vos données bancaires sont transmises de manière sécurisée aux prestataires de paiement et ne sont jamais conservées sur nos serveurs.",
      },
      {
        question: "Puis-je payer en plusieurs fois ?",
        answer:
          "Le paiement en plusieurs fois n'est pas disponible pour le moment. Cette option est à l'étude et sera annoncée dans notre newsletter dès son déploiement.",
      },
      {
        question: "Mes données de paiement sont-elles conservées ?",
        answer:
          "Non. Aucun numéro de carte bancaire n'est stocké par MignonciteShop. Seules la référence de la transaction et le montant sont conservés pour la gestion de la commande et d'éventuels retours, conformément à notre politique de confidentialité.",
      },
    ],
  },
  {
    id: "commandes-suivi",
    title: "Commandes & suivi",
    icon: PackageSearch,
    entries: [
      {
        question: "Comment suivre ma commande ?",
        answer:
          "Après validation, vous recevez un email de confirmation contenant votre numéro de commande (au format MC-7F3K2A). Saisissez-le sur notre page « Suivi de commande » pour connaître l'état d'avancement : confirmée, en préparation, expédiée, en livraison ou livrée.",
      },
      {
        question: "Puis-je modifier ou annuler ma commande ?",
        answer:
          "Oui, tant que votre commande n'a pas été expédiée. Contactez-nous le plus tôt possible à contact@mignonciteshop.com ou au +33 1 23 45 67 89 (du lundi au vendredi, 9h-18h) : notre équipe vous répond sous 24 heures ouvrées.",
      },
      {
        question: "Je n'ai pas reçu l'email de confirmation, que faire ?",
        answer:
          "Vérifiez d'abord vos dossiers de courriers indésirables et de spam. Si l'email n'y figure pas, vérifiez l'adresse saisie lors de la commande, puis contactez notre service client qui vérifiera l'enregistrement de votre commande.",
      },
      {
        question: "Un article est manquant ou endommagé, que faire ?",
        answer:
          "Signalez-le-nous sous 48 heures après réception à contact@mignonciteshop.com, avec votre numéro de commande et, si possible, des photos de l'article concerné. Nous procédons au remplacement ou au remboursement, selon votre préférence.",
      },
    ],
  },
  {
    id: "tailles",
    title: "Produits & tailles",
    icon: Ruler,
    entries: [
      {
        question: "Comment choisir la bonne taille ?",
        answer:
          "Chaque fiche produit affiche les tailles disponibles et, pour les vêtements et chaussures, un guide des tailles détaillé (poitrine, taille, hanches en cm). En cas de doute entre deux tailles, choisissez la plus grande. Un échange reste possible sous 30 jours si la taille ne convient pas.",
      },
      {
        question: "Où trouver le guide des tailles ?",
        answer:
          "Le guide des tailles est disponible sur chaque fiche produit concernée, ainsi que dans cette section « Produits & tailles ». Il indique les correspondances entre les tailles FR et les mesures en centimètres, prises à plat.",
      },
      {
        question: "Vos produits sont-ils couverts par une garantie ?",
        answer:
          "Oui. Tous nos produits bénéficient de la garantie légale de conformité de 2 ans (articles L217-3 et suivants du Code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du Code civil).",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_SECTIONS.flatMap((section) =>
    section.entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    }))
  ),
};

interface FaqPageProps {
  /** Optionnel : navigation SPA de l'orchestrateur (fallback : routeur interne). */
  onNavigate?: (page: string) => void;
}

export function FaqPage({ onNavigate }: FaqPageProps) {
  const router = useRouter();
  const navigate =
    onNavigate ??
    ((page: string) =>
      router.push(page === "home" ? "/" : `/?page=${page}`, { scroll: true }));

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <header className="mb-10">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Aide &amp; Informations
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Foire aux questions
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Trouvez rapidement les réponses aux questions les plus fréquentes
            sur vos commandes, la livraison, les paiements et nos produits.
          </p>
        </header>

        {/* Accès rapide aux sections */}
        <nav
          aria-label="Sections de la FAQ"
          className="flex flex-wrap gap-2 mb-10"
        >
          {FAQ_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:border-[#C9A961] hover:text-[#C9A961] transition-colors"
            >
              {section.title}
            </button>
          ))}
        </nav>

        <div className="max-w-3xl space-y-10">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#C9A961]/10 flex items-center justify-center flex-shrink-0">
                  <section.icon
                    className="w-5 h-5 text-[#C9A961]"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {section.title}
                </h2>
              </div>
              <div className="bg-card rounded-2xl border px-5 sm:px-6">
                <Accordion type="single" collapsible>
                  {section.entries.map((entry) => (
                    <AccordionItem
                      key={entry.question}
                      value={entry.question}
                      className="border-border/60 last:border-b-0"
                    >
                      <AccordionTrigger className="py-5 text-sm sm:text-base font-semibold text-foreground hover:no-underline hover:text-[#C9A961] transition-colors">
                        {entry.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-sm text-muted-foreground leading-relaxed">
                        {entry.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          ))}

          {/* CTA */}
          <div className="bg-card rounded-2xl border p-8 sm:p-10 text-center">
            <div className="w-fit mx-auto p-3 bg-[#C9A961]/10 rounded-xl mb-4">
              <MessageCircle
                className="w-6 h-6 text-[#C9A961]"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Une autre question ?
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Notre service client vous répond sous 24 heures ouvrées, du lundi
              au vendredi de 9h à 18h.
            </p>
            <button
              type="button"
              onClick={() => navigate("contact")}
              className="btn-shine bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors"
            >
              Contactez-nous
            </button>
          </div>
        </div>

        {/* Données structurées FAQPage (SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </div>
    </div>
  );
}
