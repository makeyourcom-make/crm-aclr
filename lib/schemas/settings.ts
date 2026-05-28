import { z } from "zod";

const stringOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const SettingUpdateSchema = z.object({
  raisonSociale: z.string().trim().min(2),
  marque: z.string().trim().min(2),
  adresse: stringOpt,
  codePostal: stringOpt,
  ville: stringOpt,
  pays: z.string().trim().default("Suisse"),
  numeroIDE: stringOpt,
  numeroTVA: stringOpt,
  iban: stringOpt,
  bicSwift: stringOpt,
  nomBanque: stringOpt,
  emailContact: stringOpt,
  telephone: stringOpt,
  siteWeb: stringOpt,
  tvaActive: z.coerce.boolean().default(false),
  tauxTVA: z.coerce.number().min(0).max(1).default(0.081),
  garantieMensuelleDefault: z.coerce.number().min(0).max(100_000),
  forfaitFraisDefault: z.coerce.number().min(0).max(10_000),
  tauxCommissionSignatureDefault: z.coerce.number().min(0).max(1),
  tauxCommissionRenouvellementDefault: z.coerce.number().min(0).max(1),
});
export type SettingUpdateInput = z.infer<typeof SettingUpdateSchema>;

export const UserProfileUpdateSchema = z.object({
  name: z.string().trim().min(2),
  iban: stringOpt,
  telephone: stringOpt,
  adresse: stringOpt,
});
export type UserProfileUpdateInput = z.infer<typeof UserProfileUpdateSchema>;

export const UserRatesUpdateSchema = z.object({
  userId: z.string().min(1),
  tauxCommissionSignature: z.coerce.number().min(0).max(1),
  tauxCommissionRenouvellement: z.coerce.number().min(0).max(1),
  garantieMensuelle: z.coerce.number().min(0).max(100_000),
  forfaitFrais: z.coerce.number().min(0).max(10_000),
});
