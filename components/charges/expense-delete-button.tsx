"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteExpense } from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";

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
    <Button variant="outline" onClick={del} disabled={pending}>
      <Icon name="Trash" className="mr-1.5 h-4 w-4 text-rose-600" />
      Supprimer
    </Button>
  );
}
