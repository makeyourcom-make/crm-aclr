/**
 * Liste de tous les objectifs (admin) : période, collaborateur, dates,
 * cibles fixées, statut (en cours / à venir / terminé / inactif) et bouton
 * de suppression. Server-safe (le bouton de suppression est client).
 */
import {
  CalendarCheck,
  Coins,
  FileCheck,
  Mail,
  Phone,
  Send,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/arena/empty-state";
import { StatusPill } from "@/components/arena/pills";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { DeleteObjectiveButton } from "@/components/common/entity-delete-buttons";
import { formatCHFCompact, formatNumber } from "@/lib/format";
import { initialsOf } from "@/lib/gamification/rules";
import { formatDateCH } from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

const PERIODE_LABEL: Record<string, string> = {
  QUOTIDIEN: "Jour",
  HEBDOMADAIRE: "Semaine",
  MENSUEL: "Mois",
  TRIMESTRIEL: "Trimestre",
  ANNUEL: "Année",
};

export interface ObjectiveListItem {
  id: string;
  periode: string;
  dateDebut: Date;
  dateFin: Date;
  isActif: boolean;
  notes: string | null;
  user: { id: string; name: string; role?: string };
  nbAppelsObjectif: number | null;
  nbEmailsObjectif: number | null;
  nbRdvObjectif: number | null;
  nbPropositionsObjectif: number | null;
  nbSignaturesObjectif: number | null;
  caObjectif: number | null;
  commissionObjectif: number | null;
}

function statusOf(o: ObjectiveListItem, now: Date) {
  if (!o.isActif) return { label: "Inactif", tone: "navy" as const };
  if (o.dateDebut.getTime() > now.getTime()) return { label: "À venir", tone: "blue" as const };
  if (o.dateFin.getTime() < now.getTime() - 86_400_000) return { label: "Terminé", tone: "navy" as const };
  return { label: "En cours", tone: "green" as const };
}

export function ObjectiveList({
  objectives,
  showUser,
}: {
  objectives: ObjectiveListItem[];
  showUser: boolean;
}) {
  if (objectives.length === 0) {
    return (
      <EmptyState
        icon={Target}
        tone="green"
        title="Aucun objectif défini"
        description="Crée le premier ci-dessous : la commerciale verra sa progression et sa projection fin de mois en direct."
      />
    );
  }
  const now = new Date();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {objectives.map((o) => {
        const st = statusOf(o, now);
        const targets: { icon: LucideIcon; label: string; strong?: boolean }[] = [];
        if (o.nbAppelsObjectif != null) targets.push({ icon: Phone, label: `${formatNumber(o.nbAppelsObjectif)} appels` });
        if (o.nbEmailsObjectif != null) targets.push({ icon: Mail, label: `${formatNumber(o.nbEmailsObjectif)} emails` });
        if (o.nbRdvObjectif != null) targets.push({ icon: CalendarCheck, label: `${formatNumber(o.nbRdvObjectif)} RDV` });
        if (o.nbPropositionsObjectif != null) targets.push({ icon: Send, label: `${formatNumber(o.nbPropositionsObjectif)} propositions` });
        if (o.nbSignaturesObjectif != null) targets.push({ icon: FileCheck, label: `${formatNumber(o.nbSignaturesObjectif)} signatures` });
        if (o.caObjectif != null) targets.push({ icon: Trophy, label: `${formatCHFCompact(o.caObjectif)} CA`, strong: true });
        if (o.commissionObjectif != null) targets.push({ icon: Coins, label: `${formatCHFCompact(o.commissionObjectif)} de commission` });
        return (
          <article
            key={o.id}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-[16px] border border-border p-4",
              // Pas d'opacité (contraste ≥ 4.5:1) : fond atténué + pastille de statut.
              st.label === "Terminé" || st.label === "Inactif" ? "bg-ground" : "bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="inline-flex h-6 items-center rounded-full bg-navy-50 px-2.5 text-xs font-bold text-navy-700">
                  {PERIODE_LABEL[o.periode] ?? o.periode}
                </span>
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              </div>
              <DeleteObjectiveButton objectiveId={o.id} />
            </div>
            {showUser && (
              <div className="flex min-w-0 items-center gap-2">
                <PlayerAvatar
                  initials={initialsOf(o.user.name)}
                  tone={o.user.role === "ADMIN" ? "navy" : "coral"}
                  size="xs"
                />
                <span className="truncate text-sm font-bold text-foreground">{o.user.name}</span>
              </div>
            )}
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">
              Du {formatDateCH(o.dateDebut)} au {formatDateCH(o.dateFin)}
            </p>
            {targets.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {targets.map((t) => (
                  <li key={t.label} className={cn("flex items-center gap-2", t.strong && "font-bold")}>
                    <t.icon aria-hidden="true" className="size-4 shrink-0 text-subtle" />
                    <span className="tabular-nums">{t.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune cible chiffrée.</p>
            )}
            {o.notes && (
              <p className="rounded-[10px] bg-ground px-3 py-2 text-xs font-medium text-muted-foreground">
                {o.notes}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
