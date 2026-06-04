"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

/**
 * Génère (ou régénère) le token iCalendar du user courant.
 * Si un token existait, l'ancien lien d'abonnement est immédiatement révoqué.
 */
export async function regenerateCalendarFeedToken(): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  const user = await requireUser();
  const token = randomBytes(24).toString("hex"); // 48 caractères, suffisant
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { calendarFeedToken: token },
    });
    revalidatePath("/settings/calendar");
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/**
 * Désactive l'abonnement (efface le token). L'URL existante renverra 404.
 */
export async function disableCalendarFeed(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await requireUser();
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { calendarFeedToken: null },
    });
    revalidatePath("/settings/calendar");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}
