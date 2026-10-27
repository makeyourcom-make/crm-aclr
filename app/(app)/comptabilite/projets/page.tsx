import {
  AlertTriangle,
  BookOpen,
  CircleCheck,
  Lightbulb,
  Table2,
  ThumbsUp,
  TrendingDown,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionCard, StatTile, StatusPill } from "@/components/arena";
import type { Tone } from "@/components/arena/tones";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { BackLink } from "@/components/common/back-link";
import { Callout } from "@/components/common/callout";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatCHFCompact, formatPercent } from "@/lib/format";
import { getProjectMargins } from "@/lib/queries/project-profitability";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rentabilité par projet" };
export const dynamic = "force-dynamic";

export default async function ProjectsProfitabilityPage() {
  await requireAdmin();
  const data = await getProjectMargins();

  // Buckets : déficitaire / faible / bonne / excellente
  const deficitaires = data.projects.filter((p) => p.margeBrute < 0);
  const faibles = data.projects.filter(
    (p) => p.margeBrute >= 0 && p.rentabilite < 0.15,
  );
  const bonnes = data.projects.filter(
    (p) => p.rentabilite >= 0.15 && p.rentabilite < 0.35,
  );
  const excellentes = data.projects.filter((p) => p.rentabilite >= 0.35);

  const sumMarge = (list: typeof data.projects) =>
    list.reduce((s, p) => s + p.margeBrute, 0);

  const tauxGlobal =
    data.totals.revenu > 0 ? data.totals.margeBrute / data.totals.revenu : 0;

  return (
    <PageShell>
      <PageHeader
        rubrique="finance"
        title="Rentabilité par projet"
        description={`${data.projects.length} contrat(s) actif(s), chacun analysé sur sa durée réelle.`}
        breadcrumb={<BackLink href="/comptabilite">Retour à la comptabilité</BackLink>}
      />

      {/* KPIs de répartition */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Excellents (≥ 35 %)"
          value={excellentes.length}
          sub={
            excellentes.length > 0
              ? `${formatCHFCompact(sumMarge(excellentes))} de marge`
              : "Aucun projet"
          }
          tone="green"
          icon={Trophy}
        />
        <StatTile
          label="Bons (15 à 35 %)"
          value={bonnes.length}
          sub={
            bonnes.length > 0
              ? `${formatCHFCompact(sumMarge(bonnes))} de marge`
              : "Aucun projet"
          }
          tone="blue"
          icon={ThumbsUp}
        />
        <StatTile
          label="Faibles (< 15 %)"
          value={faibles.length}
          sub={
            faibles.length > 0
              ? `${formatCHFCompact(sumMarge(faibles))} de marge`
              : "Aucun projet"
          }
          tone="gold"
          icon={AlertTriangle}
        />
        <StatTile
          label="Déficitaires"
          value={deficitaires.length}
          sub={
            deficitaires.length > 0
              ? `${formatCHFCompact(sumMarge(deficitaires))} de perte`
              : "Aucun, bravo"
          }
          tone={deficitaires.length > 0 ? "red" : "green"}
          icon={deficitaires.length > 0 ? TrendingDown : CircleCheck}
        />
      </div>

      {/* Tableau détaillé */}
      <SectionCard
        className="mt-6 overflow-hidden"
        title="Détail par projet"
        description="Classés du moins rentable au plus rentable"
        icon={Table2}
        tone="navy"
        action={
          data.projects.length > 0 ? (
            <StatusPill tone={rentaTone(tauxGlobal)} size="md">
              Portefeuille · {formatPercent(tauxGlobal)}
            </StatusPill>
          ) : undefined
        }
        contentClassName={
          data.projects.length > 0 ? "-mx-5 -mb-5 sm:-mx-6 sm:-mb-6" : undefined
        }
      >
        {data.projects.length === 0 ? (
          <EmptyState
            icon={Table2}
            tone="navy"
            title="Aucun contrat actif à analyser"
            description="Dès qu'un contrat est actif, sa rentabilité apparaît ici."
          />
        ) : (
          <TableScroll label="Rentabilité détaillée par projet">
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <Th className="pl-5 sm:pl-6">Contrat</Th>
                  <Th>Client</Th>
                  <Th>Commerciale</Th>
                  <Th className="text-right">Revenu</Th>
                  <Th className="text-right">Coûts directs</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Frais alloués</Th>
                  <Th className="text-right">Charges réelles</Th>
                  <Th className="text-right">Marge brute</Th>
                  <Th className="pr-5 text-right sm:pr-6">%</Th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr key={p.contractId} className={TR_CLASS}>
                    <Td className="pl-5 sm:pl-6">
                      <Link
                        href={`/contrats/${p.contractId}`}
                        className="font-mono text-xs font-bold whitespace-nowrap text-info-700 hover:underline"
                      >
                        {p.numero}
                      </Link>
                    </Td>
                    <Td className="min-w-[160px] font-bold">{p.raisonSociale}</Td>
                    <Td className="text-xs whitespace-nowrap text-muted-foreground">
                      {p.commercialeName}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {formatCHFCompact(p.revenu)}
                    </Td>
                    <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                      -{formatCHFCompact(p.coutsDirects)}
                    </Td>
                    <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                      -{formatCHFCompact(p.commission)}
                    </Td>
                    <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                      -{formatCHFCompact(p.quotePartFrais)}
                    </Td>
                    <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                      {p.chargesReelles > 0 ? (
                        `-${formatCHFCompact(p.chargesReelles)}`
                      ) : (
                        <span className="text-muted-foreground">
                          <span aria-hidden="true">·</span>
                          <span className="sr-only">Aucune</span>
                        </span>
                      )}
                    </Td>
                    <Td
                      className={cn(
                        "text-right font-extrabold tabular-nums whitespace-nowrap",
                        p.margeBrute >= 0 ? "text-win-700" : "text-alert-700",
                      )}
                    >
                      {formatCHFCompact(p.margeBrute)}
                    </Td>
                    <Td className="pr-5 text-right sm:pr-6">
                      <RentabiliteBadge value={p.rentabilite} />
                    </Td>
                  </tr>
                ))}
                {/* Ligne totaux */}
                <tr className="border-t-2 border-border-strong bg-ground font-extrabold">
                  <Td className="pl-5 text-[11px] tracking-[0.08em] uppercase sm:pl-6" colSpan={3}>
                    Total portefeuille
                  </Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">
                    {formatCHFCompact(data.totals.revenu)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(data.totals.coutsDirects)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(data.totals.commissions)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(data.totals.quotePartFrais)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(data.totals.chargesReelles)}
                  </Td>
                  <Td
                    className={cn(
                      "text-right tabular-nums whitespace-nowrap",
                      data.totals.margeBrute >= 0 ? "text-win-700" : "text-alert-700",
                    )}
                  >
                    {formatCHFCompact(data.totals.margeBrute)}
                  </Td>
                  <Td className="pr-5 text-right sm:pr-6">
                    <RentabiliteBadge value={tauxGlobal} />
                  </Td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
        )}
      </SectionCard>

      {/* Méthodologie */}
      <SectionCard
        className="mt-6"
        title="Méthodologie"
        description="Comment chaque colonne est calculée"
        icon={BookOpen}
        tone="gold"
      >
        <dl className="space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="font-extrabold">Revenu</dt>
            <dd className="text-muted-foreground">
              Valeur du contrat sur SA DURÉE réelle (oneShot + mensuel × durée en
              mois). Un contrat de 6 mois n&apos;est donc plus compté comme un
              contrat de 12 mois : les coûts produits et la quote-part de frais
              généraux suivent la même durée.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold">Coûts directs</dt>
            <dd className="text-muted-foreground">
              Somme des coûts internes des produits du contrat. Renseigne ces
              coûts dans le{" "}
              <Link href="/catalogue" className="font-bold text-info-700 hover:underline">
                Catalogue produits
              </Link>{" "}
              (hébergement, licences, ad spend, etc.).
            </dd>
          </div>
          <div>
            <dt className="font-extrabold">Commission</dt>
            <dd className="text-muted-foreground">
              Taux signature de la commerciale × assiette réellement versée (an 1
              hors ADS, durée réelle pour les lignes ADS). Volontairement PAS mise
              au prorata de la durée : c&apos;est ce qui sort vraiment de la
              caisse, l&apos;afficher plus bas embellirait la marge à tort.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold">Frais alloués</dt>
            <dd className="text-muted-foreground">
              Quote-part annuelle des frais généraux (loyer, SaaS partagés,
              salaires non commerciaux) répartie équitablement sur les{" "}
              {data.projects.length} contrat(s) actif(s). Quote-part actuelle :{" "}
              <span className="font-bold text-foreground tabular-nums">
                {formatCHF(data.quotePartParContrat)} / contrat / an
              </span>
              .
            </dd>
          </div>
        </dl>
        <Callout tone="green" icon={Lightbulb} className="mt-4">
          <strong>Plus tu signes de contrats</strong>, plus la quote-part par
          projet baisse : tu améliores la rentabilité unitaire sans rien faire
          d&apos;autre que vendre.
        </Callout>
      </SectionCard>
    </PageShell>
  );
}

function rentaTone(value: number): Tone {
  return value >= 0.35 ? "green" : value >= 0.15 ? "blue" : value >= 0 ? "gold" : "red";
}

function RentabiliteBadge({ value }: { value: number }) {
  return (
    <StatusPill tone={rentaTone(value)} className="tabular-nums">
      {formatPercent(value)}
    </StatusPill>
  );
}
