/**
 * Appel serveur à Lovable AI Gateway (/v1/responses, streaming SSE).
 * Le flux est consommé côté serveur et renvoie le texte final.
 * Ne jamais importer ce module côté navigateur.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
export const AI_MODEL = "openai/gpt-6-astra";

export class AiGatewayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function friendly(status: number, raw: string): string {
  let msg = "";
  try {
    const j = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    msg = j.error?.message ?? j.message ?? "";
  } catch {
    msg = raw.slice(0, 300);
  }
  if (status === 402) return msg || "Crédits IA épuisés. Rechargez l'espace de travail.";
  if (status === 429) return "Trop de demandes à l'IA. Réessayez dans un instant.";
  if (status === 401) return "Clé IA manquante ou invalide (configuration).";
  if (status === 403) return msg || "Accès IA refusé.";
  return msg || `Erreur du service IA (${status}).`;
}

export async function callResponses(opts: {
  instructions: string;
  input: unknown[];
  schema?: { name: string; schema: Record<string, unknown> };
  effort?: "low" | "medium";
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiGatewayError("Clé IA manquante (configuration).", 401);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      instructions: opts.instructions,
      input: opts.input,
      stream: true,
      store: false,
      reasoning: { effort: opts.effort ?? "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      ...(opts.schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: opts.schema.name,
                schema: opts.schema.schema,
                strict: true,
              },
            },
          }
        : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    throw new AiGatewayError(friendly(res.status, raw), res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let failure: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          message?: string;
          response?: { error?: { message?: string } };
          error?: { message?: string };
        };
        if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
        else if (evt.type === "response.failed" || evt.type === "error") {
          failure =
            evt.response?.error?.message ?? evt.error?.message ?? evt.message ?? "Échec de l'IA.";
        } else if (evt.type === "response.refusal.delta") {
          failure = "L'IA a refusé de traiter cette demande.";
        }
      } catch {
        /* ligne partielle ignorée */
      }
    }
  }
  if (failure) throw new AiGatewayError(failure, 502);
  if (!text.trim()) throw new AiGatewayError("Réponse IA vide.", 502);
  return text;
}
