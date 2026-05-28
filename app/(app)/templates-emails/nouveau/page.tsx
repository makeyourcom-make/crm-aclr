import Link from "next/link";

import { TemplateForm } from "@/components/templates/template-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Nouveau template" };

export default async function NewTemplatePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouveau template email"
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
      <TemplateForm />
    </div>
  );
}
