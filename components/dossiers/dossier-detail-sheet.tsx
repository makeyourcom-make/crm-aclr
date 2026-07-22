"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DossierDocuments,
  type DossierDocument,
} from "@/components/dossiers/dossier-documents";
import { Icon } from "@/components/icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addDossierUpdate,
  deleteDossier,
  moveDossierStatut,
  updateDossier,
} from "@/app/(app)/dossiers/actions";
import {
  DOSSIER_PRIORITE_LABELS,
  DOSSIER_STATUTS,
  DOSSIER_STATUT_LABELS,
} from "@/lib/dossiers";
import { formatDateLong } from "@/lib/format";

import type {
  DossierPriorite,
  DossierStatut,
} from "@prisma/client";

interface DossierDetail {
  id: string;
  titre: string;
  description: string | null;
  statut: DossierStatut;
  priorite: DossierPriorite;
  echeance: string | null;
  createdAt: string;
  termineLe: string | null;
  assigneAId: string;
  assigneA: { id: string; name: string };
  creePar: { id: string; name: string };
  prospect: { id: string; raisonSociale: string } | null;
  updates: Array<{
    id: string;
    contenu: string;
    createdAt: string;
    auteur: { name: string };
  }>;
  attachments: DossierDocument[];
}

interface DossierDetailSheetProps {
  dossierId: string | null;
  users: Array<{ id: string; name: string }>;
  onClose: () => void;
  onChanged: () => void;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

export function DossierDetailSheet({
  dossierId,
  users,
  onClose,
  onChanged,
}: DossierDetailSheetProps) {
  const [d, setD] = useState<DossierDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [titre, setTitre] = useState("");
  const [desc, setDesc] = useState("");
  const [newUpdate, setNewUpdate] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = (id: string) => {
    setLoading(true);
    fetch(`/api/dossiers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DossierDetail) => {
        setD(data);
        setTitre(data.titre);
        setDesc(data.description ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!dossierId) {
      setD(null);
      return;
    }
    reload(dossierId);
  }, [dossierId]);

  if (!dossierId) {
    return (
      <Sheet open={false} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const patch = async (input: Record<string, unknown>) => {
    if (!d) return;
    setSaving(true);
    const res = await updateDossier(d.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Échec de l'enregistrement.");
      return;
    }
    reload(d.id);
    onChanged();
  };

  const move = async (statut: DossierStatut) => {
    if (!d) return;
    const res = await moveDossierStatut({ dossierId: d.id, newStatut: statut });
    if (!res.ok) {
      toast.error(res.error ?? "Échec.");
      return;
    }
    reload(d.id);
    onChanged();
  };

  const addUpdate = async () => {
    if (!d || !newUpdate.trim()) return;
    setSaving(true);
    const res = await addDossierUpdate({ dossierId: d.id, contenu: newUpdate });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Échec.");
      return;
    }
    setNewUpdate("");
    reload(d.id);
    onChanged();
  };

  const remove = async () => {
    if (!d) return;
    if (!confirm("Supprimer définitivement ce projet ?")) return;
    const res = await deleteDossier(d.id);
    if (!res.ok) {
      toast.error(res.error ?? "Échec.");
      return;
    }
    toast.success("Projet supprimé.");
    onClose();
    onChanged();
  };

  return (
    <Sheet open={!!dossierId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d?.titre ?? "Détail du projet"}</SheetTitle>
          {d?.prospect ? (
            <SheetDescription>
              <Link
                href={`/prospects/${d.prospect.id}`}
                className="hover:underline"
              >
                {d.prospect.raisonSociale}
              </Link>
            </SheetDescription>
          ) : (
            <SheetDescription>Tâche sans client rattaché</SheetDescription>
          )}
        </SheetHeader>

        {loading && !d && (
          <div className="px-6 py-4 text-sm text-muted-foreground">
            Chargement…
          </div>
        )}

        {d && (
          <div className="space-y-5 px-6 py-4">
            {/* Nom de la tâche — éditable en cours de route */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nom de la tâche
              </p>
              <input
                type="text"
                className={inputCls}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Cahier des charges du référencement"
              />
              <button
                type="button"
                disabled={saving || !titre.trim() || titre === d.titre}
                onClick={() => patch({ titre: titre.trim() })}
                className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Icon name="Save" className="h-3.5 w-3.5" />
                Renommer
              </button>
            </div>

            {/* Statut — boutons rapides */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Statut
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DOSSIER_STATUTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => move(s)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      d.statut === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {DOSSIER_STATUT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigné / priorité / échéance */}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">
                  Assigné à
                </span>
                <select
                  className={inputCls}
                  value={d.assigneAId}
                  onChange={(e) => patch({ assigneAId: e.target.value })}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">
                  Priorité
                </span>
                <select
                  className={inputCls}
                  value={d.priorite}
                  onChange={(e) => patch({ priorite: e.target.value })}
                >
                  {(["BASSE", "NORMALE", "HAUTE"] as DossierPriorite[]).map(
                    (p) => (
                      <option key={p} value={p}>
                        {DOSSIER_PRIORITE_LABELS[p]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="col-span-2 text-xs">
                <span className="mb-1 block font-medium uppercase tracking-wider text-muted-foreground">
                  Échéance
                </span>
                <input
                  type="date"
                  className={inputCls}
                  value={d.echeance ? d.echeance.slice(0, 10) : ""}
                  onChange={(e) =>
                    patch({ echeance: e.target.value || null })
                  }
                />
              </label>
            </div>

            {/* Description éditable */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description / explication
              </p>
              <textarea
                rows={4}
                className={inputCls}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Contexte, ce qu'il faut faire, points d'attention…"
              />
              <button
                type="button"
                disabled={saving || desc === (d.description ?? "")}
                onClick={() => patch({ description: desc })}
                className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Icon name="Save" className="h-3.5 w-3.5" />
                Enregistrer la description
              </button>
            </div>

            {/* Documents du projet */}
            <DossierDocuments
              dossierId={d.id}
              documents={d.attachments}
              onChanged={() => {
                reload(d.id);
                onChanged();
              }}
            />

            {/* Fil de suivi */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Suivi ({d.updates.length})
              </p>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Ajouter une mise à jour d'avancement…"
                />
              </div>
              <button
                type="button"
                disabled={saving || !newUpdate.trim()}
                onClick={addUpdate}
                className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Icon name="Plus" className="h-3.5 w-3.5" />
                Ajouter au suivi
              </button>

              <ul className="mt-3 space-y-2">
                {d.updates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <p className="whitespace-pre-line text-sm">{u.contenu}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {u.auteur.name} · {formatDateLong(u.createdAt)}
                    </p>
                  </li>
                ))}
                {d.updates.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    Aucune mise à jour pour l'instant.
                  </li>
                )}
              </ul>
            </div>

            {/* Méta + suppression */}
            <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
              <p>
                Créé par {d.creePar.name} · le {formatDateLong(d.createdAt)}
              </p>
              {d.termineLe && (
                <p className="text-emerald-700">
                  ✓ Terminé le {formatDateLong(d.termineLe)}
                </p>
              )}
              <button
                type="button"
                onClick={remove}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <Icon name="Trash2" className="h-3.5 w-3.5" />
                Supprimer le dossier
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
