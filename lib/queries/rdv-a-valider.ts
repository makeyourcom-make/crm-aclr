/**
 * RDV à valider : rendez-vous client de l'utilisateur dont l'heure est passée
 * mais qui n'ont pas encore été marqués effectués / manqués / annulés.
 *
 * Rappel de fin de journée (demande Arthur 27.10.2026) : les RDV du jour
 * apparaissent sur le dashboard à partir de 17h ; ceux des jours précédents
 * restent affichés tant qu'ils ne sont pas validés (14 derniers jours).
 */
import { prisma } from "@/lib/db";

export const HEURE_RAPPEL_RDV = 17;
const JOURS_RETRO = 14;

export interface RdvAValider {
  id: string;
  date: string;
  sujet: string;
  type: string;
  prospectId: string | null;
  raisonSociale: string | null;
}

function zurichParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export async function getRdvAValider(userId: string): Promise<{
  rdvs: RdvAValider[];
  finDeJournee: boolean;
}> {
  const now = new Date();
  const { day: today, hour } = zurichParts(now);
  const finDeJournee = hour >= HEURE_RAPPEL_RDV;

  const rows = await prisma.activity.findMany({
    where: {
      userId,
      type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
      prospectId: { not: null },
      statut: { in: ["PLANIFIE", "EN_COURS", "REPLANIFIE"] },
      date: { gte: new Date(now.getTime() - JOURS_RETRO * 86_400_000), lte: now },
    },
    select: {
      id: true,
      date: true,
      sujet: true,
      type: true,
      prospectId: true,
      prospect: { select: { raisonSociale: true } },
    },
    orderBy: { date: "asc" },
  });

  const rdvs = rows
    // Avant 17h, seuls les RDV des jours précédents (oubliés) sont rappelés.
    .filter((r) => finDeJournee || zurichParts(r.date).day < today)
    .map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      sujet: r.sujet,
      type: r.type,
      prospectId: r.prospectId,
      raisonSociale: r.prospect?.raisonSociale ?? null,
    }));
  return { rdvs, finDeJournee };
}
