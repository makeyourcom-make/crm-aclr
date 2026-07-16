"use server";

/**
 * Server actions des factures clients.
 *
 * sendClientInvoiceByEmail : build PDF → upload Vercel Blob → envoi via
 * Resend depuis l'adresse de l'utilisateur connecté → marque la facture
 * EMISE + crée une activité EMAIL_ENVOYE liée au prospect.
 */
import { randomBytes } from "node:crypto";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { resolveFromAddress, sendMail } from "@/lib/mailer";
import { buildClientInvoicePdf } from "@/lib/pdf/build-client-invoice-pdf";
import { requireUser } from "@/lib/session";

interface SendInvoiceResult {
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  recipient?: string;
}

/**
 * Les emails de FACTURATION partent au nom de l'entreprise, pas de la personne
 * (décision Arthur) : une facture est émise par ACLR / Make Your Com, pas par
 * un individu. Les emails de PROSPECTION (module Emails) gardent volontairement
 * le nom de la commerciale — un mail de prospection doit rester personnel.
 *
 * Le Reply-To continue de pointer sur l'adresse de l'utilisateur : les réponses
 * du client lui arrivent bien directement.
 */
const EXPEDITEUR_FACTURATION = "Make Your Com";
const SIGNATURE_FACTURATION = "L'équipe Make Your Com";

/**
 * Construit le sujet et le corps par défaut. Exporté pour pouvoir les
 * pré-remplir côté UI (dialog d'envoi) avant validation de l'utilisateur.
 */
export async function getInvoiceEmailDefaults(
  invoiceId: string,
): Promise<{
  ok: boolean;
  error?: string;
  recipient?: string;
  subject?: string;
  body?: string;
}> {
  const user = await requireUser();
  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      numero: true,
      total: true,
      devise: true,
      dateEcheance: true,
      contract: {
        select: {
          assigneAId: true,
          prospect: {
            select: {
              raisonSociale: true,
              email: true,
              contactPrenom: true,
            },
          },
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (user.role !== "ADMIN" && invoice.contract.assigneAId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }

  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });

  const formatMontant = (n: number, devise: string) =>
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " " + devise;

  const prenom = invoice.contract.prospect.contactPrenom?.trim() || "";
  const echeanceStr = invoice.dateEcheance.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const totalLabel = formatMontant(
    Number(invoice.total),
    invoice.devise,
  );
  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const subject = `Facture ${invoice.numero} — ${invoice.contract.prospect.raisonSociale}`;
  const body = [
    greeting,
    "",
    `Veuillez trouver ci-joint la facture ${invoice.numero} d'un montant de ${totalLabel}, échéance au ${echeanceStr}.`,
    "",
    `Le règlement peut être effectué par virement bancaire (coordonnées en bas du PDF) ou via le QR-bill suisse en page 2 si applicable.`,
    "",
    "Pour toute question, n'hésitez pas à nous répondre directement.",
    "",
    "Cordialement,",
    SIGNATURE_FACTURATION,
  ].join("\n");

  return {
    ok: true,
    recipient: invoice.contract.prospect.email ?? "",
    subject,
    body,
  };
}

