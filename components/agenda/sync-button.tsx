"use client";

/**
 * Synchronisation de l'agenda avec Google Agenda et le calendrier CalDAV
 * (Infomaniak, Apple…), en un clic, via les actions existantes des réglages
 * (`syncGoogleNow`, `syncNow`). Le lien « réglages » ouvre la configuration
 * (/settings/calendar), comme l'ancien bouton « Synchroniser l'agenda ».
 */
import { RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { syncNow } from "@/app/(app)/settings/calendar/caldav-actions";
import { syncGoogleNow } from "@/app/(app)/settings/calendar/google-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NOT_CONFIGURED = /non (configur|connect)/i;

export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sync = () =>
    startTransition(async () => {
      const results: Array<{ name: string; ok: boolean; error?: string; detail: string }> = [];
      try {
        const g = await syncGoogleNow();
        results.push({
          name: "Google",
          ok: g.ok,
          error: g.error,
          detail: `${(g.pulled ?? 0) + (g.updated ?? 0)} reçu(s), ${g.pushed ?? 0} envoyé(s)`,
        });
      } catch {
        results.push({ name: "Google", ok: false, error: "Erreur inattendue", detail: "" });
      }
      try {
        const c = await syncNow();
        results.push({
          name: "CalDAV",
          ok: c.ok,
          error: c.error,
          detail: `${(c.pulled ?? 0) + (c.updated ?? 0)} reçu(s), ${c.pushed ?? 0} envoyé(s)`,
        });
      } catch {
        results.push({ name: "CalDAV", ok: false, error: "Erreur inattendue", detail: "" });
      }

      const configured = results.filter((r) => r.ok || !NOT_CONFIGURED.test(r.error ?? ""));
      if (configured.length === 0) {
        toast("Aucun agenda externe connecté", {
          description: "Connecte Google Agenda ou Infomaniak pour synchroniser.",
          action: { label: "Configurer", onClick: () => router.push("/settings/calendar") },
        });
        return;
      }
      const failed = configured.filter((r) => !r.ok);
      const done = configured.filter((r) => r.ok);
      if (done.length > 0) {
        toast.success("Agenda synchronisé", {
          description: done.map((r) => `${r.name} : ${r.detail}`).join(" · "),
        });
      }
      for (const r of failed) toast.error(`${r.name} : ${r.error ?? "échec de la synchronisation"}`);
      router.refresh();
    });

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        title="Synchroniser avec Google Agenda et Infomaniak"
        className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-[12px]")}
      >
        <RefreshCw aria-hidden="true" className={cn(pending && "motion-safe:animate-spin")} />
        {pending ? "Synchronisation..." : "Synchroniser"}
      </button>
      <Link
        href="/settings/calendar"
        aria-label="Réglages de synchronisation (Infomaniak, Google, Apple)"
        title="Configurer la synchronisation Infomaniak / Google / Apple"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10 rounded-[12px]")}
      >
        <Settings aria-hidden="true" />
      </Link>
    </span>
  );
}
