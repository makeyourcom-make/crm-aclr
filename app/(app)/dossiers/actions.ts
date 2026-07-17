"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  DossierAddUpdateSchema,
  DossierCreateSchema,
  DossierMoveSchema,
  DossierUpdateSchema,
} from "@/lib/schemas/dossier";
import { ForbiddenError, requireUser } from "@/lib/session";

export interface DossierActionResult {
  ok: boolean;
  dossierId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// RLS : admin, ou assigné, ou créateur
// ---------------------------------------------------------------------------
async function assertCanAccessDossier(
  user: { role: string; id: string },
  dossierId: string,
) {
  if (user.role === "ADMIN") return;
  const d = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { assigneAId: true, creeParId: true },
  });
  if (!d) throw new Error("Dossier introuvable.");
  if (d.assigneAId !== user.id && d.creeParId !== user.id) {
    throw new ForbiddenError("Ce dossier ne t'est pas accessible.");
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createDossier(
  input: unknown,
): Promise<DossierActionResult> {
  const user = await requireUser();
  const parsed = DossierCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    const created = await prisma.dossier.create({
      data: {
        titre: parsed.data.titre,
        description: parsed.data.description || null,
        assigneAId: parsed.data.assigneAId,
        creeParId: user.id,
        prospectId: parsed.data.prospectId || null,
        priorite: parsed.data.priorite,
        echeance: parsed.data.echeance ?? null,
      },
    });
    revalidatePath("/dossiers");
    return { ok: true, dossierId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// UPDATE (titre / description / assignation / priorité / échéance / client)
// ---------------------------------------------------------------------------
export async function updateDossier(
  id: string,
  input: unknown,
): Promise<DossierActionResult> {
  const user = await requireUser();
  await assertCanAccessDossier(user, id);
  const parsed = DossierUpdateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    await prisma.dossier.update({
      where: { id },
      data: {
        ...(parsed.data.titre !== undefined && { titre: parsed.data.titre }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description || null,
        }),
        ...(parsed.data.assigneAId !== undefined && {
          assigneAId: parsed.data.assigneAId,
        }),
        ...(parsed.data.prospectId !== undefined && {
          prospectId: parsed.data.prospectId || null,
        }),
        ...(parsed.data.priorite !== undefined && {
          priorite: parsed.data.priorite,
        }),
        ...(parsed.data.echeance !== undefined && {
          echeance: parsed.data.echeance,
        }),
      },
    });
    revalidatePath("/dossiers");
    return { ok: true, dossierId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// MOVE (drag & drop entre colonnes)
// ---------------------------------------------------------------------------
export async function moveDossierStatut(
  input: unknown,
): Promise<DossierActionResult> {
  const user = await requireUser();
  const parsed = DossierMoveSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);
  await assertCanAccessDossier(user, parsed.data.dossierId);

  // Déposer dans la colonne d'un AUTRE collaborateur = réassigner. Seul l'admin
  // peut le faire : sans ce garde-fou, une commerciale pourrait se débarrasser
  // d'un dossier en le poussant chez quelqu'un d'autre (l'UI ne lui montre que
  // ses propres colonnes, mais l'action serveur reste appelable directement).
  const { newAssigneAId } = parsed.data;
  if (newAssigneAId && user.role !== "ADMIN") {
    const d = await prisma.dossier.findUnique({
      where: { id: parsed.data.dossierId },
      select: { assigneAId: true },
    });
    if (d && d.assigneAId !== newAssigneAId) {
      return { ok: false, error: "Seul un admin peut réassigner un dossier." };
    }
  }

  try {
    await prisma.dossier.update({
      where: { id: parsed.data.dossierId },
      data: {
        statut: parsed.data.newStatut,
        ...(newAssigneAId && { assigneAId: newAssigneAId }),
        // Horodate la clôture ; réinitialise si le dossier ressort de Terminé.
        termineLe: parsed.data.newStatut === "TERMINE" ? new Date() : null,
      },
    });
    revalidatePath("/dossiers");
    return { ok: true, dossierId: parsed.data.dossierId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// ADD UPDATE (fil de suivi horodaté)
// ---------------------------------------------------------------------------
export async function addDossierUpdate(
  input: unknown,
): Promise<DossierActionResult> {
  const user = await requireUser();
  const parsed = DossierAddUpdateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);
  await assertCanAccessDossier(user, parsed.data.dossierId);

  try {
    await prisma.dossierUpdate.create({
      data: {
        dossierId: parsed.data.dossierId,
        auteurId: user.id,
        contenu: parsed.data.contenu,
      },
    });
    // Bump le dossier (remonte en tête de colonne).
    await prisma.dossier.update({
      where: { id: parsed.data.dossierId },
      data: { updatedAt: new Date() },
    });
    revalidatePath("/dossiers");
    return { ok: true, dossierId: parsed.data.dossierId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export async function deleteDossier(id: string): Promise<DossierActionResult> {
  const user = await requireUser();
  await assertCanAccessDossier(user, id);
  try {
    await prisma.dossier.delete({ where: { id } });
    revalidatePath("/dossiers");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function zodErrorToResult(err: import("zod").ZodError): DossierActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !fieldErrors[p]) fieldErrors[p] = issue.message;
  }
  return { ok: false, error: "Formulaire invalide.", fieldErrors };
}

function prismaErrorToResult(err: unknown): DossierActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[dossier action] Prisma error", {
      code: err.code,
      message: err.message,
    });
    return {
      ok: false,
      error: `Erreur base de données (${err.code}).`,
    };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: err.message };
  }
  console.error("[dossier action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
