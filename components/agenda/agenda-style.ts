/**
 * Agenda MYC Arena : couleurs et icônes par type d'activité et par statut.
 *
 * Un RDV se reconnaît à sa TEINTE (physique = or, visio = violet,
 * téléphonique = bleu) ET à son ICÔNE (épingle, caméra, combiné) : la couleur
 * n'est jamais le seul indice. Les statuts (à valider, effectué, manqué,
 * annulé) se lisent aussi par un libellé et une bordure.
 *
 * Client-safe (aucune dépendance serveur).
 */
import {
  CalendarDays,
  Check,
  Globe,
  Mail,
  MailOpen,
  MapPin,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ActivityStatut, ActivityType } from "@prisma/client";

import { TONE_HEX, type Tone } from "@/components/arena/tones";
import { isRdvType, type ActivityCategory } from "@/lib/activity-category";

/**
 * Teintes de l'agenda : celles de MYC Arena, sauf le fond coral passé au
 * coral 50 (#FFF1F1) pour que le texte coral 600 y tienne 4.5:1 en 11-13 px.
 */
export const AGENDA_HEX: Record<Tone, { soft: string; solid: string; text: string }> = {
  ...TONE_HEX,
  coral: { ...TONE_HEX.coral, soft: "#FFF1F1" },
};

export const INK = "#0E1936";
export const MUTED = "#5B6478";
export const GROUND = "#F4F6FB";
export const BORDER = "#E5E8F0";
export const BORDER_STRONG = "#D5DAE6";

export interface TypeMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  tone: Tone;
}

export const TYPE_META: Record<ActivityType, TypeMeta> = {
  RDV_PHYSIQUE: { label: "RDV physique", short: "Physique", icon: MapPin, tone: "gold" },
  RDV_VISIO: { label: "RDV visio", short: "Visio", icon: Video, tone: "violet" },
  RDV_TELEPHONIQUE: {
    label: "RDV téléphonique",
    short: "Téléphone",
    icon: Phone,
    tone: "blue",
  },
  APPEL_SORTANT: { label: "Appel sortant", short: "Appel", icon: PhoneOutgoing, tone: "coral" },
  APPEL_ENTRANT: { label: "Appel entrant", short: "Appel", icon: PhoneIncoming, tone: "coral" },
  EMAIL_ENVOYE: { label: "Email envoyé", short: "Email", icon: Mail, tone: "teal" },
  EMAIL_RECU: { label: "Email reçu", short: "Email", icon: MailOpen, tone: "teal" },
  SMS: { label: "SMS", short: "SMS", icon: MessageSquare, tone: "navy" },
  LINKEDIN: { label: "LinkedIn", short: "LinkedIn", icon: Globe, tone: "navy" },
  NOTE: { label: "Note", short: "Note", icon: StickyNote, tone: "navy" },
};

/** Les trois types de RDV, dans l'ordre d'affichage (légende, création rapide). */
export const RDV_TYPE_KEYS: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

/** Puces de filtre par catégorie (charte : RDV or, appels coral, emails teal). */
export const CATEGORY_META: Record<
  ActivityCategory,
  { icon: LucideIcon; tone: Tone; label: string }
> = {
  rdv: { icon: CalendarDays, tone: "gold", label: "RDV" },
  appel: { icon: Phone, tone: "coral", label: "Appels" },
  mail: { icon: Mail, tone: "teal", label: "Emails" },
  autre: { icon: MessageSquare, tone: "navy", label: "Autres" },
};

/** État « jeu » d'une activité à l'instant `nowMs`. */
export type AgendaState =
  | "a-valider"
  | "en-cours"
  | "effectue"
  | "fait"
  | "manque"
  | "annule"
  | "reporte"
  | "planifie";

const OPEN: ActivityStatut[] = ["PLANIFIE", "EN_COURS", "REPLANIFIE"];

export interface StateInput {
  type: ActivityType;
  statut: ActivityStatut;
  prospectId: string | null;
  date: Date | string;
  duree: number | null;
}

/** Vrai pour un RDV client (compte dans le jeu : +80 XP une fois effectué). */
export function isClientRdv(a: { type: ActivityType; prospectId: string | null }): boolean {
  return isRdvType(a.type) && !!a.prospectId;
}

export function isOpenStatut(s: ActivityStatut): boolean {
  return OPEN.includes(s);
}

