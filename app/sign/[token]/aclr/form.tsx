"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { signByAclrOnline } from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";

import { SignaturePad, type SignaturePadHandle } from "../signature-pad";

export function AclrSignForm({
  token,
  commercialName,
  ipAclr,
  contractId,
}: {
  token: string;
  commercialName: string;
  ipAclr?: string;
  contractId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [hasInk, setHasInk] = useState(false);
  const [signed, setSigned] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error("Trace ta signature dans la zone prévue.");
      return;
    }
    startTransition(async () => {
      const res = await signByAclrOnline(token, {
        signatureDataUrl: dataUrl,
        nomAclr: commercialName,
        ipAclr,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Signé ✓");
      setSigned(true);
    });
  };

  if (signed) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
        <p className="font-medium text-emerald-900">✓ Signature enregistrée</p>
        <p className="mt-1 text-sm text-emerald-800">
          Elle est remontée dans le CRM. L&apos;admin validera le contrat pour
          l&apos;activer.
        </p>
        <a
          href={`/contrats/${contractId}`}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        >
          ← Retour au CRM
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Signe ci-dessous au doigt, <strong>{commercialName}</strong>, puis valide.
      </p>
      <SignaturePad ref={padRef} height={200} onInkChange={setHasInk} />
      <Button type="submit" disabled={pending || !hasInk} className="w-full">
        {pending ? "Signature en cours…" : "Valider ma signature"}
      </Button>
    </form>
  );
}
