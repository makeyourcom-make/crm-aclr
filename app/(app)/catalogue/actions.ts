"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  ProductCreateSchema,
  ProductPriceUpdateSchema,
  ProductUpdateSchema,
} from "@/lib/schemas/product";
import { ForbiddenError, requireAdmin } from "@/lib/session";

export interface ProductActionResult {
  ok: boolean;
  productId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProduct(input: unknown): Promise<ProductActionResult> {
  await requireAdmin();
  const parsed = ProductCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    const { composantsIds, ...rest } = parsed.data;
    const created = await prisma.product.create({
      data: {
        ...rest,
        composantsIds:
          parsed.data.type === "PACK" && composantsIds
            ? composantsIds
            : undefined,
      },
    });
    revalidatePath("/catalogue");
    return { ok: true, productId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

export async function updateProduct(
  id: string,
  input: unknown,
): Promise<ProductActionResult> {
  await requireAdmin();
  const parsed = ProductUpdateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    const { composantsIds, ...rest } = parsed.data;
    await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(composantsIds !== undefined && { composantsIds }),
      },
    });
    revalidatePath("/catalogue");
    revalidatePath(`/catalogue/${id}/modifier`);
    return { ok: true, productId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Édition rapide d'un seul prix depuis la liste. value = null pour vider.
 */
export async function updateProductPrice(
  input: unknown,
): Promise<ProductActionResult> {
  await requireAdmin();
  const parsed = ProductPriceUpdateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    await prisma.product.update({
      where: { id: parsed.data.productId },
      data: { [parsed.data.field]: parsed.data.value },
    });
    revalidatePath("/catalogue");
    return { ok: true, productId: parsed.data.productId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

export async function toggleProductActive(
  id: string,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    const current = await prisma.product.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!current) return { ok: false, error: "Produit introuvable." };
    await prisma.product.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    revalidatePath("/catalogue");
    return { ok: true, productId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

export async function deleteProduct(
  id: string,
): Promise<ProductActionResult> {
  await requireAdmin();
  try {
    // Garde-fou : refuser la suppression si le produit est référencé par
    // un deal ou un contrat (sinon on perd l'historique commercial).
    const refs = await prisma.product.findUnique({
      where: { id },
      select: {
        _count: { select: { deals: true, contracts: true } },
      },
    });
    if (!refs) return { ok: false, error: "Produit introuvable." };
    if (refs._count.deals > 0 || refs._count.contracts > 0) {
      return {
        ok: false,
        error: `Suppression bloquée : ce produit est lié à ${refs._count.deals} deal(s) et ${refs._count.contracts} contrat(s). Désactive-le plutôt.`,
      };
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------

function zodErrorToResult(err: import("zod").ZodError): ProductActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !fieldErrors[p]) fieldErrors[p] = issue.message;
  }
  return { ok: false, error: "Formulaire invalide.", fieldErrors };
}

function prismaErrorToResult(err: unknown): ProductActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[product action] Prisma error", {
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
  console.error("[product action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
