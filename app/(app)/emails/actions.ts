"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { htmlToPlainText, sanitizeEmailHtml } from "@/lib/email-html";
import { resolveFromAddress, sendMail } from "@/lib/mailer";
import { requireUser } from "@/lib/session";

const AttachmentSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
});

const SendEmailSchema = z.object({
  prospectId: z.string().min(1),
  templateId: z.string().optional(),
  objet: z.string().min(1),
  contenu: z.string().min(1),
  /** Corps riche (gras/italique/…) — optionnel ; prime sur le texte brut. */
  contenuHtml: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  /** Signature email à ajouter (id d'une EmailSignature de l'utilisateur). */
  signatureId: z.string().optional(),
});

const SendFreeFormEmailSchema = z.object({
  to: z.string().trim().toLowerCase().email("Adresse email invalide."),
  objet: z.string().min(1),
  contenu: z.string().min(1),
  /** Corps riche (gras/italique/…) — optionnel ; prime sur le texte brut. */
  contenuHtml: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Marqueur de brouillon « vrai » (créé volontairement via « Enregistrer le
 * brouillon »), pour le distinguer d'un mail enregistré en BROUILLON par le
 * mode dry-run. Stocké dans Email.labels.
 */
const DRAFT_LABEL = "draft";

const SaveDraftSchema = z.object({
  /** Si fourni → on met à jour un brouillon existant au lieu d'en créer un. */
  draftId: z.string().optional(),
  /** Destinataire = client enregistré… */
  prospectId: z.string().optional(),
  /** …ou adresse libre. */
  to: z.string().optional(),
  objet: z.string().optional(),
  contenu: z.string().optional(),
  /** Corps riche (gras/italique/…) — optionnel. */
  contenuHtml: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export interface SendEmailResult {
  ok: boolean;
  emailId?: string;
  error?: string;
  dryRun?: boolean;
}

/**
 * Envoie (ou simule en dry-run) un email à un prospect.
 *
 * En mode dry-run (EMAIL_MODE !== "live"), on enregistre juste l'email en
 * base avec statut ENVOYE et on log côté serveur — sans appeler Resend.
 * À l'étape 26 V2 : intégration réelle Resend + webhooks inbound.
 */
export async function sendEmailToProspect(
  input: unknown,
): Promise<SendEmailResult> {
  const user = await requireUser();
  const parsed = SendEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.data.prospectId },
    select: {
      id: true,
      assigneAId: true,
      email: true,
      raisonSociale: true,
      contactPrenom: true,
      contactNom: true,
      ville: true,
    },
  });
  if (!prospect) return { ok: false, error: "Prospect introuvable." };
  if (!prospect.email) {
    return {
      ok: false,
      error: "Pas d'email connu pour ce prospect — ajoute-le d'abord.",
    };
  }
  if (user.role !== "ADMIN" && prospect.assigneAId !== user.id) {
    return { ok: false, error: "Pas d'accès à ce prospect." };
  }

  // Variables : remplit {{prenomContact}} etc.
  const vars: Record<string, string> = {
    prenomContact: prospect.contactPrenom ?? "",
    nomContact: prospect.contactNom ?? "",
    raisonSociale: prospect.raisonSociale,
    ville: prospect.ville ?? "",
    commerciale: user.name,
  };
  const apply = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");

  const objet = apply(parsed.data.objet);
  const contenuTexte = apply(parsed.data.contenu);
  // Corps riche fourni (gras/italique/…) → on l'utilise (nettoyé) ; sinon on
  // enveloppe le texte brut dans un <pre> comme historiquement.
  const richHtml = parsed.data.contenuHtml
    ? sanitizeEmailHtml(apply(parsed.data.contenuHtml))
    : "";
  const contenuHtmlBase = richHtml
    ? richHtml
    : `<pre style="font-family: sans-serif; white-space: pre-wrap;">${contenuTexte.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;

  // Signature email choisie (scopée à l'utilisateur) — ajoutée au contenu.
  let signatureHtml = "";
  let signatureText = "";
  if (parsed.data.signatureId) {
    const sig = await prisma.emailSignature.findFirst({
      where: { id: parsed.data.signatureId, userId: user.id },
      select: { html: true },
    });
    if (sig) {
      signatureHtml = `<br /><br />${sig.html}`;
      signatureText = `\n\n-- \n${sig.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`;
    }
  }
  const contenuHtml = contenuHtmlBase + signatureHtml;
  const contenuTexteFinal = contenuTexte + signatureText;

  // Récupère le from
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });

  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;
  const threadId = randomBytes(8).toString("hex");

  // Résout l'adresse From selon le user (Arthur → contact@, Sophie → sophie@)
  const { from, replyTo, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });

  // Envoi réel via Resend (avec BCC auto vers expéditeur pour copie Gmail).
  // En dry-run, sendMail() log et renvoie ok=true sans envoyer.
  const attachments = parsed.data.attachments ?? [];
  const sendResult = await sendMail({
    from,
    fromName,
    to: prospect.email,
    subject: objet,
    html: contenuHtml,
    text: contenuTexteFinal,
    replyTo,
    messageId,
    attachments:
      attachments.length > 0
        ? attachments.map((a) => ({
            filename: a.filename,
            path: a.url,
            contentType: a.mimeType,
          }))
        : undefined,
  });
  const isDryRun = sendResult.dryRun;

  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  // Crée l'enregistrement + les attachments persistés
  const created = await prisma.email.create({
    data: {
      prospectId: prospect.id,
      userId: user.id,
      direction: "SORTANT",
      threadId,
      messageId,
      expediteurEmail: from,
      expediteurNom: fromName,
      destinataireEmail: prospect.email,
      objet,
      contenuHtml,
      contenuTexte: contenuTexteFinal,
      statut: isDryRun ? "BROUILLON" : "ENVOYE",
      envoyeLe: isDryRun ? null : new Date(),
      templateUtiliseId: parsed.data.templateId || null,
      labels: sendResult.resendId ? [`resend:${sendResult.resendId}`] : [],
      attachments:
        attachments.length > 0
          ? {
              create: attachments.map((a) => ({
                nom: a.filename,
                taille: a.size,
                mimeType: a.mimeType,
                url: a.url,
              })),
            }
          : undefined,
    },
  });

  // Crée aussi l'Activity correspondante
  await prisma.activity.create({
    data: {
      prospectId: prospect.id,
      userId: user.id,
      type: "EMAIL_ENVOYE",
      date: new Date(),
      sujet: objet,
      contenu: contenuTexte.slice(0, 200),
      statut: "FAIT",
      emailId: created.id,
    },
  });

  revalidatePath(`/prospects/${prospect.id}`);
  revalidatePath("/emails");
  revalidatePath("/activites");

  return { ok: true, emailId: created.id, dryRun: isDryRun };
}

/**
 * Envoie un email à une adresse libre (pas forcément un prospect enregistré).
 *
 * Le mail est créé en DB avec prospectId=null. Si l'adresse correspond à
 * un prospect existant, on le rattache automatiquement (et on crée
 * l'activité EMAIL_ENVOYE associée).
 */
export async function sendFreeFormEmail(
  input: unknown,
): Promise<SendEmailResult> {
  const user = await requireUser();
  const parsed = SendFreeFormEmailSchema.safeParse(input);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message ?? "Formulaire invalide.";
    return { ok: false, error: firstErr };
  }

  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });

  const { from, replyTo, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });

  // Auto-rattachement si l'adresse correspond à un prospect existant
  // (et que le user y a accès). Sinon on garde prospectId=null.
  let prospectId: string | null = null;
  const prospectMatch = await prisma.prospect.findFirst({
    where: { email: { equals: parsed.data.to, mode: "insensitive" } },
    select: { id: true, assigneAId: true },
  });
  if (prospectMatch) {
    if (user.role === "ADMIN" || prospectMatch.assigneAId === user.id) {
      prospectId = prospectMatch.id;
    }
    // Si la commerciale n'a pas accès, on n'auto-rattache PAS — admin
    // peut le faire manuellement plus tard via attachEmailToProspect.
  }

  const objet = parsed.data.objet.trim();
  const contenuTexte = parsed.data.contenu.trim();
  const richHtml = parsed.data.contenuHtml
    ? sanitizeEmailHtml(parsed.data.contenuHtml)
    : "";
  const contenuHtml = richHtml
    ? richHtml
    : `<pre style="font-family: sans-serif; white-space: pre-wrap;">${contenuTexte
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;

  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;
  const threadId = randomBytes(8).toString("hex");

  const attachments = parsed.data.attachments ?? [];
  const sendResult = await sendMail({
    from,
    fromName,
    to: parsed.data.to,
    subject: objet,
    html: contenuHtml,
    text: contenuTexte,
    replyTo,
    messageId,
    attachments:
      attachments.length > 0
        ? attachments.map((a) => ({
            filename: a.filename,
            path: a.url,
            contentType: a.mimeType,
          }))
        : undefined,
  });
  const isDryRun = sendResult.dryRun;

  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  const created = await prisma.email.create({
    data: {
      prospectId,
      userId: user.id,
      direction: "SORTANT",
      threadId,
      messageId,
      expediteurEmail: from,
      expediteurNom: fromName,
      destinataireEmail: parsed.data.to,
      objet,
      contenuHtml,
      contenuTexte,
      statut: isDryRun ? "BROUILLON" : "ENVOYE",
      envoyeLe: isDryRun ? null : new Date(),
      labels: sendResult.resendId ? [`resend:${sendResult.resendId}`] : [],
      attachments:
        attachments.length > 0
          ? {
              create: attachments.map((a) => ({
                nom: a.filename,
                taille: a.size,
                mimeType: a.mimeType,
                url: a.url,
              })),
            }
          : undefined,
    },
  });

  // Activity si rattaché à un prospect
  if (prospectId) {
    await prisma.activity.create({
      data: {
        prospectId,
        userId: user.id,
        type: "EMAIL_ENVOYE",
        date: new Date(),
        sujet: objet,
        contenu: contenuTexte.slice(0, 500),
        statut: "FAIT",
        emailId: created.id,
      },
    });
    revalidatePath(`/prospects/${prospectId}`);
  }

  revalidatePath("/emails");
  revalidatePath("/activites");

  return { ok: true, emailId: created.id, dryRun: isDryRun };
}

/**
 * Répond à un email existant (entrant ou sortant).
 * Reprend le thread et le destinataire approprié.
 */
export async function replyToEmail(
  emailId: string,
  contenu: string,
  objetOverride?: string,
  attachmentsInput?: Array<{ url: string; filename: string; mimeType: string; size: number }>,
  contenuHtmlInput?: string,
): Promise<SendEmailResult> {
  const user = await requireUser();
  const original = await prisma.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      threadId: true,
      messageId: true,
      direction: true,
      objet: true,
      userId: true,
      expediteurEmail: true,
      destinataireEmail: true,
      prospect: {
        select: {
          id: true,
          email: true,
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
          ville: true,
          assigneAId: true,
        },
      },
    },
  });
  if (!original) return { ok: false, error: "Email original introuvable." };
  if (user.role !== "ADMIN" && original.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }

  // À qui on répond ?
  //   - Si l'original est ENTRANT (client → nous) : on répond au expediteurEmail
  //   - Si l'original est SORTANT (nous → client) : on répond au destinataireEmail
  const replyTo =
    original.direction === "ENTRANT"
      ? original.expediteurEmail
      : original.destinataireEmail;

  // Variables pour le template (si prospect lié)
  const vars: Record<string, string> = {
    prenomContact: original.prospect?.contactPrenom ?? "",
    nomContact: original.prospect?.contactNom ?? "",
    raisonSociale: original.prospect?.raisonSociale ?? "",
    ville: original.prospect?.ville ?? "",
    commerciale: user.name,
  };
  const apply = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");

  // Objet : prefix "Re: " si pas déjà présent
  const objetBase = objetOverride?.trim() || original.objet;
  const objet = apply(
    objetBase.toLowerCase().startsWith("re:")
      ? objetBase
      : `Re: ${objetBase}`,
  );

  const contenuTexte = apply(contenu);
  const richHtml = contenuHtmlInput
    ? sanitizeEmailHtml(apply(contenuHtmlInput))
    : "";
  const contenuHtml = richHtml
    ? richHtml
    : `<pre style="font-family: sans-serif; white-space: pre-wrap;">${contenuTexte
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;

  // Adresse expéditeur (Arthur ou Sophie selon user connecté)
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  const { from, replyTo: replyToHeader, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });

  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;

  const attachmentsValidated = (attachmentsInput ?? []).filter((a) => a.url && a.filename);

  const sendResult = await sendMail({
    from,
    fromName,
    to: replyTo,
    subject: objet,
    html: contenuHtml,
    text: contenuTexte,
    replyTo: replyToHeader,
    messageId,
    inReplyTo: original.messageId,
    attachments:
      attachmentsValidated.length > 0
        ? attachmentsValidated.map((a) => ({
            filename: a.filename,
            path: a.url,
            contentType: a.mimeType,
          }))
        : undefined,
  });
  const isDryRun = sendResult.dryRun;

  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  // Crée l'email de réponse dans le même thread (+ attachments si fournis)
  const created = await prisma.email.create({
    data: {
      prospectId: original.prospect?.id ?? null,
      userId: user.id,
      direction: "SORTANT",
      threadId: original.threadId, // même thread !
      messageId,
      inReplyTo: original.messageId,
      expediteurEmail: from,
      expediteurNom: fromName,
      destinataireEmail: replyTo,
      objet,
      contenuHtml,
      contenuTexte,
      statut: isDryRun ? "BROUILLON" : "ENVOYE",
      envoyeLe: isDryRun ? null : new Date(),
      labels: sendResult.resendId ? [`resend:${sendResult.resendId}`] : [],
      attachments:
        attachmentsValidated.length > 0
          ? {
              create: attachmentsValidated.map((a) => ({
                nom: a.filename,
                taille: a.size,
                mimeType: a.mimeType,
                url: a.url,
              })),
            }
          : undefined,
    },
  });

  // Activity
  if (original.prospect) {
    await prisma.activity.create({
      data: {
        prospectId: original.prospect.id,
        userId: user.id,
        type: "EMAIL_ENVOYE",
        date: new Date(),
        sujet: objet,
        contenu: contenuTexte.slice(0, 200),
        statut: "FAIT",
        emailId: created.id,
      },
    });
  }

  revalidatePath("/emails");
  if (original.prospect) {
    revalidatePath(`/prospects/${original.prospect.id}`);
  }

  return { ok: true, emailId: created.id, dryRun: isDryRun };
}

/**
 * Marque un email comme lu côté CRM.
 * Appelé quand l'utilisateur ouvre un thread dans la boîte de réception.
 * No-op si l'email est déjà lu.
 */
export async function markEmailRead(
  emailId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: { userId: true, lu: true },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  // Mailbox privée : seul le propriétaire du mail peut agir dessus,
  // même un admin n'a pas le droit (cf. confidentialité commerciale).
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  if (email.lu) return { ok: true }; // no-op
  await prisma.email.update({
    where: { id: emailId },
    data: { lu: true, luALe: new Date() },
  });
  revalidatePath("/emails");
  return { ok: true };
}

/**
 * Marque tous les threads d'un thread (par threadId) comme lus.
 * Utile quand on ouvre un thread qui contient plusieurs messages non lus.
 */
export async function markThreadRead(
  threadId: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await requireUser();
  const result = await prisma.email.updateMany({
    where: {
      threadId,
      lu: false,
      userId: user.id, // mailbox privée, même pour admin
    },
    data: { lu: true, luALe: new Date() },
  });
  if (result.count > 0) revalidatePath("/emails");
  return { ok: true, count: result.count };
}

/**
 * Rattache un email à un prospect (manuellement) ou détache (prospectId=null).
 *
 * Utile pour les emails entrants qui arrivent sans match automatique : le
 * commercial peut les associer à un client après coup. Crée aussi une
 * activité EMAIL_RECU/EMAIL_ENVOYE rétrospective sur la fiche prospect.
 */
export async function attachEmailToProspect(
  emailId: string,
  prospectId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      userId: true,
      prospectId: true,
      direction: true,
      objet: true,
      contenuTexte: true,
      envoyeLe: true,
      createdAt: true,
    },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  // Mailbox privée : seul le propriétaire du mail peut agir dessus,
  // même un admin n'a pas le droit (cf. confidentialité commerciale).
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }

  // Si on rattache (prospectId fourni), vérifie qu'il existe et qu'on y a accès
  if (prospectId) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, assigneAId: true },
    });
    if (!prospect) return { ok: false, error: "Client introuvable." };
    if (user.role !== "ADMIN" && prospect.assigneAId !== user.id) {
      return { ok: false, error: "Pas d'accès à ce client." };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Met à jour le prospectId de l'email
    await tx.email.update({
      where: { id: emailId },
      data: { prospectId },
    });

    // Si on détache (null), supprime l'activity liée s'il y en a une
    if (prospectId === null) {
      await tx.activity.deleteMany({ where: { emailId } });
    } else {
      // Sinon : crée l'activity rétrospective si elle n'existe pas
      const existingAct = await tx.activity.findFirst({ where: { emailId } });
      if (!existingAct) {
        await tx.activity.create({
          data: {
            prospectId,
            userId: email.userId ?? user.id,
            type: email.direction === "ENTRANT" ? "EMAIL_RECU" : "EMAIL_ENVOYE",
            date: email.envoyeLe ?? email.createdAt,
            sujet: email.objet,
            contenu: email.contenuTexte.slice(0, 500),
            statut: "FAIT",
            emailId,
          },
        });
      } else {
        // Si elle existe mais pointait sur un autre prospect, on la déplace
        await tx.activity.updateMany({
          where: { emailId },
          data: { prospectId },
        });
      }
    }
  });

  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  if (prospectId) revalidatePath(`/prospects/${prospectId}`);
  return { ok: true };
}

/**
 * Recherche prospects pour le sélecteur d'attribution.
 * Renvoie max 20 résultats, scope user (commercial ne voit que ses prospects).
 */
export async function searchProspectsForAttach(
  query: string,
): Promise<
  Array<{ id: string; raisonSociale: string; ville: string | null; email: string | null }>
> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 1) return [];
  const prospects = await prisma.prospect.findMany({
    where: {
      ...(user.role !== "ADMIN" ? { assigneAId: user.id } : {}),
      OR: [
        { raisonSociale: { contains: q, mode: "insensitive" } },
        { contactPrenom: { contains: q, mode: "insensitive" } },
        { contactNom: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { ville: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, raisonSociale: true, ville: true, email: true },
    orderBy: { raisonSociale: "asc" },
    take: 20,
  });
  return prospects;
}

/**
 * Archive un email : le retire de la boîte de réception (/emails) tout en
 * conservant l'enregistrement en DB et son lien avec le prospect (visible
 * sur la fiche client). Utile pour nettoyer son inbox sans perdre
 * l'historique commercial.
 *
 * Toggle `archive` : si true, on annule l'archivage (renvoie dans l'inbox).
 */
export async function setEmailArchive(
  id: string,
  archive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id },
    select: { userId: true, prospectId: true },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  await prisma.email.update({
    where: { id },
    data: {
      archive,
      archiveALe: archive ? new Date() : null,
    },
  });
  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  return { ok: true };
}

/**
 * Archive tous les mails d'un thread en une fois.
 */
export async function archiveThread(
  threadId: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await requireUser();
  const result = await prisma.email.updateMany({
    where: { threadId, userId: user.id },
    data: { archive: true, archiveALe: new Date() },
  });
  revalidatePath("/emails");
  return { ok: true, count: result.count };
}

/**
 * Met un email à la corbeille (soft-delete) : il disparaît de la boîte de
 * réception mais reste restaurable depuis la Corbeille. Aucune destruction —
 * la purge définitive se fait via `purgeEmail`.
 * RLS : uniquement le propriétaire du mail (mailbox privée).
 */
export async function deleteEmail(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id },
    select: { userId: true, prospectId: true },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  // Mailbox privée : seul le propriétaire du mail peut agir dessus,
  // même un admin n'a pas le droit (cf. confidentialité commerciale).
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  await prisma.email.update({
    where: { id },
    data: { supprime: true, supprimeeLe: new Date() },
  });
  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  return { ok: true };
}

/**
 * Restaure un email depuis la corbeille (il repart dans son dossier d'origine).
 * RLS : propriétaire uniquement.
 */
export async function restoreEmail(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id },
    select: { userId: true, prospectId: true },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  await prisma.email.update({
    where: { id },
    data: { supprime: false, supprimeeLe: null },
  });
  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  return { ok: true };
}

/**
 * Restaure en masse tous les emails d'une liste de threads (scopé user).
 */
export async function restoreThreadsBulk(
  threadIds: string[],
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await requireUser();
  if (threadIds.length === 0) return { ok: true, count: 0 };
  const result = await prisma.email.updateMany({
    where: { threadId: { in: threadIds }, userId: user.id, supprime: true },
    data: { supprime: false, supprimeeLe: null },
  });
  revalidatePath("/emails");
  return { ok: true, count: result.count };
}

/**
 * Supprime DÉFINITIVEMENT un email — uniquement s'il est déjà à la corbeille.
 * Vrai delete en base (irréversible).
 */
export async function purgeEmail(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = await prisma.email.findUnique({
    where: { id },
    select: { userId: true, prospectId: true, supprime: true },
  });
  if (!email) return { ok: false, error: "Email introuvable." };
  if (email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  if (!email.supprime) {
    return {
      ok: false,
      error: "Mets d'abord l'email à la corbeille avant de le purger.",
    };
  }
  await prisma.email.delete({ where: { id } });
  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  return { ok: true };
}

/**
 * Vide la corbeille : supprime définitivement tous les emails déjà à la
 * corbeille de l'utilisateur. Renvoie le nombre purgé.
 */
export async function emptyTrash(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  const user = await requireUser();
  const impacted = await prisma.email.findMany({
    where: { userId: user.id, supprime: true },
    select: { prospectId: true },
  });
  const result = await prisma.email.deleteMany({
    where: { userId: user.id, supprime: true },
  });
  revalidatePath("/emails");
  for (const pid of new Set(impacted.map((e) => e.prospectId).filter(Boolean))) {
    revalidatePath(`/prospects/${pid}`);
  }
  return { ok: true, count: result.count };
}

/**
 * Archive en masse tous les emails d'une liste de threads (mailbox privée :
 * scopé sur l'utilisateur connecté). Utilisé par la sélection multiple de
 * l'inbox. Renvoie le nombre de messages archivés.
 */
export async function archiveThreadsBulk(
  threadIds: string[],
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await requireUser();
  if (threadIds.length === 0) return { ok: true, count: 0 };
  const result = await prisma.email.updateMany({
    where: { threadId: { in: threadIds }, userId: user.id },
    data: { archive: true, archiveALe: new Date() },
  });
  revalidatePath("/emails");
  return { ok: true, count: result.count };
}

/**
 * Met à la corbeille (soft-delete) tous les emails d'une liste de threads
 * (scopé sur l'utilisateur connecté). Utilisé par la sélection multiple de
 * l'inbox. Réversible via la Corbeille.
 */
export async function deleteThreadsBulk(
  threadIds: string[],
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await requireUser();
  if (threadIds.length === 0) return { ok: true, count: 0 };
  // Récupère les prospectIds impactés pour revalider leurs fiches.
  const impacted = await prisma.email.findMany({
    where: { threadId: { in: threadIds }, userId: user.id },
    select: { prospectId: true },
  });
  const result = await prisma.email.updateMany({
    where: { threadId: { in: threadIds }, userId: user.id, supprime: false },
    data: { supprime: true, supprimeeLe: new Date() },
  });
  revalidatePath("/emails");
  for (const pid of new Set(impacted.map((e) => e.prospectId).filter(Boolean))) {
    revalidatePath(`/prospects/${pid}`);
  }
  return { ok: true, count: result.count };
}

const PRE_HTML = (txt: string) =>
  `<pre style="font-family: sans-serif; white-space: pre-wrap;">${txt
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;

/**
 * Enregistre un message en brouillon (sans l'envoyer) pour le terminer/l'envoyer
 * plus tard. Crée un nouvel Email BROUILLON, ou met à jour un brouillon existant
 * si `draftId` est fourni. Le destinataire peut être un client (`prospectId`) ou
 * une adresse libre (`to`). Les pièces jointes sont persistées.
 */
export async function saveEmailDraft(input: unknown): Promise<SendEmailResult> {
  const user = await requireUser();
  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };

  const { draftId, prospectId, to, attachments } = parsed.data;
  const objet = (parsed.data.objet ?? "").trim();
  const richHtml = parsed.data.contenuHtml
    ? sanitizeEmailHtml(parsed.data.contenuHtml)
    : "";
  // Texte brut : fourni, sinon dérivé du HTML riche (pour la partie text/plain).
  const contenu = ((parsed.data.contenu ?? "") || htmlToPlainText(richHtml)).trim();

  if (!objet && !contenu) {
    return { ok: false, error: "Rien à enregistrer (sujet et contenu vides)." };
  }

  // Résout le destinataire (client enregistré ou adresse libre).
  let destinataireEmail = "";
  let resolvedProspectId: string | null = null;
  if (prospectId) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, email: true, assigneAId: true },
    });
    if (!prospect) return { ok: false, error: "Client introuvable." };
    if (user.role !== "ADMIN" && prospect.assigneAId !== user.id) {
      return { ok: false, error: "Pas d'accès à ce client." };
    }
    destinataireEmail = prospect.email ?? "";
    resolvedProspectId = prospect.id;
  } else if (to && /^\S+@\S+\.\S+$/.test(to.trim())) {
    destinataireEmail = to.trim();
  } else {
    return { ok: false, error: "Choisis un destinataire." };
  }

  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  const { from, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });

  const objetStored = objet || "(brouillon sans objet)";
  const contenuHtml = richHtml || PRE_HTML(contenu);
  const attachmentsCreate =
    attachments && attachments.length > 0
      ? {
          create: attachments.map((a) => ({
            nom: a.filename,
            taille: a.size,
            mimeType: a.mimeType,
            url: a.url,
          })),
        }
      : undefined;

  // --- Mise à jour d'un brouillon existant ---
  if (draftId) {
    const existing = await prisma.email.findUnique({
      where: { id: draftId },
      select: { userId: true, statut: true, labels: true },
    });
    if (!existing) return { ok: false, error: "Brouillon introuvable." };
    if (existing.userId !== user.id) return { ok: false, error: "Accès refusé." };
    if (existing.statut !== "BROUILLON") {
      return { ok: false, error: "Ce message a déjà été envoyé." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.emailAttachment.deleteMany({ where: { emailId: draftId } });
      await tx.email.update({
        where: { id: draftId },
        data: {
          prospectId: resolvedProspectId,
          destinataireEmail,
          objet: objetStored,
          contenuTexte: contenu,
          contenuHtml,
          labels: existing.labels.includes(DRAFT_LABEL)
            ? existing.labels
            : [...existing.labels, DRAFT_LABEL],
          attachments: attachmentsCreate,
        },
      });
    });
    revalidatePath("/emails");
    return { ok: true, emailId: draftId };
  }

  // --- Nouveau brouillon ---
  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;
  const threadId = randomBytes(8).toString("hex");
  const created = await prisma.email.create({
    data: {
      prospectId: resolvedProspectId,
      userId: user.id,
      direction: "SORTANT",
      threadId,
      messageId,
      expediteurEmail: from,
      expediteurNom: fromName,
      destinataireEmail,
      objet: objetStored,
      contenuHtml,
      contenuTexte: contenu,
      statut: "BROUILLON",
      envoyeLe: null,
      labels: [DRAFT_LABEL],
      attachments: attachmentsCreate,
    },
  });
  revalidatePath("/emails");
  return { ok: true, emailId: created.id };
}

