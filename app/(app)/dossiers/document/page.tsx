import { ExternalLink, Info } from "lucide-react";

import { DossierDocPreview } from "@/components/dossiers/dossier-doc-preview";
import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DOSSIERS_DOC_EDIT_URL, DOSSIERS_DOC_PREVIEW_URL } from "@/lib/dossiers-doc";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Gestion des projets · Document de suivi" };
export const dynamic = "force-dynamic";

export default async function DossiersDocumentPage() {
  // Auth only : la page ne charge aucune donnée sensible, juste l'aperçu Doc.
  await requireUser();

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="projets"
        title="Gestion des projets"
        description="Document de suivi client partagé par l'équipe."
        actions={
          <a
            href={DOSSIERS_DOC_EDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            <ExternalLink aria-hidden="true" />
            Ouvrir pour modifier
            <span className="sr-only"> (nouvel onglet Google Docs)</span>
          </a>
        }
      />

      <div className="mb-5">
        <DossiersTabs />
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-[16px] border border-[#FFE0B2] bg-gold-50 px-4 py-3.5 text-[13px] leading-relaxed text-gold-700">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          Pour <strong>ajouter ou compléter des lignes</strong>, clique sur <strong>« Ouvrir pour modifier »</strong> :
          le document s&apos;ouvre dans Google Docs et toute l&apos;équipe peut y écrire en même temps (Google
          n&apos;autorise jamais l&apos;édition dans une fenêtre intégrée).
          <br />
          L&apos;aperçu ci-dessous n&apos;affiche le contenu que si le document est partagé en{" "}
          <strong>« Tous les utilisateurs disposant du lien · Lecteur »</strong>. S&apos;il est restreint, l&apos;aperçu
          montre l&apos;écran d&apos;accès de Google : c&apos;est normal, passe par le bouton. (Pour l&apos;aperçu
          intégré, ouvre le partage du Doc et mets « Lecteur » pour les titulaires du lien.)
        </p>
      </div>

      {/* Aperçu intégré (lecture seule) + bouton Actualiser. L'iframe /preview
          est conçue pour être embarquée ; l'édition passe par le bouton du haut
          (frame-ancestors de Google interdit l'édition en iframe). */}
      <DossierDocPreview previewUrl={DOSSIERS_DOC_PREVIEW_URL} />
    </div>
  );
}
