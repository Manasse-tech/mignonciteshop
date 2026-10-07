"use client";

import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { verifyMobileMoneyProof, type ProofResult } from "@/lib/ai.functions";
import { downscaleImage } from "@/lib/image-upload";
import { useAuthStore } from "@/lib/auth-store";

export function MobileMoneyProof({
  reference,
  onVerified,
}: {
  reference: string;
  onVerified?: () => void;
}) {
  const verify = useServerFn(verifyMobileMoneyProof);
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const dataUrl = await downscaleImage(file, 1800, 0.9);
      setPreview(dataUrl);
      const res = await verify({ data: { reference, image: dataUrl } });
      setResult(res);
      if (res.verified) onVerified?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vérification impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Connectez-vous pour envoyer la capture de votre paiement et le faire valider automatiquement.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Envoyer la preuve de paiement</p>
      <p className="text-xs text-muted-foreground">
        Après votre transfert, importez la capture d&apos;écran du reçu. Nous vérifions
        automatiquement le bénéficiaire, le montant et la validation.
      </p>
      {result?.verified ? (
        <div className="flex items-start gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>
            Paiement vérifié ({result.extracted.amount.toLocaleString("fr-FR")} F CFA, réf.{" "}
            {result.extracted.transactionId}). Votre commande est confirmée.
          </span>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? "Vérification en cours…" : preview ? "Envoyer une autre capture" : "Importer la capture"}
          </button>
        </>
      )}
      {preview && (
        <img src={preview} alt="Capture envoyée" className="h-32 rounded-lg border border-border object-contain" />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && !result.verified && (
        <div className="text-sm text-destructive space-y-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <XCircle className="w-4 h-4" /> Paiement non validé
          </p>
          <ul className="list-disc pl-5 text-xs">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
