"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateMonthlyInvoice } from "@/lib/invoices-engine";
import {
  GenerateInvoiceSchema,
  MarkInvoicePayeeSchema,
} from "@/lib/schemas/invoice";
import { ForbiddenError, requireAdmin, requireUser } from "@/lib/session";

export interface InvoiceActionResult {
  ok: boolean;
  invoiceId?: string;
  numero?: string;
  error?: string;
}

// ===========================================================================
// GÉNÉRATION manuelle d'une facture mensuelle pour 1 user / 1 mois
// ===========================================================================

export async function generateInvoiceAction(
  input: unknown,
): Promise<InvoiceActionResult> {
  await requireAdmin();
  const parsed = GenerateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Paramètres invalides." };
  }

  try {
    const res = await generateMonthlyInvoice(
      parsed.data.userId,
      parsed.data.annee,
      parsed.data.mois,
    );
    revalidatePath("/factures");
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      invoiceId: res.invoiceId,
      numero: res.numero,
    };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// PASSAGE DE STATUTS
// ===========================================================================

export async function markInvoiceEnvoyee(
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const user = await requireUser();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { userId: true, statut: true },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (user.role !== "ADMIN" && invoice.userId !== user.id) {
    return { ok: false, error: "Pas d'accès à cette facture." };
  }
  if (invoice.statut !== "BROUILLON") {
    return { ok: false, error: `Statut actuel : ${invoice.statut}.` };
  }
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { statut: "ENVOYEE" },
    });
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

export async function markInvoicePayee(
  input: unknown,
): Promise<InvoiceActionResult> {
  await requireAdmin();
  const parsed = MarkInvoicePayeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { id: true, statut: true },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (invoice.statut === "PAYEE") {
    return { ok: false, error: "Déjà marquée payée." };
  }
  try {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { statut: "PAYEE" },
    });
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoice.id}`);
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------

function prismaErrorToResult(err: unknown): InvoiceActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[invoice action] Prisma error", {
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
  console.error("[invoice action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
