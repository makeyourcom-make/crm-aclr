/**
 * Facture « 100 % à la signature » du contrat ACLR-2026-0052 (LaPochette.ch).
 *
 * Modalité CENT_AU_SIGNING = tout le contrat facturé d'un coup. Le contrat dure
 * 6 mois à 59 CHF/mois → 354 CHF (et NON 708 : le générateur multipliait par 12
 * quelle que soit la durée — bug corrigé le 22.07.2026 dans
 * buildClientInvoicesForContract).
 *
 * Créée en BROUILLON : elle apparaît dans Factures clients, prête à envoyer.
 * Idempotent : ne recrée rien si une facture existe déjà pour ce contrat.
 */
import { PrismaClient } from "@prisma/client";
import { FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT, PREFIX_FACTURE_CLIENT } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({
    where: { numero: "ACLR-2026-0052" },
    select: {
      id: true, numero: true, dureeMois: true, dateSignature: true, devise: true,
      montantOneShot: true, montantMensuel: true, modalitePaiement: true,
      prospect: { select: { raisonSociale: true } },
      products: { select: { id: true, nom: true, prixMensuel: true, prixOneShot: true } },
      clientInvoices: { select: { numero: true } },
    },
  });
  if (!c) throw new Error("Contrat ACLR-2026-0052 introuvable.");
  if (c.clientInvoices.length > 0) {
    console.log(`Facture déjà existante (${c.clientInvoices.map(f=>f.numero).join(", ")}) — rien à faire.`);
    return;
  }
  if (c.modalitePaiement !== "CENT_AU_SIGNING") {
    throw new Error(`Modalité inattendue : ${c.modalitePaiement}`);
  }

  const mois = c.dureeMois;
  const total = Number(c.montantOneShot) + Number(c.montantMensuel) * mois;

  const dateEmission = new Date(c.dateSignature);
  const dateEcheance = new Date(dateEmission);
  dateEcheance.setDate(dateEcheance.getDate() + FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT);
  const annee = dateEmission.getFullYear();

  const facture = await prisma.$transaction(async (tx) => {
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
        type: "PONCTUELLE",
        devise: c.devise,
        sousTotal: total,
        totalTVA: 0,
        total,
        statut: "BROUILLON",
        notesClient: `Prestation payable en une fois à la signature — période du contrat : ${mois} mois.`,
        lignes: {
          create: c.products.map((p) => ({
            designation: `${p.nom} — ${mois} mois`,
            quantite: 1,
            prixUnitaire: Number(p.prixOneShot ?? 0) + Number(p.prixMensuel ?? 0) * mois,
            montantHT: Number(p.prixOneShot ?? 0) + Number(p.prixMensuel ?? 0) * mois,
            productId: p.id,
          })),
        },
      },
      include: { lignes: true },
    });
  });

  console.log(`Facture créée ✓  ${facture.numero}`);
  console.log(`   Client   : ${c.prospect.raisonSociale}`);
  console.log(`   Contrat  : ${c.numero} (${mois} mois, ${c.montantMensuel}/mois, 100 % à la signature)`);
  console.log(`   Montant  : ${c.devise} ${total.toFixed(2)}   (au lieu de ${(Number(c.montantMensuel)*12).toFixed(2)} avec l'ancien calcul ×12)`);
  console.log(`   Émission : ${dateEmission.toISOString().slice(0,10)} — échéance ${dateEcheance.toISOString().slice(0,10)}`);
  console.log(`   Statut   : BROUILLON (prête à envoyer)`);
  facture.lignes.forEach(l => console.log(`   Ligne    : ${l.designation} — ${l.montantHT}`));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
