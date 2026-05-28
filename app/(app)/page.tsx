import Link from "next/link";

import { CommissionsChart } from "@/components/dashboard/commissions-chart";
import { MonthlyGoals } from "@/components/dashboard/monthly-goals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { formatCHF, formatCHFCompact, formatDate } from "@/lib/format";
import { getDashboard } from "@/lib/queries/dashboard";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  DECOUVERTE: "Découverte",
  PROPOSITION: "Proposition",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  PERDU: "Perdu",
};

const STAGE_ACCENTS: Record<string, string> = {
  DECOUVERTE: "border-t-slate-400",
  PROPOSITION: "border-t-blue-500",
  NEGOCIATION: "border-t-amber-500",
  SIGNE: "border-t-emerald-500",
  PERDU: "border-t-red-400",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user);
  const monthLabel = new Date()
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric" })
    .replace(/^(.)/, (m) => m.toUpperCase());

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble · {monthLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Signatures du mois"
          value={`${data.signaturesMois.count}`}
          subtitle={formatCHF(data.signaturesMois.montant)}
        />
        <Kpi
          label="Commissions acquises"
          value={formatCHF(data.commissionsAcquisesMois)}
          subtitle="versées dans la facture mensuelle"
          tone="emerald"
        />
        <Kpi
          label="Salaire prévu"
          value={formatCHF(data.salairePrevuMois)}
          subtitle={
            data.garantieActiveMois ? "Garantie active" : "Performance pure"
          }
          tone={data.garantieActiveMois ? "amber" : "emerald"}
        />
        <Kpi
          label="Pipeline pondéré"
          value={formatCHF(
            data.topDeals.reduce((s, d) => s + d.montantPondere, 0),
          )}
          subtitle={`${data.topDeals.length} deals chauds`}
        />
      </div>

      {user.role === "ADMIN" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Kpi
            label="CA agence du mois"
            value={formatCHF(data.caAgenceMois ?? 0)}
            tone="primary"
          />
          <Kpi
            label="À verser aux commerciales"
            value={formatCHF(data.montantAVerserCommerciales ?? 0)}
            tone="primary"
          />
          <Kpi
            label="CA récurrent total"
            value={`${formatCHFCompact(data.caRecurrentTotalMensuel ?? 0)} / mois`}
            subtitle={`${formatCHF((data.caRecurrentTotalMensuel ?? 0) * 12)} / an`}
            tone="primary"
          />
        </div>
      )}

      {/* Objectifs du mois — progress bars pilotables depuis /objectifs */}
      <div className="mt-6">
        <MonthlyGoals
          progress={data.monthlyProgress}
          isAdmin={user.role === "ADMIN"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Évolution commissions — 12 derniers mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionsChart data={data.evolutionCommissions} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {data.pipelineParStage.map((s) => (
                <div
                  key={s.stage}
                  className={`rounded-md border border-border border-t-4 ${STAGE_ACCENTS[s.stage]} bg-muted/30 p-2`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {STAGE_LABELS[s.stage]}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {s.count}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {formatCHFCompact(s.montant)}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/pipeline"
              className="mt-3 inline-flex text-xs text-primary hover:underline"
            >
              Voir le Kanban →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 deals chauds</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topDeals.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Aucun deal en proposition ou négociation.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.topDeals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.titre}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.raisonSociale}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCHFCompact(d.montantPrevu)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ×{d.probabilite}% ={" "}
                        {formatCHFCompact(d.montantPondere)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Renouvellements (60 prochains jours)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.renouvellementsAVenir.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucun anniversaire de contrat dans les 60 prochains jours.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.renouvellementsAVenir.map((r) => (
                <li
                  key={r.contractId}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Icon name="Repeat" className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contrats/${r.contractId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.numero}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.raisonSociale}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{formatDate(r.dateAnniversaire)}</p>
                    <p className="text-[10px] text-emerald-700 tabular-nums">
                      + {formatCHFCompact(r.commissionMensuelle)} / mois
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
  value: string;
  subtitle?: string;
  tone?: "emerald" | "amber" | "primary";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "primary"
          ? "text-primary"
          : "";
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
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
