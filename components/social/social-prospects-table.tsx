"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteSocialProspect,
  updateProspectStatut,
} from "@/app/(app)/social/actions";
import { Icon } from "@/components/icon";
import {
  NETWORK_COLORS,
  NETWORK_LABELS,
} from "@/lib/social-sequence";

export interface SocialProspectRow {
  id: string;
  nom: string;
  profilUrl: string;
  dateDemarrage: string;
  statut: string;
  step0Done: boolean;
  step2Done: boolean;
  step4Done: boolean;
  step6Done: boolean;
  account: {
    id: string;
    nom: string;
    reseau: string;
    responsable: string;
  };
}

const STATUT_BADGE: Record<string, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  PAS_REPONSE: "bg-slate-200 text-slate-700",
  GAGNE: "bg-emerald-100 text-emerald-800",
  PERDU: "bg-red-100 text-red-700",
};
const STATUT_LABEL: Record<string, string> = {
  EN_COURS: "En cours",
  PAS_REPONSE: "Pas de réponse",
  GAGNE: "Gagné",
  PERDU: "Perdu",
};

export function SocialProspectsTable({ rows }: { rows: SocialProspectRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Aucun prospect dans cette vue.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Prospect</th>
            <th className="px-3 py-2">Compte</th>
            <th className="px-3 py-2">Démarrage</th>
            <th className="px-3 py-2 text-center">Séquence</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: SocialProspectRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleStatut = (statut: "GAGNE" | "PERDU" | "EN_COURS") => {
    startTransition(async () => {
      const res = await updateProspectStatut({
        prospectId: row.id,
        statut,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Supprimer ${row.nom} ?`)) return;
    startTransition(async () => {
      const res = await deleteSocialProspect(row.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Prospect supprimé.");
      router.refresh();
    });
  };

  const stepDone = [row.step0Done, row.step2Done, row.step4Done, row.step6Done];
  const nbDone = stepDone.filter(Boolean).length;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2">
        <a
          href={row.profilUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {row.nom}
        </a>
      </td>
      <td className="px-3 py-2">
        <span
          className={`mr-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            NETWORK_COLORS[row.account.reseau] ?? NETWORK_COLORS.AUTRE
          }`}
        >
          {NETWORK_LABELS[row.account.reseau] ?? row.account.reseau}
        </span>
        <span className="text-xs">{row.account.nom}</span>
        <p className="text-[10px] text-muted-foreground">
          {row.account.responsable}
        </p>
      </td>
      <td className="px-3 py-2 text-xs tabular-nums">
        {new Date(row.dateDemarrage).toLocaleDateString("fr-CH", {
          day: "2-digit",
          month: "short",
        })}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="inline-flex gap-1">
          {stepDone.map((d, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                d ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={`J+${[0, 2, 4, 6][i]} ${d ? "✓" : ""}`}
            />
          ))}
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {nbDone}/4
        </p>
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
            STATUT_BADGE[row.statut] ?? STATUT_BADGE.EN_COURS
          }`}
        >
          {STATUT_LABEL[row.statut] ?? row.statut}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => handleStatut("GAGNE")}
            disabled={pending || row.statut === "GAGNE"}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
            title="Marquer gagné"
          >
            <Icon name="Check" className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => handleStatut("PERDU")}
            disabled={pending || row.statut === "PERDU"}
            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40"
            title="Marquer perdu"
          >
            <Icon name="X" className="h-3 w-3" />
          </button>
          {row.statut !== "EN_COURS" && (
            <button
              type="button"
              onClick={() => handleStatut("EN_COURS")}
              disabled={pending}
              className="rounded p-1 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              title="Remettre en cours"
            >
              <Icon name="Repeat" className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
            title="Supprimer"
          >
            <Icon name="Trash2" className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
