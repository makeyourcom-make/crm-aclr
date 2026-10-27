"use client";

/**
 * Bouton admin pour valider un contrat signé par le client.
 * Transition : ATTENTE_VALIDATION_ADMIN → ACTIF.
 *
 * Affiché uniquement aux ADMIN (fiche contrat, file « À traiter », dashboard).
 * Succès : confettis + carte « Contrat signé ! » avec le montant réel
 * (« +269.90 CHF / mois ») puis rafraîchissement de la page et de la coquille.
 */
import { CircleCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { validateContract } from "@/app/(app)/contrats/actions";
import { celebrate } from "@/components/arena/celebrate";
import { Button } from "@/components/ui/button";
import { formatSignGain } from "@/components/pipeline/pipeline-meta";

interface ValidateContractButtonProps {
  contractId: string;
  /** Raison sociale du client (carte de signature). */
  clientName?: string;
  /** Mensuel du contrat : montant mis en avant dans la carte de signature. */
  montantMensuel?: number;
  /** Commerciale assignée (prénom dans la carte de signature). */
  assigneeName?: string;
  variant?: "default" | "hero";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function ValidateContractButton({
  contractId,
  clientName,
  montantMensuel,
  assigneeName,
  variant = "default",
  size = "default",
  className,
}: ValidateContractButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (
      !confirm(
        "Valider ce contrat ? Il passera en ACTIF et les factures pourront être émises.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await validateContract(contractId);
      if (!res.ok) {
        toast.error(res.error ?? "Erreur lors de la validation.");
        return;
      }
      const firstName = assigneeName?.trim().split(/\s+/)[0];
      celebrate({
        title: "Contrat signé !",
        subtitle: clientName
          ? `${clientName} passe Actif · factures lancées`
          : "Le contrat passe Actif · factures lancées",
        highlight:
          montantMensuel !== undefined ? (formatSignGain(montantMensuel) ?? undefined) : undefined,
        eyebrow: firstName ? `Bravo ${firstName}` : "Validé",
      });
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      {pending ? "Validation..." : "Valider le contrat"}
    </Button>
  );
}
