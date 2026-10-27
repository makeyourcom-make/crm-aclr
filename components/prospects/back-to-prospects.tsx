"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Bouton « Retour aux entreprises » qui ramène l'utilisateur EXACTEMENT là où
 * il était dans la liste (page de pagination + filtres en place), via
 * l'historique du navigateur. Un lien en dur vers `/prospects` repartait à
 * la page 1 : c'était la cause du « je reviens à 0 ».
 *
 * Fallback (visite directe de la fiche, pas d'historique) : la liste par défaut.
 */
export function BackToProspects() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/prospects");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex h-9 items-center gap-1 rounded-[10px] pr-2.5 pl-1.5 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      Retour aux entreprises
    </button>
  );
}
