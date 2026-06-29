"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  eraseProspectData,
  exportProspectData,
} from "@/app/(app)/prospects/gdpr-actions";
import { Icon } from "@/components/icon";

export function GdprTools({
  prospectId,
  raisonSociale,
}: {
  prospectId: string;
  raisonSociale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleExport = () =>
    startTransition(async () => {
      const res = await exportProspectData(prospectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-rgpd-${raisonSociale.replace(/[^\w]+/g, "_").slice(0, 40)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export RGPD téléchargé ✓");
    });

  const handleErase = () =>
    startTransition(async () => {
      const res = await eraseProspectData(prospectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.mode === "deleted") {
        toast.success("Fiche et données supprimées définitivement.");
        router.push("/prospects");
      } else {
        toast.success(
          "Données personnelles anonymisées (facturation légale conservée).",
        );
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="Eye" className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">
          Données personnelles (LPD/RGPD)
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <Icon name="Download" className="h-3.5 w-3.5" />
            Exporter les données
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-background px-2.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Icon name="Trash2" className="h-3.5 w-3.5" />
            Droit à l&apos;effacement
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3 text-xs text-amber-900">
          <p>
            Efface les <strong>données personnelles</strong> du contact (nom,
            email, téléphone, réseaux, notes) et le contenu des échanges. Si la
            fiche a des <strong>contrats</strong>, les données de facturation
            légalement obligatoires (rétention 10 ans) sont conservées
            (anonymisation) ; sinon la fiche est <strong>supprimée</strong>.
            Action irréversible.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleErase}
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "…" : "Confirmer l'effacement"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:underline"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
