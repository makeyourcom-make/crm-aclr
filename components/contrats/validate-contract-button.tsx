"use client";

/**
 * Bouton admin pour valider un contrat signé par le client.
 * Transition : ATTENTE_VALIDATION_ADMIN → ACTIF.
 *
 * Affiché uniquement aux ADMIN sur la fiche détail contrat.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { validateContract } from "@/app/(app)/contrats/actions";
import { Icon } from "@/components/icon";
import { fireConfetti } from "@/lib/confetti";

export function ValidateContractButton({ contractId }: { contractId: string }) {
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
        alert(res.error ?? "Erreur lors de la validation.");
        return;
      }
      void fireConfetti();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon name={pending ? "Loader" : "CheckCircle"} className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Validation…" : "Valider le contrat"}
    </button>
  );
}
