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

export async function getAgendaWeek(
  user: SessionUser,
  weekStart: Date,
  hideDone: boolean,
): Promise<AgendaActivity[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const scope =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { userId: user.id },
            { prospect: { assigneAId: user.id } },
          ],
        };

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
