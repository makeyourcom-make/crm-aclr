/**
 * Import des données métier réelles depuis le package Transfert CRM.
 *
 * Source : scripts/import-from-cowork/*.json
 * Doc    : scripts/import-from-cowork/CONVENTIONS-METIER.md
 *
 * Ordre d'import :
 *   1. Clients         → Prospect (+ Contract si déjà signé)
 *   2. Contrats        → Contract (mise à jour ou création)
 *   3. Factures        → ClientInvoice (numéro source 26-XX conservé)
 *   4. Charges         → Expense
 *
 * Conventions respectées :
 *   - TVA OFF (ACLR pas assujetti, doc §1)
 *   - Numérotation source 26-XX conservée, le Counter est mis à 91 pour
 *     reprendre à 26-92 sur les nouvelles factures
 *   - Dates DD.MM.YYYY parsées (présentes dans clients.json)
 *   - Conversion EUR×0.95, USD×0.895 déjà appliquée par Cowork → on garde
 *     les montants CHF du JSON
 *
 * Usage :
 *   npx tsx scripts/import-from-cowork/import.ts             # dry-run (log only)
 *   npx tsx scripts/import-from-cowork/import.ts --execute   # vrai import
 */
import {
  type ContractStatut,
  type ExpenseCategorie,
  type MethodPaiement,
  type ModalitePaiement,
  PrismaClient,
  type ProspectStatut,
} from "@prisma/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const DRY = !process.argv.includes("--execute");

const DATA_DIR = join(process.cwd(), "scripts", "import-from-cowork");

/** Normalise un nom pour le matching tolérant. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents
    .replace(/\bs[àa]rl\b/g, "") // ignore "Sàrl"
    .replace(/\bsa\b/g, "") // ignore "SA" en suffixe
    .replace(/\bsas\b/g, "") // ignore "SAS"
    .replace(/\bag\b/g, "") // ignore "AG"
    .replace(/\([^)]+\)/g, "") // enlève le contenu entre parenthèses
    .replace(/[^a-z0-9]/g, "") // garde alphanum
    .trim();
}

/** Alias manuels pour les cas connus (Cowork → clients.json). */
const NAME_ALIASES: Record<string, string> = {
  // Variantes des noms dans factures.json → raisonSociale dans clients.json
  "lncoiffurechaar": "L&L Coiffure Sàrl",
  "lncoiffure": "L&L Coiffure Sàrl",
  "ladentbyantse": "La Dent Byantse",
  "ladentbyantsesarl": "La Dent Byantse",
  "spindustriel": "SP Industriel",
  "soverial": "Soverial",
  "rochsa": "Roch SA",
  "roch": "Roch SA",
  "sospneuskehil": "SOS Pneus",
  "sospneus": "SOS Pneus",
  "locfactoryoutdoorsportsfactory": "LocFactory",
  "outdoorsportsfactory": "LocFactory",
  "locfactory": "LocFactory",
  "passeportbeaute": "Passeport Beauté",
  "sigmaconsulting": "Passeport Beauté", // Sigma facture pour Passeport Beauté
  "frakaxessoires": "Frakaxessoires",
  "hoteldetorgon": "Hôtel de Torgon",
  "uneashlab": "Unleash Lab Sàrl",
  "uneashlabsarl": "Unleash Lab Sàrl",
  "tournemainconsult": "TournemainConsult",
  "casavue": "Casavue",
  "qerkini": "Qerkini Sàrl",
  "qerkinisarl": "Qerkini Sàrl",
  "lionelbriquet": "Lionel Briquet",
  "marielauresidere": "Marie-Laure Sidère",
  "linacoiffure": "Lina Coiffure",
  "arcoz": "ARCOZ AG",
  "arcozag": "ARCOZ AG",
  "ansanitaire": "AN Sanitaire",
  "coiffuresthonore": "Coiffure St Honoré",
  "srtformation": "SRT FORMATION",
  "cjsante": "CJSanté Sàrl",
  "lamaisondelinterieur": "La Maison de l'Intérieur Sàrl",
  "syndicatboulangersgrandparis": "Syndicat Boulangers Grand Paris",
};

/**
 * Cherche un prospect dans la map en utilisant normalisation + alias.
 * Retourne raisonSociale officielle (clé d'entrée dans prospectByName).
 */
