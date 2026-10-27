"use client";

/**
 * « RDV à valider » : RDV client dont l'heure est passée (14 derniers jours),
 * à qualifier effectué / manqué / annulé avec l'action serveur existante
 * `validerRdv` (droits + garde-fou « pas avant l'heure » côté serveur).
 *
 * Effectué → toast +80 XP (barème du moteur) ; puis router.refresh() pour
 * la liste, les compteurs et les pilules XP de la topbar.
 */
import { CalendarCheck, Check, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { validerRdv } from "@/app/(app)/activites/actions";
import { xpToast } from "@/components/arena/celebrate";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { XP_RULES } from "@/lib/gamification/rules";
import type { RdvAValiderItem } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

import { TASK_TYPE_META } from "./task-meta";

type Statut = "FAIT" | "MANQUE" | "ANNULE";

const SECONDARY =
  "inline-flex h-10 flex-[1_1_110px] items-center justify-center rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50 disabled:opacity-50";

export function RdvValidation({ items }: { items: RdvAValiderItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handled, setHandled] = useState<string[]>([]);
  const restants = items.filter((r) => !handled.includes(r.id));

  const valider = (item: RdvAValiderItem, statut: Statut) => {
    setBusyId(item.id);
    startTransition(async () => {
      const res = await validerRdv(item.id, statut);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setHandled((h) => [...h, item.id]);
      if (statut === "FAIT") xpToast(XP_RULES.rdvEffectue, "RDV effectué !", item.raisonSociale);
      else if (statut === "MANQUE") toast.success("RDV noté comme manqué. Pense à le replanifier.");
      else toast.success("RDV noté comme annulé.");
      router.refresh();
    });
  };

  return (
    <SectionCard
      id="rdv-a-valider"
      className="scroll-mt-20"
      title="RDV à valider"
      icon={CalendarCheck}
      tone="gold"
      description="Heure passée : dis comment ça s'est passé"
      action={
        <StatusPill tone={restants.length > 0 ? "red" : "green"} dot={false}>
          {restants.length} en attente
        </StatusPill>
      }
    >
      <div className="flex flex-col gap-3">
        {restants.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-[14px] bg-win-50 px-3.5 py-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-win-700 text-white"
            >
              <Check className="size-4" strokeWidth={3} />
            </span>
            <div>
              <div className="text-sm font-extrabold text-win-700">Zéro RDV en attente</div>
              <div className="text-xs text-win-700">Tous tes RDV passés sont validés.</div>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {restants.map((r) => {
              const meta = TASK_TYPE_META[r.type];
              const busy = pending && busyId === r.id;
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      aria-hidden="true"
                      className="w-14 shrink-0 rounded-[12px] bg-navy-700 py-2 text-center text-white"
                    >
                      <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
                        {r.jourAbbr}
                      </div>
                      <div className="font-display text-[22px] leading-tight font-extrabold">
                        {r.jourNum}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold break-words">
                        <Link
                          href={`/prospects/${r.prospectId}`}
                          className="text-foreground hover:underline"
                        >
                          {r.raisonSociale}
                        </Link>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">
                        {r.quand} · {r.heure} · {meta.label}
                        {r.ville ? ` · ${r.ville}` : ""}
                      </div>
                      {r.adresse && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                          <span className="min-w-0 break-words">{r.adresse}</span>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusPill tone="gold" dot={false}>
                          {meta.label}
                        </StatusPill>
                        <StatusPill tone="red">À valider</StatusPill>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => valider(r, "FAIT")}
                      aria-label={`RDV effectué : ${r.raisonSociale}, +${XP_RULES.rdvEffectue} XP`}
                      className="inline-flex h-11 flex-[1_1_100%] items-center justify-center gap-2 rounded-[12px] bg-win-700 px-4 text-sm font-extrabold text-white transition-colors hover:bg-win-700/90 disabled:opacity-60"
                    >
                      <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                      {busy ? "Validation..." : "RDV effectué"}
                      <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-extrabold text-gold-700">
                        +{XP_RULES.rdvEffectue} XP
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => valider(r, "MANQUE")}
                      aria-label={`Pas eu lieu : ${r.raisonSociale}`}
                      className={SECONDARY}
                    >
                      Pas eu lieu
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => valider(r, "ANNULE")}
                      aria-label={`Annulé : ${r.raisonSociale}`}
                      className={SECONDARY}
                    >
                      Annulé
                    </button>
                    <Link href="/agenda" className={cn(SECONDARY, "whitespace-nowrap")}>
                      Replanifier
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Un RDV ne peut pas être validé avant son heure : les prochains arriveront ici une fois
          passés. Chaque RDV effectué rapporte +{XP_RULES.rdvEffectue} XP.
        </p>
      </div>
    </SectionCard>
  );
}
