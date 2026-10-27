/**
 * Historique MYC Arena d'une fiche : à venir puis passé, une tuile colorée
 * par type (appel coral, email teal, RDV or), statut, résultat, rappel auto,
 * lieu, notes, durée et les XP réellement rapportés par chaque action
 * (mêmes règles que le moteur de jeu). Server-safe.
 */
import type { Activity, ActivityResultat, ActivityType, User } from "@prisma/client";
import {
  CalendarDays,
  Globe,
  Mail,
  MailOpen,
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { AdresseRdvLink } from "@/components/activities/adresse-rdv-link";
import { formatDuration } from "@/lib/format";
import {
  getActivityResultatLabel,
  getActivityStatutLabel,
  getActivityTypeLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import { activityXp } from "./lead-heat";
import { fmtDate, fmtTime, relativeDayLabel } from "./zurich-format";

export type TimelineActivity = Activity & {
  user?: Pick<User, "id" | "name"> | null;
  rappelLeDe?: Pick<Activity, "id" | "type" | "date"> | null;
};

const KIND: Record<ActivityType, { icon: LucideIcon; tile: string }> = {
  APPEL_SORTANT: { icon: PhoneOutgoing, tile: "bg-coral-50 text-coral-600" },
  APPEL_ENTRANT: { icon: PhoneIncoming, tile: "bg-coral-50 text-coral-600" },
  EMAIL_ENVOYE: { icon: Mail, tile: "bg-mail-50 text-mail-700" },
  EMAIL_RECU: { icon: MailOpen, tile: "bg-mail-50 text-mail-700" },
  RDV_PHYSIQUE: { icon: CalendarDays, tile: "bg-gold-50 text-gold-700" },
  RDV_VISIO: { icon: Video, tile: "bg-gold-50 text-gold-700" },
  RDV_TELEPHONIQUE: { icon: CalendarDays, tile: "bg-gold-50 text-gold-700" },
  SMS: { icon: MessageSquare, tile: "bg-info-50 text-info-700" },
  LINKEDIN: { icon: Globe, tile: "bg-info-50 text-info-700" },
  NOTE: { icon: StickyNote, tile: "bg-navy-50 text-navy-500" },
};

const STATUT_PILL: Record<string, string> = {
  PLANIFIE: "bg-info-50 text-info-700",
  EN_COURS: "bg-gold-50 text-gold-700",
  FAIT: "bg-win-50 text-win-700",
  MANQUE: "bg-alert-50 text-alert-700",
  REPLANIFIE: "bg-navy-50 text-navy-500",
  ANNULE: "bg-navy-50 text-muted-foreground",
};

const RESULTAT_PILL: Partial<Record<ActivityResultat, string>> = {
  RDV_PRIS: "bg-win-50 text-win-700",
  REFUS_FERME: "bg-alert-50 text-alert-700",
  INVALIDE: "bg-alert-50 text-alert-700",
  COMBOX: "bg-gold-50 text-gold-700",
  NE_DECROCHE_PAS: "bg-gold-50 text-gold-700",
  A_RAPPELER: "bg-info-50 text-info-700",
  INTERESSE_PAS_PRET: "bg-info-50 text-info-700",
};

export function ProspectTimeline({
  activities,
  nowMs,
  showUser = false,
}: {
  activities: TimelineActivity[];
  nowMs: number;
  showUser?: boolean;
}) {
  const upcoming = activities
    .filter(
      (a) =>
        a.date.getTime() > nowMs &&
        (a.statut === "PLANIFIE" || a.statut === "EN_COURS"),
    )
    // Le plus proche en premier.
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = activities.filter((a) => !upcoming.includes(a));

  return (
    <div className="flex flex-col gap-5">
      {upcoming.length > 0 && (
        <Group title="À venir">
          {upcoming.map((a) => (
            <Item key={a.id} a={a} nowMs={nowMs} showUser={showUser} />
          ))}
        </Group>
      )}
      {past.length > 0 && (
        <Group title={upcoming.length > 0 ? "Historique" : undefined}>
          {past.map((a) => (
            <Item key={a.id} a={a} nowMs={nowMs} showUser={showUser} />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && (
        <h3 className="mb-2.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      <ol className="flex flex-col">{children}</ol>
    </div>
  );
}

function Item({
  a,
  nowMs,
  showUser,
}: {
  a: TimelineActivity;
  nowMs: number;
  showUser: boolean;
}) {
  const kind = KIND[a.type];
  const Icon = kind.icon;
  const xp = activityXp(a, nowMs);
  const rel = relativeDayLabel(a.date, nowMs);

  return (
    <li className="group relative flex gap-3 pb-4 last:pb-0">
      {/* Fil de la timeline */}
      <span
        aria-hidden="true"
        className="absolute top-9 bottom-1 left-4 w-px bg-border group-last:hidden"
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-[10px]",
          kind.tile,
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-extrabold">{getActivityTypeLabel(a.type)}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              STATUT_PILL[a.statut] ?? "bg-navy-50 text-navy-500",
            )}
          >
            {getActivityStatutLabel(a.statut)}
          </span>
          {a.resultat && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                RESULTAT_PILL[a.resultat] ?? "bg-navy-50 text-navy-500",
              )}
            >
              {getActivityResultatLabel(a.resultat)}
            </span>
          )}
          {xp > 0 && (
            <span className="ml-auto rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-extrabold text-gold-700 tabular-nums">
              +{xp} XP
            </span>
          )}
        </div>

        {a.rappelLeDe && (
          <span className="text-[11px] font-semibold text-muted-foreground">
            Rappel auto suite à {getActivityTypeLabel(a.rappelLeDe.type).toLowerCase()} du{" "}
            {fmtDate(a.rappelLeDe.date)}
          </span>
        )}

        {a.emailId ? (
          <Link
            href={`/emails/${a.emailId}`}
            className="text-[13px] leading-snug font-semibold break-words text-info-700 hover:underline"
          >
            {a.sujet}
          </Link>
        ) : (
          <p className="text-[13px] leading-snug break-words text-navy-500">{a.sujet}</p>
        )}

        {a.adresseRdv && <AdresseRdvLink adresse={a.adresseRdv} size="md" />}

        {a.notesResultat && (
          <p className="rounded-[10px] bg-ground px-3 py-1.5 text-xs leading-relaxed break-words text-navy-500">
            « {a.notesResultat} »
          </p>
        )}
        {a.contenu && !a.notesResultat && (
          <p className="line-clamp-2 text-xs break-words text-muted-foreground">{a.contenu}</p>
        )}

        <div className="flex flex-wrap gap-x-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          <span>
            {fmtDate(a.date)} · {fmtTime(a.date)}
          </span>
          {rel && <span>· {rel}</span>}
          {a.duree2 ? (
            <span>· durée {formatDuration(a.duree2)}</span>
          ) : a.duree ? (
            <span>· {a.duree} min</span>
          ) : null}
          {showUser && a.user && <span>· {a.user.name}</span>}
        </div>
      </div>
    </li>
  );
}
