"use client";

import { CircleCheck, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  disconnectGoogle,
  syncGoogleNow,
} from "@/app/(app)/settings/calendar/google-actions";
import { Callout } from "@/components/common/callout";
import { Button, buttonVariants } from "@/components/ui/button";

interface Props {
  initial: {
    connected: boolean;
    email: string | null;
    lastSyncAt: string | null;
    configured: boolean;
  };
}

export function GoogleCalendarManager({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);

  const lastSync = initial.lastSyncAt
    ? new Date(initial.lastSyncAt).toLocaleString("fr-CH", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  if (!initial.configured) {
    return (
      <Callout tone="gold">
        La connexion Google n&apos;est pas encore activée sur le serveur
        (identifiants OAuth manquants). Contacte l&apos;administrateur.
      </Callout>
    );
  }

  if (!initial.connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Connecte ton compte Google : tes rendez-vous CRM apparaîtront dans
          Google Agenda, et les événements Google reviendront dans le CRM.
        </p>
        <a
          href="/api/google/connect"
          className={buttonVariants({ variant: "default", size: "lg" })}
        >
          <Link2 aria-hidden="true" />
          Connecter Google Agenda
        </a>
      </div>
    );
  }

  const doSync = () => {
    setSyncing(true);
    startTransition(async () => {
      const res = await syncGoogleNow();
      setSyncing(false);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la synchronisation.");
        return;
      }
      toast.success(
        `Sync OK · ${res.pulled ?? 0} importé(s), ${res.updated ?? 0} mis à jour, ${res.pushed ?? 0} envoyé(s)${
          res.cancelled ? `, ${res.cancelled} annulé(s)` : ""
        }.`,
      );
      router.refresh();
    });
  };

  const doDisconnect = () => {
    if (
      !confirm(
        "Déconnecter Google ? Les événements déjà synchronisés restent des deux côtés, mais la synchro s'arrête.",
      )
    )
      return;
    startTransition(async () => {
      const res = await disconnectGoogle();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Google déconnecté.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-win-50 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-win-700" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-win-700">
            Connecté{initial.email ? ` · ${initial.email}` : ""}
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground">
            {lastSync
              ? `Dernière synchro : ${lastSync}`
              : "Pas encore synchronisé."}{" "}
            · Synchro automatique toutes les 15 min.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending || syncing}
          onClick={doSync}
        >
          {syncing ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {syncing ? "Synchro…" : "Synchroniser maintenant"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={doDisconnect}
        >
          <Unplug aria-hidden="true" />
          Déconnecter
        </Button>
      </div>
    </div>
  );
}
