import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TemplateForm } from "@/components/templates/template-form";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Nouveau template" };

export default async function NewTemplatePage() {
  const user = await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title="Nouveau template email"
        description="Un bon template = un mail prêt en un clic depuis la fiche d'une entreprise."
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
      <TemplateForm sampleCommerciale={user.name} />
    </div>
  );
}
