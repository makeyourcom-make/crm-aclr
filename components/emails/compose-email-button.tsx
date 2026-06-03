"use client";

/**
 * Bouton "Nouveau mail" pour composer depuis la boîte de réception (/emails).
 *
 * Workflow :
 *  1. Clic → dialog avec recherche prospect (live)
 *  2. Sélection prospect → bascule sur le formulaire de rédaction
 *  3. Envoi via sendEmailToProspect()
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  searchProspectsForAttach,
  sendEmailToProspect,
} from "@/app/(app)/emails/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
  email: string | null;
}

export function ComposeEmailButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Étape 1 : sélection du destinataire
  const [selected, setSelected] = useState<ProspectOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProspectOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Étape 2 : rédaction
  const [objet, setObjet] = useState("");
  const [contenu, setContenu] = useState("");

  const reset = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setObjet("");
    setContenu("");
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    void searchProspectsForAttach(q).then((r) => {
      setResults(r);
      setSearching(false);
    });
  };

  const handleSelect = (prospect: ProspectOption) => {
    if (!prospect.email) {
      toast.error("Ce client n'a pas d'email enregistré — ajoute-le sur sa fiche d'abord.");
      return;
    }
    setSelected(prospect);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!objet.trim()) {
      toast.error("Donne un sujet.");
      return;
    }
    if (!contenu.trim()) {
      toast.error("Le contenu est vide.");
      return;
    }
    startTransition(async () => {
      const res = await sendEmailToProspect({
        prospectId: selected.id,
        objet: objet.trim(),
        contenu: contenu.trim(),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      if (res.dryRun) {
        toast.success("Email enregistré (mode dry-run, pas d'envoi réel).");
      } else {
        toast.success(`Email envoyé à ${selected.raisonSociale} ✓`);
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <Icon name="MailPlus" className="h-3.5 w-3.5" />
        Nouveau mail
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? `Email à ${selected.raisonSociale}` : "Nouveau mail"}
          </DialogTitle>
          <DialogDescription>
            {selected ? (
              <>
                Destinataire : <strong>{selected.email}</strong>{" "}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-2 text-xs text-primary hover:underline"
                >
                  changer
                </button>
              </>
            ) : (
              "Choisis le client destinataire en tapant son nom, sa ville ou son email."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Étape 1 : recherche prospect */}
        {!selected && (
          <div className="space-y-2">
            <Input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher un client…"
              disabled={pending}
            />
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              {!query && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Commence à taper pour voir les clients.
                </p>
              )}
              {searching && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Recherche…
                </p>
              )}
              {!searching && query && results.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Aucun client trouvé.
                </p>
              )}
              {!searching &&
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-muted last:border-b-0"
                  >
                    <p className="truncate font-medium">{p.raisonSociale}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.ville && <span>{p.ville}</span>}
                      {p.ville && p.email && <span> · </span>}
                      {p.email ? (
                        <span>{p.email}</span>
                      ) : (
                        <span className="text-red-600 italic">pas d'email</span>
                      )}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Étape 2 : rédaction */}
        {selected && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="objet">
                Sujet <span className="text-red-500">*</span>
              </Label>
              <Input
                id="objet"
                autoFocus
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Ex. Présentation Pack Web Complet"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenu">
                Contenu <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="contenu"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={`Bonjour {{prenomContact}},\n\n…`}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Variables disponibles : <code>{`{{prenomContact}}`}</code>,{" "}
                <code>{`{{nomContact}}`}</code>, <code>{`{{raisonSociale}}`}</code>,{" "}
                <code>{`{{ville}}`}</code>.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Envoi…" : "Envoyer"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
