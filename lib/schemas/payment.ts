/**
 * Schemas Zod pour le module Paiements clients.
 */
import { PaymentStatut, PaymentType } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const PaymentCreateSchema = z.object({
  contractId: z.string().min(1, "Contrat requis."),
  /** Optionnel : la facture client couverte par ce paiement */
  clientInvoiceId: stringOptional,
  date: z.coerce.date(),
  montant: z.coerce.number().min(0.01).max(1_000_000),
  type: z.nativeEnum(PaymentType),
  statut: z.nativeEnum(PaymentStatut).default("ENCAISSE"),
  referenceFactureClient: stringOptional,
});
export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>;

export const PaymentListParamsSchema = z.object({
  q: stringOptional,
  statut: z.nativeEnum(PaymentStatut).optional(),
  contractId: stringOptional,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type PaymentListParams = z.infer<typeof PaymentListParamsSchema>;
