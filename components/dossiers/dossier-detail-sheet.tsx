"use client";

/**
 * Panneau latéral de détail d'un projet (MYC Arena) : renommer, statut en
 * 1 clic, assignation / priorité / échéance, description, documents, fil de
 * suivi, suppression.
 */
import { Building2, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DossierDocuments, type DossierDocument } from "@/components/dossiers/dossier-documents";
import { DOSSIER_STATUT_ON } from "@/components/dossiers/dossier-tones";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addDossierUpdate, deleteDossier, moveDossierStatut, updateDossier } from "@/app/(app)/dossiers/actions";
import { DOSSIER_PRIORITE_LABELS, DOSSIER_STATUTS, DOSSIER_STATUT_LABELS } from "@/lib/dossiers";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DossierPriorite, DossierStatut } from "@prisma/client";

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
  "w-full rounded-[12px] border border-border-strong bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lvl-500/30";
const LABEL = "mb-1.5 block text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase";

async function fetchDossier(id: string): Promise<DossierDetail> {
  const r = await fetch(`/api/dossiers/${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as DossierDetail;
}

export function DossierDetailSheet({ dossierId, users, onClose, onChanged }: DossierDetailSheetProps) {
  const [loaded, setLoaded] = useState<DossierDetail | null>(null);
  // Erreur de chargement, rattachée au dossier concerné (jamais affichée pour un autre).
  const [erreur, setErreur] = useState<{ id: string; msg: string } | null>(null);
  const [titre, setTitre] = useState("");
  const [desc, setDesc] = useState("");
  const [newUpdate, setNewUpdate] = useState("");
  const [saving, setSaving] = useState(false);

  // Le détail affiché est celui du dossier ouvert (jamais un précédent).
  const d = loaded && loaded.id === dossierId ? loaded : null;

  const apply = (data: DossierDetail) => {
    setLoaded(data);
    setTitre(data.titre);
    setDesc(data.description ?? "");
    setErreur(null);
  };

  const reload = (id: string) => {
    fetchDossier(id)
      .then(apply)
      .catch(() => setErreur({ id, msg: "Impossible de charger ce projet." }));
  };

  useEffect(() => {
    if (!dossierId) return;
    let annule = false;
    fetchDossier(dossierId)
      .then((data) => {
        if (annule) return;
        setLoaded(data);
        setTitre(data.titre);
        setDesc(data.description ?? "");
        setErreur(null);
      })
      .catch(() => {
        if (!annule) setErreur({ id: dossierId, msg: "Impossible de charger ce projet." });
      });
    return () => {
      annule = true;
    };
  }, [dossierId]);

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
    if (statut === "TERMINE") toast.success("Projet terminé. Bien joué !");
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
      <SheetContent side="right" className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader className="gap-1 px-5 pt-5 pb-2 sm:px-6">
          <SheetTitle className="pr-8 font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
            {d?.titre ?? "Détail du projet"}
          </SheetTitle>
          {d?.prospect ? (
            <SheetDescription className="flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="size-3.5" />
              <Link href={`/prospects/${d.prospect.id}`} className="font-bold text-info-700 hover:underline">
                {d.prospect.raisonSociale}
              </Link>
            </SheetDescription>
          ) : (
            <SheetDescription>{d ? "Tâche sans client rattaché" : " "}</SheetDescription>
          )}
        </SheetHeader>

        {!d && (
          <div className="px-5 py-4 text-sm text-muted-foreground sm:px-6">{erreur && erreur.id === dossierId ? erreur.msg : "Chargement..."}</div>
        )}

        {d && (
          <div className="flex flex-col gap-5 px-5 pt-2 pb-6 sm:px-6">
            {/* Nom de la tâche : éditable en cours de route */}
            <div>
              <label htmlFor="dossier-titre" className={LABEL}>
                Nom de la tâche
              </label>
              <input
                id="dossier-titre"
                type="text"
                className={inputCls}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Cahier des charges du référencement"
              />
              <Button
                size="sm"
                className="mt-2"
                disabled={saving || !titre.trim() || titre === d.titre}
                onClick={() => patch({ titre: titre.trim() })}
              >
                <Save aria-hidden="true" />
                Renommer
              </Button>
            </div>

            {/* Statut : boutons rapides */}
            <div>
              <p className={LABEL}>Statut</p>
              <div role="group" aria-label="Statut du projet" className="grid grid-cols-2 gap-2">
                {DOSSIER_STATUTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={d.statut === s}
                    onClick={() => move(s)}
                    className={cn(
                      "min-h-10 rounded-[12px] border-2 px-2.5 py-1.5 text-[13px] font-extrabold transition-colors",
                      d.statut === s ? DOSSIER_STATUT_ON[s] : "border-border bg-card text-foreground hover:bg-navy-50",
                      s === "TERMINE" && "col-span-2",
                    )}
                  >
                    {DOSSIER_STATUT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigné / priorité / échéance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dossier-assigne" className={LABEL}>
                  Assigné à
                </label>
                <select
                  id="dossier-assigne"
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
              </div>
              <div>
                <label htmlFor="dossier-prio" className={LABEL}>
                  Priorité
                </label>
                <select
                  id="dossier-prio"
                  className={inputCls}
                  value={d.priorite}
                  onChange={(e) => patch({ priorite: e.target.value })}
                >
                  {(["BASSE", "NORMALE", "HAUTE"] as DossierPriorite[]).map((p) => (
                    <option key={p} value={p}>
                      {DOSSIER_PRIORITE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="dossier-echeance" className={LABEL}>
                  Échéance
                </label>
                <input
                  id="dossier-echeance"
                  type="date"
                  className={inputCls}
                  value={d.echeance ? d.echeance.slice(0, 10) : ""}
                  onChange={(e) => patch({ echeance: e.target.value || null })}
                />
              </div>
            </div>

            {/* Description éditable */}
            <div>
              <label htmlFor="dossier-desc" className={LABEL}>
                Description / explication
              </label>
              <textarea
                id="dossier-desc"
                rows={4}
                className={inputCls}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Contexte, ce qu'il faut faire, points d'attention..."
              />
              <Button
                size="sm"
                className="mt-2"
                disabled={saving || desc === (d.description ?? "")}
                onClick={() => patch({ description: desc })}
              >
                <Save aria-hidden="true" />
                Enregistrer la description
              </Button>
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
              <label htmlFor="dossier-suivi" className={LABEL}>
                Suivi ({d.updates.length})
              </label>
              <textarea
                id="dossier-suivi"
                rows={2}
                className={inputCls}
                value={newUpdate}
                onChange={(e) => setNewUpdate(e.target.value)}
                placeholder="Ajouter une mise à jour d'avancement..."
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={saving || !newUpdate.trim()}
                onClick={addUpdate}
              >
                <Plus aria-hidden="true" />
                Ajouter au suivi
              </Button>

              <ul className="mt-3 space-y-2">
                {d.updates.map((u) => (
                  <li key={u.id} className="rounded-[14px] border border-border bg-ground px-3.5 py-2.5">
                    <p className="text-sm whitespace-pre-line">{u.contenu}</p>
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                      {u.auteur.name} · {formatDateLong(u.createdAt)}
                    </p>
                  </li>
                ))}
                {d.updates.length === 0 && (
                  <li className="text-xs text-muted-foreground">Aucune mise à jour pour l&apos;instant.</li>
                )}
              </ul>
            </div>

            {/* Méta + suppression */}
            <div className="space-y-2.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <p>
                Créé par {d.creePar.name} · le {formatDateLong(d.createdAt)}
              </p>
              {d.termineLe && (
                <p className="flex items-center gap-1.5 font-bold text-win-700">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  Terminé le {formatDateLong(d.termineLe)}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                className="border border-[#F6B9BC] bg-alert-50 text-alert-700 hover:bg-alert-50/70 hover:text-alert-700"
              >
                <Trash2 aria-hidden="true" />
                Supprimer le dossier
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
