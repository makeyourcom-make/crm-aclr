/**
 * GET/POST /api/cron/google-sync — pull périodique Google Calendar → CRM.
 *
 * Le push CRM → Google est temps réel (hooks sur create/update/delete).
 * Ce cron couvre le sens inverse (events créés/modifiés directement dans
 * Google) + rattrape les push échoués. Fréquence : toutes les 15 min.
 *
 * Sécurisé par CRON_SECRET (Vercel Cron envoie `Authorization: Bearer …`).
 */
import { NextResponse } from "next/server";

import { syncGoogleForUser } from "@/app/(app)/settings/calendar/google-actions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new NextResponse("Forbidden (CRON_SECRET not configured)", {
      status: 403,
    });
  }
  const auth = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");
  if (auth !== `Bearer ${expected}` && xCronSecret !== expected) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { googleRefreshTokenEnc: { not: null } },
    select: { id: true, name: true },
  });

  const results: Record<string, unknown> = {};
  for (const u of users) {
    try {
      results[u.name] = await syncGoogleForUser(u.id);
    } catch (e) {
      results[u.name] = { ok: false, error: String(e) };
    }
  }

  return NextResponse.json({ ok: true, users: users.length, results });
}

export { handler as GET, handler as POST };
