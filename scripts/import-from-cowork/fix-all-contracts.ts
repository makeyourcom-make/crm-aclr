/**
 * Correctif consolidé : ajuste tous les contrats avec les vraies données
 * métier (montants, modalités, durées, notes de renouvellement) telles que
 * fournies par Arthur après l'import initial.
 *
 * Pour chaque client, on définit le contrat "vrai" (montants exacts,
 * dateDebut, dureeMois, modalité) et on met une note claire avec :
 *   - Modèle de facturation (mensuel / annuel one-shot)
 *   - Ratio de marge pour les revenus passthrough (Google Ads notamment)
 *   - Date prévue de renouvellement / fin
 */
import { type ContractStatut, type ModalitePaiement, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ContractPatch {
  /** Pattern pour retrouver le prospect (substring) */
  clientMatch: string;
  /** Nouveau numéro à donner si on transforme un placeholder */
  targetNumero?: string;
  /** Si différent, on remplace tous les contrats matchant le pattern */
  targetExistingNumero?: string;
  dateDebut: string; // YYYY-MM-DD
  dureeMois: number;
  modalitePaiement: ModalitePaiement;
  montantOneShot: number;
  montantMensuel: number;
  valeurAn1: number;
  statut: ContractStatut;
  /** Si true, le contrat se reconduit tacitement. False = mission unique. */
  reconductible: boolean;
  notesProspect: string;
}

const PATCHES: ContractPatch[] = [
  // ---- AN Sanitaire : 39/mois → 468/an, facture annuelle ----
  {
    clientMatch: "AN Sanitaire",
    targetNumero: "CTR-AN-SANITAIRE-2026",
    dateDebut: "2026-03-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 468,
    montantMensuel: 0,
    valeurAn1: 468,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Gestion site internet — 39 CHF/mois équivalent (facturé en 1 fois annuelle).",
      "Total an : 468 CHF — facture 26-52.",
      "Prochain renouvellement : 01.03.2027.",
    ].join("\n"),
  },

  // ---- Casavue : 49/mois → 588/an, facture annuelle ----
  {
    clientMatch: "Casavue",
    targetExistingNumero: "CTR-2611",
    dateDebut: "2025-04-15",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 588,
    montantMensuel: 0,
    valeurAn1: 588,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Gestion site internet — 49 CHF/mois équivalent (facturé en 1 fois annuelle).",
      "Total an : 588 CHF — renouvellement automatique en juin.",
      "Prochain renouvellement : 15.04.2026 (facture 26-84 émise).",
    ].join("\n"),
  },

  // ---- Coiffure St Honoré : 150/mois Google Ads, marge 30% ----
  {
    clientMatch: "Coiffure St Honoré",
    targetNumero: "CTR-COIFFURE-ST-HONORE-2026",
    dateDebut: "2026-04-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 1800,
    montantMensuel: 0,
    valeurAn1: 1800,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Google Ads — 150 CHF/mois facturé annuellement (1 800 CHF/an).",
      "⚠ MARGE 30 % seulement : sur 150 CHF, ACLR garde 45 CHF, 105 CHF = budget Google Ads (passthrough).",
      "→ CA réel ACLR : 540 CHF/an (à imputer dans la rentabilité).",
      "Prochain renouvellement : 01.04.2027.",
    ].join("\n"),
  },

  // ---- Frakaxessoires : ANCIEN contrat CTR-2602 (815.57/an) ----
  // Hist : Création site + ancien forfait. Garde tel quel mais clarifie.
  {
    clientMatch: "Frakaxessoires",
    targetExistingNumero: "CTR-2602",
    dateDebut: "2025-04-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 815.57,
    montantMensuel: 0,
    valeurAn1: 815.57,
    statut: "EXPIRE", // remplacé par CTR-2618
    reconductible: false,
    notesProspect: "Ancien contrat 2025 — remplacé par CTR-2618 depuis le 01.03.2026.",
  },

  // ---- Hôtel de Torgon : 139/mois (100 RS + 39 site), facture mensuelle ----
  // Mise à jour de CTR-2607 + transformation du placeholder 26-68
  {
    clientMatch: "Hôtel de Torgon",
    targetExistingNumero: "CTR-2607",
    dateDebut: "2025-03-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 139,
    valeurAn1: 1668,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Réseaux sociaux (Facebook + Instagram, 1 post/semaine) + Gestion site internet.",
      "Facturation mensuelle : 100 CHF (RS) + 39 CHF (site) = 139 CHF/mois.",
      "Total annuel : 1 668 CHF.",
      "Prochain renouvellement annuel : mars 2027.",
      "",
      "NB : la facture 26-68 (1 991.50 CHF) couvre la création de site internet 1/2 — projet exceptionnel hors abonnement, gérée via le contrat placeholder dédié.",
    ].join("\n"),
  },

  // ---- L&L Coiffure : 39/mois gestion site, facture mensuelle ----
  // CTR-2609 existe avec 468/an. Bascule en mensuel.
  {
    clientMatch: "L&L Coiffure Sàrl",
    targetExistingNumero: "CTR-2609",
    dateDebut: "2025-11-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 39,
    valeurAn1: 468,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Gestion site internet — 39 CHF/mois (facture mensuelle).",
      "Total an : 468 CHF.",
      "Prochain renouvellement annuel : novembre 2026.",
    ].join("\n"),
  },

  // ---- La Dent Byantse : 500/mois Google Ads, marge 30% ----
  {
    clientMatch: "La Dent Byantse",
    targetExistingNumero: "CTR-2606",
    dateDebut: "2025-01-31",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 500,
    valeurAn1: 6000,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Google Ads — 500 CHF/mois (facture mensuelle).",
      "⚠ MARGE 30 % seulement : sur 500 CHF, ACLR garde 150 CHF, 350 CHF = budget Google Ads (passthrough).",
      "→ CA réel ACLR : 1 800 CHF/an (à imputer dans la rentabilité).",
      "Prochain renouvellement annuel : janvier 2027.",
    ].join("\n"),
  },

  // ---- Lina Coiffure : 168/an, facture annuelle ----
  {
    clientMatch: "Lina Coiffure",
    targetExistingNumero: "CTR-2617",
    dateDebut: "2025-01-31",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 168,
    montantMensuel: 0,
    valeurAn1: 168,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Gestion site internet WIX — facturation annuelle 168 CHF.",
      "Prochain renouvellement : janvier 2026 (à émettre).",
    ].join("\n"),
  },

  // ---- Lionel Briquet : 317/an ----
  {
    clientMatch: "Lionel Briquet",
    targetExistingNumero: "CTR-2613",
    dateDebut: "2025-04-15",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 317,
    montantMensuel: 0,
    valeurAn1: 317,
    statut: "ACTIF",
    reconductible: true,
    notesProspect: [
      "Gestion site physio-montreux.ch — facturation annuelle 317 CHF.",
      "Inclus : domaine physio-montreux.ch (LWS) — refacturé via contrat (cf. CGV §6.3).",
      "Prochain renouvellement : 15.04.2026 (facture 26-83 planifiée).",
    ].join("\n"),
  },
];

