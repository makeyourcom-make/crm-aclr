/**
 * Libellés et teintes du cockpit de phoning, dérivés des données réelles
 * (statut, raison de présence dans la file, historique). Client-safe.
 */
import type { ProspectStatut } from "@prisma/client";

import { zDate, zDayDiff, zTime } from "@/components/call/zurich";
import type { Tone } from "@/lib/gamification/rules";
import {
  getActivityResultatLabel,
  getActivityTypeLabel,
  getProspectStatutLabel,
} from "@/lib/labels";
import type { PhoningQueueItem } from "@/lib/queries/phoning";

export const STATUT_TONE: Record<ProspectStatut, Tone> = {
  NOUVEAU: "navy",
  VIERGE: "navy",
  CONTACTE: "blue",
  QUALIFIE: "teal",
  RDV_PRIS: "coral",
  PROPOSITION_ENVOYEE: "gold",
  SIGNE: "green",
  PERDU: "navy",
  NUMERO_INVALIDE: "gold",
  NE_PAS_RAPPELER: "red",
};

export interface ReasonPill {
  label: string;
  short: string;
  tone: Tone;
}

/** Pastille « pourquoi il est dans la file ». */
export function reasonPill(item: PhoningQueueItem, nowMs: number): ReasonPill {
  switch (item.reason) {
    case "RAPPEL_RETARD": {
      const days = item.rappel && nowMs ? Math.max(1, zDayDiff(item.rappel.date, nowMs)) : 1;
      return {
        label: days <= 1 ? "Rappel en retard depuis hier" : `Rappel en retard de ${days} jours`,
        short: "Rappel en retard",
        tone: "red",
      };
    }
    case "RAPPEL_JOUR": {
      const t = item.rappel ? zTime(item.rappel.date) : "";
      return { label: `Rappel prévu à ${t}`, short: `Rappel ${t}`, tone: "blue" };
    }
    case "CHAUD":
      return {
        label: `Lead chaud · ${getProspectStatutLabel(item.statut)}`,
        short: "Lead chaud",
        tone: "violet",
      };
    default:
      return {
        label: item.tentatives === 0 ? "Jamais appelé" : "Nouveau",
        short: item.tentatives === 0 ? "Jamais appelé" : "Nouveau",
        tone: "navy",
      };
  }
}

export interface Heat {
  label: "brûlant" | "chaud" | "tiède" | "froid";
  tone: Tone;
}

/** Chaleur du lead (heuristique sur le statut et l'origine du rappel). */
export function heatOf(item: PhoningQueueItem): Heat {
  if (item.statut === "PROPOSITION_ENVOYEE" || item.statut === "RDV_PRIS") {
    return { label: "brûlant", tone: "coral" };
  }
  if (
    item.statut === "QUALIFIE" ||
    item.rappel?.origine?.resultat === "INTERESSE_PAS_PRET" ||
    item.rappel?.origine?.resultat === "A_RAPPELER"
  ) {
    return { label: "chaud", tone: "gold" };
  }
  if (item.statut === "CONTACTE") return { label: "tiède", tone: "blue" };
  return { label: "froid", tone: "navy" };
}

/** Raisons concrètes d'appeler maintenant (tirées des données de la fiche). */
export function reasonsFor(item: PhoningQueueItem, nowMs: number): string[] {
  const out: string[] = [];
  const r = item.rappel;
  if (item.reason === "RAPPEL_RETARD" && r) {
    const days = nowMs ? Math.max(1, zDayDiff(r.date, nowMs)) : 1;
    out.push(
      `Rappel prévu le ${zDate(r.date)} à ${zTime(r.date)}, en retard de ${days} jour${days > 1 ? "s" : ""} : chaque jour qui passe refroidit le lead.`,
    );
  } else if (item.reason === "RAPPEL_JOUR" && r) {
    const passed = nowMs > 0 && new Date(r.date).getTime() <= nowMs;
    out.push(
      passed
        ? `Rappel prévu aujourd'hui à ${zTime(r.date)} : c'est l'heure, il attend peut-être ton appel.`
        : `Rappel prévu aujourd'hui à ${zTime(r.date)} : appelle-le dans le créneau.`,
    );
  }
  if (r?.origine?.resultat) {
    out.push(
      `Suite à « ${getActivityResultatLabel(r.origine.resultat)} » du ${zDate(r.origine.date)}.`,
    );
  }
  if (r && r.sujet && r.sujet !== "Rappel automatique") {
    out.push(`Note du rappel : « ${r.sujet} ».`);
  }
  if (item.reason === "CHAUD") {
    const days =
      item.derniereActionLe && nowMs ? Math.max(0, zDayDiff(item.derniereActionLe, nowMs)) : null;
    out.push(
      days === null
        ? `Statut « ${getProspectStatutLabel(item.statut)} » et aucune action enregistrée : relance-le.`
        : `Statut « ${getProspectStatutLabel(item.statut)} » sans action depuis ${days} jours : relance-le avant qu'il refroidisse.`,
    );
  }
  if (item.reason === "NOUVEAU") {
    out.push(
      item.tentatives === 0
        ? "Jamais appelé : c'est toi qui ouvres le bal, fais forte impression."
        : `Déjà ${item.tentatives} tentative${item.tentatives > 1 ? "s" : ""}, toujours pas de vraie conversation.`,
    );
    out.push(`Fiche créée le ${zDate(item.createdAt)}.`);
  }
  const last = item.recent[0];
  if (last) {
    out.push(
      `Dernier échange : ${getActivityTypeLabel(last.type).toLowerCase()} le ${zDate(last.date)}${last.resultat ? ` (${getActivityResultatLabel(last.resultat)})` : ""}.`,
    );
  }
  return out.slice(0, 4);
}

/** « Marc Fellay » à partir du prénom / nom (vide si aucun). */
export function contactName(item: Pick<PhoningQueueItem, "contactPrenom" | "contactNom">): string {
  return [item.contactPrenom, item.contactNom].filter(Boolean).join(" ").trim();
}

/** Adresse postale sur une ligne (« Route de la Plaine 12, 1868 Collombey »). */
export function adresseLine(
  item: Pick<PhoningQueueItem, "adresse" | "codePostal" | "ville">,
): string {
  const cpVille = [item.codePostal, item.ville].filter(Boolean).join(" ");
  return [item.adresse, cpVille].filter(Boolean).join(", ");
}
