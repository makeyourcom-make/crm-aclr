/**
 * MYC Arena · rubrique Entreprises : « chaleur » d'un lead et aides de jeu.
 *
 * FONCTIONS PURES (aucune requête, aucun accès à l'horloge : `nowMs` est
 * toujours passé en argument, pour un rendu serveur et une hydratation client
 * identiques). Client-safe.
 *
 * Chaleur = statut + récence de la dernière action + RDV à venir + deal ouvert.
 * Elle se lit en 5 niveaux (Brûlant, Chaud, Tiède, Frais, Froid) et un score
 * 0-100 qui affine le classement À L'INTÉRIEUR d'un niveau.
 *
 * Règle d'or : « chaude » (niveau ≥ 4) est EXACTEMENT le filtre de la vue
 * « Les plus chaudes » (`chaudesWhere` dans lib/queries/prospects.ts). Les
 * deux s'appuient sur les mêmes constantes ci-dessous : si tu changes une
 * règle ici, change-la là-bas.
 */
import type {
  ActivityResultat,
  ActivityStatut,
  ActivityType,
  ProspectStatut,
} from "@prisma/client";

import { XP_RULES, type Tone } from "@/lib/gamification/rules";

import {
  calendarDaysAgo,
  fmtDate,
  fmtDayMonth,
  fmtTime,
  toDate,
  type DateInput,
} from "./zurich-format";

// ---------------------------------------------------------------------------
// CONSTANTES PARTAGÉES AVEC LES REQUÊTES
// ---------------------------------------------------------------------------

export const DAY_MS = 86_400_000;

export const HEAT_RULES = {
  /** Action de moins de 7 jours = fiche « chaude » (point vert). */
  hotDays: 7,
  /** Au-delà de 30 jours sans action, la fiche est froide. */
  warmDays: 30,
  /** Proposition sans nouvelle action depuis 3 jours = à relancer. */
  relanceDays: 3,
} as const;

/** Fiches sorties du jeu (on n'appelle plus). */
export const DEAD_STATUTS: readonly ProspectStatut[] = [
  "PERDU",
  "NUMERO_INVALIDE",
  "NE_PAS_RAPPELER",
];

/** Leads en cours (ni signés, ni sortis). */
export const LEAD_STATUTS: readonly ProspectStatut[] = [
  "NOUVEAU",
  "VIERGE",
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
];

/** Leads engagés dans le pipeline (au moins qualifiés). */
export const PIPELINE_STATUTS: readonly ProspectStatut[] = [
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
];

/** Leads très avancés (RDV ou proposition). */
export const ADVANCED_STATUTS: readonly ProspectStatut[] = [
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
];

/** Statuts « contactés » au sens de la vue « Qui refroidissent ». */
export const ENGAGED_STATUTS: readonly ProspectStatut[] = [
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
];

/** Étapes d'un deal encore ouvert. */
export const OPEN_DEAL_STAGES = ["DECOUVERTE", "PROPOSITION", "NEGOCIATION"] as const;

/** Instant au-delà duquel une action date de moins de `days` jours. */
export function sinceMs(nowMs: number, days: number): number {
  return nowMs - days * DAY_MS;
}

function within(d: Date | null, nowMs: number, days: number): boolean {
  return d !== null && d.getTime() >= sinceMs(nowMs, days);
}

// ---------------------------------------------------------------------------
// CHALEUR
// ---------------------------------------------------------------------------

export type HeatLevel = 1 | 2 | 3 | 4 | 5;

export interface LeadSignals {
  statut: ProspectStatut;
  /** Dernière action commerciale (colonne dénormalisée). */
  derniereActionLe: DateInput;
  /** Date du dernier / prochain RDV (colonne dénormalisée). */
  dateRdvLe: DateInput;
  /** Au moins un deal ouvert (découverte, proposition, négociation). */
  hasOpenDeal: boolean;
}

