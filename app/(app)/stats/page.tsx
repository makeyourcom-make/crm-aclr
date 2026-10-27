import {
  CalendarCheck,
  ChartColumn,
  CircleCheckBig,
  Clock,
  Coins,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  SquareKanban,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { StatusPill } from "@/components/arena/pills";
import { formatInt } from "@/components/arena/format";
import { PageHeader } from "@/components/page-header";
import { CaBars } from "@/components/stats/ca-bars";
import { ConquestFunnel } from "@/components/stats/conquest-funnel";
import { DirectionHero } from "@/components/stats/direction-hero";
import { MrrChart } from "@/components/stats/mrr-chart";
import { PhoneProductivity } from "@/components/stats/phone-productivity";
import { PlayerHero } from "@/components/stats/player-hero";
import { RankingsTabs } from "@/components/stats/rankings-tabs";
import { RentabiliteTop } from "@/components/stats/rentabilite-top";
import { StatsViewSwitcher } from "@/components/stats/stats-view-switcher";
import { TeamActivityBoard } from "@/components/stats/team-activity-board";
import { Money, SegmentGroup, segmentClass } from "@/components/stats/ui";
import { prisma } from "@/lib/db";
import { getPlayerStats } from "@/lib/gamification";
import { formatCHFCompact, formatPercent } from "@/lib/format";
import { getProspectSecteurLabel } from "@/lib/labels";
import {
  STATS_RANGES,
  getDirectionDashboard,
  getMonthlyHistory,
  getPeriodCounters,
  getPlayerMonth,
  getTeamBoard,
  nowLabel,
  resolveStatsWindow,
  type PeriodCounters,
} from "@/lib/queries/pilotage";
import {
  RENTABILITE_PERIODES,
  getRentabilite,
  resolveRentabilitePeriode,
} from "@/lib/queries/rentabilite";
import { getCallProductivity, getStats, getTopRankings } from "@/lib/queries/stats";
import { requireUser } from "@/lib/session";

import type { ProspectSecteur } from "@prisma/client";

export const metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Les blocs « bonus » (pilotage, équipe, historique, jeu) ne doivent jamais
 * empêcher l'affichage des statistiques de base : en cas d'échec, on log et
 * on masque le bloc.
 */
async function safe<T>(label: string, p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    console.error(`[stats] ${label} a échoué :`, err);
    return null;
  }
}

