"use client";

/**
 * Réglages d'un service d'un client (MYC Arena) : récurrences (rythme,
 * fenêtre ou date fixe, durée, activation), ajout d'une récurrence ou d'une
 * tâche ponctuelle, frais pub ADS, retrait du service.
 */
import { CalendarPlus, Repeat, X } from "lucide-react";
import Link from "next/link";
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
import {
  FREQUENCE_LABEL,
  JOURS_SEMAINE,
  fmtDuree,
  serviceLabelOf,
  serviceStyle,
} from "@/components/planning/shared";
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

const SELECT_CLS = "h-10 rounded-[12px] border border-border-strong bg-card px-2.5 text-sm";

export function LigneDialog({
  ligne,
  today,
  servicesClient = [],
  onClose,
}: {
  ligne: PlanningLigneDTO;
  today: string;
  /** Services actifs du même client (explique les règles désactivées par dédoublonnage). */
  servicesClient?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ajout, setAjout] = useState<Draft | null>(null);
  const [tache, setTache] = useState<{ titre: string; date: string; duree: string } | null>(null);
  const label = ligne.libelle ?? serviceLabelOf(ligne.service);
  const st = serviceStyle(ligne.service);
  const actives = ligne.regles.filter((r) => r.actif).length;

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

  /** Pourquoi une règle de base est désactivée automatiquement (dédoublonnage). */
  const raisonAuto = (r: PlanningRegleDTO): string | null => {
    if (r.actif) return null;
    if (r.code === "SEO_GBP" && servicesClient.includes("RS"))
      return "doublon : Google Business est inclus dans le calendrier éditorial Réseaux sociaux";
    if (r.code === "ADS_REFAC" && !ligne.fraisPubAvances) return "ACLR n'avance pas les frais pub de ce client";
    return null;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] gap-4 rounded-[20px] p-5 sm:max-w-[640px] sm:p-6">
        <DialogHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", st.pill)}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", st.dot)} />
              {label}
            </span>
            <DialogTitle className="mt-2 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
              Récurrences · {ligne.client}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">
              <Link href={`/prospects/${ligne.prospectId}`} className="font-bold text-info-700 hover:underline">
                Fiche client
              </Link>
              {ligne.contratNumero && <> · Contrat {ligne.contratNumero}</>} ·{" "}
              {actives} récurrence{actives > 1 ? "s" : ""} active{actives > 1 ? "s" : ""}. Une modification recalcule
              les tâches à venir ; celles déjà faites ou en cours restent.
            </DialogDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        {ligne.service === "ADS" && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-gold-50 px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-navy-700"
              checked={ligne.fraisPubAvances}
              disabled={pending}
              onChange={(e) => run(() => setFraisPubAvances(ligne.id, e.target.checked), "Réglage enregistré.")}
            />
            <span>
              <strong>ACLR avance les frais pub</strong> (Google / Meta) pour ce client.
              <span className="block text-xs text-muted-foreground">
                Coché : une tâche mensuelle « Refacturer les frais pub » est créée. Décoché (ex. SOS Pneus, qui paie
                Google directement) : pas de refacturation.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col gap-2">
          {ligne.regles.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune récurrence pour ce service.</p>
          )}
          {ligne.regles.map((r) => (
            <RegleRow
              key={r.id}
              regle={r}
              raison={raisonAuto(r)}
              pending={pending}
              onSave={(d) => run(() => updateRegle(r.id, payload(d)), "Récurrence mise à jour.")}
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
        {ajout && (
          <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#D9CEFF] bg-lvl-50 p-3.5">
            <p className="text-[11px] font-bold tracking-[0.08em] text-lvl-700 uppercase">Nouvelle récurrence</p>
            <RegleFields d={ajout} set={setAjout} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAjout(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={pending || !ajout.titre.trim()}
                onClick={() => run(() => createRegle(ligne.id, payload(ajout)), "Récurrence ajoutée.", () => setAjout(null))}
              >
                Ajouter
              </Button>
            </div>
          </div>
        )}

        {/* Tâche ponctuelle (manuelle) */}
        {tache && (
          <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#D9CEFF] bg-lvl-50 p-3.5">
            <p className="text-[11px] font-bold tracking-[0.08em] text-lvl-700 uppercase">Tâche ponctuelle</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_110px]">
              <Input
                aria-label="Titre de la tâche"
                placeholder="Ex. Inscription site internet"
                value={tache.titre}
                onChange={(e) => setTache({ ...tache, titre: e.target.value })}
              />
              <Input
                aria-label="Date"
                type="date"
                value={tache.date}
                onChange={(e) => setTache({ ...tache, date: e.target.value })}
              />
              <Input
                aria-label="Durée en minutes"
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
                    "Tâche ajoutée.",
                    () => setTache(null),
                  )
                }
              >
                Ajouter
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Les tâches sont placées au jour ouvré le moins chargé, hors week-ends et fériés valaisans. Le jour retenu
          reste stable d&apos;un mois à l&apos;autre.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!!ajout} onClick={() => setAjout({ ...EMPTY })}>
              <Repeat aria-hidden="true" />
              Récurrence
            </Button>
            <Button
              variant="outline"
              disabled={!!tache}
              onClick={() => setTache({ titre: "", date: today, duree: "30" })}
            >
              <CalendarPlus aria-hidden="true" />
              Tâche ponctuelle
            </Button>
          </div>
          <Button
            variant="ghost"
            disabled={pending}
            className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
            onClick={() => {
              if (
                confirm(
                  `Retirer « ${label} » du planning de ${ligne.client} ? Les tâches à venir non commencées sont supprimées.`,
                )
              )
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
  raison,
  pending,
  onSave,
  onDelete,
}: {
  regle: PlanningRegleDTO;
  raison: string | null;
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
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-strong p-3.5">
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
        "flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] border border-border px-3.5 py-3",
        regle.actif ? "bg-card" : "bg-ground",
      )}
    >
      <div className="min-w-0 flex-[1_1_220px]">
        <p className={cn("text-sm font-extrabold", !regle.actif && "text-muted-foreground")}>
          {regle.titre}
          {!regle.actif && (
            <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
              (désactivée{raison ? ` · ${raison}` : ""})
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {FREQUENCE_LABEL[regle.frequence] ?? regle.frequence} · {placement} · {fmtDuree(regle.dureeMin)}
        </p>
      </div>
      <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-extrabold text-muted-foreground">
        {regle.code === "CUSTOM" ? "Perso" : "Base"}
      </span>
      <div className="flex shrink-0 gap-1">
        <Button variant="outline" size="sm" onClick={() => setEdit(draftOf(regle))}>
          Modifier
        </Button>
        {regle.actif || regle.code === "CUSTOM" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
            disabled={pending}
            onClick={onDelete}
          >
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
    <div className="flex flex-col gap-2 text-sm">
      <Input
        aria-label="Titre de la récurrence"
        value={d.titre}
        onChange={(e) => set({ ...d, titre: e.target.value })}
        placeholder="Ex. Rédiger et publier l'article"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Rythme"
          value={d.frequence}
          onChange={(e) => set({ ...d, frequence: e.target.value })}
          className={SELECT_CLS}
        >
          {Object.entries(FREQUENCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {d.frequence === "HEBDO" && (
          <select
            aria-label="Jour de la semaine"
            value={d.jourSemaine}
            onChange={(e) => set({ ...d, jourSemaine: Number(e.target.value) })}
            className={SELECT_CLS}
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
            aria-label="Date"
            type="date"
            className="w-40"
            value={d.datePonctuelle}
            onChange={(e) => set({ ...d, datePonctuelle: e.target.value })}
          />
        )}

        {mensuelle && (
          <>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-navy-700"
                checked={d.fixe}
                onChange={(e) => set({ ...d, fixe: e.target.checked })}
              />
              date fixe
            </label>
            {d.fixe ? (
              <span className="flex items-center gap-1.5 text-xs">
                le
                <Input
                  aria-label="Jour du mois"
                  type="number"
                  min={1}
                  max={31}
                  className="h-10 w-16"
                  value={d.jourFixe}
                  onChange={(e) => set({ ...d, jourFixe: num(e.target.value, 1, 31) })}
                />
                du mois
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs">
                entre le
                <Input
                  aria-label="Premier jour de la fenêtre"
                  type="number"
                  min={1}
                  max={31}
                  className="h-10 w-16"
                  value={d.fenetreDebut}
                  onChange={(e) => set({ ...d, fenetreDebut: num(e.target.value, 1, 31) })}
                />
                et le
                <Input
                  aria-label="Dernier jour de la fenêtre"
                  type="number"
                  min={1}
                  max={31}
                  className="h-10 w-16"
                  value={d.fenetreFin}
                  onChange={(e) => set({ ...d, fenetreFin: num(e.target.value, 1, 31) })}
                />
              </span>
            )}
          </>
        )}

        <span className="flex items-center gap-1.5 text-xs">
          durée
          <Input
            aria-label="Durée en minutes"
            type="number"
            min={5}
            step={5}
            className="h-10 w-20"
            value={d.dureeMin}
            onChange={(e) => set({ ...d, dureeMin: num(e.target.value, 5, 600) })}
          />
          min
        </span>
      </div>
    </div>
  );
}
