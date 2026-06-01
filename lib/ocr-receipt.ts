/**
 * OCR de tickets / factures via Claude API (vision).
 *
 * Stratégie : on envoie la photo + une instruction structurée. Claude renvoie
 * un JSON avec les champs (date, fournisseur, montant HT, TVA, TTC, etc.).
 * Cache prompt activé pour la portion d'instructions (réduit le coût).
 *
 * Si ANTHROPIC_API_KEY n'est pas configurée → fallback : on renvoie un
 * objet vide, l'admin remplit à la main.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface OcrReceiptResult {
  ok: boolean;
  /** Pré-remplissage proposé. Tous les champs sont optionnels. */
  data?: {
    date?: string; // ISO YYYY-MM-DD
    fournisseur?: string;
    description?: string;
    reference?: string;
    montantHT?: number;
    montantTVA?: number;
    montantTTC?: number;
    tauxTVA?: number; // 0.077 / 0.025 / 0.038 / 0
    categorieSuggested?: string; // enum ExpenseCategorie
    methodPaiementSuggested?: string;
  };
  /** Raw text de Claude (pour audit / debug). */
  raw?: string;
  error?: string;
}

const SYSTEM_PROMPT = `Tu es un assistant comptable spécialisé dans la lecture de tickets et factures suisses.

Tu reçois une photo d'un ticket de caisse, d'une note de restaurant, d'une facture fournisseur ou d'un reçu carte bancaire. Ton rôle est d'extraire les informations structurées.

Renvoie UNIQUEMENT un objet JSON valide avec ce format (aucun autre texte) :

{
  "date": "YYYY-MM-DD" | null,
  "fournisseur": "Nom du commerçant ou fournisseur" | null,
  "description": "Brève description des achats" | null,
  "reference": "Numéro de ticket / facture" | null,
  "montantHT": number | null,
  "montantTVA": number | null,
  "montantTTC": number | null,
  "tauxTVA": 0.077 | 0.025 | 0.038 | 0 | null,
  "categorieSuggested": "LOYER" | "SOFTWARE_SAAS" | "MARKETING" | "PUBLICITE" | "DEPLACEMENTS" | "RESTAURATION" | "MATERIEL_BUREAU" | "ASSURANCES" | "TELECOM" | "FORMATION" | "HONORAIRES" | "IMPOTS" | "BANQUE_FRAIS" | "AUTRE" | null,
  "methodPaiementSuggested": "CARTE_BANCAIRE" | "VIREMENT" | "ESPECES" | "TWINT" | "PAYPAL" | "PRELEVEMENT" | "AUTRE" | null
}

Règles :
- Tous les montants sont en CHF (Suisse). Si une autre devise apparaît, indique-le dans description.
- TVA suisse standard = 7.7%, réduite = 2.5% (alimentation), spéciale hôtellerie = 3.8%.
- Si HT et TVA sont absents mais TTC visible avec un taux mentionné, calcule HT = TTC / (1 + taux).
- Pour la catégorie : restaurant/café → RESTAURATION. Hôtel/train/essence/parking → DEPLACEMENTS. Software SaaS/abonnement → SOFTWARE_SAAS. Papeterie/fournitures → MATERIEL_BUREAU. Facebook/Google Ads → PUBLICITE. Si incertain → AUTRE.
- Pour le mode de paiement : si "CB" / "Visa" / "MasterCard" → CARTE_BANCAIRE. Cash → ESPECES. Twint → TWINT.
- Renvoie null pour tout champ que tu ne peux pas lire avec certitude.`;

export async function ocrReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<OcrReceiptResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Clé API Claude non configurée (ANTHROPIC_API_KEY manquant). Remplis le ticket à la main.",
    };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache du prompt système (le même à chaque ticket → divise le coût)
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extrais les informations de ce ticket.",
            },
          ],
        },
      ],
    });

    // On récupère le texte renvoyé
    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");

    // Parse le JSON (Claude peut wrapper avec ```json...```)
    const cleaned = text
      .trim()
      .replace(/^```(json)?/, "")
      .replace(/```$/, "")
      .trim();

    let parsed: OcrReceiptResult["data"];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        ok: false,
        raw: text,
        error: "Réponse Claude illisible — JSON invalide.",
      };
    }

    return { ok: true, data: parsed, raw: text };
  } catch (err) {
    console.error("[ocrReceipt] erreur Claude API", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur API.",
    };
  }
}
