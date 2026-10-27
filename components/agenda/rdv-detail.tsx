"use client";

/**
 * Détail d'une activité de l'agenda (panneau latéral sur grand écran,
 * fenêtre sur téléphone).
 *
 * Fonctions conservées de l'ancienne fiche : lien vers l'entreprise, sujet,
 * description, lieu cliquable (Maps / visio / tél.), collaborateur assigné,
 * Modifier, Marquer faite, Reporter à J+1, Supprimer.
 * Nouveau : validation d'un RDV passé (effectué / manqué / annulé, +80 XP),
 * action contextuelle (itinéraire, rejoindre la visio, appeler), compte à
 * rebours, origine phoning, prochaine marche, checklist de préparation.
 */
import {
  CalendarClock,
  Check,
  CircleCheck,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  Navigation,
  Pencil,
  Phone,
  Redo2,
  Star,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusPill } from "@/components/arena/pills";
import { AdresseRdvLink } from "@/components/activities/adresse-rdv-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { isRdvType } from "@/lib/activity-category";
import { formatPhone, normalizePhone } from "@/lib/format";
import { XP_RULES } from "@/lib/gamification/rules";
import {
  countdownLabel,
  formatKeyLong,
  formatKeyShort,
  zDayKey,
  zTime,
} from "@/lib/queries/agenda-dates";
import { cn } from "@/lib/utils";

import {
  AGENDA_HEX,
  agendaState,
  isClientRdv,
  STATE_LABEL,
  STATE_TONE,
  TYPE_META,
} from "./agenda-style";
import type { ValidationStatut } from "./pending-banner";
import { PrepChecklist } from "./prep-checklist";
import { dureeMin } from "./week-view";

import type { AgendaActivity } from "@/lib/queries/agenda";