export interface LeadHeat {
  /** `client` = signé · `out` = sorti du jeu · `lead` = en cours. */
  kind: "lead" | "client" | "out";
  level: HeatLevel;
  label: string;
  /** 0-100, cohérent avec le niveau (bandes disjointes). */
  score: number;
  tone: Tone;
  /** Couleur vive (flamme, barre, anneau). */
  hex: string;
  /** Classe de texte lisible sur blanc. */
  textClass: string;
  /** Chaude = niveau ≥ 4 (vue « Les plus chaudes »). */
  hot: boolean;
  /** RDV planifié dans le futur. */
  rdvAVenir: boolean;
}

const HEAT_META: Record<HeatLevel, { label: string; hex: string; textClass: string; tone: Tone }> = {
  5: { label: "Brûlant", hex: "#E95256", textClass: "text-coral-600", tone: "coral" },
  4: { label: "Chaud", hex: "#F47174", textClass: "text-coral-600", tone: "coral" },
  3: { label: "Tiède", hex: "#F5A524", textClass: "text-gold-700", tone: "gold" },
  2: { label: "Frais", hex: "#3B6FF6", textClass: "text-info-700", tone: "blue" },
  1: { label: "Froid", hex: "#8A93A6", textClass: "text-muted-foreground", tone: "navy" },
};

/** Bandes de score par niveau [min, max]. */
const BANDS: Record<HeatLevel, [number, number]> = {
  5: [80, 100],
  4: [65, 79],
  3: [45, 64],
  2: [25, 44],
  1: [0, 24],
};

const STAGE_RANK: Partial<Record<ProspectStatut, number>> = {
  NOUVEAU: 0,
  VIERGE: 0,
  CONTACTE: 1,
  QUALIFIE: 2,
  RDV_PRIS: 3,
  PROPOSITION_ENVOYEE: 4,
};

/**
 * Niveau de chaleur (règles explicables) :
 *  5 Brûlant : RDV à venir, ou RDV pris / proposition avec une action < 7 j
 *  4 Chaud   : qualifié et plus avec une action < 30 j, contacté avec une
 *              action < 7 j, ou deal ouvert avec une action < 30 j
 *  3 Tiède   : une action < 30 j, ou une fiche engagée qui s'est refroidie
 *  2 Frais   : jamais touchée (aucune action), à attaquer
 *  1 Froid   : plus de 30 j sans action, ou fiche sortie du jeu
 */
export function computeLeadHeat(s: LeadSignals, nowMs: number): LeadHeat {
  const last = toDate(s.derniereActionLe);
  const rdv = toDate(s.dateRdvLe);
  const rdvAVenir = rdv !== null && rdv.getTime() > nowMs;

  if (s.statut === "SIGNE") {
    return {
      kind: "client",
      level: 5,
      label: "Client",
      score: 100,
      tone: "green",
      hex: "#12A150",
      textClass: "text-win-700",
      hot: false,
      rdvAVenir,
    };
  }

  const dead = DEAD_STATUTS.includes(s.statut);
  if (dead) {
    const meta = HEAT_META[1];
    return {
      kind: "out",
      level: 1,
      label: meta.label,
      score: s.statut === "PERDU" ? 8 : 4,
      tone: meta.tone,
      hex: meta.hex,
      textClass: meta.textClass,
      hot: false,
      rdvAVenir,
    };
  }

  const adv = ADVANCED_STATUTS.includes(s.statut);
  const pipe = PIPELINE_STATUTS.includes(s.statut);
  const hot7 = within(last, nowMs, HEAT_RULES.hotDays);
  const warm30 = within(last, nowMs, HEAT_RULES.warmDays);

  let level: HeatLevel;
  if (rdvAVenir || (adv && hot7)) level = 5;
  else if (
    (pipe && warm30) ||
    (s.statut === "CONTACTE" && hot7) ||
    (s.hasOpenDeal && warm30)
  )
    level = 4;
  else if (warm30 || pipe || s.hasOpenDeal) level = 3;
  else if (last === null) level = 2;
  else level = 1;

  // Affinage dans la bande : fraîcheur, avancement, deal, RDV.
  const ageDays = last ? Math.max(0, (nowMs - last.getTime()) / DAY_MS) : null;
  const recency = ageDays === null ? 0.3 : Math.max(0, 1 - ageDays / 60);
  const stage = (STAGE_RANK[s.statut] ?? 0) / 4;
  const intensity =
    0.45 * recency + 0.35 * stage + (s.hasOpenDeal ? 0.1 : 0) + (rdvAVenir ? 0.1 : 0);
  const [min, max] = BANDS[level];
  const score = Math.round(min + Math.min(1, Math.max(0, intensity)) * (max - min));

  const meta = HEAT_META[level];
  return {
    kind: "lead",
    level,
    label: meta.label,
    score,
    tone: meta.tone,
    hex: meta.hex,
    textClass: meta.textClass,
    hot: level >= 4,
    rdvAVenir,
  };
}

