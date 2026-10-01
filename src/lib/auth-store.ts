"use client";

/**
 * Store d'authentification global — Firebase Authentication (UNIQUE backend).
 *
 * - L'état de session vient de `onAuthStateChanged` (source de vérité Firebase).
 * - Le profil (nom, rôle) vit dans Firestore `users/{uid}` — le rôle admin est
 *   vérifié par les Security Rules, jamais par simple masquage d'interface.
 * - `hydrate()` reste disponible pour compatibilité : il attend simplement le
 *   premier état Firebase.
 */

import { create } from "zustand";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { fbAuth, fbDb, friendlyFirebaseError } from "@/lib/firebase";

export interface AuthUser {
  id: string; // uid Firebase
  name: string | null;
  email: string;
  role: string; // customer | admin
}

interface AuthState {
  user: AuthUser | null;
  /** true après le premier état de session Firebase. */
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  /** Attend le premier état de session (idempotent). */
  hydrate: () => Promise<void>;
  /** Déconnexion Firebase + réinitialisation de l'état. */
  logout: () => Promise<void>;

  registerWithEmail: (name: string, email: string, password: string) => Promise<AuthUser>;
  loginWithEmail: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  sendPasswordReset: (email: string) => Promise<void>;
  /**
   * Geste secret (7 taps) — premier admin : crée le compte puis l'enregistre
   * comme administrateur ; ensuite : simple connexion admin.
   */
  claimAdmin: (email: string, password: string) => Promise<{ created: boolean; user: AuthUser }>;
}

/* ------------------------------------------------------------------------- */
/* Profil Firestore                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Course contre la montre : si Firestore est injoignable (API désactivée,
 * réseau coupé), les promesses Firestore peuvent rester PENDING sans jamais
 * rejeter. Sans ce garde-fou, l'utilisateur resterait bloqué sur
 * « Connexion... » indéfiniment. Après expiration, on continue avec un profil
 * minimal dérivé du compte Firebase Auth (le doc users/{uid} sera créé à la
 * prochaine session réussie une fois Firestore disponible).
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} : délai dépassé (Firestore injoignable).`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const FIRESTORE_TIMEOUT_MS = 8000;

async function fetchProfile(fbUser: FirebaseUser): Promise<AuthUser> {
  const ref = doc(fbDb(), "users", fbUser.uid);
  const snap = await withTimeout(
    getDoc(ref),
    FIRESTORE_TIMEOUT_MS,
    "Lecture du profil"
  );
  if (snap.exists()) {
    const data = snap.data() as { name?: string | null; email?: string; role?: string };
    return {
      id: fbUser.uid,
      name: data.name ?? fbUser.displayName ?? null,
      email: data.email ?? fbUser.email ?? "",
      role: data.role === "admin" ? "admin" : "customer",
    };
  }
  // Profil absent (ex: compte créé via Google avant la migration) → création.
  const profile: AuthUser = {
    id: fbUser.uid,
    name: fbUser.displayName ?? null,
    email: fbUser.email ?? "",
    role: "customer",
  };
  await withTimeout(
    setDoc(
      ref,
      {
        uid: fbUser.uid,
        name: profile.name ?? "",
        email: profile.email,
        role: "customer",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ),
    FIRESTORE_TIMEOUT_MS,
    "Création du profil"
  );
  return profile;
}

async function ensureProfile(fbUser: FirebaseUser): Promise<AuthUser> {
  return fetchProfile(fbUser);
}

/** L'app a-t-elle déjà un administrateur ? (doc settings/public.adminExists) */
export async function adminExists(): Promise<boolean> {
  try {
    const snap = await withTimeout(
      getDoc(doc(fbDb(), "settings", "public")),
      FIRESTORE_TIMEOUT_MS,
      "Vérification administrateur"
    );
    return snap.exists() && snap.data().adminExists === true;
  } catch {
    return false; // Firestore indisponible → mode connexion (pas de création)
  }
}

/* ------------------------------------------------------------------------- */
/* Abonnement global à l'état Firebase (démarré une seule fois)               */
/* ------------------------------------------------------------------------- */

let unsubscribe: (() => void) | null = null;
let firstState: Promise<void> | null = null;

