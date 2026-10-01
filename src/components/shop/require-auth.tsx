"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

const AFTER_LOGIN_KEY = "mc_after_login";

/** Mémorise la page demandée pour y revenir après connexion. */
export function rememberAfterLogin(): void {
  try {
    window.sessionStorage.setItem(AFTER_LOGIN_KEY, window.location.search || "/");
  } catch {
    /* stockage indisponible : tant pis, retour accueil */
  }
}

/** Lit et consomme la mémorisation de retour après connexion. */
export function consumeAfterLogin(): string | null {
  try {
    const value = window.sessionStorage.getItem(AFTER_LOGIN_KEY);
    window.sessionStorage.removeItem(AFTER_LOGIN_KEY);
    return value;
  } catch {
    return null;
  }
}

interface RequireAuthProps {
  children: ReactNode;
  /** Libellé lisible de l'espace protégé (ex. « panier », « favoris »). */
  label: string;
}

/**
 * RequireAuth — garde client :
 * tant que l'utilisateur n'est pas connecté, la page protégée l'informe et
 * le redirige automatiquement vers la page « Se connecter » de l'app.
 * Après connexion, il revient automatiquement sur la page demandée.
 */
export function RequireAuth({ children, label }: RequireAuthProps) {
  const router = useRouter();
  const { user, ready, hydrate } = useAuthStore();

  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  useEffect(() => {
    if (ready && !user) {
      rememberAfterLogin();
      toast.info(`Connectez-vous pour accéder à votre ${label}.`);
      router.push("/?page=login");
    }
  }, [ready, user, label, router]);

  if (!ready || !user) {
    return (
      <div className="flex-1 flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
        Vérification de la session…
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Variante utilisée dans la page de connexion : à l'ouverture, si une page
 * protégée avait été demandée avant redirection, on en informe l'utilisateur.
 */
export function LoginReturnNotice() {
  const target = consumeAfterLogin();
  if (!target) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#C9A961]/30 bg-[#C9A961]/5 px-4 py-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A961]" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        Connectez-vous pour accéder à la page demandée — vous y serez redirigé
        automatiquement après connexion.
      </p>
    </div>
  );
}
