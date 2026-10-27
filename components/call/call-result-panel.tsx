"use client";

/**
 * Panneau « Comment ça s'est passé ? » : résultat d'un appel en un clic.
 *
 * Partagé par la modale de fin d'appel (toutes les pages) et le cockpit
 * /phoning (version intégrée à la page). Utilise UNIQUEMENT les actions
 * serveur existantes :
 *   - recordCallResult (résultat + statut prospect + rappel auto),
 *   - createActivity (RDV calé dans la foulée, optionnel),
 *   - cancelCall via le provider (« Annuler sans enregistrer »).
 *
 * Familles de résultats (charte MYC Arena) : Gagné (vert), À relancer (or /
 * bleu, rappel auto), Clos (gris / rouge). Raccourcis clavier 1-9, 0, A.
 * Refus ferme : confirmation obligatoire (le prospect passe en « Ne pas
 * rappeler »). Après succès : toast XP (+5 appel, +10 conversation, +50 RDV
 * pris + confettis), puis router.refresh() pour mettre à jour la topbar.
 */
import type { ActivityResultat, ActivityType } from "@prisma/client";
import {
  CalendarCheck,
  CalendarPlus,
  Check,
  Keyboard,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { createActivity, recordCallResult } from "@/app/(app)/activites/actions";
import { celebrate, xpToast } from "@/components/arena/celebrate";
import { XpPill } from "@/components/arena/pills";
import { TONE_CLASSES, TONE_HEX } from "@/components/arena/tones";
import {
  AUTO_RAPPEL_AIDE,
  RAPPEL_CHOICES,
  RESULT_META,
  RESULT_ORDER,
  delaiFor,
  isConversation,
  previewRappelDate,
  xpForCall,
  type RappelChoice,
} from "@/components/call/call-results";
import { useCallSession } from "@/components/call/call-session-provider";
import { useNow } from "@/components/call/clock";
import { zDayKey, zDuration, zTime, zWeekdayShort } from "@/components/call/zurich";
import { Button } from "@/components/ui/button";
import { getActivityResultatLabel, getActivityTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallResultAgendaItem {
  id: string;
  date: Date | string;
  type: ActivityType;
  sujet: string;
  raisonSociale: string | null;
}

export interface CallResultRdvDefaults {
  /** Nom du contact (« Marc Fellay ») pour le titre du formulaire RDV. */
  contact?: string | null;
  /** Adresse postale (RDV physique). */
  adresse?: string | null;
  /** Numéro (RDV téléphonique). */
  numero?: string | null;
}

export interface CallResultPanelProps {
  variant: "modal" | "inline";
  /** Durée figée en secondes (« J'ai raccroché ») ; sinon durée live. */
  frozenSeconds?: number | null;
  rdvDefaults?: CallResultRdvDefaults;
  /** RDV déjà planifiés (affichés pour le jour choisi). */
  agenda?: CallResultAgendaItem[];
  /** En-tête personnalisé ; `null` = aucun (la modale a son DialogTitle). */
  header?: ReactNode;
  /** Pastille à droite du titre (ex. combo en cours). */
  badge?: ReactNode;
  /** Raccourcis clavier actifs (défaut : true). */
  shortcuts?: boolean;
  /** Appelé après un enregistrement réussi. */
  onRecorded?: (info: {
    prospectId: string;
    resultat: ActivityResultat;
    xp: number;
  }) => void;
  /** Appelé après « Annuler sans enregistrer ». */
  onCancelled?: () => void;
  className?: string;
}

type RdvType = "RDV_PHYSIQUE" | "RDV_VISIO" | "RDV_TELEPHONIQUE";

const RDV_TYPES: { value: RdvType; label: string }[] = [
  { value: "RDV_PHYSIQUE", label: "Physique" },
  { value: "RDV_VISIO", label: "Visio" },
  { value: "RDV_TELEPHONIQUE", label: "Téléphone" },
];

const FIELD =
  "h-11 w-full min-w-0 rounded-[12px] border border-border-strong bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25";

// ---------------------------------------------------------------------------
// Helpers (hors rendu : pas d'appel impur pendant le rendu)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

function localIsoMinutes(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultCustomRappel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return localIsoMinutes(d);
}

/** Prochain jour ouvré (lun-ven) à partir de demain, format AAAA-MM-JJ. */
function defaultRdvDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CallResultPanel({
  variant,
  frozenSeconds,
  rdvDefaults,
  agenda,
  header,
  badge,
  shortcuts = true,
  onRecorded,
  onCancelled,
  className,
}: CallResultPanelProps) {
  const router = useRouter();
  const { session, elapsedSeconds, endCallSession, cancelCallSession } = useCallSession();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [notes, setNotes] = useState("");
  const [rappel, setRappel] = useState<RappelChoice>("auto");
  const [customRappel, setCustomRappel] = useState(defaultCustomRappel);
  const [confirmRefus, setConfirmRefus] = useState(false);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [rdvDate, setRdvDate] = useState(defaultRdvDate);
  const [rdvHeure, setRdvHeure] = useState("10:00");
  const [rdvType, setRdvType] = useState<RdvType>("RDV_PHYSIQUE");
  const [rdvLieu, setRdvLieu] = useState<string | null>(null);
  const nowMs = useNow(60_000);
  const uid = useId();

  const busy = pending || cancelling;
  const duree = Math.min(7200, Math.max(0, frozenSeconds ?? elapsedSeconds));
  const lieuDefaut =
    rdvType === "RDV_PHYSIQUE"
      ? (rdvDefaults?.adresse ?? "")
      : rdvType === "RDV_TELEPHONIQUE"
        ? (rdvDefaults?.numero ?? "")
        : "";
  const lieu = rdvLieu ?? lieuDefaut;

  const resetForm = () => {
    setNotes("");
    setRappel("auto");
    setConfirmRefus(false);
    setRdvOpen(false);
    setRdvLieu(null);
  };

  const record = (resultat: ActivityResultat, planRdv = false) => {
    if (!session || busy) return;
    const s = session;
    const delai = delaiFor(resultat, rappel);
    const rappelDate = previewRappelDate(delai, nowMs || Date.now(), customRappel);
    startTransition(async () => {
      const res = await recordCallResult({
        activityId: s.activityId,
        resultat,
        notesResultat: notes.trim() || undefined,
        duree2: duree,
        rappelDelai: delai,
        rappelDateCustom: delai === "custom" ? new Date(customRappel) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }

      // RDV calé dans la foulée (action serveur existante createActivity).
      let rdvLine: string | null = null;
      if (planRdv) {
        const when = new Date(`${rdvDate}T${rdvHeure || "10:00"}`);
        const created = await createActivity({
          prospectId: s.prospectId,
          type: rdvType,
          date: when,
          sujet: `RDV ${s.prospectRaisonSociale}`,
          adresseRdv: lieu.trim() || undefined,
          statut: "PLANIFIE",
        });
        if (created.ok) {
          rdvLine = `${getActivityTypeLabel(rdvType)} le ${zWeekdayShort(when)} à ${zTime(when)} : ajouté à ton agenda`;
        } else {
          toast.error(
            `Appel enregistré, mais le RDV n'a pas pu être ajouté à l'agenda : ${created.error ?? "erreur inconnue"}.`,
          );
        }
      }

      const xp = xpForCall(resultat);
      const label = getActivityResultatLabel(resultat);
      const sub =
        rdvLine ??
        (res.prochainActivityId && rappelDate
          ? `Rappel auto le ${zWeekdayShort(rappelDate)} · ${s.prospectRaisonSociale}`
          : resultat === "REFUS_FERME"
            ? `${s.prospectRaisonSociale} passe en « Ne pas rappeler »`
            : s.prospectRaisonSociale);

      if (resultat === "RDV_PRIS") {
        xpToast(xp, "RDV pris ! Énorme", sub);
        celebrate({ pieces: 80 });
      } else if (isConversation(resultat)) {
        xpToast(xp, `${label} · conversation`, sub);
      } else {
        xpToast(xp, `${label} · appel compté`, sub);
      }
      if (resultat === "INVALIDE") {
        const pid = s.prospectId;
        toast.warning("Pense à corriger le numéro sur la fiche.", {
          action: { label: "Ouvrir la fiche", onClick: () => router.push(`/prospects/${pid}`) },
        });
      } else if (resultat === "MAUVAISE_PERSONNE") {
        const pid = s.prospectId;
        toast.message("Pense à mettre à jour le contact sur la fiche.", {
          action: { label: "Ouvrir la fiche", onClick: () => router.push(`/prospects/${pid}`) },
        });
      }

      resetForm();
      onRecorded?.({ prospectId: s.prospectId, resultat, xp });
      endCallSession();
      router.refresh();
    });
  };

  const pick = (resultat: ActivityResultat) => {
    if (!session || busy) return;
    if (resultat === "RDV_PRIS") {
      setConfirmRefus(false);
      setRdvOpen((o) => !o);
      return;
    }
    if (resultat === "REFUS_FERME") {
      setRdvOpen(false);
      setConfirmRefus(true);
      return;
    }
    record(resultat);
  };

  const cancel = async () => {
    if (busy) return;
    setCancelling(true);
    const ok = await cancelCallSession();
    setCancelling(false);
    if (ok) {
      resetForm();
      toast("Appel annulé", {
        description: "Aucun résultat enregistré : cet appel ne compte pas.",
      });
      onCancelled?.();
      router.refresh();
    }
  };

  // Raccourcis clavier (hors champs de saisie, sans modificateur).
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!session || busy) return;
    if (e.key === "Escape") {
      if (rdvOpen || confirmRefus) {
        setRdvOpen(false);
        setConfirmRefus(false);
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    if (rdvOpen || confirmRefus) return;
    const k = e.key.toUpperCase();
    const code = RESULT_ORDER.find((r) => RESULT_META[r].key === k);
    if (!code) return;
    e.preventDefault();
    pick(code);
  });
  const shortcutsOn = shortcuts && !!session;
  useEffect(() => {
    if (!shortcutsOn) return;
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcutsOn]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  const subline = !session
    ? "Lance l'appel : dès que tu raccroches, un clic sur le résultat enregistre tout et enchaîne."
    : frozenSeconds != null
      ? `Raccroché avec ${session.prospectRaisonSociale} après ${zDuration(duree)} : choisis le résultat, on enchaîne.`
      : `En ligne avec ${session.prospectRaisonSociale} · ${zDuration(duree)} : prépare le résultat, un clic et on enchaîne.`;

  const headerNode = header !== undefined ? header : (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-[1_1_260px]">
        <h2 className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-foreground sm:text-2xl">
          Comment ça s&apos;est passé ?
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{subline}</p>
      </div>
      {badge}
    </div>
  );

  if (!session) {
    // Version intégrée sans appel en cours : compacte, rien de cliquable.
    if (variant === "modal") return null;
    return (
      <section
        aria-label="Résultat de l'appel"
        className={cn(
          "flex flex-col gap-3 rounded-[20px] border border-border bg-card p-5 shadow-arena sm:p-6",
          className,
        )}
      >
        {headerNode}
        <p className="rounded-[14px] bg-ground px-4 py-3 text-[13px] font-medium text-muted-foreground">
          Les boutons de résultat (RDV pris, À rappeler, Combox, Refus…) s&apos;activent dès
          que tu lances l&apos;appel. Un clic = appel enregistré, XP crédités, statut mis à
          jour et prospect suivant.
        </p>
      </section>
    );
  }

  const rappelDateFor = (r: ActivityResultat) =>
    previewRappelDate(delaiFor(r, rappel), nowMs, customRappel);

  const aideFor = (r: ActivityResultat): string => {
    const meta = RESULT_META[r];
    if (r === "INTERESSE_PAS_PRET") {
      const d = rappelDateFor(r);
      return `Passe en Qualifié · ${d ? `rappel ${zWeekdayShort(d)}` : "sans rappel"}`;
    }
    if (meta.family === "relance") {
      const d = rappelDateFor(r);
      return d ? `Rappel auto ${zWeekdayShort(d)}` : "Aucun rappel planifié";
    }
    return meta.aide ?? "";
  };

  const agendaDay = (agenda ?? []).filter((a) => zDayKey(a.date) === rdvDate);
  const rdvDateObj = new Date(`${rdvDate}T12:00`);
  const rdvXp = xpForCall("RDV_PRIS");
  const contact = rdvDefaults?.contact?.trim() || session.prospectRaisonSociale;

  return (
    <section
      aria-label="Résultat de l'appel"
      aria-busy={busy}
      className={cn(
        "flex flex-col gap-5",
        variant === "inline" &&
          cn(
            "rounded-[20px] border-2 bg-card p-5 shadow-arena sm:p-6",
            frozenSeconds != null ? "border-coral-500" : "border-border",
          ),
        className,
      )}
    >
      {headerNode}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-notes`} className="text-[13px] font-bold text-foreground">
          Notes
        </label>
        <textarea
          id={`${uid}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Résumé verbal de l'échange…"
          className="min-h-16 w-full resize-y rounded-[12px] border border-border-strong bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
        />
      </div>

      {/* ---- Gagné ---- */}
      <FamilyGroup id={`${uid}-gagne`} label="Gagné" dot="bg-win-500" text="text-win-700">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-3">
          <button
            type="button"
            onClick={() => pick("RDV_PRIS")}
            disabled={busy}
            aria-expanded={rdvOpen}
            aria-keyshortcuts="1"
            className="flex min-h-[88px] items-center gap-3.5 rounded-[16px] bg-win-700 px-4 py-3.5 text-left text-white shadow-[0_10px_24px_rgba(11,122,59,0.28)] transition-[transform,filter] hover:brightness-110 active:translate-y-px disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-white/15"
            >
              <CalendarCheck className="size-[26px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.01em]">
                RDV pris
              </span>
              <span className="text-[13px] font-semibold text-win-50">
                Ouvre la prise de RDV · touche 1
              </span>
            </span>
            <XpPill xp={rdvXp} variant="solid" size="md" />
          </button>
          <ResultButton
            code="INTERESSE_PAS_PRET"
            aide={aideFor("INTERESSE_PAS_PRET")}
            onPick={pick}
            disabled={busy}
            size="lg"
          />
        </div>

        {rdvOpen && (
          <div className="flex flex-col gap-4 rounded-[16px] border border-win-500 bg-win-50 p-4 sm:p-5">
            <div>
              <p className="font-display text-xl leading-tight font-extrabold text-win-700">
                Énorme ! On cale le RDV avec {contact}
              </p>
              <p className="mt-1 text-[13px] font-medium text-foreground">
                Il part direct dans ton agenda (et ton agenda Google s&apos;il est connecté).
                Le prospect passe en « RDV pris ».
              </p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-foreground">
                Date
                <input
                  type="date"
                  value={rdvDate}
                  onChange={(e) => setRdvDate(e.target.value)}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-foreground">
                Heure
                <input
                  type="time"
                  step={900}
                  value={rdvHeure}
                  onChange={(e) => setRdvHeure(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id={`${uid}-rdvtype`} className="text-[13px] font-bold text-foreground">
                Type de RDV
              </span>
              <div role="radiogroup" aria-labelledby={`${uid}-rdvtype`} className="flex flex-wrap gap-2">
                {RDV_TYPES.map((t) => {
                  const on = rdvType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setRdvType(t.value);
                        setRdvLieu(null);
                      }}
                      className={cn(
                        "h-10 rounded-[12px] border-2 px-4 text-sm font-bold transition-colors",
                        on
                          ? "border-win-700 bg-win-700 text-white"
                          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-foreground">
              {rdvType === "RDV_PHYSIQUE"
                ? "Adresse du RDV"
                : rdvType === "RDV_VISIO"
                  ? "Lien visio"
                  : "Numéro à appeler"}
              <input
                type="text"
                value={lieu}
                onChange={(e) => setRdvLieu(e.target.value)}
                placeholder={
                  rdvType === "RDV_VISIO" ? "Colle le lien Meet, Zoom ou Teams (optionnel)" : ""
                }
                className={FIELD}
              />
            </label>
            {agenda && (
              <div className="flex flex-col gap-1.5 rounded-[12px] bg-card px-3.5 py-3">
                <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  Ton agenda {zWeekdayShort(rdvDateObj)}
                </span>
                {agendaDay.length === 0 ? (
                  <span className="text-[13px] font-bold text-win-700">Journée libre, fonce.</span>
                ) : (
                  agendaDay.map((a) => (
                    <span key={a.id} className="text-[13px] font-semibold text-foreground">
                      {zTime(a.date)} · {a.raisonSociale ?? a.sujet} · {getActivityTypeLabel(a.type)}
                    </span>
                  ))
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="hero"
                size="xl"
                onClick={() => record("RDV_PRIS", true)}
                disabled={busy || !rdvDate}
              >
                <CalendarPlus aria-hidden="true" />
                {pending ? "Enregistrement…" : `Valider le RDV · +${rdvXp} XP`}
              </Button>
              <Button
                variant="outline"
                size="xl"
                className="text-[15px]"
                onClick={() => record("RDV_PRIS", false)}
                disabled={busy}
              >
                Sans le planifier
              </Button>
              <Button
                variant="ghost"
                size="xl"
                className="text-[15px]"
                onClick={() => setRdvOpen(false)}
                disabled={busy}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </FamilyGroup>

      {/* ---- À relancer ---- */}
      <FamilyGroup
        id={`${uid}-relance`}
        label="À relancer · rappel auto"
        dot="bg-gold-500"
        text="text-gold-700"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
          {(["A_RAPPELER", "NE_DECROCHE_PAS", "COMBOX"] as const).map((r) => (
            <ResultButton key={r} code={r} aide={aideFor(r)} onPick={pick} disabled={busy} />
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-[14px] bg-ground px-3.5 py-3">
          <span id={`${uid}-rappel`} className="text-[13px] font-bold text-foreground">
            Quand rappeler ?
          </span>
          <div role="radiogroup" aria-labelledby={`${uid}-rappel`} className="flex flex-wrap gap-1.5">
            {RAPPEL_CHOICES.map((c) => {
              const on = rappel === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRappel(c.value)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-xs font-bold transition-colors",
                    on
                      ? "border-navy-700 bg-navy-700 text-white"
                      : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {rappel === "custom" && (
            <label className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-foreground">
              Date du rappel
              <input
                type="datetime-local"
                value={customRappel}
                onChange={(e) => setCustomRappel(e.target.value)}
                className={cn(FIELD, "h-9 w-auto")}
              />
            </label>
          )}
          <span className="text-xs leading-relaxed font-medium text-muted-foreground">
            {rappel === "auto"
              ? AUTO_RAPPEL_AIDE
              : rappel === "none"
                ? "Aucun rappel ne sera planifié pour ce prospect."
                : "Rappel planifié à la date choisie pour les résultats à relancer (week-end reporté au lundi)."}
          </span>
        </div>
      </FamilyGroup>

      {/* ---- Clos ---- */}
      <FamilyGroup id={`${uid}-clos`} label="Clos" dot="bg-subtle" text="text-muted-foreground">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2.5">
          {(
            ["REFUS_POLI", "REFUS_FERME", "INVALIDE", "DEJA_CLIENT", "MAUVAISE_PERSONNE", "AUTRE"] as const
          ).map((r) => (
            <ResultButton
              key={r}
              code={r}
              aide={aideFor(r)}
              onPick={pick}
              disabled={busy}
              size="sm"
              pressed={r === "REFUS_FERME" ? confirmRefus : undefined}
            />
          ))}
        </div>
        {confirmRefus && (
          <div
            role="alertdialog"
            aria-labelledby={`${uid}-refus-title`}
            className="flex flex-col gap-3 rounded-[14px] border border-alert-500 bg-alert-50 p-4"
          >
            <p
              id={`${uid}-refus-title`}
              className="flex items-start gap-2 text-sm font-bold text-alert-700"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Refus ferme : {session.prospectRaisonSociale} passera en « Ne pas rappeler » et
              sortira de toutes tes files. Plus aucun contact possible sauf changement manuel du
              statut.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="bg-alert-700 hover:bg-alert-700/90"
                onClick={() => record("REFUS_FERME")}
                disabled={busy}
                autoFocus
              >
                <Check aria-hidden="true" />
                Confirmer le refus ferme
              </Button>
              <Button variant="outline" size="lg" onClick={() => setConfirmRefus(false)} disabled={busy}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </FamilyGroup>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="flex min-w-0 flex-[1_1_240px] items-start gap-2 text-xs font-medium text-muted-foreground">
          <Keyboard aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-subtle" />
          <span>
            Raccourcis 1 à 9, 0 et A · chaque résultat enregistre l&apos;appel, crédite tes XP et
            enchaîne.
          </span>
        </p>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
          <X aria-hidden="true" />
          {cancelling ? "Annulation…" : "Annuler sans enregistrer"}
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function FamilyGroup({
  id,
  label,
  dot,
  text,
  children,
}: {
  id: string;
  label: string;
  dot: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2.5">
      <h3
        id={id}
        className={cn(
          "flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase",
          text,
        )}
      >
        <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
        {label}
      </h3>
      {children}
    </div>
  );
}

function ResultButton({
  code,
  aide,
  onPick,
  disabled,
  size = "md",
  pressed,
  icon: IconCmp,
}: {
  code: ActivityResultat;
  aide: string;
  onPick: (r: ActivityResultat) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  pressed?: boolean;
  icon?: LucideIcon;
}) {
  const meta = RESULT_META[code];
  const t = TONE_CLASSES[meta.tone];
  const xp = xpForCall(code);
  return (
    <button
      type="button"
      onClick={() => onPick(code)}
      disabled={disabled}
      aria-keyshortcuts={meta.key}
      aria-pressed={pressed}
      className={cn(
        "flex items-center gap-3 rounded-[14px] border border-border border-l-[5px] bg-card text-left text-foreground transition-[transform,box-shadow,background-color] hover:-translate-y-px hover:shadow-arena active:translate-y-0 disabled:opacity-60",
        size === "lg" && "min-h-[88px] rounded-[16px] px-3.5 py-3",
        size === "md" && "min-h-[68px] px-3.5 py-2.5",
        size === "sm" && "min-h-[58px] gap-2.5 px-3 py-2",
        pressed && "bg-alert-50",
      )}
      style={{ borderLeftColor: TONE_HEX[meta.tone].solid }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center font-extrabold",
          t.bg,
          t.text,
          size === "sm" ? "size-7 rounded-[8px] text-xs" : "size-8 rounded-[10px] text-sm",
        )}
      >
        {IconCmp ? <IconCmp className="size-4" /> : meta.key}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "font-bold",
            size === "lg" ? "text-[17px] font-extrabold" : size === "md" ? "text-[15px]" : "text-sm",
          )}
        >
          {getActivityResultatLabel(code)}
        </span>
        {aide && <span className={cn("text-xs font-semibold", t.text)}>{aide}</span>}
      </span>
      <XpPill xp={xp} />
    </button>
  );
}
