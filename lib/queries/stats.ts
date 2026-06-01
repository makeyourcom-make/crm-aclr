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

/**
 * Bloc "Productivité téléphone" — admin uniquement.
 *
 * Calculé sur les appels avec durée réelle capturée (duree2, secondes),
 * fallback sur duree déclarée (minutes × 60) si duree2 absente.
 */
export interface CallProductivity {
  /** Temps total au téléphone sur la période (secondes). */
  totalSeconds: number;
  /** Nb d'appels disposant d'une durée. */
  nbAppelsWithDuration: number;
  /** Moyenne / appel (secondes). */
  avgSeconds: number;
  /** Plus long appel (secondes). */
  maxSeconds: number;
  /** Décomposition jour par jour (date locale jj/mm + total secondes). */
  parJour: Array<{ label: string; secondes: number; nbAppels: number }>;
  /** Top 5 plus longs appels avec leur prospect. */
  topLongs: Array<{
    activityId: string;
    prospectId: string;
    prospectName: string;
    date: Date;
    secondes: number;
    sujet: string;
    resultat: string | null;
  }>;
  /** Conversion par bucket de durée : court / moyen / long. */
  parBucket: Array<{
    bucket: "court" | "moyen" | "long";
    label: string;
    nbAppels: number;
    nbRdvPris: number;
    tauxConversion: number;
  }>;
  /** Décomposition par commerciale (multi-user). */
  parUser: Array<{
    userId: string;
    name: string;
    nbAppels: number;
    totalSeconds: number;
    avgSeconds: number;
  }>;
}

function durationOf(a: { duree: number | null; duree2: number | null }): number {
  if (a.duree2 && a.duree2 > 0) return a.duree2;
  if (a.duree && a.duree > 0) return a.duree * 60;
  return 0;
}

