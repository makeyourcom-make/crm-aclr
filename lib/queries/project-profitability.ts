/**
 * Rentabilité par projet — calcule la marge nette de chaque contrat actif.
 *
 * Formule — tout est ramené à la DURÉE RÉELLE du contrat (`dureeMois`) :
 *
 *   Revenu             = montantOneShot + montantMensuel × dureeMois
 *   - Coûts directs    = Σ(produit.coutOneShot + produit.coutMensuel × dureeMois)
 *   - Commission       = taux × assiette RÉELLE (voir plus bas — pas au prorata)
 *   - Quote-part frais = (charges fixes mensuelles moyennes × min(dureeMois, 12)) / nb contrats actifs
 *       (plafond 12 mois : la charge par contrat d'aujourd'hui ne se projette pas
 *        sur 2-3 ans — le parc de contrats grandit, la part par contrat baisse.
 *        Sans ce plafond, un contrat pluriannuel à faible mensuel paraissait
 *        déficitaire à tort. Ex. Coffre à Dom 149/mois × 36 : -39% → +48%.)
 *   - Provision impôts = tauxImpotsProvisionne × marge brute
 *   ─────────────────────────────────────
 *   = MARGE NETTE
 *
 * Le pourcentage de rentabilité = marge nette / revenu (×100 pour %).
 *
 * Pourquoi la durée réelle : un contrat de 6 mois était compté comme 12 mois
 * (revenu = valeurAn1, frais × 12) — il paraissait deux fois plus lourd qu'il
 * ne l'est. Signalé par Arthur le 22.07.2026 sur ACLR-2026-0052 (6 mois).
 *
 * EXCEPTION VOLONTAIRE — la commission n'est PAS mise au prorata : elle est
 * calculée sur l'assiette réellement versée à la commerciale (`an 1` pour les
 * lignes hors ADS, durée réelle pour les lignes ADS — cf. lib/commissions.ts).
 * La mettre au prorata afficherait un coût inférieur à ce qui sort vraiment de
 * la caisse, ce qui embellirait la marge à tort.
 *
 * Hypothèses :
 *   - "Quote-part frais généraux" est une répartition simple : on alloue les
 *     charges mensuelles fixes (loyer, SaaS partagés, salaires non-commerciaux)
 *     équitablement sur les contrats actifs. C'est conservateur et facile à
 *     comprendre. Si tu veux plus fin (par ex. proportionnel au CA), on ajustera.
 */
import { prisma } from "@/lib/db";

export interface ProjectMargin {
  contractId: string;
  numero: string;
  raisonSociale: string;
  commercialeName: string;
  dateSignature: Date;
  modalitePaiement: string;
  statut: string;

  /** Durée du contrat en mois — base de tous les montants ci-dessous. */
  dureeMois: number;

  // Composantes (sur la durée du contrat)
  revenu: number;
  coutsDirects: number;
  commission: number;
  quotePartFrais: number;
  /** Charges RÉELLES rattachées au client (factures directes + allocations),
   *  réparties sur ses contrats actifs. Ex. sous-traitant, ad spend, etc. */
  chargesReelles: number;
  margeBrute: number;
  /** marge brute / revenu — entre -∞ et 1. */
  rentabilite: number;
}

export interface ProjectMarginCockpit {
  projects: ProjectMargin[];
  /** Coût mensuel moyen alloué par contrat (info en bas de page). */
  quotePartParContrat: number;
  totals: {
    revenu: number;
    coutsDirects: number;
    commissions: number;
    quotePartFrais: number;
    chargesReelles: number;
    margeBrute: number;
  };
}

