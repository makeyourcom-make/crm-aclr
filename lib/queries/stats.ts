/**
 * Requêtes pour le module Statistiques (étape 21).
 */
import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

export interface StatsCockpit {
  // Période courante
  periode: { label: string; start: Date; end: Date };

  // Activité
  nbAppels: number;
  nbEmails: number;
  nbRdvHonores: number;
  nbRdvManques: number;
  nbPropositions: number;
  nbSignatures: number;
  caSigne: number;

  // Funnel
  funnel: {
    prospects: number;
    contactes: number;
    rdvPris: number;
    propositions: number;
    signes: number;
  };

  // Taux de conversion
  tauxAppelRdv: number; // RDV pris / appels passés
  tauxRdvSignature: number; // Signatures / RDV honorés
  tauxPropositionSignature: number; // Signatures / propositions

  // Pipeline
  pipelineTotal: number;
  pipelinePondere: number;

  // Revenu récurrent
  caRecurrentMensuel: number;
}

export async function getStats(
  user: SessionUser,
  rangeJours: number,
): Promise<StatsCockpit> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - rangeJours);
  start.setHours(0, 0, 0, 0);

  const scope =
    user.role === "ADMIN"
      ? { userId: undefined as string | undefined }
      : { userId: user.id };

  const userScope = user.role === "ADMIN" ? {} : { userId: user.id };
  const contractScope =
    user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const dealScope = user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const prospectScope =
    user.role === "ADMIN" ? {} : { assigneAId: user.id };

  const [
    appels,
    emails,
    rdvHonores,
    rdvManques,
    propositionsActivities,
    signaturesContracts,
    funnelProspects,
    funnelContactes,
    funnelRdvPris,
    funnelPropositions,
    funnelSignes,
    pipelineAgg,
    caRecurrent,
  ] = await Promise.all([
    prisma.activity.count({
      where: {
        ...userScope,
        type: "APPEL_SORTANT",
        date: { gte: start, lte: end },
        statut: { in: ["FAIT", "EN_COURS"] },
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: "EMAIL_ENVOYE",
        date: { gte: start, lte: end },
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
        date: { gte: start, lte: end },
        statut: "FAIT",
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
        date: { gte: start, lte: end },
        statut: "MANQUE",
      },
    }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        statut: "PROPOSITION_ENVOYEE",
        updatedAt: { gte: start, lte: end },
      },
    }),
    prisma.contract.aggregate({
      where: { ...contractScope, dateSignature: { gte: start, lte: end } },
      _count: true,
      _sum: { valeurAn1: true },
    }),
    // Funnel cumulatif (depuis le début)
    prisma.prospect.count({ where: prospectScope }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        statut: {
          in: [
            "CONTACTE",
            "QUALIFIE",
            "RDV_PRIS",
            "PROPOSITION_ENVOYEE",
            "SIGNE",
          ],
        },
      },
    }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        statut: { in: ["RDV_PRIS", "PROPOSITION_ENVOYEE", "SIGNE"] },
      },
    }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        statut: { in: ["PROPOSITION_ENVOYEE", "SIGNE"] },
      },
    }),
    prisma.prospect.count({
      where: { ...prospectScope, statut: "SIGNE" },
    }),
    prisma.deal.aggregate({
      where: {
        ...dealScope,
        stage: { in: ["DECOUVERTE", "PROPOSITION", "NEGOCIATION"] },
      },
      _sum: { montantPrevu: true },
    }),
    prisma.contract.aggregate({
      where: { ...contractScope, statut: "ACTIF" },
      _sum: { montantMensuel: true },
    }),
  ]);

  // Pipeline pondéré : besoin des deals avec leur proba
  const dealsForPondere = await prisma.deal.findMany({
    where: {
      ...dealScope,
      stage: { in: ["DECOUVERTE", "PROPOSITION", "NEGOCIATION"] },
    },
    select: { montantPrevu: true, probabilite: true },
  });
  const pipelinePondere = dealsForPondere.reduce(
    (s, d) => s + (Number(d.montantPrevu) * d.probabilite) / 100,
    0,
  );

  return {
    periode: { label: `${rangeJours} derniers jours`, start, end },
    nbAppels: appels,
    nbEmails: emails,
    nbRdvHonores: rdvHonores,
    nbRdvManques: rdvManques,
    nbPropositions: propositionsActivities,
    nbSignatures: signaturesContracts._count,
    caSigne: Number(signaturesContracts._sum.valeurAn1 ?? 0),
    funnel: {
      prospects: funnelProspects,
      contactes: funnelContactes,
      rdvPris: funnelRdvPris,
      propositions: funnelPropositions,
      signes: funnelSignes,
    },
    tauxAppelRdv: appels > 0 ? (rdvHonores + rdvManques) / appels : 0,
    tauxRdvSignature:
      rdvHonores > 0 ? signaturesContracts._count / rdvHonores : 0,
    tauxPropositionSignature:
      propositionsActivities > 0
        ? signaturesContracts._count / propositionsActivities
        : 0,
    pipelineTotal: Number(pipelineAgg._sum.montantPrevu ?? 0),
    pipelinePondere,
    caRecurrentMensuel: Number(caRecurrent._sum.montantMensuel ?? 0),
  };
}
