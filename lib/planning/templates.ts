/**
 * Règles de base du planning de production, définies avec Arthur (oct. 2026),
 * service par service. Chaque règle est ensuite MODIFIABLE par client (rythme,
 * fenêtre, durée, activation) depuis le planning.
 *
 * Dédoublonnage entre services d'un même client :
 *  - un seul article par mois : client avec SEO → l'article SEO remplace celui
 *    du site ; le « point SEO » du site disparaît aussi au profit du SEO ;
 *  - Google Business : intégré au calendrier éditorial RS ; un client SEO SANS
 *    réseaux sociaux a une tâche « post Google Business » mensuelle ;
 *  - ADS : refacturation des frais pub seulement si ACLR les avance.
 */
import type { PlanningFrequence } from "@prisma/client";

export type ServiceCode =
  | "SITE"
  | "RS"
  | "SEO"
  | "ADS"
  | "CMO"
  | "STRATEGIE"
  | "LICENCE"
  | "PACK"
  | "A_CONFIGURER"
  | "AUTRE";

export const SERVICES: Record<
  ServiceCode,
  { label: string; badge: string; ajoutable: boolean }
> = {
  SITE: { label: "Site web", badge: "bg-blue-100 text-blue-800", ajoutable: true },
  RS: { label: "Réseaux sociaux", badge: "bg-pink-100 text-pink-800", ajoutable: true },
  SEO: { label: "Référencement", badge: "bg-teal-100 text-teal-800", ajoutable: true },
  ADS: { label: "Publicité Google / Meta", badge: "bg-orange-100 text-orange-800", ajoutable: true },
  CMO: { label: "CMO", badge: "bg-indigo-100 text-indigo-800", ajoutable: true },
  STRATEGIE: { label: "Stratégie", badge: "bg-amber-100 text-amber-800", ajoutable: true },
  LICENCE: { label: "Licence", badge: "bg-slate-100 text-slate-700", ajoutable: true },
  PACK: { label: "Pack (à préciser)", badge: "bg-purple-100 text-purple-800", ajoutable: false },
  A_CONFIGURER: { label: "Services à préciser", badge: "bg-slate-100 text-slate-500", ajoutable: false },
  AUTRE: { label: "Autre", badge: "bg-slate-100 text-slate-700", ajoutable: true },
};

/** Catégorie produit (catalogue) → service du planning. */
export function serviceFromCategorie(categorie: string): ServiceCode | null {
  switch (categorie) {
    case "SITE":
    case "RS":
    case "SEO":
    case "ADS":
    case "CMO":
      return categorie;
    case "METRICOOL":
    case "CRM":
      return "LICENCE";
    case "PACK":
      return "PACK";
    default:
      return null;
  }
}

export interface RegleTemplate {
  code: string;
  titre: string;
  /** Libellé court affiché dans les cases du calendrier. */
  court: string;
  frequence: PlanningFrequence;
  /** Date imposée (cycle RS) : jamais déplacée par l'étalement. */
  fixe?: boolean;
  /** Jour imposé (règles fixes). */
  jour?: number;
  fenetreDebut: number;
  fenetreFin: number;
  dureeMin: number;
  /** Statut de départ des tâches générées (ex. contenu client = attente client). */
  statutInitial?: "A_FAIRE" | "ATTENTE_CLIENT";
}

