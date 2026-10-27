"use client";

/**
 * Bouton "Nouveau mail" pour composer depuis la boîte de réception (/emails).
 *
 * Workflow :
 *  1. Clic → dialog avec recherche prospect (live)
 *  2. Sélection prospect → bascule sur le formulaire de rédaction
 *  3. Envoi via sendEmailToProspect() (client) ou sendFreeFormEmail()
 *
 * Variante `hero` (CTA dégradé coral du bandeau). Un mail envoyé à un client
 * crée l'activité EMAIL_ENVOYE → toast sobre puis rafraîchissement de la
 * coquille (objectifs du jour / série).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, MailPlus, Save, Send, Users } from "lucide-react";

import {
  getMyDefaultSignatureHtml,
  saveEmailDraft,
  searchProspectsForAttach,
  sendEmailToProspect,
  sendFreeFormEmail,
} from "@/app/(app)/emails/actions";
import { resultToast } from "@/components/arena/celebrate";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { FIELD_CLASS, initialsFrom, uiText } from "@/components/emails/mail-ui";
import { RecipientInput } from "@/components/emails/recipient-input";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { htmlToPlainText } from "@/lib/email-html";
import { cn } from "@/lib/utils";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
  email: string | null;
  contactPrenom?: string | null;
  contactNom?: string | null;
  /** Client avec contrat (affiché en premier, pastille « Client »). */
  isClient?: boolean;
  /** Résultat approchant (faute de frappe tolérée), pas exact. */
  approx?: boolean;
}

type Mode = "client" | "freeform";

/** Variables remplacées côté serveur (mail envoyé à un client du CRM). */
const MAIL_VARIABLES = [
  "{{prenomContact}}",
  "{{nomContact}}",
  "{{raisonSociale}}",
  "{{ville}}",
  "{{commerciale}}",
];

