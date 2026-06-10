import { renderToBuffer } from "@react-pdf/renderer";
import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

import { prisma } from "@/lib/db";
import { resolveBanner, resolveLogoDataUrl } from "@/lib/pdf/brand-assets";
import {
  ClientInvoicePdf,
  type ClientInvoicePdfData,
} from "@/lib/pdf/client-invoice-template";
import { getSessionUser } from "@/lib/session";

/**
 * Devine la devise de la facture en se basant sur le pays du client.
 *   - Suisse (CH) → CHF
 *   - Sinon (FR, EU…) → EUR
 *
 * On pourra rendre ça explicite via un champ Currency sur ClientInvoice
 * dans une migration ultérieure si besoin.
 */
function guessCurrency(pays?: string | null): "CHF" | "EUR" {
  if (!pays) return "CHF";
  const p = pays.toLowerCase();
  if (p.includes("suisse") || p.includes("schweiz") || p.includes("switzerland") || p === "ch") {
    return "CHF";
  }
  return "EUR";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id },
    include: {
      contract: {
        select: {
          assigneAId: true,
          prospect: {
            select: {
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
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  // RLS
  if (user.role !== "ADMIN" && invoice.contract.assigneAId !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const setting = await prisma.setting.findFirst();
  // La devise est désormais stockée sur la facture (héritée du contrat à
  // la création). Fallback pays uniquement pour les anciennes factures
  // sans devise renseignée — défaut "CHF" est sur la colonne DB.
  const currency: "CHF" | "EUR" =
    invoice.devise === "EUR"
      ? "EUR"
      : invoice.devise === "CHF"
        ? "CHF"
        : guessCurrency(invoice.contract.prospect.pays);

  const banner = resolveBanner();

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
      logoPath: resolveLogoDataUrl(),
      bannerPath: banner?.dataUrl,
      bannerHeightPt: banner?.heightPt,
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

  // 1. Render le PDF principal de la facture (avec CGV)
  const invoicePdfBuffer = await renderToBuffer(<ClientInvoicePdf data={data} />);

  // 2. Si CHF → attacher le QR-bill PDF statique (template fixe fourni par
  //    le user, situé dans public/brand/swiss-qr-bill-template.pdf).
  //    Le template n'est PAS personnalisé par facture — c'est volontaire :
  //    le client remplira les champs manuellement, le code QR est générique.
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
      // Copier toutes les pages du template QR (généralement 1)
      const qrPages = await mainDoc.copyPages(qrDoc, qrDoc.getPageIndices());
      // Les insérer juste après la facture (index 1), avant les CGV
      qrPages.forEach((p, i) => mainDoc.insertPage(1 + i, p));
      finalPdfBytes = await mainDoc.save();
    } catch (err) {
      console.error("[QR-bill template merge failed, fallback to invoice only]", err);
      finalPdfBytes = new Uint8Array(invoicePdfBuffer);
    }
  } else {
    finalPdfBytes = new Uint8Array(invoicePdfBuffer);
  }

  // Cast Uint8Array → BodyInit compatible
  return new NextResponse(finalPdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.numero}.pdf"`,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
