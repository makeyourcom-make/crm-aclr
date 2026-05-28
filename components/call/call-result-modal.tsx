"use client";

/**
 * Modale obligatoire après "J'ai raccroché".
 *
 * Étapes :
 *   1. Choisir un résultat parmi 11 boutons radio colorés
 *   2. (optionnel) Notes libres
 *   3. Si résultat ∈ {COMBOX, NE_DECROCHE_PAS, A_RAPPELER, INTERESSE_PAS_PRET}
 *      → sélecteur de délai de rappel (J+1, J+2, J+3, J+7, J+14, J+30, custom)
 *   4. Si résultat = REFUS_FERME → confirmation "le prospect passera en NE_PAS_RAPPELER"
 *   5. Valider → recordCallResult() puis ferme la modale
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordCallResult } from "@/app/(app)/activites/actions";
import { useCallSession } from "@/components/call/call-session-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTIVITY_RESULTAT_COLORS,
  ACTIVITY_RESULTAT_OPTIONS,
  getActivityResultatLabel,
} from "@/lib/labels";
import { type RappelDelai } from "@/lib/schemas/activity";
import { cn } from "@/lib/utils";

import type { ActivityResultat } from "@prisma/client";

const COLOR_CLASSES: Record<string, string> = {
  emerald:
    "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  amber: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  red: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
  blue: "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100",
  slate: "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100",
};
const COLOR_CLASSES_SELECTED: Record<string, string> = {
  emerald: "ring-2 ring-emerald-500",
  amber: "ring-2 ring-amber-500",
  red: "ring-2 ring-red-500",
  blue: "ring-2 ring-blue-500",
  slate: "ring-2 ring-slate-500",
};

const DELAI_OPTIONS: { value: RappelDelai; label: string }[] = [
  { value: "J+1", label: "Demain" },
  { value: "J+2", label: "J+2" },
  { value: "J+3", label: "J+3" },
  { value: "J+7", label: "Dans 1 semaine" },
  { value: "J+14", label: "Dans 2 semaines" },
  { value: "J+30", label: "Dans 1 mois" },
  { value: "custom", label: "Date custom…" },
];

const RAPPEL_RESULTATS: ActivityResultat[] = [
  "COMBOX",
  "NE_DECROCHE_PAS",
  "A_RAPPELER",
  "INTERESSE_PAS_PRET",
];

function nowLocalIsoMinutes(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CallResultModal() {
  const router = useRouter();
  const {
    session,
    elapsedSeconds,
    resultModalOpen,
    closeResultModal,
    endCallSession,
  } = useCallSession();
  const [pending, startTransition] = useTransition();
  const [resultat, setResultat] = useState<ActivityResultat | null>(null);
  const [notes, setNotes] = useState("");
  const [rappelDelai, setRappelDelai] = useState<RappelDelai | "">("");
  const [rappelCustomDate, setRappelCustomDate] = useState(nowLocalIsoMinutes());

  if (!session) return null;

  const needsRappel = resultat && RAPPEL_RESULTATS.includes(resultat);

  const handleSubmit = () => {
    if (!resultat) {
      toast.error("Sélectionne un résultat d'appel.");
      return;
    }
    startTransition(async () => {
      const res = await recordCallResult({
        activityId: session.activityId,
        resultat,
        notesResultat: notes || undefined,
        duree2: elapsedSeconds,
        rappelDelai: needsRappel && rappelDelai ? rappelDelai : undefined,
        rappelDateCustom:
          needsRappel && rappelDelai === "custom"
            ? new Date(rappelCustomDate)
            : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      let msg = "Appel enregistré.";
      if (res.prochainActivityId) msg += " Rappel auto planifié ✓";
      if (resultat === "REFUS_FERME")
        msg = "Prospect marqué « ne pas rappeler ».";
      toast.success(msg);

      // Reset + close
      setResultat(null);
      setNotes("");
      setRappelDelai("");
      endCallSession();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={resultModalOpen}
      onOpenChange={(open) => {
        if (!open) closeResultModal();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Résultat de l&apos;appel</DialogTitle>
          <DialogDescription>
            Avec {session.prospectRaisonSociale} ·{" "}
            {Math.floor(elapsedSeconds / 60)} min{" "}
            {elapsedSeconds % 60} s
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 11 boutons radio */}
          <div>
            <Label className="text-sm">Comment ça s&apos;est passé ?</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ACTIVITY_RESULTAT_OPTIONS.map((opt) => {
                const tone = ACTIVITY_RESULTAT_COLORS[opt.value];
                const selected = resultat === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setResultat(opt.value)}
                    className={cn(
                      "rounded-md border-2 px-3 py-2 text-left text-sm font-medium transition-all",
                      COLOR_CLASSES[tone] ?? COLOR_CLASSES.slate,
                      selected &&
                        (COLOR_CLASSES_SELECTED[tone] ??
                          COLOR_CLASSES_SELECTED.slate),
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">
              Notes
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Résumé verbal de l'échange…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Avertissements selon résultat */}
          {resultat === "REFUS_FERME" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠ Le prospect passera en statut <strong>« Ne pas rappeler »</strong>
              {" "}— il ne pourra plus être contacté sauf désactivation manuelle.
            </div>
          )}
          {resultat === "INVALIDE" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠ Pense à corriger le numéro sur la fiche.
            </div>
          )}
          {resultat === "MAUVAISE_PERSONNE" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              💡 Pense à mettre à jour le contact sur la fiche.
            </div>
          )}

          {/* Replanification */}
          {needsRappel && (
            <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-3">
              <Label className="text-sm font-medium text-blue-900">
                Quand rappeler ?
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {DELAI_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setRappelDelai(d.value)}
                    className={cn(
                      "rounded-md border bg-white px-2 py-1.5 text-xs transition-colors hover:bg-blue-50",
                      rappelDelai === d.value
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : "border-border",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {rappelDelai === "custom" && (
                <Input
                  type="datetime-local"
                  value={rappelCustomDate}
                  onChange={(e) => setRappelCustomDate(e.target.value)}
                  className="mt-1"
                />
              )}
              {!rappelDelai && (
                <p className="text-xs text-muted-foreground">
                  Si tu n&apos;en choisis pas, aucun rappel ne sera planifié.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              endCallSession();
              toast("Session d'appel annulée — activité supprimée.", {
                description: "Tu n'as pas enregistré de résultat.",
              });
            }}
            disabled={pending}
          >
            Annuler la session
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !resultat}>
            {pending ? "Enregistrement…" : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper pour rendre les noms importables proprement, même si lecteur utilise
// `getActivityResultatLabel` indirectement via ACTIVITY_RESULTAT_OPTIONS.
export { getActivityResultatLabel };
