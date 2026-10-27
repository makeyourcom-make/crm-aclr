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
import { CircleCheck, Loader2, PlugZap, RefreshCw, Save, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  disconnectCaldav,
  saveCaldavConfig,
  syncNow,
  testCaldavConnection,
} from "@/app/(app)/settings/calendar/caldav-actions";
import {
  FIELD_CLASS,
  HINT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const APP_PASSWORDS_URL =
  "https://manager.infomaniak.com/v3/security/devices/app-passwords";

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
    <div>
      {/* État actuel */}
      {isConfigured && (
        <div className="mb-5 rounded-[14px] bg-win-50 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-win-700">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">CalDAV connecté : {initial.username}</span>
          </p>
          {initial.lastSyncAt && (
            <p className="mt-1 text-xs font-medium text-foreground">
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
              onClick={handleSync}
              disabled={pending}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {pending ? "Sync…" : "Synchroniser maintenant"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={pending}
            >
              <Unplug aria-hidden="true" />
              Déconnecter
            </Button>
          </div>
        </div>
      )}

      {/* Formulaire (re)config */}
      <div className="space-y-4">
        <div>
          <label htmlFor="caldav-server" className={LABEL_CLASS}>
            URL du serveur CalDAV
          </label>
          <Input
            id="caldav-server"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://sync.infomaniak.com"
            disabled={pending}
            className={FIELD_CLASS}
          />
          <p className={HINT_CLASS}>
            Infomaniak : <code className="font-mono">https://sync.infomaniak.com</code>{" "}
            (sans path : la découverte est automatique) · Google :{" "}
            <code className="break-all font-mono">
              https://apidata.googleusercontent.com/caldav/v2/
            </code>{" "}
            · iCloud : <code className="font-mono">https://caldav.icloud.com</code>
          </p>
        </div>

        <div>
          <label htmlFor="caldav-username" className={LABEL_CLASS}>
            Identifiant
          </label>
          <Input
            id="caldav-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex. prenom@makeyourcom.ch"
            disabled={pending}
            autoComplete="username"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="caldav-password" className={LABEL_CLASS}>
            Mot de passe d&apos;application
          </label>
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
            className={FIELD_CLASS}
          />
          <p className={HINT_CLASS}>
            <strong className="text-foreground">Pas</strong> ton mot de passe
            principal : utilise un{" "}
            <a
              href={APP_PASSWORDS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-info-700 hover:underline"
            >
              mot de passe d&apos;application Infomaniak
            </a>{" "}
            (ou équivalent Google / iCloud). Stocké chiffré (AES-256-GCM).
          </p>
        </div>

        {/* Calendriers trouvés (après test) */}
        {calendars.length > 0 && (
          <div>
            <label htmlFor="caldav-calendar" className={LABEL_CLASS}>
              Calendrier à synchroniser
            </label>
            <select
              id="caldav-calendar"
              value={selectedCalendar}
              onChange={(e) => setSelectedCalendar(e.target.value)}
              className={SELECT_CLASS}
              disabled={pending}
            >
              <option value="">Choisir</option>
              {calendars.map((c) => (
                <option key={c.url} value={c.url}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleTest}
            disabled={pending || !serverUrl || !username || !password}
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <PlugZap aria-hidden="true" />
            )}
            {pending ? "Test…" : "Tester la connexion"}
          </Button>
          {calendars.length > 0 && (
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={pending || !selectedCalendar}
            >
              <Save aria-hidden="true" />
              {isConfigured ? "Mettre à jour" : "Enregistrer la connexion"}
            </Button>
          )}
        </div>
      </div>

      {/* Aide configuration */}
      <details className="mt-5 rounded-[14px] bg-ground p-3.5 text-[13px]">
        <summary className="cursor-pointer font-bold">
          Comment générer un mot de passe d&apos;application Infomaniak ?
        </summary>
        <ol className="mt-2 ml-4 list-decimal space-y-1 text-muted-foreground">
          <li>
            Va sur{" "}
            <a
              href={APP_PASSWORDS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-info-700 hover:underline"
            >
              manager.infomaniak.com · Sécurité · Mots de passe d&apos;application
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