async function applyPatch(p: ContractPatch) {
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: p.clientMatch } },
    include: { contracts: true },
  });
  if (!prospect) {
    console.log(`  ⊘ Prospect "${p.clientMatch}" introuvable`);
    return { ok: false };
  }

  // Trouve le contrat à patcher
  let target;
  if (p.targetExistingNumero) {
    target = prospect.contracts.find((c) => c.numero === p.targetExistingNumero);
  } else {
    // Cherche un placeholder à transformer
    target = prospect.contracts.find((c) => c.numero.startsWith("PLACEHOLDER-"));
  }

  if (!target) {
    console.log(`  ⊘ ${p.clientMatch} : aucun contrat à patcher trouvé`);
    return { ok: false };
  }

  await prisma.contract.update({
    where: { id: target.id },
    data: {
      ...(p.targetNumero ? { numero: p.targetNumero } : {}),
      dateSignature: new Date(p.dateDebut + "T00:00:00Z"),
      dateDebut: new Date(p.dateDebut + "T00:00:00Z"),
      dureeMois: p.dureeMois,
      modalitePaiement: p.modalitePaiement,
      montantOneShot: p.montantOneShot,
      montantMensuel: p.montantMensuel,
      valeurAn1: p.valeurAn1,
      statut: p.statut,
    },
  });

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { notesGenerales: p.notesProspect },
  });

  console.log(
    `  ✓ ${p.clientMatch.padEnd(30)} ${target.numero} → ${p.targetNumero ?? target.numero} (${p.montantMensuel > 0 ? `${p.montantMensuel} CHF/mois` : `${p.montantOneShot} CHF annuel`})`,
  );
  return { ok: true };
}

async function main() {
  console.log("=".repeat(70));
  console.log("CORRECTIF CONSOLIDÉ — vraies données métier");
  console.log("=".repeat(70));
  console.log();

  let ok = 0;
  for (const p of PATCHES) {
    const r = await applyPatch(p);
    if (r.ok) ok++;
  }

  console.log(`\n✓ ${ok}/${PATCHES.length} contrats mis à jour avec succès.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
