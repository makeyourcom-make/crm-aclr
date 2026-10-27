/**
 * Bas de page de la rubrique Emails (MYC Arena) : performance des mails.
 *
 * - Classement mails · 7 jours (boîtes privées : seuls les chiffres sont
 *   partagés) + comparaison au record hebdomadaire.
 * - Livraison de tes envois sur 7 jours (rebonds à corriger, avec lien).
 * - Résumé des filtres anti-spam (règles les plus efficaces) + lien de gestion.
 *
 * Données réelles uniquement (`getMailArenaStats`, règles anti-spam).
 * Server component.
 */
import Link from "next/link";
import { AlertTriangle, MailCheck, ShieldCheck, Trophy } from "lucide-react";

import { formatInt, pctOf } from "@/components/arena/format";
import { Meter } from "@/components/arena/meter";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { cn } from "@/lib/utils";

import type { MailArenaStats } from "@/app/(app)/emails/arena-stats";

const RULE_TYPE_LABEL: Record<string, string> = {
  SENDER: "Expéditeur",
  DOMAIN: "Domaine",
  SUBJECT: "Sujet contient",
};

export interface SpamOverview {
  active: number;
  total: number;
  blocked: number;
  top: { id: string; type: string; value: string; nbBloques: number; actif: boolean }[];
}

export function EmailsPerformance({
  stats,
  spam,
}: {
  stats: MailArenaStats;
  spam: SpamOverview;
}) {
  const maxSent = Math.max(1, ...stats.leaderboard.map((e) => e.sent));
  const beatRecord = stats.sentThisWeek > 0 && stats.sentThisWeek >= stats.bestWeekSent;
  const toRecord = Math.max(0, stats.bestWeekSent - stats.sentThisWeek);
  const deliveredPct = pctOf(stats.delivery.delivered, stats.delivery.sent);

  return (
    <section
      aria-label="Performance mails"
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]"
    >
      {/* Classement */}
      <SectionCard
        title="Classement mails · 7 j"
        icon={Trophy}
        tone="gold"
        description="Boîtes privées : seuls les chiffres sont partagés"
      >
        <ol className="flex flex-col gap-3.5">
          {stats.leaderboard.map((e) => (
            <li key={e.userId} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-6 shrink-0 font-display text-lg font-extrabold tabular-nums",
                  e.rank === 1 ? "text-gold-700" : "text-muted-foreground",
                )}
              >
                {e.rank}
              </span>
              <PlayerAvatar initials={e.initials} tone={e.isMe ? "coral" : "navy"} size={34} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
                  <span className="min-w-0 truncate font-extrabold text-foreground">
                    {e.name}
                    {e.isMe && <span className="font-semibold text-muted-foreground"> (toi)</span>}
                  </span>
                  <span className="font-semibold text-muted-foreground tabular-nums">
                    {formatInt(e.sent)} envoyé{e.sent > 1 ? "s" : ""} · {formatInt(e.replies)} réponse
                    {e.replies > 1 ? "s" : ""}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-2 overflow-hidden rounded-full bg-navy-50"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      e.isMe ? "bg-gradient-coral" : "bg-navy-500",
                    )}
                    style={{ width: `${pctOf(e.sent, maxSent)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-[12px] bg-gold-50 px-3 py-2.5 text-[13px] font-bold text-gold-700">
          {stats.bestWeekSent === 0
            ? "Lance ta première semaine de mails : chaque envoi compte."
            : beatRecord
              ? `Record de la semaine en vue : ${formatInt(stats.sentThisWeek)} mails, ton meilleur total !`
              : `Cette semaine : ${formatInt(stats.sentThisWeek)} mail${stats.sentThisWeek > 1 ? "s" : ""} · vs ton record : ${formatInt(stats.bestWeekSent)} en une semaine, encore ${formatInt(toRecord)} pour l'égaler`}
        </p>
      </SectionCard>

      {/* Livraison */}
      <SectionCard
        title="Livraison · 7 j"
        icon={MailCheck}
        tone="teal"
        description="Ce que deviennent tes mails envoyés"
      >
        <div className="flex flex-col gap-4">
          <Meter
            value={stats.delivery.delivered}
            max={Math.max(stats.delivery.sent, 1)}
            tone="teal"
            size="lg"
            label="Mails livrés"
            valueLabel={
              <>
                <strong className="font-display text-base font-extrabold text-foreground">
                  {deliveredPct} %
                </strong>{" "}
                · {formatInt(stats.delivery.delivered)} / {formatInt(stats.delivery.sent)}
              </>
            }
          />
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="blue">{formatInt(stats.delivery.delivered)} livrés</StatusPill>
            {stats.delivery.pending > 0 && (
              <StatusPill tone="navy">{formatInt(stats.delivery.pending)} en cours</StatusPill>
            )}
            <StatusPill tone={stats.delivery.failed > 0 ? "red" : "green"}>
              {formatInt(stats.delivery.failed)} rebond{stats.delivery.failed > 1 ? "s" : ""} ou erreur
              {stats.delivery.failed > 1 ? "s" : ""}
            </StatusPill>
          </div>
          {stats.bounces.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {stats.bounces.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/emails/${b.id}`}
                    className="flex items-start gap-2.5 rounded-[12px] border border-alert-50 bg-alert-50/60 px-3 py-2.5 transition-colors hover:border-alert-500"
                  >
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-alert-700"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-foreground">
                        {b.destinataire}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.statut === "ERREUR" ? "Erreur d'envoi" : "Rebond"} · {b.objet}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="text-xs font-semibold text-muted-foreground">
                Vérifie l&apos;adresse sur la fiche du client puis renvoie le mail.
              </li>
            </ul>
          ) : (
            <p className="rounded-[12px] bg-win-50 px-3 py-2.5 text-[13px] font-bold text-win-700">
              {stats.delivery.sent > 0
                ? "Zéro rebond cette semaine : tes adresses sont propres."
                : "Aucun mail envoyé sur les 7 derniers jours."}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Filtres anti-spam */}
      <SectionCard
        id="filtres"
        title="Filtres anti-spam"
        icon={ShieldCheck}
        tone="teal"
        description={`${formatInt(spam.active)} règle${spam.active > 1 ? "s" : ""} active${spam.active > 1 ? "s" : ""} · ${formatInt(spam.blocked)} mail${spam.blocked > 1 ? "s" : ""} bloqué${spam.blocked > 1 ? "s" : ""}`}
        action={
          <Link
            href="/emails/filtres"
            className="inline-flex h-9 items-center rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50"
          >
            Gérer
          </Link>
        }
      >
        {spam.top.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {spam.top.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed px-2.5 py-2",
                  r.actif ? "border-transparent bg-ground" : "border-border-strong bg-card",
                )}
              >
                <span className="rounded-full border border-border-strong bg-card px-2 py-0.5 text-[11px] font-bold text-navy-600">
                  {RULE_TYPE_LABEL[r.type] ?? r.type}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-[1_1_120px] truncate font-mono text-[13px] font-bold",
                    r.actif ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {r.value}
                </span>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {formatInt(r.nbBloques)} bloqué{r.nbBloques > 1 ? "s" : ""}
                </span>
                <StatusPill tone={r.actif ? "green" : "navy"} dot={false}>
                  {r.actif ? "Actif" : "Inactif"}
                </StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Aucune règle pour l&apos;instant. Bloque un expéditeur depuis un mail
            indésirable (bouclier) ou ajoute une règle.
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Les mails filtrés à la réception partent dans Spam (jamais perdus) et un
          mail rattaché à un client n&apos;est jamais classé en spam.
        </p>
      </SectionCard>
    </section>
  );
}
