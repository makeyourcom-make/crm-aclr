/**
 * Schemas Zod pour le module auth.
 */
import { z } from "zod";

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "L'email est requis.")
    .email("Format d'email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
  /** Code 2FA (TOTP 6 chiffres) ou code de secours — requis si la 2FA est activée. */
  totp: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
