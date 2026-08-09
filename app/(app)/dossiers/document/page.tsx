import { DossierDocPreview } from "@/components/dossiers/dossier-doc-preview";
import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  DOSSIERS_DOC_EDIT_URL,
  DOSSIERS_DOC_PREVIEW_URL,
} from "@/lib/dossiers-doc";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Gestion des projets — Document de suivi" };
export const dynamic = "force-dynamic";

export default async function DossiersDocumentPage() {
  // Auth only : la page ne charge aucune donnée sensible, juste l'aperçu Doc.
  await requireUser();

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Gestion des projets"
        description="Document de suivi partagé — Sophie & Arthur."
        actions={
          <a
            href={DOSSIERS_DOC_EDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="ExternalLink" className="mr-1.5 h-4 w-4" />
            Ouvrir pour modifier
          </a>
        }
      />

      <DossiersTabs />

      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Pour <strong>ajouter ou compléter des lignes</strong>, clique sur{" "}
        <strong>« Ouvrir pour modifier »</strong> ci-dessus : le document
        s&apos;ouvre dans Google Docs et Sophie comme toi y écrivez à deux
        (Google n&apos;autorise jamais l&apos;édition dans une fenêtre intégrée).
        <br />
        L&apos;aperçu ci-dessous n&apos;affichera le contenu que si le document
        est partagé en <strong>« Tous les utilisateurs disposant du lien →
        Lecteur »</strong>. Aujourd&apos;hui il est restreint : l&apos;aperçu
        montre donc l&apos;écran d&apos;accès de Google — c&apos;est normal,
        passe par le bouton. (Pour l&apos;aperçu intégré, ouvre le partage du
        Doc et mets « Lecteur » pour les titulaires du lien.)
      </div>

      {/* Aperçu intégré (lecture seule) + bouton Actualiser. L'iframe /preview
          est conçue pour être embarquée ; l'édition passe par le bouton du haut
          (frame-ancestors de Google interdit l'édition en iframe). */}
      <DossierDocPreview previewUrl={DOSSIERS_DOC_PREVIEW_URL} />
    </div>
  );
}
