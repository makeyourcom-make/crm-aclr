"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  disconnectGoogle,
  syncGoogleNow,
} from "@/app/(app)/settings/calendar/google-actions";
import { Button } from "@/components/ui/button";

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
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        La connexion Google n&apos;est pas encore activée sur le serveur
        (identifiants OAuth manquants). Contacte l&apos;administrateur.
      </div>
    );
  }

  if (!initial.connected) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Connecte ton compte Google : tes rendez-vous CRM apparaîtront dans
          Google Agenda, et les événements Google reviendront dans le CRM.
        </p>
        <a
          href="/api/google/connect"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
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
        `Sync OK — ${res.pulled ?? 0} importé(s), ${res.updated ?? 0} mis à jour, ${res.pushed ?? 0} envoyé(s)${
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
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-900">
            ✓ Connecté{initial.email ? ` — ${initial.email}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lastSync
              ? `Dernière synchro : ${lastSync}`
              : "Pas encore synchronisé."}{" "}
            · Synchro automatique toutes les 15 min.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || syncing}
            onClick={doSync}
          >
            {syncing ? "Synchro…" : "Synchroniser maintenant"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={doDisconnect}
          >
            Déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
