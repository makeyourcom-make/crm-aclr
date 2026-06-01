/**
 * Requêtes de lecture pour le module Deals (Pipeline).
 */
import { Prisma, type DealStage } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { DealListParams } from "@/lib/schemas/deal";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealForKanban = Prisma.DealGetPayload<{
  include: {
    prospect: {
      select: { id: true; raisonSociale: true; secteur: true };
    };
    assigneA: { select: { id: true; name: true } };
    // On charge les contrats + signatures pour afficher le statut
    // "signé client - en attente validation admin" sur la carte.
    contracts: {
      select: {
        id: true;
        numero: true;
        signatures: {
          select: {
            id: true;
            signeParClient: true;
            signeParAclr: true;
            statut: true;
          };
        };
      };
    };
  };
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
    // Contrats + signatures pour le panneau de détail — Arthur valide ici
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

export interface PipelineColumn {
  stage: DealStage;
  deals: DealForKanban[];
  totalMontant: number;
  totalPondere: number; // somme(montantPrevu * probabilité / 100)
}

export interface PipelineData {
  columns: PipelineColumn[];
  grandTotal: number;
  grandTotalPondere: number;
}

// ---------------------------------------------------------------------------
// PIPELINE — tout en un
// ---------------------------------------------------------------------------

const STAGE_ORDER: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
  "SIGNE",
  "PERDU",
];

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
  // Tant que Sophie a créé le contrat mais que l'admin n'a pas encore
  // contre-signé, le deal reste visible dans la colonne SIGNE — c'est
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

  // Règle métier : la colonne PERDU est réinitialisée à 0 chaque mois.
  // On ne montre QUE les deals PERDU dont la date de close réel tombe
  // dans le mois courant. Les pertes des mois précédents disparaissent
  // automatiquement (mais restent en base pour les stats historiques).
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  conditions.push({
    OR: [
      { stage: { not: "PERDU" } },
      {
        stage: "PERDU",
        closeReelLe: { gte: startOfMonth },
      },
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

  const deals = await prisma.deal.findMany({
    where,
    include: {
      prospect: {
        select: { id: true, raisonSociale: true, secteur: true },
      },
      assigneA: { select: { id: true, name: true } },
      contracts: {
        select: {
          id: true,
          numero: true,
          signatures: {
            select: {
              id: true,
              signeParClient: true,
              signeParAclr: true,
              statut: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const columns: PipelineColumn[] = STAGE_ORDER.map((stage) => {
    const dealsOfStage = deals.filter((d) => d.stage === stage);
    const totalMontant = dealsOfStage.reduce(
      (sum, d) => sum + Number(d.montantPrevu),
      0,
    );
    const totalPondere = dealsOfStage.reduce(
      (sum, d) => sum + (Number(d.montantPrevu) * d.probabilite) / 100,
      0,
    );
    return { stage, deals: dealsOfStage, totalMontant, totalPondere };
  });

  const grandTotal = columns.reduce((s, c) => s + c.totalMontant, 0);
  const grandTotalPondere = columns.reduce((s, c) => s + c.totalPondere, 0);

  return { columns, grandTotal, grandTotalPondere };
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
