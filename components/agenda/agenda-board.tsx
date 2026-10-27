"use client";

/**
 * Agenda : orchestrateur client.
 *
 * Tient l'état partagé (RDV sélectionné, création, édition, validation en
 * cours) entre le héros, le bandeau « à valider », la grille (jour / semaine /
 * mois), le panneau de détail et les cartes latérales.
 *
 * Sélection : sur grand écran (≥ 1280 px) le détail vit dans la colonne de
 * droite (par défaut : le premier RDV à valider, sinon le prochain RDV) ; sur
 * téléphone / tablette il s'ouvre dans une fenêtre au toucher d'un RDV.
 *
 * Toute action qui change un résultat (RDV effectué, appel, email) rafraîchit
 * la coquille (router.refresh) pour mettre à jour les compteurs de la barre
 * du haut. Toasts sobres via resultToast, jamais de points.
 */
import { CalendarDays, CircleCheck, Flame } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteActivity,
  markActivityDone,
  rescheduleActivity,
  validerRdv,
} from "@/app/(app)/activites/actions";
import { resultToast } from "@/components/arena/celebrate";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type ActivityCategory } from "@/lib/activity-category";
import { firstNameOf } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";
import { dowOfKey, pad2, zDayKey, zTime } from "@/lib/queries/agenda-dates";

import {
  AddActivityDialog,
  type EditActivityInput,
} from "./add-activity-dialog";
import { AgendaHero, type HeroSubject } from "./agenda-hero";
import { AgendaLegend } from "./agenda-legend";
import { MiniMonthCard, UpcomingCard } from "./agenda-side";
import { buildUserColors, isClientRdv, sortTeam } from "./agenda-style";
import { AgendaToolbar, agendaHref, type AgendaMode } from "./agenda-toolbar";
import { AgendaViewSwitcher } from "./agenda-view-switcher";
import { MonthView } from "./month-view";
import { PendingBanner, type ValidationStatut } from "./pending-banner";
import { RdvDetail } from "./rdv-detail";
import { SyncButton } from "./sync-button";
import { useMediaQuery, useNowMs } from "./use-agenda-clock";
import { dureeMin, WeekView } from "./week-view";

import type {
  AgendaActivity,
  AgendaResults,
  DayRdvCount,
} from "@/lib/queries/agenda";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export interface AgendaBoardProps {
  mode: AgendaMode;
  refKey: string;
  /** Colonnes (jour / semaine) ou grille de 42 jours (mois). */
  dayKeys: string[];
  /** « AAAA-MM » du mois affiché (vue mois). */
  targetMonth: string;
  view: string;
  hideDone: boolean;
  activeCats: ActivityCategory[];
  catCounts: Record<ActivityCategory, number>;
  activities: AgendaActivity[];
  results: AgendaResults;
  dayCounts: Record<string, DayRdvCount>;
  phoning: Record<string, string>;
  subject: HeroSubject;
  teamUsers: UserOption[];
  currentUserId: string;
  isAdmin: boolean;
  serverNowMs: number;
}