export default async function StatsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const win = resolveStatsWindow(typeof raw.range === "string" ? raw.range : undefined);

  // Filtre par utilisateur (admin uniquement) : la matrice « Arthur regarde la commerciale »
  const viewAsUserId = isAdmin && typeof raw.user === "string" ? raw.user : undefined;
  // Scope des compteurs de comparaison : identique à getStats (RLS commercial).
  const scopeUserId = isAdmin ? (viewAsUserId ?? null) : user.id;
  // Référence du « levier n°1 » : les 12 mois qui précèdent la période.
  const baselineEnd = new Date(win.start.getTime() - 1);
  const baselineStart = new Date(win.start.getTime() - 365 * 86_400_000);
  const now = new Date();
  // Période du bloc « Top clients par rentabilité » (admin) : ?renta=, YTD par défaut.
  const renta = resolveRentabilitePeriode(
    typeof raw.renta === "string" ? raw.renta : undefined,
    now,
  );

  const [
    data,
    prev,
    baseline,
    callProd,
    rankings,
    teamUsers,
    direction,
    team,
    history,
    rentaData,
    player,
    playerMonth,
  ] = await Promise.all([
    getStats(user, win, viewAsUserId),
    safe("compteurs période précédente", getPeriodCounters(scopeUserId, win.prevStart, win.prevEnd)),
    safe("compteurs 12 mois", getPeriodCounters(scopeUserId, baselineStart, baselineEnd)),
    isAdmin ? getCallProductivity(win, viewAsUserId) : Promise.resolve(null),
    getTopRankings(user, win, viewAsUserId),
    // Liste des users pour le switcher (admin uniquement)
    isAdmin
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    isAdmin ? safe("pilotage direction", getDirectionDashboard()) : Promise.resolve(null),
    isAdmin ? safe("activité équipe", getTeamBoard()) : Promise.resolve(null),
    isAdmin ? safe("historique 12 mois", getMonthlyHistory(12)) : Promise.resolve(null),
    isAdmin
      ? safe("rentabilité", getRentabilite({ from: renta.from, to: renta.to }))
      : Promise.resolve(null),
    !isAdmin ? safe("joueur", getPlayerStats(user.id)) : Promise.resolve(null),
    !isAdmin ? safe("mois joueur", getPlayerMonth(user.id)) : Promise.resolve(null),
  ]);

  // Libellé descriptif de la vue active
  const viewedUser =
    viewAsUserId && viewAsUserId !== user.id ? teamUsers.find((u) => u.id === viewAsUserId) : null;
  const viewLabel = isAdmin
    ? viewAsUserId === user.id
      ? "Mes résultats"
      : viewedUser
        ? `Résultats de ${viewedUser.name}`
        : "Toute l'équipe"
    : "Mes résultats";

  const trend = (cur: number, key: keyof PeriodCounters) =>
    prev ? Math.round(cur - (prev[key] as number)) : undefined;
  const perDay = (n: number) =>
    win.workingDays > 0 ? (n / win.workingDays).toFixed(1) : "0.0";

  const rangeHref = (value: string) => {
    const p = new URLSearchParams();
    p.set("range", value);
    if (viewAsUserId) p.set("user", viewAsUserId);
    if (renta.periode !== "ytd") p.set("renta", renta.periode);
    return `/stats?${p.toString()}`;
  };
  const rentaHref = (value: string) => {
    const p = new URLSearchParams();
    if (win.key !== "mois") p.set("range", win.key);
    if (viewAsUserId) p.set("user", viewAsUserId);
    if (value !== "ytd") p.set("renta", value);
    const qs = p.toString();
    return `${qs ? `/stats?${qs}` : "/stats"}#rentabilite`;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="stats"
        title={isAdmin ? "Statistiques & pilotage" : "Mes statistiques"}
        description={
          isAdmin
            ? `Le tableau de bord de direction · ${nowLabel(now)}`
            : `Tes résultats et ta progression · ${nowLabel(now)}`
        }
      />

      {/* Héros : pilotage de direction (admin) ou saison de la commerciale */}
      {isAdmin && direction && <DirectionHero data={direction} />}
      {!isAdmin && player && playerMonth && <PlayerHero player={player} month={playerMonth} />}

      {/* Performance de la période */}
      <section id="performance" aria-labelledby="perf-titre" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="perf-titre"
              className="font-display text-[22px] font-extrabold tracking-[-0.02em] sm:text-2xl"
            >
              Performance de la période
            </h2>
            <p className="text-sm text-muted-foreground">
              {viewLabel} · {win.label} ({win.detail}) · tendances {win.prevLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Switcher période */}
            <SegmentGroup label="Période" visibleLabel="Période :">
              {STATS_RANGES.map((r) => (
                <Link
                  key={r.value}
                  href={rangeHref(r.value)}
                  scroll={false}
                  aria-current={win.key === r.value ? "true" : undefined}
                  className={segmentClass(win.key === r.value)}
                >
                  {r.label}
                </Link>
              ))}
            </SegmentGroup>
            {/* Switcher commerciale (admin uniquement) */}
            {isAdmin && teamUsers.length > 1 && (
              <StatsViewSwitcher users={teamUsers} currentUserId={user.id} activeUserId={viewAsUserId} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Appels sortants"
            icon={Phone}
            tone="coral"
            value={data.nbAppels}
            trend={trend(data.nbAppels, "appels")}
            trendLabel="vs préc."
            sub={`Cadence ${perDay(data.nbAppels)} / jour ouvré`}
          />
          <StatTile
            label="Conversations"
            icon={MessageCircle}
            tone="blue"
            value={data.nbConversations}
            trend={trend(data.nbConversations, "conversations")}
            trendLabel="vs préc."
            sub={`${formatPercent(data.nbAppels > 0 ? data.nbConversations / data.nbAppels : 0, 0)} des appels décrochés`}
          />
          <StatTile
            label="Emails envoyés"
            icon={Mail}
            tone="teal"
            value={data.nbEmails}
            trend={trend(data.nbEmails, "emails")}
            trendLabel="vs préc."
            sub={`Soit ${perDay(data.nbEmails)} par jour ouvré`}
          />
          <StatTile
            label="RDV honorés"
            icon={CalendarCheck}
            tone="gold"
            value={data.nbRdvHonores}
            trend={trend(data.nbRdvHonores, "rdvEffectues")}
            trendLabel="vs préc."
            sub={`${data.nbRdvManques} manqué${data.nbRdvManques > 1 ? "s" : ""} · ${data.nbRdvPris} RDV pris`}
          />
          <StatTile
            label="Propositions envoyées"
            icon={FileText}
            tone="navy"
            value={data.nbPropositions}
            trend={trend(data.nbPropositions, "propositions")}
            trendLabel="vs préc."
            sub={`${formatPercent(data.tauxPropositionSignature, 0)} transformées en signature`}
          />
          <StatTile
            label="Signatures"
            icon={CircleCheckBig}
            tone="green"
            value={data.nbSignatures}
            trend={trend(data.nbSignatures, "signatures")}
            trendLabel="vs préc."
            sub={`${formatCHFCompact(data.caSigne)} signés · valeur an 1`}
            className="border-2 border-win-500 shadow-[0_8px_24px_rgba(18,161,80,0.12)]"
          />
          <StatTile
            label="Pipeline pondéré"
            icon={SquareKanban}
            tone="violet"
            value={<Money value={data.pipelinePondere} />}
            sub={`Instantané · brut ${formatCHFCompact(data.pipelineTotal)} · ${formatInt(data.nbDealsOuverts)} deal${data.nbDealsOuverts > 1 ? "s" : ""} ouvert${data.nbDealsOuverts > 1 ? "s" : ""}`}
            className="col-span-2 sm:col-span-1"
          />
          <StatTile
            label="CA récurrent / mois"
            icon={RefreshCw}
            tone="navy"
            value={<Money value={data.caRecurrentMensuel} />}
            sub={`Instantané · ${formatCHFCompact(data.caRecurrentMensuel * 12)} / an · contrats actifs`}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </section>

      {/* Activité de l'équipe (admin) */}
      {isAdmin && team && (
        <SectionCard
          title="Activité de l'équipe"
          icon={Users}
          tone="coral"
          description="Par collaborateur, classé par XP · aujourd'hui, cette semaine ou ce mois"
        >
          <TeamActivityBoard board={team} range={win.key} currentUserId={user.id} />
        </SectionCard>
      )}

      {/* Entonnoir + classements */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard
          title="Parcours de conquête"
          icon={ChartColumn}
          tone="green"
          description={`Entonnoir de la période · ${viewLabel} · ${win.label}`}
        >
          <ConquestFunnel stats={data} baseline={baseline} />
        </SectionCard>

        {/* Classements produits / secteurs B2B / cantons : visibles pour tous
            (la commerciale voit ses propres classements). */}
        <SectionCard
          title="Classements"
          icon={Trophy}
          tone="gold"
          description={`${formatInt(rankings.totalContrats)} contrat${rankings.totalContrats > 1 ? "s" : ""} signé${rankings.totalContrats > 1 ? "s" : ""} sur la période (${win.detail})`}
        >
          <RankingsTabs
            produits={rankings.produits.map((p) => ({
              key: p.productId,
              label: p.nom,
              sublabel: p.categorie,
              count: p.nbContrats,
              ca: p.ca,
              pct: p.pct,
            }))}
            secteurs={rankings.secteurs.map((s) => ({
              key: s.secteur,
              label:
                s.secteur === "INCONNU"
                  ? "Secteur non renseigné"
                  : getProspectSecteurLabel(s.secteur as ProspectSecteur),
              count: s.nbContrats,
              ca: s.ca,
              pct: s.pct,
            }))}
            cantons={rankings.cantons.map((c) => ({
              key: c.canton,
              label: c.canton,
              count: c.nbContrats,
              ca: c.ca,
              pct: c.pct,
            }))}
          />
        </SectionCard>
      </div>

      {/* Historique société 12 mois (admin) */}
      {isAdmin && history && history.length > 0 && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <SectionCard
            title="MRR vs charges · 12 mois"
            icon={RefreshCw}
            tone="navy"
            description="Société · récurrent mensuel des contrats actifs face aux charges du mois"
          >
            <MrrChart points={history} />
          </SectionCard>
          <SectionCard
            title="CA signé · 12 mois"
            icon={ChartColumn}
            tone="green"
            description="Société · valeur an 1 des contrats signés"
          >
            <CaBars points={history} />
          </SectionCard>
        </div>
      )}

      {/* Rentabilité clients (admin) */}
      {isAdmin && rentaData && (
        <SectionCard
          id="rentabilite"
          className="scroll-mt-24"
          title="Top clients par rentabilité"
          icon={Coins}
          tone="navy"
          description={`CA facturé (envoyé, payé, en retard) moins les charges allouées · ${renta.label}`}
          action={
            <StatusPill tone="coral" dot={false}>
              Réservé admin
            </StatusPill>
          }
        >
          <RentabiliteTop
            rows={rentaData.rows}
            periodes={RENTABILITE_PERIODES.map((p) => ({
              key: p.v,
              label: p.l,
              href: rentaHref(p.v),
              active: p.v === renta.periode,
            }))}
          />
        </SectionCard>
      )}

      {/* Productivité téléphone : ADMIN ONLY. La commerciale ne voit RIEN de cette section. */}
      {isAdmin && callProd && (
        <SectionCard
          title="Productivité téléphone"
          icon={Clock}
          tone="coral"
          description={`${viewLabel} · ${win.label} (${win.detail}) · appels chronométrés`}
          action={
            <StatusPill tone="coral" dot={false}>
              Admin uniquement
            </StatusPill>
          }
        >
          <PhoneProductivity data={callProd} workingDays={win.workingDays} />
        </SectionCard>
      )}
    </div>
  );
}
