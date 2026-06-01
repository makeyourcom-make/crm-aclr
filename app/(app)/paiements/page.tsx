/**
 * Page /paiements — DÉPRÉCIÉE depuis qu'on a fusionné le suivi des
 * encaissements dans /factures-clients.
 *
 * Le bouton "Marquer payée" sur une facture (côté /factures-clients ou
 * sur la fiche d'un contrat) crée déjà automatiquement le Payment
 * ENCAISSE en arrière-plan, qui déclenche la cascade des commissions
 * pour Sophie.
 *
 * On garde cette route en place et on redirige vers /factures-clients
 * pour ne pas casser les bookmarks ou anciens liens.
 *
 * Le modèle Payment (Prisma) reste utilisé en interne pour la cascade
 * comptable, mais n'est plus exposé dans l'UI.
 */
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Paiements clients" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireAdmin();
  redirect("/factures-clients");
}
