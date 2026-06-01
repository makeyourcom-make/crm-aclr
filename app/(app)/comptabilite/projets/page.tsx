import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatCHFCompact, formatPercent } from "@/lib/format";
import { getProjectMargins } from "@/lib/queries/project-profitability";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Rentabilité par projet" };
export const dynamic = "force-dynamic";

export default async function ProjectsProfitabilityPage() {
  await requireAdmin();
  const data = await getProjectMargins();

  // Buckets : déficitaire / faible / bonne / excellente
  const deficitaires = data.projects.filter((p) => p.margeNette < 0);
  const faibles = data.projects.filter(
    (p) => p.margeNette >= 0 && p.rentabilite < 0.15,
  );
  const bonnes = data.projects.filter(
    (p) => p.rentabilite >= 0.15 && p.rentabilite < 0.35,
  );
  const excellentes = data.projects.filter((p) => p.rentabilite >= 0.35);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Rentabilité par projet"
        description={`${data.projects.length} contrat(s) actif(s) analysés sur 12 mois glissants.`}
        breadcrumb={
          <Link
            href="/comptabilite"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour à la comptabilité
          </Link>
        }
      />

      {/* KPIs de répartition */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Excellents (≥ 35 %)"
          value={`${excellentes.length}`}
          subtitle={
            excellentes.length > 0
              ? formatCHFCompact(
                  excellentes.reduce((s, p) => s + p.margeNette, 0),
                ) + " de marge"
              : "Aucun projet"
          }
          tone="emerald"
        />
        <Kpi
          label="Bons (15–35 %)"
          value={`${bonnes.length}`}
          subtitle={
            bonnes.length > 0
              ? formatCHFCompact(
                  bonnes.reduce((s, p) => s + p.margeNette, 0),
                ) + " de marge"
              : "Aucun projet"
          }
          tone="primary"
        />
        <Kpi
          label="Faibles (< 15 %)"
          value={`${faibles.length}`}
          subtitle={
            faibles.length > 0
              ? formatCHFCompact(
                  faibles.reduce((s, p) => s + p.margeNette, 0),
                ) + " de marge"
              : "Aucun projet"
          }
          tone="amber"
        />
        <Kpi
          label="Déficitaires"
          value={`${deficitaires.length}`}
          subtitle={
            deficitaires.length > 0
              ? formatCHFCompact(
                  deficitaires.reduce((s, p) => s + p.margeNette, 0),
                ) + " de perte"
              : "Aucun ✓"
          }
          tone={deficitaires.length > 0 ? "red" : "emerald"}
        />
      </div>

      {/* Tableau détaillé */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Détail par projet — classés du moins rentable au plus rentable
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data.projects.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              Aucun contrat actif à analyser.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Contrat</Th>
                  <Th>Client</Th>
                  <Th>Commerciale</Th>
                  <Th className="text-right">Revenu</Th>
                  <Th className="text-right">Coûts directs</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Frais alloués</Th>
                  <Th className="text-right">Marge brute</Th>
                  <Th className="text-right">Impôts ({formatPercent(data.tauxImpots)})</Th>
                  <Th className="text-right">Marge nette</Th>
                  <Th className="text-right">%</Th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr
                    key={p.contractId}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/contrats/${p.contractId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {p.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium">
                      {p.raisonSociale}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.commercialeName}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCHFCompact(p.revenu12mois)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      -{formatCHFCompact(p.coutsDirects)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      -{formatCHFCompact(p.commission)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      -{formatCHFCompact(p.quotePartFrais)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        p.margeBrute >= 0 ? "" : "text-red-700"
                      }`}
                    >
                      {formatCHFCompact(p.margeBrute)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {p.provisionImpots > 0
                        ? `-${formatCHFCompact(p.provisionImpots)}`
                        : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold tabular-nums ${
                        p.margeNette >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatCHFCompact(p.margeNette)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RentabiliteBadge value={p.rentabilite} />
                    </td>
                  </tr>
                ))}
                {/* Ligne totaux */}
                <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    TOTAL portefeuille
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCHFCompact(data.totals.revenu)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(data.totals.coutsDirects)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(data.totals.commissions)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(data.totals.quotePartFrais)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      data.totals.margeBrute >= 0 ? "" : "text-red-700"
                    }`}
                  >
                    {formatCHFCompact(data.totals.margeBrute)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">
                    -{formatCHFCompact(data.totals.provisionImpots)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      data.totals.margeNette >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatCHFCompact(data.totals.margeNette)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RentabiliteBadge
                      value={
                        data.totals.revenu > 0
                          ? data.totals.margeNette / data.totals.revenu
                          : 0
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Méthodologie */}
      <Card className="mt-6 border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-base">Méthodologie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Revenu</strong> = valeur 12 mois du contrat (oneShot +
            mensuel × 12).
          </p>
          <p>
            <strong>Coûts directs</strong> = somme des coûts internes des
            produits du contrat. Renseigne ces coûts dans{" "}
            <Link
              href="/catalogue"
              className="text-primary underline-offset-2 hover:underline"
            >
              Catalogue produits
            </Link>{" "}
            (hébergement, licences, ad spend, etc.).
          </p>
          <p>
            <strong>Commission</strong> = taux signature de la commerciale ×
            revenu (par défaut 25 %).
          </p>
          <p>
            <strong>Frais alloués</strong> = quote-part annuelle des frais
            généraux (loyer, SaaS partagés, salaires non-commerciaux) répartie
            équitablement sur les {data.projects.length} contrat(s) actif(s).
            Quote-part actuelle :{" "}
            <span className="font-semibold">
              {formatCHF(data.quotePartParContrat)} / contrat / an
            </span>
            .
          </p>
          <p>
            <strong>Provision impôts</strong> ={" "}
            {formatPercent(data.tauxImpots)} sur la marge brute positive.
            Modifiable dans <strong>Configuration → Réglages</strong>.
          </p>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            💡 <strong>Plus tu signes de contrats</strong>, plus la quote-part
            par projet baisse → tu améliores la rentabilité unitaire sans rien
            faire d&apos;autre que vendre.
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
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "primary" | "amber" | "red";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            tone === "emerald"
              ? "text-emerald-700"
              : tone === "primary"
                ? "text-primary"
                : tone === "amber"
                  ? "text-amber-700"
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

function RentabiliteBadge({ value }: { value: number }) {
  const tone =
    value >= 0.35
      ? "bg-emerald-100 text-emerald-800"
      : value >= 0.15
        ? "bg-blue-100 text-blue-700"
        : value >= 0
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold tabular-nums ${tone}`}
    >
      {formatPercent(value)}
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
      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