export async function sendClientInvoiceByEmail(
  invoiceId: string,
  customSubject?: string,
  customBody?: string,
): Promise<SendInvoiceResult> {
  const user = await requireUser();

  // RLS : un commercial ne peut envoyer que les factures de ses contrats
  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      numero: true,
      statut: true,
      total: true,
      devise: true,
      dateEcheance: true,
      contract: {
        select: {
          id: true,
          numero: true,
          assigneAId: true,
          prospect: {
            select: {
              id: true,
              raisonSociale: true,
              email: true,
              contactPrenom: true,
            },
          },
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (user.role !== "ADMIN" && invoice.contract.assigneAId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  if (!invoice.contract.prospect.email) {
    return {
      ok: false,
      error: "Pas d'email client — renseigne-le sur la fiche prospect d'abord.",
    };
  }

  // RÈGLE MÉTIER : la date de la facture est celle de l'ENVOI. Au 1er envoi
  // (facture encore en BROUILLON), on (re)date à aujourd'hui, échéance à +30 j,
  // AVANT de générer le PDF pour qu'il porte les bonnes dates. Évite qu'une
  // facture générée à l'avance parte avec une date d'émission passée / déjà
  // échue. Un renvoi d'une facture déjà envoyée ne re-date pas (échéance figée).
  let effEcheance = invoice.dateEcheance;
  if (invoice.statut === "BROUILLON") {
    const emission = new Date();
    const echeance = new Date(emission);
    echeance.setDate(
      echeance.getDate() + FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT,
    );
    await prisma.clientInvoice.update({
      where: { id: invoice.id },
      data: { dateEmission: emission, dateEcheance: echeance },
    });
    effEcheance = echeance;
  }

  // 1. Build PDF complet (facture + QR-bill + CGV)
  const built = await buildClientInvoicePdf(invoiceId);
  if (!built) return { ok: false, error: "Échec de génération PDF." };

  // 2. Upload sur Vercel Blob → URL signée pour Resend attachment
  const blob = await put(
    `client-invoices/${invoice.numero}-${Date.now()}.pdf`,
    built.buffer,
    {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    },
  );

  // 3. Email
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  const { from, replyTo } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
  });
  // Expéditeur = l'entreprise (et non la personne) : alimente le nom affiché
  // dans le mail envoyé ET `expediteurNom` de la copie archivée dans le CRM.
  const fromName = EXPEDITEUR_FACTURATION;

  const formatMontant = (n: number, devise: string) =>
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " " + devise;

  const prenom = invoice.contract.prospect.contactPrenom?.trim() || "";
  const echeanceStr = effEcheance.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const totalLabel = formatMontant(Number(invoice.total), invoice.devise);

  // Sujet et corps : utilise les versions personnalisées si fournies
  // par l'UI (dialog "Envoyer"), sinon les valeurs par défaut.
  const subject =
    customSubject?.trim() ||
    `Facture ${invoice.numero} — ${invoice.contract.prospect.raisonSociale}`;

  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const defaultText = [
    greeting,
    "",
    `Veuillez trouver ci-joint la facture ${invoice.numero} d'un montant de ${totalLabel}, échéance au ${echeanceStr}.`,
    "",
    `Le règlement peut être effectué par virement bancaire (coordonnées en bas du PDF) ou via le QR-bill suisse en page 2 si applicable.`,
    "",
    "Pour toute question, n'hésitez pas à nous répondre directement.",
    "",
    "Cordialement,",
    SIGNATURE_FACTURATION,
  ].join("\n");
  const text = customBody?.trim() || defaultText;

  // HTML = texte échappé avec <br/> + <p> par paragraphe (double saut de ligne)
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map(
    (p) =>
      `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
  );
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${paragraphs.join(
    "",
  )}</div>`;

  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;
  const threadId = randomBytes(8).toString("hex");

  const sendResult = await sendMail({
    from,
    fromName,
    to: invoice.contract.prospect.email,
    subject,
    html,
    text,
    replyTo,
    messageId,
    attachments: [
      {
        filename: `${invoice.numero}.pdf`,
        path: blob.url,
        contentType: "application/pdf",
      },
    ],
  });
  const isDryRun = sendResult.dryRun;
  if (!sendResult.ok && !isDryRun) {
    return {
      ok: false,
      error: sendResult.error ?? "Échec d'envoi via Resend.",
    };
  }

  // 4. Crée l'enregistrement Email + Activity, marque facture EMISE
  await prisma.$transaction(async (tx) => {
    const email = await tx.email.create({
      data: {
        prospectId: invoice.contract.prospect.id,
        contractId: invoice.contract.id,
        userId: user.id,
        direction: "SORTANT",
        threadId,
        messageId,
        expediteurEmail: from,
        expediteurNom: fromName,
        destinataireEmail: invoice.contract.prospect.email!,
        objet: subject,
        contenuHtml: html,
        contenuTexte: text,
        statut: isDryRun ? "BROUILLON" : "ENVOYE",
        envoyeLe: isDryRun ? null : new Date(),
        labels: sendResult.resendId ? [`resend:${sendResult.resendId}`] : [],
        attachments: {
          create: [
            {
              nom: `${invoice.numero}.pdf`,
              taille: built.buffer.length,
              mimeType: "application/pdf",
              url: blob.url,
            },
          ],
        },
      },
    });

    await tx.activity.create({
      data: {
        prospectId: invoice.contract.prospect.id,
        userId: user.id,
        type: "EMAIL_ENVOYE",
        date: new Date(),
        sujet: `Facture ${invoice.numero} envoyée`,
        contenu: `Facture ${invoice.numero} (${totalLabel}, échéance ${echeanceStr}) envoyée par email à ${invoice.contract.prospect.email}.`,
        statut: "FAIT",
        emailId: email.id,
      },
    });

    // Marque ENVOYEE (si encore BROUILLON) et, sur envoi RÉEL uniquement,
    // horodate l'envoi client. Ce timestamp — et non le statut — conditionne
    // les relances : une facture jamais réellement envoyée n'est jamais
    // relancée (un envoi dry-run ne pose pas d'horodatage).
    const invUpdate: { statut?: "ENVOYEE"; envoiClientLe?: Date } = {};
    if (invoice.statut === "BROUILLON") invUpdate.statut = "ENVOYEE";
    if (!isDryRun) invUpdate.envoiClientLe = new Date();
    if (Object.keys(invUpdate).length > 0) {
      await tx.clientInvoice.update({
        where: { id: invoice.id },
        data: invUpdate,
      });
    }
  });

  revalidatePath("/factures-clients");
  revalidatePath("/emails");
  revalidatePath(`/prospects/${invoice.contract.prospect.id}`);

  return {
    ok: true,
    dryRun: isDryRun,
    recipient: invoice.contract.prospect.email!,
  };
}

/**
 * Relance automatique "J+20" — appelée par le cron nocturne.
 *
 * Pour chaque facture ENVOYEE (impayée) dont l'échéance approche (≤ 10 jours)
 * mais n'est PAS encore dépassée, on envoie UNE fois un email de rappel
 * courtois + PDF, pour inviter au règlement AVANT le cap des 30 jours et éviter
 * tout frais de rappel. L'échéance étant à 30 j, ce déclenchement correspond à
 * ~J+20 après l'émission.
 *
 * Idempotent : le champ `rappelJ20EnvoyeLe` empêche tout second envoi. Envoi
 * au nom de la commerciale assignée. Respecte EMAIL_MODE (dry-run tant que
 * ≠ live). Les factures DÉJÀ en retard (échéance passée) ne sont pas concernées
 * (elles relèvent d'une relance de retard, pas de ce rappel préventif).
 */
export async function sendDueSoonReminders(): Promise<{
  ok: boolean;
  sent: number;
  errors: number;
}> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 10 * 86_400_000); // échéance ≤ 10 j

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      statut: "ENVOYEE",
      envoiClientLe: { not: null }, // uniquement les factures réellement envoyées
      rappelJ20EnvoyeLe: null,
      dateEcheance: { gte: now, lte: horizon },
      contract: { prospect: { email: { not: null } } },
    },
    select: {
      id: true,
      numero: true,
      total: true,
      devise: true,
      dateEcheance: true,
      contract: {
        select: {
          id: true,
          assigneAId: true,
          assigneA: { select: { email: true, name: true } },
          prospect: {
            select: {
              id: true,
              raisonSociale: true,
              email: true,
              contactPrenom: true,
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let errors = 0;

  for (const inv of invoices) {
    const email = inv.contract.prospect.email;
    if (!email) continue;
    try {
      const built = await buildClientInvoicePdf(inv.id);
      if (!built) {
        errors++;
        continue;
      }
      const blob = await put(
        `client-invoices/${inv.numero}-rappel-${Date.now()}.pdf`,
        built.buffer,
        {
          access: "public",
          contentType: "application/pdf",
          addRandomSuffix: true,
        },
      );

      const { from, replyTo } = resolveFromAddress({
        email: inv.contract.assigneA?.email ?? "contact@makeyourcom.ch",
        name: inv.contract.assigneA?.name ?? null,
      });
      const fromName = EXPEDITEUR_FACTURATION;

      const prenom = inv.contract.prospect.contactPrenom?.trim() || "";
      const echeanceStr = inv.dateEcheance.toLocaleDateString("fr-CH", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const totalLabel =
        new Intl.NumberFormat("fr-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(inv.total)) +
        " " +
        inv.devise;

      const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,";
      const subject = `Rappel — facture ${inv.numero} à échéance le ${echeanceStr}`;
      const text = [
        greeting,
        "",
        `Nous nous permettons un petit rappel concernant la facture ${inv.numero}, d'un montant de ${totalLabel}, dont l'échéance est fixée au ${echeanceStr}.`,
        "",
        `Sauf erreur de notre part, son règlement ne nous est pas encore parvenu. Afin d'éviter tout frais de rappel, nous vous invitons à procéder au paiement avant cette date.`,
        "",
        `Le règlement peut être effectué par virement bancaire (coordonnées en bas du PDF ci-joint) ou via le QR-bill suisse. Si le paiement a déjà été effectué entre-temps, merci de ne pas tenir compte de ce message.`,
        "",
        "Pour toute question, n'hésitez pas à nous répondre directement.",
        "",
        "Cordialement,",
        SIGNATURE_FACTURATION,
      ].join("\n");

      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${text
        .split(/\n{2,}/)
        .map((pp) => `<p>${escapeHtml(pp).replace(/\n/g, "<br/>")}</p>`)
        .join("")}</div>`;

      const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@makeyourcom.ch>`;
      const threadId = randomBytes(8).toString("hex");

      const sendResult = await sendMail({
        from,
        fromName,
        to: email,
        subject,
        html,
        text,
        replyTo,
        messageId,
        attachments: [
          {
            filename: `${inv.numero}.pdf`,
            path: blob.url,
            contentType: "application/pdf",
          },
        ],
      });
      const isDryRun = sendResult.dryRun;
      if (!sendResult.ok && !isDryRun) {
        errors++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const emailRec = await tx.email.create({
          data: {
            prospectId: inv.contract.prospect.id,
            contractId: inv.contract.id,
            userId: inv.contract.assigneAId,
            direction: "SORTANT",
            threadId,
            messageId,
            expediteurEmail: from,
            expediteurNom: fromName,
            destinataireEmail: email,
            objet: subject,
            contenuHtml: html,
            contenuTexte: text,
            statut: isDryRun ? "BROUILLON" : "ENVOYE",
            envoyeLe: isDryRun ? null : new Date(),
            labels: sendResult.resendId
              ? [`resend:${sendResult.resendId}`, "rappel-j20"]
              : ["rappel-j20"],
            attachments: {
              create: [
                {
                  nom: `${inv.numero}.pdf`,
                  taille: built.buffer.length,
                  mimeType: "application/pdf",
                  url: blob.url,
                },
              ],
            },
          },
        });

        await tx.activity.create({
          data: {
            prospectId: inv.contract.prospect.id,
            userId: inv.contract.assigneAId,
            type: "EMAIL_ENVOYE",
            date: new Date(),
            sujet: `Relance J+20 — facture ${inv.numero}`,
            contenu: `Relance automatique (échéance ${echeanceStr}) envoyée à ${email} pour la facture ${inv.numero} (${totalLabel}).`,
            statut: "FAIT",
            emailId: emailRec.id,
          },
        });

        // Marque comme relancée pour ne jamais renvoyer (idempotence).
        await tx.clientInvoice.update({
          where: { id: inv.id },
          data: { rappelJ20EnvoyeLe: new Date() },
        });
      });
      sent++;
    } catch (e) {
      console.error("[sendDueSoonReminders]", inv.numero, e);
      errors++;
    }
  }

  return { ok: true, sent, errors };
}
