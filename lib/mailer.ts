/**
 * Envoi d'emails via Resend.
 *
 * Configuration :
 *   - EMAIL_MODE=live (sinon dry-run)
 *   - RESEND_API_KEY=re_xxx (récupéré sur resend.com)
 *   - Domaine makeyourcom.ch vérifié sur Resend (SPF + DKIM + DMARC)
 *
 * Logique BCC :
 *   Chaque email envoyé est BCCé à son expéditeur (Arthur ou Sophie)
 *   pour que la copie atterrisse dans sa boîte Gmail / Outlook. Comme ça
 *   l'historique reste accessible depuis le client mail habituel ET
 *   depuis le CRM.
 *
 * Adresses sortantes possibles :
 *   - contact@makeyourcom.ch (Arthur — admin)
 *   - sophie@makeyourcom.ch (Sophie — commerciale)
 *   - fallback : noreply@makeyourcom.ch si user.email n'est pas sur le domaine
 */
import { Resend } from "resend";

export interface SendEmailParams {
  /** Adresse "From" : doit être sur un domaine vérifié Resend */
  from: string;
  /** Nom affiché (optionnel) */
  fromName?: string;
  /** Destinataire principal */
  to: string;
  /** Sujet */
  subject: string;
  /** Contenu HTML */
  html: string;
  /** Contenu texte brut (fallback) */
  text: string;
  /** BCC additionnels (en plus du from auto-BCCé) */
  bcc?: string[];
  /** Reply-To (défaut = from) */
  replyTo?: string;
  /** Message-ID custom pour threading */
  messageId?: string;
  /** In-Reply-To pour réponses */
  inReplyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** ID Resend (pour tracking) */
  resendId?: string;
  /** Vrai si on était en dry-run (pas d'envoi réel) */
  dryRun: boolean;
  error?: string;
}

export async function sendMail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const isLive = process.env.EMAIL_MODE === "live";
  const apiKey = process.env.RESEND_API_KEY;

  if (!isLive) {
    console.log("📧 [DRY-RUN] Email simulé", {
      from: params.from,
      to: params.to,
      subject: params.subject,
      length: params.text.length,
    });
    return { ok: true, dryRun: true };
  }

  if (!apiKey) {
    console.error("📧 [LIVE] RESEND_API_KEY manquant — abort");
    return {
      ok: false,
      dryRun: false,
      error: "Configuration manquante (RESEND_API_KEY).",
    };
  }

  try {
    const resend = new Resend(apiKey);

    // BCC auto vers l'expéditeur : pour que la copie tombe dans son Gmail.
    // On ne BCC PAS si l'expéditeur est dans le "to" (évite dupliquer pour soi-même).
    const autoBcc =
      params.from && params.to.toLowerCase() !== params.from.toLowerCase()
        ? [params.from]
        : [];
    const allBcc = [...autoBcc, ...(params.bcc ?? [])];

    const fromHeader = params.fromName
      ? `${params.fromName} <${params.from}>`
      : params.from;

    const result = await resend.emails.send({
      from: fromHeader,
      to: [params.to],
      bcc: allBcc.length > 0 ? allBcc : undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo ?? params.from,
      headers: {
        ...(params.messageId ? { "Message-ID": params.messageId } : {}),
        ...(params.inReplyTo ? { "In-Reply-To": params.inReplyTo } : {}),
      },
    });

    if (result.error) {
      console.error("📧 [LIVE] Resend error:", result.error);
      return {
        ok: false,
        dryRun: false,
        error: result.error.message ?? "Erreur Resend inconnue",
      };
    }

    return {
      ok: true,
      resendId: result.data?.id,
      dryRun: false,
    };
  } catch (err) {
    console.error("📧 [LIVE] Exception:", err);
    return {
      ok: false,
      dryRun: false,
      error: err instanceof Error ? err.message : "Erreur réseau",
    };
  }
}

/**
 * Renvoie l'adresse From valide pour cet utilisateur.
 *
 * Règle : si user.email est déjà sur le domaine makeyourcom.ch → utilisé tel quel.
 * Sinon, on retombe sur contact@makeyourcom.ch (admin) — le user.email original
 * est mis en Reply-To pour que les réponses lui reviennent.
 */
export function resolveFromAddress(user: { email: string; name?: string | null }): {
  from: string;
  replyTo: string;
  fromName: string;
} {
  const allowedDomain = "makeyourcom.ch";
  const emailLower = user.email.toLowerCase().trim();
  const isOnDomain = emailLower.endsWith("@" + allowedDomain);

  return {
    from: isOnDomain ? emailLower : `contact@${allowedDomain}`,
    replyTo: user.email,
    fromName: user.name ?? "Make Your Com",
  };
}
