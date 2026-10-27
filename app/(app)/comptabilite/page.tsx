import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarRange,
  ChartLine,
  Landmark,
  Receipt,
  Table2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { HeroPanel, ProgressRing, SectionCard, StatTile, StatusPill } from "@/components/arena";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { Callout } from "@/components/common/callout";
import { ChfValue } from "@/components/common/chf-value";
import { PageShell } from "@/components/common/page-shell";
import { MonthlyPnLChart } from "@/components/compta/monthly-pnl-chart";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import { getComptaCockpit } from "@/lib/queries/compta";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

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

  const t = data.totals;
  // Taux d'encaissement YTD : part du CA facturé réellement arrivée sur le compte.
  const tauxEncaissement =
    t.caFactureYTD > 0 ? Math.round((t.caEncaisseYTD / t.caFactureYTD) * 100) : 0;
  const resteAEncaisser = Math.max(0, t.caFactureYTD - t.caEncaisseYTD);

  return (
    <PageShell>
      <PageHeader
        rubrique="finance"
        title="Comptabilité"
        description={`P&L mois par mois · ${monthsBack} mois passés + ${monthsForward} mois projetés. Aujourd'hui : ${currentMonthLabel}.`}
        actions={
          <Link
            href="/comptabilite/projets"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <BarChart3 aria-hidden="true" />
            Rentabilité par projet
          </Link>
        }
      />

      {/* HÉROS : où en est la trésorerie de l'année */}
      <HeroPanel aria-labelledby="compta-hero-title" className="mb-6">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
          <div className="min-w-0 flex-[1_1_260px]">
            <p
              id="compta-hero-title"
              className="text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase"
            >
              Marge réelle (cash) · année en cours
            </p>
            <p
              className={cn(
                "score-number mt-2 text-[40px] break-words sm:text-[52px]",
                t.margeReelleYTD < 0 && "text-coral-400",
              )}
            >
              <ChfValue amount={t.margeReelleYTD} unitClassName="text-navy-300" />
            </p>
            <p className="mt-2 text-[13px] font-medium text-navy-200">
              Encaissé - Charges - Salaires · ton argent réellement disponible
            </p>
          </div>

          <div className="min-w-0 flex-[1_1_200px]">
            <p className="text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase">
              Marge projetée (compta)
            </p>
            <p
              className={cn(
                "score-number mt-2 text-[28px] break-words sm:text-[32px]",
                t.margeProjeteeYTD < 0 && "text-coral-400",
              )}
            >
              <ChfValue amount={t.margeProjeteeYTD} unitClassName="text-navy-300" />
            </p>
            <p className="mt-2 text-[13px] font-medium text-navy-200">
              Facturé - Charges - Salaires
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ProgressRing
              value={t.caEncaisseYTD}
              max={t.caFactureYTD}
              size={104}
              stroke={11}
              tone="green"
              trackColor="#2F4470"
              label={`Taux d'encaissement : ${tauxEncaissement} % du CA facturé encaissé`}
            >
              <span className="score-number text-2xl text-white">
                {tauxEncaissement} %
              </span>
            </ProgressRing>
            <div className="max-w-[180px] min-w-0">
              <p className="text-sm font-extrabold">Taux d&apos;encaissement</p>
              <p className="mt-1 text-xs font-medium text-navy-200">
                {resteAEncaisser > 0
                  ? `${formatCHFCompact(resteAEncaisser)} facturés pas encore encaissés`
                  : "Tout le facturé est encaissé"}
              </p>
            </div>
          </div>
        </div>
      </HeroPanel>

      {/* KPIs année en cours */}
      <h2 className="mb-3 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Année en cours (YTD)
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="CA facturé"
          value={<ChfValue amount={t.caFactureYTD} />}
          sub="Factures clients émises"
          tone="blue"
          icon={Receipt}
        />
        <StatTile
          label="CA encaissé"
          value={<ChfValue amount={t.caEncaisseYTD} />}
          sub="Argent reçu sur le compte"
          tone="green"
          icon={Banknote}
        />
        <StatTile
          label="Charges"
          value={<ChfValue amount={t.chargesYTD} />}
          sub="Tickets + factures fournisseurs"
          tone="red"
          icon={Wallet}
          href="/charges?periode=ytd"
        />
        <StatTile
          label="Salaires"
          value={<ChfValue amount={t.salairesYTD} />}
          sub="Versés aux commerciales"
          tone="violet"
          icon={Users}
        />
      </div>

      <Callout tone="blue" icon={Landmark} className="mt-3">
        La marge réelle reflète ta trésorerie réelle (argent disponible). La
        marge projetée reflète l&apos;activité comptable (ce que tu as gagné,
        même si le client n&apos;a pas encore payé). Les deux sont hors impôts
        (IBC, AVS, etc.) : pense à provisionner.
      </Callout>

      {/* Graphique */}
      <SectionCard
        className="mt-6"
        title="P&L mensuel"
        description="Passé et projection, mois par mois"
        icon={ChartLine}
        tone="navy"
      >
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
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
          <Legend color="#12A150" label="CA encaissé (barre pleine)" />
          <Legend color="#0E1936" label="CA facturé (barre claire)" faded />
          <Legend color="#0E1936" label="Marge réelle (trait plein)" isLine />
          <Legend color="#E95256" label="Marge projetée (pointillé)" isLine dashed />
        </ul>
      </SectionCard>

      {/* Tableau détaillé */}
      <SectionCard
        className="mt-6 overflow-hidden"
        title="Détail mois par mois"
        description="Les mois projetés sont des estimations (voir hypothèses)"
        icon={Table2}
        tone="navy"
        contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
      >
        <TableScroll label="Détail du P&L mois par mois">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <Th className="pl-5 sm:pl-6">Mois</Th>
                <Th className="text-right">CA facturé</Th>
                <Th className="text-right">CA encaissé</Th>
                <Th className="text-right">Charges</Th>
                <Th className="text-right">Salaires</Th>
                <Th className="text-right">Marge réelle</Th>
                <Th className="pr-5 text-right sm:pr-6">Marge projetée</Th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr
                  key={m.monthStart.toISOString()}
                  className={cn(
                    TR_CLASS,
                    m.phase === "current" && "bg-navy-50/80 font-semibold",
                    m.phase === "future" && "bg-gold-50/40 text-muted-foreground",
                  )}
                >
                  <Td className="pl-5 sm:pl-6">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="font-bold capitalize text-foreground">
                        {m.label}
                      </span>
                      {m.phase === "current" && (
                        <StatusPill tone="navy">En cours</StatusPill>
                      )}
                      {m.phase === "future" && (
                        <StatusPill tone="gold">Projeté</StatusPill>
                      )}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">
                    {formatCHFCompact(m.caFacture)}
                  </Td>
                  <Td className="text-right text-win-700 tabular-nums whitespace-nowrap">
                    {formatCHFCompact(m.caEncaisse)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(m.charges)}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    -{formatCHFCompact(m.salaires)}
                  </Td>
                  <Td
                    className={cn(
                      "text-right font-extrabold tabular-nums whitespace-nowrap",
                      m.margeReelle >= 0 ? "text-win-700" : "text-alert-700",
                    )}
                  >
                    {formatCHFCompact(m.margeReelle)}
                  </Td>
                  <Td
                    className={cn(
                      "pr-5 text-right tabular-nums whitespace-nowrap sm:pr-6",
                      m.margeProjetee >= 0 ? "text-win-700" : "text-alert-700",
                    )}
                  >
                    {formatCHFCompact(m.margeProjetee)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </SectionCard>

      {/* Hypothèses de projection */}
      <SectionCard
        className="mt-6"
        title="Hypothèses de projection"
        description="Comment sont estimés les mois à venir"
        icon={CalendarRange}
        tone="gold"
      >
        <ul className="space-y-3 text-sm leading-relaxed">
          <li className="flex gap-2.5">
            <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-700" />
            <span>
              <strong>CA facturé</strong> : factures déjà émises pour des mois
              futurs (contrats à mensualités, renouvellements programmés).
            </span>
          </li>
          <li className="flex gap-2.5">
            <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-700" />
            <span>
              <strong>Charges projetées</strong> :{" "}
              <span className="font-bold tabular-nums">
                {formatCHF(data.averages.chargesMoyennes6m)} / mois
              </span>{" "}
              (moyenne des 6 derniers mois). Si tu signes un nouvel abonnement
              SaaS ou un loyer, viens l&apos;ajouter dans{" "}
              <Link href="/charges" className="font-bold text-info-700 hover:underline">
                Charges
              </Link>{" "}
              pour rendre la projection plus juste.
            </span>
          </li>
          <li className="flex gap-2.5">
            <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-700" />
            <span>
              <strong>Salaires projetés</strong> :{" "}
              <span className="font-bold tabular-nums">
                {formatCHF(data.averages.salairesMoyens6m)} / mois
              </span>{" "}
              (moyenne 6 mois) : vision réaliste basée sur l&apos;historique
              commercial. La projection théorique des minimums garantis se fait
              sur les mois sans données réelles.
            </span>
          </li>
        </ul>
        <Callout tone="gold" title="Hors impôts" className="mt-4">
          N&apos;oublie pas de provisionner IBC (~12 %), AVS/AI/APG (~12 %) sur
          les salaires, et la cotisation prévoyance. Pour une vision après
          impôts, applique un facteur ~0.75 à 0.80 sur la marge nette.
        </Callout>
      </SectionCard>
    </PageShell>
  );
}

function Legend({
  color,
  label,
  isLine,
  dashed,
  faded,
}: {
  color: string;
  label: string;
  isLine?: boolean;
  dashed?: boolean;
  faded?: boolean;
}) {
  return (
    <li className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-5"
        style={
          isLine
            ? { borderTop: `3px ${dashed ? "dashed" : "solid"} ${color}`, height: 0 }
            : {
                backgroundColor: color,
                opacity: faded ? 0.3 : 0.9,
                borderRadius: 4,
              }
        }
      />
      {label}
    </li>
  );
}
