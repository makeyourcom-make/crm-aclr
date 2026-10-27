import { AddActivityDialog } from "@/components/agenda/add-activity-dialog";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import type { AgendaMode } from "@/components/agenda/agenda-toolbar";
import { PageHeader } from "@/components/page-header";
import {
  activityCategory,
  ALL_CATEGORY_KEYS,
  DEFAULT_CATEGORY_KEYS,
  type ActivityCategory,
} from "@/lib/activity-category";
import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import { prisma } from "@/lib/db";
import { firstNameOf } from "@/lib/gamification/rules";
import {
  getAgendaGame,
  getAgendaRange,
  getPhoningOrigins,
  getRdvDayCounts,
  resolveAgendaSubject,
} from "@/lib/queries/agenda";
import {
  addDaysKey,
  isDayKey,
  mondayOfKey,
  monthStartKey,
  zDayKey,
  zStartOfDay,
} from "@/lib/queries/agenda-dates";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const now = new Date();
  const todayKey = zDayKey(now);

  // Mode d'affichage : jour / semaine (défaut) / mois
  const mode: AgendaMode =
    raw.mode === "day" || raw.mode === "month" ? raw.mode : "week";

  // Date de référence : ?date= (ou ?week= en rétrocompat), sinon aujourd'hui.
  // Jours découpés en heure suisse (le serveur tourne en UTC).
  const dateParam =
    (typeof raw.date === "string" ? raw.date : undefined) ??
    (typeof raw.week === "string" ? raw.week : undefined);
  let refKey = todayKey;
  if (dateParam) {
    const head = dateParam.slice(0, 10);
    if (isDayKey(head)) refKey = head;
    else {
      const d = new Date(dateParam);
      if (!Number.isNaN(d.getTime())) refKey = zDayKey(d);
    }
  }
  const hideDone = raw.hideDone === "1";

  // Filtre par catégorie d'activité (?cat=rdv,mail,appel). Absent = défaut
  // (RDV seulement) ; « none » = rien.
  const catParam = typeof raw.cat === "string" ? raw.cat : undefined;
  const activeCats: ActivityCategory[] = catParam
    ? (catParam
        .split(",")
        .map((c) => c.trim())
        .filter((c) =>
          ALL_CATEGORY_KEYS.includes(c as ActivityCategory),
        ) as ActivityCategory[])
    : DEFAULT_CATEGORY_KEYS;
  // Filtre actif dès que l'ensemble affiché ne couvre pas tout
  // (y compris "none"/vide → on n'affiche rien).
  const catFilterActive = activeCats.length < ALL_CATEGORY_KEYS.length;

  // Colonnes (jours) + intervalle de requête [premier jour, lendemain du dernier[
  let dayKeys: string[];
  if (mode === "day") {
    dayKeys = [refKey];
  } else if (mode === "month") {
    const gridStart = mondayOfKey(monthStartKey(refKey));
    dayKeys = Array.from({ length: 42 }, (_, i) => addDaysKey(gridStart, i));
  } else {
    const ws = mondayOfKey(refKey);
    dayKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(ws, i));
  }
  const rangeStart = zStartOfDay(dayKeys[0]);
  const rangeEnd = zStartOfDay(addDaysKey(dayKeys[dayKeys.length - 1], 1));
  // Mini-calendrier : grille de 6 semaines du mois de référence.
  const miniStart = mondayOfKey(monthStartKey(refKey));
  const miniEnd = addDaysKey(miniStart, 42);

  // Vue admin : "all" (défaut, cf. AGENDA_DEFAULT_VIEW), "mine", ou userId
  // d'une commerciale précise. Ignorée pour les commerciaux (scope verrouillé
  // côté query), d'où le repli sur "mine" pour eux, purement cosmétique.
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

  // Agenda d'une personne qui n'est plus active (lien direct) : on retrouve son nom.
  const viewedUser =
    isAdmin && view !== "mine" && view !== "all"
      ? (teamUsers.find((u) => u.id === view) ??
        (await prisma.user.findUnique({
          where: { id: view },
          select: { id: true, name: true, role: true },
        })))
      : null;
  const subject = resolveAgendaSubject(
    user,
    view,
    viewedUser && !teamUsers.some((u) => u.id === viewedUser.id)
      ? [...teamUsers, viewedUser]
      : teamUsers,
  );

  // Le sélecteur de client du dialogue d'activité fait sa recherche côté
  // serveur (ProspectCombobox) : aucune liste de prospects préchargée ici.
  const [allActivities, game, dayCounts] = await Promise.all([
    getAgendaRange(user, rangeStart, rangeEnd, hideDone, view),
    getAgendaGame(subject),
    getRdvDayCounts(subject, miniStart, miniEnd),
  ]);
  const activeCatSet = new Set(activeCats);
  const activities = catFilterActive
    ? allActivities.filter((a) => activeCatSet.has(activityCategory(a.type)))
    : allActivities;

  // Compteurs des puces de filtre (hors annulées)
  const catCounts: Record<ActivityCategory, number> = { rdv: 0, mail: 0, appel: 0, autre: 0 };
  for (const a of allActivities) {
    if (a.statut !== "ANNULE") catCounts[activityCategory(a.type)] += 1;
  }

  const phoning = await getPhoningOrigins([
    ...activities,
    ...game.pending,
    ...game.upcoming,
  ]);

  // Description dynamique selon la vue active
  const viewLabel = isAdmin
    ? view === "all"
      ? "Toute l'équipe"
      : viewedUser
        ? `Agenda de ${viewedUser.name}`
        : "Mon agenda"
    : "Mon agenda";
  const periodeLabel =
    mode === "day" ? "ce jour" : mode === "month" ? "ce mois" : "la semaine";
  const n = activities.length;
  const description = `${n} activité${n > 1 ? "s" : ""} sur ${periodeLabel} · ${viewLabel}`;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="agenda"
        title="Agenda"
        description={description}
        actions={
          <AddActivityDialog
            defaultDate={todayKey}
            defaultTime="09:00"
            triggerMode="header"
            users={teamUsers}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        }
      />

      <AgendaBoard
        mode={mode}
        refKey={refKey}
        dayKeys={dayKeys}
        targetMonth={refKey.slice(0, 7)}
        view={view}
        hideDone={hideDone}
        activeCats={activeCats}
        catCounts={catCounts}
        activities={activities}
        game={game}
        dayCounts={dayCounts}
        phoning={phoning}
        subject={{
          kind: subject.kind,
          firstName: firstNameOf(subject.name),
        }}
        teamUsers={teamUsers}
        currentUserId={user.id}
        isAdmin={isAdmin}
        serverNowMs={now.getTime()}
      />
    </div>
  );
}
