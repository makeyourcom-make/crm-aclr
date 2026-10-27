"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteDocument } from "@/app/(app)/documents/actions";

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
      aria-label={`Supprimer le document ${titre}`}
      title="Supprimer le document"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Trash2 aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}
