import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatCHF, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CommissionPaymentDetail } from "@/lib/queries/commissions";

interface CommissionsTableProps {
  payments: CommissionPaymentDetail[];
  showCommerciale?: boolean;
}

const STATUT_LABEL: Record<string, string> = {
  PREVU: "À venir",
  PAYE: "Acquise",
  ANNULE: "Annulée",
};
const STATUT_BADGE: Record<string, string> = {
  PREVU: "bg-slate-100 text-slate-600",
  PAYE: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-red-100 text-red-700",
};
const TYPE_PART_LABEL: Record<string, string> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};

export function CommissionsTable({
  payments,
  showCommerciale,
}: CommissionsTableProps) {
  return (
    <>
      {/* Vue CARTES sur mobile */}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card md:hidden">
        {payments.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Aucun versement de commission.
          </p>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className={cn("p-3", p.statut === "ANNULE" && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/prospects/${p.commission.contract.prospect.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {p.commission.contract.prospect.raisonSociale}
                  </Link>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    <Link
                      href={`/contrats/${p.commission.contract.id}`}
                      className="hover:underline"
                    >
                      {p.commission.contract.numero}
                    </Link>
                    {` · ${TYPE_PART_LABEL[p.typePart]}`}
                    {p.numeroMois ? ` ${p.numeroMois}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatCHF(Number(p.montant))}
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <Badge
                  variant="secondary"
                  className={cn("font-normal", STATUT_BADGE[p.statut])}
                >
                  {STATUT_LABEL[p.statut] ?? p.statut}
                </Badge>
                <span className="tabular-nums text-muted-foreground">
                  {formatDate(p.dateVersementPrevue)}
                </span>
                {showCommerciale && (
                  <span className="text-muted-foreground">
                    {p.commission.user.name}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Vue TABLEAU sur desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th>Date prévue</Th>
            <Th>Contrat</Th>
            <Th>Client</Th>
            <Th>Type</Th>
            <Th>Mois</Th>
            <Th className="text-right">Montant</Th>
            <Th>Statut</Th>
            {showCommerciale && <Th>Commerciale</Th>}
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td
                colSpan={showCommerciale ? 8 : 7}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                Aucun versement de commission.
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-border last:border-0 hover:bg-muted/30",
                  p.statut === "ANNULE" && "opacity-60",
                )}
              >
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {formatDate(p.dateVersementPrevue)}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/contrats/${p.commission.contract.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {p.commission.contract.numero}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm">
                  <Link
                    href={`/prospects/${p.commission.contract.prospect.id}`}
                    className="hover:underline"
                  >
                    {p.commission.contract.prospect.raisonSociale}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {TYPE_PART_LABEL[p.typePart]}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {p.numeroMois ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCHF(Number(p.montant))}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-normal",
                      STATUT_BADGE[p.statut],
                    )}
                  >
                    {STATUT_LABEL[p.statut] ?? p.statut}
                  </Badge>
                </td>
                {showCommerciale && (
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.commission.user.name}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
