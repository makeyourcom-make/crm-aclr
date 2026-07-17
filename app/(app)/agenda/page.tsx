import Link from "next/link";

import { AddActivityDialog } from "@/components/agenda/add-activity-dialog";
import {
  AgendaToolbar,
  type AgendaMode,
} from "@/components/agenda/agenda-toolbar";
import { AgendaViewSwitcher } from "@/components/agenda/agenda-view-switcher";
import { MonthView } from "@/components/agenda/month-view";
import { WeekView } from "@/components/agenda/week-view";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import { prisma } from "@/lib/db";
import { getAgendaRange, getStartOfWeek } from "@/lib/queries/agenda";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;

  // Mode d'affichage : jour / semaine (défaut) / mois
  const mode: AgendaMode =
    raw.mode === "day" || raw.mode === "month" ? raw.mode : "week";

  // Date de référence : ?date= (ou ?week= en rétrocompat), sinon aujourd'hui
  const dateParam =
    (typeof raw.date === "string" ? raw.date : undefined) ??
    (typeof raw.week === "string" ? raw.week : undefined);
  const requested = dateParam ? new Date(dateParam) : new Date();
  const refDate = isNaN(requested.getTime()) ? new Date() : requested;
  refDate.setHours(0, 0, 0, 0);
  const hideDone = raw.hideDone === "1";

  // Construit la liste des colonnes (dates) + l'intervalle de requête
  let dates: Date[];
  let rangeStart: Date;
  let rangeEnd: Date;
  let targetMonth = refDate.getMonth();

  if (mode === "day") {
    dates = [new Date(refDate)];
    rangeStart = new Date(refDate);
    rangeEnd = new Date(refDate);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (mode === "month") {
    const monthFirst = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    targetMonth = monthFirst.getMonth();
    rangeStart = getStartOfWeek(monthFirst);
    dates = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 42);
  } else {
    const ws = getStartOfWeek(refDate);
    dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
    rangeStart = ws;
    rangeEnd = new Date(ws);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  }

  // Vue admin : "all" (défaut, cf. AGENDA_DEFAULT_VIEW), "mine", ou userId
  // d'une commerciale précise. Ignorée pour les commerciaux (scope verrouillé
  // côté query) — d'où le repli sur "mine" pour eux, purement cosmétique.
  const isAdmin = user.role === "ADMIN";
  const view =
    typeof raw.view === "string"
      ? raw.view
      : isAdmin
        ? AGENDA_DEFAULT_VIEW
        : "mine";

  // Pour le switcher + assignation dialog : liste des users actifs (admin uniquement)
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [activities, prospects] = await Promise.all([
    getAgendaRange(user, rangeStart, rangeEnd, hideDone, view),
    prisma.prospect.findMany({
      where: {
        ...scopedWhere(user, {}),
        statut: { notIn: ["PERDU", "NE_PAS_RAPPELER"] },
      },
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
  ]);

  const today = new Date();

  // Description dynamique selon la vue active
  const viewedUser =
    view !== "mine" && view !== "all"
      ? teamUsers.find((u) => u.id === view)
      : null;
  const viewLabel = isAdmin
    ? view === "all"
      ? "Toute l'équipe"
      : viewedUser
        ? `Agenda de ${viewedUser.name}`
        : "Mon agenda"
    : "Mon agenda";
  const periodeLabel =
    mode === "day" ? "ce jour" : mode === "month" ? "ce mois" : "la semaine";
  const description = `${activities.length} activité(s) sur ${periodeLabel} · ${viewLabel}.`;

  // Lien vers la vue Jour (utilisé par la vue Mois), préserve les filtres
  const hrefForDay = (iso: string) => {
    const sp = new URLSearchParams();
    sp.set("mode", "day");
    sp.set("date", iso);
    if (view !== AGENDA_DEFAULT_VIEW) sp.set("view", view);
    if (hideDone) sp.set("hideDone", "1");
    return `/agenda?${sp.toString()}`;
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Agenda"
        description={description}
        actions={
          <>
            <Link
              href="/settings/calendar"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              title="Configurer la synchronisation Infomaniak / Google / Apple"
            >
              <Icon name="Repeat" className="h-3.5 w-3.5" />
              Synchroniser l&apos;agenda
            </Link>
            <AddActivityDialog
              prospects={prospects}
              defaultDate={toIso(today)}
              defaultTime="09:00"
              triggerMode="header"
              users={teamUsers}
              currentUserId={user.id}
              isAdmin={isAdmin}
            />
          </>
        }
      />

      {isAdmin && teamUsers.length > 1 && (
        <div className="mb-3">
          <AgendaViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeView={view}
          />
        </div>
      )}

      <div className="mb-4">
        <AgendaToolbar
          mode={mode}
          date={refDate}
          view={view}
          hideDone={hideDone}
        />
      </div>

      {mode === "month" ? (
        <MonthView
          dates={dates}
          targetMonth={targetMonth}
          activities={activities}
          hrefForDay={hrefForDay}
        />
      ) : (
        <WeekView
          dates={dates}
          activities={activities}
          prospects={prospects}
          showUserBadge={isAdmin && view === "all"}
          users={teamUsers}
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {mode === "month"
          ? "💡 Clique sur un jour pour l'ouvrir en vue Jour."
          : "💡 Clique sur un créneau vide pour planifier, glisse un événement pour le déplacer, tire son bas pour changer la durée."}
      </p>
    </div>
  );
}
