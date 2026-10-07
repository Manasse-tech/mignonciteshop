"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTACT_DEFAULTS,
  fetchContactSettings,
  saveContactSettings,
  type ContactSettings,
} from "@/lib/contact-settings";

const FIELDS: { key: keyof ContactSettings; label: string; hint?: string }[] = [
  { key: "email", label: "E-mail de contact" },
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "address", label: "Adresse" },
  { key: "hours", label: "Horaires d'ouverture" },
  {
    key: "mobileMoneyName",
    label: "Nom du bénéficiaire Mobile Money",
    hint: "Nom exact affiché sur les reçus Wave / Orange / MTN / Moov. Sert à la vérification automatique des captures. Le numéro se règle dans l'onglet Paramètres.",
  },
];

export function ContactPanel() {
  const [form, setForm] = useState<ContactSettings>(CONTACT_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContactSettings()
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveContactSettings(form);
      toast.success("Coordonnées enregistrées.");
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto my-12" />;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Coordonnées de la boutique</h2>
      <p className="text-sm text-muted-foreground">
        Ces informations s&apos;affichent dans le pied de page, la page Contact et le paiement.
      </p>
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`c-${f.key}`}>{f.label}</Label>
          <Input
            id={`c-${f.key}`}
            value={form[f.key]}
            onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
            className="h-10 rounded-xl"
          />
          {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
        </div>
      ))}
      <Button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer
      </Button>
    </div>
  );
}
