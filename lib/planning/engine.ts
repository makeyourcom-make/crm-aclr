/**
 * Moteur du planning de production.
 *
 *  1. syncFromContracts : le planning de l'admin suit les contrats ACTIFS — une
 *     ligne par (client, service) déduite des catégories produit ; un contrat
 *     sans produit donne une ligne « Services à préciser ».
 *  2. placeRules : ÉTALEMENT intelligent. Les dates imposées (cycle RS) restent ;
 *     les autres règles sont placées, dans leur fenêtre, au jour du mois le
 *     moins chargé (pondéré par la durée). Le jour retenu est STABLE d'un mois à
 *     l'autre (stocké sur la règle) ; « Rééquilibrer » recalcule tout.
 *  3. generateTasks : matérialise les tâches sur le calendrier glissant (mois
 *     courant + 11), ramenées sur des jours ouvrés, sans jamais dupliquer
 *     (clé d'occurrence unique par règle).
 */
import type { PlanningFrequence, PlanningRegle, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  addDays,
  addMonths,
  daysInMonth,
  isoWeekKey,
  isWorkingDay,
  monthKey,
  resolveDay,
  todayZurich,
  utcDay,
} from "@/lib/planning/dates";
import {
  TEMPLATES,
  codesDesactives,
  serviceFromCategorie,
  type ServiceCode,
} from "@/lib/planning/templates";

/** Codes concernés par le dédoublonnage inter-services (cf. templates). */
const DEDUPE_CODES = ["SITE_ARTICLE", "SITE_POINT_SEO", "SEO_GBP", "ADS_REFAC"];
/** Lignes « à préciser » : disparaissent dès qu'un vrai service existe. */
const PLACEHOLDERS = new Set(["A_CONFIGURER", "PACK"]);

const STATUT_INITIAL = new Map(
  Object.values(TEMPLATES)
    .flat()
    .filter((t) => t.statutInitial)
    .map((t) => [t.code, t.statutInitial!]),
);

// ---------------------------------------------------------------------------
// Point d'entrée : appelé à l'ouverture du planning
// ---------------------------------------------------------------------------

export async function ensurePlanning(owner: { id: string; role: string }) {
  if (owner.role === "ADMIN") await syncFromContracts(owner.id);
  await placeRules(owner.id, { rebalance: false });
  const start = addMonths(todayZurich(), 0);
  await generateTasks(owner.id, start, addMonths(start, 12));
}

// ---------------------------------------------------------------------------
// 1. Synchronisation avec les contrats actifs
// ---------------------------------------------------------------------------

export async function syncFromContracts(ownerId: string) {
  const contracts = await prisma.contract.findMany({
    where: { statut: "ACTIF" },
    select: {
      id: true,
      prospectId: true,
      dateDebut: true,
      products: { select: { categorie: true } },
    },
    orderBy: { dateDebut: "asc" },
  });

  // (client, service) attendus → contrat source
  const desired = new Map<string, { prospectId: string; service: ServiceCode; contractId: string; debut: Date }>();
  for (const c of contracts) {
    const services = new Set<ServiceCode>();
    for (const p of c.products) {
      const s = serviceFromCategorie(p.categorie);
      if (s) services.add(s);
    }
    if (services.size === 0) services.add("A_CONFIGURER");
    for (const s of services) {
      desired.set(`${c.prospectId}|${s}`, {
        prospectId: c.prospectId,
        service: s,
        contractId: c.id,
        debut: c.dateDebut,
      });
    }
  }

  const lignes = await prisma.planningLigne.findMany({
    where: { ownerId },
    select: { id: true, prospectId: true, service: true, actif: true, auto: true },
  });
  const byKey = new Map(lignes.map((l) => [`${l.prospectId}|${l.service}`, l]));
  const touched = new Set<string>();

  for (const [key, d] of desired) {
    const l = byKey.get(key);
    if (!l) {
      await createLigne(ownerId, d.prospectId, d.service, {
        contractId: d.contractId,
        auto: true,
        debut: d.debut,
      });
      touched.add(d.prospectId);
    } else if (!l.actif && l.auto) {
      await prisma.planningLigne.update({
        where: { id: l.id },
        data: { actif: true, contractId: d.contractId },
      });
      touched.add(d.prospectId);
    }
  }
  // Lignes auto dont plus aucun contrat actif ne porte le service → masquées.
  for (const l of lignes) {
    if (l.auto && l.actif && !desired.has(`${l.prospectId}|${l.service}`)) {
      await setLigneActif(l.id, false);
      touched.add(l.prospectId);
    }
  }
  for (const prospectId of touched) await applyDedupe(ownerId, prospectId);
}

