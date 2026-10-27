"use client";

/**
 * Pipeline MYC Arena : héros, indicateurs, filtres, Kanban (glisser-déposer)
 * et « Leçons du mois », sur un état partagé.
 *
 * Architecture @dnd-kit :
 *   - DndContext       : englobe tout
 *   - PipelineColumn   : chaque colonne est une zone droppable (id = étape)
 *   - PipelineLessons  : zone droppable « PERDU »
 *   - DraggableDealCard (useDraggable) : chaque carte se déplace ; la copie
 *     flottante est rendue dans <DragOverlay />.
 *   - MouseSensor (5 px) : un clic simple n'enclenche pas le drag (le clic
 *     ouvre le deal) ; TouchSensor (appui 250 ms) : le défilement au doigt
 *     reste possible sur téléphone.
 *
 * Optimistic UI (useOptimistic) : la carte change de colonne immédiatement,
 * puis moveDealStage tourne en arrière-plan. En cas d'échec : toast d'erreur
 * et retour à l'état serveur. Passage en Signé : confettis + toast XP.
 * Après chaque succès : router.refresh() pour mettre à jour la coquille
 * (pilules XP et série de la barre du haut).
 */
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { DealStage } from "@prisma/client";
import { Filter, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { moveDealStage, type DealActionResult } from "@/app/(app)/pipeline/actions";
import { celebrate, xpToast } from "@/components/arena";
import { DealDetailSheet } from "@/components/pipeline/deal-detail-sheet";
import { XP_RULES, firstNameOf } from "@/lib/gamification/rules";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";
import type { PipelineData, PipelineDeal, PipelineScoreboard } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { DealCardView } from "./deal-card";
import { LostReasonDialog } from "./lost-reason-dialog";
import { PipelineColumn } from "./pipeline-column";
import { PipelineHero, type HeroViewText } from "./pipeline-hero";
import { PipelineKpis } from "./pipeline-kpis";
import { PipelineLessons } from "./pipeline-lessons";
import {
  ALL_STAGES,
  BOARD_STAGES,
  STAGE_META,
  isActiveStage,
  isDormant,
  isHot,
  signXp,
} from "./pipeline-meta";

type QuickFilter = "tous" | "chauds" | "relancer";

interface Move {
  dealId: string;
  stage: DealStage;
  at: Date;
  raisonPerte?: string;
}

interface PipelineBoardProps {
  initialData: PipelineData;
  scoreboard: PipelineScoreboard;
  isAdmin: boolean;
  currentUserId: string;
  /** Instant du rendu serveur (ISO) : base des « N j sans action ». */
  nowIso: string;
  monthLabel: string;
  resetLabel: string;
  daysToReset: number;
  view: HeroViewText;
  /** Sélecteur de vue admin (rendu par la page). */
  viewSwitcher?: ReactNode;
}

const noop = () => {};

function applyMoveReducer(state: PipelineDeal[], m: Move): PipelineDeal[] {
  const moved = state.find((d) => d.id === m.dealId);
  if (!moved) return state;
  const closing = m.stage === "SIGNE" || m.stage === "PERDU";
  const next: PipelineDeal = {
    ...moved,
    stage: m.stage,
    probabilite: DEAL_STAGE_PROBA_DEFAUT[m.stage],
    lastActionAt: m.at,
    closeReelLe: closing ? m.at : moved.closeReelLe,
    raisonPerte: m.stage === "PERDU" && m.raisonPerte ? m.raisonPerte : moved.raisonPerte,
  };
  // En tête de sa nouvelle colonne, comme avant.
  return [next, ...state.filter((d) => d.id !== m.dealId)];
}

const announcements: Announcements = {
  onDragStart: () => "Carte saisie.",
  onDragOver: ({ over }) =>
    over ? `Au-dessus de ${labelForDropId(String(over.id))}.` : "Hors des colonnes.",
  onDragEnd: ({ over }) =>
    over ? `Carte déposée dans ${labelForDropId(String(over.id))}.` : "Carte relâchée.",
  onDragCancel: () => "Déplacement annulé.",
};

function labelForDropId(id: string): string {
  return (ALL_STAGES as string[]).includes(id)
    ? `la colonne ${STAGE_META[id as DealStage].label}`
    : "une carte";
}

export function PipelineBoard({
  initialData,
  scoreboard,
  isAdmin,
  currentUserId,
  nowIso,
  monthLabel,
  resetLabel,
  daysToReset,
  view,
  viewSwitcher,
}: PipelineBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const baseDeals = useMemo(
    () => initialData.columns.flatMap((c) => c.deals),
    [initialData],
  );
  const [deals, applyMove] = useOptimistic(baseDeals, applyMoveReducer);

  const [filter, setFilter] = useState<QuickFilter>("tous");
  const [query, setQuery] = useState("");
  const [mobileStage, setMobileStage] = useState<DealStage>("DECOUVERTE");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [openedDealId, setOpenedDealId] = useState<string | null>(null);
  const [lostTarget, setLostTarget] = useState<PipelineDeal | null>(null);

  const nowMs = Date.parse(nowIso);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Un clic ouvre LE MÊME écran que la création : le wizard de contrat (la
   * page /modifier redirige vers le détail si le contrat est déjà signé/payé).
   * Repli sur le panneau de détail si pas de contrat lié.
   */
  const openDeal = (deal: PipelineDeal) => {
    if (deal.contract) {
      router.push(`/contrats/${deal.contract.id}/modifier`);
    } else {
      setOpenedDealId(deal.id);
    }
  };

  const commitMove = (deal: PipelineDeal, stage: DealStage, raisonPerte?: string) => {
    startTransition(async () => {
      applyMove({ dealId: deal.id, stage, at: new Date(nowMs), raisonPerte });
      let res: DealActionResult;
      try {
        res = await moveDealStage({ dealId: deal.id, newStage: stage, raisonPerte });
      } catch {
        res = { ok: false, error: "Échec du déplacement." };
      }
      if (!res.ok) {
        toast.error(res.error ?? "Échec du déplacement.");
        // Retour à l'état serveur
        router.refresh();
        return;
      }
      if (stage === "SIGNE") {
        const xp = signXp(deal);
        const first = firstNameOf(deal.assigneA.name);
        celebrate({
          eyebrow: `Bravo ${first}`,
          title: "Deal gagné !",
          subtitle: `${deal.prospect.raisonSociale} passe en Signé`,
          xp,
        });
        xpToast(
          xp,
          "Deal signé !",
          deal.assigneA.id === currentUserId
            ? "XP crédités à la signature du contrat"
            : `Pour ${first} · XP crédités à la signature du contrat`,
        );
      } else {
        toast.success(`Déplacé vers « ${STAGE_META[stage].label} »`);
      }
      router.refresh();
    });
  };

  const requestMove = (deal: PipelineDeal, stage: DealStage) => {
    if (deal.stage === stage) return;
    if (stage === "PERDU") {
      setLostTarget(deal);
      return;
    }
    commitMove(deal, stage);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const deal = deals.find((d) => d.id === String(active.id));
    if (!deal) return;
    // Zone de dépôt : la colonne, ou la carte sur laquelle on a lâché.
    const overId = String(over.id);
    const target = (ALL_STAGES as string[]).includes(overId)
      ? (overId as DealStage)
      : deals.find((d) => d.id === overId)?.stage;
    if (!target || target === deal.stage) return;
    requestMove(deal, target);
  };

  // -------------------------------------------------------------------------
  // Données dérivées
  // -------------------------------------------------------------------------

  const q = query.trim().toLowerCase();
  const matchQuery = (d: PipelineDeal) =>
    !q ||
    [
      d.prospect.raisonSociale,
      d.titre,
      d.prospect.ville ?? "",
      ...d.products.map((p) => p.nom),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  const matchFilter = (d: PipelineDeal) =>
    filter === "tous" ||
    (filter === "chauds" ? isHot(d, nowMs) : isDormant(d, nowMs));

  const active = deals.filter((d) => isActiveStage(d.stage));
  const sumOf = (list: PipelineDeal[]) => list.reduce((s, d) => s + d.montant, 0);
  const pondOf = (list: PipelineDeal[]) =>
    list.reduce((s, d) => s + (d.montant * d.probabilite) / 100, 0);
  const ofStage = (s: DealStage) => deals.filter((d) => d.stage === s);

  const hotCount = active.filter((d) => isHot(d, nowMs)).length;
  const dormant = active.filter((d) => isDormant(d, nowMs));
  const signedColumn = ofStage("SIGNE");
  const lostAll = ofStage("PERDU");

  // Deals signés pas encore validés : un contrat déjà exécutoire (ex. créé
  // ACTIF à la main) est déjà compté dans le CA signé du héros.
  const pendingSigned = signedColumn.filter((d) => !d.contract?.executed);

  const candidates = (s: DealStage, includeDormant = false) =>
    active
      .filter((d) => d.stage === s && (includeDormant || !isDormant(d, nowMs)))
      .sort((a, b) => b.montant - a.montant);
  // Le plus gros deal suivi de Négociation, sinon de Proposition ; à défaut,
  // le plus gros deal endormi de ces étapes (à réveiller). Le bloc « Plus rien
  // en négociation » ne s'affiche donc que s'il n'y a vraiment rien.
  const dealDuJour =
    candidates("NEGOCIATION")[0] ??
    candidates("PROPOSITION")[0] ??
    candidates("NEGOCIATION", true)[0] ??
    candidates("PROPOSITION", true)[0] ??
    null;

  const activeDeal = activeDragId ? deals.find((d) => d.id === activeDragId) ?? null : null;

  const quickFilters: { id: QuickFilter; label: string; count: number; countClass: string }[] = [
    { id: "tous", label: "Tous les deals", count: active.length, countClass: "bg-navy-50 text-foreground" },
    { id: "chauds", label: "Deals chauds", count: hotCount, countClass: "bg-coral-50 text-coral-600" },
    { id: "relancer", label: "À relancer (plus de 7 j)", count: dormant.length, countClass: "bg-alert-50 text-alert-700" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PipelineHero
        view={view}
        scoreboard={scoreboard}
        pendingSignedValue={sumOf(pendingSigned)}
        dealDuJour={dealDuJour}
        nowMs={nowMs}
        monthLabel={monthLabel}
        resetLabel={resetLabel}
        daysToReset={daysToReset}
        isAdmin={isAdmin}
        onOpenDeal={openDeal}
        onAdvanceDeal={(d) => requestMove(d, "NEGOCIATION")}
      />

      <PipelineKpis
        activeCount={active.length}
        total={sumOf(active)}
        pondere={pondOf(active)}
        repartition={{
          decouverte: sumOf(ofStage("DECOUVERTE")),
          proposition: sumOf(ofStage("PROPOSITION")),
          negociation: sumOf(ofStage("NEGOCIATION")),
        }}
        dealsSignes={scoreboard.dealsSignes}
        dealsPerdus={scoreboard.dealsPerdus}
        monthLabel={monthLabel}
        dormantCount={dormant.length}
        dormantValue={sumOf(dormant)}
        relancerActive={filter === "relancer"}
        onToggleRelancer={() => setFilter((f) => (f === "relancer" ? "tous" : "relancer"))}
      />

      {/* Filtres */}
      <section
        aria-label="Filtres du pipeline"
        className="flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5 shadow-arena"
      >
        {viewSwitcher}
        <div role="group" aria-label="Filtres rapides" className="flex flex-wrap gap-2">
          {quickFilters.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-bold transition-colors",
                  on
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                )}
              >
                {f.id === "chauds" && (
                  <Flame aria-hidden="true" className={cn("size-3.5", on ? "text-coral-400" : "text-coral-600")} />
                )}
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums",
                    on ? "bg-card text-foreground" : f.countClass,
                  )}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative min-w-0 flex-[1_1_220px]">
          <label htmlFor="filtre-deals" className="sr-only">
            Filtrer les deals par entreprise, titre, offre ou ville
          </label>
          <Filter
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="filtre-deals"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer : entreprise, offre, ville..."
            className="h-9 w-full rounded-[12px] border border-border bg-ground pr-3 pl-9 text-base text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-[13px]"
          />
        </div>
        <p className="flex basis-full flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-xs font-semibold text-muted-foreground">
          <span className="font-extrabold text-foreground">Barème pipeline</span>
          <span>
            Proposition envoyée <span className="font-extrabold text-gold-700">+{XP_RULES.proposition} XP</span>
          </span>
          <span>
            RDV effectué <span className="font-extrabold text-gold-700">+{XP_RULES.rdvEffectue} XP</span>
          </span>
          <span>
            Contrat signé <span className="font-extrabold text-gold-700">+{XP_RULES.signature} XP</span> (+1 XP
            par 10 CHF mensuels)
          </span>
          <span>
            Mission du jour <span className="font-extrabold text-gold-700">+{XP_RULES.missionDuJour} XP</span>
          </span>
          <span className="lg:ml-auto">
            Glisse une carte ou clique sur « Avancer » · la probabilité suit l&apos;étape · alerte
            rouge après 7 jours sans action
          </span>
        </p>
      </section>

      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        {/* Onglets d'étape sur téléphone */}
        <div
          role="group"
          aria-label="Étape affichée"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden"
        >
          {BOARD_STAGES.map((s) => {
            const on = mobileStage === s;
            const Icon = STAGE_META[s].icon;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setMobileStage(s)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold",
                  on
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-border-strong bg-card text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {STAGE_META[s].label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums",
                    on ? "bg-card text-foreground" : "bg-navy-50 text-foreground",
                  )}
                >
                  {ofStage(s).length}
                </span>
              </button>
            );
          })}
        </div>

        <section
          aria-label="Kanban des deals"
          className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]"
        >
          {BOARD_STAGES.map((s) => {
            const all = ofStage(s);
            const visible = all.filter(
              (d) => matchQuery(d) && (s === "SIGNE" || matchFilter(d)),
            );
            return (
              <PipelineColumn
                key={s}
                stage={s}
                deals={visible}
                totalCount={all.length}
                totalMontant={sumOf(all)}
                totalPondere={pondOf(all)}
                nowMs={nowMs}
                monthLabel={monthLabel}
                resetLabel={resetLabel}
                hiddenOnMobile={s !== mobileStage}
                onOpen={openDeal}
                onMove={requestMove}
              />
            );
          })}
        </section>

        <PipelineLessons
          deals={lostAll.filter(matchQuery)}
          allLost={lostAll}
          nowMs={nowMs}
          onOpen={openDeal}
          onMove={requestMove}
        />

        <DragOverlay>
          {activeDeal && (
            <DealCardView
              deal={activeDeal}
              nowMs={nowMs}
              variant={activeDeal.stage === "PERDU" ? "lost" : "board"}
              overlay
              onOpen={noop}
              onMove={noop}
            />
          )}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        deal={lostTarget}
        onCancel={() => setLostTarget(null)}
        onConfirm={(deal, raison) => {
          setLostTarget(null);
          commitMove(deal, "PERDU", raison);
        }}
      />

      <DealDetailSheet
        dealId={openedDealId}
        onClose={() => setOpenedDealId(null)}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  );
}
