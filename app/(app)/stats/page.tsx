import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatPercent } from "@/lib/format";
import { getStats } from "@/lib/queries/stats";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

const RANGES = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 365, label: "1 an" },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const rangeJours = Number(raw.range ?? 30) || 30;
  const data = await getStats(user, rangeJours);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Statistiques"
        description={`Analyse sur les ${rangeJours} derniers jours.`}
      />

      {/* Switcher période */}
      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/stats?range=${r.value}`}
            className={buttonVariants({
              variant: rangeJours === r.value ? "default" : "outline",
              size: "sm",
            })}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Activité KPI */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Activité
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Appels sortants" value={data.nbAppels} />
        <Kpi label="Emails envoyés" value={data.nbEmails} />
        <Kpi
          label="RDV honorés"
          value={data.nbRdvHonores}
          subtitle={`${data.nbRdvManques} manqués`}
        />
        <Kpi
          label="Propositions envoyées"
          value={data.nbPropositions}
        />
      </div>

      {/* Performance financière */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Performance financière
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Signatures"
          value={data.nbSignatures}
          subtitle={formatCHF(data.caSigne)}
          tone="emerald"
        />
        <Kpi
          label="Pipeline pondéré"
          value={formatCHF(data.pipelinePondere)}
          subtitle={`Brut : ${formatCHF(data.pipelineTotal)}`}
        />
        <Kpi
          label="CA récurrent / mois"
          value={formatCHF(data.caRecurrentMensuel)}
          subtitle={`${formatCHF(data.caRecurrentMensuel * 12)} / an`}
        />
      </div>

      {/* Taux de conversion */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Taux de conversion
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Appel → RDV"
          value={formatPercent(data.tauxAppelRdv)}
          subtitle={`${data.nbRdvHonores + data.nbRdvManques} RDV pour ${data.nbAppels} appels`}
        />
        <Kpi
          label="RDV → Signature"
          value={formatPercent(data.tauxRdvSignature)}
          subtitle={`${data.nbSignatures} sign. pour ${data.nbRdvHonores} RDV`}
        />
        <Kpi
          label="Proposition → Signature"
          value={formatPercent(data.tauxPropositionSignature)}
          subtitle={`${data.nbSignatures} / ${data.nbPropositions}`}
        />
      </div>

      {/* Funnel */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            Funnel (cumulatif depuis le début)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <FunnelStep
              label="Prospects (total)"
              value={data.funnel.prospects}
              max={data.funnel.prospects}
              color="bg-slate-400"
            />
            <FunnelStep
              label="Contactés"
              value={data.funnel.contactes}
              max={data.funnel.prospects}
              color="bg-blue-400"
            />
            <FunnelStep
              label="RDV pris"
              value={data.funnel.rdvPris}
              max={data.funnel.prospects}
              color="bg-amber-400"
            />
            <FunnelStep
              label="Proposition envoyée"
              value={data.funnel.propositions}
              max={data.funnel.prospects}
              color="bg-orange-400"
            />
            <FunnelStep
              label="Signés"
              value={data.funnel.signes}
              max={data.funnel.prospects}
              color="bg-emerald-500"
            />
          </div>
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
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: "emerald";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700" : ""}`}
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

function FunnelStep({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
