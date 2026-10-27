"use client";

/**
 * Dialog "Signer le contrat" - 3 chemins possibles.
 *
 * Sophie est face client (ou au bureau, peu importe). Elle remplit les
 * paramètres du contrat puis choisit :
 *
 *   Signer par QR code → ouvre la page du contrat avec les QR codes
 *                            (client + commercial) à scanner au téléphone ;
 *                            le lien de signature sur écran reste dispo dessous
 *
 *   Envoyer par email → envoie au prospect le lien de signature +
 *                           le PDF complet, le client signe quand il veut
 *
 *   Télécharger le PDF → récupère un PDF prêt à imprimer pour
 *                            faire signer à la main / scanner / archiver
 *
 * Dans les 3 cas, le contrat est créé immédiatement et la cascade
 * (commission, factures) s'exécute. Seul le client n'a pas encore signé.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  sendSignatureByEmail,
  signDealInPerson,
} from "@/app/(app)/contrats/actions";
import { resultToast } from "@/components/arena";
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
import { Button, buttonVariants } from "@/components/ui/button";
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
  const router = useRouter();
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

  /**
   * Crée le contrat + signature et ouvre la PAGE DU CONTRAT, où s'affichent
   * les QR codes (client + commercial) à scanner au téléphone pour signer au
   * doigt. Le lien de signature directe (pour signer sur l'écran de
   * l'ordinateur / la tablette) reste accessible sous chaque QR. On ne
   * redirige donc plus vers /sign/{token} brut : la page contrat offre les
   * deux modes au même endroit.
   */
  const handleSignNow = () => {
    setPendingAction("sign-now");
    startTransition(async () => {
      const res = await signDealInPerson(payload());
      setPendingAction(null);
      if (!res.ok || !res.contractId) {
        toast.error(res.error ?? "Impossible de générer la signature.");
        return;
      }
      resultToast(
        res.numero ? `Contrat ${res.numero} créé` : "Contrat créé",
        "Prochaine étape : faire scanner les QR codes de signature",
      );
      setOpen(false);
      router.push(`/contrats/${res.contractId}`);
      // Coquille (objectifs du jour / série) à jour après la création du contrat.
      router.refresh();
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
      resultToast(
        res.dryRun ? "[Dry-run] Mail simulé" : "Proposition envoyée",
        res.emailDest
          ? `à ${res.emailDest} · prochaine étape : relancer pour la signature`
          : "Prochaine étape : relancer pour la signature",
      );
      setOpen(false);
      router.refresh();
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
      resultToast(
        res.numero ? `Contrat ${res.numero} prêt` : "Contrat prêt",
        "Téléchargement du PDF en cours",
      );
      // Ouvre le PDF dans un nouvel onglet (le navigateur déclenche le DL)
      window.open(
        `/api/contrats/${res.contractId}/pdf?token=${res.lienSignature}`,
        "_blank",
        "noopener",
      );
      setOpen(false);
      router.refresh();
    });
  };

  const pending = pendingAction !== null;

  return (
    <>
      <Button
        type="button"
        variant="hero"
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Icon name="PenTool" className="size-5" />
        {hasExistingContract
          ? "Rouvrir la signature"
          : "Signer le contrat"}
      </Button>

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
                className="mt-1 flex h-9 w-full rounded-[12px] border border-input bg-card px-3 text-sm shadow-xs"
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

            <div className="flex items-start gap-2 rounded-[12px] border border-gold-500/40 bg-gold-50 p-3 text-xs font-semibold text-gold-700">
              <Icon name="AlertTriangle" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Une fois le contrat créé, la cascade s&apos;exécute (commission,
                factures). Arthur sera notifié.
              </span>
            </div>

            {/* Mode de signature - 3 actions */}
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Comment veux-tu faire signer ?
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <ActionCard
                  icon="Smartphone"
                  title="Signer par QR code"
                  description="QR à scanner au téléphone (ou sur l'écran)."
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
                  className={buttonVariants({ variant: "outline" })}
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
        "flex flex-col items-start gap-1.5 rounded-[14px] border p-3 text-left transition-colors disabled:opacity-50",
        variant === "primary"
          ? "border-navy-700 bg-navy-700 text-white hover:bg-navy-600"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      ].join(" ")}
    >
      <Icon
        name={loading ? "Loader" : icon}
        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
      />
      <p className="text-sm leading-tight font-bold">{title}</p>
      <p
        className={`text-[11px] leading-tight ${
          variant === "primary"
            ? "text-navy-200"
            : "text-muted-foreground"
        }`}
      >
        {description}
      </p>
    </button>
  );
}