/** Crée une ligne de service et ses règles de base. */
export async function createLigne(
  ownerId: string,
  prospectId: string,
  service: ServiceCode,
  opts: { contractId?: string | null; auto: boolean; debut?: Date; libelle?: string | null },
) {
  const today = todayZurich();
  const debut = opts.debut && opts.debut > today ? opts.debut : today;
  const ligne = await prisma.planningLigne.upsert({
    where: { ownerId_prospectId_service: { ownerId, prospectId, service } },
    create: {
      ownerId,
      prospectId,
      service,
      contractId: opts.contractId ?? null,
      auto: opts.auto,
      libelle: opts.libelle ?? null,
    },
    update: { actif: true },
  });
  const existing = await prisma.planningRegle.count({ where: { ligneId: ligne.id } });
  if (existing === 0) {
    const tpl = TEMPLATES[service] ?? [];
    const debutMois = debut.getUTCMonth() + 1; // 1-12
    const plusMois = (n: number) => ((debutMois - 1 + n) % 12) + 1;
    if (tpl.length > 0) {
      await prisma.planningRegle.createMany({
        data: tpl.map((t) => ({
          ligneId: ligne.id,
          code: t.code,
          titre: t.titre,
          frequence: t.frequence,
          fixe: t.fixe ?? false,
          fenetreDebut: t.fenetreDebut,
          fenetreFin: t.fenetreFin,
          jours: t.fixe && t.jour ? [t.jour] : [],
          moisAncre:
            t.frequence === "BIMESTRIELLE"
              ? plusMois(1) // 1er rapport SEO le mois suivant le démarrage
              : t.frequence === "TRIMESTRIELLE"
                ? plusMois(3) // 1re revue 3 mois après
                : t.frequence === "ANNUELLE"
                  ? debutMois // anniversaire
                  : null,
          datePonctuelle:
            t.frequence === "PONCTUELLE"
              ? nextWorkingDay(addDays(debut, 7))
              : null,
          dureeMin: t.dureeMin,
          dateDebut: debut,
        })),
      });
    }
  }
  // Un vrai service rend les lignes « à préciser » du client inutiles.
  if (!PLACEHOLDERS.has(service)) {
    const placeholders = await prisma.planningLigne.findMany({
      where: { ownerId, prospectId, service: { in: [...PLACEHOLDERS] }, actif: true },
      select: { id: true },
    });
    for (const p of placeholders) await setLigneActif(p.id, false);
  }
  return ligne;
}

/** Active / masque une ligne ; masquer retire ses tâches futures non commencées. */
export async function setLigneActif(ligneId: string, actif: boolean) {
  await prisma.planningLigne.update({ where: { id: ligneId }, data: { actif } });
  if (!actif) {
    await prisma.planningTache.deleteMany({
      where: { ligneId, regleId: { not: null }, statut: "A_FAIRE", date: { gte: todayZurich() } },
    });
  }
}

/**
 * Dédoublonnage entre services d'un client (un seul article/point SEO,
 * Google Business, refacturation ADS) : active/désactive les règles concernées.
 */
export async function applyDedupe(ownerId: string, prospectId: string) {
  const lignes = await prisma.planningLigne.findMany({
    where: { ownerId, prospectId, actif: true },
    select: { id: true, service: true, fraisPubAvances: true },
  });
  const services = new Set(lignes.map((l) => l.service));
  const ads = lignes.find((l) => l.service === "ADS");
  const off = codesDesactives(services, { fraisPubAvances: ads?.fraisPubAvances ?? true });
  const regles = await prisma.planningRegle.findMany({
    where: { ligneId: { in: lignes.map((l) => l.id) }, code: { in: DEDUPE_CODES } },
    select: { id: true, code: true, actif: true },
  });
  for (const r of regles) {
    const want = !off.has(r.code);
    if (r.actif !== want) await setRegleActif(r.id, want);
  }
}

