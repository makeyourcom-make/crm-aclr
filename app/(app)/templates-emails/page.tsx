import Link from "next/link";
import { FileText, MailPlus, Send, Sparkles } from "lucide-react";
import type { EmailTemplateType } from "@prisma/client";

import { EmptyState } from "@/components/arena/empty-state";
import { formatInt } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { StatTile } from "@/components/arena/stat-tile";
import type { Tone } from "@/components/arena/tones";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Templates emails" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<EmailTemplateType, string> = {
  COLD_1: "Cold 1",
  COLD_2_RELANCE: "Cold 2",
  COLD_3_RELANCE: "Cold 3",
  POST_RDV: "Post-RDV",
  POST_PROPOSITION: "Proposition",
  RELANCE_PROPOSITION: "Relance prop.",
  RELANCE_FACTURE: "Relance facture",
  RENOUVELLEMENT: "Renouvellement",
  AUTRE: "Autre",
};

const TYPE_TONE: Record<EmailTemplateType, Tone> = {
  COLD_1: "blue",
  COLD_2_RELANCE: "blue",
  COLD_3_RELANCE: "blue",
  POST_RDV: "gold",
  POST_PROPOSITION: "violet",
  RELANCE_PROPOSITION: "violet",
  RELANCE_FACTURE: "red",
  RENOUVELLEMENT: "green",
  AUTRE: "navy",
};

export default async function TemplatesEmailsPage() {
  await requireAdmin();
  const [templates, usage] = await Promise.all([
    prisma.emailTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { type: "asc" }, { nom: "asc" }],
    }),
    // Nombre de mails envoyés avec chaque modèle (vraie utilisation).
    prisma.email.groupBy({
      by: ["templateUtiliseId"],
      where: { templateUtiliseId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const usedBy = new Map<string, number>();
  for (const u of usage) {
    if (u.templateUtiliseId) usedBy.set(u.templateUtiliseId, u._count._all);
  }
  const activeCount = templates.filter((t) => t.isActive).length;
  const totalSends = [...usedBy.values()].reduce((s, n) => s + n, 0);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title="Templates emails"
        description={
          <>
            {templates.length} template{templates.length > 1 ? "s" : ""}. Les variables{" "}
            <code className="font-mono text-[13px]">{"{{prenomContact}}"}</code>,{" "}
            <code className="font-mono text-[13px]">{"{{raisonSociale}}"}</code>,{" "}
            <code className="font-mono text-[13px]">{"{{ville}}"}</code>, etc. sont
            remplacées au moment de l&apos;envoi.
          </>
        }
        actions={
          <Link
            href="/templates-emails/nouveau"
            className={buttonVariants({ variant: "hero", size: "lg" })}
          >
            <MailPlus aria-hidden="true" />
            Nouveau template
          </Link>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={MailPlus}
          tone="teal"
          title="Aucun template pour l'instant"
          description="Crée le premier pour la prospection à froid : la commerciale le chargera en un clic depuis la fiche d'une entreprise."
          action={
            <Link
              href="/templates-emails/nouveau"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <MailPlus aria-hidden="true" />
              Créer un template
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            <StatTile
              label="Templates actifs"
              value={activeCount}
              sub={`sur ${formatInt(templates.length)}`}
              tone="teal"
              icon={FileText}
            />
            <StatTile
              label="Mails envoyés avec un template"
              value={totalSends}
              sub="depuis la fiche entreprise"
              tone="violet"
              icon={Send}
            />
          </div>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {templates.map((t) => {
              const uses = usedBy.get(t.id) ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/templates-emails/${t.id}/modifier`}
                  className={cn(
                    "group flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-border bg-card p-5 shadow-arena transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-arena-lg",
                    !t.isActive && "border-dashed bg-ground shadow-none",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusPill tone={TYPE_TONE[t.type] ?? "navy"}>
                      {TYPE_LABEL[t.type] ?? t.type}
                    </StatusPill>
                    {t.isActive ? (
                      uses > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-lvl-700">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          {formatInt(uses)} envoi{uses > 1 ? "s" : ""}
                        </span>
                      )
                    ) : (
                      <StatusPill tone="navy" dot={false}>
                        Inactif
                      </StatusPill>
                    )}
                  </div>
                  <p className="font-display text-lg leading-tight font-extrabold tracking-[-0.01em] break-words text-foreground">
                    {t.nom}
                  </p>
                  <p className="line-clamp-2 text-[13px] font-semibold text-foreground">
                    {t.objet}
                  </p>
                  <p className="line-clamp-3 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                    {t.contenu}
                  </p>
                  <span className="mt-auto pt-1 text-xs font-bold text-info-700 group-hover:underline">
                    Modifier le template
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
