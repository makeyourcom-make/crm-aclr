"use client";

/**
 * Panneau latéral (Sheet) qui affiche le détail d'un deal.
 *
 * Fetch côté client vers /api/deals/{id}. L'état « chargement » est DÉRIVÉ
 * (clé de requête vs clé du dernier résultat) : aucun setState synchrone dans
 * l'effet, seulement dans les callbacks du fetch.
 */
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  PenLine,
  Pencil,
  Smartphone,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PlayerAvatar, celebrate, xpToast } from "@/components/arena";
import { ContractDeviseSwitch } from "@/components/contrats/contract-devise-switch";
import { UploadSignedPdfButton } from "@/components/contrats/upload-signed-pdf-button";
import { SignDealInPersonButton } from "@/components/pipeline/sign-deal-in-person-button";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { XP_RULES, firstNameOf, initialsOf } from "@/lib/gamification/rules";
import { formatCHF, formatDateLong } from "@/lib/format";
import { getDealStageLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { formatDayMonthYear } from "./pipeline-meta";

interface DealDetailLite {
  id: string;
  titre: string;
  description: string | null;
  montantPrevu: string;
  stage: string;
  probabilite: number;
  closeAttenduLe: string | null;
  prospect: {
    id: string;
    raisonSociale: string;
    contactPrenom: string | null;
    contactNom: string | null;
    email: string | null;
    telephone: string | null;
    ville: string | null;
  };
  assigneA: { id: string; name: string } | null;
  productsProposes: Array<{
    id: string;
    nom: string;
    prixOneShot: string | null;
    prixMensuel: string | null;
  }>;
  contracts: Array<{
    id: string;
    numero: string;
    devise: string;
    signatures: Array<{
      id: string;
      signeParClient: boolean;
      signeParAclr: boolean;
      dateSignatureClient: string | null;
      dateSignatureAclr: string | null;
      statut: string;
      lienSignature: string;
      expireA: string;
    }>;
  }>;
}

interface DealDetailSheetProps {
  dealId: string | null;
  onClose: () => void;
  isAdmin: boolean;
  /** Pour n'afficher le toast XP qu'à la commerciale qui gagne les XP. */
  currentUserId?: string;
}

interface LoadResult {
  key: string;
  dealId: string;
  deal: DealDetailLite | null;
  error: string | null;
}

const SECTION_LABEL =
  "mb-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase";

export function DealDetailSheet({
  dealId,
  onClose,
  isAdmin,
  currentUserId,
}: DealDetailSheetProps) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);

  const requestKey = dealId ? `${dealId}:${reloadKey}` : null;

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const key = `${dealId}:${reloadKey}`;
    fetch(`/api/deals/${dealId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DealDetailLite>;
      })
      .then((data) => {
        if (!cancelled) setResult({ key, dealId, deal: data, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setResult({ key, dealId, deal: null, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, reloadKey]);

  const loading = !!requestKey && result?.key !== requestKey;
  // Pendant un rechargement du même deal, on garde l'affichage précédent.
  const deal = dealId && result?.dealId === dealId ? result.deal : null;
  const error = result && result.key === requestKey ? result.error : null;

  const mensuel = deal
    ? deal.productsProposes.reduce((s, p) => s + (p.prixMensuel ? Number(p.prixMensuel) : 0), 0)
    : 0;
  const xpSignature =
    XP_RULES.signature +
    Math.floor(mensuel / 10) * XP_RULES.signatureParTranche10ChfMensuel;
  const isMine = !!deal?.assigneA && deal.assigneA.id === currentUserId;
  const assigneeFirst = deal?.assigneA ? firstNameOf(deal.assigneA.name) : null;

  const refreshAll = () => {
    setReloadKey((k) => k + 1);
    router.refresh();
  };

  // PDF signé joint : signature complétée, le deal passe en « Signé » et le
  // contrat part en validation admin (les XP tombent à la validation).
  const onSignedPdf = () => {
    celebrate({
      eyebrow: assigneeFirst ? `Bravo ${assigneeFirst}` : undefined,
      title: "Contrat signé !",
      subtitle: deal ? `${deal.prospect.raisonSociale} · part en validation` : undefined,
      xp: xpSignature,
    });
    if (isMine) xpToast(xpSignature, "Contrat signé !", "XP crédités à la validation d'Arthur");
    refreshAll();
  };

  // Contre-signature admin : le contrat devient exécutoire.
  const onCountersigned = () => {
    celebrate({
      eyebrow: assigneeFirst ? `Bravo ${assigneeFirst}` : undefined,
      title: "Contrat validé !",
      subtitle: deal?.prospect.raisonSociale,
      xp: xpSignature,
    });
    if (isMine) xpToast(xpSignature, "Contrat validé !", deal?.prospect.raisonSociale);
    refreshAll();
  };

  return (
    <Sheet open={!!dealId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="gap-1.5">
          <p className="text-[11px] font-bold tracking-[0.08em] text-lvl-700 uppercase">
            Deal
            {deal && ` · ${getDealStageLabel(deal.stage as never)}`}
          </p>
          <SheetTitle className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
            {deal?.titre ?? "Détail du deal"}
          </SheetTitle>
          {deal?.prospect && (
            <SheetDescription>
              <Link
                href={`/prospects/${deal.prospect.id}`}
                className="font-semibold text-info-700 hover:underline"
              >
                {deal.prospect.raisonSociale}
              </Link>
              {deal.prospect.ville && ` · ${deal.prospect.ville}`}
            </SheetDescription>
          )}
          {deal && (
            <div className="mt-1 flex flex-wrap gap-2">
              <Link
                href={`/pipeline/${deal.id}/modifier`}
                className={buttonVariants({ variant: "outline", size: "default" })}
              >
                <Pencil aria-hidden="true" />
                Modifier
              </Link>
            </div>
          )}
        </SheetHeader>

        {loading && (
          <p role="status" className="px-6 py-2 text-sm text-muted-foreground">
            {deal ? "Mise à jour..." : "Chargement..."}
          </p>
        )}

        {error && (
          <p role="alert" className="px-6 py-4 text-sm font-semibold text-alert-700">
            Impossible de charger le deal ({error}).
          </p>
        )}

        {deal && (
          <div className="space-y-5 px-6 pb-6">
            {/* Montant + étape + proba */}
            <div className="rounded-[16px] bg-gradient-navy p-4 text-white">
              <p className="score-number text-[30px]">{formatCHF(Number(deal.montantPrevu))}</p>
              <p className="mt-1 text-xs font-semibold text-navy-200">
                Valeur an 1 · étape {getDealStageLabel(deal.stage as never)} · probabilité{" "}
                {deal.probabilite} %
              </p>
              {deal.closeAttenduLe && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  Close attendu le {formatDayMonthYear(deal.closeAttenduLe)}
                </p>
              )}
              {deal.stage !== "SIGNE" && deal.stage !== "PERDU" && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy-700/70 px-2.5 py-1 text-xs font-extrabold text-gold-500">
                  +{xpSignature} XP à la signature
                </p>
              )}
            </div>

            {/* Description */}
            {deal.description && (
              <div>
                <p className={SECTION_LABEL}>Description</p>
                <p className="text-sm whitespace-pre-line">{deal.description}</p>
              </div>
            )}

            {/* Produits */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className={cn(SECTION_LABEL, "mb-0")}>
                  Produits proposés ({deal.productsProposes.length})
                </p>
                <Link
                  href={`/pipeline/${deal.id}/modifier`}
                  className="text-xs font-bold text-info-700 hover:underline"
                >
                  {deal.productsProposes.length === 0 ? "+ Ajouter" : "Modifier"}
                </Link>
              </div>
              {deal.productsProposes.length === 0 ? (
                <p className="flex items-start gap-2 rounded-[12px] border border-dashed border-gold-500 bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-700">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Aucun produit. Tu dois en ajouter au moins un avant de pouvoir faire signer
                  le contrat.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {deal.productsProposes.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-[12px] border border-border bg-card px-3 py-2 text-sm"
                    >
                      <p className="font-bold">{p.nom}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p.prixOneShot && `${formatCHF(Number(p.prixOneShot))} one-shot`}
                        {p.prixOneShot && p.prixMensuel && " · "}
                        {p.prixMensuel && `${formatCHF(Number(p.prixMensuel))} / mois`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Contact prospect */}
            <div>
              <p className={SECTION_LABEL}>Contact</p>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <User aria-hidden="true" className="size-4 text-muted-foreground" />
                {[deal.prospect.contactPrenom, deal.prospect.contactNom]
                  .filter(Boolean)
                  .join(" ") || "Non renseigné"}
              </p>
              {deal.prospect.email && (
                <a
                  href={`mailto:${deal.prospect.email}`}
                  className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-info-700 hover:underline"
                >
                  <Mail aria-hidden="true" className="size-3.5" />
                  {deal.prospect.email}
                </a>
              )}
            </div>

            {/* Méta */}
            {deal.assigneA && (
              <div className="flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                <PlayerAvatar initials={initialsOf(deal.assigneA.name)} size="xs" />
                Assigné à {deal.assigneA.name}
              </div>
            )}

            {/* Workflow signature : 3 états possibles */}
            {(() => {
              const contract = deal.contracts[0];
              const sig = contract?.signatures[0];
              const isSignedByClientOnly = !!sig && sig.signeParClient && !sig.signeParAclr;
              const isFullySigned = !!sig && sig.signeParClient && sig.signeParAclr;
              const hasContractNoSig = !!contract && !sig?.signeParClient;

              // État 3 : contre-signé. Ne devrait normalement pas être
              // visible (le deal sort du pipeline), mais par sécurité on
              // affiche un message neutre.
              if (isFullySigned) {
                return (
                  <div className="flex items-start gap-2 rounded-[16px] border border-win-500/30 bg-win-50 p-4 text-sm text-win-700">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Contrat <strong>{contract.numero}</strong> entièrement signé. Ce deal sera
                      retiré du pipeline au prochain rafraîchissement.
                    </span>
                  </div>
                );
              }

              // État 2 : signé client, attend Arthur
              if (isSignedByClientOnly) {
                return (
                  <div className="rounded-[16px] border border-win-500/30 bg-win-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-win-700">
                      <CheckCircle2 aria-hidden="true" className="size-4" />
                      Contrat {contract.numero} signé par le client
                    </p>
                    <p className="mt-1 text-xs font-medium text-win-700">
                      Signé le{" "}
                      {sig.dateSignatureClient ? formatDateLong(sig.dateSignatureClient) : "-"}.{" "}
                      {isAdmin
                        ? "Vérifie le contrat, puis contre-signe pour valider et clore le deal."
                        : "Le contrat attend la validation d'Arthur."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/contrats/${contract.id}`}
                        className={buttonVariants({ variant: "outline", size: "default" })}
                      >
                        Voir le contrat
                      </Link>
                      {isAdmin && (
                        <SignAclrButton signatureId={sig.id} onSuccess={onCountersigned} />
                      )}
                    </div>
                  </div>
                );
              }

              // État 1b : contrat créé mais le client n'a pas encore signé
              if (hasContractNoSig && sig) {
                return (
                  <div className="rounded-[16px] border border-info-500/30 bg-info-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-info-700">
                      <FileText aria-hidden="true" className="size-4" />
                      Contrat {contract.numero} prêt - en attente signature client
                    </p>
                    <p className="mt-1 text-xs font-medium text-info-700">
                      Lien envoyé. Expire le {formatDateLong(sig.expireA)}.
                    </p>

                    {/* Devise modifiable tant que le client n'a pas signé */}
                    <div className="mt-3">
                      <ContractDeviseSwitch
                        contractId={contract.id}
                        current={contract.devise ?? "CHF"}
                      />
                    </div>

                    {/* Le client a signé le papier / renvoyé le PDF ? On le
                        joint ici → contre-signé et envoyé en validation d'un
                        geste (confettis + le deal passe en « Signé »). */}
                    <div className="mt-3">
                      <UploadSignedPdfButton
                        contractId={contract.id}
                        onSuccess={onSignedPdf}
                        triggerLabel="Contrat signé reçu : joindre et finaliser"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/sign/${sig.lienSignature}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "default" })}
                      >
                        <PenLine aria-hidden="true" />
                        Rouvrir la page de signature
                      </a>
                      <a
                        href={`/api/contrats/${contract.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline" })}
                      >
                        <Download aria-hidden="true" />
                        Télécharger le PDF
                      </a>
                      <Link
                        href={`/contrats/${contract.id}/modifier`}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        <Pencil aria-hidden="true" />
                        Modifier le contrat
                      </Link>
                    </div>
                  </div>
                );
              }

              // État 1a : pas encore de contrat, proposer la signature en RDV
              if (deal.stage !== "PERDU") {
                const noProducts = deal.productsProposes.length === 0;
                return (
                  <div className="rounded-[16px] border border-coral-400/40 bg-coral-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                      <Smartphone aria-hidden="true" className="size-4 text-coral-600" />
                      Tu es face client en RDV ?
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Génère le contrat et ouvre la page de signature sur la tablette en un
                      clic. Une fois signé par le client, Arthur contre-signera pour valider
                      définitivement.
                    </p>
                    {noProducts ? (
                      <div className="mt-3">
                        <Link
                          href={`/pipeline/${deal.id}/modifier`}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-gold-500 bg-gold-50 px-3 text-sm font-bold text-gold-700 hover:bg-gold-50/70"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Ajoute d&apos;abord un produit
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <SignDealInPersonButton dealId={deal.id} rewardXp={isMine} />
                        <Link
                          href={`/contrats/nouveau?dealId=${deal.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full whitespace-normal")}
                        >
                          <FileText aria-hidden="true" />
                          Créer le contrat avec options (devise, modalités...)
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })()}

            {/* Lien vers la fiche prospect complète */}
            <Link
              href={`/prospects/${deal.prospect.id}`}
              className="block text-center text-sm font-bold text-info-700 hover:underline"
            >
              Voir la fiche prospect complète
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
