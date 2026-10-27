import { Building2, Coins, Info, Landmark, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import type { Tone } from "@/components/arena/tones";
import { PageHeader } from "@/components/page-header";
import {
  Money,
  RankBadge,
  SegmentGroup,
  cleanText,
  marginTone,
  segmentClass,
} from "@/components/stats/ui";
import { formatCHFCompact, formatPercent } from "@/lib/format";
import { getProspectStatutLabel } from "@/lib/labels";
import {
  RENTABILITE_PERIODES,
  getRentabilite,
  resolveRentabilitePeriode,
  type RentabiliteRow,
} from "@/lib/queries/rentabilite";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import type { ProspectStatut } from "@prisma/client";

export const metadata = { title: "Rentabilité clients" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Tri = "ca" | "marge" | "pct" | "charges";

const TRIS: { v: Tri; l: string }[] = [
  { v: "ca", l: "CA facturé" },
  { v: "marge", l: "Marge brute" },
  { v: "pct", l: "Marge %" },
  { v: "charges", l: "Charges" },
];

const STATUT_TONE: Partial<Record<ProspectStatut, Tone>> = {
  SIGNE: "green",
  PROPOSITION_ENVOYEE: "gold",
  RDV_PRIS: "coral",
  CONTACTE: "blue",
  QUALIFIE: "teal",
  PERDU: "red",
  NE_PAS_RAPPELER: "red",
};

function sortRows(rows: RentabiliteRow[], tri: Tri): RentabiliteRow[] {
  const copy = [...rows];
  if (tri === "marge") copy.sort((a, b) => b.margeBrute - a.margeBrute);
  else if (tri === "pct") copy.sort((a, b) => (b.margePct ?? -Infinity) - (a.margePct ?? -Infinity));
  else if (tri === "charges") copy.sort((a, b) => b.chargesTotal - a.chargesTotal);
  else copy.sort((a, b) => b.caFacture - a.caFacture); // CA décroissant (ordre historique)
  return copy;
}

export default async function RentabilitePage({ searchParams }: PageProps) {
  await requireAdmin();
  const raw = await searchParams;

  // Période : YTD par défaut, ou mois / trimestre / 12 derniers mois
  const {
    periode: periodeParam,
    from,
    to,
    label: periodeLabel,
  } = resolveRentabilitePeriode(typeof raw.periode === "string" ? raw.periode : undefined);
  const tri: Tri = TRIS.some((t) => t.v === raw.tri) ? (raw.tri as Tri) : "ca";

  const data = await getRentabilite({ from, to });
  const rows = sortRows(data.rows, tri);
  const topIds = new Set(
    [...data.rows]
      .filter((r) => r.margeBrute > 0)
      .sort((a, b) => b.margeBrute - a.margeBrute)
      .slice(0, 3)
      .map((r) => r.prospectId),
  );
  const nbRedresser = data.rows.filter((r) => r.margeBrute < 0).length;

  const href = (periode: string, t: Tri) => {
    const p = new URLSearchParams();
    p.set("periode", periode);
    if (t !== "ca") p.set("tri", t);
    return `/rentabilite?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="finance"
        title="Rentabilité clients"
        description={`Marge brute par client = CA facturé - charges directes et allouées. Période : ${periodeLabel}.`}
        actions={
          <StatusPill tone="coral" dot={false}>
            Réservé admin
          </StatusPill>
        }
      />

      {/* Filtres période + tri */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentGroup label="Période" visibleLabel="Période :">
          {RENTABILITE_PERIODES.map((opt) => (
            <Link
              key={opt.v}
              href={href(opt.v, tri)}
              scroll={false}
              aria-current={periodeParam === opt.v ? "true" : undefined}
              className={segmentClass(periodeParam === opt.v)}
            >
              {opt.l}
            </Link>
          ))}
        </SegmentGroup>
        <SegmentGroup label="Trier le tableau" visibleLabel="Trier par :">
          {TRIS.map((t) => (
            <Link
              key={t.v}
              href={href(periodeParam, t.v)}
              scroll={false}
              aria-current={tri === t.v ? "true" : undefined}
              className={segmentClass(tri === t.v)}
            >
              {t.l}
            </Link>
          ))}
        </SegmentGroup>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="CA facturé"
          icon={Receipt}
          tone="navy"
          value={<Money value={data.totals.caFacture} />}
          sub={`${data.rows.length} client${data.rows.length > 1 ? "s" : ""} · ${formatCHFCompact(data.totals.caEncaisse)} encaissés`}
        />
        <StatTile
          label="Charges allouées clients"
          icon={Coins}
          tone="gold"
          value={<Money value={data.totals.chargesTotal} />}
          sub="Directes + ventilées"
        />
        <StatTile
          label="Marge brute"
          icon={TrendingUp}
          tone={data.totals.margeBrute >= 0 ? "green" : "red"}
          value={<Money value={data.totals.margeBrute} />}
          sub={
            data.totals.margePct !== null
              ? `${formatPercent(data.totals.margePct)} de marge${nbRedresser > 0 ? ` · ${nbRedresser} client${nbRedresser > 1 ? "s" : ""} à redresser` : ""}`
              : "Pas de CA facturé sur la période"
          }
          className={data.totals.margeBrute >= 0 ? "border-2 border-win-500" : "border-2 border-alert-500"}
        />
        <StatTile
          label="Frais généraux"
          icon={Landmark}
          tone="navy"
          value={<Money value={data.chargesInternes.total} />}
          sub={`${data.chargesInternes.count} charge${data.chargesInternes.count > 1 ? "s" : ""} interne${data.chargesInternes.count > 1 ? "s" : ""} (hors client)`}
        />
      </div>

      {/* Table */}
      <SectionCard
        title="Détail par client"
        icon={Building2}
        tone="navy"
        description={`${rows.length} client${rows.length > 1 ? "s" : ""} · tri : ${TRIS.find((t) => t.v === tri)?.l ?? "CA facturé"}`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Coins}
            tone="gold"
            title="Aucune donnée pour cette période"
            description="Pas de facture client ni de charge rattachée sur la période choisie."
          />
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full min-w-[980px] border-collapse text-[13px]">
              <caption className="sr-only">Rentabilité par client</caption>
              <thead>
                <tr className="bg-ground text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  <Th className="text-left">Client</Th>
                  <Th>Factures</Th>
                  <Th>CA facturé</Th>
                  <Th>CA encaissé</Th>
                  <Th>Charges directes</Th>
                  <Th>Allocations</Th>
                  <Th>Marge brute</Th>
                  <Th className="pr-3.5">Marge %</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const tone = marginTone(r.margePct);
                  const w =
                    r.margePct === null ? 0 : Math.max(3, Math.min(100, Math.round(r.margePct * 100)));
                  const statut = r.statut as ProspectStatut;
                  return (
                    <tr key={r.prospectId} className="border-t border-border transition-colors hover:bg-ground/60">
                      <th scope="row" className="px-3.5 py-3 text-left font-semibold">
                        <div className="flex items-center gap-2.5">
                          <RankBadge rank={i + 1} size={26} />
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/prospects/${r.prospectId}`}
                                className="text-sm font-bold text-foreground hover:text-info-700 hover:underline"
                              >
                                {cleanText(r.raisonSociale)}
                              </Link>
                              {r.margeBrute < 0 && (
                                <span className="rounded-full bg-alert-50 px-2 py-0.5 text-[11px] font-bold text-alert-700">
                                  À redresser
                                </span>
                              )}
                              {topIds.has(r.prospectId) && (
                                <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-bold text-gold-700">
                                  Top rentable
                                </span>
                              )}
                            </span>
                            <span>
                              <StatusPill tone={STATUT_TONE[statut] ?? "navy"}>
                                {getProspectStatutLabel(statut) ?? r.statut}
                              </StatusPill>
                            </span>
                          </div>
                        </div>
                      </th>
                      <td className="px-2.5 py-3 text-right tabular-nums">{r.nbFactures || "-"}</td>
                      <td className="px-2.5 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums">
                        {r.caFacture > 0 ? formatCHFCompact(r.caFacture) : "-"}
                      </td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-win-700">
                          {r.caEncaisse > 0 ? formatCHFCompact(r.caEncaisse) : "-"}
                        </span>
                        {r.caEnAttente > 0.01 && (
                          <span className="block text-[11px] font-bold text-gold-700">
                            +{formatCHFCompact(r.caEnAttente)} en attente
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap text-alert-700 tabular-nums">
                        {r.chargesDirectes > 0 ? `-${formatCHFCompact(r.chargesDirectes)}` : "-"}
                      </td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap text-alert-700 tabular-nums">
                        {r.chargesAllouees > 0 ? `-${formatCHFCompact(r.chargesAllouees)}` : "-"}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-3 text-right text-sm font-extrabold whitespace-nowrap tabular-nums",
                          r.margeBrute >= 0 ? "text-win-700" : "text-alert-700",
                        )}
                      >
                        {r.margeBrute >= 0 ? "+" : ""}
                        {formatCHFCompact(r.margeBrute)}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-ground">
                            <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${w}%` }} />
                          </div>
                          <span className={cn("w-14 shrink-0 text-right font-extrabold tabular-nums", tone.text)}>
                            {r.margePct !== null ? formatPercent(r.margePct) : "-"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Légende */}
      <div className="flex flex-col gap-2 rounded-[16px] border border-dashed border-border-strong bg-card/60 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Charges directes</strong> = charges 100 % attribuables au client
          (ex. nom de domaine, hébergement, sous-traitance dédiée).
        </p>
        <p>
          <strong className="text-foreground">Allocations</strong> = part de charges multi-clients ventilée sur
          le client (ex. community manager, Google Ads).
        </p>
        <p>
          <strong className="text-foreground">Frais généraux</strong> = charges sans rattachement client (loyer,
          software interne, frais bancaires, etc.).
        </p>
        <p className="flex items-start gap-2 pt-1">
          <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info-700" />
          <span>
            Pour rattacher une charge à un client, ouvre la charge dans{" "}
            <Link href="/charges" className="font-bold text-info-700 hover:underline">
              Charges
            </Link>{" "}
            et sélectionne le client. Pour une charge multi-clients, utilise le panneau d&apos;allocations.
          </span>
        </p>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-2.5 py-3 text-right first:pl-3.5", className)}>
      {children}
    </th>
  );
}
