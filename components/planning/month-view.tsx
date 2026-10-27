"use client";

/**
 * Vue MOIS du planning (MYC Arena).
 *
 *  - Bandeau « charge sur 12 mois glissants » : un mois par case, cliquable
 *    pour afficher ses tâches ; couleur selon la charge vs la capacité.
 *  - En-tête du mois affiché : semaines S1 · 1-7 … S4 · 22-fin (cliquables
 *    pour ne montrer qu'une semaine).
 *  - Sections dynamiques (inchangées) : « À traiter » (retards et tâches de
 *    cette semaine) en haut, « À venir », « Rien de prévu sur la période »,
 *    « Services à préciser ». Une ligne par client : météo, services
 *    (réglages des récurrences), tâches du mois, progression.
 *  - Bascule « Grille 12 mois » : l'ancien tableau client × mois (dépliable en
 *    semaines) reste disponible.
 *
 * Une tâche non faite d'un mois passé est REPORTÉE sur le mois courant.
 */
import { Clock, Cloud, CloudLightning, FolderKanban, Plus, Settings, Star, Sun } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/arena/empty-state";
import { MonthGrid } from "@/components/planning/month-grid";
import {
  CAPACITE_JOUR_MIN,
  PLACEHOLDERS,
  addDaysStr,
  addMonthsStr,
  ddmm,
  etatProd,
  etatTache,
  fmtDuree,
  monthLabel,
  monthLong,
  monthOf,
  serviceLabelOf,
  serviceStyle,
  visuelTache,
  weekOfMonthStr,
  type StatutFiltre,
} from "@/components/planning/shared";
import { TaskPill } from "@/components/planning/task-items";
import { Button } from "@/components/ui/button";
import { isWorkingDay } from "@/lib/planning/dates";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { libelleCourt } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";


type Semaine = 1 | 2 | 3 | 4;
const SEMAINES: readonly Semaine[] = [1, 2, 3, 4];
const SEMAINE_LABEL: Record<Semaine, string> = { 1: "S1 · 1-7", 2: "S2 · 8-14", 3: "S3 · 15-21", 4: "S4 · 22-fin" };

/** Capacité d'un mois : jours ouvrés (hors week-ends et fériés VS) × 6 h. */
function capaciteMois(ym: string): number {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= dim; d++) if (isWorkingDay(new Date(Date.UTC(y, m - 1, d)))) n++;
  return n * CAPACITE_JOUR_MIN;
}

export function matchStatut(t: PlanningTacheDTO, f: StatutFiltre, today: string): boolean {
  if (f === "retard") return etatProd(t, today) !== "ok";
  if (f === "attente") return t.statut === "ATTENTE_CLIENT";
  if (f === "quick") return t.statut !== "FAIT" && t.statut !== "ATTENTE_CLIENT" && t.dureeMin <= 15;
  return true;
}

