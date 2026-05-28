/**
 * GET /api/factures/[id]/pdf → stream le PDF de la facture mensuelle.
 *
 * RLS : seul l'utilisateur titulaire de la facture ou un admin peut télécharger.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { InvoicePdf, type InvoicePdfData } from "@/lib/pdf/invoice-template";
import { getInvoiceById } from "@/lib/queries/invoices";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const invoice = await getInvoiceById(user, id);
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  // Charge les coords ACLR (Setting singleton)
  const setting = await prisma.setting.findFirst();

  const data: InvoicePdfData = {
    numero: invoice.referenceFacture,
    mois: invoice.mois,
    dateEmission: invoice.createdAt,
    commerciale: {
      name: invoice.user.name,
      email: invoice.user.email,
      iban: invoice.user.iban ?? undefined,
    },
    emetteur: {
      raisonSociale: setting?.raisonSociale ?? "ACLR Sàrl",
      adresse: setting?.adresse ?? undefined,
      codePostal: setting?.codePostal ?? undefined,
      ville: setting?.ville ?? undefined,
      pays: setting?.pays ?? "Suisse",
      iban: setting?.iban ?? undefined,
      numeroIDE: setting?.numeroIDE ?? undefined,
    },
    lignes: invoice.commissionPayments.map((p) => ({
      contractNumero: p.commission.contract.numero,
      raisonSociale: p.commission.contract.prospect.raisonSociale,
      typePart: p.typePart,
      numeroMois: p.numeroMois,
      montant: Number(p.montant),
    })),
    montantCommissions: Number(invoice.montantCommissions),
    montantGarantieAbsorbee: Number(invoice.montantGarantieAbsorbee),
    montantFrais: Number(invoice.montantFrais),
    montantTotal: Number(invoice.montantTotal),
    garantieMensuelle: Number(invoice.user.garantieMensuelle),
  };

  const buffer = await renderToBuffer(<InvoicePdf data={data} />);
  // Convert Node Buffer → Uint8Array pour la compatibilité BodyInit/Web Fetch
  const bytes = new Uint8Array(buffer);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.referenceFacture}.pdf"`,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
