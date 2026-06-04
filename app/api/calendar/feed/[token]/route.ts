/**
 * Endpoint public d'abonnement iCalendar.
 *
 * URL : /api/calendar/feed/<token>.ics
 *
 * Le `token` est un secret aléatoire (User.calendarFeedToken) qui identifie
 * le propriétaire. Toute personne qui connaît l'URL peut lire l'agenda —
 * c'est le modèle "secret URL" utilisé par Google Calendar, iCloud, etc.
 *
 * Régénérer le token (depuis /settings/calendar) révoque l'abonnement
 * précédent.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildCalendarIcs } from "@/lib/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, ctx: RouteContext) {
  let { token } = await ctx.params;
  // L'extension .ics est tolérée dans l'URL pour aider Infomaniak / Apple
  // Calendar qui sniffent parfois l'extension avant le content-type.
  if (token.endsWith(".ics")) token = token.slice(0, -4);

  if (!token || token.length < 16) {
    return new NextResponse("Token invalide", { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { calendarFeedToken: token },
    select: { id: true, name: true },
  });

  if (!user) {
    return new NextResponse("Feed introuvable ou révoqué", { status: 404 });
  }

  // Fenêtre raisonnable : 90 jours dans le passé → 365 jours dans le futur.
  // Évite d'envoyer 10 ans d'historique inutile à chaque sync.
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 90);
  const future = new Date(now);
  future.setDate(future.getDate() + 365);

  const activities = await prisma.activity.findMany({
    where: {
      userId: user.id,
      date: { gte: past, lte: future },
      // Pas d'activité supprimée logiquement (delete réel via cascade
      // donc on n'a rien à filtrer en plus côté `archive`).
    },
    select: {
      id: true,
      type: true,
      sujet: true,
      contenu: true,
      adresseRdv: true,
      date: true,
      duree: true,
      duree2: true,
      statut: true,
      updatedAt: true,
      createdAt: true,
      prospect: { select: { id: true, raisonSociale: true } },
    },
    orderBy: { date: "asc" },
  });

  // App URL : utilise le host de la requête (gère prod/preview/local sans config)
  const url = new URL(req.url);
  const appUrl = `${url.protocol}//${url.host}`;

  const ics = buildCalendarIcs(activities, appUrl, user.name);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crm-agenda.ics"',
      // Cache court : Infomaniak refresh régulièrement, on tolère 5 min d'écart
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
