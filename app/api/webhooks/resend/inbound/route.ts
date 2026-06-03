/**
 * Webhook Resend Inbound : reçoit les emails ENTRANTS.
 *
 * Resend POSTe ici à chaque email reçu sur les adresses configurées sur
 * leur Inbound. Format payload : voir https://resend.com/docs/dashboard/webhooks/email-events
 *
 * Logique :
 *  1. Vérifie la signature webhook (HMAC) si RESEND_WEBHOOK_SECRET configuré
 *  2. Parse l'email (from, to, subject, html/text, messageId, threadId)
 *  3. Cherche le prospect par adresse expéditeur (prospect.email match)
 *  4. Cherche l'utilisateur destinataire (contact@ → Arthur, sophie@ → Sophie)
 *  5. Crée :
 *     - Email (direction = ENTRANT, statut = LIVRE)
 *     - Activity (type = EMAIL_RECU, statut = FAIT, liée si prospect trouvé)
 *  6. Si pas de prospect match, on enregistre quand même l'email avec
 *     prospectId = null pour qu'il apparaisse dans /emails (boîte unifiée).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Le payload Resend varie selon l'event :
 *  - Pour `email.*` (sortants) : `data.from` = objet { email, name }, `data.to` = array d'objets
 *  - Pour `email.received` (inbound) : `data.from` = STRING ("Name <addr>"), `data.to` = array de STRINGS
 *
 * On normalise les deux formes via parseAddress() plus bas.
 */
interface ResendInboundPayload {
  type?: string;
  data?: {
    from?: string | { email?: string; name?: string };
    to?: Array<string | { email?: string; name?: string }>;
    subject?: string;
    html?: string;
    text?: string;
    headers?: Record<string, string> | Array<{ name: string; value: string }>;
    message_id?: string;
    created_at?: string;
  };
  // Compat alternatives (anciennes versions de l'API)
  from?: string;
  to?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  messageId?: string;
  message_id?: string;
}

/**
 * Extrait l'adresse email d'une string type "Arthur <a@b.com>" ou d'un objet
 * { email, name }. Retourne { email, name }.
 */
function parseAddress(
  input: string | { email?: string; name?: string } | undefined,
): { email: string | null; name: string } {
  if (!input) return { email: null, name: "" };
  if (typeof input === "string") {
    const trimmed = input.trim();
    // Forme "Name <addr@x>" : extraire ce qui est entre < et >
    const angleMatch = trimmed.match(/^(.*?)<([^<>]+)>\s*$/);
    if (angleMatch) {
      const namePart = angleMatch[1]!.trim().replace(/^"|"$/g, "").trim();
      return { email: angleMatch[2]!.trim().toLowerCase(), name: namePart };
    }
    // Sinon : c'est l'adresse seule
    return { email: trimmed.toLowerCase(), name: "" };
  }
  return { email: input.email?.toLowerCase() ?? null, name: input.name ?? "" };
}

/**
 * Resend peut envoyer headers comme objet { "in-reply-to": "..." } ou
 * comme array [{ name: "In-Reply-To", value: "..." }]. Normalise en map.
 */
