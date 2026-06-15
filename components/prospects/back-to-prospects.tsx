"use client";

import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";

/**
 * Bouton « Retour aux prospects » qui ramène l'utilisateur EXACTEMENT là où
 * il était dans la liste (page de pagination + filtres en place), via
 * l'historique du navigateur. Un lien en dur vers `/prospects` repartait à
 * la page 1 — c'était la cause du « je reviens à 0 ».
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
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
      Retour aux prospects
    </button>
  );
}
