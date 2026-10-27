/**
 * Calculs du héros « production » (purs, côté client).
 *
 * Entrée : un « pool » de tâches (mois en cours + semaine en cours + tous les
 * retards) où les coches optimistes sont déjà appliquées. Les chiffres
 * bougent donc dès le clic, avant même la réponse du serveur.
 */
import { addDaysStr, addMonthsStr, etatProd, monthOf } from "@/components/planning/shared";
import type { PlanningLigneDTO } from "@/lib/planning/queries";

export interface PoolTache {
  id: string;
  ligneId: string;
  date: string;
  dureeMin: number;
  statut: "A_FAIRE" | "EN_COURS" | "ATTENTE_CLIENT" | "FAIT" | "ABANDONNEE";
  /** Jour de réalisation connu (AAAA-MM-JJ) ; undefined = inconnu. */
  faitLe?: string | null;
  titre?: string;
  code?: string | null;
}

export interface JourCharge {
  date: string;
  totalMin: number;
  faitMin: number;
  count: number;
}

export interface ProductionStats {
  mois: string;
  total: number;
  faites: number;
  pct: number;
  resteMin: number;
  resteCount: number;
  retards: number;
  critiques: number;
  /** Plus vieille tâche « boss » (retard > 1 mois). */
  boss: PoolTache | null;
  semaine: { jours: JourCharge[]; totalMin: number; faitMin: number; resteCount: number };
  jour: { totalMin: number; faitMin: number; count: number; resteCount: number; done: boolean };
  aLHeure: { faites: number; aLHeure: number; taux: number | null };
  clients: { total: number; boucles: number };
  attente: number;
  quickWins: number;
}

export const QUICK_WIN_MIN = 15;

export function isQuickWin(t: { statut: string; dureeMin: number }): boolean {
  return t.statut !== "FAIT" && t.statut !== "ATTENTE_CLIENT" && t.statut !== "ABANDONNEE" && t.dureeMin <= QUICK_WIN_MIN;
}

export function computeProduction(
  pool: PoolTache[],
  opts: {
    today: string;
    mois: string;
    semaineDebut: string;
    ligneById: Map<string, PlanningLigneDTO>;
  },
): ProductionStats {
  const { today, mois, semaineDebut, ligneById } = opts;
  const vivantes = pool.filter((t) => t.statut !== "ABANDONNEE");
  const duMois = vivantes.filter((t) => monthOf(t.date) === mois);
  const faitesMois = duMois.filter((t) => t.statut === "FAIT");
  const resteMois = duMois.filter((t) => t.statut !== "FAIT");

  let retards = 0;
  let critiques = 0;
  let boss: PoolTache | null = null;
  for (const t of vivantes) {
    const e = etatProd(t, today);
    if (e === "ok") continue;
    retards++;
    if (e === "critique") {
      critiques++;
      if (!boss || t.date < boss.date) boss = t;
    }
  }

  const jours: JourCharge[] = Array.from({ length: 5 }, (_, i) => {
    const date = addDaysStr(semaineDebut, i);
    const list = vivantes.filter((t) => t.date === date);
    return {
      date,
      totalMin: list.reduce((s, t) => s + t.dureeMin, 0),
      faitMin: list.filter((t) => t.statut === "FAIT").reduce((s, t) => s + t.dureeMin, 0),
      count: list.length,
    };
  });
  const finSemaine = addDaysStr(semaineDebut, 7);
  const deLaSemaine = vivantes.filter((t) => t.date >= semaineDebut && t.date < finSemaine);

  const duJour = vivantes.filter((t) => t.date === today);
  const jourFait = duJour.filter((t) => t.statut === "FAIT");

  // Livré à l'heure (mois en cours) : faite au plus tard le jour prévu.
  let connues = 0;
  let aLHeure = 0;
  for (const t of faitesMois) {
    if (!t.faitLe) continue;
    connues++;
    if (t.faitLe <= t.date) aLHeure++;
  }

  // Clients bouclés : toutes leurs tâches du mois sont faites.
  const parClient = new Map<string, { total: number; faites: number }>();
  for (const t of duMois) {
    const pid = ligneById.get(t.ligneId)?.prospectId ?? t.ligneId;
    const acc = parClient.get(pid) ?? { total: 0, faites: 0 };
    acc.total++;
    if (t.statut === "FAIT") acc.faites++;
    parClient.set(pid, acc);
  }
  const boucles = [...parClient.values()].filter((c) => c.total > 0 && c.faites === c.total).length;

  const finMois = monthOf(addMonthsStr(`${mois}-01`, 1));
  const avantFinMois = (d: string) => monthOf(d) < finMois;

  return {
    mois,
    total: duMois.length,
    faites: faitesMois.length,
    pct: duMois.length ? Math.round((faitesMois.length / duMois.length) * 100) : 0,
    resteMin: resteMois.reduce((s, t) => s + t.dureeMin, 0),
    resteCount: resteMois.length,
    retards,
    critiques,
    boss,
    semaine: {
      jours,
      totalMin: jours.reduce((s, j) => s + j.totalMin, 0),
      faitMin: jours.reduce((s, j) => s + j.faitMin, 0),
      resteCount: deLaSemaine.filter((t) => t.statut !== "FAIT").length,
    },
    jour: {
      totalMin: duJour.reduce((s, t) => s + t.dureeMin, 0),
      faitMin: jourFait.reduce((s, t) => s + t.dureeMin, 0),
      count: duJour.length,
      resteCount: duJour.length - jourFait.length,
      done: duJour.length > 0 && jourFait.length === duJour.length,
    },
    aLHeure: {
      faites: connues,
      aLHeure,
      taux: connues > 0 ? Math.round((aLHeure / connues) * 100) : null,
    },
    clients: { total: parClient.size, boucles },
    attente: vivantes.filter((t) => t.statut === "ATTENTE_CLIENT" && avantFinMois(t.date)).length,
    quickWins: vivantes.filter((t) => isQuickWin(t) && avantFinMois(t.date)).length,
  };
}
