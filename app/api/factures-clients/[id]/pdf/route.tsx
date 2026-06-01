import { renderToBuffer } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

import { prisma } from "@/lib/db";
import {
  ClientInvoicePdf,
  type ClientInvoicePdfData,
} from "@/lib/pdf/client-invoice-template";
import { generateQrBillPdfBuffer } from "@/lib/pdf/swiss-qr-bill";
import { getSessionUser } from "@/lib/session";

/**
 * Résout le chemin absolu du logo PNG s'il existe dans public/brand/.
 * @react-pdf/renderer accepte les chemins fs absolus en src.
 */
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
              adresse: true,
              codePostal: true,
              ville: true,
              pays: true,
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
  const currency = guessCurrency(invoice.contract.prospect.pays);

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
      contactNom: [
        invoice.contract.prospect.contactPrenom,
        invoice.contract.prospect.contactNom,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
      adresse: invoice.contract.prospect.adresse ?? undefined,
      codePostal: invoice.contract.prospect.codePostal ?? undefined,
      ville: invoice.contract.prospect.ville ?? undefined,
      pays: invoice.contract.prospect.pays ?? undefined,
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

  // 2. Si CHF + IBAN renseigné + montant positif → générer le QR-bill suisse
  //    et le merger en page additionnelle.
  const canGenerateQrBill =
    currency === "CHF" &&
    setting?.iban &&
    Number(invoice.total) > 0 &&
    Number(invoice.total) <= 999999999.99;

  let finalPdfBytes: Uint8Array;
  if (canGenerateQrBill) {
    try {
      const qrBillBuffer = await generateQrBillPdfBuffer({
        amount: Number(invoice.total),
        creditor: {
          name: setting!.raisonSociale,
          address: setting!.adresse ?? "Route de la Jorette",
          buildingNumber: extractBuildingNumber(setting!.adresse),
          zip: setting!.codePostal ?? "1899",
          city: setting!.ville ?? "Torgon",
          account: setting!.iban!,
          country: "CH",
        },
        debtor: {
          name: invoice.contract.prospect.raisonSociale,
          address: invoice.contract.prospect.adresse ?? undefined,
          zip: invoice.contract.prospect.codePostal ?? undefined,
          city: invoice.contract.prospect.ville ?? undefined,
          country: countryCode(invoice.contract.prospect.pays),
        },
        additionalInformation: `Facture ${invoice.numero}`,
      });

      // Merge : on ajoute le QR-bill comme dernière page (après CGV)
      const mainDoc = await PDFDocument.load(new Uint8Array(invoicePdfBuffer));
      const qrDoc = await PDFDocument.load(new Uint8Array(qrBillBuffer));
      const [qrPage] = await mainDoc.copyPages(qrDoc, [0]);
      mainDoc.addPage(qrPage);
      finalPdfBytes = await mainDoc.save();
    } catch (err) {
      console.error("[QR-bill generation failed, falling back to invoice only]", err);
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

function extractBuildingNumber(adresse?: string | null): string {
  if (!adresse) return "";
  const match = adresse.match(/\d+\w?$/);
  return match ? match[0] : "";
}

function countryCode(pays?: string | null): string {
  if (!pays) return "CH";
  const p = pays.toLowerCase();
  if (p.includes("suisse") || p.includes("schweiz") || p.includes("switzerland") || p === "ch")
    return "CH";
  if (p.includes("france") || p === "fr") return "FR";
  if (p.includes("allemagne") || p.includes("deutschland") || p === "de") return "DE";
  if (p.includes("italie") || p.includes("italia") || p === "it") return "IT";
  if (p.includes("autriche") || p === "at") return "AT";
  if (p.includes("liechtenstein") || p === "li") return "LI";
  return "CH";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
