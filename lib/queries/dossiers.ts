import { prisma } from "@/lib/db";
import {
  DOSSIER_STATUTS_PAR_PERSONNE,
  dossierColumnKey,
  estArchive,
} from "@/lib/dossiers";

import type { DossierStatut, DossierPriorite, Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

export interface DossierForKanban {
  id: string;
  titre: string;
  statut: DossierStatut;
  priorite: DossierPriorite;
  echeance: Date | null;
  updatedAt: Date;
  assigneA: { id: string; name: string };
  prospect: { id: string; raisonSociale: string } | null;
  nbUpdates: number;
  nbDocuments: number;
  /** Terminée depuis plus de 7 jours — hors kanban par défaut. */
  archive: boolean;
}

export interface DossierColumn {
  /** Identifiant droppable — voir `dossierColumnKey`. */
  key: string;
  statut: DossierStatut;
  /** Collaborateur de la colonne ; null pour « Terminé » (colonne commune). */
  assigneAId: string | null;
  /** Prénom affiché en tête de colonne ("Arthur"). Vide pour « Terminé ». */
  assigneNom: string;
  dossiers: DossierForKanban[];
}

export interface DossiersBoardData {
  columns: DossierColumn[];
  total: number;
  /** Nombre de tâches archivées (terminées depuis > 7 jours). */
  nbArchivees: number;
}

/**
 * Charge le kanban des dossiers.
 *
 * VUE ÉQUIPE PARTAGÉE (demande Arthur, 22.07.2026) : tout le monde voit le
 * MÊME tableau — toutes les colonnes (Arthur, Sophie…) et toutes les tâches,
 * pas seulement les siennes. La gestion de projets se pilote en commun.
 *
 * ⚠️ La lecture est ouverte, PAS l'écriture : les garde-fous d'action restent
 * en place (`assertCanAccessDossier`, réassignation réservée à l'admin). Une
 * commerciale voit donc tout, gère ses propres tâches, mais ne peut ni modifier
 * ni réassigner celles des autres.
 *
 * Les colonnes sont éclatées PAR COLLABORATEUR (« Arthur - à faire »,
 * « Sophie - à vérifier »…) puis une colonne « Terminé » commune.
 *
 * `assigneAId` (optionnel) : filtre admin sur un collaborateur précis.
 * `avecArchives` : inclut les tâches terminées depuis plus de 7 jours, qui
 * sortent du kanban par défaut (cf. `estArchive`).
 */
export async function getDossiersBoard(
  user: SessionUser,
  assigneAId?: string,
  avecArchives = false,
): Promise<DossiersBoardData> {
  const where: Prisma.DossierWhereInput = {};

  // Filtre optionnel sur un collaborateur (réservé à l'admin ; sans effet sinon).
  if (user.role === "ADMIN" && assigneAId) {
    where.assigneAId = assigneAId;
  }

  // Colonnes affichées : tous les collaborateurs actifs, pour tout le monde.
  // L'admin d'abord (Arthur), puis les commerciales par ordre alphabétique.
  const collaborateurs = await prisma.user.findMany({
    where: { isActive: true, ...(assigneAId ? { id: assigneAId } : {}) },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const toutes = await prisma.dossier.findMany({
    where,
    select: {
      id: true,
      titre: true,
      statut: true,
      priorite: true,
      echeance: true,
      updatedAt: true,
      termineLe: true,
      assigneA: { select: { id: true, name: true } },
      prospect: { select: { id: true, raisonSociale: true } },
      _count: { select: { updates: true, attachments: true } },
    },
    orderBy: [{ priorite: "desc" }, { updatedAt: "desc" }],
  });

  // Les tâches terminées depuis > 7 jours sortent du kanban (elles restent
  // consultables sur la fiche client et via « Voir les archivées »). Le filtre
  // est fait ici et non en SQL : la règle vit dans un seul helper partagé avec
  // la fiche client, plutôt que dupliquée en date arithmétique Prisma.
  const nbArchivees = toutes.filter((d) =>
    estArchive(d.statut, d.termineLe, d.updatedAt),
  ).length;
  const dossiers = avecArchives
    ? toutes
    : toutes.filter((d) => !estArchive(d.statut, d.termineLe, d.updatedAt));

  // Colonnes : (chaque collaborateur × ses statuts) puis « Terminé ».
  //
  // L'ADMIN n'a PAS de colonne « En cours » (demande Arthur, 22.07.2026) : il
  // pilote et attribue, l'exécution se suit chez les commerciales. Un projet
  // qui serait malgré tout passé en EN_COURS sur son nom retombe dans son
  // « À faire » via le repli plus bas — aucune carte ne disparaît.
  const columns: DossierColumn[] = [];
  for (const c of collaborateurs) {
    const statuts =
      c.role === "ADMIN"
        ? (["A_FAIRE"] as typeof DOSSIER_STATUTS_PAR_PERSONNE)
        : DOSSIER_STATUTS_PAR_PERSONNE;
    for (const statut of statuts) {
      columns.push({
        key: dossierColumnKey(statut, c.id),
        statut,
        assigneAId: c.id,
        // Prénom seul : les en-têtes de colonne sont étroits.
        assigneNom: c.name.split(" ")[0]!,
        dossiers: [],
      });
    }
  }
  columns.push({
    key: dossierColumnKey("TERMINE", null),
    statut: "TERMINE",
    assigneAId: null,
    assigneNom: "",
    dossiers: [],
  });

  const byKey = new Map(columns.map((c) => [c.key, c]));
  for (const d of dossiers) {
    const card: DossierForKanban = {
      id: d.id,
      titre: d.titre,
      statut: d.statut,
      priorite: d.priorite,
      echeance: d.echeance,
      updatedAt: d.updatedAt,
      assigneA: d.assigneA,
      prospect: d.prospect,
      nbUpdates: d._count.updates,
      nbDocuments: d._count.attachments,
      archive: estArchive(d.statut, d.termineLe, d.updatedAt),
    };
    // « Terminé » est commun ; les autres statuts vont dans la colonne du
    // collaborateur. Une carte dont la colonne n'existe pas (assignée à un
    // collaborateur désactivé, ou statut EN_ATTENTE résiduel) est rattachée au
    // « à faire » de son assigné pour ne JAMAIS disparaître de l'écran.
    const key =
      d.statut === "TERMINE"
        ? dossierColumnKey("TERMINE", null)
        : dossierColumnKey(d.statut, d.assigneA.id);
    (byKey.get(key) ?? byKey.get(dossierColumnKey("A_FAIRE", d.assigneA.id)))
      ?.dossiers.push(card);
  }

  return { columns, total: dossiers.length, nbArchivees };
}

export interface DossierPourClient {
  id: string;
  titre: string;
  statut: DossierStatut;
  priorite: DossierPriorite;
  echeance: Date | null;
  termineLe: Date | null;
  updatedAt: Date;
  assigneA: { name: string };
  nbUpdates: number;
  nbDocuments: number;
  /** Terminée depuis > 7 jours : affichée comme historique. */
  archive: boolean;
}

/**
 * Tâches rattachées à un client, pour sa fiche.
 *
 * Renvoie TOUT, archivées comprises : la fiche client est justement l'endroit
 * où l'historique reste consultable une fois la tâche sortie du kanban.
 *
 * Vue équipe partagée (comme le kanban) : toutes les tâches du client, pas
 * seulement celles du collaborateur. L'accès à la fiche client elle-même est
 * déjà filtré en amont (getProspectById), donc pas de re-scoping ici.
 * `user` conservé pour l'auth d'appel.
 */
export async function getDossiersForProspect(
  _user: SessionUser,
  prospectId: string,
): Promise<DossierPourClient[]> {
  const where: Prisma.DossierWhereInput = { prospectId };

  const rows = await prisma.dossier.findMany({
    where,
    select: {
      id: true,
      titre: true,
      statut: true,
      priorite: true,
      echeance: true,
      termineLe: true,
      updatedAt: true,
      assigneA: { select: { name: true } },
      _count: { select: { updates: true, attachments: true } },
    },
    // Les tâches vivantes d'abord, puis l'historique du plus récent au plus ancien.
    orderBy: [{ statut: "asc" }, { updatedAt: "desc" }],
  });

  return rows.map((d) => ({
    id: d.id,
    titre: d.titre,
    statut: d.statut,
    priorite: d.priorite,
    echeance: d.echeance,
    termineLe: d.termineLe,
    updatedAt: d.updatedAt,
    assigneA: d.assigneA,
    nbUpdates: d._count.updates,
    nbDocuments: d._count.attachments,
    archive: estArchive(d.statut, d.termineLe, d.updatedAt),
  }));
}

/**
 * Détail complet d'un dossier (pour le panneau latéral).
 *
 * Vue équipe partagée : tout collaborateur peut OUVRIR n'importe quelle tâche
 * du tableau (sinon cliquer une carte d'un collègue n'afficherait rien). Les
 * actions d'écriture restent gardées séparément (assertCanAccessDossier).
 * `user` est conservé en signature pour l'auth d'appel et un éventuel
 * durcissement ultérieur.
 */
export async function getDossierById(_user: SessionUser, id: string) {
  const d = await prisma.dossier.findUnique({
    where: { id },
    select: {
      id: true,
      titre: true,
      description: true,
      statut: true,
      priorite: true,
      echeance: true,
      createdAt: true,
      termineLe: true,
      assigneAId: true,
      creeParId: true,
      assigneA: { select: { id: true, name: true } },
      creePar: { select: { id: true, name: true } },
      prospect: { select: { id: true, raisonSociale: true } },
      updates: {
        select: {
          id: true,
          contenu: true,
          createdAt: true,
          auteur: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        select: {
          id: true,
          nom: true,
          taille: true,
          mimeType: true,
          url: true,
          createdAt: true,
          ajoutePar: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return d;
}