export function ComposeEmailButton({
  variant = "default",
}: {
  /** `hero` : CTA dégradé coral (bandeau navy de la rubrique Emails). */
  variant?: "default" | "hero";
} = {}) {
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

  // Étape 2 : rédaction (le corps est du HTML riche via l'éditeur).
  const [objet, setObjet] = useState("");
  const [contenuHtml, setContenuHtml] = useState("");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  // Aperçu (lecture seule) de la signature ajoutée automatiquement à l'envoi.
  const [sigPreview, setSigPreview] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  const contenuTexte = htmlToPlainText(contenuHtml);

  const reset = () => {
    setMode("client");
    setSelected(null);
    setQuery("");
    setResults([]);
    setFreeEmail("");
    setObjet("");
    setContenuHtml("");
    setAttachments([]);
    setCc("");
    setBcc("");
    setShowCc(false);
    setEditorKey((k) => k + 1);
  };

  /** Vrai si l'utilisateur a fini l'étape 1 (a un destinataire valide). */
  const hasRecipient =
    mode === "client" ? selected !== null : /^\S+@\S+\.\S+$/.test(freeEmail.trim());

  // Recherche « live » : attend 250 ms après la dernière frappe, et ignore les
  // réponses périmées (une requête lente pour « C » ne doit pas écraser celle
  // pour « Cle » arrivée avant elle).
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      void searchProspectsForAttach(q)
        .then((r) => {
          if (seq !== searchSeq.current) return; // réponse périmée
          setResults(r);
          setSearching(false);
        })
        .catch(() => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) {
      searchSeq.current++; // invalide une recherche encore en vol
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
  };

  const handleSelect = (prospect: ProspectOption) => {
    if (!prospect.email) {
      toast.error("Ce client n'a pas d'email enregistré : ajoute-le sur sa fiche d'abord.");
      return;
    }
    setSelected(prospect);
  };

  const handleSaveDraft = () => {
    if (!hasRecipient) {
      toast.error("Choisis d'abord un destinataire.");
      return;
    }
    if (!objet.trim() && !contenuTexte.trim()) {
      toast.error("Rien à enregistrer (sujet et contenu vides).");
      return;
    }
    startTransition(async () => {
      const res = await saveEmailDraft({
        prospectId: mode === "client" && selected ? selected.id : undefined,
        to: mode === "freeform" ? freeEmail.trim() : undefined,
        objet: objet.trim(),
        contenu: contenuTexte.trim(),
        contenuHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
        cc: cc.trim(),
        bcc: bcc.trim(),
      });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'enregistrement."));
        return;
      }
      toast.success("Brouillon enregistré : retrouve-le dans « Brouillons ».");
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
    if (!contenuTexte.trim()) {
      toast.error("Le contenu est vide.");
      return;
    }
    startTransition(async () => {
      const res =
        mode === "client" && selected
          ? await sendEmailToProspect({
              prospectId: selected.id,
              objet: objet.trim(),
              contenu: contenuTexte.trim(),
              contenuHtml,
              attachments: attachments.length > 0 ? attachments : undefined,
              cc: cc.trim() || undefined,
              bcc: bcc.trim() || undefined,
            })
          : await sendFreeFormEmail({
              to: freeEmail.trim(),
              objet: objet.trim(),
              contenu: contenuTexte.trim(),
              contenuHtml,
              attachments: attachments.length > 0 ? attachments : undefined,
              cc: cc.trim() || undefined,
              bcc: bcc.trim() || undefined,
            });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'envoi."));
        return;
      }
      const recipientLabel =
        mode === "client" && selected
          ? selected.raisonSociale
          : freeEmail.trim();
      if (mode === "client" && selected) {
        // Mail à un client : activité EMAIL_ENVOYE créée (même en dry-run).
        resultToast(
          res.dryRun ? "Email enregistré (dry-run)" : "Mail envoyé",
          `à ${recipientLabel} · ajouté à la fiche client`,
        );
      } else if (res.dryRun) {
        toast.success("Email enregistré (mode dry-run, pas d'envoi réel).");
      } else {
        toast.success(`Email envoyé à ${recipientLabel}.`, {
          description:
            "S'il correspond à une de tes entreprises, il est rattaché à sa fiche.",
        });
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  const recipientShown =
    mode === "client" && selected ? (selected.email ?? "") : freeEmail.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          // Charge l'aperçu de la signature (ajoutée automatiquement à l'envoi).
          void getMyDefaultSignatureHtml().then(setSigPreview);
        } else {
          reset();
        }
      }}
    >
      <DialogTrigger
        className={buttonVariants({
          variant: variant === "hero" ? "hero" : "default",
          size: variant === "hero" ? "lg" : "default",
        })}
      >
        <MailPlus aria-hidden="true" />
        Nouveau mail
      </DialogTrigger>
      <DialogContent className="rounded-[20px] p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="pr-8 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
            {hasRecipient
              ? mode === "client" && selected
                ? `Email à ${selected.raisonSociale}`
                : `Email à ${freeEmail.trim()}`
              : "Nouveau mail"}
          </DialogTitle>
          <DialogDescription>
            {hasRecipient ? (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">À</span>
                <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full bg-info-50 py-1 pr-3 pl-1 text-[13px] font-bold text-info-700">
                  <span
                    aria-hidden="true"
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-extrabold"
                  >
                    {initialsFrom(
                      mode === "client" && selected ? selected.raisonSociale : recipientShown,
                    )}
                  </span>
                  <span className="truncate">{recipientShown}</span>
                </span>
                {mode === "client" && selected?.isClient && (
                  <span className="rounded-full bg-win-50 px-2 py-0.5 text-[11px] font-bold text-win-700">
                    Client
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setFreeEmail("");
                  }}
                  className="rounded-[8px] px-1.5 py-1 text-[13px] font-bold text-info-700 underline underline-offset-2 hover:bg-info-50"
                >
                  changer
                </button>
              </span>
            ) : (
              "Choisis un client existant ou saisis directement une adresse email."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Étape 1 : sélection destinataire (2 modes) */}
        {!hasRecipient && (
          <div className="space-y-3">
            {/* Toggle Client / Adresse libre */}
            <div
              role="group"
              aria-label="Type de destinataire"
              className="flex gap-0.5 rounded-[12px] bg-navy-50 p-[3px]"
            >
              <button
                type="button"
                onClick={() => setMode("client")}
                aria-pressed={mode === "client"}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold text-foreground transition-colors",
                  mode === "client"
                    ? "bg-card shadow-[0_1px_3px_rgba(14,25,54,0.14)]"
                    : "hover:bg-navy-100",
                )}
              >
                <Users className="size-4" aria-hidden="true" />
                Client existant
              </button>
              <button
                type="button"
                onClick={() => setMode("freeform")}
                aria-pressed={mode === "freeform"}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold text-foreground transition-colors",
                  mode === "freeform"
                    ? "bg-card shadow-[0_1px_3px_rgba(14,25,54,0.14)]"
                    : "hover:bg-navy-100",
                )}
              >
                <Mail className="size-4" aria-hidden="true" />
                Adresse libre
              </button>
            </div>

            {/* Mode client : recherche prospect */}
            {mode === "client" && (
              <div className="space-y-2">
                <Label htmlFor="compose-search" className="text-xs font-bold text-muted-foreground">
                  À : rechercher un client (nom, entreprise, email, ville)
                </Label>
                <input
                  id="compose-search"
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Ex. Garage, Perrin, Thorens…"
                  disabled={pending}
                  className={FIELD_CLASS}
                />
                <div className="max-h-72 overflow-y-auto rounded-[14px] border border-border p-1">
                  {!query && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Commence à taper pour voir tes clients.
                    </p>
                  )}
                  {searching && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Recherche…
                    </p>
                  )}
                  {!searching && query && results.length === 0 && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Aucun client trouvé. Tu peux passer en « Adresse libre ».
                    </p>
                  )}
                  {!searching && results.length > 0 && results[0]!.approx && (
                    <p className="mb-1 rounded-[10px] bg-gold-50 px-3 py-2 text-xs font-bold text-gold-700">
                      Aucun résultat exact : résultats approchants
                    </p>
                  )}
                  {!searching &&
                    results.map((p) => {
                      const contact = [p.contactPrenom, p.contactNom]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelect(p)}
                          className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-navy-50"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                              p.isClient ? "bg-win-50 text-win-700" : "bg-info-50 text-info-700",
                            )}
                          >
                            {initialsFrom(p.raisonSociale)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-bold">
                              <span className="truncate">{p.raisonSociale}</span>
                              {p.isClient && (
                                <span className="shrink-0 rounded-full bg-win-50 px-2 py-0.5 text-[11px] font-bold text-win-700">
                                  Client
                                </span>
                              )}
                            </span>
                            {contact && contact.toLowerCase() !== p.raisonSociale.toLowerCase() && (
                              <span className="block truncate text-xs">{contact}</span>
                            )}
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.ville && <span>{p.ville}</span>}
                              {p.ville && p.email && <span> · </span>}
                              {p.email ? (
                                <span>{p.email}</span>
                              ) : (
                                <span className="text-alert-700 italic">pas d&apos;email</span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Mode adresse libre : saisie email */}
            {mode === "freeform" && (
              <div className="space-y-2">
                <Label htmlFor="freeform-email" className="text-xs font-bold text-muted-foreground">
                  À : adresse email{" "}
                  <span className="text-alert-700" aria-hidden="true">
                    *
                  </span>
                </Label>
                <input
                  id="freeform-email"
                  type="email"
                  autoFocus
                  value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                  placeholder="prenom.nom@entreprise.ch"
                  disabled={pending}
                  required
                  className={FIELD_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  Rattachement automatique si l&apos;adresse correspond à une de tes
                  entreprises. Sinon le mail ne comptera pas dans tes stats : pense à
                  créer le client.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Étape 2 : rédaction */}
        {hasRecipient && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CC / CCI : repliés par défaut. */}
            <div className="space-y-1.5">
              {!showCc ? (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
                >
                  + Cc / Cci
                </button>
              ) : (
                <div className="space-y-2 rounded-[14px] border border-border bg-ground p-3">
                  <Label htmlFor="compose-cc" className="text-xs font-bold text-muted-foreground">
                    Cc
                  </Label>
                  <RecipientInput
                    id="compose-cc"
                    value={cc}
                    onChange={setCc}
                    placeholder="copie@exemple.ch, autre@exemple.ch"
                  />
                  <Label htmlFor="compose-bcc" className="text-xs font-bold text-muted-foreground">
                    Cci (copie cachée)
                  </Label>
                  <RecipientInput
                    id="compose-bcc"
                    value={bcc}
                    onChange={setBcc}
                    placeholder="copie.cachee@exemple.ch"
                  />
                  <p className="text-xs text-muted-foreground">
                    Plusieurs adresses séparées par une virgule ou un
                    point-virgule.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compose-objet" className="text-xs font-bold text-muted-foreground">
                Objet{" "}
                <span className="text-alert-700" aria-hidden="true">
                  *
                </span>
              </Label>
              <input
                id="compose-objet"
                autoFocus
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Ex. Proposition Google Ads pour votre saison d'hiver"
                required
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">
                Message{" "}
                <span className="text-alert-700" aria-hidden="true">
                  *
                </span>
              </p>
              <RichTextEditor
                key={editorKey}
                onChange={setContenuHtml}
                disabled={pending}
                placeholder="Bonjour {{prenomContact}}, …"
                variables={mode === "client" ? MAIL_VARIABLES : undefined}
                footer={
                  sigPreview ? (
                    <div className="border-t border-dashed border-border bg-ground px-4 py-2.5">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        Signature ajoutée automatiquement à l&apos;envoi
                      </p>
                      <div
                        className="text-xs"
                        dangerouslySetInnerHTML={{ __html: sigPreview }}
                      />
                    </div>
                  ) : undefined
                }
              />
              {mode === "client" && (
                <p className="text-xs text-muted-foreground">
                  Les variables sont remplacées automatiquement avec les infos du client.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">Pièces jointes</p>
              <AttachmentPicker
                value={attachments}
                onChange={setAttachments}
                disabled={pending}
              />
            </div>

            <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap rounded-b-[20px] bg-ground px-5 sm:-mx-6 sm:-mb-6 sm:justify-start sm:px-6">
              <Button type="submit" variant="hero" disabled={pending}>
                <Send aria-hidden="true" />
                {pending ? "Envoi…" : "Envoyer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleSaveDraft}
                disabled={pending}
              >
                <Save aria-hidden="true" />
                Enregistrer le brouillon
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
