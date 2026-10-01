"use client";

import { Clock } from "lucide-react";
import type { ReactNode } from "react";

interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  list?: ReactNode[];
}

const SECTIONS: LegalSection[] = [
  {
    id: "objet",
    title: "Objet",
    paragraphs: [
      "Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent l'ensemble des relations contractuelles entre la boutique en ligne MignonciteShop (ci-après « le Vendeur »), dont le siège d'exploitation est établi à Paris, France, et tout consommateur effectuant un achat sur le site www.mignonciteshop.com (ci-après « le Client »).",
      "Toute passation de commande sur le site implique l'acceptation sans réserve des présentes CGV, qui prévalent sur tout autre document. Le Vendeur se réserve le droit de modifier les présentes CGV à tout moment ; les conditions applicables sont celles en vigueur au moment de la validation de la commande.",
      "Le site est destiné aux consommateurs livrés en France métropolitaine. Les commandes destinées à d'autres destinations sont étudiées au cas par cas.",
    ],
  },
  {
    id: "produits",
    title: "Produits",
    paragraphs: [
      "Les produits proposés à la vente sont décrits avec la plus grande exactitude possible : caractéristiques, composition, tailles disponibles et photographies. Les photographies et visuels sont fournis à titre illustratif et n'engagent pas le Vendeur au-delà des caractéristiques essentielles du produit.",
      "Les offres sont valables tant qu'elles sont visibles sur le site, dans la limite des stocks disponibles. En cas d'indisponibilité d'un produit après validation de la commande, le Client en est informé dans les meilleurs délais et est remboursé intégralement dans un délai de 14 jours.",
    ],
  },
  {
    id: "prix",
    title: "Prix",
    paragraphs: [
      "Les prix sont indiqués en euros, toutes taxes comprises (TTC), hors frais de livraison. Les frais de livraison sont précisés avant la validation définitive de la commande.",
      "Le Vendeur se réserve le droit de modifier ses prix à tout moment ; les produits sont facturés au tarif en vigueur au moment de la validation de la commande. Les éventuels codes promotionnels s'appliquent selon leurs conditions d'utilisation, et ne sont pas cumulables sauf mention contraire.",
    ],
  },
  {
    id: "commande",
    title: "Commande",
    paragraphs: [
      "Le Client sélectionne ses articles dans le panier, vérifie le détail et le prix de sa commande, renseigne ses coordonnées de livraison, puis valide le paiement. La commande est confirmée par l'envoi d'un email récapitulatif comportant un numéro de référence au format MC-XXXXXX.",
      "Le Vendeur se réserve le droit de refuser toute commande présentant un caractère anormal, notamment en cas de litige antérieur en cours ou de quantités manifestement anormales.",
    ],
  },
  {
    id: "paiement",
    title: "Paiement sécurisé",
    paragraphs: [
      "Le paiement s'effectue au comptant par carte bancaire au moment de la validation de la commande. Les transactions sont chiffrées grâce au protocole SSL 256 bits ; aucune donnée bancaire n'est stockée sur les serveurs du site.",
      "Le Client n'est débité qu'une seule fois, du montant total de sa commande (produits et livraison), diminué des éventuelles remises applicables. Un justificatif de paiement est disponible sur simple demande auprès du service client.",
    ],
  },
  {
    id: "livraison",
    title: "Livraison",
    paragraphs: [
      "Les commandes sont expédiées sous 24 à 48 heures ouvrées. Les délais de livraison courent à compter de l'expédition et sont exprimés en jours ouvrés. Les formules de livraison proposées sont les suivantes :",
      "Conformément à l'article L216-2 du Code de la consommation, en l'absence de livraison dans un délai de 30 jours suivant la commande, le Client peut résoudre le contrat par lettre recommandée ou par email après mise en demeure restée infructueuse, et obtenir le remboursement intégral des sommes versées.",
      "Le Client est tenu de vérifier l'état du colis à la livraison ; toute anomalie (colis endommagé, article manquant) doit être signalée au service client dans les 48 heures suivant la réception.",
    ],
    list: [
      "Livraison standard : 1 000 FCFA — offerte dès 25 000 FCFA d'achat, 2 à 5 jours ouvrés ;",
      "Livraison express : 2 500 FCFA — 24 à 48 heures ouvrées ;",
      "Livraison en point relais : 500 FCFA — 2 à 5 jours ouvrés.",
    ],
  },
  {
    id: "retractation",
    title: "Droit de rétractation et retours",
    paragraphs: [
      "Conformément aux articles L221-18 et suivants du Code de la consommation, le Client dispose d'un délai légal de 14 jours pour exercer son droit de rétractation. MignonciteShop va au-delà de cette obligation en offrant un délai étendu de 30 jours à compter de la réception du colis.",
      "Pour exercer ce droit, le Client contacte le service client à contact@mignonciteshop.com en indiquant son numéro de commande. Les articles doivent être retournés neufs, non portés ou non utilisés, dans leur emballage d'origine, accompagnés de leurs accessoires et notices.",
      "Le remboursement est effectué sous 14 jours à compter de la réception et du contrôle des articles retournés, sur le moyen de paiement utilisé lors de la commande. Les frais de retour éventuels restent à la charge du Client, sauf stipulation contraire lors de l'achat.",
      "Sont exclus du droit de rétractation, conformément à l'article L221-28 du Code de la consommation, les biens confectionnés selon les spécifications du Client, les biens descellés après livraison pour des raisons d'hygiène (sous-vêtements, boucles d'oreilles) ainsi que les produits périssables.",
    ],
  },
  {
    id: "garanties",
    title: "Garanties légales",
    paragraphs: [
      "Tous les produits bénéficient de la garantie légale de conformité prévue aux articles L217-3 et suivants du Code de la consommation, d'une durée de 2 ans à compter de la délivrance du bien : le Client peut obtenir la réparation ou le remplacement du bien non conforme et, à défaut, une réduction du prix ou la résolution de la vente.",
      "Le Client bénéficie également de la garantie contre les vices cachés prévue aux articles 1641 et suivants du Code civil, qu'il peut mettre en œuvre dans un délai de 2 ans à compter de la découverte du vice.",
      "Pour faire jouer l'une de ces garanties, le Client contacte le service client en décrivant le défaut constaté et en joignant, si possible, des photographies de l'article concerné.",
    ],
  },
  {
    id: "service-client",
    title: "Service client",
    paragraphs: [
      "Le service client de MignonciteShop est joignable par email à contact@mignonciteshop.com et par téléphone au +33 1 23 45 67 89, du lundi au vendredi de 9h à 18h (hors jours fériés). Toute demande fait l'objet d'une réponse sous 24 heures ouvrées.",
      "Le service client accompagne le Client pour toute question relative aux produits, à une commande, à une livraison, à un retour ou à l'exercice de ses garanties légales.",
    ],
  },
  {
    id: "mediation",
    title: "Médiation de la consommation",
    paragraphs: [
      "Conformément à l'article L612-1 du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige relatif à une commande. Les coordonnées du médiateur compétent sont communiquées sur simple demande écrite adressée au service client.",
      "Le Client peut également saisir la plateforme européenne de règlement en ligne des litiges : http://ec.europa.eu/consumers/odr.",
      "Le recours à la médiation ne peut intervenir qu'après avoir tenté en vain de résoudre le litige directement auprès du service client.",
    ],
  },
  {
    id: "droit-applicable",
    title: "Droit applicable et litiges",
    paragraphs: [
      "Les présentes CGV sont soumises au droit français. En cas de litige, le Client s'adresse en priorité au service client afin de rechercher une solution amiable.",
      "À défaut d'accord amiable, les tribunaux français sont seuls compétents, dans les conditions prévues par les articles R631-3 et suivants du Code de la consommation. Si une ou plusieurs stipulations des présentes CGV étaient déclarées nulles ou inapplicables, les autres stipulations conserveraient toute leur force et leur portée.",
      "Les présentes CGV sont rédigées en langue française. En cas de traduction, seule la version française fait foi.",
    ],
  },
];

