"use client";

/**
 * Rappel de fin de journée : RDV passés à valider (effectué / manqué / annulé).
 * Un RDV n'est compté « effectué » qu'une fois validé ici ou dans l'agenda.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { validerRdv } from "@/app/(app)/activites/actions";
import { Icon } from "@/components/icon";
import type { RdvAValider } from "@/lib/queries/rdv-a-valider";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { statut: "FAIT", label: "Effectué", className: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
  { statut: "MANQUE", label: "Manqué", className: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" },
  { statut: "ANNULE", label: "Annulé", className: "border-border bg-background text-muted-foreground hover:bg-muted" },
] as const;

const TOAST: Record<(typeof ACTIONS)[number]["statut"], string> = {
  FAIT: "RDV validé comme effectué ✓",
  MANQUE: "RDV noté comme manqué.",
  ANNULE: "RDV noté comme annulé.",
};

function quand(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "2-digit", month: "2-digit" });
  const heure = d.toLocaleTimeString("fr-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
  return `${jour} · ${heure}`;
}

export function RdvAValiderBanner({ rdvs, today }: { rdvs: RdvAValider[]; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [faits, setFaits] = useState<string[]>([]);
  const restants = rdvs.filter((r) => !faits.includes(r.id));
  if (restants.length === 0) return null;

  const anciens = restants.some(
    (r) => new Date(r.date).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }) < today,
  );

  const valider = (id: string, statut: (typeof ACTIONS)[number]["statut"]) =>
    startTransition(async () => {
      const res = await validerRdv(id, statut);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setFaits((f) => [...f, id]);
      toast.success(TOAST[statut]);
      router.refresh();
    });

  return (
    <div
      className={cn(
        "mt-6 rounded-lg border px-4 py-3 text-sm",
        anciens ? "border-red-300 bg-red-50 text-red-900" : "border-sky-300 bg-sky-50 text-sky-900",
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="CalendarRange" className="h-4 w-4" />
        {restants.length === 1 ? "1 rendez-vous à valider" : `${restants.length} rendez-vous à valider`}
        <span className="font-normal opacity-80">
          · indique pour chacun s&apos;il a bien eu lieu
        </span>
      </p>
      <ul className="mt-2 divide-y divide-black/10">
        {restants.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
            <span className="w-32 shrink-0 text-xs tabular-nums opacity-80">{quand(r.date)}</span>
            <span className="min-w-0 flex-1 truncate">
              {r.prospectId ? (
                <Link href={`/prospects/${r.prospectId}`} className="font-medium hover:underline">
                  {r.raisonSociale ?? r.sujet}
                </Link>
              ) : (
                <span className="font-medium">{r.sujet}</span>
              )}
              {r.raisonSociale && r.sujet !== r.raisonSociale && (
                <span className="text-xs opacity-70"> · {r.sujet}</span>
              )}
            </span>
            <span className="flex gap-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a.statut}
                  type="button"
                  disabled={pending}
                  onClick={() => valider(r.id, a.statut)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50", a.className)}
                >
                  {a.label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
