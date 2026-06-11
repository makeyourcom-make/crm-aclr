/**
 * Schemas Zod pour le module Contrats.
 */
import { ContractStatut, ModalitePaiement } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Ligne du wizard : produit + quantité (et prix override optionnel). */
export const ContractLineSchema = z.object({
  productId: z.string().min(1),
  quantite: z.coerce.number().min(0.01).max(1000).default(1),
  /** Prix one-shot effectif pour cette ligne (override du catalogue) */
  prixOneShot: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().min(0).max(1_000_000),
    )
    .optional(),
  /** Prix mensuel effectif pour cette ligne */
  prixMensuel: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().min(0).max(1_000_000),
    )
    .optional(),
  /** Description / détails libre — apparaît sur le contrat et la facture */
  note: z.string().max(2000).optional(),
});
export type ContractLineInput = z.infer<typeof ContractLineSchema>;

export const ContractCreateSchema = z.object({
  prospectId: z.string().min(1, "Prospect requis."),
  dealId: stringOptional,
  dateSignature: z.coerce.date(),
  dateDebut: z.coerce.date(),
  dureeMois: z.coerce.number().int().min(1).max(60).default(12),
  modalitePaiement: z.nativeEnum(ModalitePaiement),
  lines: z.array(ContractLineSchema).min(1, "Au moins une ligne requise."),
});
export type ContractCreateInput = z.infer<typeof ContractCreateSchema>;

export const ContractSortFieldSchema = z.enum([
  "numero",
  "raisonSociale",
  "valeurAn1",
  "montantMensuel",
  "dateSignature",
  "statut",
]);
export type ContractSortField = z.infer<typeof ContractSortFieldSchema>;

export const ContractListParamsSchema = z.object({
  q: stringOptional,
  statut: z.nativeEnum(ContractStatut).optional(),
  assigneAId: stringOptional,
  sortBy: ContractSortFieldSchema.default("dateSignature"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(2000).default(50),
});
export type ContractListParams = z.infer<typeof ContractListParamsSchema>;

export const ResilierContractSchema = z.object({
  contractId: z.string().min(1),
  dateResiliation: z.coerce.date(),
  raison: z.string().trim().min(3, "Préciser la raison (min 3 car)."),
});
export type ResilierContractInput = z.infer<typeof ResilierContractSchema>;

export const MarkPaymentEncaisseSchema = z.object({
  paymentId: z.string().min(1),
  dateEncaissement: z.coerce.date().optional(),
});
export type MarkPaymentEncaisseInput = z.infer<typeof MarkPaymentEncaisseSchema>;
