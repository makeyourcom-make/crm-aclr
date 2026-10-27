/**
 * Requêtes de lecture pour le module Deals (Pipeline).
 *
 * Pipeline : le Kanban reçoit des objets SIMPLES (nombres, dates, chaînes)
 * prêts à passer à un composant client, enrichis de la vraie activité du
 * prospect (dernière action faite, prochaine action planifiée) pour afficher
 * l'âge du deal, les jours sans action et la prochaine étape sur chaque carte.
 */
import {
  Prisma,
  type ActivityType,
  type DealStage,
  type Role,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type { DealListParams } from "@/lib/schemas/deal";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const KANBAN_INCLUDE = {
  prospect: {
    select: {
      id: true,
      raisonSociale: true,
      secteur: true,
      ville: true,
      telephone: true,
      email: true,
    },
  },
  assigneA: { select: { id: true, name: true, role: true } },
  // Produits proposés : libellé de l'offre + parts one-shot et mensuelle
  // (montant réel affiché à la signature : « +X CHF / mois »).
  productsProposes: {
    select: { id: true, nom: true, prixOneShot: true, prixMensuel: true },
  },
  // On charge les contrats + signatures pour afficher le statut
  // "signé client - en attente validation admin" sur la carte.
  contracts: {
    select: {
      id: true,
      numero: true,
      // Statut du contrat : un contrat déjà exécutoire (ACTIF...) est compté
      // dans le CA signé du héros, pas dans « en attente de validation ».
      statut: true,
      signatures: {
        select: {
          id: true,
          signeParClient: true,
          signeParAclr: true,
          statut: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  },
} satisfies Prisma.DealInclude;

/** Deal brut tel que lu en base pour le Kanban. */
export type DealForKanban = Prisma.DealGetPayload<{
  include: typeof KANBAN_INCLUDE;
}>;

export type DealWithRelations = Prisma.DealGetPayload<{
  include: {
    prospect: {
      select: {
        id: true;
        raisonSociale: true;
        contactPrenom: true;
        contactNom: true;
        email: true;
        telephone: true;
        ville: true;
      };
    };
    assigneA: { select: { id: true; name: true } };
    productsProposes: { select: { id: true; nom: true; prixOneShot: true; prixMensuel: true } };
    // Contrats + signatures pour le panneau de détail : Arthur valide ici
    contracts: {
      select: {
        id: true;
        numero: true;
        signatures: {
          select: {
            id: true;
            signeParClient: true;
            signeParAclr: true;
            dateSignatureClient: true;
            dateSignatureAclr: true;
            statut: true;
            lienSignature: true;
            expireA: true;
          };
        };
      };
    };
  };
}>;

/** Prochaine action planifiée sur le prospect du deal. */
export interface PipelineNextAction {
  type: ActivityType;
  date: Date;
  sujet: string;
  /** Action planifiée dont l'heure est passée sans être faite. */
  overdue: boolean;
}

/**
 * Deal du Kanban, sérialisable (aucun Decimal) : passé tel quel au
 * composant client du pipeline.
 */
export interface PipelineDeal {
  id: string;
  titre: string;
  stage: DealStage;
  /** Montant prévu (valeur an 1 : one-shot + mensuel × 12). */
  montant: number;
  probabilite: number;
  createdAt: Date;
  updatedAt: Date;
  closeAttenduLe: Date | null;
  closeReelLe: Date | null;
  raisonPerte: string | null;
  prospect: {
    id: string;
    raisonSociale: string;
    ville: string | null;
    telephone: string | null;
    email: string | null;
  };
  assigneA: { id: string; name: string; role: Role };
  products: Array<{ id: string; nom: string; oneShot: number; mensuel: number }>;
  /** Premier contrat lié (le deal sort du pipeline à la contre-signature). */
  contract: {
    id: string;
    numero: string;
    /** Contrat réellement signé (ACTIF / SUSPENDU / RESILIE / EXPIRE). */
    executed: boolean;
  } | null;
  /** Dernière signature du contrat lié. */
  signature: { signeParClient: boolean; signeParAclr: boolean } | null;
  /**
   * Dernière action : activité faite sur le prospect (appel, email, RDV,
   * note...) ou dernière modification du deal (changement d'étape...).
   */
  lastActionAt: Date;
  nextAction: PipelineNextAction | null;
}

export interface PipelineColumn {
  stage: DealStage;
  deals: PipelineDeal[];
  totalMontant: number;
  totalPondere: number; // somme(montantPrevu * probabilité / 100)
}

export interface PipelineData {
  columns: PipelineColumn[];
  grandTotal: number;
  grandTotalPondere: number;
}

// ---------------------------------------------------------------------------
// PIPELINE : tout en un
// ---------------------------------------------------------------------------

const STAGE_ORDER: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
  "SIGNE",
  "PERDU",
];

/** Début du mois courant (même découpe que le filtre Signé / Perdu). */
function monthBounds(now: Date) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  // Même borne de fin que le dashboard (dernier jour du mois, 23:59:59).
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { startOfMonth, startOfNextMonth, endOfMonth };
}

export async function getPipeline(
  user: SessionUser,
  params: DealListParams = {},
): Promise<PipelineData> {
  const conditions: Prisma.DealWhereInput[] = [];

  // RLS : commercial = ses deals uniquement
  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  // Règle métier : un deal sort du pipeline uniquement quand l'admin a
  // contre-signé le contrat (= validation finale).
  //
  // Tant que la commerciale a créé le contrat mais que l'admin n'a pas encore
  // contre-signé, le deal reste visible dans la colonne SIGNE : c'est
  // sa liste "à faire valider".
  //
  // Concrètement :
  //   - Deal sans contrat → visible
  //   - Deal avec contrat dont au moins une signature n'est PAS contre-signée
  //     par ACLR (signeParAclr = false) → visible
  //   - Deal avec contrat dont toutes les signatures sont contre-signées
  //     (ou contrat sans signature mais admin a manuellement créé) → caché
  //
  // On exprime ça en Prisma : le deal sort du pipeline ssi il a au moins
  // un contrat dont au moins une signature a signeParAclr = true.
  conditions.push({
    contracts: {
      none: {
        signatures: { some: { signeParAclr: true } },
      },
    },
  });

  // Règle métier : les colonnes SIGNÉ et PERDU sont réinitialisées à 0 chaque
  // mois. On ne montre QUE les deals signés/perdus dont la date de close réel
  // tombe dans le mois courant : le pipeline reflète la performance du mois.
  // Les affaires signées/perdues des mois précédents disparaissent de la vue
  // (mais restent en base pour l'historique, les stats et les contrats).
  // Les étapes actives (Découverte / Proposition / Négociation) ne sont jamais
  // filtrées par date : elles persistent tant que l'affaire vit.
  const now = new Date();
  const { startOfMonth } = monthBounds(now);
  conditions.push({
    OR: [
      { stage: { notIn: ["SIGNE", "PERDU"] } },
      { stage: "SIGNE", closeReelLe: { gte: startOfMonth } },
      { stage: "PERDU", closeReelLe: { gte: startOfMonth } },
    ],
  });

  if (params.assigneAId) {
    conditions.push({ assigneAId: params.assigneAId });
  }

  if (params.secteur) {
    conditions.push({
      prospect: { secteur: params.secteur as never },
    });
  }

  if (params.q) {
    conditions.push({
      OR: [
        { titre: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
        {
          prospect: {
            raisonSociale: { contains: params.q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  const where: Prisma.DealWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const raw = await prisma.deal.findMany({
    where,
    include: KANBAN_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  });

  const activity = await loadProspectActivity(
    Array.from(new Set(raw.map((d) => d.prospectId))),
    now,
  );

  const deals = raw.map((d) => toPipelineDeal(d, activity));

  const columns: PipelineColumn[] = STAGE_ORDER.map((stage) => {
    const dealsOfStage = deals.filter((d) => d.stage === stage);
    const totalMontant = dealsOfStage.reduce((sum, d) => sum + d.montant, 0);
    const totalPondere = dealsOfStage.reduce(
      (sum, d) => sum + (d.montant * d.probabilite) / 100,
      0,
    );
    return { stage, deals: dealsOfStage, totalMontant, totalPondere };
  });

  const grandTotal = columns.reduce((s, c) => s + c.totalMontant, 0);
  const grandTotalPondere = columns.reduce((s, c) => s + c.totalPondere, 0);

  return { columns, grandTotal, grandTotalPondere };
}

interface ProspectActivity {
  lastDone: Map<string, Date>;
  next: Map<string, PipelineNextAction>;
}

/**
 * Activité réelle des prospects du pipeline :
 *  - dernière activité FAITE (ou appel EN_COURS) datée au plus tard maintenant
 *  - prochaine activité PLANIFIÉE : la première à venir, sinon la plus
 *    récente restée planifiée alors que son heure est passée (≤ 30 jours).
 */
async function loadProspectActivity(
  prospectIds: string[],
  now: Date,
): Promise<ProspectActivity> {
  const lastDone = new Map<string, Date>();
  const next = new Map<string, PipelineNextAction>();
  if (prospectIds.length === 0) return { lastDone, next };

  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [doneRows, plannedRows] = await Promise.all([
    prisma.activity.groupBy({
      by: ["prospectId"],
      where: {
        prospectId: { in: prospectIds },
        statut: { in: ["FAIT", "EN_COURS"] },
        date: { lte: now },
      },
      _max: { date: true },
    }),
    prisma.activity.findMany({
      where: {
        prospectId: { in: prospectIds },
        statut: "PLANIFIE",
        date: { gte: since },
      },
      select: { prospectId: true, type: true, date: true, sujet: true },
      orderBy: { date: "asc" },
      take: 5000,
    }),
  ]);

  for (const r of doneRows) {
    if (r.prospectId && r._max.date) lastDone.set(r.prospectId, r._max.date);
  }

  const lastOverdue = new Map<string, PipelineNextAction>();
  for (const a of plannedRows) {
    if (!a.prospectId) continue;
    if (a.date.getTime() >= now.getTime()) {
      if (!next.has(a.prospectId)) {
        next.set(a.prospectId, {
          type: a.type,
          date: a.date,
          sujet: a.sujet,
          overdue: false,
        });
      }
    } else {
      // Trié par date croissante : la dernière vue est la plus récente.
      lastOverdue.set(a.prospectId, {
        type: a.type,
        date: a.date,
        sujet: a.sujet,
        overdue: true,
      });
    }
  }
  for (const [pid, a] of lastOverdue) {
    if (!next.has(pid)) next.set(pid, a);
  }

  return { lastDone, next };
}

function toPipelineDeal(d: DealForKanban, activity: ProspectActivity): PipelineDeal {
  const contract = d.contracts[0] ?? null;
  const sig = contract?.signatures[0] ?? null;
  const lastDone = activity.lastDone.get(d.prospectId);
  const lastActionAt =
    lastDone && lastDone.getTime() > d.updatedAt.getTime() ? lastDone : d.updatedAt;
  return {
    id: d.id,
    titre: d.titre,
    stage: d.stage,
    montant: Number(d.montantPrevu),
    probabilite: d.probabilite,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    closeAttenduLe: d.closeAttenduLe,
    closeReelLe: d.closeReelLe,
    raisonPerte: d.raisonPerte,
    prospect: {
      id: d.prospect.id,
      raisonSociale: d.prospect.raisonSociale,
      ville: d.prospect.ville,
      telephone: d.prospect.telephone,
      email: d.prospect.email,
    },
    assigneA: {
      id: d.assigneA.id,
      name: d.assigneA.name,
      role: d.assigneA.role,
    },
    products: d.productsProposes.map((p) => ({
      id: p.id,
      nom: p.nom,
      oneShot: p.prixOneShot ? Number(p.prixOneShot) : 0,
      mensuel: p.prixMensuel ? Number(p.prixMensuel) : 0,
    })),
    contract: contract
      ? {
          id: contract.id,
          numero: contract.numero,
          executed: (STATUTS_SIGNES as readonly string[]).includes(contract.statut),
        }
      : null,
    signature: sig
      ? { signeParClient: sig.signeParClient, signeParAclr: sig.signeParAclr }
      : null,
    lastActionAt,
    nextAction: activity.next.get(d.prospectId) ?? null,
  };
}

// ---------------------------------------------------------------------------
// CHIFFRES DU MOIS (en-tête du pipeline)
// ---------------------------------------------------------------------------

/** Statuts d'un contrat RÉELLEMENT signé (même définition que le dashboard). */
const STATUTS_SIGNES = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] as const;

export interface PipelineScoreboard {
  /** `team` : vue admin « Toute l'équipe » (somme des objectifs individuels). */
  scope: "user" | "team";
  /** Objectif MENSUEL actif (null si aucun objectif fixé ce mois). */
  objective: {
    caObjectif: number | null;
    nbSignaturesObjectif: number | null;
  } | null;
  /** CA signé ce mois : contrats validés, valeur TOTALE (one-shot + mensuel × durée). */
  caSigne: number;
  /** Part mensuelle (MRR) des contrats validés ce mois, en CHF / mois. */
  mrrSigne: number;
  /** Nombre de contrats validés ce mois. */
  nbSignes: number;
  /** Deals passés en Signé ce mois (taux de transformation). */
  dealsSignes: number;
  /** Deals passés en Perdu ce mois (taux de transformation). */
  dealsPerdus: number;
}

/**
 * Chiffres du mois pour l'en-tête du pipeline, sur le périmètre affiché :
 *  - commerciale : ses propres chiffres (RLS, le paramètre est ignoré) ;
 *  - admin + `assigneAId` : les chiffres de ce collaborateur ;
 *  - admin sans filtre : toute l'équipe.
 *
 * CA et nombre de signatures : mêmes définitions que la progression des
 * objectifs du dashboard (contrats ACTIF / SUSPENDU / RESILIE / EXPIRE datés
 * du mois, valeur totale).
 */
export async function getPipelineScoreboard(
  user: SessionUser,
  assigneAId?: string,
): Promise<PipelineScoreboard> {
  const now = new Date();
  const { startOfMonth, startOfNextMonth, endOfMonth } = monthBounds(now);
  const targetUserId = user.role !== "ADMIN" ? user.id : (assigneAId ?? null);
  const scope = targetUserId ? { assigneAId: targetUserId } : {};

  const [objectives, contracts, closed] = await Promise.all([
    prisma.objective.findMany({
      where: {
        periode: "MENSUEL",
        isActif: true,
        dateDebut: { lte: endOfMonth },
        dateFin: { gte: startOfMonth },
        ...(targetUserId ? { userId: targetUserId } : { user: { isActive: true } }),
      },
      select: { userId: true, caObjectif: true, nbSignaturesObjectif: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findMany({
      where: {
        ...scope,
        statut: { in: [...STATUTS_SIGNES] },
        dateSignature: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
    }),
    prisma.deal.groupBy({
      by: ["stage"],
      where: {
        ...scope,
        stage: { in: ["SIGNE", "PERDU"] },
        closeReelLe: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _count: { _all: true },
    }),
  ]);

  // Un seul objectif par personne (le plus récent, comme le dashboard).
  const perUser = new Map<string, (typeof objectives)[number]>();
  for (const o of objectives) {
    if (!perUser.has(o.userId)) perUser.set(o.userId, o);
  }
  let objective: PipelineScoreboard["objective"] = null;
  if (perUser.size > 0) {
    let ca: number | null = null;
    let nb: number | null = null;
    // Un objectif à 0 n'est pas un objectif (même règle que pilotage.ts) :
    // sinon le héros afficherait « Objectif atteint » et un anneau sur 0.
    for (const o of perUser.values()) {
      if (o.caObjectif != null && Number(o.caObjectif) > 0) {
        ca = (ca ?? 0) + Number(o.caObjectif);
      }
      if (o.nbSignaturesObjectif != null && o.nbSignaturesObjectif > 0) {
        nb = (nb ?? 0) + o.nbSignaturesObjectif;
      }
    }
    objective =
      ca != null || nb != null ? { caObjectif: ca, nbSignaturesObjectif: nb } : null;
  }

  const caSigne = contracts.reduce(
    (s, c) => s + Number(c.montantOneShot) + Number(c.montantMensuel) * c.dureeMois,
    0,
  );
  const count = (stage: DealStage) =>
    closed.find((c) => c.stage === stage)?._count._all ?? 0;

  return {
    scope: targetUserId ? "user" : "team",
    objective,
    caSigne,
    mrrSigne: contracts.reduce((s, c) => s + Number(c.montantMensuel), 0),
    nbSignes: contracts.length,
    dealsSignes: count("SIGNE"),
    dealsPerdus: count("PERDU"),
  };
}

// ---------------------------------------------------------------------------
// DETAIL d'un deal
// ---------------------------------------------------------------------------

export async function getDealById(
  user: SessionUser,
  id: string,
): Promise<DealWithRelations | null> {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      prospect: {
        select: {
          id: true,
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
          email: true,
          telephone: true,
          ville: true,
        },
      },
      assigneA: { select: { id: true, name: true } },
      productsProposes: {
        select: { id: true, nom: true, prixOneShot: true, prixMensuel: true },
      },
      contracts: {
        select: {
          id: true,
          numero: true,
          devise: true,
          signatures: {
            select: {
              id: true,
              signeParClient: true,
              signeParAclr: true,
              dateSignatureClient: true,
              dateSignatureAclr: true,
              statut: true,
              lienSignature: true,
              expireA: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!deal) return null;
  // RLS
  if (user.role !== "ADMIN" && deal.assigneAId !== user.id) {
    return null;
  }
  return deal;
}
