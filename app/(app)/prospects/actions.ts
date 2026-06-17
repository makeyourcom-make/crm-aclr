"use server";

/**
 * Server Actions pour le module Prospects.
 *
 * Convention de retour pour les formulaires :
 *   { ok: true,  prospectId?: string }
 *   { ok: false, error: string, fieldErrors?: { fieldName: string } }
 *
 * Toutes les actions revalidatent les chemins concernés.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  ProspectCreateSchema,
  ProspectImportRowSchema,
  ProspectUpdateSchema,
  guessSecteur,
  type ProspectImportRow,
} from "@/lib/schemas/prospect";
import {
  ForbiddenError,
  requireAdmin,
  requireUser,
  type SessionUser,
} from "@/lib/session";

// ===========================================================================
// TYPES RETOURNÉS
// ===========================================================================

export interface ProspectActionResult {
  ok: boolean;
  prospectId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface ProspectImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ ligne: number; raisonSociale?: string; message: string }>;
}

// ===========================================================================
// CREATE
// ===========================================================================

export async function createProspect(
  _prev: ProspectActionResult | undefined,
  formData: FormData,
): Promise<ProspectActionResult> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData.entries());
  const parsed = ProspectCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  try {
    // Règle : un·e commercial·e (non-admin) qui crée une entreprise se la voit
    // TOUJOURS assignée. Seul l'admin peut l'attribuer à quelqu'un d'autre.
    const assigneAId =
      user.role === "ADMIN" ? (parsed.data.assigneAId ?? user.id) : user.id;
    const created = await prisma.prospect.create({
      data: { ...parsed.data, assigneAId },
    });
    revalidatePath("/prospects");
    return { ok: true, prospectId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Variante non-formulaire pour appels programmatiques (ex. depuis l'import CSV).
 */
