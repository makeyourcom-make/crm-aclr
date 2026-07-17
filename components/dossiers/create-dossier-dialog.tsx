"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createDossier } from "@/app/(app)/dossiers/actions";
import { Icon } from "@/components/icon";
import { ProspectCombobox } from "@/components/prospects/prospect-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOSSIER_PRIORITE_LABELS } from "@/lib/dossiers";

import type { DossierPriorite } from "@prisma/client";

interface CreateDossierDialogProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CreateDossierDialog({
  users,
  currentUserId,
}: CreateDossierDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [assigneAId, setAssigneAId] = useState(currentUserId);
  const [priorite, setPriorite] = useState<DossierPriorite>("NORMALE");
  const [echeance, setEcheance] = useState("");
  const [prospectId, setProspectId] = useState("");

  const reset = () => {
    setTitre("");
    setDescription("");
    setAssigneAId(currentUserId);
    setPriorite("NORMALE");
    setEcheance("");
    setProspectId("");
  };

  const submit = () => {
    if (!titre.trim()) {
      toast.error("Le titre est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createDossier({
        titre,
        description: description || undefined,
        assigneAId,
        priorite,
        echeance: echeance || undefined,
        prospectId: prospectId || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la création.");
        return;
      }
      toast.success("Projet créé.");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="Plus" className="mr-1.5 h-4 w-4" />
        Nouveau projet
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau projet / tâche</DialogTitle>
            <DialogDescription>
              Attribue une tâche de suivi à un collaborateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="d-titre">Titre *</Label>
              <Input
                id="d-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Refonte site La Dent Byantse"
              />
            </div>

            <div>
              <Label htmlFor="d-desc">Description / explication</Label>
              <textarea
                id="d-desc"
                rows={3}
                className={inputCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ce qu'il faut faire, contexte, points d'attention…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d-assigne">Assigné à</Label>
                <select
                  id="d-assigne"
                  className={inputCls}
                  value={assigneAId}
                  onChange={(e) => setAssigneAId(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="d-prio">Priorité</Label>
                <select
                  id="d-prio"
                  className={inputCls}
                  value={priorite}
                  onChange={(e) =>
                    setPriorite(e.target.value as DossierPriorite)
                  }
                >
                  {(["BASSE", "NORMALE", "HAUTE"] as DossierPriorite[]).map(
                    (p) => (
                      <option key={p} value={p}>
                        {DOSSIER_PRIORITE_LABELS[p]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="d-echeance">Échéance (optionnel)</Label>
              <input
                id="d-echeance"
                type="date"
                className={inputCls}
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
              />
            </div>

            <div>
              <Label>Client rattaché (optionnel)</Label>
              <ProspectCombobox
                value={prospectId}
                onSelect={(id) => setProspectId(id)}
                allowCreate={false}
                placeholder="Rechercher une entreprise…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Création…" : "Créer le projet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
