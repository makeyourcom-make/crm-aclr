"use client";

/**
 * Checklist « Préparer le RDV » : quelques réflexes avant un RDV client.
 *
 * Aucune colonne en base pour ça (pas de changement de schéma) : les cases
 * cochées sont gardées sur l'appareil (localStorage), par RDV. Lecture via
 * useSyncExternalStore (pas de setState dans un effet), écriture au clic.
 */
import type { ActivityType } from "@prisma/client";
import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";

import { ProgressRing } from "@/components/arena/progress-ring";
import { cn } from "@/lib/utils";

const ITEMS: Partial<Record<ActivityType, string[]>> = {
  RDV_PHYSIQUE: [
    "Relire la fiche et l'historique d'appels",
    "Préparer l'offre adaptée (prix, exemples)",
    "Vérifier l'itinéraire et le temps de trajet",
    "Confirmer le RDV la veille",
  ],
  RDV_VISIO: [
    "Tester le lien visio et le partage d'écran",
    "Relire la fiche et l'historique d'appels",
    "Préparer 2 cas clients à montrer",
    "Confirmer le RDV la veille",
  ],
  RDV_TELEPHONIQUE: [
    "Relire la fiche et l'historique d'appels",
    "Préparer tes questions de découverte",
    "Préparer l'offre adaptée",
    "Confirmer le RDV la veille",
  ],
};

const listeners = new Set<() => void>();
const storageKey = (id: string) => `myc-agenda-prep:${id}`;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(id: string): string {
  try {
    return window.localStorage.getItem(storageKey(id)) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string, n: number): boolean[] {
  try {
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.from({ length: n }, (_, i) => Array.isArray(arr) && arr[i] === true);
  } catch {
    return Array.from({ length: n }, () => false);
  }
}

export function PrepChecklist({ activityId, type }: { activityId: string; type: ActivityType }) {
  const items = ITEMS[type] ?? ITEMS.RDV_PHYSIQUE!;
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(activityId),
    () => "",
  );
  const done = parse(raw, items.length);
  const nDone = done.filter(Boolean).length;
  const rest = items.length - nDone;

  const toggle = (i: number) => {
    const next = done.map((v, j) => (j === i ? !v : v));
    try {
      window.localStorage.setItem(storageKey(activityId), JSON.stringify(next));
    } catch {
      // stockage indisponible (navigation privée) : on ignore
    }
    for (const l of listeners) l();
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border p-3.5">
      <div className="flex items-center gap-3">
        <ProgressRing
          value={nDone}
          max={items.length}
          size={44}
          stroke={5}
          tone="green"
          label={`Préparation : ${nDone} sur ${items.length}`}
        >
          <span className="text-[11px] font-extrabold">{nDone}/{items.length}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold text-foreground">Préparer le RDV</h3>
          <p className="text-xs font-semibold text-muted-foreground">
            {rest === 0
              ? "Tout est prêt : va chercher la signature."
              : `Encore ${rest} point${rest > 1 ? "s" : ""} et tu arrives au top.`}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((label, i) => {
          const on = done[i];
          return (
            <li key={label}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(i)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                  on ? "bg-win-50 text-muted-foreground" : "bg-ground text-foreground hover:bg-navy-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 text-white",
                    on ? "border-win-500 bg-win-500" : "border-subtle bg-card",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3.5} />}
                </span>
                <span className={cn(on && "line-through")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] font-semibold text-muted-foreground">
        Cases gardées sur cet appareil.
      </p>
    </div>
  );
}
