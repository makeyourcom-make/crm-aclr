import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatDate, formatPercent } from "@/lib/format";
import { getForecast } from "@/lib/queries/previsions";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Prévisions" };
export const dynamic = "force-dynamic";

export default async function PrevisionsPage() {
  const user = await requireAdmin();
  const data = await getForecast(user);

  const moisCourant = data.mois12[0];
  const moisM3 = data.mois12.slice(0, 4);
  const tauxAtteinte = data.objectifAnnuel
    ? data.realiseYTD / data.objectifAnnuel
    : 0;

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Prévisions"
        description="Projection de tes revenus sur 12 mois — commissions étalements, renouvellements, garantie, forfait frais."
      />

      {/* Bloc 1 : Salaire mois en cours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Salaire prévu du mois en cours · {moisCourant.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Étalements"
              value={formatCHF(moisCourant.commissionsEtalement)}
            />
            <Stat
              label="Renouvellements"
              value={formatCHF(moisCourant.commissionsRenouvellement)}
            />
            <Stat
              label="Garantie absorbée"
              value={formatCHF(moisCourant.garantieAbsorbee)}
              tone={moisCourant.garantieActive ? "amber" : "muted"}
            />
            <Stat
              label="Total estimé"
              value={formatCHF(moisCourant.total)}
              tone="primary"
              big
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloc 2 : 12 mois */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Prévisions 12 mois — {formatCHF(data.totalAnnuel)} cumulés
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <Th>Mois</Th>
                  <Th className="text-right">Étalements</Th>
                  <Th className="text-right">Renouv.</Th>
                  <Th className="text-right">Garantie</Th>
                  <Th className="text-right">Forfait</Th>
                  <Th className="text-right">Total estimé</Th>
                </tr>
              </thead>
              <tbody>
                {data.mois12.map((m, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-border last:border-0 ${m.garantieActive ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-3 py-2 capitalize">{m.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.commissionsEtalement > 0
                        ? formatCHF(m.commissionsEtalement)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.commissionsRenouvellement > 0
                        ? formatCHF(m.commissionsRenouvellement)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                      {m.garantieAbsorbee > 0
                        ? `+ ${formatCHF(m.garantieAbsorbee)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      + {formatCHF(m.forfaitFrais)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatCHF(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bloc 3 : Portfolio récurrent */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Portfolio récurrent · {formatCHF(data.portfolioMensuelTotal)} / mois
            garanti
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.portfolio.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              Aucun contrat actif avec mensualité récurrente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <Th>Contrat</Th>
                    <Th>Client</Th>
                    <Th className="text-right">Mensuel client</Th>
                    <Th className="text-right">Ma commission / mois</Th>
                    <Th>Renouv. prochain</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.portfolio.map((p) => (
                    <tr
                      key={p.contractId}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/contrats/${p.contractId}`}
                          className="hover:underline"
                        >
                          {p.numero}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{p.raisonSociale}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCHF(p.montantMensuel)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                        {formatCHF(p.commissionMensuelle)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(p.dateRenouvellementProchain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloc 4 : Pipeline pondéré */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Pipeline pondéré · {formatCHF(data.pipelinePondereTotal)} potentiel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm">
            Si tous tes deals signaient à leur probabilité actuelle :{" "}
            <strong>+ {formatCHF(data.commissionPipelinePotentielle)}</strong>{" "}
            de commission additionnelle.
          </p>
          {data.pipelinePondere.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun deal en proposition ou négociation.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.pipelinePondere.slice(0, 10).map((d) => (
                <li
                  key={d.dealId}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.titre}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.raisonSociale}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="tabular-nums">
                      {formatCHF(d.montantPrevu)} × {d.probabilite}%
                    </p>
                    <p className="font-semibold tabular-nums text-emerald-700">
                      Comm. : {formatCHF(d.commissionPotentielle)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Bloc 5 : Atteinte annuelle */}
      {data.objectifAnnuel && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Atteinte annuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm">
                Réalisé YTD : <strong>{formatCHF(data.realiseYTD)}</strong>
              </span>
              <span className="text-sm">
                Objectif : <strong>{formatCHF(data.objectifAnnuel)}</strong>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all ${
                  tauxAtteinte >= 0.8
                    ? "bg-emerald-500"
                    : tauxAtteinte >= 0.5
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(100, tauxAtteinte * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatPercent(tauxAtteinte)} de l&apos;objectif atteint · reste{" "}
              {formatCHF(Math.max(0, data.objectifAnnuel - data.realiseYTD))}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "primary" | "amber" | "muted";
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tabular-nums ${big ? "text-2xl" : "text-lg"} ${
          tone === "primary"
            ? "text-primary"
            : tone === "amber"
              ? "text-amber-700"
              : tone === "muted"
                ? "text-muted-foreground"
                : ""
        }`}
      >
        {value}
      </p>
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
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
