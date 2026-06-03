"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { resolveFromAddress, sendMail } from "@/lib/mailer";
import { requireUser } from "@/lib/session";

const SendEmailSchema = z.object({
  prospectId: z.string().min(1),
  templateId: z.string().optional(),
  objet: z.string().min(1),
  contenu: z.string().min(1),
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
  const contenuHtml = `<pre style="font-family: sans-serif; white-space: pre-wrap;">${contenuTexte.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;

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
  const sendResult = await sendMail({
    from,
    fromName,
    to: prospect.email,
    subject: objet,
    html: contenuHtml,
    text: contenuTexte,
    replyTo,
    messageId,
  });
  const isDryRun = sendResult.dryRun;

  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  // Crée l'enregistrement
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
      contenuTexte,
      statut: isDryRun ? "BROUILLON" : "ENVOYE",
      envoyeLe: isDryRun ? null : new Date(),
      templateUtiliseId: parsed.data.templateId || null,
      labels: sendResult.resendId ? [`resend:${sendResult.resendId}`] : [],
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
 * Répond à un email existant (entrant ou sortant).
 * Reprend le thread et le destinataire approprié.
 */
export async function replyToEmail(
  emailId: string,
  contenu: string,
  objetOverride?: string,
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
  const contenuHtml = `<pre style="font-family: sans-serif; white-space: pre-wrap;">${contenuTexte
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
  });
  const isDryRun = sendResult.dryRun;

  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  // Crée l'email de réponse dans le même thread
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
  if (user.role !== "ADMIN" && email.userId !== user.id) {
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
      ...(user.role !== "ADMIN" ? { userId: user.id } : {}),
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
  if (user.role !== "ADMIN" && email.userId !== user.id) {
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
 * Supprime un email (envoyé ou brouillon).
 * RLS : admin OR créateur (email.userId === user.id).
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
  if (user.role !== "ADMIN" && email.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  await prisma.email.delete({ where: { id } });
  revalidatePath("/emails");
  if (email.prospectId) revalidatePath(`/prospects/${email.prospectId}`);
  return { ok: true };
}