/** Légende des niveaux (dans l'ordre décroissant). */
export const HEAT_LEGEND: { level: HeatLevel; label: string; hex: string }[] = (
  [5, 4, 3, 2, 1] as HeatLevel[]
).map((level) => ({ level, label: HEAT_META[level].label, hex: HEAT_META[level].hex }));

// ---------------------------------------------------------------------------
// FRAÎCHEUR DE LA DERNIÈRE ACTION
// ---------------------------------------------------------------------------

export type FreshKey = "jamais" | "chaud" | "tiede" | "froid";

export interface Freshness {
  key: FreshKey;
  label: string;
  dotClass: string;
  textClass: string;
  /** Jours calendaires depuis la dernière action (null si aucune). */
  daysAgo: number | null;
}

export function freshnessOf(derniereActionLe: DateInput, nowMs: number): Freshness {
  const last = toDate(derniereActionLe);
  if (!last) {
    return {
      key: "jamais",
      label: "aucune action",
      dotClass: "bg-coral-400",
      textClass: "text-coral-600",
      daysAgo: null,
    };
  }
  const n = Math.max(0, calendarDaysAgo(last, nowMs) ?? 0);
  const ago = n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`;
  if (within(last, nowMs, HEAT_RULES.hotDays)) {
    return { key: "chaud", label: ago, dotClass: "bg-win-500", textClass: "text-win-700", daysAgo: n };
  }
  if (within(last, nowMs, HEAT_RULES.warmDays)) {
    return {
      key: "tiede",
      label: `${ago} · refroidit`,
      dotClass: "bg-gold-500",
      textClass: "text-gold-700",
      daysAgo: n,
    };
  }
  return {
    key: "froid",
    label: `${ago} · froid`,
    dotClass: "bg-alert-500",
    textClass: "text-alert-700",
    daysAgo: n,
  };
}

/** Légende des points de fraîcheur. */
export const FRESH_LEGEND: { key: FreshKey; label: string; dotClass: string }[] = [
  { key: "jamais", label: "aucune action", dotClass: "bg-coral-400" },
  { key: "chaud", label: "moins de 7 j", dotClass: "bg-win-500" },
  { key: "tiede", label: "refroidit", dotClass: "bg-gold-500" },
  { key: "froid", label: "froid", dotClass: "bg-alert-500" },
];

// ---------------------------------------------------------------------------
// PROCHAINE (MEILLEURE) ACTION
// ---------------------------------------------------------------------------

const RDV_TYPES: readonly ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

export function isRdvType(t: ActivityType): boolean {
  return RDV_TYPES.includes(t);
}

/** Libellé court d'une activité planifiée (« RDV », « Rappel », « Email »). */
export function plannedLabel(t: ActivityType): string {
  if (isRdvType(t)) return t === "RDV_VISIO" ? "Visio" : t === "RDV_TELEPHONIQUE" ? "RDV tél." : "RDV";
  if (t === "APPEL_SORTANT" || t === "APPEL_ENTRANT") return "Rappel";
  if (t === "EMAIL_ENVOYE" || t === "EMAIL_RECU") return "Email";
  if (t === "SMS") return "SMS";
  if (t === "LINKEDIN") return "LinkedIn";
  return "Tâche";
}

export interface PlannedAction {
  type: ActivityType;
  date: DateInput;
}

export interface NextActionInput {
  statut: ProspectStatut;
  derniereActionLe: DateInput;
  dernierAppelLe: DateInput;
  dateRdvLe: DateInput;
  contratDebutLe?: DateInput;
  hasOpenDeal: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  /** Plus ancienne activité encore PLANIFIÉE (en retard ou à venir). */
  nextPlanned?: PlannedAction | null;
}

export interface NextAction {
  /** Libellé court (colonne « Prochaine action » de la liste). */
  short: string;
  /** Conseil complet (encart « Prochaine meilleure action » de la fiche). */
  text: string;
  tone: Tone;
  /** Action planifiée en retard. */
  overdue: boolean;
}

export function nextBestAction(i: NextActionInput, nowMs: number): NextAction {
  const last = toDate(i.derniereActionLe);
  const days = last ? Math.max(0, calendarDaysAgo(last, nowMs) ?? 0) : null;
  const neverCalled = toDate(i.dernierAppelLe) === null;
  const planned = i.nextPlanned ? toDate(i.nextPlanned.date) : null;
  const rdv = toDate(i.dateRdvLe);

  if (i.statut === "SIGNE") {
    const debut = toDate(i.contratDebutLe ?? null);
    return {
      short: debut ? `Client depuis le ${fmtDate(debut)}` : "Client signé",
      text: "Client signé : soigne la relation et prépare les renouvellements.",
      tone: "green",
      overdue: false,
    };
  }
  if (i.statut === "NE_PAS_RAPPELER") {
    return {
      short: "Hors jeu",
      text: "Ne pas rappeler : la fiche est hors jeu, plus d'appel sur ce lead.",
      tone: "red",
      overdue: false,
    };
  }
  if (i.statut === "NUMERO_INVALIDE") {
    return {
      short: "Trouver un autre numéro",
      text: i.hasEmail
        ? "Numéro hors service : écris un email ou cherche un autre numéro (Google, LinkedIn)."
        : "Numéro hors service : cherche un autre numéro ou un email (Google, LinkedIn).",
      tone: "gold",
      overdue: false,
    };
  }
  if (i.statut === "PERDU") {
    return {
      short: "Perdu",
      text: "Perdu pour l'instant : retente dans quelques mois avec une offre différente.",
      tone: "navy",
      overdue: false,
    };
  }

  if (planned && i.nextPlanned) {
    const label = plannedLabel(i.nextPlanned.type);
    const when = `${fmtDayMonth(planned)} · ${fmtTime(planned)}`;
    if (planned.getTime() < nowMs) {
      const rdvType = isRdvType(i.nextPlanned.type);
      return {
        short: rdvType ? `${label} du ${fmtDayMonth(planned)} à valider` : `${label} en retard · ${fmtDayMonth(planned)}`,
        text: rdvType
          ? `${label} du ${fmtDayMonth(planned)} à valider : indique s'il a eu lieu (RDV effectué +${XP_RULES.rdvEffectue} XP).`
          : `${label} prévu le ${fmtDayMonth(planned)} en retard : fais-le maintenant, la fiche n'attend que toi.`,
        tone: "red",
        overdue: true,
      };
    }
    const plannedIsRdv = isRdvType(i.nextPlanned.type);
    // Un RDV plus loin que ce rappel : on le rappelle dans le conseil.
    const rdvLater = !plannedIsRdv && rdv !== null && rdv.getTime() > planned.getTime();
    return {
      short: `${label} ${when}`,
      text: plannedIsRdv
        ? `${label} le ${fmtDayMonth(planned)} à ${fmtTime(planned)} : prépare ton offre et deux exemples concrets.`
        : rdvLater && rdv
          ? `${label} prévu le ${fmtDayMonth(planned)} à ${fmtTime(planned)}, puis RDV le ${fmtDayMonth(rdv)} à ${fmtTime(rdv)} : prépare ton offre et deux exemples concrets.`
          : `${label} prévu le ${fmtDayMonth(planned)} à ${fmtTime(planned)} : tout est calé, garde le rythme.`,
      tone: plannedIsRdv || rdvLater ? "violet" : "blue",
      overdue: false,
    };
  }

  if (rdv && rdv.getTime() > nowMs) {
    return {
      short: `RDV ${fmtDayMonth(rdv)} · ${fmtTime(rdv)}`,
      text: `RDV le ${fmtDayMonth(rdv)} à ${fmtTime(rdv)} : prépare ton offre et deux exemples concrets.`,
      tone: "violet",
      overdue: false,
    };
  }

  if (!i.hasPhone) {
    return {
      short: "Trouver un numéro",
      text: i.hasEmail
        ? "Pas de numéro sur la fiche : écris un email ou complète la fiche pour pouvoir appeler."
        : "Ni numéro ni email : complète la fiche (Google, LinkedIn) pour pouvoir attaquer.",
      tone: "gold",
      overdue: false,
    };
  }

  if (neverCalled && (i.statut === "NOUVEAU" || i.statut === "VIERGE")) {
    return {
      short: "Premier appel",
      text: `Lead jamais appelé : premier appel +${XP_RULES.appel} XP, décroché +${XP_RULES.conversation} XP de plus. À toi de jouer.`,
      tone: "coral",
      overdue: false,
    };
  }

  if (i.statut === "PROPOSITION_ENVOYEE") {
    if (days === null || days >= HEAT_RULES.relanceDays) {
      return {
        short: "Relancer la proposition",
        text:
          days === null
            ? "Proposition envoyée : relance aujourd'hui pour aller chercher la signature."
            : `Proposition sans nouvelles depuis ${days} j : relance aujourd'hui pour aller chercher la signature.`,
        tone: "gold",
        overdue: false,
      };
    }
    return {
      short: "Relancer dans 2-3 jours",
      text: "Proposition toute fraîche : laisse-la respirer et relance dans 2 ou 3 jours.",
      tone: "blue",
      overdue: false,
    };
  }

  if (days !== null && days > HEAT_RULES.warmDays) {
    return {
      short: `Relancer · ${days} j sans action`,
      text: `${days} jours sans action : relance maintenant ou range la fiche pour garder ta liste propre.`,
      tone: "red",
      overdue: false,
    };
  }
  if (days !== null && days > HEAT_RULES.hotDays) {
    return {
      short: "Rappeler, ça refroidit",
      text: `Plus rien depuis ${days} jours : rappelle avant que la fiche ne passe au froid.`,
      tone: "gold",
      overdue: false,
    };
  }

  if (i.statut === "RDV_PRIS") {
    return {
      short: "Envoyer la proposition",
      text: `RDV pris : cale la date dans l'agenda puis envoie ta proposition (+${XP_RULES.proposition} XP).`,
      tone: "violet",
      overdue: false,
    };
  }
  if (i.statut === "QUALIFIE") {
    return {
      short: "Décrocher un RDV",
      text: `Besoin qualifié : décroche le RDV (+${XP_RULES.rdvPris} XP), c'est le moment.`,
      tone: "violet",
      overdue: false,
    };
  }
  if (i.statut === "CONTACTE") {
    return {
      short: "Qualifier le besoin",
      text: "Contact établi : qualifie le besoin (décideur, budget, délai) et propose un RDV.",
      tone: "blue",
      overdue: false,
    };
  }
  return {
    short: "Appeler",
    text: `Appelle pour lancer la conversation (+${XP_RULES.appel} XP par appel).`,
    tone: "blue",
    overdue: false,
  };
}

