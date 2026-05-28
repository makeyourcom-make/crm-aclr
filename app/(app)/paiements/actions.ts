"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { triggerRenewalCommissionIfApplicable } from "@/lib/commissions-engine";
import { PaymentCreateSchema } from "@/lib/schemas/payment";
import { MarkPaymentEncaisseSchema } from "@/lib/schemas/contract";
import { ForbiddenError, requireUser } from "@/lib/session";

export interface PaymentActionResult {
  ok: boolean;
  paymentId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ===========================================================================
// CREATE — enregistrer un paiement reçu d'un client
// ===========================================================================
//
// Workflow :
//   - Le paiement est créé directement en statut ENCAISSE par défaut
//     (la commerciale saisit ce qu'elle vient de recevoir)
//   - Si statut = ENCAISSE :
//       * Si c'est le 1er paiement encaissé du contrat → déclenche
//         le versement de commission SIGNATURE (statut PAYE)
//       * Si lié à une ClientInvoice → la marquer PAYEE + datePaiement
//
// Tout en une transaction.

export async function createPayment(
  input: unknown,
): Promise<PaymentActionResult> {
  const user = await requireUser();
  const parsed = PaymentCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  // RLS contrat
  const contract = await prisma.contract.findUnique({
    where: { id: parsed.data.contractId },
    select: { id: true, assigneAId: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Ce contrat ne t'appartient pas." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer le paiement
      const created = await tx.payment.create({
        data: {
          contractId: parsed.data.contractId,
          clientInvoiceId: parsed.data.clientInvoiceId ?? null,
          date: parsed.data.date,
          montant: parsed.data.montant,
          type: parsed.data.type,
          statut: parsed.data.statut,
          referenceFactureClient: parsed.data.referenceFactureClient,
        },
      });

      if (parsed.data.statut === "ENCAISSE") {
        // 2. Marquer la ClientInvoice PAYEE si liée
        if (parsed.data.clientInvoiceId) {
          await tx.clientInvoice.update({
            where: { id: parsed.data.clientInvoiceId },
            data: {
              statut: "PAYEE",
              datePaiement: parsed.data.date,
            },
          });
        }

        // 3. Si c'est le 1er paiement encaissé du contrat → SIGNATURE
        const otherEncaisses = await tx.payment.count({
          where: {
            contractId: contract.id,
            statut: "ENCAISSE",
            id: { not: created.id },
          },
        });
        if (otherEncaisses === 0) {
          const com = await tx.commission.findUnique({
            where: { contractId: contract.id },
          });
          if (com) {
            await tx.commissionPayment.updateMany({
              where: {
                commissionId: com.id,
                typePart: "SIGNATURE",
                statut: "PREVU",
              },
              data: { statut: "PAYE", dateVersement: new Date() },
            });
          }
        }

        // 4. Si c'est une mensualité encaissée et qu'on est en an 2+ →
        //    commission RENOUVELLEMENT (10 % du mensuel) acquise
        if (parsed.data.type === "MENSUALITE") {
          await triggerRenewalCommissionIfApplicable({
            contractId: contract.id,
            paymentDate: parsed.data.date,
            tx,
          });
        }
      }

      return created;
    });

    revalidatePath(`/contrats/${parsed.data.contractId}`);
    revalidatePath("/paiements");
    return { ok: true, paymentId: result.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// MARQUER ENCAISSÉ (pour un paiement existant qui était EN_ATTENTE)
// ===========================================================================

export async function markPaymentEncaisse(
  input: unknown,
): Promise<PaymentActionResult> {
  const user = await requireUser();
  const parsed = MarkPaymentEncaisseSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    include: {
      contract: { select: { id: true, assigneAId: true } },
      clientInvoice: { select: { id: true } },
    },
  });
  if (!payment) return { ok: false, error: "Paiement introuvable." };
  if (user.role !== "ADMIN" && payment.contract.assigneAId !== user.id) {
    return { ok: false, error: "Pas d'accès à ce paiement." };
  }
  if (payment.statut === "ENCAISSE") {
    return { ok: false, error: "Déjà encaissé." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const date = parsed.data.dateEncaissement ?? new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: { statut: "ENCAISSE", date },
      });

      // Marquer la facture client PAYEE si liée
      if (payment.clientInvoice) {
        await tx.clientInvoice.update({
          where: { id: payment.clientInvoice.id },
          data: { statut: "PAYEE", datePaiement: date },
        });
      }

      // Déclencher SIGNATURE si 1er paiement encaissé
      const otherEncaisses = await tx.payment.count({
        where: {
          contractId: payment.contract.id,
          statut: "ENCAISSE",
          id: { not: payment.id },
        },
      });
      if (otherEncaisses === 0) {
        const com = await tx.commission.findUnique({
          where: { contractId: payment.contract.id },
        });
        if (com) {
          await tx.commissionPayment.updateMany({
            where: {
              commissionId: com.id,
              typePart: "SIGNATURE",
              statut: "PREVU",
            },
            data: { statut: "PAYE", dateVersement: new Date() },
          });
        }
      }

      // Si mensualité encaissée + contrat en an 2+ → RENOUVELLEMENT acquis
      if (payment.type === "MENSUALITE") {
        await triggerRenewalCommissionIfApplicable({
          contractId: payment.contract.id,
          paymentDate: date,
          tx,
        });
      }
    });