export function MonthView({
  from,
  today,
  lignes,
  taches,
  statutFiltre,
  filtresActifs,
  flash,
  onToggle,
  onOpenTask,
  onOpenLigne,
  onAdd,
  onResetFiltres,
}: {
  from: string;
  today: string;
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
  statutFiltre: StatutFiltre;
  /** Recherche ou filtre de service actifs (niveau planning). */
  filtresActifs: boolean;
  flash: string | null;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
  onOpenLigne: (id: string) => void;
  onAdd: (c: { id: string; nom: string }, deja: string[]) => void;
  onResetFiltres: () => void;
}) {
  const [mode, setMode] = useState<"liste" | "grille">("liste");
  const [focusSel, setFocusSel] = useState<string | null>(null);
  const [semaineSel, setSemaineSel] = useState<Semaine | null>(null);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthOf(addMonthsStr(from, i))), [from]);
  const curMonth = monthOf(today);
  const curWeek = weekOfMonthStr(today);
  const focus = focusSel && months.includes(focusSel) ? focusSel : months.includes(curMonth) ? curMonth : months[0]!;

  // Une tâche en retard d'un mois passé s'affiche (reportée) sur le mois courant.
  const placeOf = useCallback(
    (t: PlanningTacheDTO): { m: string; w: Semaine } => {
      const late = etatTache(t, today) !== "ok";
      if (late && monthOf(t.date) !== curMonth) return { m: curMonth, w: curWeek };
      return { m: monthOf(t.date), w: weekOfMonthStr(t.date) };
    },
    [today, curMonth, curWeek],
  );

  // Charge par mois (à faire / total / fait).
  const parMois = useMemo(() => {
    const map = new Map<string, { reste: number; total: number; fait: number; n: number; nFait: number }>();
    for (const t of taches) {
      const p = placeOf(t);
      const acc = map.get(p.m) ?? { reste: 0, total: 0, fait: 0, n: 0, nFait: 0 };
      acc.total += t.dureeMin;
      acc.n++;
      if (t.statut === "FAIT") {
        acc.fait += t.dureeMin;
        acc.nFait++;
      } else acc.reste += t.dureeMin;
      map.set(p.m, acc);
    }
    return map;
  }, [taches, placeOf]);

  // Sections DYNAMIQUES : les clients qui ont quelque chose à faire maintenant
  // (retards, puis cette semaine) en haut ; une fois leurs tâches faites, ils
  // descendent, et remontent quand leur prochaine semaine arrive.
  const sections = useMemo(() => {
    const focusDay = from > today ? from : today;
    const dow = new Date(`${focusDay}T00:00:00Z`).getUTCDay() || 7;
    const finSemaine = addDaysStr(focusDay, 7 - dow);

    type Score = { critiques: number; retards: number; attentes: number; prochaine: string | null };
    const scoreLigne = new Map<string, Score>();
    for (const l of lignes) scoreLigne.set(l.id, { critiques: 0, retards: 0, attentes: 0, prochaine: null });
    for (const t of taches) {
      if (t.statut === "FAIT") continue;
      const sc = scoreLigne.get(t.ligneId);
      if (!sc) continue;
      const e = etatProd(t, today);
      if (e === "critique") sc.critiques++;
      else if (e === "retard") sc.retards++;
      else if (t.statut === "ATTENTE_CLIENT" && t.date < focusDay) sc.attentes++;
      else if (t.date >= focusDay && (!sc.prochaine || t.date < sc.prochaine)) sc.prochaine = t.date;
    }
    const cmp = (a: Score, b: Score) =>
      b.critiques - a.critiques ||
      b.retards - a.retards ||
      (a.prochaine ?? "9999").localeCompare(b.prochaine ?? "9999") ||
      b.attentes - a.attentes;

    const g = new Map<string, PlanningLigneDTO[]>();
    for (const l of lignes) g.set(l.prospectId, [...(g.get(l.prospectId) ?? []), l]);
    const groupes = [...g.values()].map((ls) => {
      const tries = [...ls].sort((a, b) => cmp(scoreLigne.get(a.id)!, scoreLigne.get(b.id)!));
      const sc = tries
        .map((l) => scoreLigne.get(l.id)!)
        .reduce(
          (acc, x) => ({
            critiques: acc.critiques + x.critiques,
            retards: acc.retards + x.retards,
            attentes: acc.attentes + x.attentes,
            prochaine:
              !acc.prochaine || (x.prochaine && x.prochaine < acc.prochaine) ? (x.prochaine ?? acc.prochaine) : acc.prochaine,
          }),
          { critiques: 0, retards: 0, attentes: 0, prochaine: null } as Score,
        );
      const aPreciser = ls.every((l) => PLACEHOLDERS.has(l.service));
      const section: 0 | 1 | 2 | 3 = aPreciser
        ? 3
        : sc.critiques + sc.retards + sc.attentes > 0 || (sc.prochaine !== null && sc.prochaine <= finSemaine)
          ? 0
          : sc.prochaine
            ? 1
            : 2;
      return { ls: tries, sc, section, nom: ls[0]!.client };
    });
    groupes.sort((a, b) => a.section - b.section || cmp(a.sc, b.sc) || a.nom.localeCompare(b.nom, "fr"));
    return ([0, 1, 2, 3] as const)
      .map((i) => ({ id: i, groupes: groupes.filter((x) => x.section === i) }))
      .filter((x) => x.groupes.length > 0);
  }, [lignes, taches, today, from]);

  const tachesParLigne = useMemo(() => {
    const map = new Map<string, PlanningTacheDTO[]>();
    for (const t of taches) map.set(t.ligneId, [...(map.get(t.ligneId) ?? []), t]);
    return map;
  }, [taches]);

  // Semaines du mois affiché.
  const semaines = SEMAINES.map((w) => {
    const list = taches.filter((t) => {
      const p = placeOf(t);
      return p.m === focus && p.w === w;
    });
    const fait = list.filter((t) => t.statut === "FAIT").length;
    const retards = list.filter((t) => etatProd(t, today) !== "ok").length;
    const enCours = focus === curMonth && w === curWeek;
    const passe = focus < curMonth || (focus === curMonth && w < curWeek);
    let etat: string;
    let tone: string;
    if (list.length === 0) {
      etat = "libre";
      tone = "bg-navy-50 text-muted-foreground";
    } else if (retards > 0) {
      etat = retards > 1 ? `${retards} retards` : "1 retard";
      tone = "bg-alert-50 text-alert-700";
    } else if (fait === list.length) {
      etat = "bouclée";
      tone = "bg-win-50 text-win-700";
    } else if (enCours) {
      etat = "en cours";
      tone = "bg-lvl-50 text-lvl-700";
    } else {
      etat = passe ? `${fait}/${list.length}` : `${list.length - fait} à faire`;
      tone = "bg-navy-50 text-foreground";
    }
    return { w, etat, tone };
  });

  const filtreTache = (t: PlanningTacheDTO) =>
    matchStatut(t, statutFiltre, today) && (semaineSel === null || placeOf(t).w === semaineSel);
  const filtresLocaux = statutFiltre !== "tous" || semaineSel !== null;

  const capaFocus = capaciteMois(focus);
  const resteFocus = parMois.get(focus)?.reste ?? 0;
  const alerte = months
    .filter((m) => m >= curMonth)
    .map((m) => ({ m, charge: parMois.get(m)?.reste ?? 0, capa: capaciteMois(m) }))
    .find((x) => x.capa > 0 && x.charge / x.capa >= 0.95);

  if (mode === "grille") {
    return (
      <div className="flex flex-col gap-4">
        <ModeSwitch mode={mode} setMode={setMode} />
        <MonthGrid
          from={from}
          today={today}
          lignes={lignes}
          // Le filtre « Afficher » (retards, attente, quick wins) s'applique aussi à la grille.
          taches={statutFiltre === "tous" ? taches : taches.filter((t) => matchStatut(t, statutFiltre, today))}
          sections={sections}
          onToggle={onToggle}
          onOpenTask={onOpenTask}
          onOpenLigne={onOpenLigne}
          onAdd={onAdd}
        />
      </div>
    );
  }

  const rendus = sections
    .filter((s) => !filtresLocaux || s.id <= 1)
    .map((sec) => {
      const rows = sec.groupes
        .map((grp) => {
          const ts = grp.ls.flatMap((l) => tachesParLigne.get(l.id) ?? []);
          const duMois = ts.filter((t) => placeOf(t).m === focus);
          const shown = duMois.filter(filtreTache).sort((a, b) => ordre(a, today) - ordre(b, today) || a.date.localeCompare(b.date));
          return { grp, ts, duMois, shown };
        })
        .filter((r) => !filtresLocaux || r.shown.length > 0);
      return { sec, rows };
    })
    .filter((x) => x.rows.length > 0);

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Charge sur 12 mois glissants */}
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-ground px-3 py-3.5 sm:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-extrabold">
            Charge sur 12 mois glissants{" "}
            <span className="font-semibold text-muted-foreground">· capacité {fmtDuree(CAPACITE_JOUR_MIN)} par jour ouvré</span>
          </p>
          <p className={cn("text-xs font-semibold", alerte ? "text-alert-700" : "text-muted-foreground")}>
            {alerte
              ? `${monthLong(alerte.m).replace(/^./, (c) => c.toUpperCase())} frôle la surcharge : ${fmtDuree(alerte.charge)} pour ${fmtDuree(alerte.capa)} de capacité (fériés déduits).`
              : "Charge sous contrôle sur la période."}
          </p>
        </div>
        <div role="group" aria-label="Mois affiché" className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(68px,1fr))]">
          {months.map((m) => {
            const s = parMois.get(m) ?? { reste: 0, total: 0, fait: 0, n: 0, nFait: 0 };
            const capa = capaciteMois(m);
            const passe = m < curMonth;
            const ratio = capa > 0 ? (passe ? s.total : s.reste) / capa : 0;
            const on = m === focus;
            const bar = on
              ? "bg-lvl-500"
              : passe
                ? "bg-win-500"
                : ratio < 0.75
                  ? "bg-win-500"
                  : ratio < 0.95
                    ? "bg-gold-500"
                    : "bg-alert-500";
            const sous = passe
              ? `${s.n ? Math.round((s.nFait / s.n) * 100) : 0} % livré`
              : `${fmtDuree(s.reste)}${m === curMonth ? " à faire" : ratio >= 0.95 ? " · surcharge" : ratio >= 0.75 ? " · chargé" : ""}`;
            const sousTx = on
              ? "text-lvl-700"
              : passe || ratio < 0.75
                ? "text-win-700"
                : ratio < 0.95
                  ? "text-gold-700"
                  : "text-alert-700";
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFocusSel(m);
                  setSemaineSel(null);
                }}
                className={cn(
                  "flex flex-col items-stretch gap-1 rounded-[12px] border-2 px-1.5 py-2 transition-colors",
                  on ? "border-lvl-500 bg-lvl-50" : "border-card bg-card hover:border-border-strong",
                )}
              >
                <span aria-hidden="true" className="flex h-12 items-end overflow-hidden rounded-[6px] bg-navy-50">
                  <span
                    className={cn("block w-full rounded-t-[6px]", bar)}
                    style={{ height: Math.round(Math.min(1, ratio) * 48) }}
                  />
                </span>
                <span className="text-center text-xs font-extrabold">{monthLabel(m)}</span>
                <span className={cn("text-center text-[11px] leading-tight font-semibold", sousTx)}>{sous}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* En-tête du mois affiché */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="mr-2 font-display text-[22px] font-extrabold tracking-[-0.02em] first-letter:uppercase">
          {monthLong(focus)}
        </h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[13px] font-bold",
            resteFocus / Math.max(capaFocus, 1) >= 0.95 ? "bg-alert-50 text-alert-700" : "bg-lvl-50 text-lvl-700",
          )}
        >
          {fmtDuree(resteFocus)} à faire
        </span>
        <div role="group" aria-label="Filtrer une semaine" className="flex flex-wrap gap-1.5">
          {semaines.map((s) => (
            <button
              key={s.w}
              type="button"
              aria-pressed={semaineSel === s.w}
              onClick={() => setSemaineSel((x) => (x === s.w ? null : s.w))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-inset transition-shadow",
                s.tone,
                semaineSel === s.w ? "ring-2 ring-navy-700" : "hover:ring-1 hover:ring-border-strong",
              )}
            >
              {SEMAINE_LABEL[s.w]} · {s.etat}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <ModeSwitch mode={mode} setMode={setMode} />
        </div>
      </div>

      {rendus.map(({ sec, rows }) => (
        <SectionBlock key={sec.id} id={sec.id} n={rows.length} months={months}>
          {rows.map(({ grp, ts, duMois, shown }) => (
            <ClientRow
              key={grp.ls[0]!.prospectId}
              section={sec.id}
              lignes={grp.ls}
              ts={ts}
              duMois={duMois}
              shown={shown}
              focus={focus}
              today={today}
              flash={flash}
              filtresLocaux={filtresLocaux}
              onToggle={onToggle}
              onOpenTask={onOpenTask}
              onOpenLigne={onOpenLigne}
              onAdd={onAdd}
            />
          ))}
        </SectionBlock>
      ))}

      {rendus.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          tone="violet"
          title="Aucune tâche ne correspond à ces filtres."
          description={filtresLocaux || filtresActifs ? "Élargis les filtres pour retrouver tes clients." : undefined}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSemaineSel(null);
                onResetFiltres();
              }}
            >
              Tout réafficher
            </Button>
          }
        />
      )}
    </div>
  );
}

