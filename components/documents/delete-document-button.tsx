"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteDocument } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icon";

export function DeleteDocumentButton({
  id,
  titre,
}: {
  id: string;
  titre: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Supprimer « ${titre} » ? Cette action est définitive.`)) return;
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la suppression.");
        return;
      }
      toast.success("Document supprimé.");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Supprimer le document"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Icon name="Trash2" className="h-4 w-4" />
    </button>
  );
}
