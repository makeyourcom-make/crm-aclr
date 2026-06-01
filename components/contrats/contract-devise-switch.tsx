"use client";

/**
 * Petit switch CHF/EUR pour changer la devise d'un contrat AVANT signature client.
 * Utilisé dans le panneau de Deal.
 *
 * Comportement : 2 boutons en pill — celui actif est highlight. Au clic, on
 * appelle la server action et on refresh la route.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateContractDevise } from "@/app/(app)/contrats/actions";

interface Props {
  contractId: string;
  current: string;
  /** Quand vrai → désactivé (contrat signé) */
  locked?: boolean;
}

export function ContractDeviseSwitch({
  contractId,
  current,
  locked = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cur = current.toUpperCase();

  const handleSwitch = (next: "CHF" | "EUR") => {
    if (next === cur || pending) return;
    startTransition(async () => {
      const res = await updateContractDevise(contractId, next);
      if (!res.ok) {
        alert(res.error ?? "Erreur lors du changement de devise.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-blue-900">
        Devise
      </p>
      <div className="inline-flex overflow-hidden rounded-md border border-blue-300 bg-white">
        <button
          type="button"
          onClick={() => handleSwitch("CHF")}
          disabled={locked || pending}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            cur === "CHF"
              ? "bg-blue-600 text-white"
              : "text-blue-900 hover:bg-blue-50"
          } ${locked || pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          CHF
        </button>
        <button
          type="button"
          onClick={() => handleSwitch("EUR")}
          disabled={locked || pending}
          className={`border-l border-blue-300 px-3 py-1.5 text-xs font-medium transition ${
            cur === "EUR"
              ? "bg-blue-600 text-white"
              : "text-blue-900 hover:bg-blue-50"
          } ${locked || pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          EUR
        </button>
      </div>
      {locked && (
        <p className="text-[10px] text-blue-700">
          Contrat signé — devise figée.
        </p>
      )}
    </div>
  );
}
