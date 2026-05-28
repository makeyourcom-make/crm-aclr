"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  DealCreateSchema,
  DealMoveStageSchema,
  DealUpdateSchema,
} from "@/lib/schemas/deal";
import { ForbiddenError, requireUser } from "@/lib/session";

export interface DealActionResult {
  ok: boolean;
  dealId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createDeal(input: unknown): Promise<DealActionResult> {
  const user = await requireUser();
  const parsed = DealCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  // RLS sur le prospect
  if (user.role !== "ADMIN") {
    const p = await prisma.prospect.findUnique({
      where: { id: parsed.data.prospectId },
      select: { assigneAId: true },
    });
    if (!p || p.assigneAId !== user.id) {
      return { ok: false, error: "Tu n'as pas accès à ce prospect." };
    }
  }

  try {
    const { productIds, ...rest } = parsed.data;
    const created = await prisma.deal.create({
      data: {
        ...rest,
        assigneAId: user.id,
        productsProposes:
          productIds && productIds.length > 0
            ? { connect: productIds.map((id) => ({ id })) }
            : undefined,
      },
    });
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${parsed.data.prospectId}`);
    return { ok: true, dealId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// UPDATE générique
// ---------------------------------------------------------------------------

export async function updateDeal(
  id: string,
  input: unknown,
): Promise<DealActionResult> {
  const user = await requireUser();
  await assertCanEditDeal(user, id);
  const parsed = DealUpdateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    const { productIds, ...rest } = parsed.data;
    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...rest,
        ...(productIds !== undefined && {
          productsProposes: {
            set: productIds.map((pid) => ({ id: pid })),
          },
        }),
      },
    });
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${updated.prospectId}`);
    return { ok: true, dealId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// MOVE STAGE (drag & drop)
// ---------------------------------------------------------------------------

export async function moveDealStage(
  input: unknown,
): Promise<DealActionResult> {
  const user = await requireUser();
  const parsed = DealMoveStageSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  await assertCanEditDeal(user, parsed.data.dealId);

  try {
    // Calcule la probabilité par défaut associée au nouveau stage
    const probaDefaut: Record<string, number> = {
      DECOUVERTE: 10,
      PROPOSITION: 40,
      NEGOCIATION: 70,
      SIGNE: 100,
      PERDU: 0,
    };

    const updated = await prisma.deal.update({
      where: { id: parsed.data.dealId },
      data: {
        stage: parsed.data.newStage,
        // On surcharge la probabilité par défaut quand on bascule
        probabilite: probaDefaut[parsed.data.newStage] ?? undefined,
        // Si SIGNE / PERDU on enregistre la date close réelle
        closeReelLe:
          parsed.data.newStage === "SIGNE" || parsed.data.newStage === "PERDU"
            ? new Date()
            : undefined,
      },
    });
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${updated.prospectId}`);
    return { ok: true, dealId: updated.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteDeal(id: string): Promise<DealActionResult> {
  const user = await requireUser();
  await assertCanEditDeal(user, id);
  try {
    const deleted = await prisma.deal.delete({ where: { id } });
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${deleted.prospectId}`);
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function assertCanEditDeal(
  user: { role: string; id: string },
  dealId: string,
) {
  if (user.role === "ADMIN") return;
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { assigneAId: true },
  });
  if (!d) throw new Error("Deal introuvable.");
  if (d.assigneAId !== user.id) {
    throw new ForbiddenError("Ce deal ne t'appartient pas.");
  }
}

function zodErrorToResult(err: import("zod").ZodError): DealActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !fieldErrors[p]) fieldErrors[p] = issue.message;
  }
  return { ok: false, error: "Formulaire invalide.", fieldErrors };
}

function prismaErrorToResult(err: unknown): DealActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[deal action] Prisma error", {
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
  console.error("[deal action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
