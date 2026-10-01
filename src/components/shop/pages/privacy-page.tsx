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
    id: "responsable",
    title: "Responsable du traitement",
    paragraphs: [
      "MignonciteShop, boutique en ligne dont l'exploitant est établi à Paris, France, est responsable du traitement des données personnelles collectées via le site www.mignonciteshop.com (ci-après « le Site »).",
      "La présente politique décrit, conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés, la nature des données collectées, leurs finalités, leurs durées de conservation et les droits dont vous disposez.",
    ],
  },
  {
    id: "donnees-collectees",
    title: "Données collectées",
    paragraphs: [
      "Selon l'usage du Site, nous sommes susceptibles de collecter les catégories de données suivantes :",
      "Aucune donnée bancaire n'est conservée sur nos serveurs : les transactions sont traitées par des prestataires de paiement spécialisés.",
    ],
    list: [
      "Compte client : nom, prénom, adresse email, numéro de téléphone ;",
      "Commandes : articles achetés, montants, adresses de facturation et de livraison, historique d'achat ;",
      "Newsletter : adresse email et préférences d'abonnement ;",
      "Cookies et traceurs : identifiants techniques, préférences d'affichage, mesures d'audience (voir la section « Cookies et consentement ») ;",
      "Messages : contenus des échanges avec notre service client.",
    ],
  },
  {
    id: "finalites",
    title: "Finalités et bases légales",
    paragraphs: [
      "Vos données sont traitées pour les finalités suivantes, chacune adossée à une base légale précise :",
    ],
    list: [
      "Exécution du contrat : traitement et suivi des commandes, livraison, retours et remboursements, service après-vente ;",
      "Intérêt légitime : sécurité du Site, prévention de la fraude, amélioration de nos services et statistiques internes ;",
      "Consentement : envoi de la newsletter et dépôt de cookies non essentiels ;",
      "Obligation légale : facturation, conservation des pièces comptables, réponse aux demandes des autorités compétentes.",
    ],
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    paragraphs: [
      "Vos données ne sont conservées que le temps nécessaire à la réalisation des finalités poursuivies :",
      "Au terme de ces durées, les données sont supprimées ou anonymisées de manière irréversible.",
    ],
    list: [
      "Données de compte : durée de la relation commerciale, puis 3 ans après le dernier contact ;",
      "Documents de facturation : 10 ans, conformément aux obligations comptables ;",
      "Cookies : 13 mois au maximum ;",
      "Données de newsletter : jusqu'au retrait du consentement ou au désabonnement.",
    ],
  },
  {
    id: "partage",
    title: "Partage des données",
    paragraphs: [
      "Vos données ne sont jamais vendues, louées ou échangées à des tiers à des fins commerciales. Elles ne sont communiquées qu'aux prestataires strictement nécessaires à l'exécution de votre commande :",
      "Ces prestataires agissent en qualité de sous-traitants et sont liés par des engagements contractuels de confidentialité et de sécurité. Vos données peuvent également être divulguées à une autorité compétente sur réquisition légale.",
    ],
    list: [
      "Transporteurs et points relais, pour la livraison de vos colis (nom, adresse de livraison, numéro de téléphone) ;",
      "Prestataires de paiement, pour la sécurisation des transactions bancaires ;",
      "Hébergeur et prestataires techniques, dans le cadre de l'exploitation du Site.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies et consentement",
    paragraphs: [
      "Le Site utilise des cookies strictement nécessaires à son fonctionnement (gestion du panier, préférences d'affichage, sécurité), qui ne requièrent pas de consentement.",
      "Les cookies de mesure d'audience et de personnalisation ne sont déposés qu'après votre consentement exprès, recueilli via la bannière dédiée. Vous pouvez modifier vos choix à tout moment grâce au bouton « Gestion des cookies » disponible dans le pied de page du Site.",
      "Le retrait du consentement est aussi simple que son octroi et n'affecte pas votre expérience d'achat sur les fonctionnalités essentielles.",
    ],
  },
  {
    id: "droits",
    title: "Vos droits RGPD",
    paragraphs: [
      "Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :",
      "Pour exercer l'un de ces droits, écrivez à contact@mignonciteshop.com en précisant votre demande ; une réponse vous sera apportée dans un délai d'un mois. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).",
    ],
    list: [
      "Droit d'accès : obtenir la confirmation que vos données sont traitées et en recevoir une copie ;",
      "Droit de rectification : faire corriger des données inexactes ou incomplètes ;",
      "Droit à l'effacement : demander la suppression de vos données, dans les limites des obligations légales de conservation ;",
      "Droit à la limitation : demander le gel temporaire d'un traitement ;",
      "Droit à la portabilité : recevoir vos données dans un format structuré, couramment utilisé et lisible par machine ;",
      "Droit d'opposition : vous opposer à tout moment aux traitements fondés sur l'intérêt légitime ou le consentement, notamment la prospection commerciale.",
    ],
  },
  {
    id: "securite",
    title: "Sécurité",
    paragraphs: [
      "Le Site est intégralement servi en HTTPS et toutes les communications sont chiffrées au moyen du protocole SSL 256 bits.",
      "Nous mettons en œuvre des mesures techniques et organisationnelles adaptées : chiffrement des mots de passe (bcrypt), accès restreints et nominatifs aux données, journalisation, sauvegardes régulières et sensibilisation des équipes.",
      "En cas de violation de données susceptible d'engendrer un risque élevé pour vos droits et libertés, nous vous en informerions sans délai injustifié, ainsi que la CNIL conformément aux articles 33 et 34 du RGPD.",
    ],
  },
  {
    id: "dpo",
    title: "DPO et contact",
    paragraphs: [
      "Une question sur la présente politique ou sur vos données ? Notre référent à la protection des données est joignable :",
    ],
    list: [
      <>
        Par email :{" "}
        <a
          href="mailto:contact@mignonciteshop.com"
          className="text-[#C9A961] hover:underline"
        >
          contact@mignonciteshop.com
        </a>{" "}
        — réponse sous 24 heures ouvrées ;
      </>,
      <>Par téléphone : +33 1 23 45 67 89 (du lundi au vendredi, 9h-18h) ;</>,
      <>Par courrier : MignonciteShop — Protection des données, Paris, France.</>,
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
        <span className="text-[#C9A961]">{index + 1}</span>
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
        <nav aria-label="Sommaire des sections">
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

export function PrivacyPage() {
  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <header className="mb-10">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Confidentialité
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Politique de confidentialité
          </h1>
          <p className="text-muted-foreground max-w-2xl mb-4">
            Comment MignonciteShop collecte, utilise et protège vos données
            personnelles, conformément au RGPD.
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
