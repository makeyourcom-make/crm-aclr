"use client";

/**
 * Bouton qui ouvre une modal de prévisualisation d'un email envoyé via le CRM.
 * Affiche le sujet, expéditeur, destinataire, statut, et le HTML rendu dans
 * une iframe sandboxée (pour éviter qu'un email malicieux exécute du JS).
 */
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";

interface EmailPreviewData {
  objet: string;
  expediteurEmail: string;
  expediteurNom?: string | null;
  destinataireEmail: string;
  cc?: string | null;
  bcc?: string | null;
  contenuHtml: string;
  contenuTexte: string;
  direction: string;
  statut: string;
  statutLabel: string;
  statutClass: string;
  envoyeLe?: Date | null;
  createdAt: Date;
  prospectNom?: string | null;
  userNom?: string | null;
}

export function EmailPreviewButton({ email }: { email: EmailPreviewData }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"html" | "text">("html");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
      >
        <Icon name="Eye" className="h-3 w-3" />
        Aperçu
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon
                    name={email.direction === "SORTANT" ? "MailPlus" : "MailOpen"}
                    className="h-4 w-4 text-muted-foreground"
                  />
                  <Badge
                    variant="secondary"
                    className={`font-normal ${email.statutClass}`}
                  >
                    {email.statutLabel}
                  </Badge>
                </div>
                <h2 className="mt-1 truncate text-base font-semibold">
                  {email.objet}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Fermer"
              >
                <Icon name="X" className="h-5 w-5" />
              </button>
            </div>

            {/* Métadonnées */}
            <div className="border-b border-border bg-muted/30 px-5 py-3 text-xs">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="font-medium text-muted-foreground">De :</span>
                <span>
                  {email.expediteurNom ? `${email.expediteurNom} <${email.expediteurEmail}>` : email.expediteurEmail}
                </span>
                <span className="font-medium text-muted-foreground">À :</span>
                <span>{email.destinataireEmail}</span>
                {email.cc && (
                  <>
                    <span className="font-medium text-muted-foreground">Cc :</span>
                    <span>{email.cc}</span>
                  </>
                )}
                {email.bcc && (
                  <>
                    <span className="font-medium text-muted-foreground">Bcc :</span>
                    <span>{email.bcc}</span>
                  </>
                )}
                <span className="font-medium text-muted-foreground">Date :</span>
                <span>
                  {(email.envoyeLe ?? email.createdAt).toLocaleString("fr-CH", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </span>
                {email.prospectNom && (
                  <>
                    <span className="font-medium text-muted-foreground">Client :</span>
                    <span>{email.prospectNom}</span>
                  </>
                )}
                {email.userNom && (
                  <>
                    <span className="font-medium text-muted-foreground">Envoyé par :</span>
                    <span>{email.userNom}</span>
                  </>
                )}
              </div>
            </div>

            {/* Onglets HTML / Texte */}
            <div className="flex gap-1 border-b border-border bg-card px-5 pt-2">
              <button
                type="button"
                onClick={() => setView("html")}
                className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${view === "html" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Rendu HTML
              </button>
              <button
                type="button"
                onClick={() => setView("text")}
                className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${view === "text" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Texte brut
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-auto bg-muted/10">
              {view === "html" ? (
                /*
                  iframe sandboxée — empêche tout JS dans l'email d'agir sur
                  notre app. srcdoc évite un round-trip réseau.
                */
                <iframe
                  srcDoc={email.contenuHtml || `<p style="font-family: sans-serif; color: #6b7280; padding: 2rem; text-align: center;">Aucun contenu HTML</p>`}
                  sandbox=""
                  className="h-full w-full bg-white"
                  title={email.objet}
                />
              ) : (
                <pre className="whitespace-pre-wrap p-5 text-sm font-mono text-foreground">
                  {email.contenuTexte || "(aucun contenu texte)"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
