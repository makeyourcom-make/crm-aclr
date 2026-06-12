/**
 * Schemas Zod pour le module Prospects.
 *
 * Trois schemas distincts :
 *   - ProspectCreateSchema : validation stricte pour la création
 *   - ProspectUpdateSchema : tous champs optionnels (patch partiel)
 *   - ProspectImportRowSchema : lenient, accepte les variations CSV
 *   - ProspectListParamsSchema : pour les query strings de filtrage
 */
import {
  ProspectSecteur,
  ProspectSource,
  ProspectStatut,
} from "@prisma/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers réutilisés
// ---------------------------------------------------------------------------

/** Email vide → undefined ; sinon valide format. */
const emailOptional = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format d'email invalide.")
  .or(z.literal("").transform(() => undefined))
  .optional();

/** Téléphone : trim + validation basique (au moins 7 chiffres). */
const phoneOptional = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9]/.test(v),
    "Numéro de téléphone invalide.",
  )
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** URL optionnelle, vide → undefined. */
const urlOptional = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}/i.test(v),
    "URL invalide.",
  )
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export const ProspectCreateSchema = z.object({
  raisonSociale: z
    .string()
    .trim()
    .min(2, "La raison sociale est obligatoire (min 2 caractères).")
    .max(255),

  contactNom: stringOptional,
  contactPrenom: stringOptional,
  contactFonction: stringOptional,

  email: emailOptional,
  telephone: phoneOptional,
  telephoneMobile: phoneOptional,

  adresse: stringOptional,
  codePostal: stringOptional,
  ville: stringOptional,
  canton: stringOptional,
  pays: z.string().trim().default("Suisse"),

  numeroIDE: stringOptional,
  numeroTVA: stringOptional,

  siteWeb: urlOptional,
  linkedIn: urlOptional,
  facebook: urlOptional,
  instagram: urlOptional,

  secteur: z.nativeEnum(ProspectSecteur).optional(),
  effectif: z.coerce.number().int().min(0).max(1_000_000).optional(),
  noga: stringOptional,
  source: z.nativeEnum(ProspectSource).optional(),

  statut: z.nativeEnum(ProspectStatut).default("NOUVEAU"),

  assigneAId: stringOptional,
  notesGenerales: stringOptional,
});

export type ProspectCreateInput = z.infer<typeof ProspectCreateSchema>;

// ---------------------------------------------------------------------------
// UPDATE (patch partiel — tous les champs sont optionnels)
// ---------------------------------------------------------------------------

export const ProspectUpdateSchema = ProspectCreateSchema.partial();
export type ProspectUpdateInput = z.infer<typeof ProspectUpdateSchema>;

// ---------------------------------------------------------------------------
// LIST PARAMS — query string de la page /prospects
// ---------------------------------------------------------------------------

export const ProspectSortFieldSchema = z.enum([
  "raisonSociale",
  "ville",
  "secteur",
  "statut",
  "createdAt",
  "updatedAt",
]);
export type ProspectSortField = z.infer<typeof ProspectSortFieldSchema>;

export const ProspectListParamsSchema = z.object({
  q: stringOptional,
  statut: z.nativeEnum(ProspectStatut).optional(),
  secteur: z.nativeEnum(ProspectSecteur).optional(),
  canton: stringOptional,
  ville: stringOptional, // filtre texte par ville (remplace le canton en UI)
  /** "1" → uniquement les fiches avec un téléphone (fixe ou mobile). */
  avecTel: stringOptional,
  assigneAId: stringOptional,
  tagId: stringOptional, // filtre par tag (ex. "Passeport Beauté")
  sortBy: ProspectSortFieldSchema.default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(2000).default(50),
});
export type ProspectListParams = z.infer<typeof ProspectListParamsSchema>;

// ---------------------------------------------------------------------------
// IMPORT CSV — schéma lenient
//
// Les fichiers CSV venant de divers exports (LinkedIn Sales Nav, fichiers
// communaux, etc.) ont des conventions variées. On accepte large et on
// nettoie nous-mêmes.
// ---------------------------------------------------------------------------

