"use client";

import { CircleCheck, Fingerprint, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
} from "@/app/(app)/settings/securite/actions";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { Callout } from "@/components/common/callout";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
      toast.success("2FA activée.");
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

  const isOn = enabled || phase === "done";

  return (
    <SectionCard
      title="Double authentification (2FA)"
      description="Un code à usage unique en plus de ton mot de passe"
      icon={Fingerprint}
      tone="green"
      action={
        isOn ? (
          <StatusPill tone="green">Activée</StatusPill>
        ) : (
          <StatusPill tone="gold">Désactivée</StatusPill>
        )
      }
    >
      {/* 2FA déjà active */}
      {enabled && phase !== "done" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[14px] bg-win-50 px-3.5 py-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-win-700" />
            <div>
              <p className="text-sm font-extrabold text-win-700">
                Double authentification activée
              </p>
              <p className="mt-0.5 text-[13px] text-foreground">
                {recoveryRemaining} code(s) de secours restant(s). À la
                connexion, un code à 6 chiffres de ton app d&apos;authentification
                est demandé.
              </p>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <label htmlFor="totp-disable" className={LABEL_CLASS}>
              Désactiver la 2FA
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="totp-disable"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="Code 2FA ou code de secours"
                autoComplete="one-time-code"
                className={cn(FIELD_CLASS, "max-w-xs flex-1")}
              />
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={disable}
                disabled={pending || disableCode.trim().length < 4}
              >
                {pending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <ShieldOff aria-hidden="true" />
                )}
                Désactiver
              </Button>
            </div>
          </div>
        </div>
      ) : phase === "done" ? (
        /* Codes de secours (après activation) */
        <div className="space-y-4">
          <Callout tone="gold" icon={CircleCheck} title="2FA activée : note tes codes de secours">
            Conserve ces codes en lieu sûr. Chacun est utilisable{" "}
            <strong>une seule fois</strong> si tu perds ton téléphone. Ils ne
            seront <strong>plus jamais affichés</strong>.
          </Callout>
          <ul
            aria-label="Codes de secours"
            className="grid grid-cols-2 gap-2 rounded-[14px] border border-border bg-ground p-3 font-mono text-sm font-bold"
          >
            {recovery.map((c) => (
              <li key={c} className="rounded-[8px] bg-card px-2 py-1 text-center select-all">
                {c}
              </li>
            ))}
          </ul>
          <Button type="button" size="lg" onClick={() => router.refresh()}>
            <CircleCheck aria-hidden="true" />
            J&apos;ai noté mes codes
          </Button>
        </div>
      ) : phase === "enrolling" && qr ? (
        /* Enrôlement (QR + vérification) */
        <div className="space-y-4">
          <p className="text-sm font-semibold">
            1. Scanne ce QR code avec ton app (Google Authenticator, Authy,
            1Password…) :
          </p>
          <div className="flex flex-col items-center gap-2 rounded-[14px] bg-ground p-4">
            <Image
              src={qr}
              alt="QR code de configuration de la double authentification"
              width={200}
              height={200}
              unoptimized
              className="rounded-[12px] bg-white p-2"
            />
            <p className="text-xs text-muted-foreground">
              Ou saisis la clé manuellement :
            </p>
            <code className="max-w-full break-all rounded-[8px] bg-card px-2.5 py-1 font-mono text-xs font-bold select-all">
              {secret}
            </code>
          </div>
          <div className="border-t border-border pt-4">
            <label htmlFor="totp-code" className={LABEL_CLASS}>
              2. Entre le code à 6 chiffres affiché :
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="totp-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className={cn(FIELD_CLASS, "max-w-[180px] tracking-[0.2em] tabular-nums")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
              />
              <Button
                type="button"
                size="lg"
                onClick={confirm}
                disabled={pending || code.trim().length !== 6}
              >
                {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
                Activer la 2FA
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* État initial */
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La double authentification ajoute un code à usage unique (app
            d&apos;authentification) en plus de ton mot de passe. Fortement
            recommandé pour un compte qui accède aux données clients.
          </p>
          <Button type="button" size="lg" onClick={start} disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Smartphone aria-hidden="true" />
            )}
            Activer la double authentification
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
