"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * IntroSplash — écran d'introduction affiché AVANT l'ouverture du site.
 *
 * - Affiché une seule fois par session (sessionStorage) : le site s'ouvre
 *   normalement ensuite, y compris sur navigation interne.
 * - Durée totale ~2,4 s, bouton « Passer » pour les impatients,
 *   `prefers-reduced-motion` respecté (affichage direct du site).
 * - L'état vit dans un mini-store module (aucun setState dans un effet) et
 *   est lu via useSyncExternalStore → aucun décalage d'hydratation.
 */

const ACTIVE_MS = 2400;
const LEAVE_MS = 550;

type Phase = "idle" | "active" | "leaving" | "gone";

// ── Mini-store module ────────────────────────────────────────────────────
let phase: Phase = "idle";
let initialized = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getPhase(): Phase {
  return phase;
}

function setPhase(next: Phase) {
  phase = next;
  listeners.forEach((l) => l());
}

function finishLeaving() {
  setPhase("gone");
}

function startLeaving() {
  if (phase !== "active") return;
  setPhase("leaving");
  window.setTimeout(finishLeaving, LEAVE_MS);
}

/** Décide UNE seule fois (par chargement du document) si l'intro joue. */
function initIntro() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  let seen = true;
  try {
    seen = window.sessionStorage.getItem("mc_intro_seen") === "1";
  } catch {
    seen = true; // stockage indisponible → pas d'intro
  }
  if (seen) {
    setPhase("gone");
    return;
  }
  try {
    window.sessionStorage.setItem("mc_intro_seen", "1");
  } catch {
    /* noop */
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    setPhase("gone");
    return;
  }

  setPhase("active");
  window.setTimeout(startLeaving, ACTIVE_MS);
}
// ─────────────────────────────────────────────────────────────────────────

const serverSnapshot: Phase = "gone";
const emptySubscribe = () => () => {};

export function IntroSplash() {
  const currentPhase = useSyncExternalStore(
    subscribe,
    getPhase,
    () => serverSnapshot
  );
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    initIntro();
  }, []);

  // Verrouille le scroll pendant l'intro (système externe : <html>).
  const locked = mounted && (currentPhase === "active" || currentPhase === "leaving");
  useEffect(() => {
    if (!locked) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [locked]);

  const skip = useCallback(() => {
    if (currentPhase !== "active") return;
    startLeaving();
  }, [currentPhase]);

  if (!mounted || currentPhase === "idle" || currentPhase === "gone") return null;

  const leaving = currentPhase === "leaving";

  return (
    <div
      role="dialog"
      aria-label="Chargement de MignonciteShop"
      aria-hidden={leaving}
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#0D0B08] transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Halo doré central */}
      <div
        className="intro-halo absolute left-1/2 top-1/2 h-[42vmin] w-[42vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A961]/20 blur-[90px]"
        aria-hidden="true"
      />

      {/* Logo — révélation lettre par lettre */}
      <div className="relative z-10 select-none text-center px-6">
        <p
          className="text-[clamp(1.6rem,6vw,3rem)] font-bold tracking-[0.18em] text-white"
          aria-label="MIGNONCITE SHOP"
        >
          {"MIGNONCITE".split("").map((ch, i) => (
            <span
              key={`a-${i}`}
              aria-hidden="true"
              className="intro-letter inline-block"
              style={{ animationDelay: `${120 + i * 55}ms` }}
            >
              {ch}
            </span>
          ))}
          <span className="intro-shine inline-block" aria-hidden="true">
            {"SHOP".split("").map((ch, i) => (
              <span
                key={`b-${i}`}
                aria-hidden="true"
                className="intro-letter inline-block text-[#C9A961]"
                style={{ animationDelay: `${700 + i * 55}ms` }}
              >
                {ch}
              </span>
            ))}
          </span>
        </p>

        <p
          className="intro-fade-up mt-3 text-[clamp(0.7rem,2.4vw,0.95rem)] font-medium uppercase tracking-[0.35em] text-white/60"
          style={{ animationDelay: "1050ms" }}
        >
          La boutique qui vous ressemble
        </p>
      </div>

      {/* Barre de progression */}
      <div
        className="intro-fade-up relative z-10 mt-10 h-[3px] w-[min(240px,60vw)] overflow-hidden rounded-full bg-white/10"
        style={{ animationDelay: "1150ms" }}
        aria-hidden="true"
      >
        <div className="intro-progress h-full w-full origin-left rounded-full bg-gradient-to-r from-[#C9A961] via-[#e6c87f] to-[#C9A961]" />
      </div>

      {/* Passer */}
      <button
        type="button"
        onClick={skip}
        className="intro-fade-up absolute bottom-8 z-10 rounded-full border border-white/20 px-5 py-2 text-xs font-medium uppercase tracking-widest text-white/50 transition-colors hover:border-[#C9A961]/60 hover:text-[#C9A961]"
        style={{ animationDelay: "1500ms" }}
      >
        Passer
      </button>
    </div>
  );
}