export async function setRegleActif(regleId: string, actif: boolean) {
  await prisma.planningRegle.update({ where: { id: regleId }, data: { actif } });
  if (!actif) await deleteFutureGenerated([regleId]);
}

/** Supprime les tâches générées futures non commencées (avant régénération). */
export async function deleteFutureGenerated(regleIds: string[]) {
  if (regleIds.length === 0) return;
  await prisma.planningTache.deleteMany({
    where: { regleId: { in: regleIds }, statut: { in: ["A_FAIRE", "ATTENTE_CLIENT"] }, faitLe: null, date: { gte: todayZurich() } },
  });
}

function nextWorkingDay(d: Date): Date {
  let c = d;
  for (let i = 0; i < 10 && !isWorkingDay(c); i++) c = addDays(c, 1);
  return c;
}

// ---------------------------------------------------------------------------
// 2. Étalement intelligent
// ---------------------------------------------------------------------------

const PLACEABLE: PlanningFrequence[] = ["MENSUELLE", "BIMENSUELLE", "BIMESTRIELLE", "TRIMESTRIELLE", "ANNUELLE"];

/** La règle tombe-t-elle ce mois-ci (mois 1-12) ? */
function occursInMonth(r: Pick<PlanningRegle, "frequence" | "moisAncre">, mois: number): boolean {
  const anc = r.moisAncre ?? 1;
  switch (r.frequence) {
    case "BIMESTRIELLE":
      return (((mois - anc) % 2) + 2) % 2 === 0;
    case "TRIMESTRIELLE":
      return (((mois - anc) % 3) + 3) % 3 === 0;
    case "ANNUELLE":
      return mois === anc;
    default:
      return true;
  }
}

/** Fenêtres de placement (2 pour une règle bimensuelle : 1re et 2e quinzaine). */
function windowsOf(r: PlanningRegle): Array<[number, number]> {
  return r.frequence === "BIMENSUELLE"
    ? [
        [r.fenetreDebut, Math.min(14, r.fenetreFin)],
        [Math.max(15, r.fenetreDebut), r.fenetreFin],
      ]
    : [[r.fenetreDebut, r.fenetreFin]];
}

/**
 * Place les règles sans jour (ou toutes les non fixes si `rebalance`) dans leur
 * fenêtre. L'étalement SIMULE les vraies dates des 12 prochains mois (week-ends
 * et fériés compris, une tâche du samedi tombant le vendredi) et retient, pour
 * chaque règle, le jour du mois qui ajoute le moins de charge aux journées déjà
 * remplies. Le jour retenu est stable d'un mois à l'autre.
 * Renvoie les ids des règles déplacées.
 */
export async function placeRules(ownerId: string, opts: { rebalance: boolean }): Promise<string[]> {
  const regles = await prisma.planningRegle.findMany({
    where: { actif: true, ligne: { ownerId, actif: true } },
  });
  const debut = addMonths(todayZurich(), 0);
  const mois = Array.from({ length: 12 }, (_, i) => addMonths(debut, i));
  const load = new Map<string, number>(); // AAAA-MM-JJ → minutes

  /** Dates réelles d'une règle placée au jour `jour` sur l'horizon. */
  const datesFor = (r: PlanningRegle, jour: number): string[] => {
    const place = { fixe: r.fixe, fenetreDebut: r.fenetreDebut, fenetreFin: r.fenetreFin };
    const out: string[] = [];
    for (const m of mois) {
      const y = m.getUTCFullYear();
      const mo = m.getUTCMonth();
      if (!occursInMonth(r, mo + 1)) continue;
      const j = Math.min(jour, daysInMonth(y, mo));
      out.push(resolveDay(y, mo, j, place).toISOString().slice(0, 10));
    }
    return out;
  };
  const add = (dates: string[], min: number) => {
    for (const d of dates) load.set(d, (load.get(d) ?? 0) + min);
  };

  // Charge des tâches hebdomadaires sur leur jour de semaine.
  for (const r of regles.filter((x) => x.frequence === "HEBDO")) {
    const wd = r.jourSemaine ?? 1;
    for (let d = debut; d < addMonths(debut, 12); d = addDays(d, 1)) {
      if ((d.getUTCDay() || 7) === wd) add([d.toISOString().slice(0, 10)], r.dureeMin);
    }
  }

  const toPlace: PlanningRegle[] = [];
  for (const r of regles) {
    if (!PLACEABLE.includes(r.frequence)) continue;
    const keep = r.jours.length > 0 && (r.fixe || !opts.rebalance);
    if (keep) {
      for (const j of r.jours) add(datesFor(r, j), r.dureeMin);
    } else {
      toPlace.push(r);
    }
  }
  // Fenêtres étroites d'abord (moins de choix), puis tâches longues.
  toPlace.sort(
    (a, b) =>
      a.fenetreFin - a.fenetreDebut - (b.fenetreFin - b.fenetreDebut) ||
      b.dureeMin - a.dureeMin,
  );

  const moved: string[] = [];
  for (const r of toPlace) {
    const jours = windowsOf(r).map(([a, b]) => {
      // Jusqu'au 28 si possible (le 29-31 n'existe pas tous les mois).
      const hi = a <= 28 ? Math.min(b, 28) : b;
      let best = a;
      let bestCost = Infinity;
      for (let d = a; d <= hi; d++) {
        const dates = datesFor(r, d);
        // Coût = charge déjà présente sur les vraies dates (au carré : on
        // pénalise fortement les journées déjà lourdes).
        const cost = dates.reduce((s, x) => {
          const v = (load.get(x) ?? 0) + r.dureeMin;
          return s + v * v;
        }, 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = d;
        }
      }
      add(datesFor(r, best), r.dureeMin);
      return best;
    });
    if (jours.join(",") !== r.jours.join(",")) {
      await prisma.planningRegle.update({ where: { id: r.id }, data: { jours } });
      moved.push(r.id);
    }
  }
  return moved;
}