export function agendaState(a: StateInput, durMin: number, nowMs: number): AgendaState {
  const start = new Date(a.date).getTime();
  const end = start + durMin * 60_000;
  switch (a.statut) {
    case "FAIT":
      return isRdvType(a.type) ? "effectue" : "fait";
    case "MANQUE":
      return "manque";
    case "ANNULE":
      return "annule";
    default:
      break;
  }
  if (isClientRdv(a) && isOpenStatut(a.statut)) {
    if (end <= nowMs) return "a-valider";
    if (start <= nowMs) return "en-cours";
  }
  if (a.statut === "REPLANIFIE") return "reporte";
  return "planifie";
}

export const STATE_LABEL: Record<AgendaState, string> = {
  "a-valider": "À valider",
  "en-cours": "En cours",
  effectue: "Effectué",
  fait: "Fait",
  manque: "Manqué",
  annule: "Annulé",
  reporte: "Reporté",
  planifie: "Planifié",
};

export const STATE_TONE: Record<AgendaState, Tone> = {
  "a-valider": "red",
  "en-cours": "coral",
  effectue: "green",
  fait: "green",
  manque: "red",
  annule: "navy",
  reporte: "violet",
  planifie: "blue",
};

export interface BlockLook {
  bg: string;
  bar: string;
  /** Couleur de la ligne méta (heure · statut), lisible sur `bg`. */
  meta: string;
  title: string;
  icon: LucideIcon;
  dashed: boolean;
  strike: boolean;
}

/**
 * Apparence d'un bloc d'agenda. Priorité de la barre de gauche : couleur
 * choisie à la main > couleur du collaborateur (vue équipe) > type / statut.
 */
export function blockLook(
  type: ActivityType,
  state: AgendaState,
  barOverride: string | null,
): BlockLook {
  const meta = TYPE_META[type];
  const hex = AGENDA_HEX[meta.tone];
  const look: BlockLook = {
    bg: hex.soft,
    bar: hex.solid,
    meta: hex.text,
    title: INK,
    icon: meta.icon,
    dashed: false,
    strike: false,
  };
  if (state === "a-valider") {
    look.meta = TONE_HEX.red.text;
    look.dashed = true;
  } else if (state === "effectue") {
    look.bg = TONE_HEX.green.soft;
    look.bar = TONE_HEX.green.solid;
    look.meta = TONE_HEX.green.text;
    look.icon = Check;
  } else if (state === "fait") {
    look.bg = GROUND;
    look.bar = BORDER_STRONG;
    look.meta = MUTED;
    look.title = MUTED;
    look.icon = Check;
  } else if (state === "manque") {
    look.bg = TONE_HEX.red.soft;
    look.bar = TONE_HEX.red.solid;
    look.meta = TONE_HEX.red.text;
    look.icon = X;
  } else if (state === "annule") {
    look.bg = GROUND;
    look.bar = BORDER_STRONG;
    look.meta = MUTED;
    look.title = MUTED;
    look.strike = true;
  }
  // La couleur choisie (ou celle du collaborateur) colore la barre tant que
  // l'activité est à venir ; une fois réglée, le statut reprend la main.
  if (barOverride && (state === "planifie" || state === "reporte" || state === "en-cours")) {
    look.bar = barOverride;
  }
  return look;
}

/**
 * Couleurs des collaborateurs en vue « Toute l'équipe ». Attribuées par RANG
 * (admin d'abord, puis ordre alphabétique) et non par hachage de l'id : la
 * couleur de chacun reste stable d'une semaine à l'autre.
 */
export const USER_COLORS = ["#3B6FF6", "#E95256", "#7C5CFC", "#12A150", "#F5A524"];

export function buildUserColors(
  users: Array<{ id: string; name: string; role: string }>,
): Record<string, string> {
  return Object.fromEntries(
    sortTeam(users).map((u, i) => [u.id, USER_COLORS[i % USER_COLORS.length]!]),
  );
}

export function sortTeam<T extends { name: string; role: string }>(users: T[]): T[] {
  return [...users].sort(
    (a, b) =>
      (a.role === "ADMIN" ? 0 : 1) - (b.role === "ADMIN" ? 0 : 1) ||
      a.name.localeCompare(b.name, "fr"),
  );
}

/** Teinte translucide d'une couleur hex (#RRGGBB + alpha). */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex;
}
