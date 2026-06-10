"use server";

/**
 * CRUD des signatures email personnalisées (par utilisateur).
 * Le HTML est généré depuis les champs guidés et stocké pour l'envoi.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { buildSignatureHtml } from "@/lib/email-signature";
import { requireUser } from "@/lib/session";

export interface SignatureActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const SignatureSchema = z.object({
  nom: z.string().trim().min(1, "Donne un nom à la signature.").max(60),
  displayName: z.string().trim().min(1, "Le nom affiché est requis.").max(120),
  fonction: opt,
  telephone: opt,
  email: opt,
  siteWeb: opt,
  entreprise: opt,
  logoUrl: opt,
  isDefault: z.coerce.boolean().optional().default(false),
});

export async function createSignature(
  input: unknown,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  const parsed = SignatureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  const d = parsed.data;
  const html = buildSignatureHtml(d);
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (d.isDefault) {
        await tx.emailSignature.updateMany({
          where: { userId: user.id },
          data: { isDefault: false },
        });
      }
      // Première signature → par défaut d'office
      const count = await tx.emailSignature.count({
        where: { userId: user.id },
      });
      return tx.emailSignature.create({
        data: {
          userId: user.id,
          nom: d.nom,
          displayName: d.displayName,
          fonction: d.fonction,
          telephone: d.telephone,
          email: d.email,
          siteWeb: d.siteWeb,
          entreprise: d.entreprise,
          logoUrl: d.logoUrl,
          html,
          isDefault: d.isDefault || count === 0,
        },
      });
    });
    revalidatePath("/parametres/signatures");
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Échec de la création." };
  }
}

export async function updateSignature(
  id: string,
  input: unknown,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  const parsed = SignatureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  const existing = await prisma.emailSignature.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Signature introuvable." };
  }
  const d = parsed.data;
  const html = buildSignatureHtml(d);
  try {
    await prisma.$transaction(async (tx) => {
      if (d.isDefault) {
        await tx.emailSignature.updateMany({
          where: { userId: user.id, id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.emailSignature.update({
        where: { id },
        data: {
          nom: d.nom,
          displayName: d.displayName,
          fonction: d.fonction,
          telephone: d.telephone,
          email: d.email,
          siteWeb: d.siteWeb,
          entreprise: d.entreprise,
          logoUrl: d.logoUrl,
          html,
          isDefault: d.isDefault,
        },
      });
    });
    revalidatePath("/parametres/signatures");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Échec de l'enregistrement." };
  }
}

export async function deleteSignature(
  id: string,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  const existing = await prisma.emailSignature.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Signature introuvable." };
  }
  await prisma.emailSignature.delete({ where: { id } });
  // Si on a supprimé la signature par défaut, promeut la plus récente.
  if (existing.isDefault) {
    const next = await prisma.emailSignature.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (next) {
      await prisma.emailSignature.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  revalidatePath("/parametres/signatures");
  return { ok: true, id };
}

export async function setDefaultSignature(
  id: string,
): Promise<SignatureActionResult> {
  const user = await requireUser();
  const existing = await prisma.emailSignature.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Signature introuvable." };
  }
  await prisma.$transaction([
    prisma.emailSignature.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    }),
    prisma.emailSignature.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/parametres/signatures");
  return { ok: true, id };
}
