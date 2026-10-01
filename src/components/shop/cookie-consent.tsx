"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mignoncite-cookie-consent";
const CONSENT_EVENT = "mignoncite-cookie-consent-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_EVENT, callback);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

interface CookieConsentProps {
  /** Rouvrir la bannière (bouton « Gestion des cookies » du footer). */
  forceOpen?: boolean;
  onForceClose?: () => void;
}

export function CookieConsent({ forceOpen, onForceClose }: CookieConsentProps) {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const visible = consent === "" || forceOpen === true;

  const choose = (value: "accepted" | "refused" | "custom") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* stockage indisponible */
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
    if (value === "custom") {
      toast.info("Préférences cookies enregistrées");
    }
    if (forceOpen) onForceClose?.();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Consentement aux cookies"
      className="fixed bottom-0 left-0 right-0 z-[70] animate-fade-up"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="hidden sm:flex w-10 h-10 rounded-full bg-[#C9A961]/15 items-center justify-center flex-shrink-0">
                <Cookie
                  className="w-5 h-5 text-[#C9A961]"
                  aria-hidden="true"
                />
              </span>
              <p className="text-sm text-foreground/90 leading-relaxed min-w-0">
                <span className="font-semibold">
                  Nous respectons votre vie privée.
                </span>{" "}
                Nous utilisons des cookies pour le fonctionnement du site
                (panier, session) et, avec votre accord, pour mesurer
                l&apos;audience et améliorer votre expérience.{" "}
                <button
                  type="button"
                  className="text-[#C9A961] underline underline-offset-2 hover:text-[#b8994f] cursor-pointer"
                  onClick={() =>
                    toast.info("Politique de cookies — bientôt disponible !")
                  }
                >
                  En savoir plus
                </button>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 flex-shrink-0">
              <Button variant="outline" onClick={() => choose("refused")}>
                Tout refuser
              </Button>
              <Button variant="outline" onClick={() => choose("custom")}>
                Personnaliser
              </Button>
              <Button
                className="bg-[#C9A961] text-white hover:bg-[#b8994f] hover:text-white"
                onClick={() => choose("accepted")}
              >
                Tout accepter
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
