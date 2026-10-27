/**
 * En-tête de page réutilisable (MYC Arena).
 *
 * Pattern : <PageHeader title="…" description="…" actions={<Button>…</Button>} />
 * Option `rubrique` : tuile d'icône colorée de la rubrique devant le titre
 * (« appels », « leads », « pipeline », « emails », « agenda », « stats »,
 * « finance », « projets »).
 *
 * Titre en Bricolage Grotesque 28 px / 800 (24 px sur téléphone).
 */
import { RubriqueIcon, type Rubrique } from "@/components/arena/rubrique-icon";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  rubrique?: Rubrique;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  rubrique,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          {rubrique && (
            <>
              <RubriqueIcon rubrique={rubrique} size={40} className="sm:hidden" />
              <RubriqueIcon rubrique={rubrique} size="lg" className="hidden sm:inline-flex" />
            </>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] break-words text-foreground sm:text-[28px]">
              {title}
            </h1>
            {description && (
              <div className="mt-1 text-sm font-medium text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