// ---------------------------------------------------------------------------
// XP RAPPORTÉS PAR UNE ACTIVITÉ (mêmes règles que lib/gamification/engine)
// ---------------------------------------------------------------------------

const NO_CONVERSATION: readonly ActivityResultat[] = ["COMBOX", "NE_DECROCHE_PAS", "INVALIDE"];

export interface XpActivity {
  type: ActivityType;
  statut: ActivityStatut;
  resultat: ActivityResultat | null;
  date: DateInput;
  prospectId: string | null;
}

/**
 * XP gagnés par l'auteur de l'activité (hors bonus de missions) :
 * appel passé +5, décroché +10, RDV pris +50, RDV effectué +80, email +3.
 */
export function activityXp(a: XpActivity, nowMs: number): number {
  let xp = 0;
  if (a.type === "APPEL_SORTANT" && (a.statut === "FAIT" || a.statut === "EN_COURS")) {
    xp += XP_RULES.appel;
    if (a.resultat && !NO_CONVERSATION.includes(a.resultat)) xp += XP_RULES.conversation;
  }
  if (a.resultat === "RDV_PRIS") xp += XP_RULES.rdvPris;
  const date = toDate(a.date);
  if (
    isRdvType(a.type) &&
    a.prospectId &&
    a.statut === "FAIT" &&
    date !== null &&
    date.getTime() <= nowMs
  ) {
    xp += XP_RULES.rdvEffectue;
  }
  if (a.type === "EMAIL_ENVOYE" && a.statut === "FAIT") xp += XP_RULES.email;
  return xp;
}

