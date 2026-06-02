/**
 * Rentabilité par projet — calcule la marge nette de chaque contrat actif.
 *
 * Formule :
 *
 *   Revenu 12 mois     = valeurAn1
 *   - Coûts directs    = Σ(produit.coutOneShot + produit.coutMensuel × 12)
 *   - Commission       = taux × valeurAn1 (25 % signature, 10 % renouvellement)
 *   - Quote-part frais = (charges fixes mensuelles moyennes × 12) / nb contrats actifs
 *   - Provision impôts = tauxImpotsProvisionne × marge brute
 *   ─────────────────────────────────────
 *   = MARGE NETTE
 *
 * Le pourcentage de rentabilité = marge nette / revenu (×100 pour %).
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

  // Composantes
  revenu12mois: number;
  coutsDirects: number;
  commission: number;
  quotePartFrais: number;
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
          modalitePaiement: true,
          statut: true,
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
  // Quote-part annuelle par contrat actif
  const nbContrats = Math.max(contracts.length, 1);
  const quotePartAnnuelleParContrat =
    (fraisFixesMensuels * 12) / nbContrats;

  // ----- Calcul de marge pour chaque contrat -----------------------------
  // Note : on s'arrête à la marge brute (= revenu - coûts directs -
  // commission - quote-part frais généraux). Pas de provision impôts.
  const projects: ProjectMargin[] = contracts.map((c) => {
    const revenu = Number(c.valeurAn1);
    const coutsDirects = c.products.reduce((s, p) => {
      const oneShot = Number(p.coutOneShot ?? 0);
      const mensuel = Number(p.coutMensuel ?? 0);
      return s + oneShot + mensuel * 12;
    }, 0);
    const tauxCom = Number(c.assigneA.tauxCommissionSignature);
    const commission = revenu * tauxCom;
    const quotePartFrais = quotePartAnnuelleParContrat;
    const margeBrute = revenu - coutsDirects - commission - quotePartFrais;
    const rentabilite = revenu > 0 ? margeBrute / revenu : 0;

    return {
      contractId: c.id,
      numero: c.numero,
      raisonSociale: c.prospect.raisonSociale,
      commercialeName: c.assigneA.name,
      dateSignature: c.dateSignature,
      modalitePaiement: c.modalitePaiement,
      statut: c.statut,
      revenu12mois: revenu,
      coutsDirects,
      commission,
      quotePartFrais,
      margeBrute,
      rentabilite,
    };
  });

  // Tri : les moins rentables en haut (pour les voir et agir)
  projects.sort((a, b) => a.rentabilite - b.rentabilite);

  const totals = projects.reduce(
    (acc, p) => {
      acc.revenu += p.revenu12mois;
      acc.coutsDirects += p.coutsDirects;
      acc.commissions += p.commission;
      acc.quotePartFrais += p.quotePartFrais;
      acc.margeBrute += p.margeBrute;
      return acc;
    },
    {
      revenu: 0,
      coutsDirects: 0,
      commissions: 0,
      quotePartFrais: 0,
      margeBrute: 0,
    },
  );

  return {
    projects,
    quotePartParContrat: quotePartAnnuelleParContrat,
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
          dateSignature: true,
          modalitePaiement: true,
          statut: true,
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

  const chargesMoyennesMensuelles =
    expensesLast6m.reduce((s, e) => s + Number(e.montantTTC), 0) / 6;
  const salaireFixeNonCommercial = nonCommercialsActifs.reduce(
    (s, u) => s + Number(u.salaireBase ?? 0),
    0,
  );
  const fraisFixesMensuels =
    chargesMoyennesMensuelles + salaireFixeNonCommercial;
  const quotePartFrais = (fraisFixesMensuels * 12) / Math.max(nbContrats, 1);

  const revenu = Number(contract.valeurAn1);
  const coutsDirects = contract.products.reduce((s, p) => {
    const oneShot = Number(p.coutOneShot ?? 0);
    const mensuel = Number(p.coutMensuel ?? 0);
    return s + oneShot + mensuel * 12;
  }, 0);
  const tauxCom = Number(contract.assigneA.tauxCommissionSignature);
  const commission = revenu * tauxCom;
  const margeBrute = revenu - coutsDirects - commission - quotePartFrais;
  const rentabilite = revenu > 0 ? margeBrute / revenu : 0;

  return {
    contractId: contract.id,
    numero: contract.numero,
    raisonSociale: contract.prospect.raisonSociale,
    commercialeName: contract.assigneA.name,
    dateSignature: contract.dateSignature,
    modalitePaiement: contract.modalitePaiement,
    statut: contract.statut,
    revenu12mois: revenu,
    coutsDirects,
    commission,
    quotePartFrais,
    margeBrute,
    rentabilite,
  };
}
