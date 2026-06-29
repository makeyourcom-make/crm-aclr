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

import { audit } from "@/lib/audit";
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

        // 3. Anti brute-force : compte verrouillé temporairement ?
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          await audit("login.locked", { userId: user.id });
          return null; // verrou actif → refus sans révéler la raison
        }

        // 4. Comparaison bcrypt (timing-safe par construction)
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          // Fenêtre glissante de 15 min : au 5e échec → verrou de 15 min.
          const WINDOW_MS = 15 * 60_000;
          const MAX = 5;
          const LOCK_MS = 15 * 60_000;
          const within =
            user.lastFailedAt != null &&
            now.getTime() - user.lastFailedAt.getTime() < WINDOW_MS;
          const count = (within ? user.failedLoginCount : 0) + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: count >= MAX ? 0 : count,
              lastFailedAt: now,
              lockedUntil: count >= MAX ? new Date(now.getTime() + LOCK_MS) : null,
            },
          });
          await audit("login.fail", {
            userId: user.id,
            metadata: { count, locked: count >= MAX },
          });
          return null;
        }

        // 5. Succès → remet les compteurs à zéro si nécessaire.
        if (user.failedLoginCount > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null, lastFailedAt: null },
          });
        }

        // 6. Retourne le User minimal — NextAuth gère le reste (JWT, cookies)
        await audit("login.success", { userId: user.id });
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