export interface RdvDetailProps {
  activity: AgendaActivity;
  nowMs: number;
  phoningDay: string | null;
  /** Vue équipe / admin : afficher le collaborateur assigné. */
  showUser: boolean;
  busy: boolean;
  headingId: string;
  onValidate: (a: AgendaActivity, statut: ValidationStatut) => void;
  onEdit: (a: AgendaActivity) => void;
  onMarkDone: (a: AgendaActivity) => void;
  onReschedule: (a: AgendaActivity) => void;
  onDelete: (a: AgendaActivity) => void;
  onClose?: () => void;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
const isPhoneLike = (s: string) =>
  /^[+\d][\d\s().-]{5,}$/.test(s.trim()) && (s.match(/\d/g)?.length ?? 0) >= 6;

export function RdvDetail({
  activity: a,
  nowMs,
  phoningDay,
  showUser,
  busy,
  headingId,
  onValidate,
  onEdit,
  onMarkDone,
  onReschedule,
  onDelete,
  onClose,
}: RdvDetailProps) {
  const [askDel, setAskDel] = useState(false);

  const meta = TYPE_META[a.type];
  const hex = AGENDA_HEX[meta.tone];
  const TIcon = meta.icon;
  const dur = dureeMin(a);
  const startMs = new Date(a.date).getTime();
  const endMs = startMs + dur * 60_000;
  const state = agendaState(a, dur, nowMs);
  const client = isClientRdv(a);
  const isRdv = isRdvType(a.type);
  const dayKey = zDayKey(a.date);
  const future = startMs > nowMs;
  const open = a.statut === "PLANIFIE" || a.statut === "EN_COURS" || a.statut === "REPLANIFIE";
  const titre = a.prospect?.raisonSociale ?? a.sujet;

  // Action contextuelle (itinéraire / visio / appel)
  const lieu = a.adresseRdv?.trim() ?? "";
  const tel = normalizePhone(a.prospect?.telephone ?? a.prospect?.telephoneMobile ?? null);
  let ctx: { href: string; label: string; icon: typeof Navigation; external: boolean } | null = null;
  if (state !== "annule" && state !== "effectue") {
    if (a.type === "RDV_VISIO" && lieu && isUrl(lieu)) {
      ctx = { href: lieu, label: "Rejoindre la visio", icon: Video, external: true };
    } else if (a.type === "RDV_TELEPHONIQUE") {
      const num = lieu && isPhoneLike(lieu) ? lieu.replace(/[\s().-]/g, "") : tel;
      if (num) ctx = { href: `tel:${num}`, label: "Lancer l'appel", icon: Phone, external: false };
    } else if (a.type === "RDV_PHYSIQUE") {
      const dest = lieu && !isUrl(lieu) && !isPhoneLike(lieu) ? lieu : a.prospect?.ville ?? "";
      if (dest) {
        ctx = {
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`,
          label: "Itinéraire",
          icon: Navigation,
          external: true,
        };
      }
    } else if (a.type === "APPEL_SORTANT" || a.type === "APPEL_ENTRANT") {
      ctx = { href: "/phoning", label: "Lancer le phoning", icon: Phone, external: false };
    } else if (a.type === "EMAIL_ENVOYE" || a.type === "EMAIL_RECU") {
      ctx = { href: "/emails", label: "Ouvrir dans Emails", icon: Mail, external: false };
    }
  }

  const contactName = [a.prospect?.contactPrenom, a.prospect?.contactNom].filter(Boolean).join(" ");
  const canValidate = client && open && startMs <= nowMs;
  // « Marquer faite » : activités hors RDV client (le RDV client se valide
  // avec effectué / manqué / annulé), jamais un RDV avant son heure.
  const canMarkDone =
    (a.statut === "PLANIFIE" || a.statut === "EN_COURS") && !client && !(isRdv && future);
  const canReport = a.statut === "PLANIFIE" || a.statut === "EN_COURS" || a.statut === "REPLANIFIE";
  const lieuLabel =
    a.type === "RDV_VISIO" ? "Lien" : a.type === "RDV_TELEPHONIQUE" ? "Numéro à appeler" : "Lieu";

  return (
    <div className="flex flex-col">
      {/* Bandeau type + horaire + statut */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-4"
        style={{ background: state === "annule" ? "#F4F6FB" : hex.soft }}
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-card"
          style={{ color: hex.text }}
        >
          <TIcon className="size-[22px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-[1_1_140px]">
          <p className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: hex.text }}>
            {meta.label}
          </p>
          <p className="text-sm font-bold text-foreground">
            {formatKeyLong(dayKey)} · {zTime(startMs)} - {zTime(endMs)}
          </p>
        </div>
        <StatusPill tone={STATE_TONE[state]} className="border border-navy-700/10">
          {STATE_LABEL[state]}
        </StatusPill>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail"
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <h2
            id={headingId}
            className={cn(
              "font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] break-words text-foreground",
              state === "annule" && "line-through",
            )}
          >
            {a.prospect ? (
              <Link href={`/prospects/${a.prospect.id}`} className="hover:underline">
                {titre}
              </Link>
            ) : (
              titre
            )}
          </h2>
          {a.prospect ? (
            <p className="text-[13px] leading-snug font-medium text-muted-foreground">{a.sujet}</p>
          ) : (
            <p className="text-[13px] font-semibold text-muted-foreground italic">Note interne · sans client</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {future && state !== "annule" && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-navy-50 px-2.5 text-xs font-bold text-foreground">
                <Clock aria-hidden="true" className="size-3.5" />
                {countdownLabel(startMs, nowMs)}
              </span>
            )}
            {phoningDay && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-gold-50 px-2.5 text-xs font-bold text-gold-700">
                <Star aria-hidden="true" className="size-3.5 fill-gold-500 text-gold-700" strokeWidth={1.5} />
                Décroché au phoning le {formatKeyShort(phoningDay)}
              </span>
            )}
          </div>
        </div>

        {/* Validation d'un RDV passé (ou en cours) */}
        {canValidate && (
          <div className="flex flex-col gap-2.5 rounded-[14px] border-2 border-dashed border-alert-500 bg-coral-50 p-3.5">
            <p className="text-sm font-extrabold text-alert-700">
              {state === "en-cours"
                ? "Ce RDV a commencé : valide-le dès qu'il est terminé."
                : "Ce RDV est passé : comment ça s'est passé ?"}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => onValidate(a, "FAIT")}
                className="flex min-h-[52px] flex-col items-center justify-center rounded-[12px] bg-win-700 px-1.5 text-white transition-colors hover:bg-win-500 disabled:opacity-50"
              >
                <span className="text-sm font-extrabold">Effectué</span>
                <span className="text-[11px] font-bold">+{XP_RULES.rdvEffectue} XP</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onValidate(a, "MANQUE")}
                className="min-h-[52px] rounded-[12px] border-[1.5px] border-alert-500 bg-card px-1.5 text-sm font-extrabold text-alert-700 transition-colors hover:bg-alert-50 disabled:opacity-50"
              >
                Manqué
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onValidate(a, "ANNULE")}
                className="min-h-[52px] rounded-[12px] border border-border-strong bg-card px-1.5 text-sm font-bold text-foreground transition-colors hover:bg-navy-50 disabled:opacity-50"
              >
                Annulé
              </button>
            </div>
          </div>
        )}
        {state === "effectue" && client && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-win-50 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-win-700">
              <CircleCheck aria-hidden="true" className="size-4" />
              RDV effectué · +{XP_RULES.rdvEffectue} XP encaissés
            </p>
            <p className="text-[13px] leading-snug font-medium text-foreground">
              Prochaine marche : envoie la proposition et prends +{XP_RULES.proposition} XP de plus.
            </p>
            <Link
              href="/contrats/nouveau"
              className={cn(buttonVariants({ size: "default" }), "self-start")}
            >
              Préparer la proposition
            </Link>
          </div>
        )}
        {state === "manque" && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-alert-50 p-3.5">
            <p className="text-[13px] leading-snug font-semibold text-alert-700">
              RDV manqué. Recale un créneau vite pour garder le lead au chaud.
            </p>
            <Button type="button" variant="outline" onClick={() => onEdit(a)} className="self-start">
              <CalendarClock aria-hidden="true" />
              Recaler ce RDV
            </Button>
          </div>
        )}

        {/* Infos */}
        {(lieu || contactName || tel || a.prospect?.ville || (showUser && a.user)) && (
          <dl className="flex flex-col gap-2.5">
            {lieu && (
              <InfoRow label={lieuLabel} icon={TIcon}>
                <AdresseRdvLink adresse={lieu} size="md" />
              </InfoRow>
            )}
            {!lieu && a.prospect?.ville && (
              <InfoRow label="Localité" icon={Navigation}>
                {a.prospect.ville}
              </InfoRow>
            )}
            {contactName && (
              <InfoRow label="Contact" icon={User}>
                {contactName}
                {a.prospect?.contactFonction ? ` · ${a.prospect.contactFonction}` : ""}
              </InfoRow>
            )}
            {tel && (
              <InfoRow label="Téléphone" icon={Phone}>
                <a href={`tel:${tel}`} className="text-info-700 hover:underline">
                  {formatPhone(tel)}
                </a>
              </InfoRow>
            )}
            {showUser && a.user && (
              <InfoRow label="Assigné à" icon={User}>
                {a.user.name}
              </InfoRow>
            )}
          </dl>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {ctx && ctx.href.startsWith("/") && (
            <Link href={ctx.href} className={cn(buttonVariants({ size: "lg" }), "flex-[1_1_150px]")}>
              <ctx.icon aria-hidden="true" />
              {ctx.label}
            </Link>
          )}
          {ctx && !ctx.href.startsWith("/") && (
            <a
              href={ctx.href}
              target={ctx.external ? "_blank" : undefined}
              rel={ctx.external ? "noopener noreferrer" : undefined}
              className={cn(buttonVariants({ size: "lg" }), "flex-[1_1_150px]")}
            >
              <ctx.icon aria-hidden="true" />
              {ctx.label}
            </a>
          )}
          {a.prospect && !ctx && (
            <Link
              href={`/prospects/${a.prospect.id}`}
              className={cn(buttonVariants({ size: "lg" }), "flex-[1_1_150px]")}
            >
              <ExternalLink aria-hidden="true" />
              Ouvrir la fiche
            </Link>
          )}
          <Button type="button" variant="outline" size="lg" onClick={() => onEdit(a)}>
            <Pencil aria-hidden="true" />
            Modifier
          </Button>
          {canMarkDone && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => onMarkDone(a)}
              className="border-win-500/40 text-win-700 hover:bg-win-50 hover:text-win-700"
            >
              <Check aria-hidden="true" />
              Marquer faite
            </Button>
          )}
          {canReport && (
            <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => onReschedule(a)}>
              <Redo2 aria-hidden="true" />
              Reporter à J+1
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Supprimer l'activité"
            onClick={() => setAskDel(true)}
            className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        {askDel && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[14px] bg-alert-50 px-3.5 py-3">
            <span className="min-w-0 flex-[1_1_180px] text-[13px] font-bold text-alert-700">
              Supprimer cette activité de l&apos;agenda ?
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(a)}
              className="h-9 rounded-[10px] bg-alert-700 px-3 text-[13px] font-bold text-white transition-colors hover:bg-alert-500 disabled:opacity-50"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setAskDel(false)}
              className="h-9 rounded-[10px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground hover:bg-navy-50"
            >
              Garder
            </button>
          </div>
        )}
        {client && open && future && (
          <p className="flex items-start gap-2 text-xs leading-snug font-semibold text-muted-foreground">
            <Lock aria-hidden="true" className="mt-px size-[15px] shrink-0" />
            Validation possible dès que le RDV aura eu lieu. Pas de « fait » en avance, le CRM veille.
          </p>
        )}

        {a.contenu && (
          <div className="rounded-[14px] bg-ground p-3.5">
            <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Notes
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed font-medium whitespace-pre-wrap text-foreground">
              {a.contenu}
            </p>
          </div>
        )}

        {client && open && future && <PrepChecklist activityId={a.id} type={a.type} />}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  icon: IIcon,
  children,
}: {
  label: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ground text-muted-foreground"
      >
        <IIcon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-px text-sm font-semibold break-words text-foreground">{children}</dd>
      </div>
    </div>
  );
}
