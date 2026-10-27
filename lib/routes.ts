/**
 * Catalogue des routes du CRM.
 *
 * Source unique de vérité pour la sidebar, la topbar et la recherche
 * globale Cmd+K. Ajouter une page = ajouter une ligne ici.
 *
 * Groupes MYC Arena : Jouer · Vendre · Livrer · Gagner, puis pour l'admin
 * Finance · Administration · Configuration.
 *
 * Convention :
 *   - `etape` : numéro de l'étape (cf docs/Prompt_…) qui implémente
 *     réellement la page. Tant qu'on n'a pas atteint cette étape, la
 *     page affiche un stub "En construction".
 *   - `adminOnly` : si true, masqué pour les commerciaux.
 *   - `commercialOnly` : si true, masqué pour les admins.
 *   - `group` : section de la sidebar.
 *   - `kbd` : raccourci clavier (séquence) pour navigation rapide.
 */
import type { Role } from "@prisma/client";

export type RouteGroup =
  | "jouer"
  | "vendre"
  | "livrer"
  | "gagner"
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
  /** Étape (1-30) qui implémente la page : sert au stub d'attente. */
  etape: number;
  adminOnly?: boolean;
  /** Si true, masqué pour les ADMIN (page strictement terrain commerciale). */
  commercialOnly?: boolean;
  /** Préfixe d'URL qui active l'entrée du menu (si différent de `href`). */
  matchPrefix?: string;
  /** Raccourci clavier `g x` après `g` initial (single letter ou string). */
  kbd?: string;
}

export const ROUTE_GROUPS: { id: RouteGroup; label: string }[] = [
  { id: "jouer", label: "Jouer" },
  { id: "vendre", label: "Vendre" },
  { id: "livrer", label: "Livrer" },
  { id: "gagner", label: "Gagner" },
  // Groupe réservé aux pages financières qui ne relèvent ni de Livrer ni de
  // Gagner. Vide aujourd'hui (Factures clients → Livrer ; Commissions,
  // Salaires, Statistiques, Rentabilité, Objectifs → Gagner) : la sidebar
  // n'affiche pas un groupe sans entrée.
  { id: "finance", label: "Finance" },
  { id: "admin", label: "Administration" },
  { id: "config", label: "Configuration" },
];

export const ROUTES: RouteDef[] = [
  // ---- JOUER ----
  {
    href: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    group: "jouer",
    etape: 16,
    kbd: "d",
  },
  {
    href: "/aujourd-hui",
    label: "Ma journée",
    icon: "Target",
    group: "jouer",
    etape: 7,
    kbd: "a",
    // Écran terrain (tâches du jour + objectifs perso) : utile uniquement
    // pour la commerciale. Arthur a son dashboard de pilotage.
    commercialOnly: true,
  },
  {
    // Mode phoning gamifié (combo, file d'appels). Page créée en phase B.
    href: "/phoning",
    label: "Phoning",
    icon: "Phone",
    group: "jouer",
    etape: 99,
  },
  {
    href: "/activites",
    label: "Activités",
    icon: "ListChecks",
    group: "jouer",
    etape: 6,
  },

  // ---- VENDRE ----
  {
    href: "/prospects",
    label: "Entreprises",
    icon: "Building2",
    group: "vendre",
    etape: 5,
    kbd: "p",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: "SquareKanban",
    group: "vendre",
    etape: 8,
  },
  {
    href: "/emails",
    label: "Emails",
    icon: "Mail",
    group: "vendre",
    etape: 26,
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: "Calendar",
    group: "vendre",
    etape: 19,
  },

  // ---- LIVRER ----
  {
    // S'ouvre sur le Planning ; reste actif sur tout /dossiers (kanban, document).
    href: "/dossiers/planning",
    matchPrefix: "/dossiers",
    label: "Gestion des projets",
    icon: "FolderKanban",
    group: "livrer",
    etape: 99,
  },
  {
    href: "/contrats",
    label: "Contrats",
    icon: "FileText",
    group: "livrer",
    etape: 10,
  },
  // /paiements a été retiré du menu : doublon avec /factures-clients.
  // Le bouton "Marquer payée" sur une facture crée déjà automatiquement
  // le Payment ENCAISSE en arrière-plan (déclencheur de commission).
  // Le modèle Payment reste en DB pour la cascade comptable, mais l'admin
  // pilote tout depuis /factures-clients.
  {
    href: "/factures-clients",
    label: "Factures clients",
    icon: "FileSpreadsheet",
    group: "livrer",
    etape: 24,
    adminOnly: true, // la commerciale voit l'info via la fiche client uniquement
  },

  // ---- GAGNER ----
  {
    href: "/objectifs",
    label: "Objectifs",
    icon: "Trophy",
    group: "gagner",
    etape: 20,
    adminOnly: true, // Arthur fixe les objectifs ; la commerciale voit la
                     // progression dans le bloc 'Objectifs du mois' du dashboard
  },
  {
    href: "/commissions",
    label: "Commissions",
    icon: "Percent",
    group: "gagner",
    etape: 13,
  },
  {
    href: "/factures",
    label: "Salaires commerciales",
    commercialLabel: "Mes salaires",
    icon: "Wallet",
    group: "gagner",
    etape: 14,
  },
  // /previsions retiré du menu : info redondante avec /stats et le calendrier
  // commissions. La page existe encore mais n'est plus exposée nulle part.
  {
    href: "/stats",
    label: "Statistiques",
    icon: "BarChart3",
    group: "gagner",
    etape: 21,
  },
  {
    href: "/rentabilite",
    label: "Rentabilité clients",
    icon: "TrendingUp",
    group: "gagner",
    etape: 32,
    adminOnly: true,
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
    href: "/documents",
    label: "Documents",
    icon: "FolderOpen",
    group: "config",
    etape: 1,
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
  const prefix = (r: RouteDef) => r.matchPrefix ?? r.href;
  return ROUTES.filter(
    (r) => r.href !== "/" && pathname.startsWith(prefix(r)),
  ).sort((a, b) => prefix(b).length - prefix(a).length)[0];
}
