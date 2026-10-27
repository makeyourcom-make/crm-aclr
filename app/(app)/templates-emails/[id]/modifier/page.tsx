import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TemplateForm } from "@/components/templates/template-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Modifier template" };

export default async function EditTemplatePage({ params }: PageProps) {
  const user = await requireAdmin();
  const { id } = await params;
  const [template, uses] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { id } }),
    prisma.email.count({ where: { templateUtiliseId: id } }),
  ]);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title={`Modifier · ${template.nom}`}
        description={
          uses > 0
            ? `Utilisé pour ${uses} mail${uses > 1 ? "s" : ""} envoyé${uses > 1 ? "s" : ""}.`
            : "Pas encore utilisé pour un envoi."
        }
        breadcrumb={
          <Link
            href="/templates-emails"
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour aux templates
          </Link>
        }
      />
      <TemplateForm initial={template} sampleCommerciale={user.name} usageCount={uses} />
    </div>
  );
}
