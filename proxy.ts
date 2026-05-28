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
 *   - /api/auth/*   (handler NextAuth lui-même)
 *   - /_next/static (assets statiques)
 *   - /_next/image  (images optimisées)
 *   - /favicon.ico
 *   - tous les fichiers à extension dans /public (svg, png, ico, etc.)
 */
import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
