"use client";

/**
 * Dialog "Signer le contrat" — 3 chemins possibles.
 *
 * Sophie est face client (ou au bureau, peu importe). Elle remplit les
 * paramètres du contrat puis choisit :
 *
 *   📱  Signer en direct → ouvre la page de signature en plein écran,
 *                          tend la tablette au client
 *
 *   📧  Envoyer par email → envoie au prospect le lien de signature +
 *                           le PDF complet, le client signe quand il veut
 *
 *   💾  Télécharger le PDF → récupère un PDF prêt à imprimer pour
 *                            faire signer à la main / scanner / archiver
 *
 * Dans les 3 cas, le contrat est créé immédiatement et la cascade
 * (commission, factures) s'exécute. Seul le client n'a pas encore signé.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  sendSignatureByEmail,
  signDealInPerson,
} from "@/app/(app)/contrats/actions";
import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SignDealInPersonButtonProps {
  dealId: string;
  hasExistingContract?: boolean;
}

const MODALITES = [
  { value: "CINQUANTE_CINQUANTE", label: "50 % / 50 % (acompte + solde)" },
  { value: "CENT_AU_SIGNING", label: "100 % à la signature" },
  { value: "MENSUEL", label: "Mensualisé sur la durée" },
] as const;

type Action = "sign-now" | "email" | "download" | null;

export function SignDealInPersonButton({
  dealId,
  hasExistingContract,
}: SignDealInPersonButtonProps) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action>(null);
  const [, startTransition] = useTransition();

  // Form
  const [modalitePaiement, setModalitePaiement] =
    useState<(typeof MODALITES)[number]["value"]>("CINQUANTE_CINQUANTE");
  const [dureeMois, setDureeMois] = useState(12);
  const [dateDebut, setDateDebut] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const payload = () => ({
    dealId,
    modalitePaiement,
    dureeMois,
    dateDebut: new Date(dateDebut),
  });

  /** Crée le contrat + signature, ouvre /sign/{token} en plein écran. */
  const handleSignNow = () => {
    setPendingAction("sign-now");
    startTransition(async () => {
      const res = await signDealInPerson(payload());
      setPendingAction(null);
      if (!res.ok || !res.lienSignature) {
        toast.error(res.error ?? "Impossible de générer la signature.");
        return;
      }
      toast.success(
        res.numero
          ? `Contrat ${res.numero} créé — passe la tablette au client.`
          : "Lien prêt — passe la tablette au client.",
      );
      window.open(`/sign/${res.lienSignature}`, "_blank", "noopener");
      setOpen(false);
    });
  };

  /** Crée le contrat + signature + envoie l'email au prospect. */
  const handleSendEmail = () => {
    setPendingAction("email");
    startTransition(async () => {
      const res = await sendSignatureByEmail(payload());
      setPendingAction(null);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      toast.success(
        res.dryRun
          ? `[Dry-run] Mail simulé vers ${res.emailDest}.`
          : `Mail envoyé à ${res.emailDest}.`,
      );
      setOpen(false);
    });
  };

  /** Crée le contrat + signature, télécharge le PDF en local. */
  const handleDownload = () => {
    setPendingAction("download");
    startTransition(async () => {
      const res = await signDealInPerson(payload());
      setPendingAction(null);
      if (!res.ok || !res.contractId || !res.lienSignature) {
        toast.error(res.error ?? "Impossible de générer le contrat.");
        return;
      }
      toast.success(
        res.numero
          ? `Contrat ${res.numero} prêt — téléchargement en cours.`
          : "PDF en cours de téléchargement.",
      );
      // Ouvre le PDF dans un nouvel onglet (le navigateur déclenche le DL)
      window.open(
        `/api/contrats/${res.contractId}/pdf?token=${res.lienSignature}`,
        "_blank",
        "noopener",
      );
      setOpen(false);
    });
  };

  const pending = pendingAction !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
      >
        <Icon name="PenTool" className="h-4 w-4" />
        {hasExistingContract
          ? "Rouvrir la signature"
          : "Signer le contrat"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Préparer la signature du contrat</DialogTitle>
            <DialogDescription>
              On crée le contrat à partir des produits du deal, puis on te
              propose 3 façons de le faire signer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="modalite" className="text-xs">
                Modalité de paiement
              </Label>
              <select
                id="modalite"
                value={modalitePaiement}
                onChange={(e) =>
                  setModalitePaiement(
                    e.target.value as (typeof MODALITES)[number]["value"],
                  )
                }
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              >
                {MODALITES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="duree" className="text-xs">
                  Durée (mois)
                </Label>
                <Input
                  id="duree"
                  type="number"
                  min={1}
                  max={60}
                  value={dureeMois}
                  onChange={(e) =>
                    setDureeMois(Math.max(1, Number(e.target.value)))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="datedebut" className="text-xs">
                  Date de début
                </Label>
                <Input
                  id="datedebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              ⚠ Une fois le contrat créé, la cascade s&apos;exécute (commission,
              factures). Arthur sera notifié.
            </div>

            {/* Mode de signature — 3 actions */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Comment veux-tu faire signer ?
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <ActionCard
                  icon="Smartphone"
                  title="Signer en direct"
                  description="Le client signe sur la tablette."
                  loading={pendingAction === "sign-now"}
                  disabled={pending}
                  onClick={handleSignNow}
                  variant="primary"
                />
                <ActionCard
                  icon="Mail"
                  title="Envoyer par email"
                  description="Le client signe plus tard, sur son téléphone."
                  loading={pendingAction === "email"}
                  disabled={pending}
                  onClick={handleSendEmail}
                  variant="outline"
                />
                <ActionCard
                  icon="Download"
                  title="Télécharger le PDF"
                  description="Pour imprimer, faire signer à la main."
                  loading={pendingAction === "download"}
                  disabled={pending}
                  onClick={handleDownload}
                  variant="outline"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <button
                  type="button"
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Annuler
                </button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "primary" | "outline";
}

function ActionCard({
  icon,
  title,
  description,
  loading,
  disabled,
  onClick,
  variant,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex flex-col items-start gap-1.5 rounded-md border p-3 text-left transition-colors disabled:opacity-50",
        variant === "primary"
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-background text-foreground hover:bg-muted",
      ].join(" ")}
    >
      <Icon
        name={loading ? "Loader" : icon}
        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
      />
      <p className="text-sm font-medium leading-tight">{title}</p>
      <p
        className={`text-[11px] leading-tight ${
          variant === "primary"
            ? "text-primary-foreground/80"
            : "text-muted-foreground"
        }`}
      >
        {description}
      </p>
    </button>
  );
}
