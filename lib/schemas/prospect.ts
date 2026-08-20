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
  /** Dernière action commerciale (appel, email, RDV…) — colonne dénormalisée. */
  "derniereActionLe",
  /** Début du contrat en cours — colonne dénormalisée contratDebutLe. */
  "contratDebutLe",
  /** Date du dernier appel — colonne dénormalisée dernierAppelLe. */
  "dernierAppelLe",
  /** Date de RDV (dernier / futur planifié) — colonne dénormalisée dateRdvLe. */
  "dateRdvLe",
]);
export type ProspectSortField = z.infer<typeof ProspectSortFieldSchema>;

/**
 * Filtre MULTI-VALEURS. Dans l'URL les valeurs sont séparées par des virgules
 * (ex. `?statut=NOUVEAU,SIGNE`) ; un paramètre répété (`?statut=A&statut=B`)
 * est aussi accepté. Renvoie TOUJOURS un tableau — vide = filtre inactif.
 * Dédupliqué et nettoyé (trim, valeurs vides ignorées).
 */
function csvList() {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v): string[] => {
      if (!v) return [];
      const raw = Array.isArray(v)
        ? v.flatMap((s) => s.split(","))
        : v.split(",");
      return [...new Set(raw.map((s) => s.trim()).filter(Boolean))];
    });
}

/** Idem `csvList` mais ne garde que les valeurs d'un enum (les autres sont ignorées). */
function csvEnumList<T extends string>(valid: readonly T[]) {
  const allowed = new Set<string>(valid);
  return csvList().transform((arr) => arr.filter((s): s is T => allowed.has(s)));
}

export const ProspectListParamsSchema = z.object({
  q: stringOptional,
  /** Multi-sélection (cases à cocher). */
  statut: csvEnumList(Object.values(ProspectStatut)),
  /** Multi-sélection (cases à cocher). */
  secteur: csvEnumList(Object.values(ProspectSecteur)),
  canton: stringOptional,
  /** Multi-villes : texte libre, plusieurs villes séparées par des virgules
   *  (ex. "Genève, Lausanne") — match "contient", insensible à la casse. */
  ville: csvList(),
  /** "1" → uniquement les fiches avec un téléphone (fixe ou mobile). */
  avecTel: stringOptional,
  assigneAId: stringOptional,
  /** Multi-sélection de tags (cases à cocher). */
  tagId: csvList(),
  /** Multi-sélection de produits : ne garde que les clients SIGNÉS dont un
   *  contrat contient l'un des produits cochés (Prospect → Contract → Product). */
  productId: csvList(),
  /** Filtre "Date d'ajout" : ne garde que les fiches créées À PARTIR de cette
   *  date (AAAA-MM-JJ). Permet de voir ce qui a été ajouté depuis X. */
  ajouteDepuis: stringOptional,
  /** Filtre "Dernière action" : ne garde que les fiches dont la dernière action
   *  commerciale est À PARTIR de cette date (AAAA-MM-JJ). */
  actionDepuis: stringOptional,
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
  // Ordre = du plus spécifique au plus générique.
  if (/(resto|restaurant|hôtel|hotel|brasseri|café|cafe|\bbar\b|pizza|traiteur|snack)/.test(t))
    return "RESTO_HOTEL";
  if (/(boulanger|pâtisser|patisser|boucher|épiceri|epiceri|primeur|fromager|caviste|alimentation)/.test(t))
    return "ALIMENTATION";
  if (/(e-?commerce|boutique en ligne|vente en ligne|webshop|shop|store)/.test(t))
    return "E_COMMERCE";
  if (/(coiffeur|coiffure|esthéti|estheti|institut|beauté|beaute|spa|manucure|ongler|barbier|tatou)/.test(t))
    return "BEAUTE";
  if (/(médecin|medecin|dentiste|physio|ostéo|osteo|pharmaci|cabinet médical|clinique|infirmi|podolog|opticien|vétérinaire|veterinaire|thérapeut|therapeut)/.test(t))
    return "SANTE";
  if (/(fitness|gym|salle de sport|yoga|pilates|crossfit|club sportif)/.test(t))
    return "SPORT_FITNESS";
  if (/(construction|bâtiment|batiment|maçon|macon|charpent|toitur|couvreur|génie civil|genie civil|gros œuvre|terrassement)/.test(t))
    return "CONSTRUCTION";
  if (/(garage|carross|automobile|pneu|mécanique auto|mecanique auto|concession)/.test(t))
    return "AUTOMOBILE";
  if (/(menuisier|électricien|electricien|plombier|sanitaire|peintre|serrur|vitrier|paysagist|jardin|nettoyage|ramoneur|artisan)/.test(t))
    return "ARTISAN";
  if (/(immobili|régie|regie|courtier|gérance|gerance)/.test(t)) return "IMMOBILIER";
  if (/(fiduciaire|comptab|assurance|banqu|financ|courtage)/.test(t))
    return "FIDUCIAIRE_FINANCE";
  if (/(avocat|notaire|architect|huissier|expert-comptable|étude d'avocat)/.test(t))
    return "CABINET_LIBERAL";
  if (/(informati|logiciel|software|digital|web|it\b|développ|developp|télécom|telecom|hébergement|hebergement|saas)/.test(t))
    return "INFORMATIQUE";
  if (/(industri|fabric|production|usine|manufactur)/.test(t)) return "INDUSTRIE";
  if (/(transport|logistiqu|déménag|demenag|livraison|fret|taxi)/.test(t))
    return "TRANSPORT";
  if (/(formation|école|ecole|éducation|education|cours|auto-?école|auto-?ecole|coaching)/.test(t))
    return "FORMATION";
  if (/(touris|camping|gîte|gite|chambre d'hôte|location vacance|agence de voyage)/.test(t))
    return "TOURISME";
  if (/(événement|evenement|event|communication|marketing|agence de com|publicit)/.test(t))
    return "EVENEMENTIEL";
  if (/(agricol|agricultur|viticol|viticultur|vigneron|domaine viticole|maraîch|maraich)/.test(t))
    return "AGRICULTURE";
  if (/(associat|fondation|\bong\b|commune|administration|public)/.test(t))
    return "ASSOCIATION";
  if (/(commerce de détail|commerce de detail|magasin|boutique|détaillant|detaillant)/.test(t))
    return "COMMERCE_DETAIL";
  if (/(services aux entreprises|conseil|consulting|prestataire)/.test(t))
    return "SERVICES_ENTREPRISE";
  if (/(pme|société|societe|sàrl|sarl|\bsa\b|entreprise|commerce de gros|grossiste)/.test(t))
    return "PME_B2B";
  return null;
}
