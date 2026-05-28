import { EmailTemplateType } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const EmailTemplateCreateSchema = z.object({
  nom: z.string().trim().min(2, "Nom obligatoire.").max(255),
  type: z.nativeEnum(EmailTemplateType),
  objet: z.string().trim().min(2, "Objet obligatoire.").max(500),
  contenu: z.string().trim().min(10, "Contenu trop court."),
  isActive: z.coerce.boolean().default(true),
});
export type EmailTemplateCreateInput = z.infer<typeof EmailTemplateCreateSchema>;

export const EmailTemplateUpdateSchema = EmailTemplateCreateSchema.partial();

export const EmailTemplateListParamsSchema = z.object({
  q: stringOptional,
  type: z.nativeEnum(EmailTemplateType).optional(),
});
