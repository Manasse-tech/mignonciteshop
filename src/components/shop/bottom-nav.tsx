"use client";

import { Home, Search, Sun, Moon, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Barre de navigation inférieure — mobile uniquement (lg:hidden).
 *
 * Hiérarchie de navigation (aucun doublon avec le header, cf. mission §2) :
 *  - HEADER mobile  : logo · panier · hamburger
 *  - BOTTOM NAV     : Accueil · Recherche · Mode nuit · Compte
 *  - HEADER desktop : logo · liens · recherche/thème/favoris/compte/panier
 *
 * Le hamburger vit UNIQUEMENT dans le header ; les actions de la bottom nav
 * n'apparaissent jamais dans le header mobile (et inversement).
 * 4 items · hauteur ~56px + safe-area-inset-bottom (encoches iOS).
 * Item actif : doré #C9A961 (identité MIGNONCITESHOP).
 */

const emptySubscribe = () => () => {};

interface BottomNavProps {
  active: string;
  onNavigate: (page: string) => void;
  onSearch: () => void;
}

export function BottomNav({ active, onNavigate, onSearch }: BottomNavProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { user, ready, hydrate } = useAuthStore();

  // Session vérifiée une seule fois au montage (état Firebase global).
  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  const isDark = mounted && resolvedTheme === "dark";

  const handleAccount = () => {
    // Non connecté → page de connexion (le retour est géré par RequireAuth).
    onNavigate(user ? "account" : "login");
  };

  const items = [
    {
      key: "home",
      label: "Accueil",
      icon: Home,
      active: active === "home",
      onClick: () => onNavigate("home"),
    },
    {
      key: "search",
      label: "Recherche",
      icon: Search,
      active: false,
      onClick: onSearch,
    },
    {
      key: "theme",
      label: isDark ? "Mode jour" : "Mode nuit",
      icon: isDark ? Sun : Moon,
      active: false,
      onClick: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      key: "account",
      label: user ? "Compte" : "Connexion",
      icon: User,
      active: active === "account" || active === "login",
      badge: Boolean(user),
      onClick: handleAccount,
    },
  ];

  return (
    <nav
      aria-label="Navigation mobile"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/70 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <ul className="grid grid-cols-4 h-14">
        {items.map((item) => {
          const activeItem = item.active;
          return (
            <li key={item.key} className="min-w-0">
              <button
                type="button"
                aria-current={activeItem ? "page" : undefined}
                onClick={item.onClick}
                className={`relative w-full h-full flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  activeItem
                    ? "text-[#C9A961]"
                    : "text-muted-foreground active:text-[#C9A961]"
                }`}
              >
                {activeItem && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#C9A961]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  {/* Point doré : session active (compte connecté). */}
                  {item.key === "account" && item.badge && (
                    <span
                      className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-[#C9A961]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none truncate max-w-full">
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
