/**
 * Seed initial du CRM ACLR Sàrl.
 *
 * Idempotent : `npm run db:seed` peut être relancé — la base est purgée
 * puis re-remplie. Garde-fou : refuse de tourner en NODE_ENV=production.
 *
 * Crée :
 *   - 1 Setting (coordonnées ACLR fictives)
 *   - 2 Users : Sophie (commerciale) + Arthur (admin)
 *   - 12 Produits du catalogue + 5 packs
 *   - 10 Prospects fictifs (entreprises suisses variées)
 *   - 2 Deals (proposition + négociation)
 *   - 1 Contrat signé + sa cascade complète (Payment + Commission +
 *     12 CommissionPayment + 2 ClientInvoices)
 *   - 12 activités passées (appels et emails sur les prospects)
 *
 * Les mots de passe générés sont affichés à la fin (à noter).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import {
  buildSignaturePaymentPlan,
  centsToChf,
  chfToCents,
  computeCommissionSignature,
  computeValeurAn1,
} from "../lib/commissions";

const prisma = new PrismaClient();

// ===========================================================================
// HELPERS
// ===========================================================================

function genPassword(): string {
  // 12 chars alphanumériques + 2 spéciaux pour confort de saisie
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!2";
}

async function hash(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function daysAhead(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "🚫 Refus de seeder en production — purger une vraie base est destructeur.",
    );
  }

  console.log("🌱 Seed du CRM ACLR — démarrage…");

  // ---- 1. PURGE (ordre inverse des FK) ----
  console.log("  → purge des tables…");
  await prisma.emailAttachment.deleteMany();
  await prisma.email.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.commissionPayment.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.renewal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.clientInvoiceLine.deleteMany();
  await prisma.clientInvoice.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.contractOption.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.stat.deleteMany();
  await prisma.prospect.deleteMany();
  await prisma.product.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.counter.deleteMany();

  // ---- 2. SETTING (singleton id=1) ----
  console.log("  → paramètres ACLR Sàrl…");
  await prisma.setting.create({
    data: {
      id: 1,
      raisonSociale: "ACLR Sàrl",
      marque: "Make Your Com",
      adresse: "Route Cantonale 12",
      codePostal: "1024",
      ville: "Ecublens",
      pays: "Suisse",
      numeroIDE: "CHE-000.000.000", // fictif — à remplacer dans /parametres
      iban: "CH00 0000 0000 0000 0000 0", // fictif
      nomBanque: "PostFinance",
      emailContact: "contact@makeyourcom.ch",
      telephone: "+41 21 000 00 00",
      siteWeb: "https://makeyourcom.ch",
      tvaActive: false,
    },
  });

  // ---- 3. USERS ----
  console.log("  → utilisateurs…");
  const pwdSophie = genPassword();
  const pwdArthur = genPassword();

  const sophie = await prisma.user.create({
    data: {
      email: "sophie@aclr.ch",
      name: "Sophie Salvan",
      passwordHash: await hash(pwdSophie),
      role: "COMMERCIAL",
    },
  });

  const arthur = await prisma.user.create({
    data: {
      email: "arthur@aclr.ch",
      name: "Arthur Chazelle",
      passwordHash: await hash(pwdArthur),
      role: "ADMIN",
    },
  });

  // ---- 4. CATALOGUE PRODUITS ----
  console.log("  → catalogue produits…");

  const siteSimple = await prisma.product.create({
    data: {
      nom: "Site web simple",
      description: "Site vitrine 1-3 pages, livraison 5-7 jours",
      type: "ONE_SHOT",
      categorie: "SITE",
      prixOneShot: 400,
      prixMensuel: 39,
    },
  });
  const siteHaut = await prisma.product.create({
    data: {
      nom: "Site web haut de gamme",
      description: "Site complet, design sur mesure, livraison 5-7 jours",
      type: "ONE_SHOT",
      categorie: "SITE",
      prixOneShot: 1000,
      prixMensuel: 59,
    },
  });
  const rsBasique = await prisma.product.create({
    data: {
      nom: "Gestion réseaux sociaux — basique",
      description: "2 posts / semaine, 1 plateforme",
      type: "RECURRENT_MENSUEL",
      categorie: "RS",
      prixMensuel: 249,
    },
  });
  const seoBasique = await prisma.product.create({
    data: {
      nom: "SEO local — basique",
      description: "Optimisation Google Business + on-page",
      type: "RECURRENT_MENSUEL",
      categorie: "SEO",
      prixMensuel: 59,
    },
  });
  const ads = await prisma.product.create({
    data: {
      nom: "Publicité Google & Meta Ads",
      description:
        "Gestion ads — 30 % de CHF 150/mois côté ACLR (CHF 45) + setup CHF 349",
      type: "RECURRENT_MENSUEL",
      categorie: "ADS",
      prixOneShot: 349,
      prixMensuel: 45,
    },
  });
  const cmoBasique = await prisma.product.create({
    data: {
      nom: "CMO fractionné — basique",
      description: "4 h / mois de direction marketing externalisée",
      type: "RECURRENT_MENSUEL",
      categorie: "CMO",
      prixMensuel: 399,
    },
  });
  const metricool = await prisma.product.create({
    data: {
      nom: "Licence Metricool",
      description: "Outil de planification réseaux sociaux",
      type: "RECURRENT_ANNUEL",
      categorie: "METRICOOL",
      prixAnnuel: 249,
    },
  });

  // Packs (composantsIds = JSON array de Product.id)
  const packWeb = await prisma.product.create({
    data: {
      nom: "Pack Web",
      description: "Site haut + SEO",
      type: "PACK",
      categorie: "PACK",
      prixOneShot: 1000,
      prixMensuel: 109, // 59 site + 59 seo - mais comme dans la spec on garde un prix groupé
      composantsIds: [siteHaut.id, seoBasique.id],
    },
  });
  const packWebComplet = await prisma.product.create({
    data: {
      nom: "Pack Web Complet",
      description: "Site haut + SEO + Ads",
      type: "PACK",
      categorie: "PACK",
      prixOneShot: 1349,
      prixMensuel: 163,
      composantsIds: [siteHaut.id, seoBasique.id, ads.id],
    },
  });
  const packGestion = await prisma.product.create({
    data: {
      nom: "Pack Gestion",
      description: "CMO + RS",
      type: "PACK",
      categorie: "PACK",
      prixMensuel: 599,
      composantsIds: [cmoBasique.id, rsBasique.id],
    },
  });
  const packCmoPlus = await prisma.product.create({
    data: {
      nom: "Pack CMO Plus",
      description: "CMO + RS + Site haut",
      type: "PACK",
      categorie: "PACK",
      prixOneShot: 1000,
      prixMensuel: 699,
      composantsIds: [cmoBasique.id, rsBasique.id, siteHaut.id],
    },
  });
  const packPremium = await prisma.product.create({
    data: {
      nom: "Pack Premium",
      description: "Site haut + SEO + Ads + RS + CMO",
      type: "PACK",
      categorie: "PACK",
      prixOneShot: 1349,
      prixMensuel: 999,
      composantsIds: [
        siteHaut.id,
        seoBasique.id,
        ads.id,
        rsBasique.id,
        cmoBasique.id,
      ],
    },
  });

  // ---- 5. PROSPECTS (10 entreprises suisses fictives) ----
  console.log("  → prospects…");
  const prospects = await Promise.all([
    prisma.prospect.create({
      data: {
        raisonSociale: "Boulangerie du Léman SA",
        contactNom: "Müller",
        contactPrenom: "Hans",
        contactFonction: "Patron",
        email: "hans.muller@boulangerieleman.ch",
        telephone: "+41 21 691 23 45",
        adresse: "Rue de Lausanne 12",
        codePostal: "1006",
        ville: "Lausanne",
        canton: "VD",
        secteur: "ARTISAN",
        effectif: 8,
        source: "LINKEDIN",
        statut: "CONTACTE",
        assigneAId: sophie.id,
        notesGenerales: "Veut moderniser sa présence en ligne, débordé.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Cabinet Dentaire Riviera",
        contactNom: "Dupont",
        contactPrenom: "Marie",
        contactFonction: "Dr. dentiste",
        email: "marie.dupont@dentiste-riviera.ch",
        telephone: "+41 21 922 45 67",
        adresse: "Avenue des Alpes 24",
        codePostal: "1820",
        ville: "Montreux",
        canton: "VD",
        secteur: "CABINET_LIBERAL",
        effectif: 4,
        source: "WEB",
        statut: "QUALIFIE",
        assigneAId: sophie.id,
        notesGenerales: "Très intéressée par le SEO local + gestion RS.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Hôtel des Bergues SA",
        contactNom: "Rossi",
        contactPrenom: "Giulia",
        contactFonction: "Directrice marketing",
        email: "g.rossi@hotelbergues.ch",
        telephone: "+41 22 908 70 00",
        adresse: "Quai des Bergues 33",
        codePostal: "1201",
        ville: "Genève",
        canton: "GE",
        secteur: "RESTO_HOTEL",
        effectif: 80,
        source: "REFERRAL",
        statut: "RDV_PRIS",
        assigneAId: sophie.id,
        notesGenerales: "RDV prévu mercredi prochain pour démo Pack Premium.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Garage Auto Express Sàrl",
        contactNom: "Schneider",
        contactPrenom: "Marc",
        contactFonction: "Gérant",
        email: "marc@autoexpress.ch",
        telephone: "+41 27 322 18 90",
        ville: "Sion",
        canton: "VS",
        secteur: "ARTISAN",
        effectif: 12,
        source: "FICHIER_IMPORT",
        statut: "NOUVEAU",
        assigneAId: sophie.id,
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "BioMarket Suisse SA",
        contactNom: "Tanner",
        contactPrenom: "Lukas",
        contactFonction: "CEO",
        email: "lukas@biomarket.ch",
        telephone: "+41 31 511 22 33",
        adresse: "Bahnhofstrasse 5",
        codePostal: "3011",
        ville: "Berne",
        canton: "BE",
        secteur: "E_COMMERCE",
        effectif: 25,
        source: "LINKEDIN",
        statut: "PROPOSITION_ENVOYEE",
        assigneAId: sophie.id,
        notesGenerales:
          "Proposition Pack Web Complet envoyée le 15. Relance prévue.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Avocats Reverdin & Partners",
        contactNom: "Reverdin",
        contactPrenom: "Philippe",
        contactFonction: "Associé fondateur",
        email: "p.reverdin@reverdin-avocats.ch",
        telephone: "+41 22 311 45 67",
        adresse: "Rue du Rhône 88",
        codePostal: "1204",
        ville: "Genève",
        canton: "GE",
        secteur: "CABINET_LIBERAL",
        effectif: 15,
        source: "REFERRAL",
        statut: "CONTACTE",
        assigneAId: sophie.id,
        notesGenerales: "Recommandé par Cabinet Dentaire Riviera.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Chocolats Lauenen AG",
        contactNom: "Lauenen",
        contactPrenom: "Anna",
        contactFonction: "Responsable e-commerce",
        email: "anna@chocolats-lauenen.ch",
        telephone: "+41 33 744 56 78",
        ville: "Gstaad",
        canton: "BE",
        secteur: "E_COMMERCE",
        effectif: 30,
        source: "WEB",
        statut: "NOUVEAU",
        assigneAId: sophie.id,
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Immobilière du Lac Sàrl",
        contactNom: "Vauthier",
        contactPrenom: "Christine",
        contactFonction: "Gérante",
        email: "c.vauthier@immo-lac.ch",
        telephone: "+41 21 803 12 34",
        ville: "Vevey",
        canton: "VD",
        secteur: "IMMOBILIER",
        effectif: 6,
        source: "FICHIER_IMPORT",
        statut: "PERDU",
        assigneAId: sophie.id,
        notesGenerales: "Travaille déjà avec une agence locale, pas pressée.",
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Restaurant Le Pavillon SA",
        contactNom: "Bernard",
        contactPrenom: "Yann",
        contactFonction: "Patron",
        email: "yann@lepavillon.ch",
        telephone: "+41 26 411 22 11",
        adresse: "Place de la Gare 4",
        codePostal: "1700",
        ville: "Fribourg",
        canton: "FR",
        secteur: "RESTO_HOTEL",
        effectif: 14,
        source: "LINKEDIN",
        statut: "QUALIFIE",
        assigneAId: sophie.id,
      },
    }),
    prisma.prospect.create({
      data: {
        raisonSociale: "Camping des Pins SA",
        contactNom: "Page",
        contactPrenom: "Sébastien",
        contactFonction: "Directeur",
        email: "s.page@camping-des-pins.ch",
        telephone: "+41 24 466 78 90",
        ville: "Yverdon-les-Bains",
        canton: "VD",
        secteur: "TOURISME",
        effectif: 7,
        source: "WEB",
        statut: "CONTACTE",
        assigneAId: sophie.id,
      },
    }),
  ]);

  // ---- 6. ACTIVITÉS PASSÉES (12 entrées pour avoir une timeline crédible) ----
  console.log("  → activités passées…");

  await prisma.activity.createMany({
    data: [
      // Boulangerie du Léman — un appel, un email
      {
        prospectId: prospects[0].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: daysAgo(5),
        duree: 4,
        duree2: 245,
        sujet: "Premier appel à froid",
        statut: "FAIT",
        resultat: "A_RAPPELER",
        notesResultat:
          "Patron occupé, m'a demandé de rappeler la semaine prochaine vers 14h.",
      },
      {
        prospectId: prospects[0].id,
        userId: sophie.id,
        type: "EMAIL_ENVOYE",
        date: daysAgo(5),
        sujet: "Suite à notre appel — présentation Make Your Com",
        statut: "FAIT",
      },
      // Cabinet Dentaire Riviera
      {
        prospectId: prospects[1].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: daysAgo(7),
        duree: 12,
        duree2: 745,
        sujet: "Premier contact",
        statut: "FAIT",
        resultat: "RDV_PRIS",
        notesResultat: "Très intéressée. RDV visio dans 10 jours.",
      },
      {
        prospectId: prospects[1].id,
        userId: sophie.id,
        type: "RDV_VISIO",
        date: daysAhead(3),
        duree: 45,
        sujet: "Démo Pack Web Complet + SEO",
        statut: "PLANIFIE",
      },
      // Hôtel des Bergues
      {
        prospectId: prospects[2].id,
        userId: sophie.id,
        type: "RDV_PHYSIQUE",
        date: daysAhead(5),
        duree: 60,
        sujet: "Démo Pack Premium sur place",
        statut: "PLANIFIE",
      },
      {
        prospectId: prospects[2].id,
        userId: sophie.id,
        type: "EMAIL_ENVOYE",
        date: daysAgo(2),
        sujet: "Confirmation du RDV de mercredi",
        statut: "FAIT",
      },
      // BioMarket Suisse
      {
        prospectId: prospects[4].id,
        userId: sophie.id,
        type: "RDV_VISIO",
        date: daysAgo(8),
        duree: 50,
        sujet: "Démo Pack Web Complet",
        statut: "FAIT",
      },
      {
        prospectId: prospects[4].id,
        userId: sophie.id,
        type: "EMAIL_ENVOYE",
        date: daysAgo(7),
        sujet: "Proposition Pack Web Complet — BioMarket",
        statut: "FAIT",
      },
      {
        prospectId: prospects[4].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: daysAhead(2),
        sujet: "Relance proposition",
        statut: "PLANIFIE",
      },
      // Avocats Reverdin
      {
        prospectId: prospects[5].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: daysAgo(3),
        duree: 6,
        duree2: 384,
        sujet: "Premier appel suite à recommandation",
        statut: "FAIT",
        resultat: "INTERESSE_PAS_PRET",
        notesResultat:
          "Curieux mais en pleine restructuration interne. Rappel dans 1 mois.",
      },
      // Restaurant Le Pavillon
      {
        prospectId: prospects[8].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: daysAgo(1),
        duree: 8,
        duree2: 502,
        sujet: "Qualification",
        statut: "FAIT",
        resultat: "RDV_PRIS",
        notesResultat: "RDV téléphonique vendredi 14h pour démo.",
      },
      // Camping des Pins
      {
        prospectId: prospects[9].id,
        userId: sophie.id,
        type: "APPEL_SORTANT",
        date: hoursAgo(3),
        duree: 3,
        duree2: 168,
        sujet: "Premier contact",
        statut: "FAIT",
        resultat: "COMBOX",
        notesResultat:
          "Combox personnel — message déposé. À rappeler demain matin.",
      },
    ],
  });

  // ---- 7. DEALS (2 en pipeline) ----
  console.log("  → deals…");
  const dealBiomarket = await prisma.deal.create({
    data: {
      prospectId: prospects[4].id, // BioMarket Suisse
      assigneAId: sophie.id,
      titre: "Pack Web Complet — BioMarket Suisse",
      description: "Refonte site + SEO + Ads pour booster acquisition online.",
      montantPrevu: 3305, // = valeur an 1 du Pack Web Complet
      stage: "PROPOSITION",
      probabilite: 50,
      closeAttenduLe: daysAhead(20),
      productsProposes: { connect: [{ id: packWebComplet.id }] },
    },
  });

  await prisma.deal.create({
    data: {
      prospectId: prospects[2].id, // Hôtel des Bergues
      assigneAId: sophie.id,
      titre: "Pack Premium — Hôtel des Bergues",
      description:
        "Stratégie 360° : site, SEO local, RS multilingues, CMO fractionné.",
      montantPrevu: 13339, // = 1349 + 999×12 = 13'337 CHF (arrondi business)
      stage: "NEGOCIATION",
      probabilite: 75,
      closeAttenduLe: daysAhead(15),
      productsProposes: { connect: [{ id: packPremium.id }] },
    },
  });

  // ---- 8. CONTRAT SIGNÉ + cascade complète ----
  // On simule un contrat fictif déjà signé pour valider toute la mécanique.
  console.log("  → contrat signé + cascade commission…");

  // Numérotation : ACLR-2026-0001 (premier de l'année)
  const dateSignature = daysAgo(45); // signé il y a ~6 semaines
  await prisma.counter.upsert({
    where: { scope_year: { scope: "contract", year: 2026 } },
    update: { value: 1 },
    create: { scope: "contract", year: 2026, value: 1 },
  });

  // Contrat : Pack Web Complet pour Cabinet Dentaire (passe statut SIGNE)
  await prisma.prospect.update({
    where: { id: prospects[1].id },
    data: { statut: "SIGNE" },
  });

  const oneShotCents = chfToCents(1349);
  const mensuelCents = chfToCents(163);
  const valeurAn1Cents = computeValeurAn1({
    oneShotCents,
    mensuelCents,
  });

  const contract = await prisma.contract.create({
    data: {
      prospectId: prospects[1].id,
      assigneAId: sophie.id,
      numero: "ACLR-2026-0001",
      dateSignature,
      dateDebut: dateSignature,
      dureeMois: 12,
      statut: "ACTIF",
      modalitePaiement: "CINQUANTE_CINQUANTE",
      montantOneShot: centsToChf(oneShotCents),
      montantMensuel: centsToChf(mensuelCents),
      valeurAn1: centsToChf(valeurAn1Cents),
      products: { connect: [{ id: packWebComplet.id }] },
    },
  });

  // Commission (utilise le moteur validé)
  const calc = computeCommissionSignature({
    valeurAn1Cents,
    taux: 0.25,
  });
  const commission = await prisma.commission.create({
    data: {
      contractId: contract.id,
      userId: sophie.id,
      montantTotal: centsToChf(calc.totalCents),
      montantPart1: centsToChf(calc.partSignatureCents),
      montantPart2: centsToChf(calc.totalEtalementsCents),
      statut: "DUE",
    },
  });

  // 12 CommissionPayment
  const plan = buildSignaturePaymentPlan({
    valeurAn1Cents,
    dateSignature,
  });
  await prisma.commissionPayment.createMany({
    data: plan.map((p) => ({
      commissionId: commission.id,
      numeroMois: p.numeroMois,
      typePart: p.typePart,
      montant: centsToChf(p.montantCents),
      dateVersementPrevue: p.dateVersementPrevue,
      statut: "PREVU",
    })),
  });

  // ClientInvoices : 2 (acompte + solde, modalité 50/50)
  const totalContrat = centsToChf(
    oneShotCents + mensuelCents * 12,
  );
  const moitie = totalContrat / 2;

  await prisma.counter.upsert({
    where: { scope_year: { scope: "client_invoice", year: 2026 } },
    update: { value: 2 },
    create: { scope: "client_invoice", year: 2026, value: 2 },
  });

  const invoiceAcompte = await prisma.clientInvoice.create({
    data: {
      contractId: contract.id,
      numero: "ACLR-CLI-2026-0001",
      dateEmission: dateSignature,
      dateEcheance: new Date(dateSignature.getTime() + 30 * 86400_000),
      type: "ACOMPTE",
      sousTotal: moitie,
      totalTVA: 0,
      total: moitie,
      statut: "PAYEE",
      datePaiement: new Date(dateSignature.getTime() + 7 * 86400_000),
      modeReglement: "VIREMENT",
      lignes: {
        create: [
          {
            designation: "Pack Web Complet — Acompte 50 %",
            quantite: 1,
            prixUnitaire: moitie,
            montantHT: moitie,
            tauxTVA: 0,
            ordre: 1,
            productId: packWebComplet.id,
          },
        ],
      },
    },
  });

  await prisma.clientInvoice.create({
    data: {
      contractId: contract.id,
      numero: "ACLR-CLI-2026-0002",
      dateEmission: new Date(dateSignature.getTime() + 30 * 86400_000),
      dateEcheance: new Date(dateSignature.getTime() + 60 * 86400_000),
      type: "SOLDE",
      sousTotal: moitie,
      totalTVA: 0,
      total: moitie,
      statut: "ENVOYEE",
      lignes: {
        create: [
          {
            designation: "Pack Web Complet — Solde 50 %",
            quantite: 1,
            prixUnitaire: moitie,
            montantHT: moitie,
            tauxTVA: 0,
            ordre: 1,
            productId: packWebComplet.id,
          },
        ],
      },
    },
  });

  // Payment : acompte encaissé → déclenche la commission SIGNATURE
  await prisma.payment.create({
    data: {
      contractId: contract.id,
      clientInvoiceId: invoiceAcompte.id,
      date: invoiceAcompte.datePaiement ?? dateSignature,
      montant: moitie,
      type: "ACOMPTE",
      statut: "ENCAISSE",
      referenceFactureClient: invoiceAcompte.numero,
    },
  });

  // Marque le CommissionPayment SIGNATURE comme PAYE puisque l'acompte est encaissé
  await prisma.commissionPayment.updateMany({
    where: {
      commissionId: commission.id,
      typePart: "SIGNATURE",
    },
    data: {
      statut: "PAYE",
      dateVersement: invoiceAcompte.datePaiement,
    },
  });

  // Statut commission : PARTIELLEMENT_VERSEE (1 versement sur 12 payé)
  await prisma.commission.update({
    where: { id: commission.id },
    data: { statut: "PARTIELLEMENT_VERSEE" },
  });

  // ---- 9. AFFICHAGE FINAL ----
  console.log("");
  console.log("✅ Seed terminé avec succès.");
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  IDENTIFIANTS DE CONNEXION — À NOTER MAINTENANT         │");
  console.log("│  (les mots de passe ne sont JAMAIS ré-affichés ensuite) │");
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log("");
  console.log(`  👤 Sophie  (commerciale) : ${sophie.email}`);
  console.log(`     mot de passe : ${pwdSophie}`);
  console.log("");
  console.log(`  👤 Arthur  (admin)       : ${arthur.email}`);
  console.log(`     mot de passe : ${pwdArthur}`);
  console.log("");
  console.log(
    "──────────────────────────────────────────────────────────",
  );
  console.log("");
  console.log("📊 Récap :");
  console.log(
    `  • ${await prisma.product.count()} produits / packs au catalogue`,
  );
  console.log(`  • ${await prisma.prospect.count()} prospects`);
  console.log(`  • ${await prisma.activity.count()} activités passées`);
  console.log(`  • ${await prisma.deal.count()} deals en pipeline`);
  console.log(`  • ${await prisma.contract.count()} contrat signé`);
  console.log(
    `  • ${await prisma.commissionPayment.count()} versements de commission planifiés (dont 1 PAYE)`,
  );
  console.log(`  • ${await prisma.clientInvoice.count()} factures clients`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Erreur durant le seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
