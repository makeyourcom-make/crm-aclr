import { InvoiceStatut } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<InvoiceStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
};

const COLORS: Record<InvoiceStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYEE: "bg-blue-100 text-blue-700",
  PAYEE: "bg-emerald-100 text-emerald-700",
};

export function InvoiceStatutBadge({ statut }: { statut: InvoiceStatut }) {
  return (
    <Badge variant="secondary" className={cn("font-normal", COLORS[statut])}>
      {LABELS[statut]}
    </Badge>
  );
}
