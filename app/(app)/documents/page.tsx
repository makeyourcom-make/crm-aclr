import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

type Categorie = "FORMATION" | "VENTE" | "SUIVI";

const SECTIONS: { id: Categorie; label: string; hint: string }[] = [
  { id: "FORMATION", label: "Formation", hint: "Guides, scripts, onboarding" },
  { id: "VENTE", label: "Vente", hint: "Méthode de vente, argumentaires, supports" },
  { id: "SUIVI", label: "Suivi", hint: "Questionnaires de lancement, process, reporting" },
];

function humanSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fileIcon(type: string | null): string {
  if (!type) return "File";
  if (type.startsWith("video/")) return "Video";
  if (type === "application/pdf") return "FileText";
  if (type.startsWith("image/")) return "File";
  return "FileText";
}

export default async function DocumentsPage() {
  const user = await getSessionUser();
  const isAdmin = user?.role === "ADMIN";

  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      titre: true,
      description: true,
      categorie: true,
      fileUrl: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      createdAt: true,
    },
  });

  const byCat = (cat: Categorie) => docs.filter((d) => d.categorie === cat);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Documents"
        description={`${docs.length} document(s) partagé(s) avec l'équipe.`}
        actions={isAdmin ? <DocumentUploadButton /> : undefined}
      />

      <div className="mt-4 space-y-8">
        {SECTIONS.map((section) => {
          const items = byCat(section.id);
          return (
            <section key={section.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {section.label}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">{section.hint}</p>
                </div>
                {isAdmin && (
                  <DocumentUploadButton
                    defaultCategorie={section.id}
                    triggerLabel="Ajouter"
                    triggerClassName="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                  />
                )}
              </div>

              {items.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun document dans cette rubrique.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-col rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon name={fileIcon(d.fileType)} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {d.titre}
                          </p>
                          {d.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {d.description}
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <DeleteDocumentButton id={d.id} titre={d.titre} />
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate">
                          {humanSize(d.fileSize)}
                          {d.fileSize ? " · " : ""}
                          {formatDate(d.createdAt)}
                        </span>
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={d.fileName}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Icon name="Download" className="h-3.5 w-3.5" />
                          Ouvrir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
