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
  saveEmailDraft,
  searchProspectsForAttach,
  sendEmailToProspect,
  sendFreeFormEmail,
} from "@/app/(app)/emails/actions";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
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

type Mode = "client" | "freeform";

export function ComposeEmailButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Mode : client enregistré OU adresse libre
  const [mode, setMode] = useState<Mode>("client");

  // Étape 1 (mode client) : sélection du destinataire
  const [selected, setSelected] = useState<ProspectOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProspectOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Étape 1 (mode freeform) : email libre
  const [freeEmail, setFreeEmail] = useState("");

  // Étape 2 : rédaction
  const [objet, setObjet] = useState("");
  const [contenu, setContenu] = useState("");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);

  const reset = () => {
    setMode("client");
    setSelected(null);
    setQuery("");
    setResults([]);
    setFreeEmail("");
    setObjet("");
    setContenu("");
    setAttachments([]);
  };

  /** Vrai si l'utilisateur a fini l'étape 1 (a un destinataire valide). */
  const hasRecipient =
    mode === "client" ? selected !== null : /^\S+@\S+\.\S+$/.test(freeEmail.trim());

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

  const handleSaveDraft = () => {
    if (!hasRecipient) {
      toast.error("Choisis d'abord un destinataire.");
      return;
    }
    if (!objet.trim() && !contenu.trim()) {
      toast.error("Rien à enregistrer (sujet et contenu vides).");
      return;
    }
    startTransition(async () => {
      const res = await saveEmailDraft({
        prospectId: mode === "client" && selected ? selected.id : undefined,
        to: mode === "freeform" ? freeEmail.trim() : undefined,
        objet: objet.trim(),
        contenu: contenu.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success("Brouillon enregistré — retrouve-le dans « Brouillons » ✓");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRecipient) return;
    if (!objet.trim()) {
      toast.error("Donne un sujet.");
      return;
    }
    if (!contenu.trim()) {
      toast.error("Le contenu est vide.");
      return;
    }
    startTransition(async () => {
      const res =
        mode === "client" && selected
          ? await sendEmailToProspect({
              prospectId: selected.id,
              objet: objet.trim(),
              contenu: contenu.trim(),
              attachments: attachments.length > 0 ? attachments : undefined,
            })
          : await sendFreeFormEmail({
              to: freeEmail.trim(),
              objet: objet.trim(),
              contenu: contenu.trim(),
              attachments: attachments.length > 0 ? attachments : undefined,
            });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      const recipientLabel =
        mode === "client" && selected
          ? selected.raisonSociale
          : freeEmail.trim();
      if (res.dryRun) {
        toast.success("Email enregistré (mode dry-run, pas d'envoi réel).");
      } else {
        toast.success(`Email envoyé à ${recipientLabel} ✓`);
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
            {hasRecipient
              ? mode === "client" && selected
                ? `Email à ${selected.raisonSociale}`
                : `Email à ${freeEmail.trim()}`
              : "Nouveau mail"}
          </DialogTitle>
          <DialogDescription>
            {hasRecipient ? (
              <>
                Destinataire :{" "}
                <strong>
                  {mode === "client" && selected ? selected.email : freeEmail.trim()}
                </strong>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setFreeEmail("");
                  }}
                  className="ml-2 text-xs text-primary hover:underline"
                >
                  changer
                </button>
              </>
            ) : (
              "Choisis un client existant ou saisis directement une adresse email."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Étape 1 : sélection destinataire (2 modes) */}
        {!hasRecipient && (
          <div className="space-y-3">
            {/* Toggle Client / Adresse libre */}
            <div className="flex gap-1 rounded-md bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("client")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "client"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon name="Users" className="mr-1 inline h-3 w-3" />
                Client existant
              </button>
              <button
                type="button"
                onClick={() => setMode("freeform")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "freeform"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon name="Mail" className="mr-1 inline h-3 w-3" />
                Adresse libre
              </button>
            </div>

            {/* Mode client : recherche prospect */}
            {mode === "client" && (
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
                            <span className="text-red-600 italic">pas d&apos;email</span>
                          )}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Mode adresse libre : saisie email */}
            {mode === "freeform" && (
              <div className="space-y-2">
                <Label htmlFor="freeform-email">
                  Email du destinataire{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="freeform-email"
                  type="email"
                  autoFocus
                  value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                  placeholder="prenom.nom@exemple.com"
                  disabled={pending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Si cette adresse correspond à un client existant, le mail
                  sera automatiquement rattaché à sa fiche.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Étape 2 : rédaction */}
        {hasRecipient && (
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
              {mode === "client" && (
                <p className="text-[11px] text-muted-foreground">
                  Variables disponibles : <code>{`{{prenomContact}}`}</code>,{" "}
                  <code>{`{{nomContact}}`}</code>, <code>{`{{raisonSociale}}`}</code>,{" "}
                  <code>{`{{ville}}`}</code>.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Pièces jointes</Label>
              <AttachmentPicker
                value={attachments}
                onChange={setAttachments}
                disabled={pending}
              />
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
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={pending}
              >
                <Icon name="Save" className="mr-1.5 h-3.5 w-3.5" />
                Enregistrer le brouillon
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
