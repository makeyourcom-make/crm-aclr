"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
} from "@/app/(app)/settings/securite/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";

type Phase = "idle" | "enrolling" | "done";

export function TotpSetup({
  enabled,
  recoveryRemaining,
}: {
  enabled: boolean;
  recoveryRemaining: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");

  const start = () =>
    startTransition(async () => {
      const res = await startTotpEnrollment();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setQr(res.qrDataUrl);
      setSecret(res.secret);
      setPhase("enrolling");
    });

  const confirm = () =>
    startTransition(async () => {
      const res = await confirmTotpEnrollment(code.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRecovery(res.recoveryCodes);
      setPhase("done");
      toast.success("2FA activée ✓");
    });

  const disable = () =>
    startTransition(async () => {
      const res = await disableTotp(disableCode.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("2FA désactivée.");
      setDisableCode("");
      router.refresh();
    });

  // ── 2FA déjà active ───────────────────────────────────────────────────
  if (enabled && phase !== "done") {
    return (
      <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2">
          <Icon name="Check" className="h-5 w-5 text-emerald-600" />
          <p className="font-medium text-emerald-800">
            Double authentification activée
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {recoveryRemaining} code(s) de secours restant(s). À la connexion, un
          code à 6 chiffres de ton app d&apos;authentification est demandé.
        </p>
        <div className="space-y-2 border-t border-emerald-200 pt-3">
          <p className="text-sm font-medium">Désactiver la 2FA</p>
          <div className="flex gap-2">
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="Code 2FA ou code de secours"
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={disable}
              disabled={pending || disableCode.trim().length < 4}
              className="text-red-600 hover:bg-red-50"
            >
              Désactiver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Codes de secours (après activation) ───────────────────────────────
  if (phase === "done") {
    return (
      <div className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <Icon name="Check" className="h-5 w-5 text-emerald-600" />
          <p className="font-medium">2FA activée — note tes codes de secours</p>
        </div>
        <p className="text-sm text-amber-800">
          Conserve ces codes en lieu sûr. Chacun est utilisable{" "}
          <strong>une seule fois</strong> si tu perds ton téléphone. Ils ne
          seront <strong>plus jamais affichés</strong>.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-amber-300 bg-white p-3 font-mono text-sm">
          {recovery.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button type="button" onClick={() => router.refresh()}>
          J&apos;ai noté mes codes
        </Button>
      </div>
    );
  }

  // ── Enrôlement (QR + vérification) ────────────────────────────────────
  if (phase === "enrolling" && qr) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm">
          1. Scanne ce QR code avec ton app (Google Authenticator, Authy,
          1Password…) :
        </p>
        <div className="flex flex-col items-center gap-2">
          <Image src={qr} alt="QR code 2FA" width={200} height={200} unoptimized />
          <p className="text-[11px] text-muted-foreground">
            Ou saisis la clé manuellement :
          </p>
          <code className="select-all rounded bg-muted px-2 py-1 font-mono text-xs">
            {secret}
          </code>
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm">2. Entre le code à 6 chiffres affiché :</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="max-w-[160px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
            />
            <Button
              type="button"
              onClick={confirm}
              disabled={pending || code.trim().length !== 6}
            >
              Activer la 2FA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── État initial ──────────────────────────────────────────────────────
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        La double authentification ajoute un code à usage unique (app
        d&apos;authentification) en plus de ton mot de passe. Fortement
        recommandé pour un compte qui accède aux données clients.
      </p>
      <Button type="button" onClick={start} disabled={pending}>
        <Icon name="Settings" className="mr-1.5 h-4 w-4" />
        Activer la double authentification
      </Button>
    </div>
  );
}
