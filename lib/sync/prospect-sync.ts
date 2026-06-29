/**
 * Logique de synchronisation master (BASE_PROSPECTS) ↔ CRM.
 *
 * Modèle d'autorité par champ (validé avec le client) :
 *  - MASTER possède les données scrapées : adresse, NPA, ville, canton, pays,
 *    site web, réseaux sociaux, + tout l'extra (scores, Google, TikTok, etc.).
 *  - CRM possède les données commerciales : statut, contact, téléphones/email
 *    corrigés, tags, notes, assignation.
 *
 * Conséquences :
 *  - À l'INGEST (master → CRM) sur une fiche existante, on n'écrase JAMAIS les
 *    champs CRM. Sur une fiche nouvelle, on initialise tout depuis le master.
 *  - À l'EXPORT (CRM → master), on ne renvoie QUE les champs commerciaux.
 */
import type { ProspectStatut } from "@prisma/client";

/** Normalisation identique à la pipeline Python : lower + trim + espaces compactés. */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Une ligne master telle qu'envoyée par le script Python. */
export interface MasterRow {
  masterId: number;
  nom: string;
  contact?: string | null;
  telephone?: string | null;
  mobile?: string | null;
  email?: string | null;
  adresse?: string | null;
  npa?: string | null;
  ville?: string | null;
  canton?: string | null;
  pays?: string | null;
  siteWeb?: string | null;
  linkedIn?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  statutMaster?: string | null;
  /** Champs scrapés sans colonne dédiée (stockés en JSON). */
  extra?: Record<string, unknown> | null;
}

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Mappe le « Statut Prospection » texte du master vers l'enum CRM. */
export function mapStatutFromMaster(raw: string | null | undefined): ProspectStatut {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "NOUVEAU";
  if (s.includes("pas int") || s.includes("perdu")) return "PERDU";
  if (s.includes("ne plus") || s.includes("invalide")) return "NE_PAS_RAPPELER";
  if (s.includes("répondu") || s.includes("repondu")) return "CONTACTE";
  if (s.includes("relan") || s.includes("envoy")) return "CONTACTE";
  return "NOUVEAU";
}

/** Mappe l'enum statut CRM vers un libellé texte lisible pour le master. */
export function mapStatutToMaster(statut: ProspectStatut): string {
  const M: Record<ProspectStatut, string> = {
    NOUVEAU: "",
    CONTACTE: "Contacté",
    QUALIFIE: "Qualifié",
    RDV_PRIS: "RDV pris",
    PROPOSITION_ENVOYEE: "Proposition envoyée",
    SIGNE: "Signé",
    PERDU: "Répondu - Pas intéressé",
    NE_PAS_RAPPELER: "Ne plus contacter",
  };
  return M[statut] ?? "";
}

/** Champs scrapés (propriété master) — réécrits à chaque ingest. */
export function masterOwnedFields(row: MasterRow) {
  return {
    adresse: clean(row.adresse),
    codePostal: clean(row.npa),
    ville: clean(row.ville),
    canton: clean(row.canton),
    pays: clean(row.pays) ?? "Suisse",
    siteWeb: clean(row.siteWeb),
    linkedIn: clean(row.linkedIn),
    facebook: clean(row.facebook),
    instagram: clean(row.instagram),
    masterData: (row.extra ?? undefined) as object | undefined,
  };
}

/** Données de contact « initiales » — posées seulement à la CRÉATION ou pour
 *  remplir un champ CRM vide (jamais pour écraser une correction commerciale). */
export function masterContactFields(row: MasterRow) {
  return {
    contactNom: clean(row.contact),
    telephone: clean(row.telephone),
    telephoneMobile: clean(row.mobile),
    email: clean(row.email),
  };
}
