"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createDeal } from "@/app/(app)/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { DealStage } from "@prisma/client";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface DealFormProps {
  prospects: ProspectOption[];
}

export function DealForm({ prospects }: DealFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [prospectId, setProspectId] = useState(
    searchParams.get("prospectId") ?? "",
  );
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [montantPrevu, setMontantPrevu] = useState("");
  const [stage, setStage] = useState<DealStage>("DECOUVERTE");
  const [probabilite, setProbabilite] = useState(
    String(DEAL_STAGE_PROBA_DEFAUT.DECOUVERTE),
  );
  const [closeAttenduLe, setCloseAttenduLe] = useState("");

  const handleStageChange = (newStage: DealStage) => {
    setStage(newStage);
    setProbabilite(String(DEAL_STAGE_PROBA_DEFAUT[newStage]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectId) {
      toast.error("Sélectionne un prospect.");
      return;
    }
    if (!titre.trim()) {
      toast.error("Donne un titre au deal.");
      return;
    }
    if (!montantPrevu || Number(montantPrevu) <= 0) {
      toast.error("Le montant prévu doit être > 0.");
      return;
    }

    startTransition(async () => {
      const res = await createDeal({
        prospectId,
        titre: titre.trim(),
        description: description.trim() || undefined,
        montantPrevu: Number(montantPrevu),
        stage,
        probabilite: Number(probabilite),
        closeAttenduLe: closeAttenduLe
          ? new Date(closeAttenduLe)
          : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la création.");
        return;
      }
      toast.success("Deal créé.");
      router.push("/pipeline");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prospect & titre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prospectId">
              Prospect <span className="text-red-500">*</span>
            </Label>
            <select
              id="prospectId"
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              required
            >
              <option value="">— Sélectionner un prospect —</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                  {p.ville ? ` · ${p.ville}` : ""}
                </option>
              ))}
            </select>
            {prospects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucun prospect actif. Crée d&apos;abord un prospect.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titre">
              Titre du deal <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Pack Web Complet — démo prévue"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Contexte, besoins identifiés, points d'attention…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Stage initial</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {(
                [
                  "DECOUVERTE",
                  "PROPOSITION",
                  "NEGOCIATION",
                  "SIGNE",
                  "PERDU",
                ] as DealStage[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStageChange(s)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs",
                    stage === s
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="montantPrevu">
                Montant prévu (CHF) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="montantPrevu"
                type="number"
                min={0}
                step="0.01"
                value={montantPrevu}
                onChange={(e) => setMontantPrevu(e.target.value)}
                placeholder="3305"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Valeur 1 an (one-shot + mensuel × 12)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="probabilite">Probabilité (%)</Label>
              <Input
                id="probabilite"
                type="number"
                min={0}
                max={100}
                value={probabilite}
                onChange={(e) => setProbabilite(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closeAttenduLe">Close attendu le</Label>
              <Input
                id="closeAttenduLe"
                type="date"
                value={closeAttenduLe}
                onChange={(e) => setCloseAttenduLe(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le deal"}
        </Button>
      </div>
    </form>
  );
}

const STAGE_LABELS: Record<DealStage, string> = {
  DECOUVERTE: "Découverte",
  PROPOSITION: "Proposition",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  PERDU: "Perdu",
};
