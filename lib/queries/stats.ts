/**
 * Requêtes pour le module Statistiques (étape 21, version MYC Arena).
 *
 * Fenêtres de période en fuseau Europe/Zurich (cf. lib/queries/pilotage.ts).
 * Les compteurs d'activité reprennent les définitions du moteur de jeu
 * (`getPeriodCounters`) : les chiffres de /stats et les XP restent cohérents.
 */
import { prisma } from "@/lib/db";
import {
  getPeriodCounters,
  zurichDayKey,
  zurichStartOfDay,
} from "@/lib/queries/pilotage";
import { type SessionUser } from "@/lib/session";

/**
 * Période d'analyse : un nombre de jours (fenêtre glissante se terminant
 * aujourd'hui, comme avant) ou une fenêtre explicite (`resolveStatsWindow`).
 */
export type StatsRange = number | { start: Date; end: Date };

/** Fenêtre [start, end] en fuseau Europe/Zurich. */
function resolveRange(range: StatsRange): { start: Date; end: Date } {
  if (typeof range !== "number") return { start: range.start, end: range.end };
  const todayKey = zurichDayKey(new Date());
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const startKey = new Date(today - range * 86_400_000).toISOString().slice(0, 10);
  const tomorrowKey = new Date(today + 86_400_000).toISOString().slice(0, 10);
  return {
    start: zurichStartOfDay(startKey),
    end: new Date(zurichStartOfDay(tomorrowKey).getTime() - 1),
  };
}

export interface StatsCockpit {
  // Période courante
  periode: { label: string; start: Date; end: Date };

  // Activité
  nbAppels: number;
  /** Appels décrochés (résultat hors combox / ne décroche pas / invalide). */
  nbConversations: number;
  nbEmails: number;
  /** RDV pris au téléphone (résultat RDV_PRIS). */
  nbRdvPris: number;
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
  /** Nombre de deals ouverts (Découverte, Proposition, Négociation). */
  nbDealsOuverts: number;

  // Revenu récurrent
  caRecurrentMensuel: number;
}

