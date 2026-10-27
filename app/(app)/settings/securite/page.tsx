import { ShieldCheck } from "lucide-react";

import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
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
    <PageShell width="tight">
      <IconPageHeader
        icon={ShieldCheck}
        tone="green"
        title="Sécurité"
        description="Mot de passe et double authentification (2FA) de ton compte."
      />
      <ChangePassword />
      <TotpSetup
        enabled={!!dbUser?.totpEnabled}
        recoveryRemaining={dbUser?.totpRecoveryCodes.length ?? 0}
      />
    </PageShell>
  );
}
