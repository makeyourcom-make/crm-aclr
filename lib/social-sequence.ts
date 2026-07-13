/**
 * Helpers pour la séquence sociale (J+0 / J+2 / J+4 / J+6).
 *
 * Règles métier :
 *  - 22 jours ouvrables par mois × 10 prospects/jour = 220/compte/mois
 *  - Les samedis et dimanches ne sont PAS des jours d'action
 *  - Une séquence terminée = 4 étapes cochées → sort de la vue "Aujourd'hui"
 */

export const SOCIAL_STEPS = [0, 2, 4, 6] as const;
export type SocialStep = (typeof SOCIAL_STEPS)[number];

export const STEP_LABELS: Record<SocialStep, string> = {
  0: "À liker",
  2: "À réagir",
  4: "À contacter en MP",
  6: "À relancer",
};

export const STEP_HINTS: Record<SocialStep, string> = {
  0: "Liker 2 publications",
  2: "Réagir à une story ou un commentaire",
  4: "Contact en message privé (MP)",
  6: "Relance (commentaire / story)",
};

export const STEP_ICONS: Record<SocialStep, string> = {
  0: "Heart",
  2: "MessageSquare",
  4: "Mail",
  6: "Repeat",
};

/**
 * Renvoie tous les jours ouvrables (lun-ven) d'un mois donné.
 * @param year ex. 2026
 * @param month 1-12
 */
export function getBusinessDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      // copie pour éviter les mutations
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Date sans heure (UTC midi → évite les surprises de fuseau).
 */
export function dateOnly(d: Date | string): Date {
  const dd = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate(), 12, 0, 0));
}

/** True si la date tombe un samedi (6) ou un dimanche (0). */
export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Avance de `n` JOURS OUVRABLES à partir de `start` (les week-ends ne
 * comptent pas). `n = 0` renvoie `start` tel quel.
 */
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

/**
 * À partir d'une date de démarrage, calcule la date d'une étape.
 * J+0 = demarrage ; J+2/4/6 = +2/4/6 JOURS OUVRABLES.
 *
 * Le social fait une PAUSE le samedi et le dimanche : aucune étape de
 * séquence ne tombe un week-end. Le décompte se fait donc en jours
 * ouvrables (lun-ven), pas en jours calendaires — décision produit
 * MakeYourCom. La date de démarrage est elle-même toujours un jour
 * ouvrable (la répartition saute déjà les week-ends).
 */
export function getStepDate(demarrage: Date, step: SocialStep): Date {
  return addBusinessDays(demarrage, step);
}

/**
 * À une date donnée, renvoie pour un prospect les étapes "dues" :
 *  - chaque étape NON faite dont la date planifiée <= aujourd'hui (due OU en
 *    retard). Le travail non fait reste visible — sinon on affiche un faux
 *    « tout est à jour » alors que des actions attendent.
 *
 * Le VOLUME (éviter le mur du lundi) n'est PAS géré ici mais par un plafond
 * journalier côté vue `/social/aujourdhui` (les plus anciennes d'abord, ~10
 * prospects/compte/jour) : chaque jour ouvrable présente une liste finie et
 * gérable, et on avance dans le retard. Le samedi/dimanche, aucune étape ne
 * tombe (dates en jours ouvrables) → rien de nouveau, mais l'écran de pause
 * week-end reste affiché.
 */
export function getDueSteps(
  demarrage: Date,
  steps: { step0Done: Date | null; step2Done: Date | null; step4Done: Date | null; step6Done: Date | null },
  today: Date,
): SocialStep[] {
  const due: SocialStep[] = [];
  const todayKey = dateOnly(today).getTime();
  for (const s of SOCIAL_STEPS) {
    const stepKey = dateOnly(getStepDate(demarrage, s)).getTime();
    const done = (
      s === 0 ? steps.step0Done : s === 2 ? steps.step2Done : s === 4 ? steps.step4Done : steps.step6Done
    );
    if (!done && stepKey <= todayKey) due.push(s);
  }
  return due;
}

/**
 * Distribue N prospects sur les jours ouvrables d'un mois (10/jour).
 * Si le mois n'a pas assez de jours, on cycle (pour rester ≤ 220 — défaut).
 */
export function assignProspectsToDays(
  count: number,
  year: number,
  month: number,
  perDay = 10,
): Date[] {
  const days = getBusinessDays(year, month);
  const assignments: Date[] = [];
  for (let i = 0; i < count; i++) {
    const dayIdx = Math.floor(i / perDay) % days.length;
    assignments.push(dateOnly(days[dayIdx]!));
  }
  return assignments;
}

/**
 * Distribue N prospects sur les jours ouvrables EN AVANT à partir d'une
 * date de départ (utilisée pour démarrer "maintenant" et étaler dans le futur).
 * Toujours `perDay` par jour ouvrable, débordement sur les jours suivants.
 */
export function assignProspectsFromDate(
  count: number,
  startDate: Date,
  perDay = 10,
): Date[] {
  const assignments: Date[] = [];
  // Si startDate tombe un week-end, on saute au lundi
  const cursor = new Date(startDate);
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor.setDate(cursor.getDate() + 1);
  }
  // Construit la liste des jours ouvrables à partir de cursor
  // jusqu'à avoir assez pour `count` prospects
  const neededDays = Math.ceil(count / perDay);
  const days: Date[] = [];
  for (let i = 0, d = new Date(cursor); days.length < neededDays; i++) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  for (let i = 0; i < count; i++) {
    const dayIdx = Math.floor(i / perDay);
    assignments.push(dateOnly(days[dayIdx]!));
  }
  return assignments;
}

/**
 * Réseau social → couleur Tailwind (badge)
 */
export const NETWORK_COLORS: Record<string, string> = {
  FACEBOOK: "bg-blue-100 text-blue-800",
  INSTAGRAM: "bg-pink-100 text-pink-800",
  LINKEDIN: "bg-sky-100 text-sky-800",
  TIKTOK: "bg-slate-200 text-slate-800",
  AUTRE: "bg-slate-100 text-slate-700",
};

export const NETWORK_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  AUTRE: "Autre",
};
