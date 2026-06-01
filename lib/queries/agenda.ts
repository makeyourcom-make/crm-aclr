/**
 * Requêtes pour l'Agenda (vue semaine).
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

export type AgendaActivity = Prisma.ActivityGetPayload<{
  include: {
    prospect: {
      select: { id: true; raisonSociale: true; telephone: true };
    };
    user: { select: { id: true; name: true } };
  };
}>;

/** Vue affichée dans l'agenda. */
export type AgendaView =
  /** Activités du user courant (commercial = scope normal, admin = ses propres). */
  | "mine"
  /** Activités de tous les users (admin uniquement). */
  | "all"
  /** Activités d'un user spécifique (admin qui regarde l'agenda d'une commerciale). */
  | string; // userId

export async function getAgendaWeek(
  user: SessionUser,
  weekStart: Date,
  hideDone: boolean,
  view: AgendaView = "mine",
): Promise<AgendaActivity[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Construit le scope selon le rôle et la vue choisie
  let scope: Prisma.ActivityWhereInput = {};
  if (user.role !== "ADMIN") {
    // Commercial : verrouillé à ses propres activités, quelle que soit la vue
    scope = {
      OR: [
        { userId: user.id },
        { prospect: { assigneAId: user.id } },
      ],
    };
  } else if (view === "all") {
    // Admin → "Toute l'équipe"
    scope = {};
  } else if (view === "mine") {
    // Admin → ses propres activités (= défaut)
    scope = {
      OR: [
        { userId: user.id },
        { prospect: { assigneAId: user.id } },
      ],
    };
  } else {
    // Admin → agenda d'un user spécifique (par exemple Sophie)
    scope = {
      OR: [
        { userId: view },
        { prospect: { assigneAId: view } },
      ],
    };
  }

  return prisma.activity.findMany({
    where: {
      ...scope,
      date: { gte: weekStart, lt: weekEnd },
      ...(hideDone ? { statut: { not: "FAIT" } } : {}),
    },
    include: {
      prospect: {
        select: { id: true, raisonSociale: true, telephone: true },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });
}

export function getStartOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - (day - 1));
  return x;
}
