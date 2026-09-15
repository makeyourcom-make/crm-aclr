/**
 * GET /api/google/callback — retour du consentement Google OAuth.
 *
 * Vérifie le `state` signé (→ userId), échange le `code` contre un refresh
 * token, le chiffre et le stocke sur l'utilisateur. Redirige ensuite vers la
 * page de synchro avec un statut.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  appBaseUrl,
  encryptToken,
  exchangeCode,
  verifyState,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

function back(status: string): NextResponse {
  const url = new URL("/settings/calendar", appBaseUrl());
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  if (error) return back(`error:${error}`);

  const code = searchParams.get("code");
  const userId = verifyState(searchParams.get("state"));
  if (!code || !userId) return back("error:state");

  try {
    const { refreshToken, email } = await exchangeCode(code);

    // Google ne renvoie un refresh_token qu'au 1er consentement (prompt=consent
    // force son renvoi). Si absent, on refuse plutôt que de stocker un état
    // incomplet impossible à rafraîchir plus tard.
    if (!refreshToken) return back("error:no_refresh_token");

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleRefreshTokenEnc: encryptToken(refreshToken),
        googleEmail: email,
        googleCalendarId: "primary",
        googleSyncToken: null, // repart d'un full sync au prochain pull
        googleLastSyncAt: null,
      },
    });

    return back("connected");
  } catch (e) {
    console.error("[google/callback]", e);
    return back("error:exchange");
  }
}