export async function getProjectMargins(): Promise<ProjectMarginCockpit> {
  const [settings, contracts, expensesLast6m, nonCommercialsActifs] =
    await Promise.all([
      prisma.setting.findFirst(),
      // Contrats ACTIF avec produits + assigné
      prisma.contract.findMany({
        where: { statut: "ACTIF" },
        select: {
          id: true,
          numero: true,
          dateSignature: true,
          valeurAn1: true,
          montantOneShot: true,
          montantMensuel: true,
          dureeMois: true,
          modalitePaiement: true,
          statut: true,
          prospectId: true,
          assigneA: {
            select: {
              name: true,
              tauxCommissionSignature: true,
            },
          },
          prospect: { select: { raisonSociale: true } },
          products: {
            select: {
              id: true,
              coutOneShot: true,
              coutMensuel: true,
            },
          },
        },
        orderBy: { dateSignature: "desc" },
      }),
      // Charges des 6 derniers mois pour calculer la quote-part
      prisma.expense.findMany({
        where: {
          date: {
            gte: (() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 6);
              return d;
            })(),
          },
        },
        select: { montantTTC: true },
      }),
      // Salaires des non-commerciaux (frais fixes)
      prisma.user.findMany({
        where: { isActive: true, role: { not: "COMMERCIAL" } },
        select: { salaireBase: true },
      }),
    ]);

  // ----- Charges RÉELLES rattachées par client ---------------------------
  // (factures directes Expense.prospectId + allocations multi-clients).
  const [directByProspect, allocByProspect] = await Promise.all([
    prisma.expense.groupBy({
      by: ["prospectId"],
      where: { prospectId: { not: null } },
      _sum: { montantTTC: true },
    }),
    prisma.expenseAllocation.groupBy({
      by: ["prospectId"],
      _sum: { montantHT: true },
    }),
  ]);
  const clientCharges = new Map<string, number>();
  for (const d of directByProspect) {
    if (d.prospectId)
      clientCharges.set(
        d.prospectId,
        (clientCharges.get(d.prospectId) ?? 0) + Number(d._sum.montantTTC ?? 0),
      );
  }
  for (const a of allocByProspect) {
    clientCharges.set(
      a.prospectId,
      (clientCharges.get(a.prospectId) ?? 0) + Number(a._sum.montantHT ?? 0),
    );
  }
  // Nombre de contrats actifs par client (pour répartir sans double compte).
  const contratsParClient = new Map<string, number>();
  for (const c of contracts)
    contratsParClient.set(
      c.prospectId,
      (contratsParClient.get(c.prospectId) ?? 0) + 1,
    );

  // ----- Quote-part frais généraux ---------------------------------------
  // Charges TTC moyennes mensuelles sur 6 mois + salaires fixes non-commerciaux
  const chargesMoyennesMensuelles =
    expensesLast6m.reduce((s, e) => s + Number(e.montantTTC), 0) / 6;
  const salaireFixeNonCommercial = nonCommercialsActifs.reduce(
    (s, u) => s + Number(u.salaireBase ?? 0),
    0,
  );
  const fraisFixesMensuels =
    chargesMoyennesMensuelles + salaireFixeNonCommercial;
  // Quote-part MENSUELLE par contrat actif — multipliée ensuite par la durée
  // réelle de chaque contrat (un contrat de 6 mois n'absorbe pas 12 mois de
  // frais généraux).
  const nbContrats = Math.max(contracts.length, 1);
  const quotePartMensuelleParContrat = fraisFixesMensuels / nbContrats;

  // ----- Calcul de marge pour chaque contrat -----------------------------
  // Note : on s'arrête à la marge brute (= revenu - coûts directs -
  // commission - quote-part frais généraux). Pas de provision impôts.
  const projects: ProjectMargin[] = contracts.map((c) => {
    const duree = c.dureeMois > 0 ? c.dureeMois : 12;
    const revenu =
      Number(c.montantOneShot) + Number(c.montantMensuel) * duree;
    const coutsDirects = c.products.reduce((s, p) => {
      const oneShot = Number(p.coutOneShot ?? 0);
      const mensuel = Number(p.coutMensuel ?? 0);
      return s + oneShot + mensuel * duree;
    }, 0);
    const tauxCom = Number(c.assigneA.tauxCommissionSignature);
    // Sur valeurAn1 (assiette réellement versée), PAS au prorata — cf. en-tête.
    const commission = Number(c.valeurAn1) * tauxCom;
    // Quote-part frais généraux : plafonnée à 12 mois (cf. en-tête). On ne
    // projette pas la charge par contrat d'aujourd'hui sur toute la durée d'un
    // contrat pluriannuel — le parc de contrats grandit, la part par contrat
    // baisse. Un 6 mois reste proportionnel (min(duree,12) = duree).
    const quotePartFrais = quotePartMensuelleParContrat * Math.min(duree, 12);
    // Charges réelles du client réparties sur ses contrats actifs.
    const chargesReelles =
      (clientCharges.get(c.prospectId) ?? 0) /
      Math.max(contratsParClient.get(c.prospectId) ?? 1, 1);
    const margeBrute =
      revenu - coutsDirects - commission - quotePartFrais - chargesReelles;
    const rentabilite = revenu > 0 ? margeBrute / revenu : 0;

    return {
      contractId: c.id,
      numero: c.numero,
      raisonSociale: c.prospect.raisonSociale,
      commercialeName: c.assigneA.name,
      dateSignature: c.dateSignature,
      modalitePaiement: c.modalitePaiement,
      statut: c.statut,
      dureeMois: duree,
      revenu,
      coutsDirects,
      commission,
      quotePartFrais,
      chargesReelles,
      margeBrute,
      rentabilite,
    };
  });

  // Tri : les moins rentables en haut (pour les voir et agir)
  projects.sort((a, b) => a.rentabilite - b.rentabilite);

  const totals = projects.reduce(
    (acc, p) => {
      acc.revenu += p.revenu;
      acc.coutsDirects += p.coutsDirects;
      acc.commissions += p.commission;
      acc.quotePartFrais += p.quotePartFrais;
      acc.chargesReelles += p.chargesReelles;
      acc.margeBrute += p.margeBrute;
      return acc;
    },
    {
      revenu: 0,
      coutsDirects: 0,
      commissions: 0,
      quotePartFrais: 0,
      chargesReelles: 0,
      margeBrute: 0,
    },
  );

  return {
    projects,
    // Affiché « / contrat / an » sur la page — donc bien annualisé.
    quotePartParContrat: quotePartMensuelleParContrat * 12,
    totals,
  };
}

