/**
 * Configuration NextAuth complète (Node runtime).
 *
 * Côté Node : on peut utiliser bcrypt + Prisma. Le edge runtime est
 * géré séparément dans auth.config.ts (utilisé par middleware.ts).
 *
 * Provider unique : Credentials (email + mot de passe).
 * Pas d'OAuth, pas de magic link → la spec impose 2 utilisateurs seedés.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { LoginSchema } from "@/lib/schemas/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      // NB : ne PAS définir `credentials: { ... }` ici car cela activerait
      // la page /api/auth/signin par défaut de NextAuth. On veut notre
      // propre formulaire à /login.
      async authorize(credentials) {
        // 1. Validation Zod
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        // 2. Lookup utilisateur
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
        });
        if (!user || !user.isActive) {
          return null;
        }

        // 3. Comparaison bcrypt (timing-safe par construction)
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          return null;
        }

        // 4. Retourne le User minimal — NextAuth gère le reste (JWT, cookies)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
