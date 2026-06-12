"use server";

/**
 * Server actions pour les tags d'entreprises.
 *
 * Règles :
 *  - Création / modification / suppression : ADMIN uniquement
 *  - Assignation / retrait sur une fiche : ADMIN uniquement
 *  - Lecture / filtrage : tous les users (admin + commerciale)
 *
 * Les tags sont des labels libres (ex. "Passeport Beauté", "VIP",
 * "Onboarding prioritaire") qu'on attache aux Prospects pour regroupement.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AVAILABLE_TAG_COLORS as TAG_COLORS,
  type TagColorOption as TagColor,
} from "@/app/(app)/prospects/tags-constants";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

const TagSchema = z.object({
  nom: z.string().trim().min(1).max(40),
  couleur: z.enum(TAG_COLORS).default("slate"),
  description: z.string().trim().max(200).optional().nullable(),
});

export async function createTag(
  input: unknown,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul un admin peut créer des tags." };
  }
  const parsed = TagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    const tag = await prisma.prospectTag.create({
      data: {
        nom: parsed.data.nom,
        couleur: parsed.data.couleur,
        description: parsed.data.description ?? null,
      },
    });
    revalidatePath("/prospects");
    revalidatePath("/prospects/tags");
    return { ok: true, id: tag.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur création";
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Un tag avec ce nom existe déjà." };
    }
    return { ok: false, error: msg };
  }
}

export async function updateTag(
  id: string,
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul un admin peut modifier les tags." };
  }
  const parsed = TagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    await prisma.prospectTag.update({
      where: { id },
      data: {
        nom: parsed.data.nom,
        couleur: parsed.data.couleur,
        description: parsed.data.description ?? null,
      },
    });
    revalidatePath("/prospects");
    revalidatePath("/prospects/tags");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function deleteTag(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul un admin peut supprimer les tags." };
  }
  try {
    await prisma.prospectTag.delete({ where: { id } });
    revalidatePath("/prospects");
    revalidatePath("/prospects/tags");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/**
 * Met à jour l'ensemble des tags d'un prospect (set complet).
 * `tagIds = []` retire tous les tags. Admin uniquement.
 */
export async function setProspectTags(
  prospectId: string,
  tagIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul un admin peut modifier les tags." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.prospectTagAssignment.deleteMany({ where: { prospectId } });
      if (tagIds.length > 0) {
        await tx.prospectTagAssignment.createMany({
          data: tagIds.map((tagId) => ({ prospectId, tagId })),
          skipDuplicates: true,
        });
      }
    });
    revalidatePath("/prospects");
    revalidatePath(`/prospects/${prospectId}`);
    revalidatePath("/prospects/tags");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// NB : ne PAS ré-exporter AVAILABLE_TAG_COLORS / TagColorOption ici.
// Ce fichier est marqué "use server" → Next.js 16 refuse tout export qui
// ne soit pas une async function (cf. tags-constants.ts à côté).
