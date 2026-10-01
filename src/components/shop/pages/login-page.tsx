"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore, adminExists, type AuthUser } from "@/lib/auth-store";
import {
  LoginReturnNotice,
  consumeAfterLogin,
} from "@/components/shop/require-auth";

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required = true,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="h-11 rounded-xl pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Eye className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** Bouton Google — authentification Firebase (dispo connexion + inscription). */
function GoogleButton({
  onDone,
  disabled,
}: {
  onDone: (user: AuthUser) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const user = await useAuthStore.getState().loginWithGoogle();
      toast.success(`Connexion Google réussie. Bienvenue ${user.name ?? ""} !`);
      onDone(user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion Google impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={disabled || loading}
      className="w-full inline-flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:pointer-events-none"
    >
      {loading ? (
        "Connexion Google…"
      ) : (
        <>
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
            />
          </svg>
          Continuer avec Google
        </>
      )}
    </button>
  );
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { ready, hydrate } = useAuthStore();
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Geste secret : 7 taps sur le nom de la boutique → connexion admin ──
  const tapCount = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const [adminSecretOpen, setAdminSecretOpen] = useState(false);
  const [adminFirstTime, setAdminFirstTime] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const handleSecretTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    // Série invalidée après 3 s d'inactivité — évite les taps fortuits.
    tapTimer.current = window.setTimeout(() => {
      tapCount.current = 0;
    }, 3000);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      setAdminEmail("");
      setAdminPassword("");
      // Détermine le mode du formulaire caché : enregistrement (aucun admin
      // défini → les premiers identifiants deviennent le compte admin) ou
      // connexion (un admin existe déjà — doc settings/public.adminExists).
      adminExists()
        .then((exists) => setAdminFirstTime(!exists))
        .catch(() => setAdminFirstTime(false));
      setAdminSecretOpen(true);
    }
  };

  const handleAdminSecretSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (adminSubmitting) return;
    setAdminSubmitting(true);
    try {
      const { created } = await useAuthStore
        .getState()
        .claimAdmin(adminEmail, adminPassword);
      setAdminSecretOpen(false);
      toast.success(
        created
          ? "Compte administrateur enregistré. Bienvenue !"
          : "Connexion administrateur réussie."
      );
      onNavigate("admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accès impossible.");
    } finally {
      setAdminSubmitting(false);
    }
  };
  // ── Fin geste secret ──

  // Mot de passe oublié — envoi du lien Firebase (anti-énumération : réponse
  // toujours positive).
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  // Session déjà active ? → évite de re-saisir ses identifiants.
  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  const redirectAfterLogin = (loggedIn: AuthUser) => {
    // Retour automatique sur la page protégée demandée avant redirection
    // (panier, favoris…) si elle a été mémorisée.
    const after = consumeAfterLogin();
    if (after) {
      const qs = after.startsWith("?") ? after.slice(1) : after.replace(/^\//, "");
      router.push(qs ? `/?${qs}` : "/");
      return;
    }
    // L'admin est redirigé vers son espace de gestion.
    onNavigate(loggedIn.role === "admin" ? "admin" : "account");
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const loggedIn = await useAuthStore
        .getState()
        .loginWithEmail(loginEmail, loginPassword);
      toast.success(`Connexion réussie. Bienvenue ${loggedIn.name ?? ""} !`);
      redirectAfterLogin(loggedIn);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (registerPassword !== registerConfirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (registerPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await useAuthStore
        .getState()
        .registerWithEmail(registerName, registerEmail, registerPassword);
      toast.success("Compte créé. Bienvenue chez MignonciteShop !");
      redirectAfterLogin(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inscription impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  // Demande de réinitialisation — Firebase envoie le lien par e-mail.
  const handleForgot = async () => {
    if (forgotSending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }
    setForgotSending(true);
    try {
      await useAuthStore.getState().sendPasswordReset(forgotEmail.trim());
      setForgotOpen(false);
      toast.success(
        "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
      );
      setForgotEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demande impossible.");
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col w-full">
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-sm p-8">
            <div className="text-center mb-2">
              {/* Geste secret : 7 taps rapides sur le nom de la boutique
                  ouvrent la page de connexion administrateur réservée. */}
              <button
                type="button"
                onClick={handleSecretTap}
                aria-label="MignonciteShop"
                className="mx-auto block cursor-default select-none"
              >
                <span className="text-2xl font-bold tracking-tight logo-glow">
                  <span className="text-foreground">MIGNONCITE</span>
                  <span className="text-[#C9A961]">SHOP</span>
                </span>
              </button>
            </div>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Connectez-vous pour suivre vos commandes et gérer votre compte
            </p>

            <LoginReturnNotice />

            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="register">Inscription</TabsTrigger>
              </TabsList>

              {/* Connexion */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      autoComplete="email"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <PasswordInput
                      id="login-password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-sm text-[#C9A961] hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full py-3 font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {submitting ? "Connexion..." : "Se connecter"}
                  </button>
                </form>
                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <GoogleButton onDone={(loggedIn) => redirectAfterLogin(loggedIn)} />
              </TabsContent>

              {/* Inscription */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nom</Label>
                    <Input
                      id="register-name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="Votre nom complet"
                      required
                      autoComplete="name"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      autoComplete="email"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Mot de passe</Label>
                    <PasswordInput
                      id="register-password"
                      value={registerPassword}
                      onChange={setRegisterPassword}
                      placeholder="Au moins 6 caractères"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">
                      Confirmer le mot de passe
                    </Label>
                    <PasswordInput
                      id="register-confirm"
                      value={registerConfirm}
                      onChange={setRegisterConfirm}
                      placeholder="Ressaisissez votre mot de passe"
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full py-3 font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {submitting ? "Création..." : "Créer mon compte"}
                  </button>
                </form>
                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <GoogleButton onDone={(created) => redirectAfterLogin(created)} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialog — mot de passe oublié */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mot de passe oublié</DialogTitle>
            <DialogDescription>
              Saisissez l&apos;adresse email de votre compte : vous recevrez un
              lien sécurisé de réinitialisation (envoyé par Firebase
              Authentication).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="vous@exemple.com"
              autoComplete="email"
              className="h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleForgot}
              disabled={forgotSending}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white"
            >
              {forgotSending ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — connexion administrateur CACHÉE (7 taps sur le logo) */}
      <Dialog open={adminSecretOpen} onOpenChange={setAdminSecretOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#C9A961]" aria-hidden="true" />
              Espace réservé — Administration
            </DialogTitle>
            <DialogDescription>
              {adminFirstTime
                ? "Aucun administrateur n'est encore défini : les identifiants saisis ci-dessous seront ENREGISTRÉS comme compte administrateur."
                : "Saisissez les identifiants administrateur de la boutique."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminSecretSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-secret-email">Email administrateur</Label>
              <Input
                id="admin-secret-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@votre-boutique.com"
                required
                autoComplete="email"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-secret-password">Mot de passe</Label>
              <PasswordInput
                id="admin-secret-password"
                value={adminPassword}
                onChange={setAdminPassword}
                placeholder={adminFirstTime ? "Au moins 8 caractères (lettre + chiffre)" : "Votre mot de passe"}
                autoComplete="current-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminSecretOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={adminSubmitting}
                className="bg-[#C9A961] hover:bg-[#b8994f] text-white"
              >
                {adminSubmitting
                  ? "Vérification..."
                  : adminFirstTime
                    ? "Enregistrer et se connecter"
                    : "Se connecter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