export const TEMPLATES: Record<string, RegleTemplate[]> = {
  SITE: [
    { code: "SITE_ARTICLE", titre: "Rédiger et publier l'article du mois", court: "Article", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 22, dureeMin: 15 },
    { code: "SITE_POINT_SEO", titre: "Point SEO mensuel (contrôle du site + mises à jour techniques)", court: "Point SEO", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 22, dureeMin: 60 },
  ],
  SEO: [
    { code: "SEO_ARTICLE", titre: "Rédaction SEO : article / page du mois", court: "Article SEO", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 22, dureeMin: 15 },
    { code: "SEO_POINT", titre: "Point SEO mensuel (positions, optimisations, contrôle, mises à jour) - rapport interne", court: "Point SEO", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 22, dureeMin: 60 },
    { code: "SEO_RAPPORT", titre: "Envoyer le rapport SEO au client", court: "Rapport client", frequence: "BIMESTRIELLE", fenetreDebut: 15, fenetreFin: 22, dureeMin: 30 },
    { code: "SEO_GBP", titre: "Post Google Business", court: "Post Google", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 22, dureeMin: 15 },
  ],
  RS: [
    { code: "RS_PROG_S3", titre: "Programmer la semaine 3 du mois", court: "Prog. S3", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 7, dureeMin: 60 },
    { code: "RS_STATS", titre: "Statistiques Metricool (réseaux, site, Google) + ajuster la stratégie", court: "Stats", frequence: "MENSUELLE", fenetreDebut: 10, fenetreFin: 12, dureeMin: 30 },
    { code: "RS_PROG_S4", titre: "Programmer la semaine 4 du mois", court: "Prog. S4", frequence: "MENSUELLE", fenetreDebut: 8, fenetreFin: 14, dureeMin: 60 },
    { code: "RS_CALENDRIER", titre: "Envoyer le calendrier éditorial du mois suivant (scripts + posts, Google Business inclus)", court: "Calendrier", frequence: "MENSUELLE", fixe: true, jour: 15, fenetreDebut: 13, fenetreFin: 15, dureeMin: 60 },
    { code: "RS_CONTENU", titre: "Récupérer le contenu client du mois suivant", court: "Contenu client", frequence: "MENSUELLE", fixe: true, jour: 25, fenetreDebut: 23, fenetreFin: 25, dureeMin: 15, statutInitial: "ATTENTE_CLIENT" },
    { code: "RS_PROG_S12", titre: "Programmer les semaines 1 et 2 du mois suivant", court: "Prog. S1-S2", frequence: "MENSUELLE", fenetreDebut: 25, fenetreFin: 31, dureeMin: 120 },
  ],
  ADS: [
    { code: "ADS_OPTIM", titre: "Optimisation des campagnes", court: "Optimisation", frequence: "BIMENSUELLE", fenetreDebut: 1, fenetreFin: 28, dureeMin: 30 },
    { code: "ADS_RAPPORT", titre: "Télécharger le rapport de performance du mois écoulé", court: "Rapport perf.", frequence: "MENSUELLE", fenetreDebut: 1, fenetreFin: 8, dureeMin: 30 },
    { code: "ADS_REFAC", titre: "Refacturer les frais pub du mois écoulé (rapport joint)", court: "Refacturation", frequence: "MENSUELLE", fenetreDebut: 3, fenetreFin: 10, dureeMin: 30 },
  ],
  CMO: [
    { code: "CMO_POINT", titre: "Point mensuel CMO avec le client", court: "Point CMO", frequence: "MENSUELLE", fenetreDebut: 12, fenetreFin: 20, dureeMin: 60 },
  ],
  STRATEGIE: [
    { code: "STRAT_LIVRAISON", titre: "Livrer la stratégie", court: "Stratégie", frequence: "PONCTUELLE", fenetreDebut: 1, fenetreFin: 28, dureeMin: 120 },
    { code: "STRAT_REVUE", titre: "Revue de la stratégie", court: "Revue strat.", frequence: "TRIMESTRIELLE", fenetreDebut: 1, fenetreFin: 20, dureeMin: 60 },
  ],
  LICENCE: [
    { code: "LICENCE_RENOUV", titre: "Renouvellement de la licence", court: "Licence", frequence: "ANNUELLE", fenetreDebut: 1, fenetreFin: 10, dureeMin: 10 },
  ],
};

const COURT_BY_CODE = new Map(
  Object.values(TEMPLATES)
    .flat()
    .map((t) => [t.code, t.court]),
);

/** Libellé court d'une tâche dans une case du calendrier. */
export function libelleCourt(code: string | null | undefined, titre: string): string {
  if (code && COURT_BY_CODE.has(code)) return COURT_BY_CODE.get(code)!;
  return titre.length > 18 ? `${titre.slice(0, 17)}…` : titre;
}

/**
 * Codes de règles à DÉSACTIVER pour un client selon l'ensemble de ses services
 * actifs (un seul article / point SEO ; Google Business ; refacturation ADS).
 */
export function codesDesactives(
  services: Set<string>,
  opts: { fraisPubAvances: boolean },
): Set<string> {
  const off = new Set<string>();
  if (services.has("SEO")) {
    off.add("SITE_ARTICLE");
    off.add("SITE_POINT_SEO");
  }
  if (services.has("RS")) off.add("SEO_GBP");
  if (!opts.fraisPubAvances) off.add("ADS_REFAC");
  return off;
}
