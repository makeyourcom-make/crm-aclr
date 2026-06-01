/**
 * Export comptable CSV des charges.
 *
 * Format : 1 ligne par charge (les attachments multiples ne sont pas dédoublés).
 * Pour les charges avec allocations multi-clients : 1 ligne supplémentaire
 * par allocation (suffixée " (allocation)"), pour permettre au comptable
 * de ventiler le P&L par client.
 *
 * Encodage : UTF-8 BOM (Excel/LibreOffice friendly), séparateur point-virgule
 * (compatible Excel français suisse).
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const CATEGORIE_LABEL: Record<string, string> = {
  LOYER: "Loyer",
  SOFTWARE_SAAS: "Software",
  MARKETING: "Marketing",
  PUBLICITE: "Publicité",
  DEPLACEMENTS: "Déplacements",
  RESTAURATION: "Restauration",
  MATERIEL_BUREAU: "Matériel",
  ASSURANCES: "Assurances",
  TELECOM: "Télécom",
  FORMATION: "Formation",
  HONORAIRES: "Honoraires",
  IMPOTS: "Impôts",
  BANQUE_FRAIS: "Frais bancaires",
  AUTRE: "Autre",
};

function csvEscape(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function fmtNum(n: number | string | { toString(): string }): string {
  return Number(n).toFixed(2).replace(".", ",");
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const sp = url.searchParams;

  // Reprendre les mêmes filtres que /charges
  const q = sp.get("q")?.trim() || undefined;
  const filterCat = sp.get("categorie") || undefined;
  const filterPeriode = sp.get("periode") || undefined;
  const filterStatut = sp.get("statut") || undefined;

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startYear = new Date(now.getFullYear(), 0, 1);

  let periodeFrom: Date | undefined;
  let periodeTo: Date | undefined;
  if (filterPeriode === "month") periodeFrom = startMonth;
  else if (filterPeriode === "prev-month") {
    periodeFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periodeTo = startMonth;
  } else if (filterPeriode === "quarter") {
    const qIdx = Math.floor(now.getMonth() / 3) * 3;
    periodeFrom = new Date(now.getFullYear(), qIdx, 1);
  } else if (filterPeriode === "ytd") periodeFrom = startYear;
  else if (filterPeriode === "12m") {
    periodeFrom = new Date(now);
    periodeFrom.setMonth(periodeFrom.getMonth() - 12);
  }

  const conds: Prisma.ExpenseWhereInput[] = [];
  if (filterCat) conds.push({ categorie: filterCat as never });
  if (filterStatut) conds.push({ statutPaiement: filterStatut as never });
  if (periodeFrom || periodeTo) {
    conds.push({
      date: {
        ...(periodeFrom ? { gte: periodeFrom } : {}),
        ...(periodeTo ? { lt: periodeTo } : {}),
      },
    });
  }
  if (q) {
    conds.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { fournisseur: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.ExpenseWhereInput =
    conds.length > 0 ? { AND: conds } : {};

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      prospect: { select: { raisonSociale: true } },
      allocations: {
        include: { prospect: { select: { raisonSociale: true } } },
      },
      attachments: { select: { fileUrl: true } },
    },
  });

  const header = [
    "Date ticket",
    "Date règlement",
    "Statut",
    "Catégorie",
    "Fournisseur",
    "Description",
    "Référence",
    "Client",
    "Type",
    "Montant HT (CHF)",
    "Taux TVA",
    "Montant TVA (CHF)",
    "Montant TTC (CHF)",
    "TVA récupérable",
    "Méthode paiement",
    "Ticket joint",
    "Pièces complémentaires",
    "Note allocation",
  ];

  const rows: string[][] = [];
  for (const e of expenses) {
    const baseRow = [
      fmtDate(e.date),
      fmtDate(e.dateReglement),
      e.statutPaiement,
      CATEGORIE_LABEL[e.categorie] ?? e.categorie,
      e.fournisseur ?? "",
      e.description ?? "",
      e.reference ?? "",
      e.prospect?.raisonSociale ?? (e.allocations.length > 0 ? "MULTI" : ""),
      e.allocations.length > 0 ? "Multi-clients" : e.prospect ? "Client" : "Interne",
      fmtNum(e.montantHT),
      fmtNum(Number(e.tauxTVA) * 100) + "%",
      fmtNum(e.montantTVA),
      fmtNum(e.montantTTC),
      e.tvaRecuperable ? "oui" : "non",
      e.methodPaiement ?? "",
      e.ticketUrl ?? "",
      String(e.attachments.length),
      "",
    ];
    rows.push(baseRow);

    // Pour chaque allocation : ligne supplémentaire en sous-ligne
    for (const a of e.allocations) {
      rows.push([
        fmtDate(e.date),
        fmtDate(e.dateReglement),
        e.statutPaiement,
        CATEGORIE_LABEL[e.categorie] ?? e.categorie,
        e.fournisseur ?? "",
        `${e.description ?? ""} (ventilation)`,
        e.reference ?? "",
        a.prospect.raisonSociale,
        "Allocation",
        fmtNum(a.montantHT),
        "",
        "",
        fmtNum(a.montantHT), // pour les allocations on prend HT comme proxy TTC (TVA 0% chez ACLR)
        "",
        "",
        "",
        "",
        a.note ?? "",
      ]);
    }
  }

  const csv = [
    header.map(csvEscape).join(";"),
    ...rows.map((r) => r.map(csvEscape).join(";")),
  ].join("\r\n");

  const filename = `charges_aclr_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
