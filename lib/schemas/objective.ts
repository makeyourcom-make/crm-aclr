import { ObjectivePeriode } from "@prisma/client";
import { z } from "zod";

const intOpt = z
  .preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(0).max(100_000),
  )
  .optional();

const decimalOpt = z
  .preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).max(10_000_000),
  )
  .optional();

export const ObjectiveCreateSchema = z.object({
  userId: z.string().min(1),
  periode: z.nativeEnum(ObjectivePeriode),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  nbAppelsObjectif: intOpt,
  nbEmailsObjectif: intOpt,
  nbRdvObjectif: intOpt,
  nbPropositionsObjectif: intOpt,
  nbSignaturesObjectif: intOpt,
  caObjectif: decimalOpt,
  commissionObjectif: decimalOpt,
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});
export type ObjectiveCreateInput = z.infer<typeof ObjectiveCreateSchema>;
