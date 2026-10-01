/**
 * Petit pont de compatibilité : reproduit l'API `next/navigation` utilisée
 * par les composants de la boutique, au-dessus du routeur TanStack.
 */
import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string, opts?: { scroll?: boolean }) => {
        void navigate({ href, resetScroll: opts?.scroll !== false });
      },
      replace: (href: string) => {
        void navigate({ href, replace: true });
      },
      back: () => window.history.back(),
    }),
    [navigate]
  );
}

export function useSearchParams(): URLSearchParams {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}
