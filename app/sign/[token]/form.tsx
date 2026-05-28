"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { signByClient } from "@/app/(app)/signatures/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accept) {
      toast.error("Coche la case d'acceptation des CGV.");
      return;
    }
    if (name.trim().length < 3) {
      toast.error("Saisis ton nom complet (signature dactylographiée).");
      return;
    }
    startTransition(async () => {
      const res = await signByClient(token, ipClient);
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
          En signant, tu acceptes les termes du contrat. Ton IP, ta date et
          ce nom sont enregistrés pour la valeur juridique.
        </p>
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
          <strong>conditions générales de vente</strong> et m&apos;engage à
          régler les montants ci-dessus selon les modalités convenues.
        </span>
      </label>

      <Button
        type="submit"
        disabled={pending || !accept || name.trim().length < 3}
        className="w-full"
      >
        {pending ? "Signature en cours…" : "Signer le contrat"}
      </Button>
    </form>
  );
}
