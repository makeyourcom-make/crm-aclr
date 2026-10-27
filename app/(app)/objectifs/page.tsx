import { ListChecks, Plus, Target, UserRound } from "lucide-react";
import Link from "next/link";

import { HeroPanel } from "@/components/arena/hero-panel";
import { LevelPill } from "@/components/arena/pills";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { ProgressRing } from "@/components/arena/progress-ring";
import { SectionCard } from "@/components/arena/section-card";
import { ObjectiveForm } from "@/components/objectifs/objective-form";
import { ObjectiveList } from "@/components/objectifs/objective-list";
import {
  MonthTimeBar,
  ObjectiveGridLegend,
  ObjectiveProgressGrid,
} from "@/components/objectifs/objective-progress-grid";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getPlayerHeader } from "@/lib/gamification";
import { initialsOf, type PlayerHeader } from "@/lib/gamification/rules";
import {
  formatDateCH,
  formatMetricValue,
  PACE_META,
  type ObjectiveMetric,
} from "@/lib/queries/objectifs-pace";
import { currentMonthWindow, getTeamObjectiveBoard } from "@/lib/queries/objectifs-progress";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Objectifs" };
export const dynamic = "force-dynamic";

async function safeHeader(userId: string): Promise<PlayerHeader | null> {
  try {
    return await getPlayerHeader(userId);
  } catch (err) {
    console.error("[objectifs] getPlayerHeader a échoué :", err);
    return null;
  }
}

/** Métrique « vitrine » d'une ligne : CA, sinon contrats, sinon la première. */
function headline(metrics: ObjectiveMetric[]): ObjectiveMetric | null {
  return (
    metrics.find((m) => m.key === "ca") ??
    metrics.find((m) => m.key === "signatures") ??
    metrics[0] ??
    null
  );
}

