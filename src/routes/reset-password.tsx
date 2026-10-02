import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — MignonciteShop" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour votre compte MignonciteShop." },
      { property: "og:title", content: "Nouveau mot de passe — MignonciteShop" },
      { property: "og:description", content: "Réinitialisation du mot de passe MignonciteShop." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour.");
    void navigate({ href: "/?page=account" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Nouveau mot de passe</h1>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="w-full rounded-full border border-input bg-background px-4 py-3 text-sm"
        />
        <button
          disabled={busy}
          className="w-full rounded-full bg-gold py-3 font-semibold text-gold-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
