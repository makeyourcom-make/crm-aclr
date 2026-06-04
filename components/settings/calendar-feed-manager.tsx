"use client";

/**
 * Gère l'abonnement iCalendar de l'utilisateur :
 *   - Affiche l'URL .ics avec bouton Copier
 *   - Régénère (révoque l'ancien lien)
 *   - Désactive (supprime le token, l'URL renvoie 404)
 *   - Instructions par client (Infomaniak, Google, Apple)
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  disableCalendarFeed,
  regenerateCalendarFeedToken,
} from "@/app/(app)/settings/calendar/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

interface CalendarFeedManagerProps {
  initialToken: string | null;
  userName: string;
}

export function CalendarFeedManager({
  initialToken,
  userName,
}: CalendarFeedManagerProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://crm.makeyourcom.ch";
  const feedUrl = token ? `${origin}/api/calendar/feed/${token}.ics` : null;
  // Infomaniak / Apple acceptent aussi webcal:// pour l'abonnement direct
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await regenerateCalendarFeedToken();
      if (!res.ok || !res.token) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setToken(res.token);
      toast.success(
        initialToken
          ? "Nouveau lien généré. L'ancien est révoqué."
          : "Lien d'abonnement créé.",
      );
      router.refresh();
    });
  };

  const handleDisable = () => {
    if (
      !confirm(
        "Désactiver l'abonnement ? Les agendas Infomaniak/Apple/Google ne se synchroniseront plus.",
      )
    )
      return;
    startTransition(async () => {
      const res = await disableCalendarFeed();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setToken(null);
      toast.success("Abonnement désactivé.");
      router.refresh();
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copié dans le presse-papiers.");
    } catch {
      toast.error("Échec de la copie.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Bloc principal : URL + actions */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-3 text-base font-semibold">Lien d&apos;abonnement</h2>
        {!token ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun lien d&apos;abonnement actif. Génère-en un pour brancher
              ton agenda externe.
            </p>
            <Button type="button" onClick={handleGenerate} disabled={pending}>
              <Icon name="Plus" className="mr-1.5 h-4 w-4" />
              {pending ? "Génération…" : "Créer le lien d'abonnement"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Garde cette URL <strong>privée</strong> — toute personne qui
              connaît le lien peut lire l&apos;agenda de {userName}. Pour
              révoquer (ex. fuite), clique &quot;Régénérer&quot; ci-dessous.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                URL HTTPS (Infomaniak, Google Calendar)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={feedUrl ?? ""}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 truncate rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => feedUrl && handleCopy(feedUrl)}
                  disabled={pending}
                >
                  <Icon name="Download" className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">Copier</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                URL webcal:// (Apple Calendar — abonnement en 1 clic)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webcalUrl ?? ""}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 truncate rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => webcalUrl && handleCopy(webcalUrl)}
                  disabled={pending}
                >
                  <Icon name="Download" className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">Copier</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={pending}
              >
                <Icon name="Repeat" className="mr-1.5 h-3.5 w-3.5" />
                Régénérer (révoque l&apos;ancien)
              </Button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Icon name="Trash2" className="h-3.5 w-3.5" />
                Désactiver l&apos;abonnement
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {token && (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">Comment s&apos;abonner</h2>

          <Section
            title="Infomaniak Calendar"
            steps={[
              "Connecte-toi sur https://mail.infomaniak.com/0/calendar",
              "Bouton + à côté de \"Calendriers externes\" dans la barre latérale gauche",
              "Choisis \"S'abonner à un calendrier\"",
              "Colle l'URL HTTPS ci-dessus dans le champ URL",
              "Nomme le calendrier (ex. \"CRM Make Your Com\") et valide",
            ]}
          />

          <Section
            title="Google Calendar"
            steps={[
              "Va sur https://calendar.google.com",
              "Clique sur le + à côté de \"Autres agendas\" dans la barre latérale",
              "Choisis \"À partir d'une URL\"",
              "Colle l'URL HTTPS ci-dessus",
              "Le rafraîchissement Google peut prendre jusqu'à 24h (pas notre faute, c'est Google)",
            ]}
          />

          <Section
            title="Apple Calendar (iPhone / Mac)"
            steps={[
              "Sur iPhone : Réglages → Calendrier → Comptes → Ajouter un compte → Autre → Ajouter un abonnement de calendrier",
              "Sur Mac : Calendrier → Fichier → Nouvel abonnement à un calendrier…",
              "Colle l'URL webcal:// (1 clic dessus sur l'iPhone ouvre directement le dialogue)",
              "Mise à jour : Apple sync automatiquement",
            ]}
          />

          <p className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            ⚠️ <strong>Sens unique :</strong> les RDV créés dans le CRM
            apparaissent dans ton agenda externe (lecture seule). Pour
            modifier un RDV, fais-le depuis le CRM — la modification se
            propagera à la sync suivante (5 min de cache).
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
