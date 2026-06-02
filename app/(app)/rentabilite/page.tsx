import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatPercent } from "@/lib/format";
import { getRentabilite } from "@/lib/queries/rentabilite";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Rentabilité clients" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RentabilitePage({ searchParams }: PageProps) {
  await requireAdmin();
  const raw = await searchParams;

  // Période : YTD par défaut, ou période custom via ?from=&to=
  const now = new Date();
  const periodeParam = typeof raw.periode === "string" ? raw.periode : "ytd";

  let from = new Date(now.getFullYear(), 0, 1);
  let to = new Date(now.getFullYear() + 1, 0, 1);

  if (periodeParam === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (periodeParam === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    from = new Date(now.getFullYear(), q, 1);
    to = new Date(now.getFullYear(), q + 3, 1);
  } else if (periodeParam === "12m") {
    from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const data = await getRentabilite({ from, to });

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Rentabilité clients"
        description={`Marge brute par client = CA facturé - charges directes/allouées. Période : ${formatPeriodeLabel(periodeParam, from, to)}.`}
      />

      {/* Filtres période */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Période :
        </span>
        {[
          { v: "month", l: "Mois en cours" },
          { v: "quarter", l: "Trimestre" },
          { v: "ytd", l: "Année (YTD)" },
          { v: "12m", l: "12 derniers mois" },
        ].map((opt) => (
          <Link
            key={opt.v}
            href={`/rentabilite?periode=${opt.v}`}
            className={`inline-flex h-7 items-center rounded-md border px-3 text-xs ${
              periodeParam === opt.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {opt.l}
          </Link>
        ))}
      </div>

      {/* KPIs globaux */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="CA facturé"
          value={formatCHF(data.totals.caFacture)}
          subtitle={`${data.rows.length} client(s) actif(s)`}
          tone="primary"
        />
        <Kpi
          label="Charges allouées clients"
          value={formatCHF(data.totals.chargesTotal)}
          subtitle="Directes + ventilées"
          tone="amber"
        />
        <Kpi
          label="Marge brute"
          value={formatCHF(data.totals.margeBrute)}
          subtitle={
            data.totals.margePct !== null
              ? formatPercent(data.totals.margePct * 100) + " de marge"
              : "—"
          }
          tone={data.totals.margeBrute >= 0 ? "emerald" : "rose"}
        />
        <Kpi
          label="Frais généraux"
          value={formatCHF(data.chargesInternes.total)}
          subtitle={`${data.chargesInternes.count} charges internes (hors client)`}
          tone="muted"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Client</Th>
                <Th className="text-right">Factures</Th>
                <Th className="text-right">CA facturé</Th>
                <Th className="text-right">CA encaissé</Th>
                <Th className="text-right">Charges directes</Th>
                <Th className="text-right">Allocations</Th>
                <Th className="text-right">Marge brute</Th>
                <Th className="text-right">Marge %</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    Aucune donnée pour cette période.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => {
                  const sign = r.margeBrute >= 0 ? "+" : "";
                  return (
                    <tr
                      key={r.prospectId}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/prospects/${r.prospectId}`}
                          className="font-medium hover:text-primary"
                        >
                          {r.raisonSociale}
                        </Link>
                        <div className="mt-0.5">
                          <Badge variant="outline" className="font-normal text-[10px]">
                            {r.statut}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {r.nbFactures || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {r.caFacture > 0 ? formatCHF(r.caFacture) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-emerald-700">
                        {r.caEncaisse > 0 ? formatCHF(r.caEncaisse) : "—"}
                        {r.caEnAttente > 0.01 && (
                          <div className="text-[10px] text-amber-700">
                            +{formatCHF(r.caEnAttente)} en attente
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-rose-700">
                        {r.chargesDirectes > 0
                          ? `-${formatCHF(r.chargesDirectes)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-rose-700">
                        {r.chargesAllouees > 0
                          ? `-${formatCHF(r.chargesAllouees)}`
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          r.margeBrute >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {sign}
                        {formatCHF(r.margeBrute)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums text-xs ${
                          (r.margePct ?? 0) >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {r.margePct !== null
                          ? formatPercent(r.margePct * 100)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Légende */}
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          <strong>Charges directes</strong> = charges 100% attribuables au client
          (ex. nom de domaine, hébergement, sous-traitance dédiée).
        </p>
        <p>
          <strong>Allocations</strong> = part de charges multi-clients ventilée
          sur le client (ex. Lucas Community Manager, Google Ads).
        </p>
        <p>
          <strong>Frais généraux</strong> = charges sans rattachement client
          (loyer, software interne, frais bancaires, etc.).
        </p>
        <p className="pt-2">
          💡 Pour rattacher une charge à un client, ouvre la charge dans{" "}
          <Link href="/charges" className="text-primary hover:underline">
            /charges
          </Link>{" "}
          et sélectionne le client. Pour une charge multi-clients, utilise le
          panneau d'allocations.
        </p>
      </div>
    </div>
  );
}

function formatPeriodeLabel(p: string, from: Date, to: Date): string {
  if (p === "month") return "mois en cours";
  if (p === "quarter") return "trimestre en cours";
  if (p === "12m") return "12 derniers mois";
  return `${from.getFullYear()} (YTD)`;
}

function Kpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "primary" | "emerald" | "rose" | "amber" | "muted";
}) {
  const colorClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "primary"
            ? "text-primary"
            : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass}`}>
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
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
