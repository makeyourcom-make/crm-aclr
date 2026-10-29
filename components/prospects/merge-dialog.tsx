"use client";

/**
 * Demande de fusion d'un doublon dans la fiche courante.
 *
 * La fiche courante est la fiche CONSERVÉE (cible). L'utilisateur recherche le
 * doublon à fusionner dedans, puis envoie une demande qu'un admin validera.
 * Un admin peut aussi fusionner immédiatement (demande + validation).
 */
import { GitMerge, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { searchProspectsForAttach } from "@/app/(app)/emails/actions";
import {
  approuverMerge,
  findPendingMergeId,
  requestMerge,
} from "@/app/(app)/prospects/merge-actions";
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

type Hit = { id: string; raisonSociale: string; ville: string | null };

export function MergeDialog({
  cibleId,
  cibleRaisonSociale,
  isAdmin = false,
}: {
  cibleId: string;
  cibleRaisonSociale: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <GitMerge aria-hidden="true" />
        Fusionner un doublon
      </Button>
      {open && (
        <MergeDialogContent
          cibleId={cibleId}
          cibleRaisonSociale={cibleRaisonSociale}
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MergeDialogContent({
  cibleId,
  cibleRaisonSociale,
  isAdmin,
  onClose,
}: {
  cibleId: string;
  cibleRaisonSociale: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [source, setSource] = useState<Hit | null>(null);
  const [note, setNote] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    // Les résultats ne sont rendus que si q >= 2 et aucun doublon choisi :
    // inutile (et interdit par le compilateur React) de vider l'état ici.
    if (q.length < 2 || source) return;
    const s = ++seq.current;
    const timer = setTimeout(() => {
      void searchProspectsForAttach(q).then((r) => {
        if (s !== seq.current) return;
        // On exclut la fiche courante des résultats (on ne fusionne pas une fiche avec elle-même).
        setHits(r.filter((h) => h.id !== cibleId));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, source, cibleId]);

  const demander = () => {
    if (!source) return;
    startTransition(async () => {
      const res = await requestMerge({
        cibleId,
        sourceId: source.id,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la demande.");
        return;
      }
      toast.success("Demande de fusion envoyée, un admin va la valider.");
      router.refresh();
      onClose();
    });
  };

  // Variante admin « Fusionner maintenant » : demande + validation en une passe.
  const fusionnerMaintenant = () => {
    if (!source) return;
    startTransition(async () => {
      const req = await requestMerge({
        cibleId,
        sourceId: source.id,
        note: note.trim() || undefined,
      });
      if (!req.ok) {
        toast.error(req.error ?? "Échec de la demande.");
        return;
      }
      const pendingMerge = await findPendingMergeId(cibleId, source.id);
      if (!pendingMerge) {
        toast.success("Demande de fusion créée. Valide-la depuis « Fusions à valider ».");
        router.refresh();
        onClose();
        return;
      }
      const res = await approuverMerge(pendingMerge);
      if (!res.ok) {
        toast.error(res.error ?? "Fusion impossible, la demande reste en attente.");
        router.refresh();
        onClose();
        return;
      }
      toast.success(`« ${source.raisonSociale} » fusionnée dans « ${cibleRaisonSociale} ».`);
      router.refresh();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-4 rounded-[20px] p-5 sm:max-w-[560px] sm:p-6">
        <DialogHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
              Fusionner un doublon
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">
              Recherche la fiche en double de cette entreprise. Toutes ses données seront déplacées
              ici, rien n&apos;est supprimé.
            </DialogDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-muted-foreground">Doublon à fusionner</p>
          {source ? (
            <div className="flex items-center justify-between gap-2 rounded-[12px] border-2 border-lvl-500 bg-lvl-50 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 truncate font-extrabold">
                {source.raisonSociale}
                {source.ville && (
                  <span className="font-semibold text-muted-foreground"> · {source.ville}</span>
                )}
              </span>
              <button
                type="button"
                className="shrink-0 text-xs font-bold text-info-700 hover:underline"
                onClick={() => setSource(null)}
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Label htmlFor="merge-q" className="sr-only">
                  Rechercher le doublon
                </Label>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="merge-q"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Raison sociale, contact, email..."
                  className="h-11 pl-9"
                />
              </div>
              {query.trim().length >= 2 && (
                <div className="max-h-52 overflow-y-auto rounded-[12px] border border-border">
                  {hits.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      Aucune entreprise trouvée.
                    </p>
                  ) : (
                    hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSource(h)}
                        className="block min-h-11 w-full border-b border-border px-3.5 py-2 text-left text-sm font-bold last:border-b-0 hover:bg-navy-50"
                      >
                        {h.raisonSociale}
                        {h.ville && (
                          <span className="text-xs font-medium text-muted-foreground"> · {h.ville}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {source && (
          <div className="rounded-[14px] border border-border bg-ground px-3.5 py-3 text-[13px] leading-relaxed">
            <p className="font-bold text-foreground">
              On garde : <span className="text-lvl-700">{cibleRaisonSociale}</span>.
            </p>
            <p className="mt-0.5 font-bold text-foreground">
              On fusionne dedans : <span className="text-coral-600">{source.raisonSociale}</span>.
            </p>
            <p className="mt-1 font-semibold text-muted-foreground">
              Toutes les données du doublon seront déplacées ici, rien n&apos;est supprimé.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="merge-note">Note (optionnel)</Label>
          <Input
            id="merge-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pourquoi est-ce un doublon ?"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="outline" size="lg" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="lg"
              onClick={fusionnerMaintenant}
              disabled={pending || !source}
            >
              {pending ? "..." : "Fusionner maintenant"}
            </Button>
          )}
          <Button size="lg" onClick={demander} disabled={pending || !source}>
            {pending ? "Envoi..." : "Demander la fusion"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
