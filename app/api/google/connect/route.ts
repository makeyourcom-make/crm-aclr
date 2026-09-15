/**
 * GET /api/google/connect — démarre le flux OAuth Google Calendar.
 *
 * Redirige l'utilisateur connecté vers l'écran de consentement Google, avec
 * un `state` signé (HMAC AUTH_SECRET) qui encode son userId — le callback
 * pourra ainsi rattacher le refresh token au bon utilisateur.
 */
import { NextResponse } from "next/server";

import {
  buildAuthUrl,
  googleOAuthConfigured,
  signState,
} from "@/lib/google-calendar";
import { getRealSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRealSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.AUTH_URL ?? "https://crm.makeyourcom.ch"),
    );
  }
  if (!googleOAuthConfigured()) {
    return new NextResponse(
      "Google OAuth non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants).",
      { status: 503 },
    );
  }
  const url = buildAuthUrl(signState(user.id));
  return NextResponse.redirect(url);
}