function resolveClientName(
  raw: string,
  prospectByName: Map<string, string>,
): string | null {
  if (!raw) return null;
  // Match exact direct
  if (prospectByName.has(raw)) return raw;
  // Normalisation
  const norm = normalizeName(raw);
  if (!norm) return null;
  // Alias direct
  const aliased = NAME_ALIASES[norm];
  if (aliased && prospectByName.has(aliased)) return aliased;
  // Recherche normalisée dans les clés existantes
  for (const key of prospectByName.keys()) {
    if (normalizeName(key) === norm) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Parse une date au format "DD.MM.YYYY" ou "YYYY-MM-DD" ou vide → null. */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return new Date(trimmed + "T00:00:00Z");
  // DD.MM.YYYY
  const m = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  // DD/MM/YYYY
  const m2 = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return new Date(`${m2[3]}-${m2[2]}-${m2[1]}T00:00:00Z`);
  // Fallback : essaie de parser
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/** Mapping statut prospect (clients.json) → enum ProspectStatut */
function mapClientStatut(
  raw: string,
  hasSignedContract: boolean,
): ProspectStatut {
  const s = (raw || "").trim().toLowerCase();
  if (s === "actif" || s === "terminé" || hasSignedContract) return "SIGNE";
  if (s === "prospect") return "PROPOSITION_ENVOYEE";
  if (s === "interne") return "NE_PAS_RAPPELER"; // Make Media (projet interne)
  return "NOUVEAU";
}

/** Mapping statut contrat */
function mapContractStatut(raw: string): ContractStatut {
  const s = (raw || "").trim().toLowerCase();
  if (s === "actif") return "ACTIF";
  if (s === "suspendu") return "SUSPENDU";
  if (s === "résilié" || s === "resilie") return "RESILIE";
  if (s === "terminé" || s === "termine") return "EXPIRE";
  return "ACTIF";
}

/** Mapping fréquence facturation → modalité paiement Prisma */
function mapModalite(freq: string): ModalitePaiement {
  const f = (freq || "").trim().toLowerCase();
  if (f === "mensuel" || f === "bimensuel") return "MENSUEL";
  if (f === "annuel") return "CENT_AU_SIGNING";
  // "Ponctuel" → 100% à la signature (mais parfois en 3 fois comme ARCOZ — on
  // garde CINQUANTE_CINQUANTE par défaut pour ces cas-là)
  if (f === "ponctuel") return "CINQUANTE_CINQUANTE";
  return "CENT_AU_SIGNING";
}

/** Mapping statut facture (factures.json) → enum ClientInvoiceStatut */
function mapFactureStatut(raw: string): "BROUILLON" | "ENVOYEE" | "PAYEE" | "EN_RETARD" | "ANNULEE" {
  const s = (raw || "").trim().toLowerCase();
  if (s === "payée" || s === "payee") return "PAYEE";
  if (s === "envoyée" || s === "envoyee") return "ENVOYEE";
  if (s === "préparée" || s === "preparee") return "BROUILLON";
  if (s === "planifiée" || s === "planifiee") return "BROUILLON";
  if (s === "annulée" || s === "annulee") return "ANNULEE";
  return "BROUILLON";
}

/** Mapping catégorie charge selon catégorieSource + description (CONVENTIONS §3) */
function mapExpenseCategorie(
  source: string,
  description: string,
): ExpenseCategorie {
  const s = (source || "").trim().toLowerCase();
  const d = (description || "").toLowerCase();
  // Routing fin sur la description quand utile
  if (d.includes("banque") || d.includes("ubs")) return "BANQUE_FRAIS";
  if (d.includes("fiduciaire") || d.includes("impôt") || d.includes("impot") || d.includes("cfe")) return "IMPOTS";
  if (d.includes("google workspace") || d.includes("workspace")) return "SOFTWARE_SAAS";
  if (d.includes("sunrise") || d.includes("téléphon") || d.includes("telephon")) return "TELECOM";
  if (d.includes("ads") || d.includes("publicité") || d.includes("publicite")) return "PUBLICITE";
  if (d.includes("restaurant") || d.includes("repas") || d.includes("café")) return "RESTAURATION";

  // Routing par catégorieSource
  if (s === "web") return "SOFTWARE_SAAS"; // hébergement, domaines (LWS, Infomaniak, Netlify)
  if (s === "ia") return "SOFTWARE_SAAS";
  if (s === "outils") return "SOFTWARE_SAAS";
  if (s === "marketing") return "PUBLICITE";
  if (s === "bancaire") return "BANQUE_FRAIS";
  if (s === "restauration") return "RESTAURATION";
  if (s === "admin") return "AUTRE";

  return "AUTRE";
}

function durationFromFrequence(freq: string): number {
  const f = (freq || "").trim().toLowerCase();
  // Pour les annuels, durée = 12 mois ; pour les autres aussi par défaut
  if (f === "ponctuel") return 1;
  return 12;
}

// ---------------------------------------------------------------------------
// TYPES JSON SOURCE
// ---------------------------------------------------------------------------

interface ClientJson {
  _id: string;
  raisonSociale: string;
  contactPrenom: string;
  contactNom: string;
  email: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  canton: string;
  secteur: string;
  siteWeb: string;
  ide: string;
  dateSignatureContrat: string;
  dateRenouvellement: string;
  produits: string[];
  montantContratCHF: number;
  frequenceFacture: string;
  montantFactureCHF: number;
  statut: string;
  notes: string;
}

interface ContratJson {
  numero: string;
  clientRaisonSociale: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  duree: string;
  montantTotalCHF: number;
  montantFactureCHF: number;
  frequence: string;
  statut: string;
  notes: string;
}

interface FactureJson {
  numero: string;
  clientRaisonSociale: string;
  contratRef: string;
  description: string;
  dateEmission: string;
  dateEcheance: string;
  montantCHF: number;
  statut: string;
  datePaiement: string;
  notes: string;
}

interface ChargeJson {
  categorie: string;
  categorieSource: string;
  description: string;
  fournisseur: string;
  montantCHF: number;
  montantMensuelCHF: number;
  date: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// IMPORT
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(70));
  console.log(`IMPORT COWORK → CRM  ${DRY ? "[DRY-RUN — pas de mutation DB]" : "[EXÉCUTION RÉELLE]"}`);
  console.log("=".repeat(70));

  // 1. Charge les JSONs
  const [clients, contrats, factures, charges] = await Promise.all([
    readFile(join(DATA_DIR, "clients.json"), "utf8").then(
      (s) => JSON.parse(s) as ClientJson[],
    ),
    readFile(join(DATA_DIR, "contrats.json"), "utf8").then(
      (s) => JSON.parse(s) as ContratJson[],
    ),
    readFile(join(DATA_DIR, "factures.json"), "utf8").then(
      (s) => JSON.parse(s) as FactureJson[],
    ),
    readFile(join(DATA_DIR, "charges.json"), "utf8").then(
      (s) => JSON.parse(s) as ChargeJson[],
    ),
  ]);

  console.log(`\nChargé :`);
  console.log(`  ${clients.length} clients`);
  console.log(`  ${contrats.length} contrats`);
  console.log(`  ${factures.length} factures`);
  console.log(`  ${charges.length} charges`);

  // 2. Récupère l'admin pour assigneAId (les contrats existants sont historiques
  //    — pas vraiment "assignés à Sophie", on les attribue à Arthur)
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error("Aucun ADMIN trouvé. Crée d'abord ton compte Arthur.");
  }
  console.log(`  Admin par défaut : ${admin.name}`);

  // ==========================================================================
  // ÉTAPE 1 — IMPORT DES CLIENTS (Prospects)
  // ==========================================================================
  console.log(`\n${"-".repeat(70)}\n[1/4] Import des CLIENTS → Prospects`);
  const prospectByName = new Map<string, string>(); // raisonSociale → prospect.id

  for (const c of clients) {
    if (!c.raisonSociale) continue;

    const hasContract = c.montantContratCHF > 0 || !!c.dateSignatureContrat;
    const statut = mapClientStatut(c.statut, hasContract);
    const notesAll = [
      c.notes,
      c._id ? `Source ID Cowork : ${c._id}` : "",
      c.ide ? `IDE/SIRET : ${c.ide}` : "",
      c.dateRenouvellement && c.dateRenouvellement !== "Non"
        ? `Renouvellement : ${c.dateRenouvellement}`
        : "",
      c.produits.length > 0 ? `Produits historiques : ${c.produits.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (DRY) {
      console.log(
        `  [DRY] ${c.raisonSociale.padEnd(40)} statut=${statut.padEnd(20)}`,
      );
      // En dry-run on simule un ID pour permettre la suite de la chaîne
      prospectByName.set(c.raisonSociale, `dry-${c._id}`);
      continue;
    }

    const created = await prisma.prospect.create({
      data: {
        raisonSociale: c.raisonSociale,
        contactPrenom: c.contactPrenom || null,
        contactNom: c.contactNom || null,
        email: c.email || null,
        telephone: c.telephone || null,
        adresse: c.adresse || null,
        codePostal: c.codePostal || null,
        ville: c.ville || null,
        canton: c.canton || null,
        pays:
          c.pays === "FR" ? "France" : c.pays === "CH" ? "Suisse" : c.pays || "Suisse",
        statut,
        assigneAId: admin.id,
        notesGenerales: notesAll || null,
      },
    });
    prospectByName.set(c.raisonSociale, created.id);
  }

  console.log(`  ✓ ${prospectByName.size} prospects créés`);

  // ==========================================================================
  // ÉTAPE 2 — IMPORT DES CONTRATS
  // ==========================================================================
  console.log(`\n${"-".repeat(70)}\n[2/4] Import des CONTRATS`);
  // Map source contratRef → contractId créé en DB (pour lier les factures après)
  const contractByLegacyNumero = new Map<string, string>();
  // Map prospectId → premier contract.id (fallback si contratRef vide)
  const firstContractByProspectId = new Map<string, string>();

  for (const ct of contrats) {
    if (!ct.numero || !ct.clientRaisonSociale) continue;

    const resolved = resolveClientName(ct.clientRaisonSociale, prospectByName);
    const prospectId = resolved ? prospectByName.get(resolved) : undefined;
    if (!prospectId) {
      console.warn(
        `  ⚠ Contrat ${ct.numero} ignoré : prospect "${ct.clientRaisonSociale}" introuvable`,
      );
      continue;
    }

    const dateDebut = parseDate(ct.dateDebut) ?? new Date();
    const dureeMois = durationFromFrequence(ct.frequence);
    const isMensuel = ct.frequence.toLowerCase() === "mensuel" ||
      ct.frequence.toLowerCase() === "bimensuel";
    const montantOneShot = isMensuel ? 0 : ct.montantFactureCHF;
    const montantMensuel = isMensuel ? ct.montantFactureCHF : 0;

    if (DRY) {
      console.log(
        `  [DRY] ${ct.numero.padEnd(12)} ${ct.clientRaisonSociale.padEnd(30)} ${ct.frequence.padEnd(10)} ${ct.montantTotalCHF}`,
      );
      const dryId = `dry-${ct.numero}`;
      contractByLegacyNumero.set(ct.numero, dryId);
      if (!firstContractByProspectId.has(prospectId)) {
        firstContractByProspectId.set(prospectId, dryId);
      }
      continue;
    }

    const created = await prisma.contract.create({
      data: {
        numero: ct.numero, // garde le numéro source (CTR-26XX)
        prospectId,
        assigneAId: admin.id,
        dateSignature: dateDebut,
        dateDebut,
        dureeMois,
        modalitePaiement: mapModalite(ct.frequence),
        montantOneShot,
        montantMensuel,
        valeurAn1: ct.montantTotalCHF,
        statut: mapContractStatut(ct.statut),
      },
    });
    contractByLegacyNumero.set(ct.numero, created.id);
    if (!firstContractByProspectId.has(prospectId)) {
      firstContractByProspectId.set(prospectId, created.id);
    }
  }

  console.log(`  ✓ ${contractByLegacyNumero.size} contrats créés`);

  // ==========================================================================
  // ÉTAPE 3 — IMPORT DES FACTURES
  // ==========================================================================
  console.log(`\n${"-".repeat(70)}\n[3/4] Import des FACTURES`);
  let factCount = 0;
  let factSkipped = 0;
  let maxNumeroSuffix = 0;

  for (const f of factures) {
    if (!f.numero || !f.clientRaisonSociale) {
      factSkipped++;
      continue;
    }

    // Filtre les lignes parasites de légende ("Payée → Facture réglée", etc.)
    if (!/^\d{2}-/.test(f.numero)) {
      factSkipped++;
      continue;
    }
    // Filtre les DEVIS (préfixe D dans le numéro : 26-D02, 27-D05, etc.)
    // qui sont à tort dans factures.json — on les traite uniquement comme
    // notes sur le prospect.
    if (/^\d{2}-D/i.test(f.numero)) {
      console.log(
        `  ⏭ Devis ${f.numero} (${f.clientRaisonSociale}) — ignoré (pas une facture)`,
      );
      factSkipped++;
      continue;
    }

    // Garde trace du plus haut numéro pour mettre à jour le Counter
    const m = f.numero.match(/^26-(\d+)$/);
    if (m) maxNumeroSuffix = Math.max(maxNumeroSuffix, parseInt(m[1], 10));

    const resolved = resolveClientName(f.clientRaisonSociale, prospectByName);
    let prospectId = resolved ? prospectByName.get(resolved) : undefined;

    // Si on ne trouve toujours pas le prospect, on en crée un automatique
    // (Good4Bees, M A K E & Beyond, Sigma Consulting SA si pas mappé, etc.)
    if (!prospectId) {
      console.log(
        `  + Création prospect automatique pour facture ${f.numero} : "${f.clientRaisonSociale}"`,
      );
      if (DRY) {
        const fakeId = `dry-auto-${factCount}`;
        prospectByName.set(f.clientRaisonSociale, fakeId);
        prospectId = fakeId;
      } else {
        const auto = await prisma.prospect.create({
          data: {
            raisonSociale: f.clientRaisonSociale,
            statut: "SIGNE",
            assigneAId: admin.id,
            notesGenerales:
              "Créé automatiquement à l'import (présent dans factures.json mais absent de clients.json)",
            pays: "Suisse",
          },
        });
        prospectByName.set(f.clientRaisonSociale, auto.id);
        prospectId = auto.id;
      }
    }

    // Lien vers contrat : via contratRef
    let contractId: string | undefined = contractByLegacyNumero.get(f.contratRef);
    // Fallback 1 : premier contrat du prospect (mémorisé en étape 2)
    if (!contractId) {
      contractId = firstContractByProspectId.get(prospectId);
    }
    // Fallback 2 : recherche DB si on est en vrai run
    if (!contractId && !DRY) {
      const matchByClient = await prisma.contract.findFirst({
        where: { prospectId },
        select: { id: true },
      });
      contractId = matchByClient?.id;
    }
    if (!contractId) {
      console.warn(
        `  ⚠ Facture ${f.numero} (${f.clientRaisonSociale}) : pas de contrat — création d'un contrat placeholder`,
      );
      if (!DRY) {
        const placeholder = await prisma.contract.create({
          data: {
            numero: `PLACEHOLDER-${f.numero}`,
            prospectId,
            assigneAId: admin.id,
            dateSignature: parseDate(f.dateEmission) ?? new Date(),
            dateDebut: parseDate(f.dateEmission) ?? new Date(),
            dureeMois: 12,
            modalitePaiement: "CENT_AU_SIGNING",
            montantOneShot: f.montantCHF,
            montantMensuel: 0,
            valeurAn1: f.montantCHF,
            statut: "ACTIF",
          },
        });
        contractId = placeholder.id;
      } else {
        continue;
      }
    }

    const dateEmission = parseDate(f.dateEmission) ?? new Date();
    const dateEcheance = parseDate(f.dateEcheance) ?? new Date(dateEmission.getTime() + 30 * 86400_000);
    const statut = mapFactureStatut(f.statut);

    if (DRY) {
      console.log(
        `  [DRY] ${f.numero.padEnd(8)} ${f.clientRaisonSociale.padEnd(30)} ${String(f.montantCHF).padStart(8)} CHF  ${statut}`,
      );
      factCount++;
      continue;
    }

    // Type "PONCTUELLE" pour la majorité, "MENSUALITE" si le mois est dans la description
    const isMensualite = /mois|mensuel/i.test(f.description) && !/Renouvellement/i.test(f.description);
    const type = isMensualite ? "MENSUALITE" : "PONCTUELLE";

    const totalCents = Math.round(f.montantCHF * 100);
    const datePaiement = parseDate(f.datePaiement);

    const created = await prisma.clientInvoice.create({
      data: {
        contractId,
        numero: f.numero, // 26-XX preservé
        dateEmission,
        dateEcheance,
        type,
        sousTotal: f.montantCHF,
        totalTVA: 0,
        total: f.montantCHF,
        statut,
        notesClient: [f.description, f.notes].filter(Boolean).join(" — ") || null,
      },
    });

    // Si payée → crée le Payment ENCAISSE correspondant
    if (statut === "PAYEE" && datePaiement) {
      await prisma.payment.create({
        data: {
          contractId,
          clientInvoiceId: created.id,
          date: datePaiement,
          montant: f.montantCHF,
          type: "MENSUALITE",
          statut: "ENCAISSE",
          referenceFactureClient: f.numero,
        },
      });
    }

    factCount++;
  }

  console.log(`  ✓ ${factCount} factures créées (${factSkipped} ignorées)`);

  // Met à jour le Counter pour reprendre à la suite (26-92 si maxNumeroSuffix=91)
  if (!DRY && maxNumeroSuffix > 0) {
    await prisma.counter.upsert({
      where: { scope_year: { scope: "client_invoice", year: 2026 } },
      create: { scope: "client_invoice", year: 2026, value: maxNumeroSuffix },
      update: { value: maxNumeroSuffix },
    });
    console.log(`  ✓ Counter client_invoice 2026 → ${maxNumeroSuffix} (prochain : ${maxNumeroSuffix + 1})`);
  }

  // ==========================================================================
  // ÉTAPE 4 — IMPORT DES CHARGES
  // ==========================================================================
  console.log(`\n${"-".repeat(70)}\n[4/4] Import des CHARGES`);
  let chargeCount = 0;

  for (const ch of charges) {
    if (!ch.description) continue;
    const date = parseDate(ch.date) ?? new Date(2026, 0, 1); // 1er janvier par défaut si pas de date
    const categorie = mapExpenseCategorie(ch.categorieSource, ch.description);
    const montant = ch.montantCHF || 0;

    if (DRY) {
      console.log(
        `  [DRY] ${date.toISOString().slice(0, 10)}  ${categorie.padEnd(18)}  ${ch.description.padEnd(50)}  ${montant} CHF`,
      );
      chargeCount++;
      continue;
    }

    // ACLR pas assujettie à la TVA → tvaActive = false, tauxTVA = 0
    // Les montantCHF du JSON sont déjà TTC (= HT puisque pas de TVA)
    await prisma.expense.create({
      data: {
        date,
        categorie,
        fournisseur: ch.fournisseur || null,
        description: ch.description,
        montantHT: montant,
        tauxTVA: 0,
        montantTVA: 0,
        montantTTC: montant,
        tvaRecuperable: false, // ACLR pas assujettie, donc rien à récupérer
        methodPaiement: detectMethodPaiement(ch.description, ch.notes),
        ocrUtilise: false,
        createdById: admin.id,
      },
    });
    chargeCount++;
  }

  console.log(`  ✓ ${chargeCount} charges créées`);

  // ==========================================================================
  // RÉCAP
  // ==========================================================================
  console.log(`\n${"=".repeat(70)}`);
  if (DRY) {
    console.log("DRY-RUN terminé. Rien n'a été écrit en DB.");
    console.log("\nPour exécuter pour de vrai :");
    console.log("  npx tsx scripts/import-from-cowork/import.ts --execute");
  } else {
    console.log("✓ Import terminé.");
    console.log("\nVérifier :");
    console.log("  npx prisma studio");
  }
  console.log("=".repeat(70));
}

function detectMethodPaiement(
  description: string,
  notes: string,
): MethodPaiement | null {
  const txt = (description + " " + notes).toLowerCase();
  if (txt.includes("twint")) return "TWINT";
  if (txt.includes("paypal")) return "PAYPAL";
  if (txt.includes("virement")) return "VIREMENT";
  if (txt.includes("prélèvement") || txt.includes("prelevement")) return "PRELEVEMENT";
  if (txt.includes("ubs") || txt.includes("carte") || txt.includes("cb")) return "CARTE_BANCAIRE";
  return null;
}

main()
  .catch((e) => {
    console.error("ERREUR :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
