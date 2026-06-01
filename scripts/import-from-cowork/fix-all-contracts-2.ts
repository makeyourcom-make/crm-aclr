/**
 * Correctif consolidé partie 2 — Marie-Laure → Unleash Lab + EUR
 *
 * Inclut :
 *   - Bascule des modalités (annuel ↔ mensuel) selon les vraies cadences
 *   - Notes EUR pour les 4 contrats facturés en euros (Sidère, Soverial,
 *     TournemainConsult, SRT FORMATION) — les montants en base restent
 *     en CHF (déjà convertis par Cowork × 0.95)
 *   - SOS Pneus bi-mensuel Google Ads + marge 30 %
 *   - SP Industriel rectifié à 350/mois (pas 700)
 *   - SRT FORMATION placeholder → vrai contrat
 */
import { type ContractStatut, type ModalitePaiement, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ContractPatch {
  clientMatch: string;
  targetNumero?: string;
  targetExistingNumero?: string;
  dateDebut: string;
  dureeMois: number;
  modalitePaiement: ModalitePaiement;
  montantOneShot: number;
  montantMensuel: number;
  valeurAn1: number;
  statut: ContractStatut;
  notesProspect: string;
}

const PATCHES: ContractPatch[] = [
  // ---- Marie-Laure Sidère : 736.63 annuel, EUR ----
  {
    clientMatch: "Marie-Laure Sidère",
    targetExistingNumero: "CTR-2610",
    dateDebut: "2025-01-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 736.63,
    montantMensuel: 0,
    valeurAn1: 736.63,
    statut: "ACTIF",
    notesProspect: [
      "Gestion site internet — facture annuelle 736.63 CHF (équivalent en EUR sur compte UBS Euro).",
      "💶 FACTURÉE EN EURO — utiliser le bloc paiement EUR (IBAN CH24 0024 7247 3054 7560 Z).",
      "Prochain renouvellement : janvier 2026.",
    ].join("\n"),
  },

  // ---- Passeport Beauté : 1000/mois CMO, mensuel ----
  {
    clientMatch: "Passeport Beauté",
    targetExistingNumero: "CTR-2604",
    dateDebut: "2025-07-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 1000,
    valeurAn1: 12000,
    statut: "ACTIF",
    notesProspect: [
      "Prestations CMO (Newsletters + Réseaux Sociaux + Stratégie) — 1 000 CHF/mois.",
      "Facturation mensuelle. Total an : 12 000 CHF.",
      "Facturée via Sigma Consulting SA (CBO@sigma-sa.ch).",
      "Contact : Claudio Bocchia. IDE : CHE-106.046.001.",
      "Prochain renouvellement : juillet 2026.",
    ].join("\n"),
  },

  // ---- Qerkini Sàrl : 530.44/an annuel, gestion site + domaine ----
  {
    clientMatch: "Qerkini",
    targetExistingNumero: "CTR-2612",
    dateDebut: "2025-04-19",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 530.44,
    montantMensuel: 0,
    valeurAn1: 530.44,
    statut: "ACTIF",
    notesProspect: [
      "Gestion site internet — facture annuelle 530.44 CHF.",
      "Inclus : domaine qerkini.ch (LWS) — refacturé via contrat (cf. CGV §6.3).",
      "Gérant : Jakup Qerkini. RC CH-621.4.007.065-7.",
      "Période : 01.05.2026 → 30.04.2027 (facture 26-82 envoyée).",
      "Prochain renouvellement : mai 2027.",
    ].join("\n"),
  },

  // ---- Roch SA : licence Metricool 249/an ----
  {
    clientMatch: "Roch SA",
    targetExistingNumero: "CTR-2614",
    dateDebut: "2025-03-04",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 249,
    montantMensuel: 0,
    valeurAn1: 249,
    statut: "ACTIF",
    notesProspect: [
      "Licence Metricool — facture annuelle 249 CHF.",
      "Refacturation 1 licence sur les 15 du compte Make Media (cf. CONVENTIONS §6).",
      "Prochain renouvellement : mars 2026.",
    ].join("\n"),
  },

  // ---- SOS Pneus CTR-2605B : 59 CHF/mois gestion site, mensuel ----
  {
    clientMatch: "SOS Pneus",
    targetExistingNumero: "CTR-2605B",
    dateDebut: "2026-04-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 59,
    valeurAn1: 708,
    statut: "ACTIF",
    notesProspect: [
      "Gestion site internet — 59 CHF/mois (Pack Sérénité), facture mensuelle.",
      "",
      "🔥 ATTENTION : SOS Pneus a aussi un contrat Google Ads bi-mensuel (CTR-2605) — campagne facturée en 2 fois/mois (1er-15 + 16-fin), marge ACLR 30 % seulement.",
      "",
      "Compensation à reporter : ~190.24 CHF de sous-facturation d'avril 2026.",
      "Prochain renouvellement : avril 2027 (auto annuel).",
    ].join("\n"),
  },

  // ---- SOS Pneus CTR-2605 : Google Ads bi-mensuel, marge 30% ----
  {
    clientMatch: "SOS Pneus",
    targetExistingNumero: "CTR-2605",
    dateDebut: "2026-01-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 500, // approximation moyenne (varie selon budget Ads)
    valeurAn1: 6000, // approx (était 9198, on rapproche au CA Google réel)
    statut: "ACTIF",
    notesProspect:
      "(note centralisée sur CTR-2605B — voir là-bas pour le détail SOS Pneus)",
  },

  // ---- SP Industriel : 350/mois pour Réseaux Sociaux, facture bi-mensuelle ----
  // (= une facture toutes les 2 semaines : 175 CHF, total 350/mois moyenné)
  {
    clientMatch: "SP Industriel",
    targetExistingNumero: "CTR-2608",
    dateDebut: "2023-10-01",
    dureeMois: 12,
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 350,
    valeurAn1: 4200,
    statut: "ACTIF",
    notesProspect: [
      "Réseaux Sociaux — 350 CHF/mois équivalent, facturation BI-MENSUELLE (1 facture toutes les 2 semaines, ~175 CHF chacune).",
      "Total annuel : 4 200 CHF.",
      "Sous-traitance partielle avec Lucas Carlin (cf. CONVENTIONS §6).",
      "Contact : s.garcia@spindustriel.ch.",
      "Contrat depuis octobre 2023 — reconduction tacite annuelle.",
    ].join("\n"),
  },

  // ---- SRT FORMATION : 150 EUR/an annuel, gestion site ----
  {
    clientMatch: "SRT FORMATION",
    targetNumero: "CTR-SRT-FORMATION-2026",
    dateDebut: "2026-05-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 150,
    montantMensuel: 0,
    valeurAn1: 150,
    statut: "ACTIF",
    notesProspect: [
      "Hébergement + Gestion site srt-formation.fr — facture annuelle.",
      "💶 FACTURÉE EN EURO — IBAN CH24 0024 7247 3054 7560 Z (compte UBS Euro).",
      "Centre de formation SST & STU à Neuville-les-Dames (FR).",
      "Fondateur : Benjamin BOGAERT (contact@srt-formation.fr).",
      "SIRET 938 961 505 00014.",
      "Prochain renouvellement : mai 2027.",
    ].join("\n"),
  },

  // ---- Soverial : 468 EUR/an annuel ----
  {
    clientMatch: "Soverial",
    targetExistingNumero: "CTR-2616",
    dateDebut: "2025-05-01",
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 468,
    montantMensuel: 0,
    valeurAn1: 468,
    statut: "ACTIF",
    notesProspect: [
      "Hébergement + Elementor + Gestion site — facture annuelle 468 CHF.",
      "💶 FACTURÉE EN EURO — IBAN CH24 0024 7247 3054 7560 Z (compte UBS Euro).",
      "⚠ Historique : facture 26-60 annulée par erreur (client confus entre 26-60 et 26-85) — cf. CONVENTIONS §8.",
      "Contact : dvalenduc@boulangerie75.org (Xavier Soverial).",
      "Prochain renouvellement : mai 2026.",
    ].join("\n"),
  },

  // ---- TournemainConsult : 468 EUR/an annuel, cycle FEB → JAN ----
  {
    clientMatch: "TournemainConsult",
    targetExistingNumero: "CTR-2615",
    dateDebut: "2025-05-01", // Date juridique. Cycle de facturation : février
    dureeMois: 12,
    modalitePaiement: "CENT_AU_SIGNING",
    montantOneShot: 468,
    montantMensuel: 0,
    valeurAn1: 468,
    statut: "ACTIF",
    notesProspect: [
      "Hébergement + Elementor + Gestion site — facture annuelle 468 CHF.",
      "💶 FACTURÉE EN EURO — IBAN CH24 0024 7247 3054 7560 Z (compte UBS Euro).",
      "",
      "⚠ CYCLE PARTICULIER : facturation calendaire FÉVRIER année N → JANVIER N+1 (PAS calendrier civil).",
      "Facture 26-35 du 24.02.2026 couvre 2026 (payée 17.03.2026).",
      "Prochain renouvellement à émettre : FÉVRIER 2027 (pas mai).",
    ].join("\n"),
  },

  // ---- Unleash Lab Sàrl : 543.70/mois mensuel, jusqu'à fin contrat ----
  {
    clientMatch: "Unleash Lab",
    targetExistingNumero: "CTR-2603",
    dateDebut: "2026-02-13",
    dureeMois: 8, // jusqu'au 31.10.2026
    modalitePaiement: "MENSUEL",
    montantOneShot: 0,
    montantMensuel: 543.70,
    valeurAn1: 4350,
    statut: "ACTIF",
    notesProspect: [
      "Accompagnement CMO Phase 2.1 — 543.70 CHF/mois facture mensuelle.",
      "Contrat à durée limitée : 13.02.2026 → 31.10.2026 (8 mois).",
      "Total : 4 350 CHF.",
      "Inclut Licence Photo IA (20 CHF/mois).",
      "Contact : Marwan Kashef (marwan.kashef@unleash-lab.tech).",
      "⚠ Pas de renouvellement automatique — fin de contrat le 31.10.2026.",
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
    return false;
  }

  let target;
  if (p.targetExistingNumero) {
    target = prospect.contracts.find(
      (c) => c.numero === p.targetExistingNumero,
    );
  } else {
    target = prospect.contracts.find((c) => c.numero.startsWith("PLACEHOLDER-"));
  }
  if (!target) {
    console.log(
      `  ⊘ ${p.clientMatch} : contrat ${p.targetExistingNumero ?? "[placeholder]"} introuvable`,
    );
    return false;
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

  // Note centralisée — ne pas écraser pour SOS Pneus CTR-2605 (note sur 2605B)
  if (!p.notesProspect.startsWith("(note centralisée")) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { notesGenerales: p.notesProspect },
    });
  }

  const tag = p.montantMensuel > 0
    ? `${p.montantMensuel} CHF/mois`
    : `${p.montantOneShot} CHF annuel`;
  console.log(
    `  ✓ ${p.clientMatch.padEnd(30)} ${target.numero} → ${p.targetNumero ?? target.numero} (${tag})`,
  );
  return true;
}

async function main() {
  console.log("=".repeat(70));
  console.log("CORRECTIF — Marie-Laure → Unleash Lab + EUR + SOS Pneus");
  console.log("=".repeat(70));
  console.log();

  let ok = 0;
  for (const p of PATCHES) {
    if (await applyPatch(p)) ok++;
  }

  console.log(`\n✓ ${ok}/${PATCHES.length} contrats mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
