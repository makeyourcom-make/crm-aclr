/**
 * Helper réutilisable : construit le PDF complet d'une facture client
 * (facture + QR-bill template + CGV). Retourne un Buffer prêt à être
 * envoyé en HTTP response, joint à un email, ou uploadé sur Vercel Blob.
 *
 * Utilisé par :
 *  - /api/factures-clients/[id]/pdf (téléchargement direct)
 *  - sendClientInvoiceByEmail() server action
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

import { prisma } from "@/lib/db";
import {
  ClientInvoicePdf,
  type ClientInvoicePdfData,
} from "@/lib/pdf/client-invoice-template";

function resolveLogoPath(): string | undefined {
  const candidates = [
    join(process.cwd(), "public", "brand", "logo-full.png"),
    join(process.cwd(), "public", "brand", "logo.png"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

function guessCurrency(pays?: string | null): "CHF" | "EUR" {
  if (!pays) return "CHF";
  const p = pays.toLowerCase();
  if (
    p.includes("suisse") ||
    p.includes("schweiz") ||
    p.includes("switzerland") ||
    p === "ch"
  ) {
    return "CHF";
  }
  return "EUR";
}

export interface BuiltInvoicePdf {
  buffer: Buffer;
  numero: string;
  currency: "CHF" | "EUR";
  clientEmail: string | null;
  clientRaisonSociale: string;
  contractAssigneAId: string | null;
  prospectId: string | null;
  contactNom: string | null;
}

/**
 * Construit le PDF complet (facture + QR-bill template + CGV) d'une
 * facture client. Pas de check d'autorisation ici — le caller décide.
 */
export async function buildClientInvoicePdf(
  invoiceId: string,
): Promise<BuiltInvoicePdf | null> {
  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      contract: {
        select: {
          assigneAId: true,
          prospect: {
            select: {
              id: true,
              raisonSociale: true,
              contactPrenom: true,
              contactNom: true,
              contactFonction: true,
              email: true,
              telephone: true,
              adresse: true,
              codePostal: true,
              ville: true,
              canton: true,
              pays: true,
              numeroIDE: true,
              numeroTVA: true,
            },
          },
        },
      },
      lignes: { orderBy: { ordre: "asc" } },
    },
  });
  if (!invoice) return null;

  const setting = await prisma.setting.findFirst();
  const currency: "CHF" | "EUR" =
    invoice.devise === "EUR"
      ? "EUR"
      : invoice.devise === "CHF"
        ? "CHF"
        : guessCurrency(invoice.contract.prospect.pays);

  const data: ClientInvoicePdfData = {
    numero: invoice.numero,
    dateEmission: invoice.dateEmission,
    dateEcheance: invoice.dateEcheance,
    currency,
    emetteur: {
      raisonSociale: setting?.raisonSociale ?? "ACLR Sàrl",
      marque: setting?.marque ?? "Make Your Com",
      adresse: setting?.adresse ?? undefined,
      codePostal: setting?.codePostal ?? undefined,
      ville: setting?.ville ?? undefined,
      pays: setting?.pays ?? "Suisse",
      iban: setting?.iban ?? undefined,
      bicSwift: setting?.bicSwift ?? undefined,
      nomBanque: setting?.nomBanque ?? undefined,
      ibanEUR: setting?.ibanEUR ?? undefined,
      bicSwiftEUR: setting?.bicSwiftEUR ?? undefined,
      numeroIDE: setting?.numeroIDE ?? undefined,
      numeroTVA: setting?.numeroTVA ?? undefined,
      emailContact: setting?.emailContact ?? undefined,
      siteWeb: setting?.siteWeb ?? undefined,
      logoPath: resolveLogoPath(),
    },
    client: {
      raisonSociale: invoice.contract.prospect.raisonSociale,
      contactNom:
        [
          invoice.contract.prospect.contactPrenom,
          invoice.contract.prospect.contactNom,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      contactFonction: invoice.contract.prospect.contactFonction ?? undefined,
      email: invoice.contract.prospect.email ?? undefined,
      telephone: invoice.contract.prospect.telephone ?? undefined,
      adresse: invoice.contract.prospect.adresse ?? undefined,
      codePostal: invoice.contract.prospect.codePostal ?? undefined,
      ville: invoice.contract.prospect.ville ?? undefined,
      canton: invoice.contract.prospect.canton ?? undefined,
      pays: invoice.contract.prospect.pays ?? undefined,
      numeroIDE: invoice.contract.prospect.numeroIDE ?? undefined,
      numeroTVA: invoice.contract.prospect.numeroTVA ?? undefined,
    },
    lignes: invoice.lignes.map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      montantHT: Number(l.montantHT),
    })),
    sousTotal: Number(invoice.sousTotal),
    totalTVA: Number(invoice.totalTVA),
    total: Number(invoice.total),
    notesClient: invoice.notesClient ?? undefined,
    tvaActive: Number(invoice.totalTVA) > 0,
  };

  const invoicePdfBuffer = await renderToBuffer(
    <ClientInvoicePdf data={data} />,
  );

  // Si CHF : attacher le QR-bill template statique entre la facture et les CGV
  const qrTemplatePath = join(
    process.cwd(),
    "public",
    "brand",
    "swiss-qr-bill-template.pdf",
  );

  let finalPdfBytes: Uint8Array;
  if (currency === "CHF" && existsSync(qrTemplatePath)) {
    try {
      const qrTemplateBytes = readFileSync(qrTemplatePath);
      const mainDoc = await PDFDocument.load(new Uint8Array(invoicePdfBuffer));
      const qrDoc = await PDFDocument.load(new Uint8Array(qrTemplateBytes));
      const qrPages = await mainDoc.copyPages(qrDoc, qrDoc.getPageIndices());
      qrPages.forEach((p, i) => mainDoc.insertPage(1 + i, p));
      finalPdfBytes = await mainDoc.save();
    } catch (err) {
      console.error("[buildClientInvoicePdf] QR-bill merge failed", err);
      finalPdfBytes = new Uint8Array(invoicePdfBuffer);
    }
  } else {
    finalPdfBytes = new Uint8Array(invoicePdfBuffer);
  }

  return {
    buffer: Buffer.from(finalPdfBytes),
    numero: invoice.numero,
    currency,
    clientEmail: invoice.contract.prospect.email,
    clientRaisonSociale: invoice.contract.prospect.raisonSociale,
    contractAssigneAId: invoice.contract.assigneAId,
    prospectId: invoice.contract.prospect.id,
    contactNom:
      [
        invoice.contract.prospect.contactPrenom,
        invoice.contract.prospect.contactNom,
      ]
        .filter(Boolean)
        .join(" ") || null,
  };
}
