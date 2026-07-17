/**
 * POST /api/sync/prospects/delete
 *
 * Supprime des fiches CRM devenues orphelines après une déduplication du master
 * (deux lignes « X AG » / « X SA » = une seule société). Authentifié par
 * `x-sync-key` (= SYNC_API_KEY), comme /ingest.
 *
 * Corps : { masterIds: number[], dryRun?: boolean }
 * Réponse : { ok, deleted, skipped, missing, details }
 *
 * SÛRETÉ — une fiche n'est supprimée QUE si elle ne porte aucune trace humaine.
 * Le doublon est censé être une coquille d'import : s'il a servi à travailler,
 * ce n'est plus une coquille et la suppression n'est plus une opération neutre.
 * Toute fiche retenue est renvoyée dans `details` avec son motif, jamais
 * détruite en silence.
 *
 * Ce garde-fou n'est pas cosmétique — le schéma rend la suppression nue
 * destructrice ou impossible :
 *  - Activity et Deal sont en onDelete: Cascade : supprimer la fiche effacerait
 *    l'historique commercial (appels, RDV, notes) sans aucun signal.
 *  - Contract et ExpenseAllocation sont en onDelete: Restrict : la suppression
 *    échouerait en cours de lot. On les écarte donc EN AMONT plutôt que de
 *    laisser Postgres trancher au milieu d'une transaction.
 *
 * Volontairement absent : aucune fusion des données du doublon vers la fiche
 * conservée. Une fiche qui aurait quelque chose à fusionner est précisément une
 * fiche qu'on refuse de supprimer — elle remonte pour arbitrage humain.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { motifsDeRetenue } from "@/lib/sync/prospect-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_LOT = 2000;

function authorized(req: Request): boolean {
  const key = process.env.SYNC_API_KEY;
  if (!key) return false;
  const got = req.headers.get("x-sync-key") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Detail = { masterId: number; raisonSociale: string; motif: string };

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    await audit("sync.auth_fail", { metadata: { route: "delete" } });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { masterIds?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const masterIds = Array.isArray(body.masterIds)
    ? body.masterIds.filter((n): n is number => Number.isInteger(n))
    : [];
  const dryRun = body.dryRun === true;

  if (masterIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, skipped: 0, missing: 0, details: [] });
  }
  if (masterIds.length > MAX_LOT) {
    return NextResponse.json(
      { ok: false, error: `Lot trop grand (max ${MAX_LOT})` },
      { status: 400 },
    );
  }

  const fiches = await prisma.prospect.findMany({
    where: { masterId: { in: masterIds } },
    select: {
      id: true,
      masterId: true,
      raisonSociale: true,
      statut: true,
      notesGenerales: true,
      derniereActionLe: true,
      _count: {
        select: {
          activities: true,
          deals: true,
          contracts: true,
          emails: true,
          expenses: true,
          expenseAllocations: true,
          expenseRecurrences: true,
          dossiers: true,
        },
      },
    },
  });

  const details: Detail[] = [];
  const supprimables: string[] = [];

  for (const f of fiches) {
    const motifs = motifsDeRetenue({
      statut: f.statut,
      notesGenerales: f.notesGenerales,
      derniereActionLe: f.derniereActionLe,
      liens: f._count,
    });

    if (motifs.length > 0) {
      details.push({
        masterId: f.masterId!,
        raisonSociale: f.raisonSociale,
        motif: motifs.join(", "),
      });
      continue;
    }
    supprimables.push(f.id);
  }

  let deleted = 0;
  if (!dryRun && supprimables.length > 0) {
    const res = await prisma.prospect.deleteMany({ where: { id: { in: supprimables } } });
    deleted = res.count;
    await audit("sync.prospects_deleted", {
      metadata: { count: deleted, skipped: details.length, dryRun: false },
    });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    deleted: dryRun ? 0 : deleted,
    deletable: supprimables.length,
    skipped: details.length,
    missing: masterIds.length - fiches.length,
    details,
  });
}
