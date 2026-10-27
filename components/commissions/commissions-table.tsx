import Link from "next/link";

import { StatusPill } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";
import { formatCHF } from "@/lib/format";
import type { CommissionPaymentDetail } from "@/lib/queries/commissions";
import { formatDateCH } from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

interface CommissionsTableProps {
  payments: CommissionPaymentDetail[];
  showCommerciale?: boolean;
}

const STATUT_LABEL: Record<string, string> = {
  PREVU: "À venir",
  PAYE: "Acquise",
  ANNULE: "Annulée",
};
const STATUT_TONE: Record<string, Tone> = {
  PREVU: "navy",
  PAYE: "green",
  ANNULE: "red",
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
      <div className="flex flex-col gap-2 md:hidden">
        {payments.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun versement de commission.
          </p>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className={cn(
                "rounded-[14px] border border-border bg-card p-3.5",
                p.statut === "ANNULE" && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/prospects/${p.commission.contract.prospect.id}`}
                    className="block truncate text-sm font-bold text-foreground hover:underline"
                  >
                    {p.commission.contract.prospect.raisonSociale}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <Link
                      href={`/contrats/${p.commission.contract.id}`}
                      className="font-mono font-semibold text-info-700 hover:underline"
                    >
                      {p.commission.contract.numero}
                    </Link>
                    {` · ${TYPE_PART_LABEL[p.typePart]}`}
                    {p.numeroMois ? ` ${p.numeroMois}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-extrabold text-foreground tabular-nums">
                  {formatCHF(Number(p.montant))}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <StatusPill tone={STATUT_TONE[p.statut] ?? "navy"}>
                  {STATUT_LABEL[p.statut] ?? p.statut}
                </StatusPill>
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {formatDateCH(p.dateVersementPrevue)}
                </span>
                {showCommerciale && (
                  <span className="font-semibold text-muted-foreground">
                    {p.commission.user.name}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Vue TABLEAU sur desktop */}
      <div className="hidden overflow-x-auto rounded-[14px] border border-border bg-card md:block">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-ground">
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
                    "border-b border-border last:border-0 hover:bg-ground/70",
                    p.statut === "ANNULE" && "opacity-60",
                  )}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {formatDateCH(p.dateVersementPrevue)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/contrats/${p.commission.contract.id}`}
                      className="font-mono text-xs font-semibold text-info-700 hover:underline"
                    >
                      {p.commission.contract.numero}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/prospects/${p.commission.contract.prospect.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {p.commission.contract.prospect.raisonSociale}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{TYPE_PART_LABEL[p.typePart]}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                    {p.numeroMois ?? "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                    {formatCHF(Number(p.montant))}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill tone={STATUT_TONE[p.statut] ?? "navy"}>
                      {STATUT_LABEL[p.statut] ?? p.statut}
                    </StatusPill>
                  </td>
                  {showCommerciale && (
                    <td className="px-3 py-2.5 text-muted-foreground">
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
      className={cn(
        "px-3 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}
