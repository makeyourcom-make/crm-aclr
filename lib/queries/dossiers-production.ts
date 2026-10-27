/**
 * MYC Arena · Gestion des projets : chiffres du héros « production ».
 *
 * SERVEUR UNIQUEMENT (prisma). Lecture seule.
 *
 * Le planning affiché (getPlanningData) dépend de la vue et de la période
 * choisies ; le héros, lui, parle TOUJOURS du mois en cours et de la semaine
 * en cours. On charge donc ici, indépendamment de la vue :
 *  - les tâches du mois en cours ET de la semaine en cours (lundi-dimanche,
 *    qui peut déborder sur le mois voisin), hors abandonnées ;
 *  - l'historique « livré à l'heure » des 12 mois précédents (tâches faites,
 *    `faitLe` comparé à la date prévue, jour vu de Suisse) : barres des trois
 *    derniers mois + record.
 *
 * Les compteurs sont calculés côté client à partir de ces tâches, pour suivre
 * instantanément les coches optimistes du planning.
 */
import { prisma } from "@/lib/db";
import { addDays, addMonths, monthKey, todayZurich } from "@/lib/planning/dates";

export interface ProductionTacheDTO {
  id: string;
  ligneId: string;
  /** AAAA-MM-JJ (date prévue). */
  date: string;
  dureeMin: number;
  statut: "A_FAIRE" | "EN_COURS" | "ATTENTE_CLIENT" | "FAIT" | "ABANDONNEE";
  /** Jour de réalisation (AAAA-MM-JJ, Europe/Zurich), null si non faite. */
  faitLe: string | null;
}

export interface ProductionMois {
  /** AAAA-MM */
  mois: string;
  /** Tâches faites dont la date de réalisation est connue. */
  faites: number;
  /** Dont faites au plus tard le jour prévu. */
  aLHeure: number;
  /** Taux à l'heure 0-100 (null si aucune tâche faite). */
  taux: number | null;
}

export interface ProductionData {
  /** AAAA-MM-JJ (aujourd'hui, Suisse). */
  today: string;
  /** AAAA-MM */
  moisCourant: string;
  /** Lundi de la semaine en cours (AAAA-MM-JJ). */
  semaineDebut: string;
  taches: ProductionTacheDTO[];
  /** Les 3 mois précédant le mois en cours (ordre chronologique). */
  historique: ProductionMois[];
  /** Meilleur taux à l'heure des 12 mois précédents (≥ 5 tâches faites). */
  record: { mois: string; taux: number } | null;
}

const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" });

/** Instant réel → jour « AAAA-MM-JJ » vu de Suisse. */
function zurichDay(d: Date): string {
  return ZURICH_DAY.format(d);
}

export async function getProductionStats(ownerId: string): Promise<ProductionData> {
  const today = todayZurich();
  const moisDebut = addMonths(today, 0);
  const moisFin = addMonths(today, 1);
  const lundi = addDays(today, -((today.getUTCDay() || 7) - 1));
  const dimancheSuivant = addDays(lundi, 7);
  const from = lundi < moisDebut ? lundi : moisDebut;
  const to = dimancheSuivant > moisFin ? dimancheSuivant : moisFin;
  const histoDebut = addMonths(today, -12);

  const [taches, faites] = await Promise.all([
    prisma.planningTache.findMany({
      where: {
        ownerId,
        ligne: { actif: true },
        statut: { not: "ABANDONNEE" },
        date: { gte: from, lt: to },
      },
      select: { id: true, ligneId: true, date: true, dureeMin: true, statut: true, faitLe: true },
      orderBy: { date: "asc" },
    }),
    prisma.planningTache.findMany({
      where: {
        ownerId,
        statut: "FAIT",
        faitLe: { not: null },
        date: { gte: histoDebut, lt: moisDebut },
      },
      select: { date: true, faitLe: true },
    }),
  ]);

  // Historique « à l'heure » par mois prévu.
  const parMois = new Map<string, { faites: number; aLHeure: number }>();
  for (const t of faites) {
    if (!t.faitLe) continue;
    const m = monthKey(t.date);
    const acc = parMois.get(m) ?? { faites: 0, aLHeure: 0 };
    acc.faites++;
    if (zurichDay(t.faitLe) <= t.date.toISOString().slice(0, 10)) acc.aLHeure++;
    parMois.set(m, acc);
  }
  const moisStat = (m: string): ProductionMois => {
    const s = parMois.get(m) ?? { faites: 0, aLHeure: 0 };
    return {
      mois: m,
      faites: s.faites,
      aLHeure: s.aLHeure,
      taux: s.faites > 0 ? Math.round((s.aLHeure / s.faites) * 100) : null,
    };
  };
  const historique = [-3, -2, -1].map((n) => moisStat(monthKey(addMonths(today, n))));

  let record: ProductionData["record"] = null;
  for (const [m, s] of parMois) {
    if (s.faites < 5) continue;
    const taux = Math.round((s.aLHeure / s.faites) * 100);
    if (!record || taux > record.taux) record = { mois: m, taux };
  }

  return {
    today: today.toISOString().slice(0, 10),
    moisCourant: monthKey(today),
    semaineDebut: lundi.toISOString().slice(0, 10),
    taches: taches.map((t) => ({
      id: t.id,
      ligneId: t.ligneId,
      date: t.date.toISOString().slice(0, 10),
      dureeMin: t.dureeMin,
      statut: t.statut,
      faitLe: t.faitLe ? zurichDay(t.faitLe) : null,
    })),
    historique,
    record,
  };
}
