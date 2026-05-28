"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  SettingUpdateSchema,
  UserProfileUpdateSchema,
  UserRatesUpdateSchema,
} from "@/lib/schemas/settings";
import { requireAdmin, requireUser } from "@/lib/session";

export interface SettingActionResult {
  ok: boolean;
  error?: string;
}

export async function updateSettings(
  input: unknown,
): Promise<SettingActionResult> {
  await requireAdmin();
  const parsed = SettingUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/parametres");
  return { ok: true };
}

export async function updateMyProfile(
  input: unknown,
): Promise<SettingActionResult> {
  const user = await requireUser();
  const parsed = UserProfileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });
  revalidatePath("/parametres");
  return { ok: true };
}

export async function updateUserRates(
  input: unknown,
): Promise<SettingActionResult> {
  await requireAdmin();
  const parsed = UserRatesUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  const { userId, ...data } = parsed.data;
  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/parametres");
  return { ok: true };
}
