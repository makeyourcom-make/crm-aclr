"use client";

/**
 * Petit switch CHF/EUR pour changer la devise d'un contrat AVANT signature client.
 * Utilisé dans le panneau de Deal.
 *
 * Comportement : 2 boutons en pill, celui actif est mis en avant. Au clic, on
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
      <p className="text-[11px] font-bold tracking-[0.08em] text-info-700 uppercase">
        Devise
      </p>
      <div
        role="group"
        aria-label="Devise du contrat"
        className="inline-flex overflow-hidden rounded-[10px] border border-info-500/40 bg-card"
      >
        <button
          type="button"
          onClick={() => handleSwitch("CHF")}
          disabled={locked || pending}
          aria-pressed={cur === "CHF"}
          className={`px-3 py-1.5 text-xs font-bold transition ${
            cur === "CHF"
              ? "bg-info-700 text-white"
              : "text-info-700 hover:bg-info-50"
          } ${locked || pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          CHF
        </button>
        <button
          type="button"
          onClick={() => handleSwitch("EUR")}
          disabled={locked || pending}
          aria-pressed={cur === "EUR"}
          className={`border-l border-info-500/40 px-3 py-1.5 text-xs font-bold transition ${
            cur === "EUR"
              ? "bg-info-700 text-white"
              : "text-info-700 hover:bg-info-50"
          } ${locked || pending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          EUR
        </button>
      </div>
      {locked && (
        <p className="text-[11px] font-semibold text-info-700">
          Contrat signé : devise figée.
        </p>
      )}
    </div>
  );
}
