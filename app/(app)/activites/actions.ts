"use server";

/**
 * Server Actions pour le module Activités.
 *
 * Convention de retour :
 *   { ok: true, activityId?: string, prochainActivityId?: string }
 *   { ok: false, error: string, fieldErrors?: Record<string, string> }
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  ActivityCreateSchema,
  ActivityUpdateSchema,
  RAPPEL_DELAI_JOURS,
  RecordCallResultSchema,
  StartCallSchema,
} from "@/lib/schemas/activity";
import { ForbiddenError, requireUser } from "@/lib/session";

// ===========================================================================
// TYPES RETOURNÉS
// ===========================================================================

export interface ActivityActionResult {
  ok: boolean;
  activityId?: string;
  /** Si une activity de rappel a été planifiée à la suite */
  prochainActivityId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ===========================================================================
// CREATE — manuel (formulaire "Logger une activité")
// ===========================================================================

export async function createActivity(
  input: unknown,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  const parsed = ActivityCreateSchema.safeParse(input);

  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  // Garde-fou RLS sur le prospect uniquement s'il est lié
  if (parsed.data.prospectId) {
    await assertCanAccessProspect(user, parsed.data.prospectId);
  }

  // Si admin et userId fourni → on assigne à ce user (Sophie par ex.)
  // Sinon, fallback sur l'user courant (Sophie ne peut s'assigner qu'à elle).
  const assignToUserId =
    user.role === "ADMIN" && parsed.data.userId ? parsed.data.userId : user.id;

  try {
    const created = await prisma.activity.create({
      data: {
        prospectId: parsed.data.prospectId ?? null,
        userId: assignToUserId,
        type: parsed.data.type,
        date: parsed.data.date,
        sujet: parsed.data.sujet,
        contenu: parsed.data.contenu,
        duree: parsed.data.duree,
        statut: parsed.data.statut,
        resultat: parsed.data.resultat,
        notesResultat: parsed.data.notesResultat,
      },
    });
    if (parsed.data.prospectId) {
      revalidatePath(`/prospects/${parsed.data.prospectId}`);
    }
    revalidatePath("/activites");
    revalidatePath("/agenda");
    return { ok: true, activityId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// UPDATE — édition d'une activité existante
// ===========================================================================

export async function updateActivity(
  id: string,
  input: unknown,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  await assertCanEditActivity(user, id);

  const parsed = ActivityUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  try {
    const updated = await prisma.activity.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath(`/prospects/${updated.prospectId}`);
    revalidatePath("/activites");
    return { ok: true, activityId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/** Marque une activité comme FAIT (action rapide depuis la liste). */
export async function markActivityDone(
  id: string,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  await assertCanEditActivity(user, id);

  try {
    const updated = await prisma.activity.update({
      where: { id },
      data: { statut: "FAIT" },
    });
    revalidatePath(`/prospects/${updated.prospectId}`);
    revalidatePath("/activites");
    return { ok: true, activityId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/** Replanifie une activité à une nouvelle date. */
export async function rescheduleActivity(
  id: string,
  newDate: Date,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  await assertCanEditActivity(user, id);

  try {
    const updated = await prisma.activity.update({
      where: { id },
      data: { date: newDate, statut: "REPLANIFIE" },
    });
    revalidatePath(`/prospects/${updated.prospectId}`);
    revalidatePath("/activites");
    return { ok: true, activityId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/** Supprime une activité (admin ou propriétaire). */
export async function deleteActivity(
  id: string,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  await assertCanEditActivity(user, id);

  try {
    const deleted = await prisma.activity.delete({ where: { id } });
    revalidatePath(`/prospects/${deleted.prospectId}`);
    revalidatePath("/activites");
    return { ok: true, activityId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// CLICK-TO-CALL (étape 6b/c, déjà câblés ici pour cohérence)
// ===========================================================================

/**
 * Démarre une session d'appel : crée une Activity APPEL_SORTANT
 * en statut EN_COURS et renvoie son id pour que le widget puisse la
 * compléter plus tard avec le résultat.
 */
export async function startCall(
  input: unknown,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  const parsed = StartCallSchema.safeParse(input);

  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  await assertCanAccessProspect(user, parsed.data.prospectId);

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: parsed.data.prospectId },
      select: { raisonSociale: true },
    });
    const created = await prisma.activity.create({
      data: {
        prospectId: parsed.data.prospectId,
        userId: user.id,
        type: "APPEL_SORTANT",
        date: new Date(),
        sujet: `Appel ${prospect?.raisonSociale ?? "prospect"}`,
        statut: "EN_COURS",
      },
    });
    return { ok: true, activityId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Enregistre le résultat d'un appel terminé.
 * Si résultat ∈ {COMBOX, NE_DECROCHE_PAS, A_RAPPELER, INTERESSE_PAS_PRET}
 *   ET qu'un délai de rappel est fourni → crée la prochaine activity auto
 *   et lie les deux via `rappelLeDe` / `prochaineActivityId`.
 *
 * Cas spéciaux :
 *   - REFUS_FERME → prospect.statut = NE_PAS_RAPPELER
 *   - INVALIDE   → on n'altère pas le téléphone ici (drapeau visuel sur la fiche)
 *   - RDV_PRIS   → pas de rappel auto (le RDV est créé séparément via le formulaire)
 */
export async function recordCallResult(
  input: unknown,
): Promise<ActivityActionResult> {
  const user = await requireUser();
  const parsed = RecordCallResultSchema.safeParse(input);

  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  // Charge l'activity originale + vérifie accès
  const original = await prisma.activity.findUnique({
    where: { id: parsed.data.activityId },
    select: {
      id: true,
      prospectId: true,
      userId: true,
      prospect: { select: { assigneAId: true } },
    },
  });
  if (!original) {
    return { ok: false, error: "Activité introuvable." };
  }
  if (user.role !== "ADMIN" && original.userId !== user.id) {
    return { ok: false, error: "Cette activité ne t'appartient pas." };
  }

  // Transaction : update original + cascade (statut prospect + rappel auto)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update de l'activity originale
      const updated = await tx.activity.update({
        where: { id: parsed.data.activityId },
        data: {
          statut: "FAIT",
          resultat: parsed.data.resultat,
          notesResultat: parsed.data.notesResultat,
          duree2: parsed.data.duree2,
        },
      });

      // 2. Cas spécial REFUS_FERME : prospect passe en NE_PAS_RAPPELER
      //    (uniquement si l'activité est rattachée à un prospect)
      if (parsed.data.resultat === "REFUS_FERME" && updated.prospectId) {
        await tx.prospect.update({
          where: { id: updated.prospectId },
          data: { statut: "NE_PAS_RAPPELER" },
        });
      }

      // 3. Rappel auto si pertinent et si délai fourni
      const resultatsDeclencheurs = [
        "COMBOX",
        "NE_DECROCHE_PAS",
        "A_RAPPELER",
        "INTERESSE_PAS_PRET",
      ] as const;
      const isRappelable = (
        resultatsDeclencheurs as readonly string[]
      ).includes(parsed.data.resultat);

      let prochainId: string | undefined;
      if (isRappelable && parsed.data.rappelDelai) {
        const nextDate =
          parsed.data.rappelDelai === "custom"
            ? parsed.data.rappelDateCustom!
            : addDays(new Date(), RAPPEL_DELAI_JOURS[parsed.data.rappelDelai]);

        const rappel = await tx.activity.create({
          data: {
            prospectId: updated.prospectId,
            userId: user.id,
            type: "APPEL_SORTANT",
            date: nextDate,
            sujet: "Rappel automatique",
            statut: "PLANIFIE",
            rappelLeDeId: updated.id,
          },
        });

        // Lien retour pour reconstruire la chaîne facilement
        await tx.activity.update({
          where: { id: updated.id },
          data: { prochaineActivityId: rappel.id },
        });

        prochainId = rappel.id;
      }

      return { activityId: updated.id, prochainActivityId: prochainId };
    });

    revalidatePath(`/prospects/${original.prospectId}`);
    revalidatePath("/activites");
    revalidatePath("/aujourd-hui");

    return { ok: true, ...result };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// HELPERS
// ===========================================================================

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function assertCanAccessProspect(
  user: { role: string; id: string },
  prospectId: string,
) {
  if (user.role === "ADMIN") return;
  const p = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { assigneAId: true },
  });
  if (!p) {
    throw new Error("Prospect introuvable.");
  }
  if (p.assigneAId !== user.id) {
    throw new ForbiddenError("Ce prospect n'est pas dans ton portefeuille.");
  }
}

async function assertCanEditActivity(
  user: { role: string; id: string },
  activityId: string,
) {
  if (user.role === "ADMIN") return;
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { userId: true, prospect: { select: { assigneAId: true } } },
  });
  if (!a) {
    throw new Error("Activité introuvable.");
  }
  // Une activité m'appartient si :
  //   - je l'ai créée (userId)
  //   - OU je suis assigné au prospect lié (s'il y en a un)
  const isOwner = a.userId === user.id;
  const ownsProspect =
    a.prospect !== null && a.prospect.assigneAId === user.id;
  if (!isOwner && !ownsProspect) {
    throw new ForbiddenError("Cette activité ne t'appartient pas.");
  }
}

function zodErrorToResult(err: import("zod").ZodError): ActivityActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return {
    ok: false,
    error: "Formulaire invalide.",
    fieldErrors,
  };
}

function prismaErrorToResult(err: unknown): ActivityActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[activity action] Prisma error", {
      code: err.code,
      message: err.message,
      meta: err.meta,
    });
    return {
      ok: false,
      error: `Erreur base de données (${err.code}). ${err.message.slice(0, 200)}`,
    };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: err.message };
  }
  console.error("[activity action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
