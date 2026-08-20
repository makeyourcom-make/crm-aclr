/**
 * Catalogue des routes du CRM.
 *
 * Source unique de vérité pour la sidebar, la topbar et la recherche
 * globale Cmd+K. Ajouter une page = ajouter une ligne ici.
 *
 * Convention :
 *   - `etape` : numéro de l'étape (cf docs/Prompt_…) qui implémente
 *     réellement la page. Tant qu'on n'a pas atteint cette étape, la
 *     page affiche un stub "En construction".
 *   - `adminOnly` : si true, masqué pour les commerciaux.
 *   - `group` : section de la sidebar.
 *   - `kbd` : raccourci clavier (séquence) pour navigation rapide.
 */
import type { Role } from "@prisma/client";

export type RouteGroup =
  | "operationnel"
  | "vente"
  | "finance"
  | "admin"
  | "config";

export interface RouteDef {
  href: string;
  label: string;
  /** Libellé alternatif quand l'utilisateur est COMMERCIAL (ex. "Mes salaires"). */
  commercialLabel?: string;
  /** Nom de l'icône Lucide (string pour éviter d'importer Lucide ici). */
  icon: string;
  group: RouteGroup;
  /** Étape (1-30) qui implémente la page — sert au stub d'attente. */
  etape: number;
  adminOnly?: boolean;
  /** Si true, masqué pour les ADMIN (page strictement terrain commerciale). */
  commercialOnly?: boolean;
  /** Raccourci clavier `g x` après `g` initial (single letter ou string). */
  kbd?: string;
}

export const ROUTE_GROUPS: { id: RouteGroup; label: string }[] = [
  { id: "operationnel", label: "Opérationnel" },
  { id: "vente", label: "Vente" },
  { id: "finance", label: "Finance" },
  { id: "admin", label: "Administration" },
  { id: "config", label: "Configuration" },
];

export const ROUTES: RouteDef[] = [
  // ---- OPÉRATIONNEL ----
  {
    href: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    group: "operationnel",
    etape: 16,
    kbd: "d",
  },
  {
    href: "/aujourd-hui",
    label: "Aujourd'hui",
    icon: "Sun",
    group: "operationnel",
    etape: 7,
    kbd: "a",
    // Écran terrain (tâches du jour + objectifs perso) : utile uniquement
    // pour la commerciale. Arthur a son dashboard de pilotage.
    commercialOnly: true,
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: "Calendar",
    group: "operationnel",
    etape: 19,
  },
  {
    href: "/activites",
    label: "Activités",
    icon: "ListChecks",
    group: "operationnel",
    etape: 6,
  },
  {
    href: "/dossiers",
    label: "Gestion des projets",
    icon: "ClipboardList",
    group: "operationnel",
    etape: 99,
  },
  {
    href: "/emails",
    label: "Emails",
    icon: "Mail",
    group: "operationnel",
    etape: 26,
  },

  // ---- VENTE ----
  {
    href: "/prospects",
    label: "Entreprises",
    icon: "Users",
    group: "vente",
    etape: 5,
    kbd: "p",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: "GitBranch",
    group: "vente",
    etape: 8,
  },
  {
    href: "/contrats",
    label: "Contrats",
    icon: "FileText",
    group: "vente",
    etape: 10,
  },

  // ---- FINANCE ----
  // /paiements a été retiré du menu : doublon avec /factures-clients.
  // Le bouton "Marquer payée" sur une facture crée déjà automatiquement
  // le Payment ENCAISSE en arrière-plan (déclencheur de commission Sophie).
  // Le modèle Payment reste en DB pour la cascade comptable, mais l'admin
  // pilote tout depuis /factures-clients.
  {
    href: "/factures-clients",
    label: "Factures clients",
    icon: "FileSpreadsheet",
    group: "finance",
    etape: 24,
    adminOnly: true, // Sophie voit l'info via la fiche client uniquement
  },
  {
    href: "/commissions",
    label: "Commissions",
    icon: "Percent",
    group: "finance",
    etape: 13,
  },
  {
    href: "/factures",
    label: "Salaires commerciales",
    commercialLabel: "Mes salaires",
    icon: "Receipt",
    group: "finance",
    etape: 14,
  },
  // /previsions retiré du menu : info redondante avec /stats et le calendrier
  // commissions. La page existe encore mais n'est plus exposée nulle part.
  {
    href: "/stats",
    label: "Statistiques",
    icon: "BarChart3",
    group: "finance",
    etape: 21,
  },
  {
    href: "/rentabilite",
    label: "Rentabilité clients",
    icon: "TrendingUp",
    group: "finance",
    etape: 32,
    adminOnly: true,
  },
  {
    href: "/objectifs",
    label: "Objectifs",
    icon: "Target",
    group: "finance",
    etape: 20,
    adminOnly: true, // Arthur fixe les objectifs ; Sophie voit la progression
                     // dans le bloc 'Objectifs du mois' du dashboard
  },

  // ---- ADMINISTRATION (RH, charges, comptabilité) ----
  {
    href: "/comptabilite",
    label: "Comptabilité",
    icon: "Calculator",
    group: "admin",
    etape: 33,
    adminOnly: true,
  },
  {
    href: "/rh",
    label: "Collaborateurs",
    icon: "Users",
    group: "admin",
    etape: 31,
    adminOnly: true,
  },
  {
    href: "/charges",
    label: "Charges",
    icon: "Receipt",
    group: "admin",
    etape: 32,
    adminOnly: true,
  },
  // NB : les charges récurrentes (modèles) sont désormais gérées DEPUIS la page
  // Charges (bouton « Modèles récurrents »), plus d'entrée de nav dédiée.

  // ---- CONFIGURATION ----
  {
    href: "/catalogue",
    label: "Catalogue produits",
    icon: "Package",
    group: "config",
    etape: 9,
    adminOnly: true,
  },
  {
    href: "/templates-emails",
    label: "Templates emails",
    icon: "MailPlus",
    group: "config",
    etape: 17,
    adminOnly: true,
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: "Settings",
    group: "config",
    etape: 18,
    adminOnly: true,
  },
  {
    href: "/audit",
    label: "Journal d'audit",
    icon: "Eye",
    group: "config",
    etape: 99,
    adminOnly: true,
  },
];

/** Filtre les routes accessibles pour un rôle donné. */
export function getAccessibleRoutes(role: Role): RouteDef[] {
  if (role === "ADMIN") return ROUTES.filter((r) => !r.commercialOnly);
  return ROUTES.filter((r) => !r.adminOnly);
}

/** Cherche une route exacte ou parente (pour le active state sidebar). */
export function findRoute(pathname: string): RouteDef | undefined {
  // Exact match d'abord
  const exact = ROUTES.find((r) => r.href === pathname);
  if (exact) return exact;
  // Sinon préfixe le plus long
  return ROUTES.filter(
    (r) => r.href !== "/" && pathname.startsWith(r.href),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
