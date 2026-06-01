"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { generateRecurrentExpenses } from "@/lib/expense-recurrence";
import { requireAdmin } from "@/lib/session";

const CategorieEnum = z.enum([
  "LOYER",
  "SOFTWARE_SAAS",
  "MARKETING",
  "PUBLICITE",
  "DEPLACEMENTS",
  "RESTAURATION",
  "MATERIEL_BUREAU",
  "ASSURANCES",
  "TELECOM",
  "FORMATION",
  "HONORAIRES",
  "IMPOTS",
  "BANQUE_FRAIS",
  "AUTRE",
]);

const FrequenceEnum = z.enum([
  "MENSUEL",
  "BIMESTRIEL",
  "TRIMESTRIEL",
  "SEMESTRIEL",
  "ANNUEL",
]);

const CreateRecurrenceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  categorie: CategorieEnum,
  fournisseur: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  montantEstime: z.coerce.number().min(0),
  tauxTVA: z.coerce.number().min(0).max(1).default(0.077),
  frequence: FrequenceEnum.default("MENSUEL"),
  jourMois: z.coerce.number().int().min(1).max(28).optional().nullable(),
  prospectId: z.string().optional().nullable(),
  actif: z.coerce.boolean().default(true),
  dateFin: z.coerce.date().optional().nullable(),
});

export async function createRecurrence(input: unknown) {
  await requireAdmin();
  const parsed = CreateRecurrenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalide.",
    };
  }
  const created = await prisma.expenseRecurrence.create({
    data: {
      label: parsed.data.label,
      categorie: parsed.data.categorie,
      fournisseur: parsed.data.fournisseur ?? null,
      description: parsed.data.description ?? null,
      montantEstime: parsed.data.montantEstime,
      tauxTVA: parsed.data.tauxTVA,
      frequence: parsed.data.frequence,
      jourMois: parsed.data.jourMois ?? null,
      prospectId: parsed.data.prospectId ?? null,
      actif: parsed.data.actif,
      dateFin: parsed.data.dateFin ?? null,
    },
  });
  revalidatePath("/charges/recurrences");
  return { ok: true as const, id: created.id };
}

export async function toggleRecurrenceActive(id: string) {
  await requireAdmin();
  const cur = await prisma.expenseRecurrence.findUnique({ where: { id } });
  if (!cur) return { ok: false as const, error: "Introuvable" };
  await prisma.expenseRecurrence.update({
    where: { id },
    data: { actif: !cur.actif },
  });
  revalidatePath("/charges/recurrences");
  return { ok: true as const };
}

export async function deleteRecurrence(id: string) {
  await requireAdmin();
  await prisma.expenseRecurrence.delete({ where: { id } });
  revalidatePath("/charges/recurrences");
  return { ok: true as const };
}

const GenerateSchema = z.object({
  monthYearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function generateMonthlyRecurrences(input: unknown) {
  const admin = await requireAdmin();
  const parsed = GenerateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Format mois invalide." };
  }
  const ym = parsed.data.monthYearMonth;
  let from: Date;
  let to: Date;
  if (ym) {
    const [y, m] = ym.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 1);
  } else {
    const now = new Date();
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const res = await generateRecurrentExpenses({
    from,
    to,
    createdById: admin.id,
  });
  revalidatePath("/charges");
  revalidatePath("/charges/recurrences");
  return { ok: true as const, ...res };
}
