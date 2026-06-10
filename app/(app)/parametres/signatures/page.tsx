import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import {
  SignaturesManager,
  type SignatureItem,
} from "@/components/parametres/signatures-manager";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Signatures email" };
export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  const user = await requireUser();

  const [signatures, userFull] = await Promise.all([
    prisma.emailSignature.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, telephone: true },
    }),
  ]);

  const items: SignatureItem[] = signatures.map((s) => ({
    id: s.id,
    nom: s.nom,
    displayName: s.displayName,
    fonction: s.fonction,
    telephone: s.telephone,
    email: s.email,
    siteWeb: s.siteWeb,
    entreprise: s.entreprise,
    logoUrl: s.logoUrl,
    html: s.html,
    isDefault: s.isDefault,
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Signatures email"
        description="Crée et personnalise tes signatures. La signature par défaut est ajoutée automatiquement à tes emails."
        breadcrumb={
          <Link
            href="/parametres"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux paramètres
          </Link>
        }
      />

      <SignaturesManager
        signatures={items}
        defaults={{
          displayName: userFull?.name ?? "",
          email: userFull?.email ?? "",
          telephone: userFull?.telephone ?? "",
        }}
      />
    </div>
  );
}
