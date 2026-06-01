"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { signByClient } from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

export function SignForm({
  token,
  ipClient,
}: {
  token: string;
  ipClient?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accept) {
      toast.error("Coche la case d'acceptation des CGV.");
      return;
    }
    if (name.trim().length < 3) {
      toast.error("Saisis ton nom complet.");
      return;
    }
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error("Trace ta signature manuscrite dans la zone prévue.");
      return;
    }
    startTransition(async () => {
      const res = await signByClient(token, {
        nomClient: name.trim(),
        signatureDataUrl: dataUrl,
        ipClient,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Contrat signé !");
      setSigned(true);
    });
  };

  if (signed) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
        <p className="font-medium text-emerald-900">
          ✓ Merci, contrat signé !
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Tu vas recevoir une copie par email dès qu&apos;ACLR aura
          contre-signé.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Ton nom complet (signature dactylographiée){" "}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hans Müller"
          required
          autoFocus
        />
        <p className="text-[11px] text-muted-foreground">
          Ton IP, la date et ce nom sont enregistrés pour la valeur juridique.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Signature manuscrite <span className="text-red-500">*</span>
        </Label>
        <SignaturePad ref={padRef} height={180} onInkChange={setHasInk} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          J&apos;accepte les{" "}
          <strong>conditions générales de vente</strong>
          {" "}et m&apos;engage à régler les montants ci-dessus selon les
          modalités convenues.
        </span>
      </label>

      <Button
        type="submit"
        disabled={
          pending || !accept || name.trim().length < 3 || !hasInk
        }
        className="w-full"
      >
        {pending ? "Signature en cours…" : "Signer le contrat"}
      </Button>
    </form>
  );
}