/**
 * Bloc "Productivité téléphone" : admin uniquement.
 *
 * Calculé sur les appels avec durée réelle capturée (duree2, secondes),
 * fallback sur duree déclarée (minutes x 60) si duree2 absente.
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
  /** Décomposition jour par jour (date locale jj.mm + total secondes). */
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
    userName: string;
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
  range: StatsRange,
  /** Filtre par utilisateur spécifique (admin uniquement). */
  viewAsUserId?: string,
): Promise<CallProductivity> {
  const { start, end } = resolveRange(range);

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

  // Par jour (jours Europe/Zurich, du premier au dernier jour de la fenêtre,
  // aujourd'hui compris)
  const dayMap = new Map<string, { secondes: number; nbAppels: number }>();
  const firstKey = zurichDayKey(start);
  const lastKey = zurichDayKey(end);
  const dayKeys: string[] = [];
  for (
    let t = Date.parse(`${firstKey}T00:00:00Z`);
    t <= Date.parse(`${lastKey}T00:00:00Z`);
    t += 86_400_000
  ) {
    const key = new Date(t).toISOString().slice(0, 10);
    dayKeys.push(key);
    dayMap.set(key, { secondes: 0, nbAppels: 0 });
  }
  for (const c of withDur) {
    const slot = dayMap.get(zurichDayKey(c.date));
    if (slot) {
      slot.secondes += c.secondes;
      slot.nbAppels += 1;
    }
  }
  const parJour: CallProductivity["parJour"] = dayKeys.map((key) => {
    const slot = dayMap.get(key)!;
    return {
      label: `${key.slice(8, 10)}.${key.slice(5, 7)}`,
      secondes: slot.secondes,
      nbAppels: slot.nbAppels,
    };
  });

  // Top 5 plus longs appels : exclut les notes internes (sans prospect)
  const topLongs = [...withDur]
    .filter((c) => c.prospect !== null)
    .sort((a, b) => b.secondes - a.secondes)
    .slice(0, 5)
    .map((c) => ({
      activityId: c.id,
      prospectId: c.prospect!.id,
      prospectName: c.prospect!.raisonSociale,
      date: c.date,
      secondes: c.secondes,
      sujet: c.sujet,
      resultat: c.resultat,
      userName: c.user?.name ?? "Inconnu",
    }));

  // Conversion par bucket : un appel "convertit" s'il a décroché un RDV
  // (résultat RDV_PRIS). Les anciennes valeurs testées (RDV_OBTENU,
  // INTERESSE_PROPOSITION, INTERESSE_RAPPEL) n'existent pas dans l'enum
  // ActivityResultat : la conversion affichait toujours 0 %.
  const isConvert = (resultat: string | null) => resultat === "RDV_PRIS";

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
          ? "Moyen (2-5 min)"
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
    const name = c.user?.name ?? "Inconnu";
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

// ===========================================================================
// ACTIVITÉ DE L'ÉQUIPE : tableau par collaborateur sur une période (admin)
// ===========================================================================
//
// Une ligne par commercial·e actif·ve, avec l'activité brute de la période :
// appels passés, RDV PRIS au téléphone (résultat RDV_PRIS), RDV EFFECTUÉS
// (rendez-vous honorés), emails envoyés, signatures. Plus l'objectif quotidien
// (appels / RDV) pour comparaison, surtout en vue « Aujourd'hui ».

export interface TeamActivityRow {
  userId: string;
  name: string;
  appels: number;
  rdvPris: number;
  rdvEffectues: number;
  emails: number;
  signatures: number;
  /** Objectif quotidien actif (0 si aucun). */
  objAppelsJour: number;
  objRdvJour: number;
}

/** Résout un libellé de période en fenêtre [start, end] + nb de jours. */
export function resolvePeriode(p: string): {
  type: "jour" | "semaine" | "mois";
  label: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (p === "semaine") {
    const day = start.getDay() || 7; // lundi = 1 … dimanche = 7
    start.setDate(start.getDate() - (day - 1));
    return { type: "semaine", label: "Cette semaine", start, end };
  }
  if (p === "mois") {
    start.setDate(1);
    return { type: "mois", label: "Ce mois", start, end };
  }
  return { type: "jour", label: "Aujourd'hui", start, end };
}

export async function getTeamActivityOverview(
  start: Date,
  end: Date,
): Promise<TeamActivityRow[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { not: "ADMIN" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (users.length === 0) return [];
  const userIds = users.map((u) => u.id);
  const range = { gte: start, lte: end };

  const [appels, rdvPris, rdvEffectues, emails, signatures, objectifs] =
    await Promise.all([
      prisma.activity.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          type: "APPEL_SORTANT",
          statut: { in: ["FAIT", "EN_COURS"] },
          date: range,
        },
        _count: true,
      }),
      prisma.activity.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, resultat: "RDV_PRIS", date: range },
        _count: true,
      }),
      prisma.activity.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
          prospectId: { not: null },
          statut: "FAIT",
          date: { ...range, lte: new Date(Math.min(range.lte.getTime(), Date.now())) },
        },
        _count: true,
      }),
      prisma.activity.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, type: "EMAIL_ENVOYE", date: range },
        _count: true,
      }),
      prisma.contract.groupBy({
        by: ["assigneAId"],
        where: {
          assigneAId: { in: userIds },
          statut: { notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"] },
          dateSignature: range,
        },
        _count: true,
      }),
      prisma.objective.findMany({
        where: {
          userId: { in: userIds },
          periode: "QUOTIDIEN",
          isActif: true,
          dateDebut: { lte: end },
          dateFin: { gte: start },
        },
        select: { userId: true, nbAppelsObjectif: true, nbRdvObjectif: true },
        orderBy: { dateFin: "desc" },
      }),
    ]);

  const toMap = (rows: Array<{ userId: string; _count: number }>) =>
    new Map(rows.map((r) => [r.userId, r._count]));
  const mAppels = toMap(appels as never);
  const mRdvPris = toMap(rdvPris as never);
  const mRdvEff = toMap(rdvEffectues as never);
  const mEmails = toMap(emails as never);
  const mSign = new Map(
    (signatures as Array<{ assigneAId: string; _count: number }>).map((r) => [
      r.assigneAId,
      r._count,
    ]),
  );
  const mObj = new Map<string, { appels: number; rdv: number }>();
  for (const o of objectifs) {
    if (mObj.has(o.userId)) continue; // 1er = le plus récent (orderBy dateFin desc)
    mObj.set(o.userId, {
      appels: o.nbAppelsObjectif ?? 0,
      rdv: o.nbRdvObjectif ?? 0,
    });
  }

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    appels: mAppels.get(u.id) ?? 0,
    rdvPris: mRdvPris.get(u.id) ?? 0,
    rdvEffectues: mRdvEff.get(u.id) ?? 0,
    emails: mEmails.get(u.id) ?? 0,
    signatures: mSign.get(u.id) ?? 0,
    objAppelsJour: mObj.get(u.id)?.appels ?? 0,
    objRdvJour: mObj.get(u.id)?.rdv ?? 0,
  }));
}

