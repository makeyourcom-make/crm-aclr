"use client";

/**
 * Planning de production (MYC Arena).
 *
 *  - Héros : production du mois, charge par jour, livraison à l'heure.
 *  - Vue MOIS : charge sur 12 mois glissants, sections dynamiques par urgence,
 *    une ligne par client (ou la grille 12 mois client × mois, dépliable en
 *    semaines).
 *  - Vue SEMAINE : du lundi au vendredi, avec la charge de chaque jour.
 *  - Vue JOUR : mission du jour + retards.
 *
 * Un clic sur le rond valide la tâche (vert, optimiste) ; un clic sur le
 * libellé ouvre le détail. Une tâche non faite d'un mois passé est REPORTÉE
 * sur le mois courant (rouge) ; au-delà d'un mois de retard elle devient un
 * « boss » (rouge foncé). Quand toutes les tâches du jour sont faites :
 * petite célébration.
 */
import { ChevronLeft, ChevronRight, FolderKanban, Plus, Search, Trophy, Waves, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { reequilibrer, setTacheStatut } from "@/app/(app)/dossiers/planning/actions";
import { celebrate } from "@/components/arena/celebrate";
import { EmptyState } from "@/components/arena/empty-state";
import { AddLigneDialog } from "@/components/planning/add-ligne-dialog";
import { DayView } from "@/components/planning/day-view";
import { LigneDialog } from "@/components/planning/ligne-dialog";
import { MonthView, matchStatut } from "@/components/planning/month-view";
import { PlanningHero } from "@/components/planning/planning-hero";
import { computeProduction, type PoolTache } from "@/components/planning/production";
import {
  PLACEHOLDERS,
  VISUEL_STYLE,
  addDaysStr,
  addMonthsStr,
  ddmm,
  dayLong,
  etatProd,
  monthLabel,
  monthOf,
  serviceLabelOf,
  serviceStyle,
  type StatutFiltre,
  type Statut,
} from "@/components/planning/shared";
import { TaskDialog } from "@/components/planning/task-dialog";
import { WeekView } from "@/components/planning/week-view";
import { Button } from "@/components/ui/button";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import type { ProductionData } from "@/lib/queries/dossiers-production";
import { cn } from "@/lib/utils";

type Vue = "mois" | "semaine" | "jour";

const STATUT_FILTRES: { id: StatutFiltre; label: string }[] = [
  { id: "tous", label: "Tout" },
  { id: "retard", label: "Retards" },
  { id: "attente", label: "Attente client" },
  { id: "quick", label: "Quick wins ≤ 15 min" },
];

export function PlanningBoard({
  vue,
  from,
  today,
  ownerId,
  ownerQuery,
  ownerFirstName,
  isSelf,
  lignes,
  taches,
  production,
}: {
  vue: Vue;
  from: string;
  today: string;
  ownerId: string;
  ownerQuery: string;
  ownerFirstName: string;
  /** Planning de l'utilisateur connecté (tutoiement) ou d'un·e collaborateur·rice (admin). */
  isSelf: boolean;
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
  production: ProductionData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [recalcPending, startRecalc] = useTransition();
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Set<string>>(new Set());
  const [statutFiltre, setStatutFiltre] = useState<StatutFiltre>("tous");
  /**
   * Statuts optimistes (coche, dialogue). Un statut optimiste ne s'applique que
   * tant que le serveur renvoie encore le statut d'origine (`from`) : dès que la
   * donnée serveur a bougé (confirmation, abandon, suppression...), elle
   * reprend la main. Sinon une tâche abandonnée après une coche resterait
   * affichée avec son ancien statut optimiste.
   */
  const [override, setOverride] = useState<Record<string, { from: Statut; to: Statut }>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openLigne, setOpenLigne] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<null | { client?: { id: string; nom: string }; deja?: string[] }>(null);
  const [lisserOpen, setLisserOpen] = useState(false);
  /** Statut d'avant la coche (pour « remettre » une tâche en cours / en attente). */
  const prevStatut = useRef<Record<string, Statut>>({});

  const all = useMemo(
    () =>
      taches.map((t) => {
        const o = override[t.id];
        return o && o.from === t.statut ? { ...t, statut: o.to } : t;
      }),
    [taches, override],
  );
  const ligneById = useMemo(() => new Map(lignes.map((l) => [l.id, l])), [lignes]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lignes.filter(
      (l) => (!q || l.client.toLowerCase().includes(q)) && (filtre.size === 0 || filtre.has(l.service)),
    );
  }, [lignes, search, filtre]);
  const visibleIds = useMemo(() => new Set(visibles.map((l) => l.id)), [visibles]);
  const tachesVisibles = useMemo(
    () => all.filter((t) => visibleIds.has(t.ligneId) && t.statut !== "ABANDONNEE"),
    [all, visibleIds],
  );
  const tachesFiltrees = useMemo(
    () => tachesVisibles.filter((t) => matchStatut(t, statutFiltre, today)),
    [tachesVisibles, statutFiltre, today],
  );

  const servicesPresents = useMemo(
    () => [...new Set(lignes.map((l) => l.service))].filter((s) => !PLACEHOLDERS.has(s)),
    [lignes],
  );

  // Pool du héros : mois + semaine en cours + tous les retards, coches optimistes appliquées.
  const pool = useMemo(() => {
    const m = new Map<string, PoolTache>();
    for (const t of all) {
      m.set(t.id, { id: t.id, ligneId: t.ligneId, date: t.date, dureeMin: t.dureeMin, statut: t.statut, titre: t.titre, code: t.code });
    }
    for (const p of production.taches) {
      const o = override[p.id];
      const statut = o && o.from === p.statut ? o.to : p.statut;
      const faitLe = statut === "FAIT" ? (p.statut === "FAIT" ? p.faitLe : today) : null;
      const base = m.get(p.id);
      m.set(p.id, { ...p, statut, faitLe, titre: base?.titre, code: base?.code });
    }
    return [...m.values()];
  }, [all, production.taches, override, today]);

  const stats = useMemo(
    () =>
      computeProduction(pool, {
        today,
        mois: production.moisCourant,
        semaineDebut: production.semaineDebut,
        ligneById,
      }),
    [pool, today, production.moisCourant, production.semaineDebut, ligneById],
  );

  const compteurs = useMemo(
    () => ({
      retard: tachesVisibles.filter((t) => etatProd(t, today) !== "ok").length,
      attente: tachesVisibles.filter((t) => t.statut === "ATTENTE_CLIENT").length,
      quick: tachesVisibles.filter((t) => matchStatut(t, "quick", today)).length,
    }),
    [tachesVisibles, today],
  );

  /** Cette coche termine-t-elle la dernière tâche du jour ? (célébration) */
  const bouclerait = (id: string, next: Statut) => {
    if (next !== "FAIT") return false;
    const duJour = pool.filter((t) => t.date === today && t.statut !== "ABANDONNEE");
    if (duJour.length === 0) return false;
    const avant = duJour.every((t) => t.statut === "FAIT");
    const apres = duJour.every((t) => (t.id === id ? next : t.statut) === "FAIT");
    return !avant && apres;
  };

  const setStatut = (t: PlanningTacheDTO, next: Statut) => {
    const prev = t.statut;
    if (prev === next) return;
    if (next === "FAIT") prevStatut.current[t.id] = prev;
    // Statut côté serveur (sans l'optimiste) : l'optimiste ne vaut que tant qu'il n'a pas bougé.
    const serveur = taches.find((x) => x.id === t.id)?.statut ?? prev;
    const entry = { from: serveur, to: next };
    setOverride((o) => ({ ...o, [t.id]: entry }));
    setFlash(t.id);
    const boss = next === "FAIT" && etatProd(t, today) === "critique";
    const mission = bouclerait(t.id, next);
    startTransition(async () => {
      const res = await setTacheStatut(t.id, next);
      if (!res.ok) {
        // Retour au statut serveur, sauf si une action plus récente a déjà pris le relais.
        setOverride((o) => {
          if (o[t.id] !== entry) return o;
          const n = { ...o };
          delete n[t.id];
          return n;
        });
        toast.error(res.error ?? "Échec.");
        return;
      }
      if (mission) {
        celebrate({ pieces: 48 });
        missionToast(isSelf);
      }
      if (boss) toast.success("Boss abattu !", { description: `${t.titre} · ${ligneById.get(t.ligneId)?.client ?? ""}` });
      router.refresh();
    });
  };

  const toggleDone = (t: PlanningTacheDTO) => {
    if (t.statut !== "FAIT") {
      setStatut(t, "FAIT");
      return;
    }
    const back = prevStatut.current[t.id];
    setStatut(t, back && back !== "FAIT" && back !== "ABANDONNEE" ? back : "A_FAIRE");
  };

  const lisser = () => {
    startRecalc(async () => {
      const res = await reequilibrer(ownerId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setLisserOpen(false);
      toast.success(`Étalement recalculé : ${res.deplacees ?? 0} tâche${(res.deplacees ?? 0) > 1 ? "s" : ""} replacée${(res.deplacees ?? 0) > 1 ? "s" : ""}.`);
      router.refresh();
    });
  };

  const appliquerFiltre = (f: StatutFiltre) => {
    setStatutFiltre(f);
    document.getElementById("planning-travail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const resetFiltres = () => {
    setSearch("");
    setFiltre(new Set());
    setStatutFiltre("tous");
  };

  /** Une partie des tâches est masquée (statut, service ou recherche). */
  const filtreActif = statutFiltre !== "tous" || !!search.trim() || filtre.size > 0;

  const tacheOuverte = openTask ? all.find((t) => t.id === openTask) : null;
  const ligneOuverte = openLigne ? ligneById.get(openLigne) : null;
  const href = (v: Vue, debut?: string) =>
    `/dossiers/planning?vue=${v}${debut ? `&debut=${debut}` : ""}${ownerQuery}`;

  const periode =
    vue === "mois"
      ? `${monthLabel(monthOf(from))} → ${monthLabel(monthOf(addMonthsStr(from, 11)))}`
      : vue === "semaine"
        ? `Semaine du ${ddmm(from)} au ${ddmm(addDaysStr(from, 4))}`
        : `${dayLong(today)}.${today.slice(0, 4)}`;

  return (
    <div className="flex flex-col gap-6">
      {lignes.length > 0 && (
        <PlanningHero
          stats={stats}
          today={today}
          historique={production.historique}
          record={production.record}
          isSelf={isSelf}
          ownerFirstName={ownerFirstName}
          clientOf={(id) => ligneById.get(id)?.client ?? ""}
          hrefJour={href("jour")}
          hrefSemaine={href("semaine")}
          onLisser={() => setLisserOpen(true)}
          lisserPending={recalcPending}
          onFiltre={appliquerFiltre}
        />
      )}

      {lisserOpen && (
        <section
          ref={revelerRef}
          aria-label="Lisser la charge"
          className="flex flex-wrap items-center gap-5 rounded-[20px] border border-[#D9CEFF] bg-card px-5 py-5 shadow-arena motion-safe:animate-rise sm:px-6"
        >
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="flex items-center gap-2 font-display text-xl font-extrabold">
              <Waves aria-hidden="true" className="size-5 text-lvl-700" />
              Lisser {isSelf ? "ma" : "la"} charge
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Les tâches à venir non commencées sont replacées sur les jours les moins chargés. Les dates fixes
              (calendrier le 15, contenu client le 25) ne bougent pas. Attention : les dates modifiées à la main sur
              ces tâches seront recalculées.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="outline" size="lg" onClick={() => setLisserOpen(false)} disabled={recalcPending}>
              Annuler
            </Button>
            <Button size="lg" onClick={lisser} disabled={recalcPending}>
              {recalcPending ? "Calcul..." : "Lisser maintenant"}
            </Button>
          </div>
        </section>
      )}

      {/* Zone de travail */}
      <section
        id="planning-travail"
        aria-label="Planning de production"
        className="flex min-w-0 scroll-mt-4 flex-col gap-[18px] rounded-[20px] border border-border bg-card px-3.5 pt-5 pb-6 shadow-arena sm:px-6"
      >
        {/* Barre d'outils */}
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Vue" className="flex gap-1 rounded-[14px] bg-ground p-1">
            {(
              [
                ["mois", "Mois"],
                ["semaine", "Semaine"],
                ["jour", "Jour"],
              ] as const
            ).map(([v, label]) => (
              <Link
                key={v}
                href={href(v)}
                aria-current={vue === v ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-[10px] px-4 text-sm font-bold transition-colors",
                  vue === v
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgba(14,25,54,0.14)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-1.5">
            {vue !== "jour" && (
              <>
                <Link
                  href={href(vue, vue === "mois" ? monthOf(addMonthsStr(from, -1)) : addDaysStr(from, -7))}
                  aria-label={vue === "mois" ? "Mois précédent" : "Semaine précédente"}
                  className="inline-flex size-9 items-center justify-center rounded-[12px] border border-border-strong bg-card hover:bg-navy-50"
                >
                  <ChevronLeft aria-hidden="true" className="size-[18px]" />
                </Link>
                <Link
                  href={href(vue, vue === "mois" ? monthOf(addMonthsStr(from, 1)) : addDaysStr(from, 7))}
                  aria-label={vue === "mois" ? "Mois suivant" : "Semaine suivante"}
                  className="inline-flex size-9 items-center justify-center rounded-[12px] border border-border-strong bg-card hover:bg-navy-50"
                >
                  <ChevronRight aria-hidden="true" className="size-[18px]" />
                </Link>
                <Link
                  href={href(vue)}
                  className="inline-flex h-9 items-center rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold hover:bg-navy-50"
                >
                  {vue === "mois" ? "Mois en cours" : "Cette semaine"}
                </Link>
              </>
            )}
            <span className="pl-1.5 text-sm font-bold">{periode}</span>
          </div>

          <div className="flex flex-[1_1_220px] flex-wrap items-center justify-end gap-2.5">
            <div className="relative flex min-w-0 flex-[1_1_180px] items-center sm:flex-[0_1_240px]">
              <label htmlFor="planning-filtre-client" className="sr-only">
                Filtrer un client
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
              />
              <input
                id="planning-filtre-client"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer un client..."
                className="h-10 w-full rounded-[12px] border border-border-strong bg-card pr-3 pl-9 text-sm"
              />
            </div>
            <Button onClick={() => setAddFor({})} className="h-10">
              <Plus aria-hidden="true" strokeWidth={2.4} />
              Client / service
            </Button>
          </div>
        </div>

        {/* Filtres : services (multi) et statut */}
        {lignes.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-[14px] bg-ground px-3.5 py-3">
            {servicesPresents.length > 0 && (
              <div role="group" aria-label="Filtrer par service" className="flex flex-wrap items-center gap-2">
                <span className="mr-0.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  Services
                </span>
                {servicesPresents.map((s) => {
                  const st = serviceStyle(s);
                  const on = filtre.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFiltre((f) => {
                          const n = new Set(f);
                          if (n.has(s)) n.delete(s);
                          else n.add(s);
                          return n;
                        })
                      }
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                        on ? cn(st.pill, "border-current") : "border-border bg-card text-foreground hover:border-border-strong",
                      )}
                    >
                      <span aria-hidden="true" className={cn("size-2 rounded-full", st.dot)} />
                      {serviceLabelOf(s)}
                    </button>
                  );
                })}
              </div>
            )}
            <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap items-center gap-2">
              <span className="mr-0.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Afficher
              </span>
              {STATUT_FILTRES.map((f) => {
                const on = statutFiltre === f.id;
                const n = f.id === "tous" ? null : compteurs[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatutFiltre(f.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                      on ? "border-navy-700 bg-navy-700 text-white" : "border-border bg-card text-foreground hover:border-border-strong",
                    )}
                  >
                    {f.label}
                    {n !== null && <span className="tabular-nums opacity-85">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {lignes.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            tone="violet"
            title="Aucun client dans ce planning pour l'instant."
            description={
              isSelf
                ? "Dès qu'un de tes contrats passe actif avec un service à livrer, sa ligne apparaît ici automatiquement."
                : `Dès qu'un contrat de ${ownerFirstName} passe actif avec un service à livrer, sa ligne apparaît ici automatiquement.`
            }
            action={
              <Button size="lg" onClick={() => setAddFor({})}>
                Ajouter un client / service
              </Button>
            }
          />
        ) : vue === "mois" ? (
          <MonthView
            from={from}
            today={today}
            lignes={visibles}
            taches={tachesVisibles}
            statutFiltre={statutFiltre}
            filtresActifs={!!search.trim() || filtre.size > 0}
            flash={flash}
            onToggle={toggleDone}
            onOpenTask={setOpenTask}
            onOpenLigne={setOpenLigne}
            onAdd={(c, deja) => setAddFor({ client: c, deja })}
            onResetFiltres={resetFiltres}
          />
        ) : vue === "semaine" ? (
          <WeekView
            from={from}
            today={today}
            taches={tachesFiltrees}
            ligneById={ligneById}
            flash={flash}
            filtre={filtreActif}
            onToggle={toggleDone}
            onOpenTask={setOpenTask}
          />
        ) : (
          <DayView
            today={today}
            taches={tachesFiltrees}
            jour={stats.jour}
            ligneById={ligneById}
            flash={flash}
            isSelf={isSelf}
            filtre={filtreActif}
            onToggle={toggleDone}
            onOpenTask={setOpenTask}
          />
        )}

        {/* Légende des statuts (non cliquable) */}
        {lignes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-navy-50 pt-3.5">
            <span className="mr-1 text-xs font-bold text-muted-foreground">Légende</span>
            {(["afaire", "encours", "attente", "fait", "retard", "boss"] as const).map((v) => (
              <span
                key={v}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", VISUEL_STYLE[v].pill)}
              >
                {v === "retard" ? "En retard (reportée)" : v === "attente" ? "Attente client (hors retard)" : VISUEL_STYLE[v].label}
              </span>
            ))}
            <span className="text-xs text-muted-foreground sm:ml-auto">
              Rond = valider en 1 clic · libellé = détail de la tâche
            </span>
          </div>
        )}
      </section>

      {tacheOuverte && (
        <TaskDialog
          key={tacheOuverte.id}
          tache={tacheOuverte}
          ligne={ligneById.get(tacheOuverte.ligneId)}
          client={ligneById.get(tacheOuverte.ligneId)?.client ?? ""}
          service={serviceLabel(ligneById.get(tacheOuverte.ligneId))}
          today={today}
          onStatut={setStatut}
          onClose={() => setOpenTask(null)}
        />
      )}
      {ligneOuverte && (
        <LigneDialog
          key={ligneOuverte.id}
          ligne={ligneOuverte}
          today={today}
          servicesClient={lignes.filter((l) => l.prospectId === ligneOuverte.prospectId).map((l) => l.service)}
          onClose={() => setOpenLigne(null)}
        />
      )}
      {addFor && (
        <AddLigneDialog ownerId={ownerId} client={addFor.client} dejaPresents={addFor.deja} onClose={() => setAddFor(null)} />
      )}
    </div>
  );
}

/** Ref stable : fait défiler jusqu'au panneau à son ouverture. */
function revelerRef(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function serviceLabel(l?: PlanningLigneDTO): string {
  if (!l) return "";
  return l.libelle ?? serviceLabelOf(l.service);
}

/** Toast navy « Mission du jour pliée ! » (sans XP : le planning n'en rapporte pas). */
function missionToast(isSelf: boolean) {
  toast.custom(
    (id) => (
      <div className="flex w-full items-center gap-3 rounded-[14px] bg-navy-700 py-3 pr-2 pl-3 text-white shadow-arena-lg sm:w-[356px]">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-navy-600 text-gold-500"
        >
          <Trophy className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-extrabold">Mission du jour pliée !</span>
          <span className="text-xs text-navy-300">
            {isSelf ? "Toutes tes tâches du jour sont livrées. Machine de guerre." : "Toutes les tâches du jour sont livrées."}
          </span>
        </span>
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          aria-label="Fermer"
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-navy-300 transition-colors hover:bg-navy-600 hover:text-white"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    ),
    { duration: 4000 },
  );
}
