import {
  ClipboardList,
  Download,
  File,
  FileText,
  GraduationCap,
  Handshake,
  ImageIcon,
  Library,
  Video,
  type LucideIcon,
} from "lucide-react";

import { EmptyState, SectionCard, StatTile, StatusPill } from "@/components/arena";
import type { Tone } from "@/components/arena/tones";
import { TONE_CLASSES } from "@/components/arena/tones";
import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

type Categorie = "FORMATION" | "VENTE" | "SUIVI";

const SECTIONS: {
  id: Categorie;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}[] = [
  {
    id: "FORMATION",
    label: "Formation",
    hint: "Guides, scripts, onboarding",
    icon: GraduationCap,
    tone: "violet",
  },
  {
    id: "VENTE",
    label: "Vente",
    hint: "Méthode de vente, argumentaires, supports",
    icon: Handshake,
    tone: "coral",
  },
  {
    id: "SUIVI",
    label: "Suivi",
    hint: "Questionnaires de lancement, process, reporting",
    icon: ClipboardList,
    tone: "green",
  },
];

/** Un document ajouté il y a moins de 14 jours est signalé « Nouveau ». */
const NEW_DAYS = 14;

function humanSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fileMeta(type: string | null): { icon: LucideIcon; tone: Tone; label: string } {
  if (!type) return { icon: File, tone: "navy", label: "Fichier" };
  if (type.startsWith("video/")) return { icon: Video, tone: "coral", label: "Vidéo" };
  if (type === "application/pdf") return { icon: FileText, tone: "red", label: "PDF" };
  if (type.startsWith("image/")) return { icon: ImageIcon, tone: "violet", label: "Image" };
  return { icon: FileText, tone: "blue", label: "Document" };
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
  const newSince = new Date();
  newSince.setDate(newSince.getDate() - NEW_DAYS);
  const nbNouveaux = docs.filter((d) => d.createdAt >= newSince).length;

  return (
    <PageShell>
      <IconPageHeader
        icon={Library}
        tone="blue"
        title="Documents"
        description={`${docs.length} document(s) partagé(s) avec l'équipe${
          nbNouveaux > 0 ? ` · ${nbNouveaux} nouveau(x) ces ${NEW_DAYS} derniers jours` : ""
        }.`}
        actions={isAdmin ? <DocumentUploadButton /> : undefined}
      />

      {/* Raccourcis par rubrique */}
      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        {SECTIONS.map((s) => (
          <StatTile
            key={s.id}
            label={s.label}
            value={byCat(s.id).length}
            sub={s.hint}
            tone={s.tone}
            icon={s.icon}
            href={`#docs-${s.id.toLowerCase()}`}
          />
        ))}
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const items = byCat(section.id);
          return (
            <SectionCard
              key={section.id}
              id={`docs-${section.id.toLowerCase()}`}
              className="scroll-mt-20"
              title={section.label}
              description={`${section.hint} · ${items.length} document(s)`}
              icon={section.icon}
              tone={section.tone}
              action={
                isAdmin ? (
                  <DocumentUploadButton
                    defaultCategorie={section.id}
                    triggerLabel="Ajouter"
                    triggerClassName={buttonVariants({ variant: "outline" })}
                  />
                ) : undefined
              }
            >
              {items.length === 0 ? (
                <EmptyState
                  icon={section.icon}
                  tone={section.tone}
                  title="Aucun document dans cette rubrique"
                  description={
                    isAdmin
                      ? "Ajoute le premier support : il sera visible par toute l'équipe."
                      : "Les supports arriveront bientôt ici."
                  }
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((d) => {
                    const meta = fileMeta(d.fileType);
                    const FileIcon = meta.icon;
                    const t = TONE_CLASSES[meta.tone];
                    const isNew = d.createdAt >= newSince;
                    return (
                      <li
                        key={d.id}
                        className="flex min-w-0 flex-col rounded-[14px] border border-border bg-card p-3.5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-arena"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-[12px]",
                              t.bg,
                              t.text,
                            )}
                          >
                            <FileIcon className="size-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-bold text-foreground">
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

                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {isNew && <StatusPill tone="gold">Nouveau</StatusPill>}
                            <span className="truncate">
                              {meta.label}
                              {d.fileSize ? ` · ${humanSize(d.fileSize)}` : ""}
                              {" · "}
                              {formatDate(d.createdAt)}
                            </span>
                          </span>
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={d.fileName}
                            aria-label={`Ouvrir ${d.titre}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "shrink-0",
                            )}
                          >
                            <Download aria-hidden="true" />
                            Ouvrir
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          );
        })}
      </div>
    </PageShell>
  );
}
