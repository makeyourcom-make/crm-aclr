"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteExpense } from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";

export function ExpenseDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const del = () => {
    if (
      !confirm(
        "Supprimer définitivement cette charge ? Les allocations et pièces jointes seront aussi supprimées.",
      )
    )
      return;
    start(async () => {
      const res = await deleteExpense(id);
      if (!res.ok) {
        toast.error(("error" in res ? res.error : null) ?? "Erreur");
        return;
      }
      toast.success("Charge supprimée.");
      router.push("/charges");
      router.refresh();
    });
  };
  return (
    <Button variant="destructive" size="lg" onClick={del} disabled={pending}>
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
      Supprimer
    </Button>
  );
}