export async function getStats(
  user: SessionUser,
  range: StatsRange,
  /**
   * Admin uniquement : voir les stats d'une commerciale spécifique
   * (= matrice "Arthur regarde Lucille"). Ignoré côté commercial.
   */
  viewAsUserId?: string,
): Promise<StatsCockpit> {
  const { start, end } = resolveRange(range);

  // Calcul du scope effectif :
  //  - Commercial : toujours ses propres données (RLS dur)
  //  - Admin : toute l'équipe par défaut, ou un user spécifique si viewAs
  const effectiveUserId =
    user.role !== "ADMIN" ? user.id : viewAsUserId;

  const contractScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};
  const dealScope = effectiveUserId ? { assigneAId: effectiveUserId } : {};
  const prospectScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};

  const [
    counters,
    funnelProspects,
    funnelContactes,
    funnelRdvPris,
    funnelPropositions,
    funnelSignes,
    dealsOuverts,
    caRecurrent,
  ] = await Promise.all([
    // Activité de la période, mêmes définitions que le moteur de jeu :
    //  - appels FAIT / EN_COURS ; emails envoyés FAIT ;
    //  - RDV honorés = RDV rattachés à un client, FAIT, déjà passés (exclut
    //    le phoning et les points internes enregistrés avec un type RDV) ;
    //  - propositions ENVOYÉES = contrats (devis) créés dans la fenêtre, quel
    //    que soit leur sort ensuite, hors contrats importés a posteriori.
    //    (Compter les prospects au statut PROPOSITION_ENVOYEE ne marche pas :
    //    dès qu'un client signe, la proposition « disparaît » du compte.)
    //  - signatures = contrats RÉELLEMENT signés (hors propositions en
    //    attente de signature / de validation).
    getPeriodCounters(effectiveUserId ?? null, start, end),
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
    // Pipeline (brut + pondéré) : deals ouverts avec leur proba
    prisma.deal.findMany({
      where: {
        ...dealScope,
        stage: { in: ["DECOUVERTE", "PROPOSITION", "NEGOCIATION"] },
      },
      select: { montantPrevu: true, probabilite: true },
    }),
    prisma.contract.aggregate({
      where: { ...contractScope, statut: "ACTIF" },
      _sum: { montantMensuel: true },
    }),
  ]);

  const pipelineTotal = dealsOuverts.reduce(
    (s, d) => s + Number(d.montantPrevu),
    0,
  );
  const pipelinePondere = dealsOuverts.reduce(
    (s, d) => s + (Number(d.montantPrevu) * d.probabilite) / 100,
    0,
  );

  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );

  return {
    periode: { label: `${days} derniers jours`, start, end },
    nbAppels: counters.appels,
    nbConversations: counters.conversations,
    nbEmails: counters.emails,
    nbRdvPris: counters.rdvPris,
    nbRdvHonores: counters.rdvEffectues,
    nbRdvManques: counters.rdvManques,
    nbPropositions: counters.propositions,
    nbSignatures: counters.signatures,
    caSigne: counters.caSigne,
    funnel: {
      prospects: funnelProspects,
      contactes: funnelContactes,
      rdvPris: funnelRdvPris,
      propositions: funnelPropositions,
      signes: funnelSignes,
    },
    tauxAppelRdv: counters.appels > 0 ? counters.rdvPris / counters.appels : 0,
    tauxRdvSignature:
      counters.rdvEffectues > 0 ? counters.signatures / counters.rdvEffectues : 0,
    tauxPropositionSignature:
      counters.propositions > 0 ? counters.signatures / counters.propositions : 0,
    pipelineTotal,
    pipelinePondere,
    nbDealsOuverts: dealsOuverts.length,
    caRecurrentMensuel: Number(caRecurrent._sum.montantMensuel ?? 0),
  };
}

// ===========================================================================
// CLASSEMENTS : produits / secteurs B2B / cantons
// ===========================================================================
//
// Trois "tops" pour piloter ton offre commerciale :
//   1. Produits les plus vendus  → quels packs marchent
//   2. Secteurs B2B qui achètent  → où concentrer la prospection
//   3. Cantons qui achètent       → couverture géographique
//
// Tous sont calculés sur la PÉRIODE choisie et respectent le viewAsUserId
// (matrice Arthur / commerciale).

export interface TopRankings {
  /** Nombre de contrats signés sur la période (base des pourcentages). */
  totalContrats: number;
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
  range: StatsRange,
  viewAsUserId?: string,
): Promise<TopRankings> {
  const { start, end } = resolveRange(range);

  const effectiveUserId =
    user.role !== "ADMIN" ? user.id : viewAsUserId;
  const contractScope = effectiveUserId
    ? { assigneAId: effectiveUserId }
    : {};

  // Charge tous les contrats RÉELLEMENT signés sur la période (hors propositions
  // en attente de signature) avec produits + prospect.
  const contracts = await prisma.contract.findMany({
    where: {
      ...contractScope,
      statut: {
        notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
      },
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
    const canton = c.prospect.canton ?? "Non renseigné";
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

  return { totalContrats, produits, secteurs, cantons };
}
