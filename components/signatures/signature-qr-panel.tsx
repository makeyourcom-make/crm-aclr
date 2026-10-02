"use client";

/**
 * Panneau de signature par QR code (fiche contrat).
 *
 * Deux QR codes : un pour le CLIENT, un pour le COMMERCIAL. On scanne avec un
 * téléphone → page blanche de signature au doigt → la signature remonte ici.
 * Le panneau interroge le statut toutes les 3 s et se met à jour en direct.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createSignatureRequest,
  getSignatureLiveStatus,
} from "@/app/(app)/signatures/actions";
import { Icon } from "@/components/icon";

interface Status {
  signeParClient: boolean;
  signeParAclr: boolean;
  nomClient: string | null;
  nomAclr: string | null;
  signatureClientDataUrl: string | null;
  signatureAclrDataUrl: string | null;
}

export function SignatureQrPanel({
  contractId,
  signatureId,
  clientUrl,
  aclrUrl,
  clientQrDataUrl,
  aclrQrDataUrl,
  initial,
}: {
  contractId: string;
  signatureId: string | null;
  clientUrl: string | null;
  aclrUrl: string | null;
  clientQrDataUrl: string | null;
  aclrQrDataUrl: string | null;
  initial: Status | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status | null>(initial);
  const prevBoth = useRef(false);

  const bothSigned = !!status?.signeParClient && !!status?.signeParAclr;

  // Polling du statut toutes les 3 s tant que tout n'est pas signé.
  useEffect(() => {
    if (!signatureId || bothSigned) return;
    const tick = async () => {
      const res = await getSignatureLiveStatus(signatureId);
      if (res.ok) {
        setStatus({
          signeParClient: !!res.signeParClient,
          signeParAclr: !!res.signeParAclr,
          nomClient: res.nomClient ?? null,
          nomAclr: res.nomAclr ?? null,
          signatureClientDataUrl: res.signatureClientDataUrl ?? null,
          signatureAclrDataUrl: res.signatureAclrDataUrl ?? null,
        });
      }
    };
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [signatureId, bothSigned]);

  // Quand les deux viennent d'être signées : rafraîchit la page (statut contrat,
  // bouton de validation admin…).
  useEffect(() => {
    if (bothSigned && !prevBoth.current) {
      prevBoth.current = true;
      router.refresh();
    }
  }, [bothSigned, router]);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createSignatureRequest(contractId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("QR codes de signature prêts.");
      router.refresh();
    });
  };

  if (!signatureId || !clientQrDataUrl || !aclrQrDataUrl) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Génère les QR codes pour faire signer le client et le commercial au
          doigt sur un téléphone.
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={pending}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Icon name="PenTool" className="h-4 w-4" />
          {pending ? "Préparation…" : "Préparer la signature (QR)"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <QrCard
          title="Signature du client"
          signed={!!status?.signeParClient}
          name={status?.nomClient ?? null}
          signatureUrl={status?.signatureClientDataUrl ?? null}
          qr={clientQrDataUrl}
          link={clientUrl}
        />
        <QrCard
          title="Signature du commercial"
          signed={!!status?.signeParAclr}
          name={status?.nomAclr ?? null}
          signatureUrl={status?.signatureAclrDataUrl ?? null}
          qr={aclrQrDataUrl}
          link={aclrUrl}
        />
      </div>
      {bothSigned ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Les deux signatures sont posées. L&apos;admin peut maintenant valider
          le contrat pour l&apos;activer.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="Loader" className="h-3 w-3 animate-spin" />
          En attente de signature… cette zone se met à jour automatiquement.
        </p>
      )}
    </div>
  );
}

function QrCard({
  title,
  signed,
  name,
  signatureUrl,
  qr,
  link,
}: {
  title: string;
  signed: boolean;
  name: string | null;
  signatureUrl: string | null;
  qr: string;
  link: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {signed ? (
        <div className="mt-2">
          <p className="text-sm font-medium text-emerald-700">✓ Signé{name ? ` — ${name}` : ""}</p>
          {signatureUrl && (
            <div className="mt-2 overflow-hidden rounded border border-border bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt={`Signature ${title}`}
                className="h-20 w-full object-contain"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR ${title}`}
            className="h-40 w-40 rounded-md border border-border bg-white p-1"
          />
          <p className="text-center text-[11px] text-muted-foreground">
            Scanne ce QR avec un téléphone pour signer au doigt.
          </p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary underline-offset-2 hover:underline"
            >
              Ouvrir le lien de signature
            </a>
          )}
        </div>
      )}
    </div>
  );
}
