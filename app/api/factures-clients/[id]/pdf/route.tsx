import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  ClientInvoicePdf,
  type ClientInvoicePdfData,
} from "@/lib/pdf/client-invoice-template";
import { getSessionUser } from "@/lib/session";

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

  const data: ClientInvoicePdfData = {
    numero: invoice.numero,
    dateEmission: invoice.dateEmission,
    dateEcheance: invoice.dateEcheance,
    emetteur: {
      raisonSociale: setting?.raisonSociale ?? "ACLR Sàrl",
      adresse: setting?.adresse ?? undefined,
      codePostal: setting?.codePostal ?? undefined,
      ville: setting?.ville ?? undefined,
      pays: setting?.pays ?? "Suisse",
      iban: setting?.iban ?? undefined,
      bicSwift: setting?.bicSwift ?? undefined,
      nomBanque: setting?.nomBanque ?? undefined,
      numeroIDE: setting?.numeroIDE ?? undefined,
      numeroTVA: setting?.numeroTVA ?? undefined,
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

  const buffer = await renderToBuffer(<ClientInvoicePdf data={data} />);
  const bytes = new Uint8Array(buffer);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.numero}.pdf"`,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
