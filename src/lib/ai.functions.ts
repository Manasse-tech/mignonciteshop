import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------------- */
/* Types partagés                                                            */
/* ------------------------------------------------------------------------- */

export interface JourneyDiagnosis {
  summary: string;
  steps: { title: string; detail: string; status: "ok" | "warning" | "error" }[];
  issues: { title: string; cause: string; severity: "faible" | "moyenne" | "élevée"; step: string }[];
  fixes: { title: string; action: string; priority: number; where: string }[];
}

export interface ProofResult {
  verified: boolean;
  reasons: string[];
  extracted: {
    recipientName: string;
    recipientNumber: string;
    amount: number;
    transactionId: string;
    success: boolean;
  };
}

export interface CompareAnalysis {
  verdict: string;
  bestValueId: string;
  perProduct: { id: string; strengths: string[]; weaknesses: string[] }[];
  recommendation: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur inattendue.";
}

/* ------------------------------------------------------------------------- */
/* 1. Assistant de diagnostic (admins uniquement)                            */
/* ------------------------------------------------------------------------- */

const DIAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "steps", "issues", "fixes"],
  properties: {
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "status"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          status: { type: "string", enum: ["ok", "warning", "error"] },
        },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "cause", "severity", "step"],
        properties: {
          title: { type: "string" },
          cause: { type: "string" },
          severity: { type: "string", enum: ["faible", "moyenne", "élevée"] },
          step: { type: "string" },
        },
      },
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "action", "priority", "where"],
        properties: {
          title: { type: "string" },
          action: { type: "string" },
          priority: { type: "integer" },
          where: { type: "string" },
        },
      },
    },
  },
};

export const diagnoseJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { description: string }) => {
    const d = String(input?.description ?? "").trim();
    if (d.length < 10) throw new Error("Décrivez le parcours en quelques phrases.");
    if (d.length > 6000) throw new Error("Description trop longue (6000 caractères max).");
    return { description: d };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");
    const { callResponses } = await import("@/lib/ai/gateway.server");
    try {
      const text = await callResponses({
        effort: "medium",
        instructions:
          "Tu es expert e-commerce et QA pour MignonciteShop, boutique en ligne en Côte d'Ivoire (prix en F CFA, paiement carte ou Mobile Money Wave/Orange/MTN/Moov, livraison standard/express/retrait, codes promo, compte client, panier, favoris, suivi de commande). " +
          "À partir de la description de l'administrateur, reconstitue les étapes du parcours d'achat, repère les erreurs ou frictions probables (techniques, UX, paiement, stock, livraison, e-mails), et propose des corrections concrètes, actionnables et priorisées (1 = la plus urgente). " +
          "Indique pour chaque correction où agir (ex : onglet Admin > Paramètres, page Panier, réglages Mobile Money). Réponds en français, de façon concise.",
        input: [{ role: "user", content: data.description }],
        schema: { name: "journey_diagnosis", schema: DIAG_SCHEMA },
      });
      return JSON.parse(text) as JourneyDiagnosis;
    } catch (e) {
      throw new Error(errMsg(e));
    }
  });

/* ------------------------------------------------------------------------- */
/* 2. Vérification d'une capture de paiement Mobile Money                    */
/* ------------------------------------------------------------------------- */

const PROOF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "isTransactionReceipt",
    "success",
    "recipientName",
    "recipientNumber",
    "amount",
    "currency",
    "transactionId",
    "operator",
  ],
  properties: {
    isTransactionReceipt: { type: "boolean" },
    success: { type: "boolean" },
    recipientName: { type: "string" },
    recipientNumber: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    transactionId: { type: "string" },
    operator: { type: "string" },
  },
};