// ---------------------------------------------------------------------------
// 3. Génération des tâches (calendrier glissant)
// ---------------------------------------------------------------------------

type Candidate = Prisma.PlanningTacheCreateManyInput;

/**
 * Génère les occurrences manquantes sur [from, to[.
 *
 * Placement MOIS PAR MOIS sur les vraies dates : les tâches à date imposée
 * (cycle RS, hebdo, ponctuelles) sont posées d'abord ; puis chaque tâche « à
 * fenêtre » va au jour ouvré LE MOINS CHARGÉ de sa fenêtre ce mois-là (le jour
 * préféré de la règle ne sert qu'à départager). Les tâches déjà créées comptent
 * dans la charge et ne sont jamais déplacées.
 */
export async function generateTasks(ownerId: string, from: Date, to: Date) {
  const regles = await prisma.planningRegle.findMany({
    where: { actif: true, ligne: { ownerId, actif: true } },
    include: {
      ligne: {
        select: {
          contract: { select: { dateDebut: true, dureeMois: true, reconductible: true } },
        },
      },
    },
  });
  if (regles.length === 0) return 0;

  // Charge déjà planifiée (toutes lignes du planning) + occurrences existantes.
  const existing = await prisma.planningTache.findMany({
    where: { ownerId, OR: [{ date: { gte: from, lt: to } }, { regleId: { in: regles.map((r) => r.id) } }] },
    select: { regleId: true, cle: true, date: true, dureeMin: true, statut: true },
  });
  const have = new Set(existing.filter((e) => e.regleId).map((e) => `${e.regleId}|${e.cle}`));
  const load = new Map<string, number>();
  const addLoad = (d: Date, min: number) => {
    const k = d.toISOString().slice(0, 10);
    load.set(k, (load.get(k) ?? 0) + min);
  };
  for (const e of existing) {
    if (e.date >= from && e.date < to && e.statut !== "ABANDONNEE") addLoad(e.date, e.dureeMin);
  }

  const out: Candidate[] = [];
  const mk = (r: (typeof regles)[number], cle: string, date: Date): Candidate => ({
    ownerId,
    ligneId: r.ligneId,
    regleId: r.id,
    cle,
    titre: r.titre,
    date,
    dureeMin: r.dureeMin,
    statut: STATUT_INITIAL.get(r.code) ?? "A_FAIRE",
  });

  type Slot = { r: (typeof regles)[number]; cle: string; y: number; mo: number; lo: number; hi: number; pref: number; start: Date; end: Date };
  const windowed = new Map<string, Slot[]>(); // AAAA-MM → créneaux à placer

  for (const r of regles) {
    const c = r.ligne.contract;
    let start = r.dateDebut > from ? r.dateDebut : from;
    if (c && c.dateDebut > start) start = c.dateDebut;
    let end = to;
    if (r.dateFin && r.dateFin < end) end = r.dateFin;
    if (c && !c.reconductible) {
      const fin = addMonths(c.dateDebut, c.dureeMois);
      if (fin < end) end = fin;
    }
    start = utcDay(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    if (start >= end && r.frequence !== "PONCTUELLE") continue;

    const fixed = (date: Date, cle: string) => {
      if (have.has(`${r.id}|${cle}`) || date < start || date >= end) return;
      have.add(`${r.id}|${cle}`);
      addLoad(date, r.dureeMin);
      out.push(mk(r, cle, date));
    };

    if (r.frequence === "PONCTUELLE") {
      const cle = "unique";
      if (r.datePonctuelle && r.datePonctuelle < to && !have.has(`${r.id}|${cle}`)) {
        have.add(`${r.id}|${cle}`);
        addLoad(r.datePonctuelle, r.dureeMin);
        out.push(mk(r, cle, r.datePonctuelle));
      }
      continue;
    }
    if (r.frequence === "HEBDO") {
      const wd = r.jourSemaine ?? 1; // 1 = lundi
      for (let d = start; d < end; d = addDays(d, 1)) {
        if ((d.getUTCDay() || 7) !== wd) continue;
        let x = d;
        for (let i = 0; i < 4 && !isWorkingDay(x); i++) x = addDays(x, -1);
        fixed(x < start ? d : x, isoWeekKey(d));
      }
      continue;
    }
    const place = { fixe: r.fixe, fenetreDebut: r.fenetreDebut, fenetreFin: r.fenetreFin };
    for (let m = addMonths(start, 0); m < end; m = addMonths(m, 1)) {
      const y = m.getUTCFullYear();
      const mo = m.getUTCMonth();
      if (!occursInMonth(r, mo + 1)) continue;
      const dim = daysInMonth(y, mo);
      if (r.fixe) {
        const j = Math.min(r.jours[0] ?? r.fenetreDebut, dim);
        fixed(resolveDay(y, mo, j, place), monthKey(m));
        continue;
      }
      windowsOf(r).forEach(([a, b], i) => {
        const cle = r.frequence === "BIMENSUELLE" ? `${monthKey(m)}#${i + 1}` : monthKey(m);
        if (have.has(`${r.id}|${cle}`)) return;
        const lo = Math.min(a, dim);
        const hi = Math.min(b, dim);
        const slot: Slot = { r, cle, y, mo, lo, hi, pref: r.jours[i] ?? lo, start, end };
        const k = monthKey(m);
        windowed.set(k, [...(windowed.get(k) ?? []), slot]);
      });
    }
  }

  // Placement mois par mois : fenêtres étroites d'abord, puis tâches longues.
  for (const slots of windowed.values()) {
    slots.sort((p, q) => p.hi - p.lo - (q.hi - q.lo) || q.r.dureeMin - p.r.dureeMin);
    for (const s of slots) {
      let best: Date | null = null;
      let bestCost = Infinity;
      for (let d = s.lo; d <= s.hi; d++) {
        const date = utcDay(s.y, s.mo, d);
        if (!isWorkingDay(date) || date < s.start || date >= s.end) continue;
        const v = (load.get(date.toISOString().slice(0, 10)) ?? 0) + s.r.dureeMin;
        // Charge au carré (évite les journées lourdes) ; l'écart au jour
        // préféré ne fait que départager.
        const cost = v * v + Math.abs(d - s.pref);
        if (cost < bestCost) {
          bestCost = cost;
          best = date;
        }
      }
      if (!best) {
        // Fenêtre sans jour ouvré exploitable : jour ouvré le plus proche.
        const fb = resolveDay(s.y, s.mo, s.pref, { fixe: false, fenetreDebut: s.lo, fenetreFin: s.hi });
        if (fb < s.start || fb >= s.end) continue;
        best = fb;
      }
      have.add(`${s.r.id}|${s.cle}`);
      addLoad(best, s.r.dureeMin);
      out.push(mk(s.r, s.cle, best));
    }
  }

  if (out.length === 0) return 0;
  const res = await prisma.planningTache.createMany({ data: out, skipDuplicates: true });
  return res.count;
}