export async function getCallProductivity(
  rangeJours: number,
  /** Filtre par utilisateur spécifique (admin uniquement). */
  viewAsUserId?: string,
): Promise<CallProductivity> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - rangeJours);
  start.setHours(0, 0, 0, 0);

  // Charge tous les appels FAIT sur la période avec leur durée + prospect + user
  const calls = await prisma.activity.findMany({
    where: {
      type: "APPEL_SORTANT",
      statut: "FAIT",
      date: { gte: start, lte: end },
      ...(viewAsUserId ? { userId: viewAsUserId } : {}),
    },
    select: {
      id: true,
      date: true,
      duree: true,
      duree2: true,
      sujet: true,
      resultat: true,
      userId: true,
      prospect: { select: { id: true, raisonSociale: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  // Calculs globaux
  const withDur = calls
    .map((c) => ({ ...c, secondes: durationOf(c) }))
    .filter((c) => c.secondes > 0);
  const totalSeconds = withDur.reduce((s, c) => s + c.secondes, 0);
  const nbAppelsWithDuration = withDur.length;
  const avgSeconds =
    nbAppelsWithDuration > 0 ? totalSeconds / nbAppelsWithDuration : 0;
  const maxSeconds = withDur.reduce(
    (m, c) => (c.secondes > m ? c.secondes : m),
    0,
  );

  // Par jour
  const dayMap = new Map<string, { secondes: number; nbAppels: number }>();
  for (let i = 0; i < rangeJours; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dayMap.set(key, { secondes: 0, nbAppels: 0 });
  }
  for (const c of withDur) {
    const d = new Date(c.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const slot = dayMap.get(key);
    if (slot) {
      slot.secondes += c.secondes;
      slot.nbAppels += 1;
    }
  }
  const parJour: CallProductivity["parJour"] = [];
  for (let i = 0; i < rangeJours; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const slot = dayMap.get(key)!;
    parJour.push({
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      secondes: slot.secondes,
      nbAppels: slot.nbAppels,
    });
  }

  // Top 5 plus longs appels
  const topLongs = [...withDur]
    .sort((a, b) => b.secondes - a.secondes)
    .slice(0, 5)
    .map((c) => ({
      activityId: c.id,
      prospectId: c.prospect.id,
      prospectName: c.prospect.raisonSociale,
      date: c.date,
      secondes: c.secondes,
      sujet: c.sujet,
      resultat: c.resultat,
    }));

  // Conversion par bucket : un appel "convertit" s'il a un résultat
  // RDV_OBTENU / INTERESSE_PROPOSITION / INTERESSE_RAPPEL.
  // (cf. enum ActivityResultat — on prend large pour montrer l'intuition)
  const isConvert = (resultat: string | null) =>
    resultat === "RDV_OBTENU" ||
    resultat === "INTERESSE_PROPOSITION" ||
    resultat === "INTERESSE_RAPPEL";

  const bucketise = (s: number): "court" | "moyen" | "long" =>
    s < 120 ? "court" : s < 300 ? "moyen" : "long";

  const bucketStats: Record<
    "court" | "moyen" | "long",
    { nbAppels: number; nbRdvPris: number }
  > = {
    court: { nbAppels: 0, nbRdvPris: 0 },
    moyen: { nbAppels: 0, nbRdvPris: 0 },
    long: { nbAppels: 0, nbRdvPris: 0 },
  };
  for (const c of withDur) {
    const b = bucketise(c.secondes);
    bucketStats[b].nbAppels += 1;
    if (isConvert(c.resultat)) bucketStats[b].nbRdvPris += 1;
  }
  const parBucket: CallProductivity["parBucket"] = (
    ["court", "moyen", "long"] as const
  ).map((b) => ({
    bucket: b,
    label:
      b === "court"
        ? "Court (<2 min)"
        : b === "moyen"
          ? "Moyen (2–5 min)"
          : "Long (>5 min)",
    nbAppels: bucketStats[b].nbAppels,
    nbRdvPris: bucketStats[b].nbRdvPris,
    tauxConversion:
      bucketStats[b].nbAppels > 0
        ? bucketStats[b].nbRdvPris / bucketStats[b].nbAppels
        : 0,
  }));

  // Décomposition par commerciale
  const userMap = new Map<
    string,
    { name: string; nbAppels: number; totalSeconds: number }
  >();
  for (const c of withDur) {
    const userId = c.userId;
    const name = c.user?.name ?? "—";
    const slot =
      userMap.get(userId) ?? { name, nbAppels: 0, totalSeconds: 0 };
    slot.nbAppels += 1;
    slot.totalSeconds += c.secondes;
    userMap.set(userId, slot);
  }
  const parUser: CallProductivity["parUser"] = [...userMap.entries()]
    .map(([userId, s]) => ({
      userId,
      name: s.name,
      nbAppels: s.nbAppels,
      totalSeconds: s.totalSeconds,
      avgSeconds: s.nbAppels > 0 ? s.totalSeconds / s.nbAppels : 0,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    totalSeconds,
    nbAppelsWithDuration,
    avgSeconds,
    maxSeconds,
    parJour,
    topLongs,
    parBucket,
    parUser,
  };
}

export async function getStats(
  user: SessionUser,
  rangeJours: number,
  /**
   * Admin uniquement : voir les stats d'une commerciale spécifique
   * (= matrice "Arthur regarde Sophie"). Ignoré côté commercial.
   */
  viewAsUserId?: string,
): Promise<StatsCockpit> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - rangeJours);
  start.setHours(0, 0, 0, 0);

  // Calcul du scope effectif :
  //  - Commercial → toujours ses propres données (RLS dur)
  //  - Admin → toute l'équipe par défaut, ou un user spécifique si viewAs
  const effectiveUserId =
    user.role !== "ADMIN" ? user.id : viewAsUserId;

  const userScope = effectiveUserId ? { userId: effectiveUserId } : {};
  const contractScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};
  const dealScope = effectiveUserId ? { assigneAId: effectiveUserId } : {};
  const prospectScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};

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

// ===========================================================================
// CLASSEMENTS — produits / secteurs B2B / cantons
// ===========================================================================
//
// Trois "tops" pour piloter ton offre commerciale :
//   1. Produits les plus vendus  → quels packs marchent
//   2. Secteurs B2B qui achètent  → où concentrer la prospection
//   3. Cantons qui achètent       → couverture géographique
//
// Tous sont calculés sur la PÉRIODE choisie et respectent le viewAsUserId
// (matrice Arthur ↔ Sophie).

export interface TopRankings {
  produits: Array<{
    productId: string;
    nom: string;
    categorie: string;
    nbContrats: number;
    ca: number;
    pct: number; // % du nb total de contrats signés sur la période
  }>;
  secteurs: Array<{
    secteur: string;
    label: string;
    nbContrats: number;
    ca: number;
    pct: number;
  }>;
  cantons: Array<{
    canton: string;
    nbContrats: number;
    ca: number;
    pct: number;
  }>;
}

export async function getTopRankings(
  user: SessionUser,
  rangeJours: number,
  viewAsUserId?: string,
): Promise<TopRankings> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - rangeJours);
  start.setHours(0, 0, 0, 0);

  const effectiveUserId =
    user.role !== "ADMIN" ? user.id : viewAsUserId;
  const contractScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};

  // Charge tous les contrats signés sur la période avec produits + prospect
  const contracts = await prisma.contract.findMany({
    where: {
      ...contractScope,
      dateSignature: { gte: start, lte: end },
    },
    select: {
      id: true,
      valeurAn1: true,
      products: { select: { id: true, nom: true, categorie: true } },
      prospect: { select: { secteur: true, canton: true } },
    },
  });

  const totalContrats = contracts.length;

  // ---- 1. Top produits ---------------------------------------------------
  const prodMap = new Map<
    string,
    { nom: string; categorie: string; nbContrats: number; ca: number }
  >();
  for (const c of contracts) {
    const caContract = Number(c.valeurAn1);
    // Une part égale du CA est attribuée à chaque produit du contrat
    const nbProds = c.products.length || 1;
    const caPerProduct = caContract / nbProds;
    for (const p of c.products) {
      const slot = prodMap.get(p.id) ?? {
        nom: p.nom,
        categorie: p.categorie,
        nbContrats: 0,
        ca: 0,
      };
      slot.nbContrats += 1;
      slot.ca += caPerProduct;
      prodMap.set(p.id, slot);
    }
  }
  const produits = [...prodMap.entries()]
    .map(([productId, v]) => ({
      productId,
      nom: v.nom,
      categorie: v.categorie,
      nbContrats: v.nbContrats,
      ca: v.ca,
      pct: totalContrats > 0 ? v.nbContrats / totalContrats : 0,
    }))
    .sort((a, b) => b.nbContrats - a.nbContrats || b.ca - a.ca)
    .slice(0, 8);

  // ---- 2. Top secteurs B2B ----------------------------------------------
  const secteurMap = new Map<
    string,
    { nbContrats: number; ca: number }
  >();
  for (const c of contracts) {
    const secteur = c.prospect.secteur ?? "INCONNU";
    const slot = secteurMap.get(secteur) ?? { nbContrats: 0, ca: 0 };
    slot.nbContrats += 1;
    slot.ca += Number(c.valeurAn1);
    secteurMap.set(secteur, slot);
  }
  const secteurs = [...secteurMap.entries()]
    .map(([secteur, v]) => ({
      secteur,
      label: secteur, // labelisé côté UI via getProspectSecteurLabel
      nbContrats: v.nbContrats,
      ca: v.ca,
      pct: totalContrats > 0 ? v.nbContrats / totalContrats : 0,
    }))
    .sort((a, b) => b.nbContrats - a.nbContrats || b.ca - a.ca)
    .slice(0, 8);

  // ---- 3. Top cantons ----------------------------------------------------
  const cantonMap = new Map<string, { nbContrats: number; ca: number }>();
  for (const c of contracts) {
    const canton = c.prospect.canton ?? "—";
    const slot = cantonMap.get(canton) ?? { nbContrats: 0, ca: 0 };
    slot.nbContrats += 1;
    slot.ca += Number(c.valeurAn1);
    cantonMap.set(canton, slot);
  }
  const cantons = [...cantonMap.entries()]
    .map(([canton, v]) => ({
      canton,
      nbContrats: v.nbContrats,
      ca: v.ca,
      pct: totalContrats > 0 ? v.nbContrats / totalContrats : 0,
    }))
    .sort((a, b) => b.nbContrats - a.nbContrats || b.ca - a.ca)
    .slice(0, 8);

  return { produits, secteurs, cantons };
}