/**
 * Envoie un brouillon précédemment enregistré. Reprend le contenu/les PJ stockés,
 * substitue les variables {{…}} si un client est lié, envoie via Resend, puis
 * bascule le mail en ENVOYE (ou le laisse en brouillon en mode dry-run).
 */
export async function sendDraft(draftId: string): Promise<SendEmailResult> {
  const user = await requireUser();
  const draft = await prisma.email.findUnique({
    where: { id: draftId },
    include: {
      attachments: true,
      prospect: {
        select: {
          id: true,
          email: true,
          contactPrenom: true,
          contactNom: true,
          raisonSociale: true,
          ville: true,
        },
      },
    },
  });
  if (!draft) return { ok: false, error: "Brouillon introuvable." };
  if (draft.userId !== user.id) return { ok: false, error: "Accès refusé." };
  if (draft.statut !== "BROUILLON") {
    return { ok: false, error: "Ce message a déjà été envoyé." };
  }
  const destinataire = draft.destinataireEmail?.trim();
  if (!destinataire || !/^\S+@\S+\.\S+$/.test(destinataire)) {
    return { ok: false, error: "Destinataire manquant ou invalide." };
  }
  if (!draft.contenuTexte.trim()) {
    return { ok: false, error: "Le brouillon est vide." };
  }

  const vars: Record<string, string> = {
    prenomContact: draft.prospect?.contactPrenom ?? "",
    nomContact: draft.prospect?.contactNom ?? "",
    raisonSociale: draft.prospect?.raisonSociale ?? "",
    ville: draft.prospect?.ville ?? "",
    commerciale: user.name,
  };
  const apply = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");

  const objet = apply(draft.objet);
  const contenuTexte = apply(draft.contenuTexte);
  // Le brouillon stocke déjà le HTML (riche si mis en forme, sinon <pre>) ;
  // on applique juste les variables {{…}}. Repli sur <pre> si vide.
  const contenuHtml = draft.contenuHtml
    ? apply(draft.contenuHtml)
    : PRE_HTML(contenuTexte);

  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  const { from, replyTo, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });

  const sendResult = await sendMail({
    from,
    fromName,
    to: destinataire,
    subject: objet,
    html: contenuHtml,
    text: contenuTexte,
    replyTo,
    messageId: draft.messageId,
    attachments:
      draft.attachments.length > 0
        ? draft.attachments.map((a) => ({
            filename: a.nom,
            path: a.url,
            contentType: a.mimeType,
          }))
        : undefined,
  });
  const isDryRun = sendResult.dryRun;
  if (!sendResult.ok && !isDryRun) {
    return { ok: false, error: sendResult.error ?? "Échec d'envoi via Resend." };
  }

  // En envoi réel : retire le marqueur draft + passe en ENVOYE.
  // En dry-run : on garde le brouillon tel quel (pas de vrai envoi).
  const labels = isDryRun
    ? draft.labels
    : draft.labels.filter((l) => l !== DRAFT_LABEL);
  if (!isDryRun && sendResult.resendId) labels.push(`resend:${sendResult.resendId}`);

  await prisma.email.update({
    where: { id: draftId },
    data: {
      objet,
      contenuTexte,
      contenuHtml,
      statut: isDryRun ? "BROUILLON" : "ENVOYE",
      envoyeLe: isDryRun ? null : new Date(),
      labels,
    },
  });

  if (!isDryRun && draft.prospect) {
    await prisma.activity.create({
      data: {
        prospectId: draft.prospect.id,
        userId: user.id,
        type: "EMAIL_ENVOYE",
        date: new Date(),
        sujet: objet,
        contenu: contenuTexte.slice(0, 200),
        statut: "FAIT",
        emailId: draft.id,
      },
    });
    revalidatePath(`/prospects/${draft.prospect.id}`);
  }

  revalidatePath("/emails");
  revalidatePath("/activites");
  return { ok: true, emailId: draft.id, dryRun: isDryRun };
}
