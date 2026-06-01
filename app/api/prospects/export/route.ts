/**
 * GET /api/prospects/export → renvoie un CSV téléchargeable des prospects
 * accessibles à l'utilisateur (RLS appliqué).
 *
 * Les filtres en query string (q, statut, secteur, canton) sont respectés
 * pour exporter la sélection courante de la page.
 *
 * Le CSV est compatible avec l'import : tu peux le réimporter tel quel
 * via /prospects/import (auto-mapping des colonnes garanti).
 */
import { NextResponse } from "next/server";

import { getProspects } from "@/lib/queries/prospects";
import { ProspectListParamsSchema } from "@/lib/schemas/prospect";
import {
  getProspectSecteurLabel,
  getProspectSourceLabel,
  getProspectStatutLabel,
} from "@/lib/labels";
import { getSessionUser } from "@/lib/session";

import type { Prospect } from "@prisma/client";

const COLUMNS: Array<{
  header: string;
  field: keyof Prospect | "secteurLabel" | "sourceLabel" | "statutLabel";
}> = [
  { header: "Raison sociale", field: "raisonSociale" },
  { header: "Prénom contact", field: "contactPrenom" },
  { header: "Nom contact", field: "contactNom" },
  { header: "Fonction", field: "contactFonction" },
  { header: "Email", field: "email" },
  { header: "Téléphone", field: "telephone" },
  { header: "Mobile", field: "telephoneMobile" },
  { header: "Adresse", field: "adresse" },
  { header: "Code postal", field: "codePostal" },
  { header: "Ville", field: "ville" },
  { header: "Canton", field: "canton" },
  { header: "Pays", field: "pays" },
  { header: "Site web", field: "siteWeb" },
  { header: "LinkedIn", field: "linkedIn" },
  { header: "Secteur", field: "secteurLabel" },
  { header: "Effectif", field: "effectif" },
  { header: "NOGA", field: "noga" },
  { header: "Source", field: "sourceLabel" },
  { header: "Statut", field: "statutLabel" },
  { header: "Notes", field: "notesGenerales" },
];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  // RBAC : seul l'admin peut exporter les données.
  if (user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Récupère les filtres depuis l'URL pour exporter la même sélection que
  // la page /prospects affichée à l'utilisateur
  const url = new URL(req.url);
  const params = ProspectListParamsSchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    statut: url.searchParams.get("statut") ?? undefined,
    secteur: url.searchParams.get("secteur") ?? undefined,
    canton: url.searchParams.get("canton") ?? undefined,
    assigneAId: url.searchParams.get("assigneAId") ?? undefined,
    pageSize: 1000, // export jusqu'à 1000 lignes en une passe
  });

  const { items } = await getProspects(user, params);

  // Génère le CSV (UTF-8 BOM pour ouvrir correctement dans Excel sur Windows)
  const headerRow = COLUMNS.map((c) => escapeCsv(c.header)).join(";");
  const lines = items.map((p) => {
    return COLUMNS.map((c) => {
      let v: unknown = "";
      if (c.field === "secteurLabel") {
        v = p.secteur ? getProspectSecteurLabel(p.secteur) : "";
      } else if (c.field === "sourceLabel") {
        v = p.source ? getProspectSourceLabel(p.source) : "";
      } else if (c.field === "statutLabel") {
        v = getProspectStatutLabel(p.statut);
      } else {
        v = (p as Record<string, unknown>)[c.field as string];
      }
      return escapeCsv(v);
    }).join(";");
  });

  const csv = "﻿" + [headerRow, ...lines].join("\r\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${date}.csv"`,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
