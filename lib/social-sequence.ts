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

/**
 * À partir d'une date de démarrage, calcule la date d'une étape.
 * J+0 = demarrage ; J+2/4/6 = +2/4/6 jours CALENDAIRES (week-end inclus,
 * car les actions peuvent être faites samedi/dimanche en réalité, c'est la
 * livraison/réalisation qui glisse — décision produit).
 */
export function getStepDate(demarrage: Date, step: SocialStep): Date {
  const d = new Date(demarrage);
  d.setDate(d.getDate() + step);
  return d;
}

/**
 * À une date donnée, renvoie pour un prospect les étapes "dues" :
 *  - chaque étape dont stepDate <= today ET stepDone === null
 *
 * Si plusieurs étapes accumulent (ex. on revient lundi et 3 étapes sont
 * en retard), on les renvoie toutes.
 */
export function getDueSteps(
  demarrage: Date,
  steps: { step0Done: Date | null; step2Done: Date | null; step4Done: Date | null; step6Done: Date | null },
  today: Date,
): SocialStep[] {
  const due: SocialStep[] = [];
  for (const s of SOCIAL_STEPS) {
    const stepDate = getStepDate(demarrage, s);
    const done = (
      s === 0 ? steps.step0Done : s === 2 ? steps.step2Done : s === 4 ? steps.step4Done : steps.step6Done
    );
    if (!done && stepDate <= today) due.push(s);
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