function normalizeHeaders(
  headers: Record<string, string> | Array<{ name: string; value: string }> | undefined,
): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
  }
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1. Vérif signature (HMAC SHA-256) si secret configuré
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const signature = req.headers.get("svix-signature") ?? req.headers.get("resend-signature");
    const timestamp = req.headers.get("svix-timestamp");
    if (!signature || !timestamp) {
      console.warn("[resend-inbound] Missing webhook signature headers");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Svix-style signature : "v1,<base64>"
    const signedContent = `${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", secret).update(signedContent).digest("base64");
    const sigPart = signature.split(",").pop() ?? "";
    try {
      if (
        !timingSafeEqual(
          Buffer.from(sigPart),
          Buffer.from(expected),
        )
      ) {
        return NextResponse.json({ error: "Bad signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Bad signature format" }, { status: 401 });
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ──────────────────────────────────────────────────────────────────
  // Gestion des événements EMAIL (sortants) : email.sent, .delivered,
  // .opened, .clicked, .bounced, .complained, .delivery_delayed, .failed
  // On met à jour le statut de l'Email existant en DB.
  //
  // EXCEPTION : `email.received` est l'event INBOUND envoyé par
  // Resend Inbound — il ne représente PAS un changement de statut d'un
  // email sortant, mais l'arrivée d'un nouveau mail à créer en DB.
  // On le laisse traverser jusqu'au handler inbound plus bas.
  // ──────────────────────────────────────────────────────────────────
  const eventType = payload.type ?? "";
  if (eventType.startsWith("email.") && eventType !== "email.received") {
    const data = payload.data as
      | {
          email_id?: string;
          subject?: string;
          to?: string[];
          tags?: Array<{ name: string; value: string }>;
        }
      | undefined;
    const resendEmailId = data?.email_id;
    if (!resendEmailId) {
      return NextResponse.json({ ok: true, note: "no email_id" });
    }
    // Match par label "resend:<id>" qu'on a stocké à l'envoi
    const existing = await prisma.email.findFirst({
      where: { labels: { has: `resend:${resendEmailId}` } },
      select: { id: true, statut: true },
    });
    if (!existing) {
      // Pas un email qu'on a envoyé via le CRM, on ignore
      return NextResponse.json({ ok: true, note: "email not found" });
    }
    const STATUT_MAP: Record<string, string> = {
      "email.sent": "ENVOYE",
      "email.delivered": "LIVRE",
      "email.opened": "OUVERT",
      "email.clicked": "CLIQUE",
      "email.bounced": "REBOND",
      "email.complained": "REBOND",
      "email.failed": "ERREUR",
      "email.delivery_delayed": existing.statut, // pas de changement
    };
    const newStatut = STATUT_MAP[eventType] ?? existing.statut;
    // Ne dégrade jamais : si déjà OUVERT, on ne repasse pas à LIVRE
    const RANK: Record<string, number> = {
      BROUILLON: 0,
      ENVOYE: 1,
      LIVRE: 2,
      OUVERT: 3,
      CLIQUE: 4,
      REPONDU: 5,
      REBOND: 6,
      ERREUR: 6,
    };
    if ((RANK[newStatut] ?? 0) > (RANK[existing.statut] ?? 0)) {
      await prisma.email.update({
        where: { id: existing.id },
        data: { statut: newStatut as never },
      });
    }
    return NextResponse.json({ ok: true, event: eventType });
  }

  // Ignore les événements contact.* et domain.* (pas besoin)
  if (eventType.startsWith("contact.") || eventType.startsWith("domain.")) {
    return NextResponse.json({ ok: true, note: "event ignored" });
  }

  // ──────────────────────────────────────────────────────────────────
  // Sinon : email INBOUND (réception). Normalisation et traitement.
  // ──────────────────────────────────────────────────────────────────

  // Normalisation : Resend peut envoyer plusieurs formes — voir parseAddress()
  const fromParsed = parseAddress(payload.data?.from ?? payload.from);
  const fromEmail = fromParsed.email;
  const fromName = fromParsed.name;

  // to peut être array d'objets, array de strings, ou string
  const rawTo = payload.data?.to ?? payload.to;
  const toEmails: string[] = (
    Array.isArray(rawTo)
      ? rawTo.map((t) => parseAddress(t).email)
      : [parseAddress(rawTo as string).email]
  ).filter((x): x is string => !!x);

  const subject = payload.data?.subject ?? payload.subject ?? "(sans sujet)";

  // ──────────────────────────────────────────────────────────────────
  // Resend Inbound : le webhook ne contient PAS le contenu du mail (juste
  // les métadonnées). Pour récupérer le HTML/text/headers, il faut appeler
  // l'API Receiving avec l'email_id. Doc :
  // https://resend.com/docs/dashboard/receiving/get-email-content
  // ──────────────────────────────────────────────────────────────────
  let html = payload.data?.html ?? payload.html ?? "";
  let text = payload.data?.text ?? payload.text ?? "";
  let fetchedHeaders: Record<string, string> = normalizeHeaders(
    payload.data?.headers ?? payload.headers,
  );

  const inboundEmailId = (payload.data as { email_id?: string } | undefined)?.email_id;
  if (inboundEmailId && (!html || !text)) {
    try {
      const res = await fetch(
        `https://api.resend.com/emails/receiving/${inboundEmailId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.ok) {
        const fetched = (await res.json()) as {
          html?: string;
          text?: string;
          headers?: Record<string, string> | Array<{ name: string; value: string }>;
        };
        if (!html && fetched.html) html = fetched.html;
        if (!text && fetched.text) text = fetched.text;
        if (fetched.headers) {
          fetchedHeaders = {
            ...fetchedHeaders,
            ...normalizeHeaders(fetched.headers),
          };
        }
      } else {
        console.warn(
          `[resend-inbound] Failed to fetch email body (${res.status})`,
          await res.text().catch(() => ""),
        );
      }
    } catch (err) {
      console.warn("[resend-inbound] Error fetching email body", err);
    }
  }

  // Fallback : texte depuis HTML si rien d'autre
  if (!text && html) {
    text = html.replace(/<[^>]+>/g, "").slice(0, 5000);
  }

  const headers = fetchedHeaders;
  const messageId =
    payload.data?.message_id ??
    payload.message_id ??
    payload.messageId ??
    headers["message-id"] ??
    `<inbound.${randomBytes(8).toString("hex")}.${Date.now()}@resend>`;
  const inReplyToHeader = headers["in-reply-to"] ?? null;

  if (!fromEmail || toEmails.length === 0) {
    console.warn("[resend-inbound] Payload missing from/to", {
      fromEmail,
      toEmails,
      rawPayloadKeys: Object.keys(payload),
      dataKeys: payload.data ? Object.keys(payload.data) : null,
    });
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  try {
    // Cherche le prospect par adresse email expéditeur (le client qui a répondu)
    const prospect = await prisma.prospect.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" } },
      select: { id: true, assigneAId: true, raisonSociale: true },
    });

    // Cherche le user CRM destinataire : on prend le 1er to qui matche un user
    const destEmail = toEmails[0]!.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: destEmail, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    const userId = user?.id ?? prospect?.assigneAId ?? null;

    // Recherche thread parent (si réponse à un email sortant qu'on a envoyé)
    let threadId: string | null = null;
    if (inReplyToHeader) {
      const parent = await prisma.email.findFirst({
        where: { messageId: inReplyToHeader },
        select: { threadId: true },
      });
      threadId = parent?.threadId ?? null;
    }
    if (!threadId) threadId = randomBytes(8).toString("hex");

    if (!userId) {
      // Pas de user identifié : on enregistre quand même mais sans userId.
      // Ça ne devrait pas arriver si la config Resend est OK (toEmail =
      // contact@ ou sophie@ qui matchent toujours un user).
      // Si jamais : on logge et on bail proprement.
      console.warn("[resend-inbound] Aucun user trouvé pour", destEmail);
      return NextResponse.json({ ok: false, reason: "no-user-match" }, { status: 200 });
    }

    const email = await prisma.email.create({
      data: {
        prospectId: prospect?.id ?? null,
        userId,
        direction: "ENTRANT",
        threadId,
        messageId,
        inReplyTo: inReplyToHeader ?? undefined,
        expediteurEmail: fromEmail,
        expediteurNom: fromName ?? "",
        destinataireEmail: destEmail,
        objet: subject,
        contenuHtml: html,
        contenuTexte: text,
        statut: "LIVRE",
        envoyeLe: payload.data?.created_at ? new Date(payload.data.created_at) : new Date(),
        labels: ["inbound:resend"],
        lu: false, // Email entrant = non-lu par défaut
      },
    });

    // Récupère les pièces jointes via l'API Resend Receiving et les
    // stocke sur Vercel Blob (les URL Resend expirent). Ignore les
    // attachments AMP/inline injectés par Gmail/Google qu'on ne veut pas
    // afficher comme pièces jointes utilisateur.
    if (inboundEmailId && process.env.RESEND_API_KEY) {
      try {
        const attRes = await fetch(
          `https://api.resend.com/emails/receiving/${inboundEmailId}/attachments`,
          {
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
          },
        );
        if (attRes.ok) {
          const attJson = (await attRes.json()) as {
            data?: Array<{
              id: string;
              content_type?: string;
              filename?: string;
              size?: number;
              download_url?: string;
            }>;
          };
          for (const att of attJson.data ?? []) {
            // Skip les AMP HTML automatiques (Google les ajoute)
            if (att.content_type === "text/x-amp-html") continue;
            if (!att.download_url) continue;

            try {
              const fileRes = await fetch(att.download_url);
              if (!fileRes.ok) continue;
              const buffer = await fileRes.arrayBuffer();
              const filename = att.filename ?? `attachment-${att.id}`;
              const safeName = filename.replace(/[^\w.\-]/g, "_");
              const blob = await put(
                `email-attachments/inbound/${email.id}/${safeName}`,
                Buffer.from(buffer),
                {
                  access: "public",
                  contentType: att.content_type ?? "application/octet-stream",
                  addRandomSuffix: true,
                },
              );
              await prisma.emailAttachment.create({
                data: {
                  emailId: email.id,
                  nom: filename,
                  taille: att.size ?? buffer.byteLength,
                  mimeType: att.content_type ?? "application/octet-stream",
                  url: blob.url,
                },
              });
            } catch (attErr) {
              console.warn(
                `[resend-inbound] Échec import pièce jointe ${att.id}`,
                attErr,
              );
            }
          }
        }
      } catch (err) {
        console.warn("[resend-inbound] Erreur fetch attachments", err);
      }
    }

    // Activity auto si on a un prospect lié
    if (prospect) {
      await prisma.activity.create({
        data: {
          prospectId: prospect.id,
          userId,
          type: "EMAIL_RECU",
          date: new Date(),
          sujet: subject,
          contenu: text.slice(0, 500),
          statut: "FAIT",
          emailId: email.id,
        },
      });
    }

    console.log(
      `[resend-inbound] ✓ Email reçu de ${fromEmail} → ${destEmail} (prospect=${prospect?.raisonSociale ?? "—"})`,
    );

    return NextResponse.json({ ok: true, emailId: email.id });
  } catch (err) {
    console.error("[resend-inbound] Error processing:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