function SectionCard({ section, index }: { section: LegalSection; index: number }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 bg-card rounded-2xl border p-6 sm:p-8"
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">
        <span className="text-[#C9A961]">Article {index + 1}</span>
        <span className="text-muted-foreground/50 font-normal mx-2" aria-hidden="true">
          —
        </span>
        {section.title}
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
        {section.list && (
          <ul className="space-y-2 pt-1">
            {section.list.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#C9A961]"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TableOfContents() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-32 bg-card rounded-2xl border p-5">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
          Sommaire
        </p>
        <nav aria-label="Sommaire des articles">
          <ul className="space-y-2">
            {SECTIONS.map((section, i) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(section.id)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-left text-sm text-muted-foreground hover:text-[#C9A961] transition-colors"
                >
                  <span className="text-[#C9A961] mr-1.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

export function CgvPage() {
  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <header className="mb-10">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Informations légales
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Conditions Générales de Vente
          </h1>
          <p className="text-muted-foreground max-w-2xl mb-4">
            Les présentes conditions régissent vos achats sur MignonciteShop.
            Merci de les lire attentivement avant toute commande.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-[#C9A961]" aria-hidden="true" />
            Dernière mise à jour : janvier 2026
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10">
          <TableOfContents />
          <div className="min-w-0 max-w-3xl space-y-4">
            {SECTIONS.map((section, i) => (
              <SectionCard key={section.id} section={section} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