// ---------------------------------------------------------------------------
// COMPLÉTUDE DE LA FICHE
// ---------------------------------------------------------------------------

export interface CompletenessInput {
  contactPrenom: string | null;
  contactNom: string | null;
  contactFonction: string | null;
  email: string | null;
  telephone: string | null;
  telephoneMobile: string | null;
  siteWeb: string | null;
  adresse: string | null;
  ville: string | null;
  secteur: string | null;
  effectif: number | null;
}

export interface Completeness {
  pct: number;
  filled: number;
  total: number;
  /** Prochain champ à compléter (« Ajoute le mobile »), null si complète. */
  hint: string | null;
}

export function ficheCompleteness(p: CompletenessInput): Completeness {
  const checks: [boolean, string][] = [
    [!!(p.contactPrenom || p.contactNom), "Ajoute le nom du contact"],
    [!!(p.telephone || p.telephoneMobile), "Ajoute un téléphone"],
    [!!p.email, "Ajoute l'email"],
    [!!p.telephoneMobile, "Ajoute le mobile"],
    [!!p.contactFonction, "Ajoute la fonction du contact"],
    [!!p.adresse, "Ajoute l'adresse"],
    [!!p.ville, "Ajoute la ville"],
    [!!p.secteur, "Ajoute le secteur"],
    [!!p.siteWeb, "Ajoute le site web"],
    [p.effectif !== null && p.effectif !== undefined, "Ajoute l'effectif"],
  ];
  const filled = checks.filter(([ok]) => ok).length;
  const missing = checks.find(([ok]) => !ok);
  return {
    pct: Math.round((filled / checks.length) * 100),
    filled,
    total: checks.length,
    hint: missing ? missing[1] : null,
  };
}

/** Initiales d'une raison sociale (« Garage du Chablais » → « GC »). */
export function companyInitials(name: string): string {
  const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "sa", "sàrl", "sarl", "ag", "gmbh", "&"]);
  const words = name
    .replace(/[()«»"'.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP.has(w.toLowerCase()));
  const pick = words.length > 0 ? words : name.split(/\s+/).filter(Boolean);
  const a = pick[0]?.[0] ?? "?";
  const b = pick[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}
