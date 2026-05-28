/**
 * Schemas Zod pour le module Factures Sophie (mensuelles).
 */
import { InvoiceStatut } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const GenerateInvoiceSchema = z.object({
  userId: z.string().min(1),
  /** Année + mois du mois facturé (le jour est forcé au 1er) */
  annee: z.coerce.number().int().min(2020).max(2100),
  mois: z.coerce.number().int().min(1).max(12), // 1=janvier
});
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const InvoiceListParamsSchema = z.object({
  q: stringOptional,
  statut: z.nativeEnum(InvoiceStatut).optional(),
  userId: stringOptional,
  annee: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type InvoiceListParams = z.infer<typeof InvoiceListParamsSchema>;

export const MarkInvoicePayeeSchema = z.object({
  invoiceId: z.string().min(1),
  datePaiement: z.coerce.date().optional(),
});
