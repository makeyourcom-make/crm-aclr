"use server";

/**
 * Server Actions pour la fusion de doublons d'entreprises.
 *
 * Flux : un commercial (propriétaire des DEUX fiches) ou un admin crée une
 * demande de fusion EN_ATTENTE ; un admin la valide (fusion réelle) ou la
 * refuse. La fusion effective est déléguée à `mergeProspects` (lib) qui déplace
 * toutes les données de la source vers la cible et marque la source fusionnée.
 *
 * Convention de retour : { ok: true, ... } | { ok: false, error: string }.
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { mergeProspects } from "@/lib/prospect-merge";
import { requireAdmin, requireUser } from "@/lib/session";

export interface MergeActionResult {
  ok: boolean;
  error?: string;
  moved?: Record<string, number>;
}

function prismaError(err: unknown, fallback: string): MergeActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[merge action] PrismaClientKnownRequestError", {
      code: err.code,
      meta: err.meta,
    });
  } else {
    console.error("[merge action]", err);
  }
  return { ok: false, error: fallback };
}

// ===========================================================================
// DEMANDE DE FUSION
// ===========================================================================

/**
 * Crée une demande de fusion EN_ATTENTE.
 * `cible` = fiche conservée, `source` = doublon fusionné dedans.
 * Autorisé : admin, ou commercial propriétaire des DEUX fiches.
 */
export async function requestMerge(input: {
  cibleId: string;
  sourceId: string;
  note?: string;
}): Promise<MergeActionResult> {
  const user = await requireUser();
  const { cibleId, sourceId } = input;
  const note = input.note?.trim() || null;

  if (!cibleId || !sourceId) {
    return { ok: false, error: "Fiche à conserver et doublon requis." };
  }
  if (cibleId === sourceId) {
    return { ok: false, error: "Choisis deux fiches différentes." };
  }

  try {
    const [cible, source] = await Promise.all([
      prisma.prospect.findUnique({
        where: { id: cibleId },
        select: { id: true, assigneAId: true, mergedIntoId: true },
      }),
      prisma.prospect.findUnique({
        where: { id: sourceId },
        select: { id: true, assigneAId: true, mergedIntoId: true },
      }),
    ]);
    if (!cible) return { ok: false, error: "Fiche à conserver introuvable." };
    if (!source) return { ok: false, error: "Doublon introuvable." };
    if (cible.mergedIntoId || source.mergedIntoId) {
      return { ok: false, error: "Une des fiches est déjà fusionnée." };
    }

    // Permission : admin OU propriétaire des DEUX fiches.
    if (user.role !== "ADMIN") {
      const ownsBoth =
        cible.assigneAId === user.id && source.assigneAId === user.id;
      if (!ownsBoth) {
        return {
          ok: false,
          error: "Tu dois être responsable des deux fiches pour demander la fusion.",
        };
      }
    }

    // Pas de demande EN_ATTENTE déjà existante pour ce couple (dans un sens ou l'autre).
    const existing = await prisma.prospectMerge.findFirst({
      where: {
        statut: "EN_ATTENTE",
        OR: [
          { cibleId, sourceId },
          { cibleId: sourceId, sourceId: cibleId },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Une demande de fusion est déjà en attente pour ces deux fiches." };
    }

    await prisma.prospectMerge.create({
      data: {
        cibleId,
        sourceId,
        demandeParId: user.id,
        statut: "EN_ATTENTE",
        note,
      },
    });

    revalidatePath("/prospects");
    revalidatePath("/prospects/fusions");
    revalidatePath(`/prospects/${cibleId}`);
    revalidatePath(`/prospects/${sourceId}`);
    return { ok: true };
  } catch (err) {
    return prismaError(err, "Impossible de créer la demande de fusion.");
  }
}

/**
 * Retrouve l'id de la demande EN_ATTENTE d'un couple (cible, source), dans un
 * sens ou l'autre. Permet à l'admin de valider une demande fraîchement créée.
 */
export async function findPendingMergeId(
  cibleId: string,
  sourceId: string,
): Promise<string | null> {
  await requireUser();
  const demande = await prisma.prospectMerge.findFirst({
    where: {
      statut: "EN_ATTENTE",
      OR: [
        { cibleId, sourceId },
        { cibleId: sourceId, sourceId: cibleId },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return demande?.id ?? null;
}

// ===========================================================================
// VALIDATION (ADMIN)
// ===========================================================================

/**
 * Valide une demande de fusion : exécute la fusion réelle puis marque la
 * demande VALIDEE. Admin uniquement.
 */
export async function approuverMerge(mergeId: string): Promise<MergeActionResult> {
  const admin = await requireAdmin();
  try {
    const demande = await prisma.prospectMerge.findUnique({
      where: { id: mergeId },
      select: { id: true, cibleId: true, sourceId: true, statut: true },
    });
    if (!demande) return { ok: false, error: "Demande introuvable." };
    if (demande.statut !== "EN_ATTENTE") {
      return { ok: false, error: "Cette demande a déjà été traitée." };
    }

    const res = await mergeProspects(demande.cibleId, demande.sourceId);
    if (!res.ok) {
      return { ok: false, error: res.error ?? "Échec de la fusion." };
    }

    await prisma.prospectMerge.update({
      where: { id: mergeId },
      data: {
        statut: "VALIDEE",
        valideParId: admin.id,
        valideeLe: new Date(),
      },
    });

    revalidatePath("/prospects");
    revalidatePath("/prospects/fusions");
    revalidatePath(`/prospects/${demande.cibleId}`);
    revalidatePath(`/prospects/${demande.sourceId}`);
    return { ok: true, moved: res.moved };
  } catch (err) {
    return prismaError(err, "Impossible de valider la fusion.");
  }
}

// ===========================================================================
// REFUS (ADMIN)
// ===========================================================================

/**
 * Refuse une demande de fusion (aucune donnée déplacée). Admin uniquement.
 */
export async function refuserMerge(
  mergeId: string,
  note?: string,
): Promise<MergeActionResult> {
  await requireAdmin();
  try {
    const demande = await prisma.prospectMerge.findUnique({
      where: { id: mergeId },
      select: { id: true, cibleId: true, sourceId: true, statut: true, note: true },
    });
    if (!demande) return { ok: false, error: "Demande introuvable." };
    if (demande.statut !== "EN_ATTENTE") {
      return { ok: false, error: "Cette demande a déjà été traitée." };
    }

    const trimmed = note?.trim();
    await prisma.prospectMerge.update({
      where: { id: mergeId },
      data: {
        statut: "REFUSEE",
        note: trimmed ? trimmed : demande.note,
      },
    });

    revalidatePath("/prospects");
    revalidatePath("/prospects/fusions");
    revalidatePath(`/prospects/${demande.cibleId}`);
    revalidatePath(`/prospects/${demande.sourceId}`);
    return { ok: true };
  } catch (err) {
    return prismaError(err, "Impossible de refuser la demande.");
  }
}
