import { PageHeader } from "@/components/page-header";
import { TotpSetup } from "@/components/settings/totp-setup";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Sécurité" };
export const dynamic = "force-dynamic";

export default async function SecuritePage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true, totpRecoveryCodes: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Sécurité"
        description="Double authentification (2FA) de ton compte."
      />
      <TotpSetup
        enabled={!!dbUser?.totpEnabled}
        recoveryRemaining={dbUser?.totpRecoveryCodes.length ?? 0}
      />
    </div>
  );
}
