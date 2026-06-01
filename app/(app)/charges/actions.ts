"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { deleteFile, uploadFile } from "@/lib/file-storage";
import { ocrReceipt } from "@/lib/ocr-receipt";
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

const MethodEnum = z.enum([
  "CARTE_BANCAIRE",
  "VIREMENT",
  "ESPECES",
  "TWINT",
  "PAYPAL",
  "PRELEVEMENT",
  "AUTRE",
]);

const StatutPaiementEnum = z.enum([
  "EN_ATTENTE",
  "PAYE",
  "LITIGE",
  "REMBOURSE",
]);

// =============================================================================
// OCR — analyser un ticket et renvoyer les champs pré-remplis
// =============================================================================

const OcrSchema = z.object({
  imageDataUrl: z.string().min(1),
});

export async function analyzeReceiptOcr(input: unknown) {
  await requireAdmin();
  const parsed = OcrSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Image manquante." };

  const match = parsed.data.imageDataUrl.match(
    /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/,
  );
  if (!match) {
    return {
      ok: false as const,
      error: "Format d'image non supporté (JPEG, PNG, WebP, GIF).",
    };
  }
  const mediaType = match[1] as
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif";
  const base64 = match[3];

  if (base64.length > 8_000_000) {
    return {
      ok: false as const,
      error: "Image trop volumineuse (max 6 MB).",
    };
  }

  return ocrReceipt(base64, mediaType);
}

// =============================================================================
// CREATE — enregistrer une charge (avec ou sans ticket joint)
// =============================================================================

const CreateExpenseSchema = z.object({
  date: z.coerce.date(),
  dateReglement: z.coerce.date().optional().nullable(),
  statutPaiement: StatutPaiementEnum.default("EN_ATTENTE"),
  categorie: CategorieEnum,
  fournisseur: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  reference: z.string().trim().max(100).optional().nullable(),
  montantHT: z.coerce.number().min(0),
  tauxTVA: z.coerce.number().min(0).max(1).default(0.077),
  montantTVA: z.coerce.number().min(0),
  montantTTC: z.coerce.number().min(0),
  tvaRecuperable: z.coerce.boolean().default(true),
  methodPaiement: MethodEnum.optional().nullable(),
  /** Client rattaché (Prospect.id). NULL = charge interne ou multi-clients. */
  prospectId: z.string().optional().nullable(),
  /** Photo du ticket en base64 (optionnel). */
  ticketDataUrl: z.string().optional().nullable(),
  ticketName: z.string().trim().optional().nullable(),
  /** True si ces données ont été pré-remplies par OCR. */
  ocrUtilise: z.coerce.boolean().default(false),
  ocrRawJson: z.string().optional().nullable(),
});

export async function createExpense(input: unknown) {
  const admin = await requireAdmin();
  const parsed = CreateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalide.",
    };
  }

  let ticketUrl: string | null = null;
  if (parsed.data.ticketDataUrl && parsed.data.ticketDataUrl.startsWith("data:")) {
    if (parsed.data.ticketDataUrl.length > 8_000_000) {
      return {
        ok: false as const,
        error: "Ticket trop volumineux (max 6 MB).",
      };
    }
    const match = parsed.data.ticketDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const [mime, b64] = [match[1], match[2]];
      const ext =
        mime === "image/jpeg"
          ? "jpg"
          : mime === "image/png"
            ? "png"
            : mime === "image/webp"
              ? "webp"
              : mime === "application/pdf"
                ? "pdf"
                : "bin";
      const buf = Buffer.from(b64, "base64");
      const upload = await uploadFile({
        prefix: "expenses",
        filename: `expense.${ext}`,
        buffer: buf,
        contentType: mime,
      });
      ticketUrl = upload.url;
    }
  }

  const created = await prisma.expense.create({
    data: {
      date: parsed.data.date,
      dateReglement: parsed.data.dateReglement ?? null,
      statutPaiement: parsed.data.statutPaiement,
      categorie: parsed.data.categorie,
      fournisseur: parsed.data.fournisseur ?? null,
      description: parsed.data.description ?? null,
      reference: parsed.data.reference ?? null,
      montantHT: parsed.data.montantHT,
      tauxTVA: parsed.data.tauxTVA,
      montantTVA: parsed.data.montantTVA,
      montantTTC: parsed.data.montantTTC,
      tvaRecuperable: parsed.data.tvaRecuperable,
      methodPaiement: parsed.data.methodPaiement ?? null,
      prospectId: parsed.data.prospectId ?? null,
      ticketUrl,
      ticketName: parsed.data.ticketName ?? null,
      ocrUtilise: parsed.data.ocrUtilise,
      ocrRawJson: parsed.data.ocrRawJson ?? null,
      createdById: admin.id,
    },
  });

  revalidatePath("/charges");
  return { ok: true as const, expenseId: created.id };
}

