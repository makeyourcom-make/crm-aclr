"use client";

/**
 * Panneau de signature par QR code (fiche contrat).
 *
 * Deux QR codes : un pour le CLIENT, un pour le COMMERCIAL. On scanne avec un
 * téléphone → page blanche de signature au doigt → la signature remonte ici.
 * Le panneau interroge le statut toutes les 3 s et se met à jour en direct.
 */
import { Check, ExternalLink, LoaderCircle, PenTool, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSignatureRequest,
  getSignatureLiveStatus,
} from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const lastStatus = useRef<Status | null>(initial);

  const bothSigned = !!status?.signeParClient && !!status?.signeParAclr;

  // Polling du statut toutes les 3 s tant que tout n'est pas signé.
  useEffect(() => {
    if (!signatureId || bothSigned) return;
    const tick = async () => {
      const res = await getSignatureLiveStatus(signatureId);
      if (res.ok) {
        const next: Status = {
          signeParClient: !!res.signeParClient,
          signeParAclr: !!res.signeParAclr,
          nomClient: res.nomClient ?? null,
          nomAclr: res.nomAclr ?? null,
          signatureClientDataUrl: res.signatureClientDataUrl ?? null,
          signatureAclrDataUrl: res.signatureAclrDataUrl ?? null,
        };
        const prev = lastStatus.current;
        if (next.signeParClient && !prev?.signeParClient) {
          toast.success("Le client vient de signer en direct !");
        }
        lastStatus.current = next;
        setStatus(next);
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
      <div className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed border-border-strong bg-ground px-5 py-7 text-center">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-[14px] bg-navy-100 text-navy-700"
        >
          <QrCode className="size-5" />
        </span>
        <p className="max-w-md text-sm font-semibold text-foreground">
          Génère les QR codes pour faire signer le client et le commercial au
          doigt sur un téléphone.
        </p>
        <Button type="button" size="lg" onClick={handleCreate} disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <PenTool aria-hidden="true" />
          )}
          {pending ? "Préparation..." : "Préparer la signature (QR)"}
        </Button>
      </div>
    );
  }

  const clientSigned = !!status?.signeParClient;
  const aclrSigned = !!status?.signeParAclr;
  const message = bothSigned
    ? {
        tone: "bg-win-50",
        title: "Les deux signatures sont posées.",
        titleClass: "text-win-700",
        text: "L'admin peut maintenant valider le contrat pour l'activer.",
      }
    : clientSigned
      ? {
          tone: "bg-coral-50",
          title: "Le client a signé !",
          titleClass: "text-coral-600",
          text: "Au commercial de contre-signer sur son QR.",
        }
      : aclrSigned
        ? {
            tone: "bg-info-50",
            title: "Le commercial a signé.",
            titleClass: "text-info-700",
            text: "On attend le client : son tracé s'affichera ici en direct.",
          }
        : {
            tone: "bg-info-50",
            title: "En attente.",
            titleClass: "text-info-700",
            text: "Le client scanne son QR, coche les CGV et signe au doigt : son tracé s'affiche ici en direct.",
          };

  return (
    <div className="flex flex-col gap-4">
      {!bothSigned && (
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-win-50 px-3 py-1.5 text-xs font-bold text-win-700">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-win-500 motion-safe:animate-pulse-ring"
            />
            En direct · actualisé toutes les 3 s
          </span>
        </div>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <QrCard
          title="Client"
          who="du client"
          signed={clientSigned}
          name={status?.nomClient ?? null}
          signatureUrl={status?.signatureClientDataUrl ?? null}
          qr={clientQrDataUrl}
          link={clientUrl}
        />
        <QrCard
          title="Commercial · ACLR"
          who="du commercial"
          signed={aclrSigned}
          name={status?.nomAclr ?? null}
          signatureUrl={status?.signatureAclrDataUrl ?? null}
          qr={aclrQrDataUrl}
          link={aclrUrl}
        />
      </div>
      <div
        role="status"
        aria-live="polite"
        className={cn("flex items-start gap-2.5 rounded-[14px] px-4 py-3.5 text-sm text-foreground", message.tone)}
      >
        {!bothSigned && (
          <LoaderCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
        )}
        <p>
          <strong className={message.titleClass}>{message.title}</strong>{" "}
          {message.text}
        </p>
      </div>
    </div>
  );
}

function QrCard({
  title,
  who,
  signed,
  name,
  signatureUrl,
  qr,
  link,
}: {
  title: string;
  who: string;
  signed: boolean;
  name: string | null;
  signatureUrl: string | null;
  qr: string;
  link: string | null;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5 rounded-[16px] border-2 p-4 text-center",
        signed ? "border-win-500 bg-win-50" : "border-info-500 bg-ground",
      )}
    >
      <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </p>
      {signed ? (
        <>
          {signatureUrl && (
            <div className="w-full max-w-[240px] overflow-hidden rounded-[10px] border border-win-500 bg-white p-1 motion-safe:animate-pop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt={`Tracé de la signature ${who}`}
                className="h-20 w-full object-contain"
              />
            </div>
          )}
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-win-700">
            <Check aria-hidden="true" className="size-4" />
            Signé{name ? ` · ${name}` : ""}
          </p>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code de signature ${who}`}
            className="size-36 rounded-[10px] border border-border bg-white p-1.5"
          />
          <p className="text-sm font-extrabold text-info-700">
            En attente {who}
          </p>
          <p className="text-xs text-muted-foreground">
            Scanne ce QR avec un téléphone pour signer au doigt.
          </p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ouvrir le lien de signature ${who}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              Ouvrir le lien de signature
            </a>
          )}
        </>
      )}
    </div>
  );
}
