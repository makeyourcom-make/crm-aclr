import { ProspectStatut } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  PROSPECT_STATUT_COLORS,
  getProspectStatutLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export function ProspectStatutBadge({ statut }: { statut: ProspectStatut }) {
  // « Vierge » = fiche ouverte mais pas encore contactée → aucun badge (vide).
  if (statut === "VIERGE") return null;
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", PROSPECT_STATUT_COLORS[statut])}
    >
      {getProspectStatutLabel(statut)}
    </Badge>
  );
}