// =============================================================================
// MARK PAID — réconciliation bancaire rapide
// =============================================================================

const MarkPaidSchema = z.object({
  id: z.string().min(1),
  dateReglement: z.coerce.date(),
});

export async function markExpensePaid(input: unknown) {
  await requireAdmin();
  const parsed = MarkPaidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Données invalides." };
  }
  await prisma.expense.update({
    where: { id: parsed.data.id },
    data: {
      statutPaiement: "PAYE",
      dateReglement: parsed.data.dateReglement,
    },
  });
  revalidatePath("/charges");
  return { ok: true as const };
}

// =============================================================================
// LINK PROSPECT — rattachement client d'une charge existante
// =============================================================================

const LinkProspectSchema = z.object({
  id: z.string().min(1),
  prospectId: z.string().nullable(),
});

export async function linkExpenseToProspect(input: unknown) {
  await requireAdmin();
  const parsed = LinkProspectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Données invalides." };
  }
  await prisma.expense.update({
    where: { id: parsed.data.id },
    data: { prospectId: parsed.data.prospectId },
  });
  revalidatePath("/charges");
  revalidatePath("/rentabilite");
  return { ok: true as const };
}

// =============================================================================
// SET ALLOCATIONS — ventilation multi-clients (Google Ads, Lucas, etc.)
// =============================================================================

const AllocationSchema = z.object({
  prospectId: z.string().min(1),
  montantHT: z.coerce.number(),
  note: z.string().max(200).optional().nullable(),
});

const SetAllocationsSchema = z.object({
  expenseId: z.string().min(1),
  allocations: z.array(AllocationSchema),
});

export async function setExpenseAllocations(input: unknown) {
  await requireAdmin();
  const parsed = SetAllocationsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Données invalides." };
  }
  await prisma.$transaction([
    prisma.expenseAllocation.deleteMany({
      where: { expenseId: parsed.data.expenseId },
    }),
    ...(parsed.data.allocations.length > 0
      ? [
          prisma.expenseAllocation.createMany({
            data: parsed.data.allocations.map((a) => ({
              expenseId: parsed.data.expenseId,
              prospectId: a.prospectId,
              montantHT: a.montantHT,
              note: a.note ?? null,
            })),
          }),
        ]
      : []),
  ]);
  revalidatePath("/charges");
  revalidatePath(`/charges/${parsed.data.expenseId}`);
  revalidatePath("/rentabilite");
  return { ok: true as const };
}

// =============================================================================
// UPDATE — édition d'une charge existante
// =============================================================================

