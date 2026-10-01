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
    id: "editeur",
    title: "Éditeur du site",
    paragraphs: [
      "Le site www.mignonciteshop.com (ci-après « le Site ») est édité et exploité par MignonciteShop, boutique en ligne dont le siège d'exploitation est établi à Paris, France.",
      "Directeur de la publication : la direction de MignonciteShop.",
      "Les informations complètes relatives à l'entreprise (forme juridique, numéro d'immatriculation, numéro de TVA intracommunautaire) sont disponibles sur simple demande adressée à notre service client.",
    ],
  },
  {
    id: "hebergement",
    title: "Hébergement",
    paragraphs: [
      "Le Site est hébergé par un prestataire professionnel garantissant un haut niveau de disponibilité, de sécurité et de conformité réglementaire. Les coordonnées complètes de l'hébergeur sont communiquées sur simple demande écrite adressée à contact@mignonciteshop.com.",
      "L'hébergement est assuré dans des conditions techniques permettant la continuité du service ; des interruptions programmées de maintenance peuvent toutefois intervenir et sont, autant que possible, annoncées à l'avance.",
    ],
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    paragraphs: [
      "L'ensemble des éléments composant le Site — structure, textes, illustrations, photographies, logos, marques et bases de données — est protégé par le droit de la propriété intellectuelle (droit d'auteur, droit des marques, droit des producteurs de bases de données).",
      "Toute reproduction, représentation, adaptation ou exploitation totale ou partielle du Site, par quelque procédé que ce soit, sans l'autorisation écrite préalable de MignonciteShop, est interdite et constitue une contrefaçon sanctionnée par les articles L335-2 et suivants du Code de la propriété intellectuelle.",
      "Les marques et logos cités sur le Site appartiennent à leurs détenteurs respectifs ; leur mention n'implique aucune appropriation par MignonciteShop.",
    ],
  },
  {
    id: "responsabilite",
    title: "Responsabilité",
    paragraphs: [
      "MignonciteShop s'efforce d'assurer l'exactitude des informations diffusées sur le Site ; celles-ci sont fournies à titre indicatif et peuvent évoluer. La responsabilité de MignonciteShop ne saurait être engagée au titre d'erreurs ou d'omissions éventuelles.",
      "MignonciteShop ne peut être tenu responsable des interruptions temporaires du Site pour cause de maintenance, de force majeure ou de fait d'un tiers, ni des dommages résultant d'une intrusion frauduleuse d'un tiers.",
      "Le Site peut contenir des liens vers des sites externes dont MignonciteShop n'exerce aucun contrôle ; la responsabilité de MignonciteShop ne saurait être engagée au titre du contenu ou des pratiques de ces sites.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "Pour toute question relative aux présentes mentions légales ou au Site, notre équipe reste à votre disposition :",
      "Notre service client vous répond sous 24 heures ouvrées, du lundi au vendredi de 9h à 18h (hors jours fériés).",
    ],
    list: [
      <>
        Email :{" "}
        <a
          href="mailto:contact@mignonciteshop.com"
          className="text-[#C9A961] hover:underline"
        >
          contact@mignonciteshop.com
        </a>
      </>,
      <>Téléphone : +33 1 23 45 67 89 (du lundi au vendredi, 9h-18h) ;</>,
      <>Courrier : MignonciteShop, Paris, France.</>,
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

export function LegalPage() {
  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <header className="mb-10">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Informations légales
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Mentions légales
          </h1>
          <p className="text-muted-foreground max-w-2xl mb-4">
            Les informations légales relatives à l'édition et à l'hébergement du
            site MignonciteShop.
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
