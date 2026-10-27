"use client";

/**
 * Réglages d'un service d'un client : récurrences (rythme, fenêtre ou date
 * fixe, durée, activation), ajout d'une récurrence ou d'une tâche ponctuelle,
 * frais pub ADS, retrait du service.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createRegle,
  createTacheManuelle,
  deleteRegle,
  retirerLigne,
  setFraisPubAvances,
  updateRegle,
} from "@/app/(app)/dossiers/planning/actions";
import { FREQUENCE_LABEL, JOURS_SEMAINE, fmtDuree } from "@/components/planning/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PlanningLigneDTO, PlanningRegleDTO } from "@/lib/planning/queries";
import { SERVICES, type ServiceCode } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

type Draft = {
  titre: string;
  frequence: string;
  fixe: boolean;
  jourFixe: number;
  fenetreDebut: number;
  fenetreFin: number;
  jourSemaine: number;
  dureeMin: number;
  actif: boolean;
  datePonctuelle: string;
};

function draftOf(r: PlanningRegleDTO): Draft {
  return {
    titre: r.titre,
    frequence: r.frequence,
    fixe: r.fixe,
    jourFixe: r.jours[0] ?? r.fenetreDebut,
    fenetreDebut: r.fenetreDebut,
    fenetreFin: r.fenetreFin,
    jourSemaine: r.jourSemaine ?? 1,
    dureeMin: r.dureeMin,
    actif: r.actif,
    datePonctuelle: "",
  };
}

const EMPTY: Draft = {
  titre: "",
  frequence: "MENSUELLE",
  fixe: false,
  jourFixe: 1,
  fenetreDebut: 1,
  fenetreFin: 22,
  jourSemaine: 1,
  dureeMin: 30,
  actif: true,
  datePonctuelle: "",
};

function payload(d: Draft) {
  return {
    titre: d.titre.trim(),
    frequence: d.frequence,
    fixe: d.fixe,
    jourFixe: d.jourFixe,
    fenetreDebut: d.fenetreDebut,
    fenetreFin: d.fenetreFin,
    jourSemaine: d.jourSemaine,
    dureeMin: d.dureeMin,
    actif: d.actif,
    datePonctuelle: d.frequence === "PONCTUELLE" ? d.datePonctuelle || null : null,
  };
}

export function LigneDialog({
  ligne,
  today,
  onClose,
}: {
  ligne: PlanningLigneDTO;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ajout, setAjout] = useState<Draft | null>(null);
  const [tache, setTache] = useState<{ titre: string; date: string; duree: string } | null>(null);
  const svc = SERVICES[ligne.service as ServiceCode];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(msg);
      after?.();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">
            {ligne.client} · {ligne.libelle ?? svc?.label ?? ligne.service}
          </DialogTitle>
          <DialogDescription>
            Règles de récurrence de ce service pour ce client. Une modification
            recalcule les tâches à venir ; celles déjà faites ou en cours restent.
            {ligne.contratNumero && <> Contrat {ligne.contratNumero}.</>}
          </DialogDescription>
        </DialogHeader>

        {ligne.service === "ADS" && (
          <label className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50/60 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ligne.fraisPubAvances}
              disabled={pending}
              onChange={(e) =>
                run(() => setFraisPubAvances(ligne.id, e.target.checked), "Réglage enregistré ✓")
              }
            />
            <span>
              <strong>ACLR avance les frais pub</strong> (Google / Meta) pour ce client.
              <span className="block text-xs text-muted-foreground">
                Coché : une tâche mensuelle « Refacturer les frais pub » est créée.
                Décoché (ex. SOS Pneus, qui paie Google directement) : pas de refacturation.
              </span>
            </span>
          </label>
        )}

        <div className="space-y-2">
          {ligne.regles.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune récurrence pour ce service.</p>
          )}
          {ligne.regles.map((r) => (
            <RegleRow
              key={r.id}
              regle={r}
              pending={pending}
              onSave={(d) => run(() => updateRegle(r.id, payload(d)), "Récurrence mise à jour ✓")}
              onDelete={() => {
                const msg =
                  r.code === "CUSTOM"
                    ? "Supprimer cette récurrence et ses tâches à venir ?"
                    : "Désactiver cette règle de base ? (réactivable ici)";
                if (confirm(msg)) run(() => deleteRegle(r.id), "Récurrence retirée.");
              }}
            />
          ))}
        </div>

        {/* Ajouter une récurrence */}
        {ajout ? (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Nouvelle récurrence</p>
            <RegleFields d={ajout} set={setAjout} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAjout(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={pending || !ajout.titre.trim()}
                onClick={() =>
                  run(() => createRegle(ligne.id, payload(ajout)), "Récurrence ajoutée ✓", () => setAjout(null))
                }
              >
                Ajouter
              </Button>
            </div>
          </div>
        ) : null}

        {/* Tâche ponctuelle (manuelle) */}
        {tache ? (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tâche ponctuelle</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_110px]">
              <Input
                placeholder="Ex. Inscription site internet"
                value={tache.titre}
                onChange={(e) => setTache({ ...tache, titre: e.target.value })}
              />
              <Input type="date" value={tache.date} onChange={(e) => setTache({ ...tache, date: e.target.value })} />
              <Input
                type="number"
                min={5}
                step={5}
                value={tache.duree}
                onChange={(e) => setTache({ ...tache, duree: e.target.value })}
                title="Durée en minutes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setTache(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={pending || !tache.titre.trim() || !tache.date}
                onClick={() =>
                  run(
                    () =>
                      createTacheManuelle({
                        ligneId: ligne.id,
                        titre: tache.titre.trim(),
                        date: tache.date,
                        dureeMin: Math.max(5, Number(tache.duree) || 30),
                      }),
                    "Tâche ajoutée ✓",
                    () => setTache(null),
                  )
                }
              >
                Ajouter
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!!ajout} onClick={() => setAjout({ ...EMPTY })}>
              + Récurrence
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!!tache}
              onClick={() => setTache({ titre: "", date: today, duree: "30" })}
            >
              + Tâche ponctuelle
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              if (confirm(`Retirer « ${svc?.label ?? ligne.service} » du planning de ${ligne.client} ? Les tâches à venir non commencées sont supprimées.`))
                run(() => retirerLigne(ligne.id), "Service retiré du planning.", onClose);
            }}
          >
            Retirer ce service
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegleRow({
  regle,
  pending,
  onSave,
  onDelete,
}: {
  regle: PlanningRegleDTO;
  pending: boolean;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState<Draft | null>(null);
  const placement =
    regle.frequence === "PONCTUELLE"
      ? "date unique"
      : regle.frequence === "HEBDO"
        ? `chaque ${JOURS_SEMAINE[regle.jourSemaine ?? 1]}`
        : regle.fixe
          ? `le ${regle.jours[0]} (date fixe)`
          : `entre le ${regle.fenetreDebut} et le ${regle.fenetreFin}, au jour le moins chargé`;

  if (edit) {
    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        <RegleFields d={edit} set={setEdit} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={pending || !edit.titre.trim()}
            onClick={() => {
              onSave(edit);
              setEdit(null);
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border border-border p-3",
        !regle.actif && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {regle.titre}
          {!regle.actif && <span className="ml-2 text-xs font-normal text-muted-foreground">(désactivée)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {FREQUENCE_LABEL[regle.frequence] ?? regle.frequence} · {placement} · {fmtDuree(regle.dureeMin)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="outline" size="sm" onClick={() => setEdit(draftOf(regle))}>
          Modifier
        </Button>
        {regle.actif || regle.code === "CUSTOM" ? (
          <Button variant="ghost" size="sm" className="text-red-600" disabled={pending} onClick={onDelete}>
            {regle.code === "CUSTOM" ? "Supprimer" : "Désactiver"}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onSave({ ...draftOf(regle), actif: true })}>
            Réactiver
          </Button>
        )}
      </div>
    </div>
  );
}

function RegleFields({ d, set }: { d: Draft; set: (d: Draft) => void }) {
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));
  const mensuelle = !["HEBDO", "PONCTUELLE"].includes(d.frequence);
  return (
    <div className="space-y-2 text-sm">
      <Input value={d.titre} onChange={(e) => set({ ...d, titre: e.target.value })} placeholder="Ex. Rédiger et publier l'article" />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={d.frequence}
          onChange={(e) => set({ ...d, frequence: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {Object.entries(FREQUENCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {d.frequence === "HEBDO" && (
          <select
            value={d.jourSemaine}
            onChange={(e) => set({ ...d, jourSemaine: Number(e.target.value) })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((j) => (
              <option key={j} value={j}>
                chaque {JOURS_SEMAINE[j]}
              </option>
            ))}
          </select>
        )}

        {d.frequence === "PONCTUELLE" && (
          <Input
            type="date"
            className="w-40"
            value={d.datePonctuelle}
            onChange={(e) => set({ ...d, datePonctuelle: e.target.value })}
          />
        )}

        {mensuelle && (
          <>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={d.fixe} onChange={(e) => set({ ...d, fixe: e.target.checked })} />
              date fixe
            </label>
            {d.fixe ? (
              <span className="flex items-center gap-1 text-xs">
                le
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="h-9 w-16"
                  value={d.jourFixe}
                  onChange={(e) => set({ ...d, jourFixe: num(e.target.value, 1, 31) })}
                />
                du mois
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                entre le
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="h-9 w-16"
                  value={d.fenetreDebut}
                  onChange={(e) => set({ ...d, fenetreDebut: num(e.target.value, 1, 31) })}
                />
                et le
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="h-9 w-16"
                  value={d.fenetreFin}
                  onChange={(e) => set({ ...d, fenetreFin: num(e.target.value, 1, 31) })}
                />
              </span>
            )}
          </>
        )}

        <span className="flex items-center gap-1 text-xs">
          durée
          <Input
            type="number"
            min={5}
            step={5}
            className="h-9 w-20"
            value={d.dureeMin}
            onChange={(e) => set({ ...d, dureeMin: num(e.target.value, 5, 600) })}
          />
          min
        </span>
      </div>
    </div>
  );
}
