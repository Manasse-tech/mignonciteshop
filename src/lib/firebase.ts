/**
 * Lovable Cloud — backend de MignonciteShop (remplace Firebase).
 * fbAuth()/fbDb() conservent l'interface utilisée par la boutique.
 */
import { getAuthInstance, type Auth } from "@/lib/fb/auth";
import { getFirestoreInstance, type Firestore } from "@/lib/fb/firestore";

export function fbAuth(): Auth {
  return getAuthInstance();
}

export function fbDb(): Firestore {
  return getFirestoreInstance();
}

/**
 * Traduit les codes d'erreur Firebase en messages français compréhensibles
 * pour l'utilisateur (authentification, Firestore).
 */
export function friendlyFirebaseError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const AUTH: Record<string, string> = {
    "auth/email-not-confirmed": "Compte créé ! Confirmez votre adresse via l'email reçu, puis connectez-vous.",
    "auth/redirecting": "Redirection Google en cours…",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/user-disabled": "Ce compte a été désactivé.",
    "auth/user-not-found": "Aucun compte n'existe avec cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/email-already-in-use":
      "Un compte existe déjà avec cet email — connectez-vous.",
    "auth/weak-password":
      "Mot de passe trop faible (6 caractères minimum, 8 recommandé).",
    "auth/password-does-not-meet-requirements":
      "Le mot de passe ne respecte pas la politique du projet : au moins 6 caractères dont un caractère spécial (ex : !, ?, #).",
    "auth/too-many-requests":
      "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/popup-blocked":
      "Le navigateur a bloqué la fenêtre Google. Autorisez les popups ou réessayez.",
    "auth/popup-closed-by-user": "Connexion Google annulée.",
    "auth/cancelled-popup-request": "Connexion Google annulée.",
    "auth/account-exists-with-different-credential":
      "Un compte existe déjà avec cet email via une autre méthode (mot de passe). Connectez-vous d'abord avec votre mot de passe.",
    "auth/network-request-failed":
      "Réseau indisponible — vérifiez votre connexion internet.",
    "auth/operation-not-allowed":
      "Méthode de connexion non activée .",
    "auth/unauthorized-domain":
      "Domaine non autorisé : ajoutez ce domaine dans les réglages de connexion.",
    "auth/requires-recent-login":
      "Veuillez vous reconnecter pour confirmer cette action sensible.",
    "auth/admin-restricted-operation":
      "Action réservée à l'administrateur de la boutique.",
  };

  if (AUTH[code]) return AUTH[code];

  if (code === "permission-denied") {
    return "Permission refusée par les règles de sécurité.";
  }
  if (code === "unavailable") {
    return "Service momentanément indisponible — réessayez.";
  }
  if (code === "failed-precondition") {
    return "Opération impossible : base de données indisponible.";
  }

  const message =
    error instanceof Error && error.message ? error.message : "Erreur inconnue.";
  return message;
}
