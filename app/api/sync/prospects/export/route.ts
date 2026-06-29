/**
 * GET /api/sync/prospects/export?since=ISO&limit=N
 *
 * Renvoie les fiches liées au master (masterId non nul) dont les champs
 * commerciaux ont été modifiés côté CRM depuis `since` (updatedAt > since).
 * Authentifié par l'en-tête `x-sync-key`.
 *
 * On ne renvoie QUE les champs « propriété CRM » (cf. modèle d'autorité) :
 * statut, contact, téléphones, email, notes, tags. Le script Python les
 * réinjecte dans le master (.db) avant la régénération du xlsx.
 *
 * Pagination par `since` croissant : le client rappelle avec nextSince tant
 * que hasMore est vrai.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { mapStatutToMaster } from "@/lib/sync/prospect-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const key = process.env.SYNC_API_KEY;
  if (!key) return false;
  const got = req.headers.get("x-sync-key") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    await audit("sync.auth_fail", { metadata: { route: "export" } });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ ok: false, error: "since invalide" }, { status: 400 });
  }
  const limit = Math.min(Number(url.searchParams.get("limit")) || 2000, 5000);

  // Sélection des ids modifiés CÔTÉ CRM depuis le dernier import master
  // (updatedAt > masterSyncedAt) et depuis le dernier export (updatedAt > since).
  // Comparaison colonne-à-colonne impossible en Prisma where → SQL brut.
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM prospects
    WHERE "masterId" IS NOT NULL
      AND "updatedAt" > "masterSyncedAt"
      AND "updatedAt" > ${since}
    ORDER BY "updatedAt" ASC
    LIMIT ${limit}
  `;

  const prospects = await prisma.prospect.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    orderBy: { updatedAt: "asc" },
    select: {
      masterId: true,
      updatedAt: true,
      statut: true,
      contactNom: true,
      contactPrenom: true,
      telephone: true,
      telephoneMobile: true,
      email: true,
      notesGenerales: true,
      assigneA: { select: { name: true } },
      tags: { select: { tag: { select: { nom: true } } } },
    },
  });

  const rows = prospects.map((p) => ({
    masterId: p.masterId,
    statutMaster: mapStatutToMaster(p.statut),
    contact: p.contactNom,
    contactPrenom: p.contactPrenom,
    telephone: p.telephone,
    mobile: p.telephoneMobile,
    email: p.email,
    notes: p.notesGenerales,
    assigneA: p.assigneA?.name ?? null,
    tags: p.tags.map((t) => t.tag.nom),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const nextSince =
    prospects.length > 0
      ? prospects[prospects.length - 1]!.updatedAt.toISOString()
      : since.toISOString();

  return NextResponse.json({
    ok: true,
    rows,
    nextSince,
    hasMore: prospects.length === limit,
  });
}