/**
 * Variante : marge d'un seul contrat (pour la page détail).
 *
 * Avant : appelait getProjectMargins() qui charge TOUS les contrats actifs
 * pour en retourner 1 (~50 contrats × 4 includes = très lent).
 *
 * Maintenant : on calcule la quote-part une seule fois (charges + salaires)
 * puis on charge UNIQUEMENT le contrat ciblé.
 */
export async function getProjectMarginForContract(
  contractId: string,
): Promise<ProjectMargin | null> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [contract, expensesLast6m, nonCommercialsActifs, nbContrats] =
    await Promise.all([
      prisma.contract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          numero: true,
          valeurAn1: true,
          montantOneShot: true,
          montantMensuel: true,
          dureeMois: true,
          dateSignature: true,
          modalitePaiement: true,
          statut: true,
          prospectId: true,
          prospect: { select: { raisonSociale: true } },
          products: {
            select: { coutOneShot: true, coutMensuel: true },
          },
          assigneA: {
            select: { name: true, tauxCommissionSignature: true },
          },
        },
      }),
      prisma.expense.findMany({
        where: { date: { gte: sixMonthsAgo } },
        select: { montantTTC: true },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { not: "COMMERCIAL" } },
        select: { salaireBase: true },
      }),
      prisma.contract.count({ where: { statut: "ACTIF" } }),
    ]);

  if (!contract) return null;

  // Charges réelles du client, réparties sur ses contrats actifs.
  const [directAgg, allocAgg, activeContractsClient] = await Promise.all([
    prisma.expense.aggregate({
      where: { prospectId: contract.prospectId },
      _sum: { montantTTC: true },
    }),
    prisma.expenseAllocation.aggregate({
      where: { prospectId: contract.prospectId },
      _sum: { montantHT: true },
    }),
    prisma.contract.count({
      where: { prospectId: contract.prospectId, statut: "ACTIF" },
    }),
  ]);
  const chargesReelles =
    (Number(directAgg._sum.montantTTC ?? 0) +
      Number(allocAgg._sum.montantHT ?? 0)) /
    Math.max(activeContractsClient, 1);

  const chargesMoyennesMensuelles =
    expensesLast6m.reduce((s, e) => s + Number(e.montantTTC), 0) / 6;
  const salaireFixeNonCommercial = nonCommercialsActifs.reduce(
    (s, u) => s + Number(u.salaireBase ?? 0),
    0,
  );
  const fraisFixesMensuels =
    chargesMoyennesMensuelles + salaireFixeNonCommercial;
  // Durée RÉELLE du contrat : un 6 mois n'absorbe pas 12 mois de frais.
  const duree = contract.dureeMois > 0 ? contract.dureeMois : 12;
  // Quote-part frais généraux plafonnée à 12 mois (cf. en-tête + getProjectMargins) :
  // on ne projette pas la charge par contrat d'aujourd'hui sur un contrat de 2-3
  // ans (le parc grandit → part par contrat en baisse). min(duree,12) garde le
  // prorata pour les contrats courts.
  const quotePartFrais =
    (fraisFixesMensuels * Math.min(duree, 12)) / Math.max(nbContrats, 1);

  const revenu =
    Number(contract.montantOneShot) + Number(contract.montantMensuel) * duree;
  const coutsDirects = contract.products.reduce((s, p) => {
    const oneShot = Number(p.coutOneShot ?? 0);
    const mensuel = Number(p.coutMensuel ?? 0);
    return s + oneShot + mensuel * duree;
  }, 0);
  const tauxCom = Number(contract.assigneA.tauxCommissionSignature);
  // Assiette réellement versée (an 1 hors ADS), PAS au prorata — cf. en-tête.
  const commission = Number(contract.valeurAn1) * tauxCom;
  const margeBrute =
    revenu - coutsDirects - commission - quotePartFrais - chargesReelles;
  const rentabilite = revenu > 0 ? margeBrute / revenu : 0;

  return {
    contractId: contract.id,
    numero: contract.numero,
    raisonSociale: contract.prospect.raisonSociale,
    commercialeName: contract.assigneA.name,
    dateSignature: contract.dateSignature,
    modalitePaiement: contract.modalitePaiement,
    statut: contract.statut,
    dureeMois: duree,
    revenu,
    coutsDirects,
    commission,
    quotePartFrais,
    chargesReelles,
    margeBrute,
    rentabilite,
  };
}
