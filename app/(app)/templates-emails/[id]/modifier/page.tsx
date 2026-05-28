import Link from "next/link";
import { notFound } from "next/navigation";

import { TemplateForm } from "@/components/templates/template-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Modifier template" };

export default async function EditTemplatePage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
      <PageHeader
        title={`Modifier · ${template.nom}`}
        breadcrumb={
          <Link
            href="/templates-emails"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux templates
          </Link>
        }
      />
      <TemplateForm initial={template} />
    </div>
  );
}
