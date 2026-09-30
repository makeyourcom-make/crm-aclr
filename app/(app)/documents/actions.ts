"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/file-storage";
import { getSessionUser } from "@/lib/session";

export interface DocumentActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const CreateSchema = z.object({
  titre: z.string().trim().min(2, "Titre trop court").max(160),
  description: z.string().trim().max(600).optional().nullable(),
  categorie: z.enum(["FORMATION", "VENTE", "SUIVI"]),
  fileUrl: z.string().trim().min(1, "Fichier manquant"),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().max(160).optional().nullable(),
  fileSize: z.coerce.number().int().min(0).optional().nullable(),
});

/**
 * Enregistre un document dans la bibliothèque d'équipe.
 * Le fichier a déjà été envoyé DIRECTEMENT à Vercel Blob côté navigateur
 * (via /api/blob/upload) ; on ne stocke ici que son URL + ses métadonnées.
 * Réservé à l'ADMIN.
 */
export async function createDocument(
  input: z.input<typeof CreateSchema>,
): Promise<DocumentActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (user.role !== "ADMIN")
    return { ok: false, error: "Réservé à l'administrateur." };

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const d = parsed.data;

  const created = await prisma.document.create({
    data: {
      titre: d.titre,
      description: d.description?.trim() || null,
      categorie: d.categorie,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      fileType: d.fileType?.trim() || null,
      fileSize: d.fileSize ?? null,
      createdById: user.id,
    },
    select: { id: true },
  });

  revalidatePath("/documents");
  return { ok: true, id: created.id };
}

/** Supprime un document (fichier blob + enregistrement). Réservé à l'ADMIN. */
export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (user.role !== "ADMIN")
    return { ok: false, error: "Réservé à l'administrateur." };

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, fileUrl: true },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  // Best-effort : on supprime le fichier du stockage puis l'enregistrement.
  await deleteFile(doc.fileUrl).catch(() => {});
  await prisma.document.delete({ where: { id } });

  revalidatePath("/documents");
  return { ok: true, id };
}
