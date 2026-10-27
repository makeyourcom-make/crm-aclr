import Link from "next/link";
import { Inbox } from "lucide-react";

import { SpamRulesManager } from "@/components/emails/spam-rules-manager";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listBlockRules } from "@/app/(app)/emails/actions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Emails - Filtres anti-spam" };
export const dynamic = "force-dynamic";

export default async function SpamFiltersPage() {
  await requireUser();
  const rules = await listBlockRules();

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title="Filtres anti-spam"
        description="Bloque des expéditeurs, des domaines ou des sujets : les mails filtrés à la réception partent dans Spam, jamais perdus."
        actions={
          <Link href="/emails" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Inbox aria-hidden="true" />
            Retour à la boîte
          </Link>
        }
      />

      <SpamRulesManager initialRules={rules} />
    </div>
  );
}
