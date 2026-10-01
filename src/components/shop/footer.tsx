"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface FooterProps {
  onNavigate: (page: string) => void;
  onOpenCookies: () => void;
}

const NAV_LINKS = [
  { label: "Accueil", page: "home" },
  { label: "Boutique", page: "shop" },
  { label: "Catégories", page: "categories" },
  { label: "Promotions", page: "promotions" },
  { label: "À propos", page: "about" },
  { label: "Contact", page: "contact" },
] as const;

const HELP_LINKS: { label: string; page?: string }[] = [
  { label: "Suivi de commande", page: "tracking" },
  { label: "Programme de fidélité" },
  { label: "FAQ", page: "faq" },
  { label: "Guide des tailles", page: "faq" },
  { label: "CGV", page: "cgv" },
  { label: "Confidentialité", page: "privacy" },
];

export function Footer({ onNavigate, onOpenCookies }: FooterProps) {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleNewsletter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (subscribing) return;
    setSubscribing(true);
    try {
      const res = await api.newsletter.subscribe(email);
      toast.success(res.message || "Merci ! Vous êtes bien inscrit(e) à notre newsletter.");
      setEmail("");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue. Merci de réessayer."
      );
    } finally {
      setSubscribing(false);
    }
  };

  const handleLoyalty = () => {
    toast.info("Cette fonctionnalité arrive bientôt !", {
      description: "Programme de fidélité",
    });
  };

  return (
    <footer className="bg-black text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 min-w-0">
            <h3 className="text-2xl font-bold mb-4">
              <span className="text-white">MIGNONCITE</span>
              <span className="text-[#C9A961]">SHOP</span>
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
              Votre destination shopping pour tous vos besoins. Des produits de
              qualité, des prix imbattables et un service client qui vous
              ressemble. Livraison rapide et retours faciles.
            </p>
            <div className="mt-6">
              <p className="text-sm font-semibold text-[#C9A961] uppercase tracking-wider mb-3">
                Newsletter
              </p>
              <form className="flex max-w-sm" onSubmit={handleNewsletter}>
                <input
                  type="email"
                  required
                  placeholder="Votre adresse email"
                  aria-label="Votre adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-11 px-4 rounded-l-full bg-gray-900 border border-gray-800 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C9A961] transition-colors"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="h-11 px-4 rounded-r-full bg-[#C9A961] hover:bg-[#b8994f] text-white transition-colors disabled:opacity-50"
                  aria-label="S'inscrire à la newsletter"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-[#C9A961] mb-4 uppercase text-sm tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-0 text-gray-400 hover:text-[#C9A961] transition-all text-sm"
                    onClick={() => onNavigate(link.page)}
                  >
                    <span className="w-0 group-hover:w-3 overflow-hidden transition-all duration-300 text-[#C9A961]">
                      —
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-300">
                      {link.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-[#C9A961] mb-4 uppercase text-sm tracking-wider">
              Aide &amp; Services
            </h4>
            <ul className="space-y-3">
              {HELP_LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-0 text-gray-400 hover:text-[#C9A961] transition-all text-sm"
                    onClick={() => (link.page ? onNavigate(link.page) : handleLoyalty())}
                  >
                    <span className="w-0 group-hover:w-3 overflow-hidden transition-all duration-300 text-[#C9A961]">
                      —
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-300">
                      {link.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-[#C9A961] mb-4 uppercase text-sm tracking-wider">
              Contact
            </h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-center gap-2">
                <Mail
                  className="w-4 h-4 flex-shrink-0 text-[#C9A961]"
                  aria-hidden="true"
                />
                <a
                  href="mailto:contact@mignonciteshop.com"
                  className="hover:text-white transition-colors break-all"
                >
                  contact@mignonciteshop.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone
                  className="w-4 h-4 flex-shrink-0 text-[#C9A961]"
                  aria-hidden="true"
                />
                +33 1 23 45 67 89
              </li>
              <li className="flex items-center gap-2">
                <MapPin
                  className="w-4 h-4 flex-shrink-0 text-[#C9A961]"
                  aria-hidden="true"
                />
                Paris, France
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-gray-500 text-sm">
          <p>© 2026 MignonciteShop. Tous droits réservés.</p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5">
            <button
              type="button"
              className="hover:text-[#C9A961] transition-colors cursor-pointer underline-offset-2 hover:underline"
              onClick={onOpenCookies}
            >
              Gestion des cookies
            </button>
            <button
              type="button"
              className="hover:text-[#C9A961] transition-colors cursor-pointer underline-offset-2 hover:underline"
              onClick={() => onNavigate("legal")}
            >
              Mentions légales
            </button>
            <p className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
                aria-hidden="true"
              />
              Paiement sécurisé · SSL 256 bits
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
