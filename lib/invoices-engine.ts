/**
 * Moteur de facturation Sophie → Arthur (étape 14).
 *
 * Une fois par mois, on génère 1 Invoice par commerciale active qui :
 *   - somme les CommissionPayment du mois en statut PAYE (acquis durant ce mois)
 *   - applique la garantie absorbable (CHF 2'500 minimum)
 *   - ajoute le forfait frais (CHF 250)
 *
 * total = max(commissions, garantieMensuelle) + forfaitFrais
 *
 * Le job CRON (étape 27) appellera generateMonthlyInvoicesForAll(prevMonth)
 * au 1er de chaque mois à 02:00.
 */
import { PrismaClient } from "@prisma/client";

import {
  chfToCents,
  centsToChf,
  computeMonthlyInvoice,
} from "@/lib/commissions";
import { prisma } from "@/lib/db";
import { computePayslip } from "@/lib/salary-payslip";

/**
 * Préfixe de référence des bulletins de salaire : neutre (nom de l'entreprise),
 * JAMAIS le nom d'un collaborateur. Les bulletins sont numérotés en séquence
 * globale par année → MAKE-2026-01, MAKE-2026-02, …
 */
const SALARY_REF_PREFIX = "MAKE";


type PrismaLike =
  | PrismaClient
  | Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >;

export interface GenerateInvoiceResult {
  ok: boolean;
  invoiceId?: string;
  numero?: string;
  error?: string;
  /** Détail pour debug / affichage */
  details?: {
    montantCommissionsCents: number;
    montantGarantieAbsorbeeCents: number;
    montantFraisCents: number;
    montantTotalCents: number;
    nbCommissionPayments: number;
  };
}

// ---------------------------------------------------------------------------
// Génère une facture pour un user / un mois donné (idempotent)
// ---------------------------------------------------------------------------

export async function generateMonthlyInvoice(
  userId: string,
  annee: number,
  mois: number, // 1-12
  tx?: PrismaLike,
): Promise<GenerateInvoiceResult> {
  const db = tx ?? prisma;

  // 1. Charger l'utilisateur
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      isActive: true,
      garantieMensuelle: true,
      forfaitFrais: true,
    },
  });
  if (!user) {
    return { ok: false, error: "Utilisateur introuvable." };
  }

  // 2. Bornes du mois facturé (en UTC, pour un libellé de mois stable quel que
  //    soit le fuseau du serveur/appelant — sinon le 1er du mois en heure locale
  //    bascule au mois précédent une fois converti en UTC).
  const startMonth = new Date(Date.UTC(annee, mois - 1, 1, 0, 0, 0));
  const endMonth = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999));
  const moisDate = startMonth;

  // 3. Vérifier qu'on n'a pas déjà une facture pour ce user/mois
  const existing = await db.invoice.findUnique({
    where: { userId_mois: { userId, mois: moisDate } },
  });
  if (existing) {
    return {
      ok: false,
      error: `Facture déjà existante (${existing.referenceFacture}).`,
    };
  }

  // 4. Fiche de paye du mois = TOUT versement (signature 25 %, étalement du
  //    50 %, renouvellement 10 %) dû ce mois (date prévue dans le mois), sur
  //    un contrat réellement signé, hors annulés. Qu'il soit déjà payé ou
  //    encore prévu : c'est le montant dû à la personne pour le mois.
  const acquisDuMois = await db.commissionPayment.findMany({
    where: {
      commission: {
        userId,
        contract: {
          statut: {
            notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
          },
        },
      },
      statut: { not: "ANNULE" },
      dateVersementPrevue: { gte: startMonth, lte: endMonth },
    },
    select: { id: true, montant: true, typePart: true },
  });

  // 5. Sommer en cents pour précision exacte
  const commissionsCents = acquisDuMois.reduce(
    (sum, p) => sum + chfToCents(Number(p.montant)),
    0,
  );

  // 6. Appliquer la garantie + forfait via le moteur de calcul pur
  const calc = computeMonthlyInvoice({
    commissionsEncaisseesCents: commissionsCents,
    garantieMensuelleCents: chfToCents(Number(user.garantieMensuelle)),
    forfaitFraisCents: chfToCents(Number(user.forfaitFrais)),
  });

  // 7. Référence MAKE-{YYYY}-{NN} : préfixe neutre de l'entreprise (jamais le
  //    nom d'un collaborateur) + séquence GLOBALE par année (unique).
  const counter = await db.counter.upsert({
    where: { scope_year: { scope: "salaire", year: annee } },
    create: { scope: "salaire", year: annee, value: 1 },
    update: { value: { increment: 1 } },
  });
  const referenceFacture = `${SALARY_REF_PREFIX}-${annee}-${String(counter.value).padStart(2, "0")}`;

  // 8. Montant VERSÉ = net de la fiche de paye (brut avec indemnités - cotisations
  //    + frais). Le « salaire de base » = commissions + éventuelle garantie absorbée.
  const pay = computePayslip({
    baseCommission: centsToChf(commissionsCents + calc.garantieAbsorbeeCents),
    frais: centsToChf(calc.fraisCents),
  });

  // 9. Création de l'Invoice + liens vers les CommissionPayment couverts
  const created = await db.invoice.create({
    data: {
      userId,
      mois: moisDate,
      montantCommissions: centsToChf(commissionsCents),
      montantGarantieAbsorbee: centsToChf(calc.garantieAbsorbeeCents),
      montantFrais: centsToChf(calc.fraisCents),
      montantTotal: pay.montantVerse,
      statut: "BROUILLON",
      referenceFacture,
      // Lier tous les CommissionPayment du mois pour le détail PDF
      commissionPayments: {
        connect: acquisDuMois.map((p) => ({ id: p.id })),
      },
    },
  });

  return {
    ok: true,
    invoiceId: created.id,
    numero: referenceFacture,
    details: {
      montantCommissionsCents: commissionsCents,
      montantGarantieAbsorbeeCents: calc.garantieAbsorbeeCents,
      montantFraisCents: calc.fraisCents,
      montantTotalCents: chfToCents(pay.montantVerse),
      nbCommissionPayments: acquisDuMois.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Génération en batch pour TOUS les users actifs (job CRON)
// ---------------------------------------------------------------------------

export interface BatchResult {
  total: number;
  generated: GenerateInvoiceResult[];
  skipped: Array<{ userId: string; reason: string }>;
}

export async function generateMonthlyInvoicesForAll(
  annee: number,
  mois: number,
): Promise<BatchResult> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const generated: GenerateInvoiceResult[] = [];
  const skipped: BatchResult["skipped"] = [];

  for (const u of users) {
    const res = await generateMonthlyInvoice(u.id, annee, mois);
    if (res.ok) {
      generated.push(res);
    } else {
      skipped.push({ userId: u.id, reason: res.error ?? "Inconnu" });
    }
  }

  return { total: users.length, generated, skipped };
}
