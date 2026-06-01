import Link from "next/link";

import { MonthlyPnLChart } from "@/components/compta/monthly-pnl-chart";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import { getComptaCockpit } from "@/lib/queries/compta";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Comptabilité" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ComptaPage({ searchParams }: PageProps) {
  await requireAdmin();
  const raw = await searchParams;
  const monthsBack = Number(raw.back ?? 12) || 12;
  const monthsForward = Number(raw.forward ?? 6) || 6;

  const data = await getComptaCockpit(monthsBack, monthsForward);

  const now = new Date();
  const currentMonthLabel = now
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric" })
    .replace(/^(.)/, (m) => m.toUpperCase());

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Comptabilité"
        description={`P&L mois par mois — ${monthsBack} mois passés + ${monthsForward} mois projetés. Aujourd'hui : ${currentMonthLabel}.`}
        actions={
          <Link
            href="/comptabilite/projets"
            className={buttonVariants({ variant: "outline" })}
          >
            <Icon name="BarChart3" className="mr-1.5 h-4 w-4" />
            Rentabilité par projet
          </Link>
        }
      />

      {/* KPIs YTD */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Année en cours (YTD)
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="CA facturé"
          value={formatCHF(data.totals.caFactureYTD)}
          subtitle="ClientInvoice émises"
          tone="primary"
        />
        <Kpi
          label="CA encaissé"
          value={formatCHF(data.totals.caEncaisseYTD)}
          subtitle="Argent reçu sur le compte"
          tone="emerald"
        />
        <Kpi
          label="Charges"
          value={formatCHF(data.totals.chargesYTD)}
          subtitle="Tickets + factures fournisseurs"
          tone="red"
        />
        <Kpi
          label="Salaires"
          value={formatCHF(data.totals.salairesYTD)}
          subtitle="Versés aux commerciales"
          tone="red"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Marge réelle (cash) YTD"
          value={formatCHF(data.totals.margeReelleYTD)}
          subtitle="Encaissé - Charges - Salaires"
          tone={data.totals.margeReelleYTD >= 0 ? "emerald" : "red"}
          size="lg"
        />
        <Kpi
          label="Marge projetée (compta) YTD"
          value={formatCHF(data.totals.margeProjeteeYTD)}
          subtitle="Facturé - Charges - Salaires"
          tone={data.totals.margeProjeteeYTD >= 0 ? "emerald" : "red"}
          size="lg"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        💡 La marge réelle reflète ta trésorerie réelle (argent dispo).
        La marge projetée reflète l&apos;activité comptable (ce que tu as
        gagné, même si le client n&apos;a pas encore payé). Les deux sont
        hors impôts (IBC, AVS, etc.) — pense à provisionner.
      </p>

      {/* Graphique */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            P&L mensuel — passé + projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyPnLChart
            data={data.months.map((m) => ({
              label: m.label,
              caFacture: m.caFacture,
              caEncaisse: m.caEncaisse,
              charges: m.charges,
              salaires: m.salaires,
              margeReelle: m.margeReelle,
              margeProjetee: m.margeProjetee,
              phase: m.phase,
            }))}
          />
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <Legend color="#10b981" label="CA encaissé (barre pleine)" />
            <Legend color="#0E1936" label="CA facturé (barre transparente)" />
            <Legend
              color="#0E1936"
              label="Marge réelle (trait plein)"
              isLine
            />
            <Legend
              color="#F47174"
              label="Marge projetée (pointillé)"
              isLine
            />
          </div>
        </CardContent>
      </Card>

      {/* Tableau détaillé */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Détail mois par mois</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Mois</Th>
                <Th className="text-right">CA facturé</Th>
                <Th className="text-right">CA encaissé</Th>
                <Th className="text-right">Charges</Th>
                <Th className="text-right">Salaires</Th>
                <Th className="text-right">Marge réelle</Th>
                <Th className="text-right">Marge projetée</Th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr
                  key={m.monthStart.toISOString()}
                  className={`border-b border-border last:border-0 ${
                    m.phase === "current"
                      ? "bg-primary/5 font-medium"
                      : m.phase === "future"
                        ? "bg-amber-50/30 text-muted-foreground"
                        : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="capitalize">{m.label}</span>
                      {m.phase === "current" && (
                        <span className="text-[10px] uppercase text-primary">
                          en cours
                        </span>
                      )}
                      {m.phase === "future" && (
                        <span className="text-[10px] uppercase text-amber-700">
                          projeté
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCHFCompact(m.caFacture)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatCHFCompact(m.caEncaisse)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(m.charges)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(m.salaires)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      m.margeReelle >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatCHFCompact(m.margeReelle)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      m.margeProjetee >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatCHFCompact(m.margeProjetee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Hypothèses de projection */}
      <Card className="mt-6 border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-base">
            Hypothèses de projection (mois à venir)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            🔹 <strong>CA facturé</strong> : factures déjà émises pour des
            mois futurs (contrats à mensualités, renouvellements
            programmés).
          </p>
          <p>
            🔹 <strong>Charges projetées</strong> :{" "}
            <span className="font-semibold">
              {formatCHF(data.averages.chargesMoyennes6m)} / mois
            </span>{" "}
            (moyenne des 6 derniers mois). Si tu signes un nouvel
            abonnement SaaS ou un loyer, viens l&apos;ajouter dans Charges
            pour rendre la projection plus juste.
          </p>
          <p>
            🔹 <strong>Salaires projetés</strong> :{" "}
            <span className="font-semibold">
              {formatCHF(data.averages.salairesMoyens6m)} / mois
            </span>{" "}
            (moyenne 6 mois) — vision réaliste basée sur l&apos;historique
            commercial. La projection théorique des minimums garantis se fait
            sur les mois sans données réelles.
          </p>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            ⚠ <strong>Hors impôts.</strong> N&apos;oublie pas de provisionner
            IBC (~12 %), AVS/AI/APG (~12 %) sur les salaires, et de la
            cotisation prévoyance. Pour une vision après impôts, applique un
            facteur ~0.75 à 0.80 sur la marge nette.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  subtitle,
  tone,
  size,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "primary" | "red";
  size?: "lg";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 tabular-nums font-semibold ${
            size === "lg" ? "text-3xl" : "text-2xl"
          } ${
            tone === "emerald"
              ? "text-emerald-700"
              : tone === "primary"
                ? "text-primary"
                : tone === "red"
                  ? "text-red-700"
                  : ""
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({
  color,
  label,
  isLine,
}: {
  color: string;
  label: string;
  isLine?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span
        className="inline-block h-2 w-4"
        style={
          isLine
            ? { borderTop: `2px solid ${color}` }
            : { backgroundColor: color, borderRadius: 2 }
        }
      />
      {label}
    </span>
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
