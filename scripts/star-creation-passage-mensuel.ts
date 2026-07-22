/**
 * Star création by Bettina (ACLR-2026-0050) : passage du 100 % à la signature
 * à une facturation MENSUELLE (demande Arthur, 22.07.2026).
 *
 *   1. Supprime la facture annuelle ACLR-CLI-2026-0513 (358.80 = 29.90 × 12).
 *      Sûr : elle est en BROUILLON, jamais envoyée, jamais payée, aucun
 *      paiement rattaché — le client ne l'a donc jamais vue. Le script REFUSE
 *      d'agir si l'un de ces points n'est plus vrai.
 *   2. Bascule le contrat en MENSUEL — c'est ce qui le rend éligible au
 *      générateur mensuel (CENT_AU_SIGNING en est explicitement exclu).
 *   3. Crée la 1re mensualité (29.90) en BROUILLON, prête à envoyer.
 *
 * Les mensualités 2/12 et suivantes seront créées automatiquement par le cron
 * mensuel. On ne crée QUE la première ici : le CRM génère au fil de l'eau,
 * jamais 12 mois d'avance. `periodeMoisDebut` est renseigné pour que le cron
 * reconnaisse juillet comme déjà facturé (clé de dédup = mois de la période).
 */
import { PrismaClient } from "@prisma/client";
import {
  FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT,
  PREFIX_FACTURE_CLIENT,
} from "../lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NUMERO_CONTRAT = "ACLR-2026-0050";
const NUMERO_FACTURE_A_SUPPRIMER = "ACLR-CLI-2026-0513";

async function main() {
  const c = await prisma.contract.findFirst({
    where: { numero: NUMERO_CONTRAT },
    include: {
      prospect: { select: { raisonSociale: true, email: true } },
      products: { select: { id: true, nom: true, prixMensuel: true } },
      clientInvoices: { include: { payments: true } },
    },
  });
  if (!c) throw new Error(`Contrat ${NUMERO_CONTRAT} introuvable.`);

  const facture = c.clientInvoices.find((f) => f.numero === NUMERO_FACTURE_A_SUPPRIMER);
  if (!facture) {
    console.log(`Facture ${NUMERO_FACTURE_A_SUPPRIMER} absente — déjà supprimée ?`);
  } else {
    // Garde-fous : on ne supprime jamais une facture partie chez le client.
    if (facture.statut !== "BROUILLON")
      throw new Error(`REFUS : statut ${facture.statut} (attendu BROUILLON).`);
    if (facture.envoiClientLe)
      throw new Error(`REFUS : déjà envoyée le ${facture.envoiClientLe.toISOString()}.`);
    if (facture.datePaiement || facture.payments.length > 0)
      throw new Error("REFUS : un paiement est rattaché.");
  }

  const mensuel = Number(c.montantMensuel);
  const dateEmission = new Date(c.dateDebut);
  const periodeFin = new Date(dateEmission);
  periodeFin.setMonth(periodeFin.getMonth() + 1);
  periodeFin.setDate(periodeFin.getDate() - 1);
  const dateEcheance = new Date(dateEmission);
  dateEcheance.setDate(dateEcheance.getDate() + FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT);

  console.log(`Client   : ${c.prospect.raisonSociale} (email : ${c.prospect.email ?? "AUCUN"})`);
  console.log(`Contrat  : ${c.numero} — ${c.modalitePaiement} → MENSUEL`);
  console.log(`Supprime : ${facture ? `${facture.numero} (${c.devise} ${facture.total}, ${facture.statut})` : "—"}`);
  console.log(`Crée     : mensualité 1/12 — ${c.devise} ${mensuel.toFixed(2)}`);
  console.log(`           émission ${dateEmission.toISOString().slice(0,10)} · échéance ${dateEcheance.toISOString().slice(0,10)}`);
  console.log(`           période ${dateEmission.toISOString().slice(0,10)} → ${periodeFin.toISOString().slice(0,10)}`);

  if (!APPLY) {
    console.log("\nDRY-RUN — relancer avec --apply pour écrire.");
    return;
  }

  const creee = await prisma.$transaction(async (tx) => {
    if (facture) {
      await tx.clientInvoiceLine.deleteMany({ where: { clientInvoiceId: facture.id } });
      await tx.clientInvoice.delete({ where: { id: facture.id } });
    }
    await tx.contract.update({
      where: { id: c.id },
      data: { modalitePaiement: "MENSUEL" },
    });

    const annee = dateEmission.getFullYear();
    const counter = await tx.counter.upsert({
      where: { scope_year: { scope: "client_invoice", year: annee } },
      create: { scope: "client_invoice", year: annee, value: 1 },
      update: { value: { increment: 1 } },
    });
    const numero = `${PREFIX_FACTURE_CLIENT}-${annee}-${String(counter.value).padStart(4, "0")}`;

    return tx.clientInvoice.create({
      data: {
        contractId: c.id,
        numero,
        dateEmission,
        dateEcheance,
        type: "MENSUALITE",
        devise: c.devise,
        periodeMoisDebut: dateEmission,
        periodeMoisFin: periodeFin,
        sousTotal: mensuel,
        totalTVA: 0,
        total: mensuel,
        statut: "BROUILLON",
        lignes: {
          create: c.products
            .filter((p) => Number(p.prixMensuel ?? 0) > 0)
            .map((p, idx) => ({
              designation: `${p.nom} — mensualité 1/12`,
              quantite: 1,
              prixUnitaire: Number(p.prixMensuel),
              montantHT: Number(p.prixMensuel),
              tauxTVA: 0,
              ordre: idx,
              productId: p.id,
            })),
        },
      },
      include: { lignes: true },
    });
  });

  console.log(`\n✓ Facture annuelle supprimée, contrat passé en MENSUEL.`);
  console.log(`✓ ${creee.numero} créée — ${c.devise} ${Number(creee.total).toFixed(2)} (BROUILLON, prête à envoyer)`);
  creee.lignes.forEach((l) => console.log(`   · ${l.designation} — ${l.montantHT}`));
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
