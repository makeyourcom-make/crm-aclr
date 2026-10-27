import { CalendarCheck, ListChecks, PhoneOutgoing, Send, Zap } from "lucide-react";
import Link from "next/link";

import { ActivityFilters } from "@/components/activities/activity-filters";
import { ActivityRow } from "@/components/activities/activity-row";
import { ActivityViewSwitcher } from "@/components/activities/activity-view-switcher";
import { EmptyState } from "@/components/arena/empty-state";
import { StatTile } from "@/components/arena/stat-tile";
import { zDayKey, zRelativeDay, zWeekdayLong } from "@/components/call/zurich";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { XP_RULES } from "@/lib/gamification/rules";
import {
  getActivities,
  getTodayCallStats,
  type ActivityWithProspectUser,
} from "@/lib/queries/activities";
import { ActivityListParamsSchema } from "@/lib/schemas/activity";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Activités" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Regroupe les lignes par jour (Zurich) quand la liste est triée par date. */
function groupByDay(items: ActivityWithProspectUser[]) {
  const groups: { key: string; date: Date; items: ActivityWithProspectUser[] }[] = [];
  for (const a of items) {
    const key = zDayKey(a.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(a);
    else groups.push({ key, date: a.date, items: [a] });
  }
  return groups;
}

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Vue admin : "mine" (défaut), "all", ou userId d'une commerciale précise.
  const view = typeof raw.view === "string" ? raw.view : "mine";

  // Traduit la vue en filtre userId pour la requête.
  // - "mine" → userId = current user.id
  // - "all" → pas de filtre userId (admin uniquement → voit tout)
  // - userId → filtre par userId spécifique
  // Pour les commerciaux, la requête force déjà leur scope, on ignore "view".
  const filterUserId = (() => {
    if (!isAdmin) return undefined;
    if (view === "all") return undefined;
    if (view === "mine") return user.id;
    return view; // userId d'un autre user
  })();

  const params = ActivityListParamsSchema.parse({
    ...raw,
    userId: filterUserId ?? raw.userId,
  });

  // Liste des users pour le switcher (admin uniquement)
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [{ items, total, page, pageSize, totalPages }, todayStats] =
    await Promise.all([
      getActivities(user, params),
      // Compteurs du jour alignés sur la vue (admin : moi / une commerciale / équipe).
      getTodayCallStats(user, filterUserId),
    ]);

  // Libellé descriptif de la vue active
  const viewedUser =
    view !== "mine" && view !== "all"
      ? teamUsers.find((u) => u.id === view)
      : null;
  const viewLabel = isAdmin
    ? view === "all"
      ? "Toute l'équipe"
      : viewedUser
        ? `Activités de ${viewedUser.name}`
        : "Mes activités"
    : "Mes activités";
  const teamView = isAdmin && view === "all";

  const now = new Date();
  const grouped = params.sortBy === "date" ? groupByDay(items) : null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Activités"
        rubrique="appels"
        description={`${viewLabel} · appels, emails, RDV et notes au même endroit.`}
        actions={
          <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "lg" })}>
            <Zap aria-hidden="true" className="fill-white" />
            Lancer le phoning
          </Link>
        }
      />

      {/* Compteurs du jour */}
      <section aria-labelledby="activites-aujourdhui" className="mb-5 flex flex-col gap-2.5">
        <h2
          id="activites-aujourdhui"
          className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase"
        >
          Aujourd&apos;hui{teamView ? " · toute l'équipe" : ""}
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
          <StatTile
            label="Appels sortants"
            value={todayStats.appelsSortants}
            sub={teamView ? "équipe" : `+${XP_RULES.appel} XP chacun`}
            tone="coral"
            icon={PhoneOutgoing}
            href="/phoning"
          />
          <StatTile
            label="RDV faits"
            value={todayStats.rdvFaits}
            sub={teamView ? "équipe" : `+${XP_RULES.rdvEffectue} XP chacun`}
            tone="gold"
            icon={CalendarCheck}
            href="/agenda"
          />
          <StatTile
            label="Emails envoyés"
            value={todayStats.emailsEnvoyes}
            sub={teamView ? "équipe" : `+${XP_RULES.email} XP chacun`}
            tone="teal"
            icon={Send}
            href="/emails"
          />
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5">
        {isAdmin && teamUsers.length > 1 && (
          <ActivityViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeView={view}
          />
        )}
        <ActivityFilters params={params} />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.01em] text-foreground">
            {total} activité{total > 1 ? "s" : ""}
          </h2>
          {totalPages > 1 && (
            <span className="text-xs font-semibold text-muted-foreground">
              Page {page} sur {totalPages}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ListChecks}
              tone="coral"
              title="Aucune activité ici"
              description="Aucune activité ne correspond aux filtres. Change la période ou lance une session de phoning pour remplir ton journal."
              action={
                <Link href="/phoning" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Ouvrir le phoning
                </Link>
              }
            />
          </div>
        ) : grouped ? (
          grouped.map((g) => {
            const rel = zRelativeDay(g.date, now);
            const relLabel =
              rel === "aujourd'hui" ? "Aujourd'hui" : rel === "hier" ? "Hier" : rel === "demain" ? "Demain" : null;
            return (
              <section key={g.key} aria-label={zWeekdayLong(g.date)}>
                <h3 className="flex items-center gap-2 border-b border-border bg-ground px-4 py-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  {relLabel && <span className="text-foreground">{relLabel}</span>}
                  <span>{zWeekdayLong(g.date)}</span>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[11px] font-extrabold text-foreground tabular-nums">
                    {g.items.length}
                  </span>
                </h3>
                <div className="divide-y divide-border">
                  {g.items.map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      showUser={isAdmin}
                      currentUserId={user.id}
                    />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <div className="divide-y divide-border">
            {items.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                showUser={isAdmin}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
