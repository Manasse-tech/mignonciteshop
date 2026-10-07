"use client";

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { diagnoseJourney, type JourneyDiagnosis } from "@/lib/ai.functions";

const EXAMPLES = [
  "Un client ajoute 2 articles au panier, applique le code BIENVENUE10, choisit Mobile Money, mais la commande reste « non payée » et il ne reçoit aucun e-mail.",
  "Sur mobile, après avoir choisi la livraison express, le total ne se met pas à jour et le bouton Payer reste grisé.",
];

export function AiAssistantPanel() {
  const run = useServerFn(diagnoseJourney);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JourneyDiagnosis | null>(null);

  async function analyze() {
    setLoading(true);
    setResult(null);
    try {
      setResult(await run({ data: { description: text } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
          Assistant IA — diagnostic de parcours
        </h2>
        <p className="text-sm text-muted-foreground">
          Décrivez un parcours d&apos;achat ou un problème rencontré par un client. L&apos;IA
          reconstitue les étapes, repère les erreurs probables et propose des corrections.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Ex : un client n'arrive pas à finaliser sa commande après…"
          className="rounded-xl"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText(ex)}
              className="text-xs rounded-full border border-border px-3 py-1 hover:border-[#C9A961] hover:text-[#C9A961]"
            >
              Exemple {i + 1}
            </button>
          ))}
        </div>
        <Button
          onClick={analyze}
          disabled={loading || text.trim().length < 10}
          className="rounded-full bg-[#C9A961] hover:bg-[#b8994f] text-white gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Analyse en cours…" : "Analyser"}
        </Button>
      </div>

      {result && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#C9A961]/40 bg-[#C9A961]/5 p-4 text-sm">{result.summary}</div>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold mb-3">Étapes du parcours</h3>
            <ol className="space-y-3">
              {result.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  {s.status === "ok" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : s.status === "warning" ? (
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{i + 1}. {s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold mb-3">Erreurs possibles</h3>
            <ul className="space-y-3">
              {result.issues.map((it, i) => (
                <li key={i} className="text-sm">
                  <span
                    className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      it.severity === "élevée"
                        ? "bg-destructive/15 text-destructive"
                        : it.severity === "moyenne"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {it.severity}
                  </span>
                  <strong>{it.title}</strong>
                  <span className="text-muted-foreground"> — {it.cause} (étape : {it.step})</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#C9A961]" /> Corrections proposées
            </h3>
            <ol className="space-y-3">
              {[...result.fixes].sort((a, b) => a.priority - b.priority).map((f, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">
                    <span className="text-[#C9A961] mr-1">#{f.priority}</span> {f.title}
                  </p>
                  <p className="text-muted-foreground">{f.action}</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">Où : {f.where}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
