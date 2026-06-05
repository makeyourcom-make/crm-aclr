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
    "Pour toute question, n'hésitez pas à me répondre directement.",
    "",
    "Cordialement,",
    userFull?.name ?? "",
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
  const { from, replyTo, fromName } = resolveFromAddress({
    email: userFull?.email ?? "contact@makeyourcom.ch",
    name: userFull?.name ?? null,
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
    "Pour toute question, n'hésitez pas à me répondre directement.",
    "",
    "Cordialement,",
    fromName,
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

    // Marque la facture comme ENVOYEE (uniquement si encore en BROUILLON)
    if (invoice.statut === "BROUILLON") {
      await tx.clientInvoice.update({
        where: { id: invoice.id },
        data: { statut: "ENVOYEE" },
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
