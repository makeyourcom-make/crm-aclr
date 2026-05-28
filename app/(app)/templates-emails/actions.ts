"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  EmailTemplateCreateSchema,
  EmailTemplateUpdateSchema,
} from "@/lib/schemas/email-template";
import { ForbiddenError, requireAdmin } from "@/lib/session";

export interface TemplateActionResult {
  ok: boolean;
  templateId?: string;
  error?: string;
}

export async function createTemplate(
  input: unknown,
): Promise<TemplateActionResult> {
  await requireAdmin();
  const parsed = EmailTemplateCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    const created = await prisma.emailTemplate.create({ data: parsed.data });
    revalidatePath("/templates-emails");
    return { ok: true, templateId: created.id };
  } catch (err) {
    return prismaErr(err);
  }
}

export async function updateTemplate(
  id: string,
  input: unknown,
): Promise<TemplateActionResult> {
  await requireAdmin();
  const parsed = EmailTemplateUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    await prisma.emailTemplate.update({ where: { id }, data: parsed.data });
    revalidatePath("/templates-emails");
    revalidatePath(`/templates-emails/${id}/modifier`);
    return { ok: true, templateId: id };
  } catch (err) {
    return prismaErr(err);
  }
}

export async function deleteTemplate(id: string): Promise<TemplateActionResult> {
  await requireAdmin();
  try {
    const refs = await prisma.email.count({ where: { templateUtiliseId: id } });
    if (refs > 0) {
      return {
        ok: false,
        error: `Bloqué : ce template est lié à ${refs} email(s) envoyé(s). Désactive-le plutôt.`,
      };
    }
    await prisma.emailTemplate.delete({ where: { id } });
    revalidatePath("/templates-emails");
    return { ok: true };
  } catch (err) {
    return prismaErr(err);
  }
}

export async function toggleTemplateActive(
  id: string,
): Promise<TemplateActionResult> {
  await requireAdmin();
  const cur = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!cur) return { ok: false, error: "Introuvable." };
  await prisma.emailTemplate.update({
    where: { id },
    data: { isActive: !cur.isActive },
  });
  revalidatePath("/templates-emails");
  return { ok: true };
}

function prismaErr(err: unknown): TemplateActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return { ok: false, error: `BDD (${err.code})` };
  }
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error("[template action]", err);
  return { ok: false, error: "Erreur serveur." };
}
