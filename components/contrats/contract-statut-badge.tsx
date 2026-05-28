import { ContractStatut } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<ContractStatut, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RESILIE: "Résilié",
  EXPIRE: "Expiré",
};

const COLORS: Record<ContractStatut, string> = {
  ACTIF: "bg-emerald-100 text-emerald-800",
  SUSPENDU: "bg-amber-100 text-amber-800",
  RESILIE: "bg-red-100 text-red-700",
  EXPIRE: "bg-slate-100 text-slate-600",
};

export function ContractStatutBadge({ statut }: { statut: ContractStatut }) {
  return (
    <Badge variant="secondary" className={cn("font-normal", COLORS[statut])}>
      {LABELS[statut]}
    </Badge>
  );
}
