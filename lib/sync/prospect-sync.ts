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

/**
 * Valide un numéro de téléphone suisse ou français. Retourne le numéro
 * d'origine (format conservé) s'il est plausible, sinon null.
 *
 * Règle : après retrait du préfixe international (+41/0041/+33/0033) ou du 0
 * national, le numéro significatif doit faire exactement 9 chiffres et ne pas
 * commencer par 0. Rejette les placeholders et fragments :
 * "000000000000001", "026", "067247263" (incomplet), "036854775808" (overflow)…
 */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const original = String(raw).trim();
  let d = original.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.startsWith("00")) d = d.slice(2);
  let nat: string;
  if (d.startsWith("41") || d.startsWith("33")) nat = d.slice(2);
  else if (d.startsWith("0")) nat = d.slice(1);
  else nat = d;
  return /^[1-9]\d{8}$/.test(nat) ? original : null;
}

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
    VIERGE: "", // vu mais pas contacté → rien à remonter au master
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
    telephone: cleanPhone(row.telephone),
    telephoneMobile: cleanPhone(row.mobile),
    email: clean(row.email),
  };
}

// ── Suppression des doublons de forme juridique (cf. /api/sync/prospects/delete)

/** Statuts sans engagement commercial : la fiche n'a jamais été travaillée. */
const STATUTS_NEUTRES: ReadonlySet<string> = new Set(["NOUVEAU", "VIERGE"]);

/** Ce que la route doit compter pour décider. Un 0 partout = coquille d'import. */
export interface FicheLiens {
  activities: number;
  deals: number;
  contracts: number;
  emails: number;
  expenses: number;
  expenseAllocations: number;
  expenseRecurrences: number;
  dossiers: number;
}

export interface FicheASupprimer {
  statut: string;
  notesGenerales?: string | null;
  derniereActionLe?: Date | null;
  liens: FicheLiens;
}

/**
 * Motifs de NE PAS supprimer une fiche. Vide = suppression sûre.
 *
 * Un doublon est censé être une coquille d'import bilingue. Dès qu'il porte une
 * trace humaine ou comptable, ce n'en est plus une : on le remonte pour
 * arbitrage au lieu de le détruire. Les seuils sont volontairement au plus
 * strict — le coût d'un faux « à conserver » est une ligne en trop, celui d'un
 * faux « supprimable » est de l'historique commercial perdu.
 */
export function motifsDeRetenue(f: FicheASupprimer): string[] {
  const m: string[] = [];
  const l = f.liens;
  // Restrict côté Postgres : la suppression échouerait de toute façon.
  if (l.contracts > 0) m.push(`${l.contracts} contrat(s)`);
  if (l.expenseAllocations > 0) m.push(`${l.expenseAllocations} part(s) de charge`);
  // Cascade côté Postgres : la suppression emporterait l'historique en silence.
  if (l.activities > 0) m.push(`${l.activities} activité(s)`);
  if (l.deals > 0) m.push(`${l.deals} affaire(s)`);
  // SetNull : survivraient orphelins — on préfère épargner la fiche.
  if (l.emails > 0) m.push(`${l.emails} email(s)`);
  if (l.expenses > 0) m.push(`${l.expenses} charge(s)`);
  if (l.expenseRecurrences > 0) m.push(`${l.expenseRecurrences} charge(s) récurrente(s)`);
  if (l.dossiers > 0) m.push(`${l.dossiers} dossier(s)`);
  // Traces humaines sans relation.
  if (!STATUTS_NEUTRES.has(f.statut)) m.push(`statut ${f.statut}`);
  if ((f.notesGenerales ?? "").trim() !== "") m.push("notes saisies");
  if (f.derniereActionLe != null) m.push("action commerciale enregistrée");
  return m;
}
