/**
 * POST /api/sync/prospects/ingest
 *
 * Reçoit un lot de lignes du master (BASE_PROSPECTS) et les fusionne dans le
 * CRM. Authentifié par l'en-tête `x-sync-key` (= SYNC_API_KEY).
 *
 * Règles d'autorité (cf. lib/sync/prospect-sync) :
 *  - Fiche existante (liée par masterId, ou rattachée par nom) : on met à jour
 *    UNIQUEMENT les champs scrapés (master). Les champs commerciaux du CRM ne
 *    sont jamais écrasés ; les contacts ne sont remplis que s'ils sont vides.
 *  - Fiche nouvelle : on crée tout depuis le master.
 *
 * Réponse : { ok, created, updated, linked }.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  masterContactFields,
  masterOwnedFields,
  mapStatutFromMaster,
  normalizeName,
  type MasterRow,
} from "@/lib/sync/prospect-sync";

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

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    await audit("sync.auth_fail", { metadata: { route: "ingest" } });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { rows?: MasterRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ ok: true, created: 0, updated: 0, linked: 0 });
  if (rows.length > 2000) {
    return NextResponse.json({ ok: false, error: "Lot trop grand (max 2000)" }, { status: 400 });
  }

  const now = new Date();

  // Les nouvelles entreprises arrivant par la synchro sont auto-attribuées à la
  // commerciale active (Sophie) — elles atterrissent directement dans son
  // portefeuille au lieu de rester sans responsable. (Uniquement les créations ;
  // les fiches existantes gardent leur attribution.)
  const commerciale = await prisma.user.findFirst({
    where: { role: "COMMERCIAL", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const defaultAssigneeId = commerciale?.id ?? null;

  const masterIds = rows.map((r) => r.masterId).filter((n) => Number.isInteger(n));
  const nameNorms = [...new Set(rows.map((r) => normalizeName(r.nom)).filter(Boolean))];

  // Fiches déjà liées (par masterId) + fiches CRM non liées matchables (par nom).
  const [linkedExisting, unlinkedByName] = await Promise.all([
    prisma.prospect.findMany({
      where: { masterId: { in: masterIds } },
      select: { id: true, masterId: true },
    }),
    prisma.prospect.findMany({
      where: { masterId: null, nameNorm: { in: nameNorms } },
      select: {
        id: true,
        nameNorm: true,
        telephone: true,
        telephoneMobile: true,
        email: true,
        contactNom: true,
      },
    }),
  ]);

  const byMasterId = new Map(linkedExisting.map((p) => [p.masterId!, p.id]));
  const byName = new Map<string, (typeof unlinkedByName)[number]>();
  for (const p of unlinkedByName) if (p.nameNorm && !byName.has(p.nameNorm)) byName.set(p.nameNorm, p);

  const claimed = new Set<string>(); // ids CRM déjà revendiqués dans ce lot
  const toCreate: object[] = [];
  const updateOps: ReturnType<typeof prisma.prospect.update>[] = [];
  let created = 0,
    updated = 0,
    linked = 0;

  for (const row of rows) {
    if (!Number.isInteger(row.masterId) || !row.nom) continue;
    const nn = normalizeName(row.nom);
    const owned = masterOwnedFields(row);
    const contact = masterContactFields(row);

    const linkedId = byMasterId.get(row.masterId);
    if (linkedId) {
      // Déjà liée : MAJ des champs scrapés uniquement.
      updateOps.push(
        prisma.prospect.update({
          where: { id: linkedId },
          data: { ...owned, nameNorm: nn, masterSyncedAt: now },
        }),
      );
      updated++;
      continue;
    }

    const candidate = byName.get(nn);
    if (candidate && !claimed.has(candidate.id)) {
      // Rattachement d'une fiche CRM existante : on lie + champs scrapés, et on
      // remplit les contacts seulement s'ils sont vides côté CRM.
      claimed.add(candidate.id);
      updateOps.push(
        prisma.prospect.update({
          where: { id: candidate.id },
          data: {
            masterId: row.masterId,
            nameNorm: nn,
            masterSyncedAt: now,
            ...owned,
            telephone: candidate.telephone ?? contact.telephone,
            telephoneMobile: candidate.telephoneMobile ?? contact.telephoneMobile,
            email: candidate.email ?? contact.email,
            contactNom: candidate.contactNom ?? contact.contactNom,
          },
        }),
      );
      linked++;
      continue;
    }

    // Nouvelle fiche.
    toCreate.push({
      masterId: row.masterId,
      nameNorm: nn,
      masterSyncedAt: now,
      raisonSociale: row.nom.trim().slice(0, 255),
      statut: mapStatutFromMaster(row.statutMaster),
      source: "FICHIER_IMPORT",
      ...(defaultAssigneeId ? { assigneAId: defaultAssigneeId } : {}),
      ...owned,
      ...contact,
    });
    created++;
  }

  // Exécution : créations en masse + mises à jour transactionnelles.
  if (toCreate.length > 0) {
    await prisma.prospect.createMany({ data: toCreate as never, skipDuplicates: true });
  }
  // Les updates par tranches pour éviter une transaction géante.
  for (let i = 0; i < updateOps.length; i += 200) {
    await prisma.$transaction(updateOps.slice(i, i + 200));
  }

  // Recale masterSyncedAt = updatedAt pour TOUTES les fiches du lot : ainsi
  // `updatedAt > masterSyncedAt` est faux juste après l'ingest (pas de
  // ré-export parasite), et ne devient vrai qu'à la prochaine modif humaine.
  const ingestedIds = masterIds.filter((n) => Number.isInteger(n));
  if (ingestedIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE prospects SET "masterSyncedAt" = "updatedAt" WHERE "masterId" IN (${ingestedIds.join(",")})`,
    );
  }

  return NextResponse.json({ ok: true, created, updated, linked });
}
