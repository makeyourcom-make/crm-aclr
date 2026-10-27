"use client";

/**
 * Détail d'une tâche du planning (MYC Arena) : statut en 1 clic, titre, date,
 * durée, notes, abandon (tâche récurrente, annulable) ou suppression (tâche
 * ponctuelle).
 */
import { CalendarDays, Clock, Flag, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteTache, setTacheStatut, updateTache } from "@/app/(app)/dossiers/planning/actions";
import {
  STATUT_META,
  VISUEL_STYLE,
  ddmm,
  ddmmyyyy,
  etatTache,
  fmtDuree,
  serviceStyle,
  visuelTache,
  type Statut,
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
import { Label } from "@/components/ui/label";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

const ORDRE: Statut[] = ["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT", "FAIT"];
const STATUT_ON: Record<Statut, string> = {
  A_FAIRE: "border-muted-foreground bg-navy-50 text-foreground",
  EN_COURS: "border-[#CA8A04] bg-[#FEF9C3] text-[#713F12]",
  ATTENTE_CLIENT: "border-lvl-500 bg-lvl-50 text-lvl-700",
  FAIT: "border-win-500 bg-win-50 text-win-700",
  ABANDONNEE: "border-border bg-navy-50 text-muted-foreground",
};

export function TaskDialog({
  tache,
  ligne,
  client,
  service,
  today,
  onStatut,
  onClose,
}: {
  tache: PlanningTacheDTO;
  ligne?: PlanningLigneDTO;
  client: string;
  service: string;
  today: string;
  /** Changement de statut (optimiste, géré par le planning). */
  onStatut: (t: PlanningTacheDTO, s: Statut) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [titre, setTitre] = useState(tache.titre);
  const [date, setDate] = useState(tache.date);
  const [duree, setDuree] = useState(String(tache.dureeMin));
  const [notes, setNotes] = useState(tache.notes ?? "");
  const [confirmAb, setConfirmAb] = useState(false);
  const etat = etatTache(tache, today);
  const v = visuelTache(tache, today);
  const svc = serviceStyle(ligne?.service ?? "AUTRE");

  const origine =
    v === "boss"
      ? `Prévue le ${ddmm(tache.date)} : plus d'un mois de retard. Le boss à abattre en premier.`
      : v === "retard"
        ? `Prévue le ${ddmm(tache.date)}, pas faite à temps : elle remonte sur le mois en cours.`
        : v === "attente" && tache.date < today
          ? `Balle chez le client depuis le ${ddmm(tache.date)} : hors retard, relance-le depuis sa fiche.`
          : tache.regleId
            ? `Tâche récurrente${ligne?.contratNumero ? ` générée par le contrat ${ligne.contratNumero}` : ""}, placée au jour ouvré le moins chargé.`
            : "Tâche ponctuelle ajoutée à la main.";

  const save = () =>
    startTransition(async () => {
      const res = await updateTache({
        id: tache.id,
        titre: titre.trim(),
        date,
        dureeMin: Math.max(5, Number(duree) || tache.dureeMin),
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Tâche mise à jour.");
      router.refresh();
      onClose();
    });

  const abandonner = () =>
    startTransition(async () => {
      const prev = tache.statut;
      const recurrente = !!tache.regleId;
      const res = await deleteTache(tache.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      router.refresh();
      onClose();
      if (recurrente) {
        toast("Occurrence abandonnée", {
          description: `${tache.titre} · ${client}`,
          action: {
            label: "Annuler",
            onClick: () => {
              void setTacheStatut(tache.id, prev === "ABANDONNEE" ? "A_FAIRE" : prev).then((r) => {
                if (!r.ok) toast.error(r.error ?? "Restauration impossible.");
                else toast.success("Tâche restaurée dans le planning.");
                router.refresh();
              });
            },
          },
        });
      } else {
        toast.success("Tâche supprimée.");
      }
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-4 rounded-[20px] p-5 sm:max-w-[520px] sm:p-6">
        <DialogHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", svc.pill)}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", svc.dot)} />
              {service}
            </span>
            <DialogTitle className="mt-2 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
              {tache.titre}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[13px]">
              {ligne ? (
                <Link href={`/prospects/${ligne.prospectId}`} className="font-bold text-info-700 hover:underline">
                  {client}
                </Link>
              ) : (
                client
              )}
              {ligne?.contratNumero && <> · {ligne.contratNumero}</>}
            </DialogDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          <Tile icon={CalendarDays} label="Échéance" value={ddmmyyyy(tache.date)} alert={etat !== "ok" && v !== "attente"} />
          <Tile icon={Clock} label="Durée" value={fmtDuree(tache.dureeMin)} />
          <Tile
            icon={Flag}
            label="État"
            value={VISUEL_STYLE[v].label}
            className={cn(VISUEL_STYLE[v].card)}
          />
        </div>
        <p className="text-[13px] text-muted-foreground">{origine}</p>

        <div role="group" aria-label="Statut de la tâche" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDRE.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              aria-pressed={tache.statut === s}
              onClick={() => {
                if (s === tache.statut) return;
                onStatut(tache, s);
                onClose();
              }}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-[12px] border-2 px-2 text-[13px] font-extrabold transition-colors disabled:opacity-50",
                tache.statut === s ? STATUT_ON[s] : "border-border bg-card text-foreground hover:bg-navy-50",
              )}
            >
              <span aria-hidden="true" className={cn("size-2 rounded-full", STATUT_META[s].dot)} />
              {STATUT_META[s].label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-titre">Tâche</Label>
            <Input id="t-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Date</Label>
              <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-duree">Durée (min)</Label>
              <Input
                id="t-duree"
                type="number"
                min={5}
                step={5}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notes</Label>
            <textarea
              id="t-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-[12px] border border-border-strong bg-card px-3 py-2.5 text-sm"
              placeholder="Ex. attendre les photos du nouveau menu avant de programmer"
            />
          </div>
        </div>

        {confirmAb && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] bg-alert-50 px-3.5 py-3">
            <p className="min-w-0 flex-[1_1_220px] text-[13px] font-bold text-alert-700">
              {tache.regleId
                ? "Cette occurrence disparaît du planning. La récurrence continue les autres mois. Tu pourras annuler juste après."
                : "Cette tâche ponctuelle sera supprimée définitivement."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setConfirmAb(false)} disabled={pending}>
              Garder
            </Button>
            <Button
              size="sm"
              onClick={abandonner}
              disabled={pending}
              className="bg-alert-700 text-white hover:bg-alert-700/90"
            >
              {tache.regleId ? "Oui, abandonner" : "Oui, supprimer"}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={pending || confirmAb}
            className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
            onClick={() => setConfirmAb(true)}
          >
            {tache.regleId ? "Abandonner" : "Supprimer"}
          </Button>
          <Button type="button" size="lg" onClick={save} disabled={pending || !titre.trim() || !date}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  alert,
  className,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  alert?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[14px] border border-transparent bg-ground px-3 py-2.5", alert && "bg-alert-50", className)}>
      <p
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase",
          alert ? "text-alert-700" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className={cn("mt-0.5 text-[15px] font-extrabold", alert && "text-alert-700")}>{value}</p>
    </div>
  );
}
