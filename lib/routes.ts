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

export type RouteGroup = "operationnel" | "vente" | "finance" | "config";

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
  /** Raccourci clavier `g x` après `g` initial (single letter ou string). */
  kbd?: string;
}

export const ROUTE_GROUPS: { id: RouteGroup; label: string }[] = [
  { id: "operationnel", label: "Opérationnel" },
  { id: "vente", label: "Vente" },
  { id: "finance", label: "Finance" },
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
    href: "/emails",
    label: "Emails",
    icon: "Mail",
    group: "operationnel",
    etape: 26,
  },

  // ---- VENTE ----
  {
    href: "/prospects",
    label: "Prospects",
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
  {
    href: "/signatures",
    label: "Signatures",
    icon: "PenTool",
    group: "vente",
    etape: 25,
  },
  {
    href: "/renouvellements",
    label: "Renouvellements",
    icon: "Repeat",
    group: "vente",
    etape: 23,
  },

  // ---- FINANCE ----
  {
    href: "/paiements",
    label: "Paiements clients",
    icon: "Banknote",
    group: "finance",
    etape: 11,
    adminOnly: true, // Sophie voit l'info via la fiche client uniquement
  },
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
    label: "Factures Sophie",
    commercialLabel: "Mes salaires",
    icon: "Receipt",
    group: "finance",
    etape: 14,
  },
  {
    href: "/previsions",
    label: "Prévisions",
    icon: "TrendingUp",
    group: "finance",
    etape: 22,
    adminOnly: true, // Sophie n'en a pas besoin (vue Arthur uniquement)
  },
  {
    href: "/stats",
    label: "Statistiques",
    icon: "BarChart3",
    group: "finance",
    etape: 21,
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
];

/** Filtre les routes accessibles pour un rôle donné. */
export function getAccessibleRoutes(role: Role): RouteDef[] {
  if (role === "ADMIN") return ROUTES;
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
