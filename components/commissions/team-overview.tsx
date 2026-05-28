import { formatCHF } from "@/lib/format";

interface TeamOverviewProps {
  rows: Array<{
    userId: string;
    userName: string;
    acquis: number;
    aVenir: number;
    annule: number;
  }>;
}

export function TeamOverview({ rows }: TeamOverviewProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune commerciale n&apos;a de commission en cours.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th>Commerciale</Th>
            <Th className="text-right">Acquise</Th>
            <Th className="text-right">À venir</Th>
            <Th className="text-right">Annulée</Th>
            <Th className="text-right">Total potentiel</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.userId}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2.5 font-medium">{r.userName}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                {formatCHF(r.acquis)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatCHF(r.aVenir)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatCHF(r.annule)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {formatCHF(r.acquis + r.aVenir)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
