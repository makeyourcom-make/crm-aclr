"use client";

/**
 * Panel de gestion des allocations multi-clients d'une charge.
 *
 * Ex: Google Ads 1789.93 CHF
 *    → SP Industriel  600.00
 *    → LocFactory     500.00
 *    → Passeport      689.93
 *
 * Permet d'ajouter/modifier/supprimer des lignes et persiste en une fois.
 * Indique le total alloué vs montant HT de la charge (cohérence).
 */
import { CircleCheck, Loader2, Plus, Save, Split, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setExpenseAllocations } from "@/app/(app)/charges/actions";
import { SectionCard } from "@/components/arena/section-card";
import { Callout } from "@/components/common/callout";
import {
  FIELD_CLASS,
  FIELD_SM_CLASS,
  SELECT_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Allocation {
  id?: string;
  prospectId: string;
  prospectName: string;
  montantHT: number;
  note: string | null;
}

interface Props {
  expenseId: string;
  montantHT: number;
  prospects: { id: string; raisonSociale: string; statut: string }[];
  initial: Allocation[];
  totalAlloue: number;
  reste: number;
  hasDirectProspect: boolean;
}

export function ExpenseAllocationsPanel({
  expenseId,
  montantHT,
  prospects,
  initial,
  hasDirectProspect,
}: Props) {
  const router = useRouter();
  const [allocs, setAllocs] = useState<Allocation[]>(initial);
  const [pending, start] = useTransition();
  const [newProspectId, setNewProspectId] = useState("");
  const [newMontant, setNewMontant] = useState(0);
  const [newNote, setNewNote] = useState("");

  const totalAlloue = allocs.reduce((s, a) => s + (a.montantHT || 0), 0);
  const reste = montantHT - totalAlloue;
  const isCoherent = Math.abs(reste) < 0.01;
  const pctAlloue =
    montantHT > 0 ? Math.min(100, Math.max(0, (totalAlloue / montantHT) * 100)) : 0;

  const add = () => {
    if (!newProspectId) {
      toast.error("Choisis un client.");
      return;
    }
    const prospect = prospects.find((p) => p.id === newProspectId);
    if (!prospect) return;
    if (allocs.some((a) => a.prospectId === newProspectId)) {
      toast.error("Ce client est déjà alloué : modifie la ligne existante.");
      return;
    }
    setAllocs([
      ...allocs,
      {
        prospectId: newProspectId,
        prospectName: prospect.raisonSociale,
        montantHT: newMontant,
        note: newNote || null,
      },
    ]);
    setNewProspectId("");
    setNewMontant(0);
    setNewNote("");
  };

  const update = (idx: number, patch: Partial<Allocation>) => {
    setAllocs(allocs.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const remove = (idx: number) => {
    setAllocs(allocs.filter((_, i) => i !== idx));
  };

  const splitEqually = () => {
    if (allocs.length === 0) {
      toast.error("Ajoute d'abord des clients à allouer.");
      return;
    }
    const part = Math.floor((montantHT / allocs.length) * 100) / 100;
    const adjusted = montantHT - part * (allocs.length - 1);
    setAllocs(
      allocs.map((a, i) => ({
        ...a,
        montantHT: i === allocs.length - 1 ? adjusted : part,
      })),
    );
  };

  const fillRest = (idx: number) => {
    const others = allocs.reduce(
      (s, a, i) => (i === idx ? s : s + (a.montantHT || 0)),
      0,
    );
    update(idx, { montantHT: Math.max(0, montantHT - others) });
  };

  const save = () => {
    start(async () => {
      const res = await setExpenseAllocations({
        expenseId,
        allocations: allocs.map((a) => ({
          prospectId: a.prospectId,
          montantHT: a.montantHT,
          note: a.note,
        })),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur");
        return;
      }
      toast.success("Allocations enregistrées.");
      router.refresh();
    });
  };

  return (
    <SectionCard
      title="Allocations multi-clients"
      description={
        allocs.length > 0
          ? `${allocs.length} client${allocs.length > 1 ? "s" : ""} · ventilation du montant HT`
          : "Ventile cette charge sur plusieurs clients"
      }
      icon={Users}
      tone="blue"
      action={
        allocs.length >= 2 ? (
          <Button type="button" variant="ghost" size="sm" onClick={splitEqually}>
            <Split aria-hidden="true" />
            Répartir équitablement
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {hasDirectProspect && allocs.length === 0 && (
          <Callout tone="gold">
            Cette charge est déjà 100 % attribuée à un client direct via le
            champ « Client rattaché ». Ajoute des allocations seulement si tu
            veux la ventiler sur plusieurs clients.
          </Callout>
        )}

        {allocs.length > 0 && (
          <div className="space-y-2.5">
            {allocs.map((a, i) => (
              <div
                key={a.prospectId}
                className="flex flex-wrap items-end gap-2 rounded-[14px] border border-border bg-ground p-3"
              >
                <div className="min-w-0 flex-1 sm:min-w-[180px]">
                  <p className="truncate text-[13px] font-bold">{a.prospectName}</p>
                  <Input
                    value={a.note ?? ""}
                    onChange={(e) =>
                      update(i, { note: e.target.value || null })
                    }
                    placeholder="Note (ex: 'Forfait + 2 reels')"
                    aria-label={`Note pour ${a.prospectName}`}
                    className={cn(FIELD_SM_CLASS, "mt-1.5")}
                  />
                </div>
                <label className="w-32">
                  <span className="mb-1 block text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    HT (CHF)
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    value={a.montantHT}
                    onChange={(e) =>
                      update(i, { montantHT: Number(e.target.value) || 0 })
                    }
                    className={cn(FIELD_SM_CLASS, "text-right tabular-nums")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => fillRest(i)}
                  className="inline-flex h-9 items-center rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-navy-50"
                  title="Mettre le solde restant ici"
                >
                  Solde
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="inline-flex size-9 items-center justify-center rounded-[10px] border border-alert-500/30 bg-alert-50 text-alert-700 transition-colors hover:border-alert-500/60"
                  title="Supprimer"
                  aria-label={`Retirer l'allocation ${a.prospectName}`}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}

            {/* Bilan cohérence */}
            <div className="rounded-[14px] bg-ground px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                <span className="font-semibold text-muted-foreground">
                  Total alloué{" "}
                  <strong className="font-display text-base font-extrabold text-foreground tabular-nums">
                    {formatCHF(totalAlloue)}
                  </strong>{" "}
                  / {formatCHF(montantHT)}
                </span>
                {isCoherent ? (
                  <span className="inline-flex items-center gap-1 font-bold text-win-700">
                    <CircleCheck aria-hidden="true" className="size-4" />
                    Cohérent
                  </span>
                ) : (
                  <span className="font-bold text-gold-700 tabular-nums">
                    Reste {formatCHF(reste)}
                  </span>
                )}
              </div>
              <div
                aria-hidden="true"
                className="mt-2 h-2 overflow-hidden rounded-full bg-navy-50"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    isCoherent ? "bg-win-500" : "bg-gold-500",
                  )}
                  style={{ width: `${pctAlloue}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Ajouter une ligne */}
        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            value={newProspectId}
            onChange={(e) => setNewProspectId(e.target.value)}
            aria-label="Client à ajouter"
            className={SELECT_CLASS}
          >
            <option value="">Choisir un client</option>
            {prospects
              .filter((p) => !allocs.some((a) => a.prospectId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                </option>
              ))}
          </select>
          <Input
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={newMontant}
            onChange={(e) => setNewMontant(Number(e.target.value) || 0)}
            placeholder="Montant HT"
            aria-label="Montant HT de l'allocation"
            className={cn(FIELD_CLASS, "tabular-nums")}
          />
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Note (optionnel)"
            aria-label="Note de l'allocation"
            className={FIELD_CLASS}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={add}
            disabled={!newProspectId}
          >
            <Plus aria-hidden="true" />
            Ajouter
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="lg" onClick={save} disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {pending ? "Sauvegarde…" : "Sauvegarder les allocations"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