function normalizeName(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function namesMatch(a: string, b: string): boolean {
  const ta = normalizeName(a);
  const tb = normalizeName(b);
  if (!ta.length || !tb.length) return false;
  const hits = tb.filter((t) => ta.some((x) => x === t || x.startsWith(t) || t.startsWith(x)));
  return hits.length >= Math.min(2, tb.length);
}

function lastDigits(s: string, n = 8): string {
  return s.replace(/\D/g, "").slice(-n);
}

export const verifyMobileMoneyProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string; image: string }) => {
    const reference = String(input?.reference ?? "").trim();
    const image = String(input?.image ?? "");
    if (!reference) throw new Error("Référence de commande manquante.");
    const m = /^data:(image\/(png|jpe?g|webp));base64,/.exec(image);
    if (!m) throw new Error("Format d'image non pris en charge (PNG, JPG ou WEBP).");
    if (image.length > 9_000_000) throw new Error("Image trop lourde (6 Mo max).");
    return { reference, image, mime: m[1] };
  })
  .handler(async ({ data, context }): Promise<ProofResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();

    // Commande + propriété
    const { data: rows, error } = await supabaseAdmin
      .from("documents")
      .select("id, data")
      .eq("collection", "orders")
      .eq("data->>reference", data.reference)
      .limit(1);
    if (error) throw new Error("Lecture de la commande impossible.");
    const row = rows?.[0];
    if (!row) throw new Error("Commande introuvable.");
    const order = row.data as Record<string, string | number | boolean | null>;
    const owns =
      order.uid === context.userId ||
      (email && String(order.email ?? "").toLowerCase() === email);
    if (!owns) throw new Error("Cette commande n'est pas associée à votre compte.");
    if (order.paymentMethod !== "mobile_money")
      throw new Error("Cette commande n'est pas payée par Mobile Money.");
    if (order.paymentStatus === "paid") throw new Error("Cette commande est déjà payée.");

    // Réglages boutique (bénéficiaire attendu)
    const { data: settingsRow } = await supabaseAdmin
      .from("documents")
      .select("data")
      .eq("collection", "settings")
      .eq("id", "public")
      .maybeSingle();
    const settings = (settingsRow?.data ?? {}) as Record<string, Record<string, unknown>>;
    const expectedName = String(settings.contact?.mobileMoneyName ?? "").trim();
    const expectedNumber = String(settings.payment?.mobileMoneyNumber ?? "").trim();
    const total = typeof order.total === "number" ? order.total : 0;

    // Sauvegarde de la capture (privée)
    const ext = data.mime.includes("png") ? "png" : data.mime.includes("webp") ? "webp" : "jpg";
    const path = `${context.userId}/${data.reference}-${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.image.split(",")[1]), (c) => c.charCodeAt(0));
    await supabaseAdmin.storage.from("payment-proofs").upload(path, bytes, {
      contentType: data.mime,
      upsert: false,
    });

    // Lecture IA de la capture
    const { callResponses } = await import("@/lib/ai/gateway.server");
    let extracted: {
      isTransactionReceipt: boolean;
      success: boolean;
      recipientName: string;
      recipientNumber: string;
      amount: number;
      currency: string;
      transactionId: string;
      operator: string;
    };
    try {
      const text = await callResponses({
        instructions:
          "Tu lis des captures d'écran de transactions Mobile Money (Wave, Orange Money, MTN MoMo, Moov Money) en Afrique de l'Ouest. " +
          "Extrais fidèlement ce qui est visible : bénéficiaire (nom et numéro), montant envoyé en nombre (sans frais, en F CFA), devise, identifiant de transaction, opérateur, et si la transaction est indiquée comme réussie. " +
          "N'invente rien : chaîne vide ou 0 si absent. isTransactionReceipt=false si l'image n'est pas un reçu de transaction.",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Analyse cette capture de transaction." },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
        schema: { name: "mobile_money_receipt", schema: PROOF_SCHEMA },
      });
      extracted = JSON.parse(text);
    } catch (e) {
      throw new Error(errMsg(e));
    }

    // Contrôles
    const reasons: string[] = [];
    if (!extracted.isTransactionReceipt) reasons.push("L'image ne ressemble pas à un reçu de transaction.");
    if (!extracted.success) reasons.push("La transaction n'apparaît pas comme réussie.");
    if (extracted.amount + 1 < total)
      reasons.push(`Montant insuffisant : ${extracted.amount} F CFA lu, ${total} F CFA attendus.`);
    const nameOk = expectedName ? namesMatch(extracted.recipientName, expectedName) : false;
    const numberOk =
      expectedNumber && extracted.recipientNumber
        ? lastDigits(extracted.recipientNumber) === lastDigits(expectedNumber)
        : false;
    if (!nameOk && !numberOk)
      reasons.push(
        `Le bénéficiaire (« ${extracted.recipientName || "illisible"} ») ne correspond pas au compte de la boutique.`
      );
    if (!extracted.transactionId) reasons.push("Identifiant de transaction illisible.");

    if (extracted.transactionId) {
      const { data: dup } = await supabaseAdmin
        .from("documents")
        .select("id")
        .eq("collection", "paymentProofs")
        .eq("data->>transactionId", extracted.transactionId)
        .eq("data->>verified", "true")
        .limit(1);
      if (dup && dup.length) reasons.push("Cette transaction a déjà été utilisée pour une autre commande.");
    }

    const verified = reasons.length === 0;
    const now = new Date().toISOString();

    await supabaseAdmin.from("documents").insert({
      collection: "paymentProofs",
      id: crypto.randomUUID(),
      owner: context.userId,
      data: {
        reference: data.reference,
        orderId: row.id,
        path,
        verified,
        reasons,
        expectedName,
        expectedNumber,
        total,
        ...extracted,
        createdAt: now,
      },
    });

    if (verified) {
      const next = {
        ...order,
        paymentStatus: "paid",
        status: order.status === "pending" ? "confirmed" : String(order.status ?? "pending"),
        transactionId: extracted.transactionId,
        paymentProofPath: path,
        paymentVerifiedBy: "ai",
        updatedAt: now,
      };
      await supabaseAdmin.from("documents").update({ data: next }).eq("collection", "orders").eq("id", row.id);
      const { data: lookups } = await supabaseAdmin
        .from("documents")
        .select("id, data")
        .eq("collection", "orderLookups")
        .eq("data->>orderId", row.id);
      for (const l of lookups ?? []) {
        const ld = l.data as Record<string, string | number | boolean | null>;
        await supabaseAdmin
          .from("documents")
          .update({ data: { ...ld, paymentStatus: "paid", status: next.status, updatedAt: now } })
          .eq("collection", "orderLookups")
          .eq("id", l.id);
      }
    }

    return {
      verified,
      reasons,
      extracted: {
        recipientName: extracted.recipientName,
        recipientNumber: extracted.recipientNumber,
        amount: extracted.amount,
        transactionId: extracted.transactionId,
        success: extracted.success,
      },
    };
  });

/* ------------------------------------------------------------------------- */
/* 3. Analyse IA du comparateur (clients connectés)                          */
/* ------------------------------------------------------------------------- */

const COMPARE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "bestValueId", "perProduct", "recommendation"],
  properties: {
    verdict: { type: "string" },
    bestValueId: { type: "string" },
    recommendation: { type: "string" },
    perProduct: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "strengths", "weaknesses"],
        properties: {
          id: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export const analyzeComparison = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { products: Record<string, unknown>[]; usage: string }) => {
    const products = Array.isArray(input?.products) ? input.products.slice(0, 4) : [];
    if (products.length < 2) throw new Error("Sélectionnez au moins 2 produits.");
    return { products, usage: String(input?.usage ?? "").slice(0, 500) };
  })
  .handler(async ({ data }) => {
    const { callResponses } = await import("@/lib/ai/gateway.server");
    try {
      const text = await callResponses({
        instructions:
          "Tu es conseiller d'achat de MignonciteShop (prix en F CFA). Compare objectivement les produits fournis (prix, remise, note, avis, stock, options, description). " +
          "Donne un verdict court, l'id du meilleur rapport qualité/prix, 2-3 points forts et faibles par produit, et une recommandation adaptée à l'usage du client s'il est précisé. Français, concis.",
        input: [
          {
            role: "user",
            content: `Usage du client : ${data.usage || "non précisé"}\n\nProduits :\n${JSON.stringify(data.products)}`,
          },
        ],
        schema: { name: "compare_analysis", schema: COMPARE_SCHEMA },
      });
      return JSON.parse(text) as CompareAnalysis;
    } catch (e) {
      throw new Error(errMsg(e));
    }
  });
