/**
 * Schemas Zod pour le module Deals (Pipeline).
 */
import { DealStage } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const DealCreateSchema = z.object({
  prospectId: z.string().min(1, "Prospect requis."),
  titre: z.string().trim().min(2, "Titre obligatoire (min 2 car).").max(255),
  description: stringOptional,
  montantPrevu: z.coerce.number().min(0).max(1_000_000),
  stage: z.nativeEnum(DealStage).default("DECOUVERTE"),
  probabilite: z.coerce.number().int().min(0).max(100).default(20),
  closeAttenduLe: z.coerce.date().optional(),
  /** IDs de produits à associer (m2m) */
  productIds: z.array(z.string()).optional(),
});
export type DealCreateInput = z.infer<typeof DealCreateSchema>;

export const DealUpdateSchema = DealCreateSchema.partial();
export type DealUpdateInput = z.infer<typeof DealUpdateSchema>;

export const DealMoveStageSchema = z.object({
  dealId: z.string().min(1),
  newStage: z.nativeEnum(DealStage),
});
export type DealMoveStageInput = z.infer<typeof DealMoveStageSchema>;

export const DealListParamsSchema = z.object({
  q: stringOptional,
  assigneAId: stringOptional,
  secteur: stringOptional,
});
export type DealListParams = z.infer<typeof DealListParamsSchema>;
