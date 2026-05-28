import { ProspectStatut } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  PROSPECT_STATUT_COLORS,
  getProspectStatutLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export function ProspectStatutBadge({ statut }: { statut: ProspectStatut }) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", PROSPECT_STATUT_COLORS[statut])}
    >
      {getProspectStatutLabel(statut)}
    </Badge>
  );
}

/**
 * Affiche un score 1-5 sous forme d'étoiles pleines/vides.
 */
export function ScoreStars({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(5, score));
  return (
    <span
      className="inline-flex gap-0.5 text-amber-500"
      aria-label={`Score ${safe} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= safe ? "" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </span>
  );
}