export const ProspectImportRowSchema = z.object({
  raisonSociale: z.string().trim().min(1, "Raison sociale manquante.").max(255),
  contactNom: stringOptional,
  contactPrenom: stringOptional,
  contactFonction: stringOptional,
  email: emailOptional,
  telephone: phoneOptional,
  telephoneMobile: phoneOptional,
  adresse: stringOptional,
  codePostal: stringOptional,
  ville: stringOptional,
  canton: stringOptional,
  pays: stringOptional, // défaut appliqué côté action
  siteWeb: urlOptional,
  linkedIn: urlOptional,
  /** Texte libre — sera mappé sur l'enum en post-traitement */
  secteur: stringOptional,
  effectif: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.coerce.number().int().min(0).optional(),
    )
    .optional(),
  noga: stringOptional,
  notesGenerales: stringOptional,
});

export type ProspectImportRow = z.infer<typeof ProspectImportRowSchema>;

// ---------------------------------------------------------------------------
// MAPPING CSV header → champ Prospect
//
// Détecte des variations courantes de noms de colonnes (FR/EN, accents,
// espaces, casse). Renvoie le nom canonique du champ, ou null.
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string[]> = {
  raisonSociale: [
    "raison sociale", "raisonsociale", "société", "societe",
    "company", "entreprise", "nom", "nom société", "nom societe",
  ],
  contactNom: ["nom contact", "nom du contact", "lastname", "last name", "nom"],
  contactPrenom: ["prénom", "prenom", "firstname", "first name", "prénom contact"],
  contactFonction: ["fonction", "poste", "titre", "title", "role"],
  email: ["email", "e-mail", "mail", "courriel"],
  telephone: ["téléphone", "telephone", "tel", "phone", "tél"],
  telephoneMobile: ["mobile", "portable", "tel mobile", "téléphone mobile"],
  adresse: ["adresse", "address", "rue"],
  codePostal: ["code postal", "codepostal", "cp", "zip", "npa"],
  ville: ["ville", "city", "localité", "localite"],
  canton: ["canton", "état", "region"],
  pays: ["pays", "country"],
  siteWeb: ["site web", "siteweb", "site", "website", "url", "web"],
  linkedIn: ["linkedin", "linked in", "url linkedin", "profil linkedin"],
  secteur: ["secteur", "secteur d'activité", "industrie", "industry", "domaine"],
  effectif: ["effectif", "employés", "employees", "taille", "nb employés"],
  noga: ["noga", "code noga", "code naf"],
  notesGenerales: ["notes", "commentaires", "remarques", "comment"],
};

/**
 * Devine le champ canonique correspondant à un header CSV.
 * Compare en normalisant (lowercase, sans accents, sans espaces parasites).
 */
export function guessFieldFromHeader(header: string): string | null {
  const norm = header
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const aliasNorm = alias
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
      if (aliasNorm === norm) return field;
    }
  }
  return null;
}

/**
 * Devine le secteur d'activité à partir d'un texte libre (CSV).
 * Renvoie null si aucun mot-clé n'est détecté.
 */
export function guessSecteur(raw: string | undefined): ProspectSecteur | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (/(resto|hôtel|hotel|brasseri|café|cafe|bar|pizza)/.test(t))
    return "RESTO_HOTEL";
  if (/(e-?commerce|boutique en ligne|shop|store)/.test(t)) return "E_COMMERCE";
  if (/(artisan|boulanger|coiffeur|garagiste|menuisier|électricien|plombier|maçon)/.test(t))
    return "ARTISAN";
  if (/(cabinet|avocat|dentiste|médecin|notaire|architect|expert|fiduciaire)/.test(t))
    return "CABINET_LIBERAL";
  if (/(immobili|agence|courtier)/.test(t)) return "IMMOBILIER";
  if (/(touris|camping|gîte|chambre d'hôte|location vacance)/.test(t))
    return "TOURISME";
  if (/(pme|industri|fabric|production|société|sàrl|sarl|sa\b)/.test(t))
    return "PME_B2B";
  return null;
}
