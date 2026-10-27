"use client";

/**
 * Cockpit /phoning : enchaîner les appels et décrocher des RDV.
 *
 *   - Barre de session (héros) : chrono, objectif d'appels du jour,
 *     conversations et taux de conversation, RDV pris.
 *   - Prospect en cours (priorité : rappels dus, leads chauds, nouveaux) avec
 *     gros bouton Appeler → flux EXISTANT (CallSessionProvider / startCall).
 *   - Panneau de résultat intégré (même composant que la modale globale,
 *     recordCallResult côté serveur) → prospect suivant automatiquement.
 *   - Colonne : à appeler ensuite, traités en session, stats de session.
 *
 * Données : file + appels du jour + agenda RDV + objectifs du jour, toutes réelles
 * (serveur). Le navigateur ne garde que le chrono de session et les prospects
 * « passés » (localStorage). Après chaque résultat : router.refresh().
 */
import { CircleCheck, PhoneCall, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { resultToast } from "@/components/arena/celebrate";
import { EmptyState } from "@/components/arena/empty-state";
import { formatInt, plural } from "@/components/arena/format";
import { CallResultPanel } from "@/components/call/call-result-panel";
import { useCallSession } from "@/components/call/call-session-provider";
import { useNow } from "@/components/call/clock";
import { zDuration } from "@/components/call/zurich";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPhone, normalizePhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DAILY_TARGETS,
  dailyGoalsFor,
  emptyCounters,
  type DailyGoal,
  type DayCounters,
} from "@/lib/gamification/rules";
import type {
  PhoningAgendaItem,
  PhoningDayCall,
  PhoningQueue,
} from "@/lib/queries/phoning";

import { CallScript } from "./call-script";
import { adresseLine, contactName } from "./phoning-labels";
import {
  endPhoningSession,
  skipProspect,
  clearSkipped,
  startPhoningSession,
  togglePhoningPause,
  usePhoningSession,
} from "./phoning-session-store";
import { sessionStats, type CallPoint } from "./phoning-stats";
import { ProspectCard } from "./prospect-card";
import { QueuePanel, SessionStatsCard } from "./queue-panel";
import { SessionHero } from "./session-hero";

/** Résultats du jour de l'utilisateur connecté (moteur de résultats). */
export interface PhoningGame {
  /** Objectifs du jour (appels, RDV pris, propositions) avec jauges. */
  goals: DailyGoal[];
  today: DayCounters;
  /** Record : meilleure journée en RDV pris (null si aucun RDV). */
  bestDayRdvPris: number | null;
}

export interface PhoningCockpitProps {
  myFirstName: string;
  /** Nom de la commerciale dont l'admin vide la file (null = la sienne). */
  ownerLabel: string | null;
  queue: PhoningQueue;
  dayCalls: PhoningDayCall[];
  agenda: PhoningAgendaItem[];
  game: PhoningGame | null;
}

