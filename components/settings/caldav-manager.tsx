"use client";

/**
 * Configuration de la sync bidirectionnelle CalDAV.
 *
 * Workflow :
 *   1. Saisie URL serveur + identifiant + mot de passe d'application
 *   2. "Tester" → liste les calendriers disponibles
 *   3. Choix du calendrier + Enregistrer
 *   4. Bouton "Synchroniser maintenant" pour le 1er sync (pull + push)
 *   5. Hooks dans create/update/delete activity poussent automatiquement
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  disconnectCaldav,
  saveCaldavConfig,
  syncNow,
  testCaldavConnection,
} from "@/app/(app)/settings/calendar/caldav-actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CaldavManagerProps {
  initial: {
    serverUrl: string | null;
    username: string | null;
    calendarUrl: string | null;
    lastSyncAt: string | null;
  };
}

interface CalendarOption {
  url: string;
  displayName: string;
}

export function CaldavManager({ initial }: CaldavManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isConfigured = !!initial.serverUrl && !!initial.calendarUrl;

  const [serverUrl, setServerUrl] = useState(
    initial.serverUrl ?? "https://sync.infomaniak.com",
  );
  const [username, setUsername] = useState(initial.username ?? "");
  const [password, setPassword] = useState("");
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState(
    initial.calendarUrl ?? "",
  );

  const handleTest = () => {
    if (!password) {
      toast.error(
        "Saisis le mot de passe d'application (laissé vide pour des raisons de sécurité).",
      );
      return;
    }
    startTransition(async () => {
      const res = await testCaldavConnection({ serverUrl, username, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCalendars(res.calendars);
      if (res.calendars.length === 1) {
        setSelectedCalendar(res.calendars[0]!.url);
      }
      toast.success(`${res.calendars.length} calendrier(s) trouvé(s).`);
    });
  };

  const handleSave = () => {
    if (!selectedCalendar) {
      toast.error("Choisis un calendrier.");
      return;
    }
    if (!password) {
      toast.error("Saisis le mot de passe d'application.");
      return;
    }
    startTransition(async () => {
      const res = await saveCaldavConfig({
        serverUrl,
        username,
        password,
        calendarUrl: selectedCalendar,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Configuration enregistrée.");
      setPassword("");
      router.refresh();
    });
  };

  const handleSync = () => {
    startTransition(async () => {
      const res = await syncNow();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        `Sync OK : ${res.pulled} nouveau(x), ${res.updated} maj, ${res.pushed} poussé(s), ${res.unchanged} inchangé(s).`,
      );
      router.refresh();
    });
  };

  const handleDisconnect = () => {
    if (
      !confirm(
        "Déconnecter CalDAV ? Les RDV restent en DB mais ne se synchroniseront plus. Les events Infomaniak restent côté Infomaniak.",
      )
    )
      return;
    startTransition(async () => {
      const res = await disconnectCaldav();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("CalDAV déconnecté.");
      setPassword("");
      setCalendars([]);
      setSelectedCalendar("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      {/* État actuel */}
      {isConfigured && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <p className="font-medium text-emerald-900">
            <Icon name="Check" className="mr-1 inline h-3 w-3" />
            CalDAV connecté : {initial.username}
          </p>
          {initial.lastSyncAt && (
            <p className="mt-1 text-emerald-700">
              Dernière sync :{" "}
              {new Date(initial.lastSyncAt).toLocaleString("fr-CH", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSync}
              disabled={pending}
            >
              <Icon name="Repeat" className="mr-1 h-3.5 w-3.5" />
              {pending ? "Sync…" : "Synchroniser maintenant"}
            </Button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Icon name="Trash2" className="h-3 w-3" />
              Déconnecter
            </button>
          </div>
        </div>
      )}

      {/* Formulaire (re)config */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="caldav-server">URL du serveur CalDAV</Label>
          <Input
            id="caldav-server"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://sync.infomaniak.com"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Infomaniak : <code>https://sync.infomaniak.com</code> (sans path —
            la découverte est automatique) · Google :{" "}
            <code>https://apidata.googleusercontent.com/caldav/v2/</code> ·
            iCloud : <code>https://caldav.icloud.com</code>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caldav-username">Identifiant</Label>
          <Input
            id="caldav-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex. sophie@makeyourcom.ch"
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caldav-password">
            Mot de passe d&apos;application
          </Label>
          <Input
            id="caldav-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isConfigured ? "Re-saisir pour modifier" : "********"
            }
            disabled={pending}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            ⚠️ <strong>Pas</strong> ton mot de passe principal — utilise un{" "}
            <a
              href="https://manager.infomaniak.com/v3/security/devices/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mot de passe d&apos;application Infomaniak
            </a>{" "}
            (ou équivalent Google / iCloud). Stocké chiffré (AES-256-GCM).
          </p>
        </div>

        {/* Calendriers trouvés (après test) */}
        {calendars.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="caldav-calendar">Calendrier à synchroniser</Label>
            <select
              id="caldav-calendar"
              value={selectedCalendar}
              onChange={(e) => setSelectedCalendar(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              disabled={pending}
            >
              <option value="">— Choisir —</option>
              {calendars.map((c) => (
                <option key={c.url} value={c.url}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={pending || !serverUrl || !username || !password}
          >
            {pending ? "Test…" : "Tester la connexion"}
          </Button>
          {calendars.length > 0 && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={pending || !selectedCalendar}
            >
              {isConfigured ? "Mettre à jour" : "Enregistrer la connexion"}
            </Button>
          )}
        </div>
      </div>

      {/* Aide configuration */}
      <details className="mt-4 rounded-md bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer font-medium">
          Comment générer un mot de passe d&apos;application Infomaniak ?
        </summary>
        <ol className="ml-4 mt-2 list-decimal space-y-1 text-muted-foreground">
          <li>
            Va sur{" "}
            <a
              href="https://manager.infomaniak.com/v3/security/devices/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              manager.infomaniak.com → Sécurité → Mots de passe d&apos;application
            </a>
          </li>
          <li>Clique &quot;Créer un mot de passe d&apos;application&quot;</li>
          <li>Nom : &quot;CRM Make Your Com&quot;</li>
          <li>Copie le mot de passe affiché (16 caractères)</li>
          <li>Colle-le ci-dessus et clique &quot;Tester la connexion&quot;</li>
          <li>Choisis ton calendrier et &quot;Enregistrer&quot;</li>
        </ol>
      </details>
    </div>
  );
}
