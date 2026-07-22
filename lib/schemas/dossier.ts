import { z } from "zod";

/** Document joint dès la création (déjà uploadé sur Blob côté navigateur). */
const DossierAttachmentInput = z.object({
  url: z.string().url(),
  nom: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  taille: z.number().int().nonnegative(),
});

export const DossierCreateSchema = z.object({
  titre: z.string().trim().min(1, "Titre requis").max(200),
  description: z.string().trim().max(8000).optional(),
  assigneAId: z.string().min(1, "Assignation requise"),
  prospectId: z.string().min(1).optional().nullable(),
  priorite: z.enum(["BASSE", "NORMALE", "HAUTE"]).default("NORMALE"),
  echeance: z.coerce.date().optional().nullable(),
  /** Documents joints au moment de la création (optionnel). */
  attachments: z.array(DossierAttachmentInput).optional(),
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
  // EN_ATTENTE reste dans l'enum Prisma mais n'est plus proposé (cf. lib/dossiers.ts).
  newStatut: z.enum(["A_FAIRE", "EN_COURS", "TERMINE"]),
  /**
   * Colonnes du kanban éclatées par personne → déposer une carte dans
   * « Sophie - en cours » change le statut ET l'assignation. Absent = on garde
   * l'assignation actuelle (colonne « Terminé », ou changement via le détail).
   */
  newAssigneAId: z.string().min(1).optional(),
});

export const DossierAddUpdateSchema = z.object({
  dossierId: z.string().min(1),
  contenu: z.string().trim().min(1, "Message vide").max(4000),
});
