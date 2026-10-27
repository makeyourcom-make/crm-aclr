"use client";

/**
 * Bouton « Signer en direct » : pour les RDV où la commerciale présente le
 * contrat au client face à face avec sa tablette.
 *
 * Comportement :
 *   - S'il n'existe pas encore de Signature pour ce contrat, on en crée une
 *     (token unique, expiration 14 jours)
 *   - On ouvre directement la page publique /sign/{token} dans un NOUVEL onglet
 *     en mode plein écran, prête à être tendue au client
 *
 * Le client tape son nom, coche les CGV et signe : le contrat passe en
 * SIGNEE_CLIENT, prêt pour la contre-signature ACLR.
 *
 * Style : bouton primaire navy (l'ancien `bg-accent` est devenu rose pâle
 * avec la charte MYC Arena et rendait le bouton illisible).
 */
import { LoaderCircle, PenTool } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { createSignatureRequest } from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";

interface SignInPersonButtonProps {
  contractId: string;
  /** Si une Signature existe déjà, son token (sinon on en crée une). */
  existingToken?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function SignInPersonButton({
  contractId,
  existingToken,
  size = "default",
  className,
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
      toast.success("Lien créé · passe la tablette au client.");
      window.open(`/sign/${res.lienSignature}`, "_blank");
    });
  };

  return (
    <Button
      type="button"
      variant="default"
      size={size}
      onClick={handle}
      disabled={pending}
      title="Ouvre la page de signature pour la donner au client en RDV"
      className={className}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <PenTool aria-hidden="true" />
      )}
      {pending ? "Préparation..." : "Signer en direct"}
    </Button>
  );
}
