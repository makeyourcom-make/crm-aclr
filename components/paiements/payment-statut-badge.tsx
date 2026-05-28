import { PaymentStatut } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<PaymentStatut, string> = {
  EN_ATTENTE: "En attente",
  ENCAISSE: "Encaissé",
  EN_RETARD: "En retard",
};

const COLORS: Record<PaymentStatut, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600",
  ENCAISSE: "bg-emerald-100 text-emerald-700",
  EN_RETARD: "bg-red-100 text-red-700",
};

export function PaymentStatutBadge({ statut }: { statut: PaymentStatut }) {
  return (
    <Badge variant="secondary" className={cn("font-normal", COLORS[statut])}>
      {LABELS[statut]}
    </Badge>
  );
}
