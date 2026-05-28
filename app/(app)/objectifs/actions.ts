"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { ObjectiveCreateSchema } from "@/lib/schemas/objective";
import { requireUser } from "@/lib/session";

export interface ObjectiveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function createObjective(input: unknown): Promise<ObjectiveResult> {
  const user = await requireUser();
  const parsed = ObjectiveCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  if (user.role !== "ADMIN" && parsed.data.userId !== user.id) {
    return { ok: false, error: "Tu ne peux fixer un objectif que sur toi." };
  }
  const created = await prisma.objective.create({
    data: { ...parsed.data, isActif: true },
  });
  revalidatePath("/objectifs");
  return { ok: true, id: created.id };
}

export async function deleteObjective(id: string): Promise<ObjectiveResult> {
  const user = await requireUser();
  const obj = await prisma.objective.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!obj) return { ok: false, error: "Introuvable." };
  if (user.role !== "ADMIN" && obj.userId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  await prisma.objective.delete({ where: { id } });
  revalidatePath("/objectifs");
  return { ok: true };
}
