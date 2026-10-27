import { Users, Wallet } from "lucide-react";
import Link from "next/link";

import { HeroPanel } from "@/components/arena/hero-panel";
import { SectionCard } from "@/components/arena/section-card";
import { CommissionsTable } from "@/components/commissions/commissions-table";
import { GainsView } from "@/components/commissions/gains-view";
import { MonthlyCalendar } from "@/components/commissions/monthly-calendar";
import { RecomputeButton } from "@/components/commissions/recompute-button";
import { TeamOverview } from "@/components/commissions/team-overview";
import { PageHeader } from "@/components/page-header";
import { formatCHF } from "@/lib/format";
import { getPlayerStats } from "@/lib/gamification";
import type { PlayerStats } from "@/lib/gamification/rules";
import {
  buildCommissionTimeline,
  getCommissionsByUser,
  getCommissionsCockpit,
} from "@/lib/queries/commissions";
import { getGainsData } from "@/lib/queries/commissions-gains";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function safeStats(userId: string): Promise<PlayerStats | null> {
  try {
    return await getPlayerStats(userId);
  } catch (err) {
    console.error("[commissions] getPlayerStats a échoué :", err);
    return null;
  }
}

export default async function CommissionsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  // ------------------------------------------------------------------
  // COMMERCIALE : « Objectifs & gains » (commissions réelles en CHF, objectifs, records)
  // ------------------------------------------------------------------
  if (!isAdmin) {
    const [gains, stats] = await Promise.all([getGainsData(user), safeStats(user.id)]);
    return <GainsView gains={gains} stats={stats} />;
  }

  // ------------------------------------------------------------------
  // ADMIN : cockpit équipe (filtrable par commerciale)
  // ------------------------------------------------------------------
  const sp = await searchParams;
  const rawFilter = typeof sp.user === "string" && sp.user.length > 0 ? sp.user : undefined;
  const [cockpit, teamRows] = await Promise.all([
    getCommissionsCockpit(user, rawFilter),
    getCommissionsByUser(),
  ]);
  const filterRow = rawFilter ? teamRows.find((r) => r.userId === rawFilter) : undefined;
  const filterName = rawFilter ? (filterRow?.userName ?? "Collaborateur") : null;
  const timeline = buildCommissionTimeline(cockpit.payments, { pastMonths: 6, futureMonths: 12 });

  // Vocabulaire du point de vue d'Arthur : "versées" = ce qu'il a déjà / doit
  // verser à la commerciale (via son salaire mensuel).
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Commissions"
        rubrique="finance"
        description={
          filterName
            ? `Commissions de ${filterName} : versées, à verser et planifiées.`
            : "Vue agrégée de toutes les commissions versées et à verser."
        }
        actions={<RecomputeButton />}
      />

      <div className="flex flex-col gap-6">
        <HeroPanel aria-labelledby="com-hero-titre">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="com-hero-titre" className="flex flex-col gap-1">
                <span className="text-xs font-bold tracking-[0.08em] text-navy-200 uppercase">
                  À verser ce mois{filterName ? ` · ${filterName}` : " · équipe"}
                </span>
                <span className="score-number text-[36px] break-words text-white sm:text-[56px]">
                  {formatCHF(cockpit.acquisMoisCourant)}
                </span>
                <span className="text-sm font-semibold text-navy-200">→ via le salaire mensuel</span>
              </h2>
              {filterName && (
                <Link
                  href="/commissions"
                  className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/35 px-4 text-sm font-bold text-white hover:bg-white/10"
                >
                  <Users aria-hidden="true" className="size-4" />
                  Revenir à toute l&apos;équipe
                </Link>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <HeroTile label="Versées cette année" value={formatCHF(cockpit.acquisYTD)} sub="Total depuis le 1er janvier" />
              <HeroTile label="À venir" value={formatCHF(cockpit.aVenirTotal)} sub="Versements prévus futurs" />
              <HeroTile label="Annulées" value={formatCHF(cockpit.annule)} sub="Résiliations" muted />
            </div>
          </div>
        </HeroPanel>

        {teamRows.length > 0 && (
          <nav aria-label="Filtrer par commerciale" className="flex flex-wrap gap-2">
            <FilterChip href="/commissions" active={!rawFilter}>
              Toute l&apos;équipe
            </FilterChip>
            {teamRows.map((r) => (
              <FilterChip key={r.userId} href={`/commissions?user=${r.userId}`} active={rawFilter === r.userId}>
                {r.userName}
              </FilterChip>
            ))}
          </nav>
        )}

        <MonthlyCalendar months={timeline} audience="admin" />

        {teamRows.length > 0 && (
          <SectionCard
            title="Par commerciale"
            icon={Users}
            tone="navy"
            description="Acquis, à venir et annulé par commerciale, détail par contrat."
          >
            <TeamOverview rows={teamRows} activeUserId={rawFilter ?? null} />
          </SectionCard>
        )}

        <SectionCard
          id="versements"
          title={`Détail des versements (${cockpit.payments.length})`}
          icon={Wallet}
          tone="navy"
          description="Les commissions « versées » sont déjà payées à la commerciale via son salaire mensuel."
          className="scroll-mt-6"
        >
          <CommissionsTable payments={cockpit.payments} showCommerciale />
        </SectionCard>
      </div>
    </div>
  );
}

function HeroTile({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-white/12 bg-white/[0.08] px-3.5 py-3">
      <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-2xl font-extrabold break-words tabular-nums",
          muted ? "text-navy-200" : "text-white",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-navy-200">{sub}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors",
        active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      )}
    >
      {children}
    </Link>
  );
}
