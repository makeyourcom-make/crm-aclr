import { z } from "zod";

export const DossierCreateSchema = z.object({
  titre: z.string().trim().min(1, "Titre requis").max(200),
  description: z.string().trim().max(8000).optional(),
  assigneAId: z.string().min(1, "Assignation requise"),
  prospectId: z.string().min(1).optional().nullable(),
  priorite: z.enum(["BASSE", "NORMALE", "HAUTE"]).default("NORMALE"),
  echeance: z.coerce.date().optional().nullable(),
});
export type DossierCreateInput = z.infer<typeof DossierCreateSchema>;

export const DossierUpdateSchema = z.object({
  titre: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  assigneAId: z.string().min(1).optional(),
  prospectId: z.string().min(1).optional().nullable(),
  priorite: z.enum(["BASSE", "NORMALE", "HAUTE"]).optional(),
  echeance: z.coerce.date().optional().nullable(),
});

export const DossierMoveSchema = z.object({
  dossierId: z.string().min(1),
  newStatut: z.enum(["A_FAIRE", "EN_COURS", "EN_ATTENTE", "TERMINE"]),
});

export const DossierAddUpdateSchema = z.object({
  dossierId: z.string().min(1),
  contenu: z.string().trim().min(1, "Message vide").max(4000),
});
