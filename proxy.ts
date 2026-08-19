/**
 * Proxy Next.js — protection des routes.
 *
 * Convention Next 16 : ce fichier s'appelle `proxy.ts` (anciennement
 * `middleware.ts` jusqu'à Next 15). Tourne en EDGE runtime → aucun accès
 * au moteur Prisma ou à bcrypt.
 *
 * S'appuie sur le callback `authorized` de auth.config.ts.
 *
 * matcher exclut :
 *   - /api/auth/*            (handler NextAuth lui-même)
 *   - /api/webhooks/*        (webhooks tiers — Resend, etc. - signature HMAC pour l'auth)
 *   - /api/cron/*            (tâches planifiées Vercel Cron — auth par CRON_SECRET,
 *                             pas de session ; sinon le middleware redirige 307 → /login
 *                             et le cron ne s'exécute JAMAIS)
 *   - /api/calendar/feed/*   (abonnement iCalendar — auth par token dans l'URL)
 *   - /_next/static          (assets statiques)
 *   - /_next/image           (images optimisées)
 *   - /favicon.ico
 *   - tous les fichiers à extension dans /public (svg, png, ico, etc.)
 */
import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|api/webhooks|api/cron|api/blob|api/calendar/feed|api/version|manifest.webmanifest|sign/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|js|css|woff|woff2|map)$).*)",
  ],
};
