"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { deleteFile, uploadFile } from "@/lib/file-storage";
import { requireAdmin } from "@/lib/session";

export interface HrActionResult {
  ok: boolean;
  employeeId?: string;
  error?: string;
}

const UpdateEmployeeSchema = z.object({
  id: z.string().min(1),
  // Identité
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  telephone: z.string().trim().optional(),
  adresse: z.string().trim().optional(),
  // RH
  dateNaissance: z.coerce.date().optional().nullable(),
  numeroAVS: z.string().trim().optional().nullable(),
  contactUrgenceNom: z.string().trim().optional().nullable(),
  contactUrgenceTel: z.string().trim().optional().nullable(),
  typeContrat: z
    .enum(["CDI", "CDD", "MANDAT", "STAGE", "ESSAI"])
    .optional()
    .nullable(),
  dateEntree: z.coerce.date().optional().nullable(),
  dateSortie: z.coerce.date().optional().nullable(),
  pourcentageActivite: z.coerce.number().int().min(0).max(100).optional(),
  salaireBase: z.coerce.number().min(0).optional().nullable(),
  notesRH: z.string().trim().optional().nullable(),
  // Rémunération commerciale
  garantieMensuelle: z.coerce.number().min(0).optional(),
  forfaitFrais: z.coerce.number().min(0).optional(),
  tauxCommissionSignature: z.coerce.number().min(0).max(1).optional(),
  tauxCommissionRenouvellement: z.coerce.number().min(0).max(1).optional(),
  // Banque
  iban: z.string().trim().optional().nullable(),
  // Statut
  isActive: z.coerce.boolean().optional(),
});

export async function updateEmployee(
  input: unknown,
): Promise<HrActionResult> {
  await requireAdmin();
  const parsed = UpdateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
  }

  const { id, ...data } = parsed.data;

  // Nettoie les "" → null
  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]),
  );

  try {
    await prisma.user.update({ where: { id }, data: clean });
    revalidatePath("/rh");
    revalidatePath(`/rh/${id}`);
    return { ok: true, employeeId: id };
  } catch (e) {
    console.error("[updateEmployee]", e);
    return { ok: false, error: "Erreur base de données." };
  }
}

// =============================================================================
// UPLOAD d'un document RH (contrat, certificat, fiche de paie, etc.)
// =============================================================================

const UploadDocumentSchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    "CONTRAT_TRAVAIL",
    "AVENANT",
    "FICHE_SALAIRE",
    "CERTIFICAT_TRAVAIL",
    "DIPLOME",
    "PIECE_IDENTITE",
    "AUTRE",
  ]),
  titre: z.string().trim().min(1).max(200),
  fileDataUrl: z.string().min(1),
  fileName: z.string().trim().max(200),
});

export async function uploadEmployeeDocument(input: unknown) {
  const admin = await requireAdmin();
  const parsed = UploadDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalide.",
    };
  }
  if (parsed.data.fileDataUrl.length > 8_000_000) {
    return { ok: false as const, error: "Fichier trop volumineux (max 6 MB)." };
  }

  const match = parsed.data.fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { ok: false as const, error: "Fichier illisible." };
  const [mime, base64] = [match[1], match[2]];
  const buffer = Buffer.from(base64, "base64");

  const upload = await uploadFile({
    prefix: `rh/${parsed.data.userId}`,
    filename: parsed.data.fileName,
    buffer,
    contentType: mime,
  });

  const doc = await prisma.employeeDocument.create({
    data: {
      userId: parsed.data.userId,
      type: parsed.data.type,
      titre: parsed.data.titre,
      fileUrl: upload.url,
      fileSize: upload.size,
      uploadedBy: admin.id,
    },
  });

  revalidatePath(`/rh/${parsed.data.userId}`);
  return { ok: true as const, documentId: doc.id, fileUrl: upload.url };
}

export async function deleteEmployeeDocument(documentId: string) {
  await requireAdmin();
  try {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
      select: { userId: true, fileUrl: true },
    });
    if (!doc) return { ok: false as const, error: "Doc introuvable." };
    await prisma.employeeDocument.delete({ where: { id: documentId } });
    await deleteFile(doc.fileUrl);
    revalidatePath(`/rh/${doc.userId}`);
    return { ok: true as const };
  } catch (e) {
    console.error("[deleteEmployeeDocument]", e);
    return { ok: false as const, error: "Erreur." };
  }
}
