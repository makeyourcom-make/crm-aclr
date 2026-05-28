"use client";

/**
 * Bouton "Signer en direct" — pour les RDV où Sophie présente le contrat
 * au client face à face avec sa tablette.
 *
 * Comportement :
 *   - S'il n'existe pas encore de Signature pour ce contrat, on en crée une
 *     (token unique, expiration 14 jours)
 *   - On ouvre directement la page publique /sign/{token} dans un NOUVEL onglet
 *     en mode plein écran, prête à être tendue au client
 *
 * Pratique sur tablette : Sophie présente la tablette, le client tape son nom,
 * coche les CGV, clique "Signer". Le contrat passe en SIGNEE_CLIENT, prêt
 * pour la contre-signature ACLR.
 */
import { useTransition } from "react";
import { toast } from "sonner";

import { createSignatureRequest } from "@/app/(app)/signatures/actions";
import { Icon } from "@/components/icon";

interface SignInPersonButtonProps {
  contractId: string;
  /** Si une Signature existe déjà, son token (sinon on en crée une). */
  existingToken?: string | null;
}

export function SignInPersonButton({
  contractId,
  existingToken,
}: SignInPersonButtonProps) {
  const [pending, startTransition] = useTransition();

  const handle = () => {
    if (existingToken) {
      // Ouvre directement la page de signature avec le token existant
      window.open(`/sign/${existingToken}`, "_blank");
      return;
    }
    startTransition(async () => {
      const res = await createSignatureRequest(contractId);
      if (!res.ok || !res.lienSignature) {
        toast.error(res.error ?? "Impossible de créer la demande.");
        return;
      }
      toast.success("Lien créé — passe la tablette au client.");
      window.open(`/sign/${res.lienSignature}`, "_blank");
    });
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
      title="Ouvre la page de signature pour la donner au client en RDV"
    >
      <Icon name="PenTool" className="h-4 w-4" />
      {pending ? "Préparation…" : "Signer en direct"}
    </button>
  );
}
