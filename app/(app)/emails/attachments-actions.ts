"use server";

/**
 * Server actions pour les pièces jointes des emails.
 *
 * Upload : stocke le fichier sur Vercel Blob (gratuit jusqu'à 1GB),
 * retourne une URL publique signée. La référence est conservée en mémoire
 * côté client jusqu'à l'envoi du mail, où on persiste la ligne EmailAttachment.
 *
 * Le quota est limité côté UI à 20MB par fichier et 25MB total
 * (limite Resend pour les emails).
 */
import { put } from "@vercel/blob";

import { requireUser } from "@/lib/session";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB par fichier
const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/zip",
  "text/",
];

export interface UploadAttachmentResult {
  ok: boolean;
  /** URL publique du blob (à passer à sendEmailToProspect comme attachment.url) */
  url?: string;
  /** Nom original du fichier */
  filename?: string;
  /** Taille en bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  error?: string;
}

/**
 * Upload un fichier vers Vercel Blob et retourne son URL signée.
 *
 * Le fichier reste en mémoire transitoire jusqu'à l'envoi du mail —
 * la ligne EmailAttachment n'est créée que lorsqu'on envoie réellement.
 */
export async function uploadEmailAttachment(
  formData: FormData,
): Promise<UploadAttachmentResult> {
  const user = await requireUser();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier fourni." };
  }

  if (file.size === 0) {
    return { ok: false, error: "Fichier vide." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`,
    };
  }

  const mimeType = file.type || "application/octet-stream";
  const allowed = ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
  if (!allowed) {
    return {
      ok: false,
      error: `Type de fichier non autorisé (${mimeType}).`,
    };
  }

  try {
    // Nom du blob : userId/timestamp-filename pour éviter les collisions
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const blobPath = `email-attachments/${user.id}/${Date.now()}-${safeName}`;

    const blob = await put(blobPath, file, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true,
    });

    return {
      ok: true,
      url: blob.url,
      filename: file.name,
      size: file.size,
      mimeType,
    };
  } catch (err) {
    console.error("[upload-attachment] error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur d'upload.",
    };
  }
}
