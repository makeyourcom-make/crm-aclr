"use server";

/**
 * Server Action de connexion.
 *
 * Pattern Auth.js v5 :
 *   - On valide avec Zod côté serveur
 *   - On appelle signIn('credentials', { ..., redirectTo: '/' })
 *   - NextAuth lève une "redirect error" en cas de succès → on la relance
 *     pour que Next.js fasse sa redirection
 *   - Les AuthError sont capturés et convertis en message utilisateur FR
 */
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { LoginSchema } from "@/lib/schemas/auth";

export interface LoginActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}

export async function loginAction(
  _previousState: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState> {
  // 1. Validation Zod côté serveur (le client peut être bypassé)
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (path === "email") fieldErrors.email = issue.message;
      if (path === "password") fieldErrors.password = issue.message;
    }
    return { ok: false, error: "Formulaire invalide.", fieldErrors };
  }

  // 2. Tentative de connexion
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            ok: false,
            error: "Email ou mot de passe incorrect.",
          };
        default:
          return {
            ok: false,
            error: "Une erreur est survenue. Réessaie dans quelques secondes.",
          };
      }
    }
    // En cas de succès, NextAuth throw une redirect-error. On la relance
    // telle quelle pour que Next.js exécute la redirection vers `/`.
    throw error;
  }
}