/** Tolérance d'horloge serveur / navigateur pour rattacher un appel à la session. */
const SESSION_SKEW_MS = 2 * 60_000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function PhoningCockpit({
  myFirstName,
  ownerLabel,
  queue,
  dayCalls,
  agenda,
  game,
}: PhoningCockpitProps) {
  const router = useRouter();
  const { session: callSession, elapsedSeconds, startCallSession } = useCallSession();
  const phSession = usePhoningSession();
  const nowMs = useNow(15_000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hangup, setHangup] = useState<{ activityId: string; seconds: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ---- File ----------------------------------------------------------------
  const skipped = phSession?.skipped ?? [];
  const itemIds = new Set(queue.items.map((i) => i.id));
  const visible = queue.items.filter((i) => !hidden.includes(i.id) && !skipped.includes(i.id));
  const sessionItem = callSession
    ? (queue.items.find((i) => i.id === callSession.prospectId) ?? null)
    : null;
  const current =
    sessionItem ?? visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;
  const next = visible.filter((i) => i.id !== current?.id).slice(0, 6);
  const removed =
    hidden.filter((id) => itemIds.has(id)).length +
    skipped.filter((id) => itemIds.has(id) && !hidden.includes(id)).length;
  const remaining = Math.max(visible.length, queue.counts.total - removed);

  // ---- Appels du jour → session -------------------------------------------
  const points: CallPoint[] = dayCalls.map((c) => ({
    id: c.id,
    start: new Date(c.date).getTime(),
    duree2: c.duree2,
    resultat: c.resultat,
    ongoing: callSession?.activityId === c.id,
    prospectId: c.prospectId,
    raisonSociale: c.raisonSociale,
  }));
  if (callSession && !points.some((p) => p.id === callSession.activityId)) {
    points.push({
      id: callSession.activityId,
      start: callSession.startedAt,
      duree2: null,
      resultat: null,
      ongoing: true,
      prospectId: callSession.prospectId,
      raisonSociale: callSession.prospectRaisonSociale,
    });
  }
  const sessionStart = phSession?.startedAt ?? null;
  const sessionPoints = sessionStart
    ? points.filter((p) => p.start >= sessionStart - SESSION_SKEW_MS)
    : [];
  const stats = sessionStats(sessionPoints);
  const done = [...sessionPoints].sort((a, b) => b.start - a.start);

  // ---- Objectifs du jour (moteur), repli sur les appels du jour -------------
  const fallbackCounters: DayCounters = {
    ...emptyCounters(),
    appels: points.length,
    conversations: sessionStats(points).conversations,
    rdvPris: points.filter((p) => p.resultat === "RDV_PRIS").length,
  };
  const goals = game?.goals ?? dailyGoalsFor(fallbackCounters, DEFAULT_DAILY_TARGETS);
  const goalAppels = goals.find((g) => g.key === "appels") ?? null;
  const goalRdv = goals.find((g) => g.key === "rdvPris") ?? null;

  // ---- Objectif du jour atteint (données réelles, après refresh) -----------
  const doneKey = goals
    .filter((g) => g.done)
    .map((g) => g.key)
    .join(",");
  const prevDone = useRef<string | null>(null);
  const announceGoals = useEffectEvent((prev: string) => {
    const before = new Set(prev.split(",").filter(Boolean));
    for (const g of goals) {
      if (g.done && !before.has(g.key)) {
        resultToast(
          `Objectif du jour atteint : ${g.label}`,
          `${formatInt(g.current)} / ${formatInt(g.target)} aujourd'hui`,
        );
      }
    }
  });
  useEffect(() => {
    const prev = prevDone.current;
    prevDone.current = doneKey;
    if (prev !== null && prev !== doneKey) announceGoals(prev);
  }, [doneKey]);

  // ---- Actions ----------------------------------------------------------
  const scrollTo = (el: HTMLElement | null) =>
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

  const handleCall = async (numero: string) => {
    if (!current || starting) return;
    if (callSession) {
      toast.error("Un appel est déjà en cours : enregistre son résultat d'abord.");
      return;
    }
    if (!phSession?.startedAt) startPhoningSession();
    else if (phSession.pausedAt) togglePhoningPause();
    const target = current;
    setSelectedId(target.id);
    setStarting(true);
    try {
      await startCallSession({
        prospectId: target.id,
        prospectRaisonSociale: target.raisonSociale,
        numero: normalizePhone(numero) ?? numero,
      });
    } finally {
      setStarting(false);
    }
  };

  const handleHangUp = () => {
    if (!callSession) return;
    setHangup({ activityId: callSession.activityId, seconds: elapsedSeconds });
    scrollTo(panelRef.current);
  };

  const handleRecorded = ({ prospectId }: { prospectId: string }) => {
    setHidden((h) => (h.includes(prospectId) ? h : [...h, prospectId]));
    setSelectedId(null);
    setHangup(null);
    scrollTo(cardRef.current);
  };

  const handleSkip = () => {
    if (!current || callSession?.prospectId === current.id) return;
    skipProspect(current.id);
    setSelectedId(null);
    toast(`Prospect passé · ${current.raisonSociale}`, {
      description: "Aucun appel compté. Il revient dans ta file à la prochaine session.",
    });
  };

  const handlePick = (id: string) => {
    if (callSession) return;
    setSelectedId(id);
    scrollTo(cardRef.current);
  };

  const handleEnd = () => {
    endPhoningSession();
    resultToast(
      "Session terminée",
      `${plural(stats.calls, "appel")} · ${plural(stats.conversations, "décroché")} · ${stats.rdv} RDV pris`,
    );
  };

  const reloadQueue = () => {
    clearSkipped();
    setHidden([]);
    setSelectedId(null);
    router.refresh();
  };

  const frozen =
    hangup && callSession && hangup.activityId === callSession.activityId ? hangup.seconds : null;
  const rdvSource = sessionItem ?? (current && callSession?.prospectId === current.id ? current : null);

  // ---------------------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-6", callSession && (sessionItem ? "pb-20 md:pb-0" : "pb-20"))}>
      {ownerLabel && (
        <p className="flex items-center gap-2 rounded-[14px] border border-info-500/30 bg-info-50 px-4 py-3 text-sm font-semibold text-info-700">
          <Users aria-hidden="true" className="size-4 shrink-0" />
          Tu vides la file de {ownerLabel} : les appels sont enregistrés à ton nom.
        </p>
      )}

      <SessionHero
        session={phSession}
        stats={stats}
        goalAppels={goalAppels}
        goalRdv={goalRdv}
        bestDayRdvPris={game?.bestDayRdvPris ?? null}
        onStart={startPhoningSession}
        onTogglePause={togglePhoningPause}
        onEnd={handleEnd}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div ref={cardRef} className="scroll-mt-20">
            {current ? (
              <ProspectCard
                key={current.id}
                item={current}
                nowMs={nowMs}
                callSession={callSession}
                elapsedSeconds={frozen ?? elapsedSeconds}
                hungUp={frozen !== null}
                starting={starting}
                remaining={remaining}
                onCall={handleCall}
                onHangUp={handleHangUp}
                onSkip={handleSkip}
              />
            ) : queue.items.length === 0 ? (
              <EmptyState
                icon={PhoneCall}
                tone="coral"
                title="Rien à appeler pour l'instant"
                description="Aucun rappel dû, aucun lead chaud à relancer ni nouveau prospect avec un numéro dans ce portefeuille. Ajoute des entreprises ou attribue-toi des prospects."
                action={
                  <Link href="/prospects" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    Voir les entreprises
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={CircleCheck}
                tone="green"
                title="File vidée"
                description={`${plural(stats.calls, "appel")}, ${plural(stats.conversations, "décroché")} et ${stats.rdv} RDV pris dans cette session. Recharge la file pour continuer.`}
                action={
                  <Button variant="hero" size="xl" onClick={reloadQueue}>
                    <RotateCcw aria-hidden="true" />
                    Recharger la file
                  </Button>
                }
              />
            )}
          </div>

          <div ref={panelRef} className="scroll-mt-20">
            <CallResultPanel
              variant="inline"
              frozenSeconds={frozen}
              rdvDefaults={
                rdvSource
                  ? {
                      contact: contactName(rdvSource) || null,
                      adresse: adresseLine(rdvSource) || null,
                      numero: callSession?.numero ? formatPhone(callSession.numero) : null,
                    }
                  : callSession
                    ? { numero: formatPhone(callSession.numero) }
                    : undefined
              }
              agenda={agenda}
              onRecorded={handleRecorded}
              onCancelled={() => setHangup(null)}
            />
          </div>

          {current && (
            <CallScript contact={contactName(current)} myFirstName={myFirstName} />
          )}
        </div>

        <aside aria-label="File et statistiques de session" className="flex min-w-0 flex-col gap-5">
          <QueuePanel
            next={next}
            remaining={remaining}
            nowMs={nowMs}
            disabled={!!callSession}
            onPick={handlePick}
            done={done}
            skippedCount={skipped.filter((id) => itemIds.has(id)).length}
            onRestoreSkipped={clearSkipped}
          />
          <SessionStatsCard stats={stats} today={game?.today ?? null} />
        </aside>
      </div>

      {/* Barre d'appel collante sur téléphone (le widget global est masqué ici).
          Aussi sur ordinateur quand l'appel en cours vise un prospect hors de la
          file (lancé depuis une fiche) : la carte n'a alors pas de « J'ai raccroché ». */}
      {callSession && (
        <div
          className={cn(
            "fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-[16px] bg-navy-700 px-4 py-2.5 text-white shadow-arena-lg",
            sessionItem ? "md:hidden" : "md:inset-x-auto md:right-4 md:bottom-4 md:w-[22rem]",
          )}
        >
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-win-500 motion-safe:animate-pulse" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold">{callSession.prospectRaisonSociale}</span>
            <span className="score-number text-lg text-white">
              {zDuration(frozen ?? elapsedSeconds)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => (frozen === null ? handleHangUp() : scrollTo(panelRef.current))}
            className="inline-flex h-11 shrink-0 items-center rounded-[12px] bg-gradient-coral px-3.5 text-[17px] font-extrabold text-white text-shadow-[0_1px_1px_rgba(120,20,26,0.35)]"
          >
            {frozen === null ? "J'ai raccroché" : "Résultat"}
          </button>
        </div>
      )}
    </div>
  );
}
