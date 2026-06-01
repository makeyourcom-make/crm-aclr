"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { signByAclr } from "@/app/(app)/signatures/actions";

export function SignAclrButton({ signatureId }: { signatureId: string }) {
  const [pending, startTransition] = useTransition();
  const handle = () =>
    startTransition(async () => {
      const res = await signByAclr(signatureId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Contre-signée ✓ — deal sorti du pipeline.");
    });
  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? "…" : "Contre-signer"}
    </button>
  );
}
