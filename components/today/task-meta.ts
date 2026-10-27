/**
 * Méta d'affichage des actions de « Ma journée » : libellé + teinte par type
 * d'activité et par résultat d'appel. Pur, importable partout (client compris).
 */
import type { ActivityResultat, ActivityType } from "@prisma/client";

import { formatInt } from "@/components/arena/format";
import type { DayCounters, Tone } from "@/lib/gamification/rules";
import type { DoneCounter, TodayTask } from "@/lib/queries/today";

export const TASK_TYPE_META: Record<ActivityType, { label: string; tone: Tone; doneLabel: string }> = {
  APPEL_SORTANT: { label: "Appel sortant", tone: "coral", doneLabel: "Appel enregistré" },
  APPEL_ENTRANT: { label: "Appel entrant", tone: "coral", doneLabel: "Appel traité" },
  EMAIL_ENVOYE: { label: "Email à envoyer", tone: "teal", doneLabel: "Email envoyé" },
  EMAIL_RECU: { label: "Email reçu", tone: "teal", doneLabel: "Email traité" },
  RDV_PHYSIQUE: { label: "RDV physique", tone: "gold", doneLabel: "RDV effectué" },
  RDV_VISIO: { label: "RDV visio", tone: "gold", doneLabel: "RDV effectué" },
  RDV_TELEPHONIQUE: { label: "RDV téléphonique", tone: "gold", doneLabel: "RDV effectué" },
  SMS: { label: "SMS", tone: "blue", doneLabel: "SMS envoyé" },
  LINKEDIN: { label: "LinkedIn", tone: "blue", doneLabel: "Action LinkedIn faite" },
  NOTE: { label: "Note", tone: "navy", doneLabel: "Tâche faite" },
};

/** Objectifs du jour affichés dans « Ma journée » (compteurs et toasts). */
export interface DayTargets {
  appels: number;
  rdvPris: number;
  rdvEffectues: number;
  propositions: number;
  emails: number;
}

/** Compteurs réels du jour + objectifs : sert au détail des toasts « fait ». */
export interface DayProgress {
  today: DayCounters;
  targets: DayTargets;
}

/** Prochaine étape commerciale après un RDV effectué. */
export const NEXT_STEP_AFTER_RDV = "prochaine étape : envoyer la proposition";

const COUNTER_UNIT: Record<DoneCounter, [string, string]> = {
  appels: ["appel", "appels"],
  emails: ["email", "emails"],
  rdvEffectues: ["RDV effectué", "RDV effectués"],
};

/**
 * Toast sobre affiché quand une action est marquée faite, ex.
 * « Appel enregistré » · « Garage du Chablais · 29 / 40 appels aujourd'hui ».
 * La progression n'est donnée que si l'action fait réellement avancer un
 * compteur du jour (`task.compte`) et que les compteurs sont disponibles.
 */
export function doneToastFor(
  task: Pick<TodayTask, "type" | "compte" | "kind" | "prospect">,
  progress: DayProgress | null,
): { message: string; detail?: string } {
  const meta = TASK_TYPE_META[task.type];
  const parts: string[] = [];
  if (task.prospect) parts.push(task.prospect.raisonSociale);
  if (task.compte && progress) {
    const next = progress.today[task.compte] + 1;
    const target = progress.targets[task.compte];
    const [one, many] = COUNTER_UNIT[task.compte];
    parts.push(`${formatInt(next)} / ${formatInt(target)} ${target > 1 ? many : one} aujourd'hui`);
  }
  if (task.kind === "rdv" && task.prospect) parts.push(NEXT_STEP_AFTER_RDV);
  return { message: meta.doneLabel, detail: parts.length > 0 ? parts.join(" · ") : undefined };
}

export const RESULTAT_META: Record<ActivityResultat, { label: string; tone: Tone; chaleur: number }> = {
  INTERESSE_PAS_PRET: { label: "Intéressé, pas prêt", tone: "green", chaleur: 6 },
  A_RAPPELER: { label: "À rappeler", tone: "blue", chaleur: 5 },
  RDV_PRIS: { label: "RDV pris", tone: "green", chaleur: 4 },
  AUTRE: { label: "Autre", tone: "navy", chaleur: 2 },
  NE_DECROCHE_PAS: { label: "Ne décroche pas", tone: "gold", chaleur: 2 },
  COMBOX: { label: "Combox / Répondeur", tone: "navy", chaleur: 1 },
  MAUVAISE_PERSONNE: { label: "Mauvaise personne", tone: "navy", chaleur: 1 },
  DEJA_CLIENT: { label: "Déjà client / concurrent", tone: "navy", chaleur: 0 },
  REFUS_POLI: { label: "Refus poli", tone: "navy", chaleur: 0 },
  REFUS_FERME: { label: "Refus ferme", tone: "red", chaleur: 0 },
  INVALIDE: { label: "Numéro invalide", tone: "red", chaleur: 0 },
};

/** Chaleur d'un rappel sans appel précédent connu (entre « à rappeler » et « combox »). */
export const CHALEUR_INCONNUE = 3;

/** Couleur vive (bord gauche, point de frise) par teinte. Classes écrites en entier. */
export const TONE_BORDER_L: Record<Tone, string> = {
  coral: "border-l-coral-400",
  navy: "border-l-navy-500",
  green: "border-l-win-500",
  gold: "border-l-gold-500",
  blue: "border-l-info-500",
  violet: "border-l-lvl-500",
  teal: "border-l-mail-500",
  red: "border-l-alert-500",
};

export const TONE_DOT: Record<Tone, string> = {
  coral: "bg-coral-400 ring-coral-400",
  navy: "bg-navy-500 ring-navy-500",
  green: "bg-win-500 ring-win-500",
  gold: "bg-gold-500 ring-gold-500",
  blue: "bg-info-500 ring-info-500",
  violet: "bg-lvl-500 ring-lvl-500",
  teal: "bg-mail-500 ring-mail-500",
  red: "bg-alert-500 ring-alert-500",
};

/** Teinte d'un pourcentage d'objectif (règle historique : rouge < 50 % ≤ or < 80 % ≤ vert). */
export function toneForPct(pct: number): Tone {
  if (pct >= 80) return "green";
  if (pct >= 50) return "gold";
  return "red";
}
