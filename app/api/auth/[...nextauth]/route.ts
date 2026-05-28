/**
 * API handler NextAuth — expose les endpoints /api/auth/signin, /signout,
 * /callback, /session, /csrf à NextAuth.
 *
 * Aucune logique custom ici — tout est dans auth.ts.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

// NextAuth a besoin du runtime Node pour bcrypt (via authorize()).
export const runtime = "nodejs";
