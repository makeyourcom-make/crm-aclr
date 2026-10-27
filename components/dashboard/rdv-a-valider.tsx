"use client";

/**
 * Rappel de fin de journée : RDV passés à valider (effectué / manqué / annulé).
 * Un RDV n'est compté « effectué » qu'une fois validé ici ou dans l'agenda.
 *
 * MYC Arena : carte bleue (rouge si des RDV des jours précédents traînent),
 * gros boutons 44 px, « Effectué » rapporte +80 XP (toast XP + rafraîchissement
 * de la coquille pour mettre à jour les pilules XP / série).
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarClock, Check, CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { validerRdv } from "@/app/(app)/activites/actions";
import { xpToast } from "@/components/arena/celebrate";
import { XpPill } from "@/components/arena/pills";
import { Button } from "@/components/ui/button";
import { XP_RULES } from "@/lib/gamification/rules";
import type { RdvAValider } from "@/lib/queries/rdv-a-valider";
import { cn } from "@/lib/utils";

import { relativeDay, zDayKey, zTime } from "./dates";

type Statut = "FAIT" | "MANQUE" | "ANNULE";

const TOAST: Record<Exclude<Statut, "FAIT">, string> = {
  MANQUE: "RDV noté comme manqué.",
  ANNULE: "RDV noté comme annulé.",
};

interface Traite {
  id: string;
  statut: Statut;
  nom: string;
  /** RDV d'un jour précédent : ses XP comptent pour ce jour-là, pas pour aujourd'hui. */
  ancien: boolean;
}

function nomDe(r: RdvAValider): string {
  return r.raisonSociale ?? r.sujet;
}

export function RdvAValiderBanner({
  rdvs,
  today,
  className,
}: {
  rdvs: RdvAValider[];
  /** Clé « AAAA-MM-JJ » du jour (Europe/Zurich). */
  today: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [traites, setTraites] = useState<Traite[]>([]);
  const restants = rdvs.filter((r) => !traites.some((t) => t.id === r.id));
  const dernier = traites.length > 0 ? traites[traites.length - 1] : null;
  if (restants.length === 0 && !dernier) return null;

  const anciens = restants.some((r) => zDayKey(r.date) < today);

  const valider = (r: RdvAValider, statut: Statut) =>
    startTransition(async () => {
      const res = await validerRdv(r.id, statut);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      const nom = nomDe(r);
      const ancien = zDayKey(r.date) < today;
      setTraites((t) => [...t, { id: r.id, statut, nom, ancien }]);
      if (statut === "FAIT") {
        xpToast(XP_RULES.rdvEffectue, "RDV effectué !", nom);
      } else {
        toast.success(TOAST[statut]);
      }
      // Met à jour le dashboard ET la coquille (pilules XP / série).
      router.refresh();
    });

  const tone =
    restants.length > 0
      ? anciens
        ? "border-alert-500/30 bg-alert-50"
        : "border-info-500/30 bg-info-50"
      : dernier?.statut === "FAIT"
        ? "border-win-500/30 bg-win-50"
        : dernier?.statut === "MANQUE"
          ? "border-gold-500/40 bg-gold-50"
          : "border-border-strong bg-navy-50";

  return (
    <div
      role="region"
      aria-label="Rendez-vous à valider"
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-[20px] border p-4 sm:p-5",
        tone,
        className,
      )}
    >
      {dernier && <Confirmation traite={dernier} compact={restants.length > 0} />}

      {restants.length > 0 && (
        <>
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-card",
                anciens ? "text-alert-700" : "text-info-700",
              )}
            >
              {anciens ? (
                <CalendarClock className="size-5" />
              ) : (
                <CalendarCheck className="size-5" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={cn(
                  "text-[11px] font-bold tracking-[0.08em] uppercase",
                  anciens ? "text-alert-700" : "text-info-700",
                )}
              >
                {restants.length === 1
                  ? "1 rendez-vous à valider"
                  : `${restants.length} rendez-vous à valider`}
              </span>
              <span className="text-[13px] font-medium text-muted-foreground">
                L&apos;heure est passée : indique pour chacun s&apos;il a bien eu lieu
                {anciens ? " (certains datent des jours précédents)" : ""}.
              </span>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-navy-700/10">
            {restants.map((r) => {
              const nom = nomDe(r);
              const meta = [
                `${relativeDay(r.date, today)} ${zTime(r.date)}`,
                r.typeLabel,
                r.lieu,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {r.prospectId ? (
                      <Link
                        href={`/prospects/${r.prospectId}`}
                        className="truncate text-base font-extrabold text-foreground hover:underline sm:text-[17px]"
                      >
                        {nom}
                      </Link>
                    ) : (
                      <span className="truncate text-base font-extrabold text-foreground sm:text-[17px]">
                        {nom}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {meta}
                      {r.raisonSociale && r.sujet !== r.raisonSociale && (
                        <> · {r.sujet}</>
                      )}
                    </span>
                  </div>
                  <div
                    role="group"
                    aria-label={`Résultat du rendez-vous ${nom}`}
                    className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
                  >
                    <Button
                      type="button"
                      size="lg"
                      disabled={pending}
                      onClick={() => valider(r, "FAIT")}
                      className="col-span-2 bg-win-700 font-extrabold text-white hover:bg-win-700/90"
                    >
                      <Check aria-hidden="true" strokeWidth={2.6} />
                      Effectué
                      <XpPill xp={XP_RULES.rdvEffectue} variant="solid" />
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      disabled={pending}
                      onClick={() => valider(r, "MANQUE")}
                    >
                      Manqué
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      disabled={pending}
                      onClick={() => valider(r, "ANNULE")}
                    >
                      Annulé
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** Retour visuel du dernier RDV traité (annoncé aux lecteurs d'écran). */
function Confirmation({ traite, compact }: { traite: Traite; compact: boolean }) {
  const fait = traite.statut === "FAIT";
  const titre = fait
    ? "Bien joué : RDV effectué !"
    : traite.statut === "MANQUE"
      ? "RDV noté comme manqué"
      : "RDV noté comme annulé";
  const texte = fait
    ? `${traite.nom} passe en Fait · +${XP_RULES.rdvEffectue} XP ajoutés ${traite.ancien ? "à ton total (comptés le jour du RDV)" : "à ton score du jour"}.`
    : traite.statut === "MANQUE"
      ? `${traite.nom} · propose vite un nouveau créneau pour garder le lead chaud.`
      : `${traite.nom} sort de ta liste à valider.`;
  const couleur = fait
    ? "text-win-700"
    : traite.statut === "MANQUE"
      ? "text-gold-700"
      : "text-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-start gap-3",
        compact && "rounded-[14px] bg-card/80 p-3",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[12px] bg-card",
          compact ? "size-9" : "size-11",
          couleur,
        )}
      >
        <CircleCheck className={compact ? "size-[18px]" : "size-5"} strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className={cn("font-extrabold", compact ? "text-sm" : "text-base", couleur)}>
          {titre}
        </span>
        <span className="text-[13px] font-medium text-foreground">{texte}</span>
      </div>
      {!fait && (
        <Link
          href="/agenda"
          className="inline-flex h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-navy-600"
        >
          Replanifier dans l&apos;agenda
        </Link>
      )}
    </div>
  );
}