    revalidatePath(`/contrats/${payment.contract.id}`);
    revalidatePath("/paiements");
    return { ok: true, paymentId: payment.id };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// MARQUER FACTURE CLIENT PAYÉE — raccourci depuis la liste des factures
// ===========================================================================
//
// Crée automatiquement un Payment ENCAISSE couvrant le montant total de la
// facture, et déclenche les cascades habituelles.

export async function markClientInvoicePaid(
  input: unknown,
): Promise<PaymentActionResult> {
  const parsed = z
    .object({
      clientInvoiceId: z.string().min(1),
      date: z.coerce.date().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  const user = await requireUser();
  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: parsed.data.clientInvoiceId },
    include: {
      contract: { select: { id: true, assigneAId: true } },
    },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (user.role !== "ADMIN" && invoice.contract.assigneAId !== user.id) {
    return { ok: false, error: "Cette facture ne t'appartient pas." };
  }
  if (invoice.statut === "PAYEE") {
    return { ok: false, error: "Déjà marquée comme payée." };
  }

  const date = parsed.data.date ?? new Date();

  // Devine le type Payment selon le type ClientInvoice
  const typeMap: Record<string, "ACOMPTE" | "SOLDE" | "MENSUALITE"> = {
    ACOMPTE: "ACOMPTE",
    SOLDE: "SOLDE",
    MENSUALITE: "MENSUALITE",
    PONCTUELLE: "SOLDE",
    ANNUELLE: "SOLDE",
  };

  return createPayment({
    contractId: invoice.contract.id,
    clientInvoiceId: invoice.id,
    date,
    montant: Number(invoice.total),
    type: typeMap[invoice.type] ?? "SOLDE",
    statut: "ENCAISSE",
    referenceFactureClient: invoice.numero,
  });
}

// ===========================================================================
// DELETE (admin only — pour corrections comptables)
// ===========================================================================

export async function deletePayment(
  paymentId: string,
): Promise<PaymentActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Seul un admin peut supprimer un paiement." };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { contractId: true },
  });
  if (!payment) return { ok: false, error: "Paiement introuvable." };

  try {
    await prisma.payment.delete({ where: { id: paymentId } });
    revalidatePath(`/contrats/${payment.contractId}`);
    revalidatePath("/paiements");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ---------------------------------------------------------------------------

import { z } from "zod";

function zodErrorToResult(err: z.ZodError): PaymentActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !fieldErrors[p]) fieldErrors[p] = issue.message;
  }
  return { ok: false, error: "Formulaire invalide.", fieldErrors };
}

function prismaErrorToResult(err: unknown): PaymentActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[payment action] Prisma error", {
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
  console.error("[payment action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
