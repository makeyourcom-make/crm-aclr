import { PageHeader } from "@/components/page-header";
import { ChangePassword } from "@/components/settings/change-password";
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
        description="Mot de passe et double authentification (2FA) de ton compte."
      />
      <ChangePassword />
      <TotpSetup
        enabled={!!dbUser?.totpEnabled}
        recoveryRemaining={dbUser?.totpRecoveryCodes.length ?? 0}
      />
    </div>
  );
}
