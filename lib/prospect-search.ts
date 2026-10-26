/**
 * Recherche « destinataire » de clients/prospects (Nouveau mail, rattacher un
 * mail à un client…). Pensée pour 130k+ prospects :
 *
 *  - Chaque MOT tapé doit matcher un des champs (raison sociale, prénom, nom,
 *    email, ville) → « Hugues Jaquet » trouve le contact même si prénom et nom
 *    sont dans deux colonnes.
 *  - Insensible aux accents (« creer » trouve « Créer ») via une regex à classes
 *    de caractères, qui reste servie par les index GIN trigramme existants
 *    (≈ 40-180 ms au lieu d'un scan complet).
 *  - Trouve aussi les personnes avec qui on a ÉCHANGÉ des mails (nom/adresse de
 *    l'expéditeur ou du destinataire) même si la fiche client n'a pas ce contact.
 *  - Les vrais clients d'abord : contrat > mails échangés > raison sociale qui
 *    commence par le 1er mot > email renseigné > activité récente.
 *  - Repli tolérant aux fautes de frappe (trigrammes) si rien ne correspond
 *    (ex. fiche saisie « Huges » au lieu de « Hugues »).
 */
import { prisma } from "@/lib/db";

export interface ProspectSearchHit {
  id: string;
  raisonSociale: string;
  ville: string | null;
  email: string | null;
  contactPrenom: string | null;
  contactNom: string | null;
  /** Client avec au moins un contrat. */
  isClient: boolean;
  /** Résultat « approchant » (repli tolérant aux fautes), pas une correspondance exacte. */
  approx: boolean;
}

const FOLD: Record<string, string> = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", ç: "c",
  è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i",
  ñ: "n", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u", ý: "y", ÿ: "y",
};
const ACCENT_CLASS: Record<string, string> = {
  a: "[aàáâãäå]", c: "[cç]", e: "[eèéêë]", i: "[iìíîï]",
  n: "[nñ]", o: "[oòóôõö]", u: "[uùúûü]", y: "[yýÿ]",
};
const REGEX_SPECIAL = new Set(".*+?^$()|[]{}\\/".split(""));

/** Mot normalisé : minuscules, sans accents. */
function fold(token: string): string {
  return token
    .toLowerCase()
    .split("")
    .map((c) => FOLD[c] ?? c)
    .join("");
}

/** Mot → regex insensible aux accents (« creer » → « cr[eèéêë][eèéêë]r »). */
function accentRegex(token: string): string {
  return fold(token)
    .split("")
    .map((c) => ACCENT_CLASS[c] ?? (REGEX_SPECIAL.has(c) ? `\\${c}` : c))
    .join("");
}

const FIELDS = [
  `p."raisonSociale"`,
  `p."contactPrenom"`,
  `p."contactNom"`,
  `p.email`,
  `p.ville`,
];

type Row = {
  id: string;
  raisonSociale: string;
  ville: string | null;
  email: string | null;
  contactPrenom: string | null;
  contactNom: string | null;
  is_client: boolean;
};

const SELECT = `SELECT p.id, p."raisonSociale", p.ville, p.email,
    p."contactPrenom", p."contactNom",
    EXISTS (SELECT 1 FROM contracts c WHERE c."prospectId" = p.id) AS is_client,
    EXISTS (SELECT 1 FROM emails e WHERE e."prospectId" = p.id) AS has_mail
  FROM prospects p`;

export async function searchProspects(
  query: string,
  opts: { userId: string; isAdmin: boolean; limit?: number },
): Promise<ProspectSearchHit[]> {
  const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (tokens.length === 0) return [];
  const limit = opts.limit ?? 20;
  const regexes = tokens.map(accentRegex);

  // 1) Personnes avec qui l'utilisateur a échangé des mails (table emails :
  //    petite) — tous les mots dans nom/adresse expéditeur ou destinataire.
  const mailHits = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT DISTINCT e."prospectId" AS id FROM emails e
     WHERE e."prospectId" IS NOT NULL AND e."userId" = $1
       AND ${regexes
         .map(
           (_, i) =>
             `concat_ws(' ', e."expediteurNom", e."expediteurEmail", e."destinataireEmail") ~* $${i + 2}`,
         )
         .join(" AND ")}
     LIMIT 50`,
    opts.userId,
    ...regexes,
  );
  const mailIds = mailHits.map((r) => r.id);

  // 2) Recherche principale (index trigramme) + mails échangés.
  const n = regexes.length;
  const scope = opts.isAdmin ? "TRUE" : `p."assigneAId" = $${n + 2}`;
  const tokenConds = regexes
    .map((_, i) => `(${FIELDS.map((f) => `${f} ~* $${i + 1}`).join(" OR ")})`)
    .join(" AND ");
  const params: unknown[] = [...regexes, mailIds];
  if (!opts.isAdmin) params.push(opts.userId);

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `${SELECT}
     WHERE ${scope} AND ((${tokenConds}) OR p.id = ANY($${n + 1}::text[]))
     ORDER BY is_client DESC, has_mail DESC,
       (p."raisonSociale" ~* ('^' || $1)) DESC,
       (p.email IS NOT NULL) DESC,
       p."updatedAt" DESC
     LIMIT ${limit}`,
    ...params,
  );
  if (rows.length > 0) return rows.map((r) => toHit(r, false));

  // 3) Repli tolérant aux fautes : similarité de mots (trigrammes) sur
  //    raison sociale / prénom / nom, chaque mot devant ressembler à un champ.
  const folded = tokens.map(fold);
  const simFields = [`p."raisonSociale"`, `p."contactPrenom"`, `p."contactNom"`];
  const fuzzyConds = folded
    .map((_, i) => `(${simFields.map((f) => `$${i + 1} <% ${f}`).join(" OR ")})`)
    .join(" AND ");
  const score = folded
    .map(
      (_, i) =>
        `GREATEST(${simFields.map((f) => `word_similarity($${i + 1}, coalesce(${f}, ''))`).join(", ")})`,
    )
    .join(" + ");
  const fuzzyParams: unknown[] = [...folded];
  const fuzzyScope = opts.isAdmin ? "TRUE" : `p."assigneAId" = $${folded.length + 1}`;
  if (!opts.isAdmin) fuzzyParams.push(opts.userId);

  const [, fuzzy] = await prisma.$transaction([
    // Seuil abaissé (0.6 par défaut) pour tolérer une lettre manquante.
    prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.45`),
    prisma.$queryRawUnsafe<Row[]>(
      `${SELECT}
       WHERE ${fuzzyScope} AND ${fuzzyConds}
       ORDER BY is_client DESC, (${score}) DESC
       LIMIT ${Math.min(limit, 10)}`,
      ...fuzzyParams,
    ),
  ]);
  return fuzzy.map((r) => toHit(r, true));
}

function toHit(r: Row, approx: boolean): ProspectSearchHit {
  return {
    id: r.id,
    raisonSociale: r.raisonSociale,
    ville: r.ville,
    email: r.email,
    contactPrenom: r.contactPrenom,
    contactNom: r.contactNom,
    isClient: r.is_client,
    approx,
  };
}