/** Convertit une activité en valeurs initiales pour le formulaire d'édition. */
function toEditInput(a: AgendaActivity): EditActivityInput {
  const start = new Date(a.date);
  const end = new Date(start.getTime() + dureeMin(a) * 60_000);
  return {
    id: a.id,
    prospectId: a.prospectId ?? "",
    prospectLabel: a.prospect?.raisonSociale ?? "",
    userId: a.userId,
    type: a.type,
    sujet: a.sujet,
    dateIso: zDayKey(start),
    heure: zTime(start),
    heureFin: zTime(end),
    adresseRdv: a.adresseRdv ?? "",
    contenu: a.contenu ?? "",
    couleur: a.couleur ?? null,
  };
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function AgendaBoard({
  mode,
  refKey,
  dayKeys,
  targetMonth,
  view,
  hideDone,
  activeCats,
  catCounts,
  activities,
  results,
  dayCounts,
  phoning,
  subject,
  teamUsers,
  currentUserId,
  isAdmin,
  serverNowMs,
}: AgendaBoardProps) {
  const router = useRouter();
  const nowMs = useNowMs(serverNowMs);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const [, startTransition] = useTransition();

  // undefined = sélection par défaut (panneau large), null = rien, sinon un id.
  const [selId, setSelId] = useState<string | null | undefined>(undefined);
  const [add, setAdd] = useState<{
    open: boolean;
    dateIso: string;
    time: string;
  }>({
    open: false,
    dateIso: results.todayKey,
    time: "09:00",
  });
  const [editing, setEditing] = useState<AgendaActivity | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [validatedCount, setValidatedCount] = useState(0);

  const you = subject.kind === "self";
  const teamView = isAdmin && view === "all";
  const showOwner = isAdmin && view === "all";
  const userColors = buildUserColors(teamUsers);
  const nowKey = zDayKey(nowMs);

  // Toutes les activités connues de la page (grille + à valider + à venir)
  const pool = new Map<string, AgendaActivity>();
  for (const a of [...results.pending, ...results.upcoming, ...activities])
    pool.set(a.id, a);
  const defaultId = results.pending[0]?.id ?? results.upcoming[0]?.id ?? null;
  const panelId = selId === undefined ? defaultId : selId;
  const panelActivity = panelId ? (pool.get(panelId) ?? null) : null;
  const mobileActivity =
    !isDesktop && typeof selId === "string" ? (pool.get(selId) ?? null) : null;
  // Surbrillance dans la grille / la liste : sur téléphone, seulement le RDV
  // réellement touché (pas la sélection par défaut du panneau large).
  const highlightId = isDesktop ? panelId : (mobileActivity?.id ?? null);

  const dayHref = (key: string) =>
    agendaHref({ mode: "day", dateKey: key, view, hideDone, cats: activeCats });

  const open = (a: AgendaActivity) => {
    setSelId(a.id);
    if (isDesktop) {
      document
        .getElementById("agenda-detail")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const newRdv = () => {
    // Prochain créneau plein dans la journée (heure locale), sinon demain 09:00.
    const d = new Date();
    let h = d.getHours() + 1;
    if (h < 8) h = 9;
    if (h > 18) {
      d.setDate(d.getDate() + 1);
      h = 9;
    }
    setAdd({ open: true, dateIso: localIso(d), time: `${pad2(h)}:00` });
  };

  const ownerFirstName = (a: AgendaActivity) =>
    a.user ? firstNameOf(a.user.name) : "";

  const valider = (a: AgendaActivity, statut: ValidationStatut) => {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await validerRdv(a.id, statut);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      const titre = a.prospect?.raisonSociale ?? a.sujet;
      if (statut === "FAIT") {
        if (isClientRdv(a) && a.userId === currentUserId) {
          resultToast(`RDV effectué avec ${titre}`, "Prochaine étape : envoyer la proposition");
        } else if (isClientRdv(a)) {
          const owner = ownerFirstName(a);
          resultToast(
            "RDV validé comme effectué",
            `${titre}${owner ? ` · RDV de ${owner}` : ""} · prochaine étape : la proposition`,
          );
        } else {
          resultToast("RDV validé comme effectué", titre);
        }
      } else if (statut === "MANQUE") {
        resultToast("RDV noté comme manqué", "Recale un créneau vite pour garder le lead au chaud");
      } else {
        resultToast("RDV annulé", "Il ne compte plus dans la semaine");
      }
      setValidatedCount((c) => c + 1);
      router.refresh();
    });
  };

  const markDone = (a: AgendaActivity) => {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await markActivityDone(a.id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      // Toast de résultat : libellé selon le type, entreprise en détail.
      const titre = a.prospect?.raisonSociale ?? a.sujet;
      const label =
        a.type === "APPEL_SORTANT" || a.type === "APPEL_ENTRANT"
          ? "Appel enregistré"
          : a.type === "EMAIL_ENVOYE"
            ? "Email envoyé"
            : "Activité faite";
      resultToast(label, titre);
      router.refresh();
    });
  };

  const reschedule = (a: AgendaActivity) => {
    setBusyId(a.id);
    startTransition(async () => {
      const t = new Date(a.date);
      t.setDate(t.getDate() + 1);
      const res = await rescheduleActivity(a.id, t);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Replanifiée à J+1.", {
        description: `Nouveau créneau : ${zTime(t)}, le lendemain.`,
      });
      router.refresh();
    });
  };

  const remove = (a: AgendaActivity) => {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await deleteActivity(a.id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Erreur lors de la suppression.");
        return;
      }
      toast.success("Activité supprimée.", {
        description: "Retirée aussi des agendas synchronisés.",
      });
      setSelId(null);
      router.refresh();
    });
  };

  const edit = (a: AgendaActivity) => {
    if (!isDesktop) setSelId(null);
    setEditing(a);
  };

  const detailProps = (a: AgendaActivity, headingId: string) => ({
    activity: a,
    nowMs,
    phoningDay: phoning[a.id] ?? null,
    showUser: isAdmin && view !== "mine",
    busy: busyId === a.id,
    headingId,
    onValidate: valider,
    onEdit: edit,
    onMarkDone: markDone,
    onReschedule: reschedule,
    onDelete: remove,
  });

  // Période sans aucune activité affichée (hors filtres tous coupés)
  const emptyPeriod =
    mode !== "month" && activities.length === 0 && activeCats.length > 0;
  const periodPast = dayKeys[dayKeys.length - 1] < nowKey;

  const teamLegend = teamView
    ? sortTeam(teamUsers).map((u) => ({
        id: u.id,
        name: u.name,
        color: userColors[u.id] ?? "#8A93A6",
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && teamUsers.length > 1 && (
        <AgendaViewSwitcher
          users={teamUsers}
          currentUserId={currentUserId}
          activeView={view}
          userColors={userColors}
        />
      )}

      <AgendaHero
        results={results}
        subject={subject}
        nowMs={nowMs}
        onPrepare={open}
        onNewRdv={newRdv}
      />

      <PendingBanner
        pending={results.pending}
        todayKey={nowKey}
        busyId={busyId}
        showOwner={showOwner}
        onValidate={valider}
        onOpen={open}
      />
      {results.pending.length === 0 && validatedCount > 0 && (
        <section
          aria-label="Agenda à jour"
          className="flex flex-wrap items-center gap-3 rounded-[20px] border border-win-500 bg-win-50 px-5 py-3.5"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-win-500 text-white"
          >
            <CircleCheck className="size-[18px]" strokeWidth={2.6} />
          </span>
          <p className="min-w-0 flex-[1_1_260px] text-sm font-bold text-win-700">
            Agenda à jour : aucun RDV en attente de validation.
          </p>
        </section>
      )}

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        {/* Sur téléphone, les cartes s'ordonnent : agenda, prochains RDV,
            mini-calendrier. Sur grand écran : 2 colonnes. */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
          <section
            aria-labelledby="agenda-periode"
            className="order-1 min-w-0 overflow-hidden rounded-[20px] border border-border bg-card shadow-arena xl:order-none"
          >
            <div className="border-b border-border px-4 pt-4 pb-3.5 sm:px-5">
              <AgendaToolbar
                mode={mode}
                refKey={refKey}
                todayKey={nowKey}
                view={view}
                hideDone={hideDone}
                activeCats={activeCats}
                catCounts={catCounts}
                actions={<SyncButton />}
              />
            </div>
            {emptyPeriod && (
              <EmptyPeriod
                past={periodPast}
                weekendDay={
                  !periodPast &&
                  mode === "day" &&
                  [0, 6].includes(dowOfKey(refKey))
                }
                showToday={!dayKeys.includes(nowKey)}
                todayHref={agendaHref({
                  mode,
                  dateKey: nowKey,
                  view,
                  hideDone,
                  cats: activeCats,
                })}
              />
            )}
            {mode === "month" ? (
              <div className="pt-4">
                <MonthView
                  dayKeys={dayKeys}
                  targetMonth={targetMonth}
                  activities={activities}
                  dayCounts={dayCounts}
                  nowKey={nowKey}
                  dayHref={dayHref}
                  you={you}
                />
              </div>
            ) : (
              <WeekView
                dayKeys={dayKeys}
                activities={activities}
                nowMs={nowMs}
                showUserBadge={teamView}
                userColors={userColors}
                phoning={phoning}
                selectedId={highlightId}
                noCategory={activeCats.length === 0}
                dayHref={mode === "week" ? dayHref : undefined}
                onOpen={open}
                onSlot={(dateIso, time) =>
                  setAdd({ open: true, dateIso, time })
                }
                onValidate={valider}
                busyId={busyId}
              />
            )}
            <AgendaLegend
              activeCats={activeCats}
              team={teamLegend}
              month={mode === "month"}
            />
          </section>
        </div>

        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
          {/* Rendu dès le serveur (pas de saut à l'hydratation), visible
              uniquement sur grand écran ; ailleurs le détail s'ouvre en fenêtre. */}
          <section
            id="agenda-detail"
            aria-labelledby="agenda-detail-titre"
            className="hidden min-w-0 scroll-mt-4 overflow-hidden rounded-[20px] border border-border bg-card shadow-arena xl:block"
          >
            {panelActivity ? (
              <RdvDetail
                key={panelActivity.id}
                {...detailProps(panelActivity, "agenda-detail-titre")}
                onClose={() => setSelId(null)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2.5 px-6 py-8 text-center">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-[18px] bg-gold-50 text-gold-700"
                >
                  <CalendarDays className="size-[26px]" />
                </span>
                <h2
                  id="agenda-detail-titre"
                  className="font-display text-xl font-extrabold tracking-[-0.02em] text-foreground"
                >
                  Choisis un RDV
                </h2>
                <p className="text-[13px] leading-normal font-medium text-muted-foreground">
                  Clique sur un bloc de l&apos;agenda pour voir
                  l&apos;entreprise, le contact et ta checklist de préparation.
                </p>
              </div>
            )}
          </section>
          <div className="order-2 min-w-0 xl:order-none">
            <UpcomingCard
              upcoming={results.upcoming}
              aVenirSemaine={results.week.aVenir}
              joursSansRdv={results.week.joursSansRdv}
              nowMs={nowMs}
              selectedId={highlightId}
              showOwner={showOwner}
              you={you}
              onOpen={open}
            />
          </div>
          <div className="order-3 min-w-0 xl:order-none">
            <MiniMonthCard
              refKey={refKey}
              nowKey={nowKey}
              dayCounts={dayCounts}
              dayHref={dayHref}
              highlightWeek={mode !== "month"}
            />
          </div>
        </div>
      </div>

      {/* Création (créneau cliqué, « Nouveau RDV ») */}
      <AddActivityDialog
        defaultDate={add.dateIso}
        defaultTime={add.time}
        users={teamUsers}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        open={add.open}
        onOpenChange={(o) => setAdd((s) => ({ ...s, open: o }))}
        hideTrigger
      />

      {/* Édition (depuis le détail d'un événement) */}
      <AddActivityDialog
        defaultDate={editing ? zDayKey(editing.date) : results.todayKey}
        users={teamUsers}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        hideTrigger
        editActivity={editing ? toEditInput(editing) : undefined}
      />

      {/* Détail sur téléphone / tablette */}
      <Dialog
        open={!!mobileActivity}
        onOpenChange={(o) => !o && setSelId(null)}
      >
        <DialogContent
          showCloseButton={false}
          aria-labelledby="agenda-detail-mobile-titre"
          className="gap-0 rounded-[20px] p-0 sm:max-w-md"
        >
          {mobileActivity && (
            <RdvDetail
              key={mobileActivity.id}
              {...detailProps(mobileActivity, "agenda-detail-mobile-titre")}
              onClose={() => setSelId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Période (jour / semaine) sans aucune activité affichée. */
function EmptyPeriod({
  past,
  weekendDay,
  showToday,
  todayHref,
}: {
  past: boolean;
  weekendDay: boolean;
  showToday: boolean;
  todayHref: string;
}) {
  let title = "Rien de calé pour l'instant";
  let text = "Chaque appel compte, chaque RDV est une chance. Lance une session d'appels pour remplir cette période.";
  if (weekendDay) {
    title = "Week-end : recharge les batteries";
    text = "Lundi on attaque : ta session d'appels t'attend.";
  } else if (past) {
    title = "Période bouclée";
    text = "Rien à afficher sur cette période avec les filtres actuels.";
  }
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-ground px-4 py-3.5 sm:px-5">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-gold-50 text-gold-700"
      >
        <CalendarDays className="size-5" />
      </span>
      <div className="min-w-0 flex-[1_1_220px]">
        <p className="font-display text-base font-extrabold tracking-[-0.02em] text-foreground">
          {title}
        </p>
        <p className="text-[13px] leading-snug font-medium text-muted-foreground">
          {text}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {showToday && (
          <Link
            href={todayHref}
            scroll={false}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Revenir à aujourd&apos;hui
          </Link>
        )}
        {!past && (
          <Link
            href="/phoning"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <Flame aria-hidden="true" className="text-coral-600" />
            Lancer une session d&apos;appels
          </Link>
        )}
      </div>
    </div>
  );
}