export async function createProspectRaw(
  input: unknown,
  fallbackAssigneAId?: string,
): Promise<ProspectActionResult> {
  const parsed = ProspectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }
  try {
    const created = await prisma.prospect.create({
      data: {
        ...parsed.data,
        assigneAId: parsed.data.assigneAId ?? fallbackAssigneAId,
      },
    });
    return { ok: true, prospectId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Création rapide depuis un autre écran (ex. fenêtre d'activité de l'agenda).
 * Sécurisée (requireUser) + assignée au user courant par défaut. Prend un
 * objet simple (pas un FormData) et renvoie l'id pour sélection immédiate.
 */
export async function createProspectQuick(
  input: unknown,
): Promise<ProspectActionResult> {
  const user = await requireUser();
  const parsed = ProspectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }
  try {
    // Non-admin → toujours auto-assigné ; admin → choix possible.
    const assigneAId =
      user.role === "ADMIN" ? (parsed.data.assigneAId ?? user.id) : user.id;
    const created = await prisma.prospect.create({
      data: { ...parsed.data, assigneAId },
    });
    revalidatePath("/prospects");
    return { ok: true, prospectId: created.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// UPDATE
// ===========================================================================

export async function updateProspect(
  id: string,
  _prev: ProspectActionResult | undefined,
  formData: FormData,
): Promise<ProspectActionResult> {
  const user = await requireUser();
  await assertCanEditProspect(user, id);

  const raw = Object.fromEntries(formData.entries());
  const parsed = ProspectUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  // Un champ vidé dans le formulaire devient `undefined` après Zod, et Prisma
  // IGNORE les `undefined` (la valeur précédente "revient"). Pour vraiment
  // effacer un champ, on force `null` sur les champs nullable soumis vides.
  const CLEARABLE = [
    "contactNom", "contactPrenom", "contactFonction", "email", "telephone",
    "telephoneMobile", "adresse", "codePostal", "ville", "canton",
    "numeroIDE", "numeroTVA", "siteWeb", "linkedIn", "facebook", "instagram",
    "noga", "notesGenerales", "effectif",
  ] as const;
  const data: Record<string, unknown> = { ...parsed.data };
  for (const f of CLEARABLE) {
    if (f in raw && String(raw[f]).trim() === "") data[f] = null;
  }

  try {
    await prisma.prospect.update({
      where: { id },
      data,
    });
    revalidatePath("/prospects");
    revalidatePath(`/prospects/${id}`);
    return { ok: true, prospectId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Change uniquement le statut. Pratique pour les boutons d'action rapide.
 */
export async function updateProspectStatut(
  id: string,
  statut: string,
): Promise<ProspectActionResult> {
  const user = await requireUser();
  await assertCanEditProspect(user, id);

  const parsed = ProspectUpdateSchema.pick({ statut: true }).safeParse({
    statut,
  });
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }
  try {
    await prisma.prospect.update({
      where: { id },
      data: { statut: parsed.data.statut },
    });
    revalidatePath("/prospects");
    revalidatePath(`/prospects/${id}`);
    return { ok: true, prospectId: id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// DELETE (admin only)
// ===========================================================================

export async function deleteProspect(id: string): Promise<ProspectActionResult> {
  await requireAdmin();

  try {
    await prisma.prospect.delete({ where: { id } });
    revalidatePath("/prospects");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
  redirect("/prospects");
}

// ===========================================================================
// BULK — réassignation en masse (admin uniquement)
// ===========================================================================

export async function bulkReassignProspects(input: {
  prospectIds: string[];
  newAssigneeId: string | null;
}): Promise<{ ok: boolean; count?: number; error?: string }> {
  await requireAdmin();
  if (!Array.isArray(input.prospectIds) || input.prospectIds.length === 0) {
    return { ok: false, error: "Aucune entreprise sélectionnée." };
  }
  // Validation du nouvel assigné si non-null
  if (input.newAssigneeId) {
    const exists = await prisma.user.findUnique({
      where: { id: input.newAssigneeId },
      select: { id: true, isActive: true },
    });
    if (!exists || !exists.isActive) {
      return { ok: false, error: "Commerciale introuvable ou inactive." };
    }
  }
  try {
    const res = await prisma.prospect.updateMany({
      where: { id: { in: input.prospectIds } },
      data: { assigneAId: input.newAssigneeId },
    });
    revalidatePath("/prospects");
    return { ok: true, count: res.count };
  } catch (err) {
    console.error("[bulkReassignProspects]", err);
    return { ok: false, error: "Erreur lors de la réassignation." };
  }
}

// ===========================================================================
// IMPORT CSV — batch transactionnel
// ===========================================================================

/**
 * Importe une liste de lignes pré-mappées. Chaque ligne est validée
 * indépendamment ; les lignes invalides sont reportées sans bloquer
 * les autres.
 *
 * Si > 50 % des lignes échouent, on rollback tout (probablement un mauvais
 * mapping de colonnes).
 */
export async function importProspects(
  rows: unknown[],
): Promise<ProspectImportResult> {
  // RBAC : import réservé à l'admin. requireAdmin() jette si le user
  // n'est pas ADMIN, ce qui bloque l'action même si appelée à la main.
  const user = await requireAdmin();
  const errors: ProspectImportResult["errors"] = [];
  const valides: ProspectImportRow[] = [];

  rows.forEach((row, index) => {
    const parsed = ProspectImportRowSchema.safeParse(row);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      errors.push({
        ligne: index + 1,
        raisonSociale: (row as Record<string, string>)?.raisonSociale,
        message,
      });
      return;
    }
    valides.push(parsed.data);
  });

  // Garde-fou : >50 % d'erreurs → on n'importe rien (mauvais mapping probable)
  if (errors.length > rows.length / 2) {
    return {
      ok: false,
      imported: 0,
      skipped: rows.length,
      errors,
    };
  }

  // Insertion en batch dans une transaction
  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of valides) {
      const secteurEnum = guessSecteur(row.secteur) ?? undefined;
      await tx.prospect.create({
        data: {
          raisonSociale: row.raisonSociale,
          contactNom: row.contactNom,
          contactPrenom: row.contactPrenom,
          contactFonction: row.contactFonction,
          email: row.email,
          telephone: row.telephone,
          telephoneMobile: row.telephoneMobile,
          adresse: row.adresse,
          codePostal: row.codePostal,
          ville: row.ville,
          canton: row.canton,
          pays: row.pays ?? "Suisse",
          siteWeb: row.siteWeb,
          linkedIn: row.linkedIn,
          secteur: secteurEnum,
          effectif: row.effectif,
          noga: row.noga,
          notesGenerales: row.notesGenerales,
          source: "FICHIER_IMPORT",
          assigneAId: user.id, // auto-assigné à l'importeur
        },
      });
      imported++;
    }
  });

  revalidatePath("/prospects");

  return {
    ok: true,
    imported,
    skipped: errors.length,
    errors,
  };
}

// ===========================================================================
// HELPERS INTERNES
// ===========================================================================

async function assertCanEditProspect(user: SessionUser, id: string) {
  if (user.role === "ADMIN") return;
  const p = await prisma.prospect.findUnique({
    where: { id },
    select: { assigneAId: true },
  });
  if (!p) throw new Error("Prospect introuvable.");
  if (p.assigneAId !== user.id) {
    throw new ForbiddenError(
      "Tu n'as pas accès à ce prospect (assigné à quelqu'un d'autre).",
    );
  }
}

function zodErrorToResult(err: import("zod").ZodError): ProspectActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return {
    ok: false,
    error: "Formulaire invalide — voir les champs en rouge.",
    fieldErrors,
  };
}

function prismaErrorToResult(err: unknown): ProspectActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Log complet en console serveur pour debug
    console.error("[prospect action] PrismaClientKnownRequestError", {
      code: err.code,
      message: err.message,
      meta: err.meta,
    });
    if (err.code === "P2002") {
      return {
        ok: false,
        error: "Un prospect avec ces informations existe déjà.",
      };
    }
    if (err.code === "P2022") {
      const column = (err.meta as { column?: string } | undefined)?.column;
      return {
        ok: false,
        error: `Colonne BDD manquante : ${column ?? "?"} (P2022). Le client Prisma n'est pas synchronisé avec le schéma. Restart du dev server requis.`,
      };
    }
    return {
      ok: false,
      error: `Erreur base de données (${err.code}). ${err.message.slice(0, 200)}`,
    };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: err.message };
  }
  console.error("[prospect action] erreur inattendue :", err);
  return {
    ok: false,
    error: "Erreur serveur inattendue. Réessaie dans quelques secondes.",
  };
}
