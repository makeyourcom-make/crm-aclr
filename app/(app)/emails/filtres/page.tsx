import Link from "next/link";

import { SpamRulesManager } from "@/components/emails/spam-rules-manager";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listBlockRules } from "@/app/(app)/emails/actions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Emails — Filtres anti-spam" };
export const dynamic = "force-dynamic";

export default async function SpamFiltersPage() {
  await requireUser();
  const rules = await listBlockRules();

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Filtres anti-spam"
          description="Bloque des expéditeurs, domaines ou sujets — les mails filtrés vont à la corbeille."
        />
        <Link
          href="/emails"
          className={buttonVariants({ variant: "outline" })}
        >
          <Icon name="Inbox" className="mr-1.5 h-4 w-4" />
          Retour à la boîte
        </Link>
      </div>

      <SpamRulesManager initialRules={rules} />
    </div>
  );
}