export default async function ObjectifsPage() {
  const user = await requireAdmin();
  const w = currentMonthWindow();

  const [objectives, users, board] = await Promise.all([
    prisma.objective.findMany({
      where: user.role === "ADMIN" ? {} : { userId: user.id },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: [{ isActif: "desc" }, { dateFin: "desc" }],
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([{ id: user.id, name: user.name }]),
    // Tableau de progression : en cas d'échec, la gestion des objectifs
    // (liste + création) reste disponible.
    getTeamObjectiveBoard(w).catch((err) => {
      console.error("[objectifs] getTeamObjectiveBoard a échoué :", err);
      return [];
    }),
  ]);

  const headers = new Map<string, PlayerHeader | null>(
    await Promise.all(board.map(async (r) => [r.userId, await safeHeader(r.userId)] as const)),
  );

  const withObjective = board.filter((r) => r.objective && r.metrics.length > 0);
  const withoutObjective = board.filter((r) => !r.objective);
  const allMetrics = withObjective.flatMap((r) => r.metrics);
  const nbOk = allMetrics.filter((m) => m.status !== "accelerer").length;
  const nbAccel = allMetrics.length - nbOk;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Objectifs"
        rubrique="stats"
        description={`${w.label} · jour ${w.workingDaysElapsed} sur ${w.workingDaysTotal} ouvrés · fixe les cibles et suis le rythme de l'équipe`}
        actions={
          <Link href="#creer" className={buttonVariants({ variant: "default", size: "lg" })}>
            <Plus aria-hidden="true" />
            Nouvel objectif
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {/* ============ HÉROS ÉQUIPE ============ */}
        <HeroPanel aria-labelledby="obj-hero-titre">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-bold tracking-[0.08em] text-navy-200 uppercase">
                  Équipe · {w.label}
                </span>
                <h2 id="obj-hero-titre" className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-white sm:text-[34px]">
                  {allMetrics.length === 0 ? (
                    "Aucun objectif mensuel en cours"
                  ) : (
                    <>
                      {nbOk} / {allMetrics.length} cibles dans le rythme
                    </>
                  )}
                </h2>
                <p className="max-w-xl text-[15px] leading-normal text-navy-200">
                  {allMetrics.length === 0
                    ? "Fixe un objectif mensuel à chaque commerciale : sa progression, sa projection fin de mois et ses gains s'affichent aussitôt dans son espace."
                    : nbAccel > 0
                      ? `${nbAccel} ${nbAccel >= 2 ? "cibles à accélérer" : "cible à accélérer"} avec ${w.daysLeftInclToday} ${w.daysLeftInclToday >= 2 ? "jours ouvrés" : "jour ouvré"} devant nous.`
                      : "Tout le monde tient le rythme. On garde la pression jusqu'au bout du mois."}
                </p>
              </div>
              <MonthTimeBar window={w} onDark className="w-full max-w-[320px]" />
            </div>

            {withObjective.length > 0 && (
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                {withObjective.map((r) => {
                  const h = headline(r.metrics);
                  const header = headers.get(r.userId) ?? null;
                  const accel = r.metrics.filter((m) => m.status === "accelerer").length;
                  return (
                    <li
                      key={r.userId}
                      className="flex items-center gap-3 rounded-[16px] border border-white/12 bg-white/[0.08] p-3.5"
                    >
                      {h && (
                        <ProgressRing
                          value={h.value}
                          max={h.target}
                          size={64}
                          stroke={7}
                          tone={h.status === "accelerer" ? "coral" : "green"}
                          trackColor="#2F4470"
                          label={`${r.name} · ${h.label} : ${formatMetricValue(h.value, h.unit)} sur ${formatMetricValue(h.target, h.unit)}`}
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <a href={`#obj-${r.userId}`} className="truncate text-[15px] font-extrabold text-white hover:underline">
                          {r.name}
                        </a>
                        {header && <LevelPill level={header.level} variant="dark" />}
                        <span className="text-xs font-semibold text-navy-200">
                          {h ? `${h.label} · ` : ""}
                          {accel > 0 ? `${accel} à accélérer` : "dans le rythme"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </HeroPanel>

        {/* ============ PROGRESSION PAR COLLABORATEUR ============ */}
        {withObjective.map((r) => {
          const header = headers.get(r.userId) ?? null;
          const counts = {
            ok: r.metrics.filter((m) => m.status !== "accelerer").length,
            accel: r.metrics.filter((m) => m.status === "accelerer").length,
          };
          return (
            <SectionCard
              key={r.userId}
              id={`obj-${r.userId}`}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {r.name}
                  {header && <LevelPill level={header.level} />}
                </span>
              }
              icon={Target}
              tone="green"
              description={
                r.objective
                  ? `Objectif du mois · du ${formatDateCH(r.objective.dateDebut)} au ${formatDateCH(r.objective.dateFin)}`
                  : undefined
              }
              action={
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex h-6 items-center rounded-full bg-info-50 px-2.5 text-xs font-bold text-info-700">
                    {counts.ok} {PACE_META.rythme.label.toLowerCase()}
                  </span>
                  {counts.accel > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-alert-50 px-2.5 text-xs font-bold text-alert-700">
                      {counts.accel} {PACE_META.accelerer.label.toLowerCase()}
                    </span>
                  )}
                </div>
              }
              contentClassName="flex flex-col gap-4"
            >
              <ObjectiveProgressGrid metrics={r.metrics} window={w} audience="admin" compact />
              {r.objective?.notes && (
                <p className="rounded-[12px] bg-ground px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground">
                  {r.objective.notes}
                </p>
              )}
            </SectionCard>
          );
        })}
        {withObjective.length > 0 && <ObjectiveGridLegend window={w} />}

        {withoutObjective.length > 0 && (
          <section
            aria-labelledby="sans-objectif"
            className="flex flex-wrap items-center gap-4 rounded-[20px] border border-dashed border-border-strong bg-card/70 p-5"
          >
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-[12px] bg-gold-50 text-gold-700">
              <UserRound className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-[1_1_240px]">
              <h2 id="sans-objectif" className="font-display text-lg font-extrabold text-foreground">
                Sans objectif ce mois
              </h2>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {withoutObjective.map((r) => (
                  <li key={r.userId} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm font-bold">
                    <PlayerAvatar initials={initialsOf(r.name)} tone={r.role === "ADMIN" ? "navy" : "coral"} size="xs" />
                    {r.name}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="#creer" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Fixer un objectif
            </Link>
          </section>
        )}

        {/* ============ TOUS LES OBJECTIFS ============ */}
        <SectionCard
          title="Tous les objectifs"
          icon={ListChecks}
          tone="navy"
          description={`${objectives.length} ${objectives.length >= 2 ? "objectifs" : "objectif"} · actifs en premier`}
        >
          <ObjectiveList
            showUser={user.role === "ADMIN"}
            objectives={objectives.map((o) => ({
              id: o.id,
              periode: o.periode,
              dateDebut: o.dateDebut,
              dateFin: o.dateFin,
              isActif: o.isActif,
              notes: o.notes,
              user: o.user,
              nbAppelsObjectif: o.nbAppelsObjectif,
              nbEmailsObjectif: o.nbEmailsObjectif,
              nbRdvObjectif: o.nbRdvObjectif,
              nbPropositionsObjectif: o.nbPropositionsObjectif,
              nbSignaturesObjectif: o.nbSignaturesObjectif,
              caObjectif: o.caObjectif != null ? Number(o.caObjectif) : null,
              commissionObjectif: o.commissionObjectif != null ? Number(o.commissionObjectif) : null,
            }))}
          />
        </SectionCard>

        {/* ============ CRÉER ============ */}
        <SectionCard
          id="creer"
          title="Créer un objectif"
          icon={Plus}
          tone="green"
          description="Un objectif quotidien pilote les missions du jour et la série ; un objectif mensuel pilote la progression et la projection."
          className={cn("scroll-mt-6")}
        >
          <ObjectiveForm users={users} defaultUserId={user.id} />
        </SectionCard>
      </div>
    </div>
  );
}
