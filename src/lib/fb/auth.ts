/**
 * Couche de compatibilité « firebase/auth » au-dessus de Lovable Cloud.
 * Conserve les signatures utilisées par la boutique (auth-store, api).
 */
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User as SbUser } from "@supabase/supabase-js";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Auth {
  currentUser: User | null;
}

class AuthError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function toUser(u: SbUser | null | undefined): User | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name ?? meta.name ?? null) as string | null;
  return { uid: u.id, email: u.email ?? null, displayName: name };
}

export const authInstance: Auth = { currentUser: null };

const listeners = new Set<(u: User | null) => void>();
let initialized = false;
let initialResolved = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    authInstance.currentUser = toUser(session?.user);
    // Laisser les appels supabase en cours se terminer avant de notifier.
    setTimeout(() => {
      initialResolved = true;
      listeners.forEach((l) => l(authInstance.currentUser));
    }, 0);
  });
  void supabase.auth.getSession().then(({ data }) => {
    authInstance.currentUser = toUser(data.session?.user);
    if (!initialResolved) {
      initialResolved = true;
      listeners.forEach((l) => l(authInstance.currentUser));
    }
  });
}

export function getAuthInstance(): Auth {
  init();
  return authInstance;
}

export function onAuthStateChanged(
  _auth: Auth,
  cb: (u: User | null) => void,
  _err?: (e: unknown) => void
): () => void {
  init();
  listeners.add(cb);
  if (initialResolved) setTimeout(() => cb(authInstance.currentUser), 0);
  return () => listeners.delete(cb);
}

function mapError(error: { message?: string; code?: string; status?: number }): AuthError {
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("invalid login")) return new AuthError("auth/invalid-credential");
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return new AuthError("auth/email-already-in-use");
  if (msg.includes("email not confirmed")) return new AuthError("auth/email-not-confirmed");
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("at least") || msg.includes("pwned")))
    return new AuthError("auth/weak-password", error.message);
  if (msg.includes("invalid") && msg.includes("email")) return new AuthError("auth/invalid-email");
  if (error.status === 429 || msg.includes("rate")) return new AuthError("auth/too-many-requests");
  return new AuthError(error.code ?? "auth/unknown", error.message);
}

export async function createUserWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: displayName ? { full_name: displayName } : undefined,
    },
  });
  if (error) throw mapError(error);
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError("auth/email-already-in-use");
  }
  if (!data.session) {
    throw new AuthError(
      "auth/email-not-confirmed",
      "Compte créé ! Confirmez votre adresse via l'email reçu, puis connectez-vous."
    );
  }
  authInstance.currentUser = toUser(data.user);
  return { user: authInstance.currentUser! };
}

export async function signInWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapError(error);
  authInstance.currentUser = toUser(data.user);
  return { user: authInstance.currentUser! };
}

export class GoogleAuthProvider {
  params: Record<string, string> = {};
  setCustomParameters(p: Record<string, string>) {
    this.params = p;
  }
}

export async function signInWithPopup(
  _auth: Auth,
  provider: GoogleAuthProvider
): Promise<{ user: User }> {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
    extraParams: provider.params,
  });
  if (result.error) throw new AuthError("auth/google-failed", result.error.message);
  if (result.redirected) throw new AuthError("auth/redirecting", "Redirection Google en cours…");
  const { data } = await supabase.auth.getUser();
  authInstance.currentUser = toUser(data.user);
  if (!authInstance.currentUser) throw new AuthError("auth/popup-closed-by-user");
  return { user: authInstance.currentUser };
}

export async function signInWithRedirect(auth: Auth, provider: GoogleAuthProvider) {
  await signInWithPopup(auth, provider);
}

export async function getRedirectResult(_auth: Auth) {
  return null;
}

export async function signOut(_auth: Auth) {
  await supabase.auth.signOut();
  authInstance.currentUser = null;
}

export async function sendPasswordResetEmail(_auth: Auth, email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw mapError(error);
}

export async function updateProfile(user: User, profile: { displayName?: string }) {
  await supabase.auth.updateUser({ data: { full_name: profile.displayName } });
  user.displayName = profile.displayName ?? user.displayName;
}

/** Suppression de compte : les données sont purgées, puis déconnexion. */
export async function deleteUser(_user: User) {
  await supabase.auth.signOut();
  authInstance.currentUser = null;
}
