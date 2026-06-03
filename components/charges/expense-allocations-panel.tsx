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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setExpenseAllocations } from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";

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

  const add = () => {
    if (!newProspectId) {
      toast.error("Choisis un client.");
      return;
    }
    const prospect = prospects.find((p) => p.id === newProspectId);
    if (!prospect) return;
    if (allocs.some((a) => a.prospectId === newProspectId)) {
      toast.error("Ce client est déjà alloué — modifie la ligne existante.");
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Allocations multi-clients
          {allocs.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({allocs.length} client{allocs.length > 1 ? "s" : ""})
            </span>
          )}
        </CardTitle>
        {allocs.length >= 2 && (
          <button
            onClick={splitEqually}
            className="text-[11px] text-primary hover:underline"
            type="button"
          >
            Répartir équitablement
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDirectProspect && allocs.length === 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Cette charge est déjà 100% attribuée à un client direct via le
            champ « Client rattaché ». Ajoute des allocations seulement si tu
            veux la ventiler sur plusieurs clients.
          </p>
        )}

        {allocs.length > 0 && (
          <div className="space-y-2">
            {allocs.map((a, i) => (
              <div
                key={a.prospectId}
                className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-2"
              >
                <div className="flex-1 min-w-0 sm:min-w-[180px]">
                  <p className="text-xs font-medium">{a.prospectName}</p>
                  <Input
                    value={a.note ?? ""}
                    onChange={(e) =>
                      update(i, { note: e.target.value || null })
                    }
                    placeholder="Note (ex: 'Forfait + 2 reels')"
                    className="mt-1 h-7 text-xs"
                  />
                </div>
                <div className="w-32">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    HT (CHF)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={a.montantHT}
                    onChange={(e) =>
                      update(i, { montantHT: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-right text-xs tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fillRest(i)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-[10px] hover:bg-muted"
                  title="Mettre le solde restant ici"
                >
                  Solde
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="h-8 rounded-md border border-rose-200 bg-rose-50 px-2 text-rose-700 hover:bg-rose-100"
                  title="Supprimer"
                >
                  <Icon name="Trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Bilan cohérence */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
              <span>
                Total alloué :{" "}
                <strong className="tabular-nums">
                  {totalAlloue.toFixed(2)} CHF
                </strong>{" "}
                / {montantHT.toFixed(2)} CHF
              </span>
              {isCoherent ? (
                <span className="font-medium text-emerald-700">
                  ✓ Cohérent
                </span>
              ) : (
                <span className="font-medium text-amber-700">
                  Reste {reste.toFixed(2)} CHF
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ajouter une ligne */}
        <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            value={newProspectId}
            onChange={(e) => setNewProspectId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="">— Choisir un client —</option>
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
            value={newMontant}
            onChange={(e) => setNewMontant(Number(e.target.value) || 0)}
            placeholder="Montant HT"
          />
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Note (optionnel)"
          />
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={!newProspectId}
          >
            <Icon name="Plus" className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Sauvegarde…" : "Sauvegarder les allocations"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
