/**
 * Métadonnées des résultats d'appel pour l'UI MYC Arena (boutons colorés,
 * familles, raccourcis clavier, XP, rappel auto).
 *
 * Les XP affichés suivent EXACTEMENT le barème du moteur (lib/gamification) :
 * un appel passé rapporte +5, un appel décroché (conversation : résultat
 * hors Combox / Ne décroche pas / Numéro invalide) +10 de plus, un RDV pris
 * +50 de plus. Aucun multiplicateur n'est crédité côté serveur.
 *
 * Client-safe (aucune ressource serveur).
 */
import type { ActivityResultat } from "@prisma/client";

import { XP_RULES, type Tone } from "@/lib/gamification/rules";
import type { RappelDelai } from "@/lib/schemas/activity";

export type ResultFamily = "gagne" | "relance" | "clos";

export interface ResultMeta {
  code: ActivityResultat;
  family: ResultFamily;
  tone: Tone;
  /** Raccourci clavier (1-9, 0, A). */
  key: string;
  /** Aide courte sous le libellé. */
  aide?: string;
  /** Délai du rappel « Auto » (résultats à relancer uniquement). */
  autoRappel?: Exclude<RappelDelai, "custom">;
}

/** Ordre d'affichage = ordre des raccourcis. */
export const RESULT_ORDER: ActivityResultat[] = [
  "RDV_PRIS",
  "INTERESSE_PAS_PRET",
  "A_RAPPELER",
  "NE_DECROCHE_PAS",
  "COMBOX",
  "REFUS_POLI",
  "REFUS_FERME",
  "INVALIDE",
  "DEJA_CLIENT",
  "MAUVAISE_PERSONNE",
  "AUTRE",
];

export const RESULT_META: Record<ActivityResultat, ResultMeta> = {
  RDV_PRIS: { code: "RDV_PRIS", family: "gagne", tone: "green", key: "1" },
  INTERESSE_PAS_PRET: {
    code: "INTERESSE_PAS_PRET",
    family: "gagne",
    tone: "blue",
    key: "2",
    autoRappel: "J+7",
  },
  A_RAPPELER: { code: "A_RAPPELER", family: "relance", tone: "blue", key: "3", autoRappel: "J+1" },
  NE_DECROCHE_PAS: {
    code: "NE_DECROCHE_PAS",
    family: "relance",
    tone: "gold",
    key: "4",
    autoRappel: "J+1",
  },
  COMBOX: { code: "COMBOX", family: "relance", tone: "gold", key: "5", autoRappel: "J+2" },
  REFUS_POLI: {
    code: "REFUS_POLI",
    family: "clos",
    tone: "navy",
    key: "6",
    aide: "Garde la porte ouverte",
  },
  REFUS_FERME: {
    code: "REFUS_FERME",
    family: "clos",
    tone: "red",
    key: "7",
    aide: "Passe en « Ne pas rappeler »",
  },
  INVALIDE: {
    code: "INVALIDE",
    family: "clos",
    tone: "red",
    key: "8",
    aide: "Corrige le numéro sur la fiche",
  },
  DEJA_CLIENT: {
    code: "DEJA_CLIENT",
    family: "clos",
    tone: "navy",
    key: "9",
    aide: "Note le concurrent",
  },
  MAUVAISE_PERSONNE: {
    code: "MAUVAISE_PERSONNE",
    family: "clos",
    tone: "navy",
    key: "0",
    aide: "Mets à jour le contact",
  },
  AUTRE: { code: "AUTRE", family: "clos", tone: "navy", key: "A", aide: "Précise dans les notes" },
};

/** Résultats qui déclenchent un rappel auto côté serveur (cf. recordCallResult). */
export const RAPPEL_RESULTATS: ActivityResultat[] = [
  "COMBOX",
  "NE_DECROCHE_PAS",
  "A_RAPPELER",
  "INTERESSE_PAS_PRET",
];

/** Résultats NON comptés comme conversation par le moteur de jeu. */
const NON_CONVERSATION: ActivityResultat[] = ["COMBOX", "NE_DECROCHE_PAS", "INVALIDE"];

export function isConversation(r: ActivityResultat | null | undefined): boolean {
  return !!r && !NON_CONVERSATION.includes(r);
}

/** XP rapportés par un appel selon son résultat (null = appel en cours). */
export function xpForCall(r: ActivityResultat | null | undefined): number {
  let xp: number = XP_RULES.appel;
  if (isConversation(r)) xp += XP_RULES.conversation;
  if (r === "RDV_PRIS") xp += XP_RULES.rdvPris;
  return xp;
}

/** Choix de rappel dans l'UI : « auto », un délai, une date libre ou aucun. */
export type RappelChoice = "auto" | RappelDelai | "none";

export const RAPPEL_CHOICES: { value: RappelChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "J+1", label: "Demain" },
  { value: "J+2", label: "J+2" },
  { value: "J+3", label: "J+3" },
  { value: "J+7", label: "Dans 1 semaine" },
  { value: "J+14", label: "Dans 2 semaines" },
  { value: "J+30", label: "Dans 1 mois" },
  { value: "custom", label: "Autre date" },
  { value: "none", label: "Pas de rappel" },
];

const DELAI_JOURS: Record<Exclude<RappelDelai, "custom">, number> = {
  "J+1": 1,
  "J+2": 2,
  "J+3": 3,
  "J+7": 7,
  "J+14": 14,
  "J+30": 30,
};

/** Délai effectivement envoyé au serveur pour un résultat donné. */
export function delaiFor(
  r: ActivityResultat,
  choice: RappelChoice,
): RappelDelai | undefined {
  if (!RAPPEL_RESULTATS.includes(r)) return undefined;
  if (choice === "none") return undefined;
  if (choice === "auto") return RESULT_META[r].autoRappel;
  return choice;
}

/**
 * Date prévisionnelle d'un rappel (même règle que le serveur : +N jours,
 * week-end reporté au lundi). Pour l'affichage uniquement.
 */
export function previewRappelDate(
  delai: RappelDelai | undefined,
  nowMs: number,
  customIso?: string,
): Date | null {
  if (!delai) return null;
  let d: Date;
  if (delai === "custom") {
    if (!customIso) return null;
    d = new Date(customIso);
    if (Number.isNaN(d.getTime())) return null;
  } else {
    if (!nowMs) return null;
    d = new Date(nowMs);
    d.setDate(d.getDate() + DELAI_JOURS[delai]);
  }
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

/** Texte d'aide « Auto » (barème des rappels automatiques). */
export const AUTO_RAPPEL_AIDE =
  "Auto : À rappeler et Ne décroche pas demain, Combox J+2, Intéressé J+7. Week-end reporté au lundi : plus aucun lead perdu.";