const UpdateExpenseSchema = z.object({
  id: z.string().min(1),
  date: z.coerce.date(),
  dateReglement: z.coerce.date().optional().nullable(),
  statutPaiement: StatutPaiementEnum,
  categorie: CategorieEnum,
  fournisseur: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  reference: z.string().trim().max(100).optional().nullable(),
  montantHT: z.coerce.number().min(0),
  tauxTVA: z.coerce.number().min(0).max(1),
  montantTVA: z.coerce.number().min(0),
  montantTTC: z.coerce.number().min(0),
  tvaRecuperable: z.coerce.boolean().default(true),
  methodPaiement: MethodEnum.optional().nullable(),
  prospectId: z.string().optional().nullable(),
});

export async function updateExpense(input: unknown) {
  await requireAdmin();
  const parsed = UpdateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalide.",
    };
  }
  const { id, ...data } = parsed.data;
  await prisma.expense.update({
    where: { id },
    data: {
      date: data.date,
      dateReglement: data.dateReglement ?? null,
      statutPaiement: data.statutPaiement,
      categorie: data.categorie,
      fournisseur: data.fournisseur ?? null,
      description: data.description ?? null,
      reference: data.reference ?? null,
      montantHT: data.montantHT,
      tauxTVA: data.tauxTVA,
      montantTVA: data.montantTVA,
      montantTTC: data.montantTTC,
      tvaRecuperable: data.tvaRecuperable,
      methodPaiement: data.methodPaiement ?? null,
      prospectId: data.prospectId ?? null,
    },
  });
  revalidatePath("/charges");
  revalidatePath(`/charges/${id}`);
  revalidatePath("/rentabilite");
  return { ok: true as const };
}

// =============================================================================
// ATTACHMENT — ajouter une pièce jointe complémentaire
// =============================================================================

const AddAttachmentSchema = z.object({
  expenseId: z.string().min(1),
  fileDataUrl: z.string().min(1),
  fileName: z.string().trim().min(1).max(200),
  kind: z.string().trim().max(40).optional().nullable(),
});

export async function addExpenseAttachment(input: unknown) {
  const admin = await requireAdmin();
  const parsed = AddAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Données invalides." };
  }
  const match = parsed.data.fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { ok: false as const, error: "Format de fichier non supporté." };
  }
  if (parsed.data.fileDataUrl.length > 8_000_000) {
    return { ok: false as const, error: "Fichier trop volumineux (max 6 MB)." };
  }

  const [mime, b64] = [match[1], match[2]];
  const buf = Buffer.from(b64, "base64");

  const upload = await uploadFile({
    prefix: `expenses/${parsed.data.expenseId}`,
    filename: parsed.data.fileName,
    buffer: buf,
    contentType: mime,
  });

  await prisma.expenseAttachment.create({
    data: {
      expenseId: parsed.data.expenseId,
      fileUrl: upload.url,
      fileName: parsed.data.fileName,
      fileSize: upload.size,
      kind: parsed.data.kind ?? null,
      uploadedBy: admin.id,
    },
  });
  revalidatePath(`/charges/${parsed.data.expenseId}`);
  return { ok: true as const };
}

export async function deleteExpenseAttachment(id: string) {
  await requireAdmin();
  const att = await prisma.expenseAttachment.findUnique({ where: { id } });
  if (!att) return { ok: false as const, error: "Pièce jointe introuvable." };
  await prisma.expenseAttachment.delete({ where: { id } });
  await deleteFile(att.fileUrl);
  revalidatePath(`/charges/${att.expenseId}`);
  return { ok: true as const };
}

export async function deleteExpense(id: string) {
  await requireAdmin();
  try {
    const exp = await prisma.expense.findUnique({
      where: { id },
      select: {
        ticketUrl: true,
        attachments: { select: { fileUrl: true } },
      },
    });
    await prisma.expense.delete({ where: { id } });
    if (exp?.ticketUrl) await deleteFile(exp.ticketUrl);
    for (const a of exp?.attachments ?? []) await deleteFile(a.fileUrl);
    revalidatePath("/charges");
    return { ok: true as const };
  } catch (e) {
    console.error("[deleteExpense]", e);
    return { ok: false as const, error: "Erreur." };
  }
}
