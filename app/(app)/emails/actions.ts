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
