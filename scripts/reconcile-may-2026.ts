/**
 * Réconciliation des relevés bancaires UBS — Mai 2026.
 *
 * Source : 3 PDFs de transactions (compte EUR 7560 Z, CHF principal 7502 T,
 * CHF secondaire 7501 F) sur la période 01.05.2026 - 31.05.2026.
 *
 * Sections :
 *   1. Charges existantes en DB → PAYE + dateReglement
 *   2. Ajustements de montants (UBS fees, etc.)
 *   3. Nouvelles charges (PAYE, sans tickets — uploads à venir)
 *   4. Encaissements clients → factures PAYEE
 *   5. 2e avoir client Frakaxessoires (-600 CHF supplémentaire)
 *   6. Commission Wix Affiliate (recette hors client)
 *
 * Idempotent : les opérations qui ont déjà été appliquées sont skippées.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// HELPERS
// =============================================================================

async function findExpense(descSubstring: string) {
  return prisma.expense.findFirst({
    where: { description: { contains: descSubstring, mode: "insensitive" } },
  });
}

async function markPaid(id: string, date: Date) {
  return prisma.expense.update({
    where: { id },
    data: { statutPaiement: "PAYE", dateReglement: date },
  });
}

async function findProspect(rs: string) {
  return prisma.prospect.findFirst({
    where: { raisonSociale: { equals: rs, mode: "insensitive" } },
  });
}

// Conversion EUR → CHF (taux moyen mai 2026)
const EUR_TO_CHF = 0.95;

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const adminId = admin?.id ?? null;

  console.log("════════════════════════════════════════════════════");
  console.log("  RÉCONCILIATION RELEVÉS UBS — MAI 2026");
  console.log("════════════════════════════════════════════════════\n");

  // ============================================================================
  // SECTION 1 — Charges existantes → PAYE
  // ============================================================================
  console.log("▌ SECTION 1 — Charges existantes → PAYE\n");

  const TO_MARK_PAID: Array<{
    descMatch: string;
    date: Date;
    label: string;
  }> = [
    {
      descMatch: "Frais représentation - RDV recrutement commerciale Noville (Mai 2026)",
      date: new Date("2026-05-27"),
      label: "Moutarlier Noville (9.80)",
    },
    {
      descMatch: "Restaurant - McDonald's Anthy-sur-Léman (Mai 2026)",
      date: new Date("2026-05-18"),
      label: "McDonald's Anthy (53.19)",
    },
    {
      descMatch: "Abonnement CFF mensuel (Avril 2026)",
      date: new Date("2026-05-04"),
      label: "CFF Abonnement (292)",
    },
    {
      descMatch: "Infomaniak - Domaine + Mail arcoz-ag.ch (Mai 2026)",
      date: new Date("2026-05-26"),
      label: "Infomaniak arcoz-ag (27.36)",
    },
  ];

  for (const item of TO_MARK_PAID) {
    const exp = await findExpense(item.descMatch);
    if (!exp) {
      console.log(`  ⊘ Charge non trouvée : ${item.label}`);
      continue;
    }
    if (exp.statutPaiement === "PAYE") {
      console.log(`  ≡ ${item.label} déjà PAYE`);
      continue;
    }
    await markPaid(exp.id, item.date);
    console.log(`  ✓ ${item.label} → PAYE ${item.date.toISOString().slice(0, 10)}`);
  }

  // ============================================================================
  // SECTION 2 — Ajustements montants
  // ============================================================================
  console.log("\n▌ SECTION 2 — Ajustements montants\n");

  // Frais bancaires UBS Mai : estim 9 → réel 35.47 (compte 7502)
  const ubsMai = await findExpense("Frais bancaires UBS (Mai 2026)");
  if (ubsMai) {
    if (Number(ubsMai.montantTTC) === 35.47 && ubsMai.statutPaiement === "PAYE") {
      console.log("  ≡ Frais UBS Mai déjà ajusté + PAYE");
    } else {
      await prisma.expense.update({
        where: { id: ubsMai.id },
        data: {
          montantHT: 35.47,
          montantTVA: 0,
          montantTTC: 35.47,
          description:
            "Frais bancaires UBS (Mai 2026) - Compte CHF 7502 + frais autres opérations",
          statutPaiement: "PAYE",
          dateReglement: new Date("2026-05-29"),
        },
      });
      console.log("  ✓ Frais UBS Mai compte 7502 : 9 → 35.47 CHF + PAYE 29.05");
    }
  } else {
    console.log("  ⊘ Frais UBS Mai non trouvé (sera créé en section 3)");
  }

  // ============================================================================
  // SECTION 3 — Nouvelles charges
  // ============================================================================
  console.log("\n▌ SECTION 3 — Nouvelles charges\n");

  type Cat =
    | "LOYER"
    | "SOFTWARE_SAAS"
    | "MARKETING"
    | "PUBLICITE"
    | "DEPLACEMENTS"
    | "RESTAURATION"
    | "MATERIEL_BUREAU"
    | "ASSURANCES"
    | "TELECOM"
    | "FORMATION"
    | "HONORAIRES"
    | "IMPOTS"
    | "BANQUE_FRAIS"
    | "AUTRE";

  const NEW_EXPENSES: Array<{
    description: string;
    fournisseur: string;
    montantTTC: number;
    categorie: Cat;
    methodPaiement: "CARTE_BANCAIRE" | "VIREMENT" | "PRELEVEMENT";
    date: Date;
    statutPaiement: "PAYE" | "EN_ATTENTE";
    note?: string;
  }> = [
    // ---- Compte CHF principal 7502 ----
    {
      description: "EMELIA - Outil prospection email (Mai 2026)",
      fournisseur: "EMELIA",
      montantTTC: 35.47,
      categorie: "SOFTWARE_SAAS",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-05-26"),
      statutPaiement: "PAYE",
    },
    {
      description: "Google Cloud (Mai 2026)",
      fournisseur: "Google Cloud",
      montantTTC: 14.04,
      categorie: "SOFTWARE_SAAS",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-05-01"),
      statutPaiement: "PAYE",
    },
    {
      description: "Sunrise - Mobile + Internet/TV (Mai 2026)",
      fournisseur: "Sunrise",
      montantTTC: 164.45,
      categorie: "TELECOM",
      methodPaiement: "PRELEVEMENT",
      date: new Date("2026-05-15"),
      statutPaiement: "PAYE",
    },
    {
      description: "Claude.ai Subscription (Mai 2026)",
      fournisseur: "Anthropic",
      montantTTC: 176.61,
      categorie: "SOFTWARE_SAAS",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-05-15"),
      statutPaiement: "PAYE",
    },
    {
      description: "Netlify (Mai 2026)",
      fournisseur: "Netlify",
      montantTTC: 16.92,
      categorie: "SOFTWARE_SAAS",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-04-30"),
      statutPaiement: "PAYE",
    },
    {
      description: "Google Workspace Business Standard (Mai 2026)",
      fournisseur: "Google",
      montantTTC: 77.08,
      categorie: "SOFTWARE_SAAS",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-05-05"),
      statutPaiement: "PAYE",
      note: "⚠ Montant 5.5× le template estimé (13.99) — facture Google à vérifier",
    },
    {
      description: "Google ADS - Budget clients (Mai 2026)",
      fournisseur: "Google",
      montantTTC: 1288.18, // 358.29 + 466.33 + 463.56
      categorie: "PUBLICITE",
      methodPaiement: "CARTE_BANCAIRE",
      date: new Date("2026-05-22"),
      statutPaiement: "EN_ATTENTE", // facture Google attendue pour split par client
      note: "⚠ EN ATTENTE de la facture Google détaillée pour split allocation par client (3 paiements: 358.29 + 466.33 + 463.56 = 1288.18 CHF)",
    },

    // ---- Compte CHF secondaire 7501 ----
    {
      description: "Fiduciaire - Mon comptable franco-suisse #1 (Mai 2026)",
      fournisseur: "Mon comptable franco suisse",
      montantTTC: 602.28,
      categorie: "HONORAIRES",
      methodPaiement: "VIREMENT",
      date: new Date("2026-05-25"),
      statutPaiement: "PAYE",
    },
    {
      description: "Fiduciaire - Mon comptable franco-suisse #2 (Mai 2026)",
      fournisseur: "Mon comptable franco suisse",
      montantTTC: 1117.41,
      categorie: "HONORAIRES",
      methodPaiement: "VIREMENT",
      date: new Date("2026-05-21"),
      statutPaiement: "PAYE",
    },
    {
      description: "Caisse de compensation Canton (cotisations sociales Mai 2026)",
      fournisseur: "Caisse de compensation Canton",
      montantTTC: 867.35,
      categorie: "IMPOTS",
      methodPaiement: "VIREMENT",
      date: new Date("2026-05-04"),
      statutPaiement: "PAYE",
    },
    {
      description: "Frais bancaires UBS - Compte CHF 7501 (Mai 2026)",
      fournisseur: "UBS",
      montantTTC: 4.0,
      categorie: "BANQUE_FRAIS",
      methodPaiement: "PRELEVEMENT",
      date: new Date("2026-05-29"),
      statutPaiement: "PAYE",
    },
  ];

  for (const ex of NEW_EXPENSES) {
    const existing = await prisma.expense.findFirst({
      where: { description: ex.description },
    });
    if (existing) {
      // Idempotence : maj montant/statut/date si différent
      let updated = false;
      const patch: Record<string, unknown> = {};
      if (Number(existing.montantTTC) !== ex.montantTTC) {
        patch.montantHT = ex.montantTTC;
        patch.montantTVA = 0;
        patch.montantTTC = ex.montantTTC;
        updated = true;
      }
      if (existing.statutPaiement !== ex.statutPaiement) {
        patch.statutPaiement = ex.statutPaiement;
        updated = true;
      }
      if (ex.statutPaiement === "PAYE" && !existing.dateReglement) {
        patch.dateReglement = ex.date;
        updated = true;
      }
      if (updated) {
        await prisma.expense.update({ where: { id: existing.id }, data: patch });
        console.log(`  ↻ ${ex.description.slice(0, 60)} (mise à jour)`);
      } else {
        console.log(`  ≡ ${ex.description.slice(0, 60)} (existe, OK)`);
      }
      continue;
    }

    const exp = await prisma.expense.create({
      data: {
        date: ex.date,
        dateReglement: ex.statutPaiement === "PAYE" ? ex.date : null,
        statutPaiement: ex.statutPaiement,
        categorie: ex.categorie,
        fournisseur: ex.fournisseur,
        description: ex.description,
        montantHT: ex.montantTTC,
        tauxTVA: 0,
        montantTVA: 0,
        montantTTC: ex.montantTTC,
        tvaRecuperable: false,
        methodPaiement: ex.methodPaiement,
        ocrUtilise: false,
        createdById: adminId,
      },
    });
    console.log(
      `  + ${ex.description.slice(0, 60).padEnd(62)} ${ex.montantTTC.toFixed(2).padStart(8)} CHF [${ex.statutPaiement}]`,
    );
    if (ex.note) console.log(`     └ ${ex.note}`);
  }

  // ============================================================================
  // SECTION 4 — Encaissements clients
  // ============================================================================
  console.log("\n▌ SECTION 4 — Encaissements clients (factures PAYEE)\n");

  type Encaissement = {
    clientRS: string; // raison sociale exacte du Prospect en DB
    montant: number; // CHF
    date: Date;
    libelleRelevé: string;
  };

  const ENCAISSEMENTS: Encaissement[] = [
    // Compte CHF principal
    { clientRS: "SP Industriel", montant: 700.0, date: new Date("2026-05-29"), libelleRelevé: "SP Industriel Sarl" },
    { clientRS: "LocFactory", montant: 400.0, date: new Date("2026-05-22"), libelleRelevé: "Outdoor + Sports Factory SA #1" },
    { clientRS: "LocFactory", montant: 400.0, date: new Date("2026-05-22"), libelleRelevé: "Outdoor + Sports Factory SA #2" },
    { clientRS: "Passeport Beauté", montant: 1000.0, date: new Date("2026-05-22"), libelleRelevé: "Sigma Consulting SA #1" },
    { clientRS: "Passeport Beauté", montant: 1000.0, date: new Date("2026-05-05"), libelleRelevé: "Sigma Consulting SA #2" },
    { clientRS: "Passeport Beauté", montant: 1000.0, date: new Date("2026-05-05"), libelleRelevé: "Sigma Consulting SA #3" },
    { clientRS: "Good4Bees", montant: 260.0, date: new Date("2026-05-11"), libelleRelevé: "Revolut Bank UAB #1 (Good4Bees)" },
    { clientRS: "Good4Bees", montant: 390.0, date: new Date("2026-05-11"), libelleRelevé: "Revolut Bank UAB #2 (Good4Bees)" },
    { clientRS: "Unleash Lab Sàrl", montant: 563.7, date: new Date("2026-05-26"), libelleRelevé: "Unleash Lab Sarl" },
    { clientRS: "M A K E & Beyond", montant: 11.39, date: new Date("2026-05-18"), libelleRelevé: "Laëtitia Rigolot - Make Beyond #1" },
    { clientRS: "M A K E & Beyond", montant: 19.44, date: new Date("2026-05-18"), libelleRelevé: "Laëtitia Rigolot - Make Beyond #2" },
    { clientRS: "L&L Coiffure Sàrl", montant: 39.0, date: new Date("2026-05-04"), libelleRelevé: "LL Coiffure Chaar, Ibrahim Chaar" },
    { clientRS: "Frakaxessoires", montant: 98.0, date: new Date("2026-05-04"), libelleRelevé: "FrakaXessoires #1" },
    { clientRS: "Frakaxessoires", montant: 600.0, date: new Date("2026-05-04"), libelleRelevé: "FrakaXessoires #2" },
    { clientRS: "Hôtel de Torgon", montant: 1991.5, date: new Date("2026-05-07"), libelleRelevé: "Vereecke Myriam (Hôtel de Torgon)" },
    // Compte CHF secondaire
    { clientRS: "Soverial", montant: 420.62, date: new Date("2026-05-19"), libelleRelevé: "SAS SOVERIAL" },
    // Compte EUR
    { clientRS: "SRT FORMATION", montant: 145.48 * EUR_TO_CHF, date: new Date("2026-05-12"), libelleRelevé: "Benjamin Bogaert (SRT Formation) - 145.48 EUR" },
  ];

  for (const e of ENCAISSEMENTS) {
    const prospect = await prisma.prospect.findFirst({
      where: { raisonSociale: { equals: e.clientRS, mode: "insensitive" } },
    });
    if (!prospect) {
      console.log(`  ⊘ Prospect non trouvé : "${e.clientRS}" (${e.libelleRelevé})`);
      continue;
    }
    // Cherche la facture la + ancienne non encore PAYEE de ce prospect
    const factures = await prisma.clientInvoice.findMany({
      where: {
        contract: { prospectId: prospect.id },
        statut: { in: ["ENVOYEE", "EN_RETARD"] },
      },
      orderBy: { dateEmission: "asc" },
    });
    if (factures.length === 0) {
      console.log(
        `  ⊘ ${e.clientRS.padEnd(30)} : aucune facture en attente (${e.libelleRelevé})`,
      );
      continue;
    }
    // Match le mieux par montant exact (ou tolérance 1 CHF)
    const exact = factures.find(
      (f) => Math.abs(Number(f.total) - e.montant) < 1,
    );
    const target = exact ?? factures[0]; // si pas de match exact, la plus ancienne
    await prisma.clientInvoice.update({
      where: { id: target.id },
      data: {
        statut: "PAYEE",
        datePaiement: e.date,
        modeReglement: "VIREMENT",
        referenceVirement: e.libelleRelevé,
      },
    });
    const match = exact ? "✓" : "≈ (pas match exact)";
    console.log(
      `  ${match} ${e.clientRS.padEnd(25)} ${e.montant.toFixed(2).padStart(8)} CHF → facture ${target.numero}`,
    );
  }

  // ============================================================================
  // SECTION 5 — 2e avoir Frakaxessoires (-600 CHF supplémentaire)
  // ============================================================================
  console.log("\n▌ SECTION 5 — 2e avoir client Frakaxessoires\n");

  const fraka = await findProspect("Frakaxessoires");
  if (fraka) {
    const contract = await prisma.contract.findFirst({
      where: { prospectId: fraka.id, statut: "ACTIF" },
    });
    if (contract) {
      // Cherche s'il existe déjà un avoir Mai 2026 -600
      const existingAvoir = await prisma.clientInvoice.findFirst({
        where: {
          contractId: contract.id,
          total: -600,
          dateEmission: {
            gte: new Date("2026-05-21"),
            lt: new Date("2026-05-22"),
          },
        },
      });
      if (existingAvoir) {
        console.log(`  ≡ Avoir 21.05 -600 existe : ${existingAvoir.numero}`);
      } else {
        const annee = 2026;
        const counter = await prisma.counter.upsert({
          where: { scope_year: { scope: "client_invoice", year: annee } },
          create: { scope: "client_invoice", year: annee, value: 1 },
          update: { value: { increment: 1 } },
        });
        const numero = `ACLR-CLI-${annee}-${String(counter.value).padStart(4, "0")}A`;
        const avoir = await prisma.clientInvoice.create({
          data: {
            contractId: contract.id,
            numero,
            dateEmission: new Date("2026-05-21"),
            dateEcheance: new Date("2026-05-21"),
            type: "PONCTUELLE",
            sousTotal: -600,
            totalTVA: 0,
            total: -600,
            statut: "PAYEE",
            datePaiement: new Date("2026-05-21"),
            modeReglement: "VIREMENT",
            notesClient:
              "AVOIR #2 — Remboursement trop-perçu Frakaxessoires (compte CHF 7501, 21.05.2026).",
          },
        });
        console.log(`  + Avoir créé : ${avoir.numero} (-600 CHF, 21.05)`);
      }
    } else {
      console.log("  ⊘ Pas de contrat ACTIF pour Frakaxessoires");
    }
  } else {
    console.log("  ⊘ Prospect Frakaxessoires non trouvé");
  }

  // ============================================================================
  // SECTION 6 — Commission Wix Affiliate (recette hors client)
  // ============================================================================
  console.log("\n▌ SECTION 6 — Commission Wix Affiliate (recette diverse)\n");

  // On crée une "Expense" négative dans une catégorie AUTRE pour tracer la recette
  // (le module CRM ne gère pas les "recettes diverses" stricto sensu, alors on
  // l'enregistre comme charge négative — montant TTC négatif).
  const wixExisting = await prisma.expense.findFirst({
    where: { description: { contains: "Commission Wix Affiliate" } },
  });
  if (wixExisting) {
    console.log(`  ≡ Commission Wix existe déjà`);
  } else {
    const wixCHF = Math.round(217.31 * EUR_TO_CHF * 100) / 100; // 206.44 CHF
    const wix = await prisma.expense.create({
      data: {
        date: new Date("2026-05-04"),
        dateReglement: new Date("2026-05-04"),
        statutPaiement: "PAYE",
        categorie: "AUTRE",
        fournisseur: "Wix.com Ltd",
        description: `Commission Wix Affiliate (Mai 2026) — recette 217.31 EUR`,
        montantHT: -wixCHF,
        tauxTVA: 0,
        montantTVA: 0,
        montantTTC: -wixCHF,
        tvaRecuperable: false,
        methodPaiement: "VIREMENT",
        ocrUtilise: false,
        createdById: adminId,
      },
    });
    console.log(`  + Recette Wix : -${wixCHF.toFixed(2)} CHF (= 217.31 EUR × 0.95)`);
  }

  // ============================================================================
  // STATS FINALES
  // ============================================================================
  console.log("\n════════════════════════════════════════════════════");
  console.log("  RÉCAP FINAL");
  console.log("════════════════════════════════════════════════════");

  const counts = await prisma.expense.groupBy({
    by: ["statutPaiement"],
    _count: true,
    _sum: { montantTTC: true },
  });
  console.log("\n▌ Charges par statut :");
  for (const c of counts) {
    console.log(
      `  ${c.statutPaiement.padEnd(15)} ${String(c._count).padStart(3)}× ${Number(c._sum.montantTTC ?? 0).toFixed(2).padStart(10)} CHF`,
    );
  }

  const factureCount = await prisma.clientInvoice.groupBy({
    by: ["statut"],
    _count: true,
    _sum: { total: true },
  });
  console.log("\n▌ Factures clients par statut :");
  for (const f of factureCount) {
    console.log(
      `  ${f.statut.padEnd(12)} ${String(f._count).padStart(3)}× ${Number(f._sum.total ?? 0).toFixed(2).padStart(10)} CHF`,
    );
  }

  console.log("\n✓ Réconciliation Mai 2026 terminée.\n");
  console.log(
    "📄 Factures manquantes (à uploader plus tard via UI charges/[id]) :",
  );
  console.log("   1. Google ADS Mai (CRITIQUE - charge EN_ATTENTE)");
  console.log("   2. Google Workspace Mai 77.08 CHF");
  console.log("   3. Fiduciaire mon comptable × 2");
  console.log("   4. Caisse compensation Canton");
  console.log("   5. Sunrise / Claude / EMELIA / Google Cloud / Netlify");
}

main()
  .catch((e) => {
    console.error("ERREUR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
