"use client";

/**
 * Gère l'abonnement iCalendar de l'utilisateur :
 *   - Affiche l'URL .ics avec bouton Copier
 *   - Régénère (révoque l'ancien lien)
 *   - Désactive (supprime le token, l'URL renvoie 404)
 *   - Instructions par client (Infomaniak, Google, Apple)
 */
import { Copy, Info, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  disableCalendarFeed,
  regenerateCalendarFeedToken,
} from "@/app/(app)/settings/calendar/actions";
import { Callout } from "@/components/common/callout";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="space-y-5">
      {/* Bloc principal : URL + actions */}
      {!token ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Aucun lien d&apos;abonnement actif. Génère-en un pour brancher ton
            agenda externe.
          </p>
          <Button type="button" size="lg" onClick={handleGenerate} disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {pending ? "Génération…" : "Créer le lien d'abonnement"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Garde cette URL <strong className="text-foreground">privée</strong> :
            toute personne qui connaît le lien peut lire l&apos;agenda de{" "}
            {userName}. Pour révoquer (ex. fuite), clique « Régénérer »
            ci-dessous.
          </p>

          <CopyField
            label="URL HTTPS (Infomaniak, Google Calendar)"
            value={feedUrl ?? ""}
            onCopy={() => feedUrl && handleCopy(feedUrl)}
            disabled={pending}
          />
          <CopyField
            label="URL webcal:// (Apple Calendar · abonnement en 1 clic)"
            value={webcalUrl ?? ""}
            onCopy={() => webcalUrl && handleCopy(webcalUrl)}
            disabled={pending}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGenerate}
              disabled={pending}
            >
              <RefreshCw aria-hidden="true" />
              Régénérer (révoque l&apos;ancien)
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={handleDisable}
              disabled={pending}
            >
              <Trash2 aria-hidden="true" />
              Désactiver l&apos;abonnement
            </Button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {token && (
        <div className="rounded-[14px] border border-border bg-ground p-4 sm:p-5">
          <h3 className="mb-4 font-display text-base font-extrabold">
            Comment s&apos;abonner
          </h3>

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
              "Sur iPhone : Réglages · Calendrier · Comptes · Ajouter un compte · Autre · Ajouter un abonnement de calendrier",
              "Sur Mac : Calendrier · Fichier · Nouvel abonnement à un calendrier…",
              "Colle l'URL webcal:// (1 clic dessus sur l'iPhone ouvre directement le dialogue)",
              "Mise à jour : Apple sync automatiquement",
            ]}
          />

          <Callout tone="gold" icon={Info} title="Sens unique" className="mt-4">
            Les RDV créés dans le CRM apparaissent dans ton agenda externe
            (lecture seule). Pour modifier un RDV, fais-le depuis le CRM : la
            modification se propagera à la sync suivante (5 min de cache).
          </Callout>
        </div>
      )}
    </div>
  );
}

function CopyField({
  label,
  value,
  onCopy,
  disabled,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          readOnly
          value={value}
          onClick={(e) => e.currentTarget.select()}
          className={cn(FIELD_CLASS, "flex-1 truncate font-mono text-xs md:text-xs")}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCopy}
          disabled={disabled}
          aria-label={`Copier : ${label}`}
        >
          <Copy aria-hidden="true" />
          <span className="hidden sm:inline">Copier</span>
        </Button>
      </div>
    </div>
  );
}

function Section({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="mb-5 last:mb-0">
      <h4 className="mb-2 text-sm font-extrabold">{title}</h4>
      <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
