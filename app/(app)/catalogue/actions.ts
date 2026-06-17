"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ProductCategorie } from "@prisma/client";

import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  ProductCreateSchema,
  ProductPriceUpdateSchema,
  ProductUpdateSchema,
} from "@/lib/schemas/product";
import { ForbiddenError, requireAdmin, requireUser } from "@/lib/session";

export interface ProductActionResult {
  ok: boolean;
  productId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Création rapide d'un produit "sur-mesure" depuis le wizard Deal/Contrat.
 * Accessible aux commerciaux (pas seulement admin) pour éviter de bloquer
 * Sophie quand un prospect demande une prestation hors-catalogue.
 *
 * Le produit est marqué dans sa description "[Custom]" pour qu'Arthur
 * puisse trier ensuite ce qui mérite d'entrer au vrai catalogue.
 */
const CustomProductSchema = z.object({
  nom: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional(),
  prixOneShot: z.coerce.number().min(0).max(1_000_000).optional(),
  prixMensuel: z.coerce.number().min(0).max(1_000_000).optional(),
  categorie: z
    .enum(["SITE", "RS", "SEO", "ADS", "CMO", "METRICOOL", "PACK"])
    .default("SITE"),
});

export async function createCustomProduct(
  input: unknown,
): Promise<ProductActionResult> {
  await requireUser();
  const parsed = CustomProductSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  // Au moins un prix doit être renseigné
  if (!parsed.data.prixOneShot && !parsed.data.prixMensuel) {
    return {
      ok: false,
      error: "Renseigne un prix one-shot OU un prix mensuel (au moins un).",
    };
  }

  // Le type est déduit du prix
  const type: "ONE_SHOT" | "RECURRENT_MENSUEL" =
    parsed.data.prixMensuel && !parsed.data.prixOneShot
      ? "RECURRENT_MENSUEL"
      : "ONE_SHOT";

  const baseDesc = parsed.data.description?.trim() ?? "";
  const description = baseDesc
    ? `[Custom] ${baseDesc}`
    : "[Custom] Produit sur-mesure créé depuis un deal.";

  try {
    const created = await prisma.product.create({
      data: {
        nom: parsed.data.nom,
        description,
        type,
        categorie: parsed.data.categorie,
        prixOneShot: parsed.data.prixOneShot
          ? parsed.data.prixOneShot.toString()
          : null,
        prixMensuel: parsed.data.prixMensuel
          ? parsed.data.prixMensuel.toString()
          : null,
        prixVariable: false,
        isActive: true,
      },
    });
    revalidatePath("/catalogue");
    return { ok: true, productId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
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
    // La description doit pouvoir être MODIFIÉE comme EFFACÉE : le schéma
    // transforme "" → undefined (donc ignoré par Prisma). On la lit en brut
    // pour la forcer (chaîne ou null) dès qu'elle est présente dans l'envoi.
    const raw = (input ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = { ...rest };
    if ("description" in raw) {
      const d = typeof raw.description === "string" ? raw.description.trim() : "";
      data.description = d === "" ? null : d;
    }
    if (composantsIds !== undefined) data.composantsIds = composantsIds;

    await prisma.product.update({ where: { id }, data });
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

// ===========================================================================
// CATÉGORIES — renommage du libellé + réaffectation des produits
// ===========================================================================

const SYSTEM_CODES = new Set(Object.values(ProductCategorie) as string[]);

const RenameCategorieSchema = z.object({
  code: z.string().min(1),
  label: z.string().trim().min(1, "Nom requis.").max(60),
});

/** Renomme le LIBELLÉ affiché d'une catégorie (le code reste inchangé). */
export async function renameCategorieLabel(
  input: unknown,
): Promise<ProductActionResult> {
  try {
    await requireAdmin();
    const parsed = RenameCategorieSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
    }
    await prisma.productCategorieMeta.update({
      where: { code: parsed.data.code },
      data: { label: parsed.data.label },
    });
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/categories");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/** Génère un code unique à partir d'un libellé (slug majuscule). */
async function genCategorieCode(label: string): Promise<string> {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "CAT";
  let code = base;
  let n = 1;
  // Assure l'unicité.
  while (await prisma.productCategorieMeta.findUnique({ where: { code } })) {
    code = `${base}_${n++}`;
  }
  return code;
}

const CreateCategorieSchema = z.object({
  label: z.string().trim().min(1, "Nom requis.").max(60),
});

/** Crée une nouvelle catégorie (non-système, supprimable). */
export async function createCategorie(
  input: unknown,
): Promise<ProductActionResult & { code?: string }> {
  try {
    await requireAdmin();
    const parsed = CreateCategorieSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
    }
    const code = await genCategorieCode(parsed.data.label);
    const max = await prisma.productCategorieMeta.aggregate({
      _max: { ordre: true },
    });
    await prisma.productCategorieMeta.create({
      data: {
        code,
        label: parsed.data.label,
        ordre: (max._max.ordre ?? 0) + 1,
        systeme: false,
      },
    });
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/categories");
    return { ok: true, code };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/** Supprime une catégorie ajoutée (jamais une catégorie système), si vide. */
export async function deleteCategorie(
  code: string,
): Promise<ProductActionResult> {
  try {
    await requireAdmin();
    const cat = await prisma.productCategorieMeta.findUnique({
      where: { code },
    });
    if (!cat) return { ok: false, error: "Catégorie introuvable." };
    if (cat.systeme) {
      return { ok: false, error: "Les catégories système ne sont pas supprimables." };
    }
    const used = await prisma.product.count({ where: { categorieCode: code } });
    if (used > 0) {
      return {
        ok: false,
        error: `${used} produit(s) utilisent encore cette catégorie. Réaffecte-les d'abord.`,
      };
    }
    await prisma.productCategorieMeta.delete({ where: { code } });
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/categories");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

const SetProductCategorieSchema = z.object({
  productId: z.string().min(1),
  code: z.string().min(1),
});

/** Réaffecte un produit à une autre catégorie (système ou ajoutée). */
export async function setProductCategorie(
  input: unknown,
): Promise<ProductActionResult> {
  try {
    await requireAdmin();
    const parsed = SetProductCategorieSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
    }
    // categorieCode = source de vérité. L'enum `categorie` (legacy, requis)
    // est aligné si le code est un code système, sinon laissé tel quel.
    const data: Record<string, unknown> = { categorieCode: parsed.data.code };
    if (SYSTEM_CODES.has(parsed.data.code)) {
      data.categorie = parsed.data.code;
    }
    await prisma.product.update({
      where: { id: parsed.data.productId },
      data,
    });
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/categories");
    return { ok: true, productId: parsed.data.productId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}
