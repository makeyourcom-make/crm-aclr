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
  provisionImpots: number;
  margeNette: number;
  /** marge nette / revenu — entre -∞ et 1. */
  rentabilite: number;
}

export interface ProjectMarginCockpit {
  projects: ProjectMargin[];
  /** Coût mensuel moyen alloué par contrat (info en bas de page). */
  quotePartParContrat: number;
  /** Taux d'impôts utilisé pour la projection. */
  tauxImpots: number;
  totals: {
    revenu: number;
    coutsDirects: number;
    commissions: number;
    quotePartFrais: number;
    margeBrute: number;
    provisionImpots: number;
    margeNette: number;
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

  const tauxImpots = Number(settings?.tauxImpotsProvisionne ?? 0.25);

  // ----- Calcul de marge pour chaque contrat -----------------------------
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
    const provisionImpots = Math.max(0, margeBrute) * tauxImpots;
    const margeNette = margeBrute - provisionImpots;
    const rentabilite = revenu > 0 ? margeNette / revenu : 0;

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
      provisionImpots,
      margeNette,
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
      acc.provisionImpots += p.provisionImpots;
      acc.margeNette += p.margeNette;
      return acc;
    },
    {
      revenu: 0,
      coutsDirects: 0,
      commissions: 0,
      quotePartFrais: 0,
      margeBrute: 0,
      provisionImpots: 0,
      margeNette: 0,
    },
  );

  return {
    projects,
    quotePartParContrat: quotePartAnnuelleParContrat,
    tauxImpots,
    totals,
  };
}

/**
 * Variante : marge d'un seul contrat (pour la page détail).
 */
export async function getProjectMarginForContract(
  contractId: string,
): Promise<ProjectMargin | null> {
  const all = await getProjectMargins();
  return all.projects.find((p) => p.contractId === contractId) ?? null;
}
