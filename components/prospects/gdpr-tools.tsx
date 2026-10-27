"use client";

import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  eraseProspectData,
  exportProspectData,
} from "@/app/(app)/prospects/gdpr-actions";

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
      toast.success("Export RGPD téléchargé.");
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
    <section
      aria-labelledby="rgpd-titre"
      className="rounded-[20px] border border-gold-500/40 bg-gold-50/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-gold-50 text-gold-700"
        >
          <ShieldCheck className="size-[18px]" />
        </span>
        <h2 id="rgpd-titre" className="min-w-0 flex-1 text-sm font-extrabold text-gold-700">
          Données personnelles (LPD/RGPD)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-3 text-xs font-bold text-foreground hover:bg-navy-50 disabled:opacity-50"
          >
            <Download aria-hidden="true" className="size-3.5" />
            Exporter les données
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            aria-expanded={open}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-alert-500/40 bg-card px-3 text-xs font-bold text-alert-700 hover:bg-alert-50 disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Droit à l&apos;effacement
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-gold-500/30 pt-3 text-xs leading-relaxed text-gold-700">
          <p>
            Efface les <strong>données personnelles</strong> du contact (nom,
            email, téléphone, réseaux, notes) et le contenu des échanges. Si la
            fiche a des <strong>contrats</strong>, les données de facturation
            légalement obligatoires (rétention 10 ans) sont conservées
            (anonymisation) ; sinon la fiche est <strong>supprimée</strong>.
            Action irréversible.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleErase}
              disabled={pending}
              className="h-9 rounded-[10px] bg-alert-700 px-3 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Effacement..." : "Confirmer l'effacement"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="h-9 rounded-[10px] px-3 text-xs font-bold text-muted-foreground hover:underline"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
