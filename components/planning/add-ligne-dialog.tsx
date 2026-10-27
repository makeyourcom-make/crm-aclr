"use client";

/**
 * Ajoute un service au planning : pour un client déjà présent (pré-rempli) ou
 * pour un autre client (recherche). Les règles de base du service sont créées
 * automatiquement, avec le dédoublonnage (un seul article / point SEO…).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { searchProspectsForAttach } from "@/app/(app)/emails/actions";
import { addLigne } from "@/app/(app)/dossiers/planning/actions";
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
import { SERVICES, TEMPLATES, type ServiceCode } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

const AJOUTABLES = (Object.keys(SERVICES) as ServiceCode[]).filter((s) => SERVICES[s].ajoutable);

export function AddLigneDialog({
  ownerId,
  client,
  dejaPresents = [],
  onClose,
}: {
  ownerId: string;
  /** Client pré-sélectionné (bouton « + service » d'une ligne). */
  client?: { id: string; nom: string };
  dejaPresents?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prospect, setProspect] = useState(client ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; raisonSociale: string; ville: string | null }>>([]);
  const [service, setService] = useState<ServiceCode | null>(null);
  const [libelle, setLibelle] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1 || prospect) return;
    const s = ++seq.current;
    const timer = setTimeout(() => {
      void searchProspectsForAttach(q).then((r) => {
        if (s === seq.current) setHits(r);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, prospect]);

  const submit = () => {
    if (!prospect || !service) return;
    startTransition(async () => {
      const res = await addLigne({
        ownerId,
        prospectId: prospect.id,
        service,
        libelle: libelle.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`${SERVICES[service].label} ajouté au planning de ${prospect.nom} ✓`);
      router.refresh();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un service au planning</DialogTitle>
          <DialogDescription>
            Les tâches récurrentes de base du service sont créées et étalées
            automatiquement ; tu pourras ensuite ajuster le rythme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            {prospect ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{prospect.nom}</span>
                {!client && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setProspect(null)}>
                    changer
                  </button>
                )}
              </div>
            ) : (
              <>
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Raison sociale, contact, email…"
                />
                {query.trim() && (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    {hits.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">Aucun client trouvé.</p>
                    ) : (
                      hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setProspect({ id: h.id, nom: h.raisonSociale })}
                          className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                        >
                          {h.raisonSociale}
                          {h.ville && <span className="text-xs text-muted-foreground"> · {h.ville}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Service</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {AJOUTABLES.map((s) => {
                const deja = dejaPresents.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={deja}
                    onClick={() => setService(s)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      service === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", SERVICES[s].badge)}>{SERVICES[s].label}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {deja ? "déjà au planning" : `${(TEMPLATES[s] ?? []).length} tâche(s) de base`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(service === "LICENCE" || service === "AUTRE") && (
            <div className="space-y-1.5">
              <Label htmlFor="l-libelle">Libellé (optionnel)</Label>
              <Input
                id="l-libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder={service === "LICENCE" ? "Ex. Licence Metricool" : "Ex. Maintenance serveur"}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending || !prospect || !service}>
            {pending ? "Ajout…" : "Ajouter au planning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
