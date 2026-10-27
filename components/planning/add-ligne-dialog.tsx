"use client";

/**
 * Ajoute un service au planning (MYC Arena) : pour un client déjà présent
 * (pré-rempli) ou pour un autre client (recherche). Les règles de base du
 * service sont créées automatiquement, avec le dédoublonnage (un seul
 * article / point SEO…).
 */
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { searchProspectsForAttach } from "@/app/(app)/emails/actions";
import { addLigne } from "@/app/(app)/dossiers/planning/actions";
import { serviceStyle } from "@/components/planning/shared";
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
      const n = (TEMPLATES[service] ?? []).length;
      toast.success(`${SERVICES[service].label} ajouté au planning de ${prospect.nom}`, {
        // n = nombre de récurrences de base du service (et non de tâches générées).
        description: n
          ? `${n} récurrence${n > 1 ? "s" : ""} de base, étalée${n > 1 ? "s" : ""} sur 12 mois.`
          : undefined,
      });
      router.refresh();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-4 rounded-[20px] p-5 sm:max-w-[620px] sm:p-6">
        <DialogHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
              Ajouter un service au planning
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">
              Les tâches récurrentes de base du service sont créées et étalées automatiquement ; tu pourras ensuite
              ajuster le rythme.
            </DialogDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-muted-foreground">1. Client</p>
          {prospect ? (
            <div className="flex items-center justify-between gap-2 rounded-[12px] border-2 border-lvl-500 bg-lvl-50 px-3.5 py-2.5 text-sm">
              <span className="font-extrabold">{prospect.nom}</span>
              {!client && (
                <button
                  type="button"
                  className="text-xs font-bold text-info-700 hover:underline"
                  onClick={() => setProspect(null)}
                >
                  Changer
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Label htmlFor="add-ligne-q" className="sr-only">
                  Rechercher un client
                </Label>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="add-ligne-q"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Raison sociale, contact, email..."
                  className="h-11 pl-9"
                />
              </div>
              {query.trim() && (
                <div className="max-h-52 overflow-y-auto rounded-[12px] border border-border">
                  {hits.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">Aucun client trouvé.</p>
                  ) : (
                    hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setProspect({ id: h.id, nom: h.raisonSociale })}
                        className="block min-h-11 w-full border-b border-border px-3.5 py-2 text-left text-sm font-bold last:border-b-0 hover:bg-navy-50"
                      >
                        {h.raisonSociale}
                        {h.ville && <span className="text-xs font-medium text-muted-foreground"> · {h.ville}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-muted-foreground">2. Service</p>
          <div
            role="group"
            aria-label="Choisir le service"
            className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]"
          >
            {AJOUTABLES.map((s) => {
              const deja = dejaPresents.includes(s);
              const st = serviceStyle(s);
              const n = (TEMPLATES[s] ?? []).length;
              const on = service === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={deja}
                  aria-pressed={on}
                  onClick={() => setService(s)}
                  className={cn(
                    "min-h-[60px] rounded-[14px] border-2 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    on ? "border-lvl-500 bg-lvl-50" : deja ? "border-border bg-ground" : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-extrabold">
                    <span aria-hidden="true" className={cn("size-2 rounded-full", st.dot)} />
                    {SERVICES[s].label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {deja ? "Déjà au planning" : n ? `${n} tâche${n > 1 ? "s" : ""} de base` : "Tâches à ajouter à la main"}
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

        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="outline" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || !prospect || !service}>
            {pending ? "Ajout..." : "Ajouter au planning"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
