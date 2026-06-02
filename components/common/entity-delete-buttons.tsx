"use client";

/**
 * Wrappers pré-câblés du DeleteButton générique pour chaque entité.
 * Évite de définir la fonction `onDelete` à chaque appel et garde une
 * UX cohérente (messages, libellés, garde-fous).
 */
import { deleteEmail } from "@/app/(app)/emails/actions";
import { deleteActivity } from "@/app/(app)/activites/actions";
import { deleteDeal } from "@/app/(app)/pipeline/actions";
import { deleteSignature } from "@/app/(app)/signatures/actions";
import {
  deleteClientInvoice,
  deleteContract,
} from "@/app/(app)/contrats/actions";
import { DeleteButton } from "@/components/common/delete-button";

interface BaseProps {
  variant?: "icon" | "full";
}

export function DeleteEmailButton({
  emailId,
  variant = "icon",
}: BaseProps & { emailId: string }) {
  return (
    <DeleteButton
      variant={variant}
      onDelete={() => deleteEmail(emailId)}
      confirmMessage="Supprimer cet email du CRM ? L'envoi (s'il a été fait) ne sera pas annulé côté destinataire."
      label="Supprimer l'email"
    />
  );
}

export function DeleteActivityButton({
  activityId,
  variant = "icon",
}: BaseProps & { activityId: string }) {
  return (
    <DeleteButton
      variant={variant}
      onDelete={async () => {
        const res = await deleteActivity(activityId);
        return { ok: res.ok, error: res.error };
      }}
      confirmMessage="Supprimer cette activité de l'agenda ?"
      label="Supprimer l'activité"
    />
  );
}

export function DeleteDealButton({
  dealId,
  variant = "full",
}: BaseProps & { dealId: string }) {
  return (
    <DeleteButton
      variant={variant}
      onDelete={async () => {
        const res = await deleteDeal(dealId);
        return { ok: res.ok, error: res.error };
      }}
      confirmMessage="Supprimer ce deal du pipeline ? Cette action est irréversible."
      label="Supprimer le deal"
    />
  );
}

export function DeleteSignatureButton({
  signatureId,
  variant = "icon",
}: BaseProps & { signatureId: string }) {
  return (
    <DeleteButton
      variant={variant}
      onDelete={async () => {
        const res = await deleteSignature(signatureId);
        return { ok: res.ok, error: res.error };
      }}
      confirmMessage="Supprimer cette demande de signature ?"
      label="Supprimer la signature"
    />
  );
}

export function DeleteClientInvoiceButton({
  invoiceId,
  isPayee,
  variant = "icon",
}: BaseProps & { invoiceId: string; isPayee?: boolean }) {
  return (
    <DeleteButton
      variant={variant}
      disabled={isPayee}
      disabledReason="Facture payée — non supprimable (créer un avoir)"
      onDelete={async () => {
        const res = await deleteClientInvoice(invoiceId);
        return { ok: res.ok, error: res.error };
      }}
      confirmMessage="Supprimer cette facture client ? Action irréversible. Si elle a déjà été envoyée au client, préviens-le."
      label="Supprimer la facture"
    />
  );
}

export function DeleteContractButton({
  contractId,
  canDelete,
  variant = "full",
}: BaseProps & { contractId: string; canDelete: boolean }) {
  return (
    <DeleteButton
      variant={variant}
      disabled={!canDelete}
      disabledReason="Contrat signé ou avec factures payées — utiliser 'Résilier'"
      onDelete={async () => {
        const res = await deleteContract(contractId);
        return { ok: res.ok, error: res.error };
      }}
      confirmMessage="Supprimer définitivement ce contrat ? Cette action effacera les factures brouillon liées et est irréversible."
      label="Supprimer le contrat"
    />
  );
}