/** Ordre d'urgence : boss, retards, puis le reste. */
function ordre(t: PlanningTacheDTO, today: string): number {
  const v = visuelTache(t, today);
  return v === "boss" ? 0 : v === "retard" ? 1 : 2;
}

function ModeSwitch({ mode, setMode }: { mode: "liste" | "grille"; setMode: (m: "liste" | "grille") => void }) {
  return (
    <div role="group" aria-label="Affichage du mois" className="inline-flex gap-1 rounded-[12px] bg-ground p-1">
      {(
        [
          ["liste", "Clients"],
          ["grille", "Grille 12 mois"],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "h-8 rounded-[9px] px-3 text-[13px] font-bold transition-colors",
            mode === m ? "bg-card text-foreground shadow-[0_1px_3px_rgba(14,25,54,0.14)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const SECTION_META = {
  0: {
    titre: "À traiter : retards et tâches de cette semaine",
    sous: "Les boss d'abord, puis les retards, puis l'échéance la plus proche.",
    head: "bg-coral-50",
    dot: "bg-coral-400",
    tx: "text-coral-600",
    border: "border-border",
  },
  1: {
    titre: "À venir",
    sous: "Rien d'urgent cette semaine : prochaines échéances plus tard.",
    head: "bg-win-50",
    dot: "bg-win-500",
    tx: "text-win-700",
    border: "border-border",
  },
  2: {
    titre: "Rien de prévu sur la période",
    sous: "",
    head: "bg-ground",
    dot: "bg-subtle",
    tx: "text-muted-foreground",
    border: "border-border",
  },
  3: {
    titre: "Services à préciser",
    sous: "Choisis les services : les tâches se génèrent toutes seules sur 12 mois.",
    head: "bg-gold-50",
    dot: "bg-gold-500",
    tx: "text-gold-700",
    border: "border-[#FFE0B2]",
  },
} as const;

function SectionBlock({
  id,
  n,
  months,
  children,
}: {
  id: 0 | 1 | 2 | 3;
  n: number;
  months: string[];
  children: ReactNode;
}) {
  const m = SECTION_META[id];
  const sous =
    id === 2 ? `Aucune tâche entre ${monthLabel(months[0]!)} et ${monthLabel(months[months.length - 1]!)}.` : m.sous;
  return (
    <section aria-label={m.titre} className={cn("flex flex-col overflow-hidden rounded-[16px] border", m.border)}>
      <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3", m.head)}>
        <span aria-hidden="true" className={cn("size-2.5 rounded-full", m.dot)} />
        <h4 className={cn("text-[15px] font-extrabold", m.tx)}>
          {m.titre} · {n}
        </h4>
        {sous && <span className="text-[13px] font-medium text-muted-foreground">{sous}</span>}
      </div>
      {children}
    </section>
  );
}

function ClientRow({
  section,
  lignes,
  ts,
  duMois,
  shown,
  focus,
  today,
  flash,
  filtresLocaux,
  onToggle,
  onOpenTask,
  onOpenLigne,
  onAdd,
}: {
  section: 0 | 1 | 2 | 3;
  lignes: PlanningLigneDTO[];
  ts: PlanningTacheDTO[];
  duMois: PlanningTacheDTO[];
  shown: PlanningTacheDTO[];
  focus: string;
  today: string;
  flash: string | null;
  filtresLocaux: boolean;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
  onOpenLigne: (id: string) => void;
  onAdd: (c: { id: string; nom: string }, deja: string[]) => void;
}) {
  const l0 = lignes[0]!;
  const client = { id: l0.prospectId, nom: l0.client };
  const deja = lignes.map((l) => l.service);
  const contrats = [...new Set(lignes.map((l) => l.contratNumero).filter(Boolean))];
  const sous = [l0.ville, ...contrats].filter(Boolean).join(" · ");

  const vivantes = ts.filter((t) => t.statut !== "FAIT");
  const hasLate = vivantes.some((t) => etatProd(t, today) !== "ok");
  const hasCrit = vivantes.some((t) => etatProd(t, today) === "critique");
  const hasAtt = vivantes.some((t) => t.statut === "ATTENTE_CLIENT" && t.date <= today);
  const meteo = hasLate
    ? { Icon: CloudLightning, label: hasCrit ? "Orage : un boss en retard" : "Orage : en retard", cls: "bg-alert-50 text-alert-700" }
    : hasAtt
      ? { Icon: Cloud, label: "Nuage : attente client", cls: "bg-lvl-50 text-lvl-700" }
      : { Icon: Sun, label: "Soleil : à jour", cls: "bg-gold-50 text-gold-700" };

  const fait = duMois.filter((t) => t.statut === "FAIT").length;
  const tot = duMois.length;
  const boucle = tot > 0 && fait === tot;
  const pct = tot ? Math.round((fait / tot) * 100) : 0;
  const finFocus = `${focus}-31`;
  const prochaines = ts
    .filter((t) => t.statut !== "FAIT" && t.date > finFocus)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);
  const placeholder = section === 3;

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-navy-50 px-3 py-3.5 sm:px-4",
        boucle ? "bg-[#FFFDF6]" : "bg-card",
      )}
    >
      {/* Client + services */}
      <div className="flex min-w-0 flex-[1_1_230px] items-start gap-3">
        <span
          role="img"
          aria-label={meteo.label}
          title={meteo.label}
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-[12px]", meteo.cls)}
        >
          <meteo.Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="min-w-0">
            <Link
              href={`/prospects/${client.id}`}
              className="text-sm font-extrabold break-words text-foreground hover:underline"
            >
              {client.nom}
            </Link>
            {sous && <p className="mt-px text-xs text-muted-foreground">{sous}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lignes.map((l) => {
              const st = serviceStyle(l.service);
              const label = l.libelle ?? serviceLabelOf(l.service);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onOpenLigne(l.id)}
                  title="Régler les récurrences de ce service"
                  aria-label={`Régler les récurrences : ${label}, ${client.nom}`}
                  className={cn(
                    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full pr-1 pl-2.5 text-xs font-bold transition-shadow hover:ring-1 hover:ring-current",
                    st.pill,
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", st.dot)} />
                  <span className="truncate">{label}</span>
                  <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-white/70">
                    <Settings className="size-3" strokeWidth={2.2} />
                  </span>
                </button>
              );
            })}
            {!placeholder && (
              <button
                type="button"
                onClick={() => onAdd(client, deja)}
                aria-label={`Ajouter un service à ${client.nom}`}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-navy-500 hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Service
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tâches du mois */}
      <div className="flex min-w-0 flex-[3_1_380px] flex-wrap items-center gap-2">
        {placeholder ? (
          <>
            <p className="min-w-0 flex-[1_1_220px] text-[13px] text-muted-foreground">
              {lignes.some((l) => l.service === "PACK")
                ? "Pack signé : précise les services qu'il contient (Site, Réseaux sociaux, Ads...) pour générer son planning."
                : "Le contrat n'a pas de produit rattaché : aucune tâche générée pour l'instant."}
            </p>
            <Button size="sm" onClick={() => onAdd(client, deja)}>
              Choisir les services
            </Button>
          </>
        ) : (
          <>
            {shown.map((t) => (
              <TaskPill
                key={t.id}
                t={t}
                today={today}
                client={client.nom}
                flash={flash === t.id}
                onToggle={onToggle}
                onOpen={onOpenTask}
              />
            ))}
            {!filtresLocaux && (boucle || tot === 0) &&
              prochaines.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-dashed border-border-strong bg-ground px-3 py-2 text-xs font-bold text-muted-foreground"
                >
                  <Clock aria-hidden="true" className="size-3.5" />
                  {libelleCourt(t.code, t.titre)} · {ddmm(t.date)}
                </span>
              ))}
            {!filtresLocaux && tot === 0 && prochaines.length === 0 && (
              <span className="text-[13px] text-muted-foreground">Rien à livrer sur la période affichée.</span>
            )}
          </>
        )}
      </div>

      {/* Progression du mois */}
      {!placeholder && tot > 0 && (
        <div className="flex basis-full flex-col gap-1.5 sm:basis-[150px] sm:grow-0">
          <div className="flex items-baseline justify-between text-xs font-bold">
            <span className="text-muted-foreground first-letter:uppercase">{monthLong(focus).split(" ")[0]}</span>
            <span className="tabular-nums">
              {fait} / {tot}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${client.nom} : tâches livrées en ${monthLong(focus)}`}
            aria-valuemin={0}
            aria-valuemax={Math.max(tot, 1)}
            aria-valuenow={fait}
            aria-valuetext={`${fait} sur ${tot}`}
            className="h-2 overflow-hidden rounded-full bg-navy-50"
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", boucle ? "bg-gold-500" : "bg-lvl-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {boucle && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-gold-50 px-2 py-[3px] text-[11px] font-extrabold text-gold-700 motion-safe:animate-pop">
              <Star aria-hidden="true" className="size-3 fill-gold-500 text-gold-500" />
              Client bouclé
            </span>
          )}
        </div>
      )}
    </div>
  );
}