function startAuthListener(set: (partial: Partial<AuthState>) => void): Promise<void> {
  if (firstState) return firstState;
  firstState = new Promise<void>((resolve) => {
    unsubscribe = onAuthStateChanged(
      fbAuth(),
      async (fbUser) => {
        if (!fbUser) {
          set({ user: null, ready: true });
          resolve();
          return;
        }
        try {
          const profile = await ensureProfile(fbUser);
          set({ user: profile, ready: true });
        } catch {
          // Firestore injoignable : session Auth valable, profil minimal.
          set({
            user: {
              id: fbUser.uid,
              name: fbUser.displayName ?? null,
              email: fbUser.email ?? "",
              role: "customer",
            },
            ready: true,
          });
        }
        resolve();
      },
      () => {
        set({ user: null, ready: true });
        resolve();
      }
    );
  });
  // Restauration d'un flux Google signInWithRedirect (popup bloquée).
  void getRedirectResult(fbAuth()).catch(() => undefined);
  return firstState;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  setUser: (user) => set({ user, ready: true }),

  hydrate: () => startAuthListener(set),

  logout: async () => {
    try {
      await signOut(fbAuth());
    } catch {
      // État réinitialisé dans tous les cas.
    }
    set({ user: null, ready: true });
  },

  registerWithEmail: async (name, email, password) => {
    try {
      const cred = await createUserWithEmailAndPassword(fbAuth(), email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      const profile: AuthUser = {
        id: cred.user.uid,
        name: name.trim() || null,
        email: cred.user.email ?? email.trim(),
        role: "customer",
      };
      try {
        // Le profil Firestore peut échouer (service momentanément indisponible)
        // sans invalider le compte : le doc users/{uid} sera créé à la
        // prochaine session via ensureProfile.
        await withTimeout(
          setDoc(
            doc(fbDb(), "users", cred.user.uid),
            {
              uid: cred.user.uid,
              name: profile.name ?? "",
              email: profile.email,
              role: "customer",
              createdAt: serverTimestamp(),
            },
            { merge: true }
          ),
          FIRESTORE_TIMEOUT_MS,
          "Création du profil"
        );
      } catch {
        // Compte créé — profil synchronisé plus tard.
      }
      set({ user: profile, ready: true });
      return profile;
    } catch (error) {
      throw new Error(friendlyFirebaseError(error));
    }
  },

  loginWithEmail: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
      let profile: AuthUser;
      try {
        profile = await ensureProfile(cred.user);
      } catch {
        // Session Firebase valable mais Firestore injoignable → profil
        // minimal (rôle client par défaut, resynchronisé plus tard).
        profile = {
          id: cred.user.uid,
          name: cred.user.displayName ?? null,
          email: cred.user.email ?? email.trim(),
          role: "customer",
        };
      }
      set({ user: profile, ready: true });
      return profile;
    } catch (error) {
      throw new Error(friendlyFirebaseError(error));
    }
  },

  loginWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await signInWithPopup(fbAuth(), provider);
      const profile = await ensureProfile(cred.user);
      set({ user: profile, ready: true });
      return profile;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      // Popup bloquée → bascule automatique sur la redirection (même résultat).
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(fbAuth(), provider);
        // La redirection quitte la page ; on ne revient pas ici en succès.
        throw new Error("Redirection Google en cours…");
      }
      throw new Error(friendlyFirebaseError(error));
    }
  },

  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(fbAuth(), email.trim());
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      // Anti-énumération : email introuable = message générique positif.
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") return;
      throw new Error(friendlyFirebaseError(error));
    }
  },

  claimAdmin: async (email, password) => {
    const tryGrantAdmin = async (fbUser: FirebaseUser): Promise<AuthUser> => {
      // Écrit le rôle admin + le verrou (autorisé par les règles tant que
      // settings/public.adminExists n'est pas vrai).
      const profile: AuthUser = {
        id: fbUser.uid,
        name: fbUser.displayName ?? null,
        email: fbUser.email ?? email.trim(),
        role: "admin",
      };
      await withTimeout(
        setDoc(
          doc(fbDb(), "users", fbUser.uid),
          {
            uid: fbUser.uid,
            name: profile.name ?? "",
            email: profile.email,
            role: "admin",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        ),
        FIRESTORE_TIMEOUT_MS,
        "Enregistrement administrateur"
      );
      await withTimeout(
        setDoc(
          doc(fbDb(), "settings", "public"),
          { adminExists: true },
          { merge: true }
        ),
        FIRESTORE_TIMEOUT_MS,
        "Verrou administrateur"
      );
      set({ user: profile, ready: true });
      return profile;
    };

    try {
      const exists = await adminExists();
      if (!exists) {
        // Premier admin : création du compte puis enregistrement comme admin.
        try {
          const cred = await createUserWithEmailAndPassword(
            fbAuth(),
            email.trim(),
            password
          );
          return { created: true, user: await tryGrantAdmin(cred.user) };
        } catch (createError) {
          const code =
            typeof createError === "object" &&
            createError !== null &&
            "code" in createError
              ? String((createError as { code: unknown }).code)
              : "";
          if (code === "auth/email-already-in-use") {
            // Auto-réparation : compte créé lors d'une tentative précédente
            // (ex : Firestore indisponible à ce moment-là) → connexion + role.
            const cred = await signInWithEmailAndPassword(
              fbAuth(),
              email.trim(),
              password
            );
            return { created: true, user: await tryGrantAdmin(cred.user) };
          }
          throw createError;
        }
      }
      // Un admin existe : connexion classique + vérification du rôle.
      const cred = await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
      const profile = await ensureProfile(cred.user);
      if (profile.role !== "admin") {
        await signOut(fbAuth());
        throw new Error("Ce compte n'a pas les droits administrateur.");
      }
      set({ user: profile, ready: true });
      return { created: false, user: profile };
    } catch (error) {
      throw new Error(friendlyFirebaseError(error));
    }
  },
}));

/** Utilitaire : uid courant (null si déconnecté). */
export function currentUid(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}
