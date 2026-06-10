"use client";

/**
 * Panneau latéral (Sheet) qui affiche le détail d'un deal.
 *
 * Fetch côté client via fetch() vers une route API simple. Pour V1 on
 * fait un fetch direct ; en V2 on pourrait mettre un cache SWR/RQ.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { ContractDeviseSwitch } from "@/components/contrats/contract-devise-switch";
import { Icon } from "@/components/icon";
import { SignDealInPersonButton } from "@/components/pipeline/sign-deal-in-person-button";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCHF, formatDate, formatDateLong } from "@/lib/format";
import { getDealStageLabel } from "@/lib/labels";

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
}

export function DealDetailSheet({ dealId, onClose, isAdmin }: DealDetailSheetProps) {
  const [deal, setDeal] = useState<DealDetailLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      setDeal(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/deals/${dealId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DealDetailLite) => {
        setDeal(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [dealId]);

  return (
    <Sheet open={!!dealId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{deal?.titre ?? "Détail du deal"}</SheetTitle>
          {deal?.prospect && (
            <SheetDescription>
              <Link
                href={`/prospects/${deal.prospect.id}`}
                className="hover:underline"
              >
                {deal.prospect.raisonSociale}
              </Link>
              {deal.prospect.ville && ` · ${deal.prospect.ville}`}
            </SheetDescription>
          )}
          {deal && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/pipeline/${deal.id}/modifier`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
              >
                <Icon name="Pencil" className="h-3.5 w-3.5" />
                Modifier
              </Link>
            </div>
          )}
        </SheetHeader>

        {loading && (
          <div className="px-6 py-4 text-sm text-muted-foreground">
            Chargement…
          </div>
        )}

        {error && (
          <div className="px-6 py-4 text-sm text-red-700">{error}</div>
        )}

        {deal && (
          <div className="space-y-5 px-6 py-4">
            {/* Montant + stage + proba */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCHF(Number(deal.montantPrevu))}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Stage : {getDealStageLabel(deal.stage as never)}</span>
                <span>·</span>
                <span>Probabilité : {deal.probabilite} %</span>
              </div>
              {deal.closeAttenduLe && (
                <p className="mt-2 flex items-center gap-1 text-xs">
                  <Icon name="Calendar" className="h-3.5 w-3.5" />
                  Close attendu le {formatDate(deal.closeAttenduLe)}
                </p>
              )}
            </div>

            {/* Description */}
            {deal.description && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <p className="whitespace-pre-line text-sm">
                  {deal.description}
                </p>
              </div>
            )}

            {/* Produits */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Produits proposés ({deal.productsProposes.length})
                </p>
                <Link
                  href={`/pipeline/${deal.id}/modifier`}
                  className="text-xs text-primary hover:underline"
                >
                  {deal.productsProposes.length === 0
                    ? "+ Ajouter"
                    : "Modifier"}
                </Link>
              </div>
              {deal.productsProposes.length === 0 ? (
                <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠ Aucun produit. Tu dois en ajouter au moins un avant de
                  pouvoir faire signer le contrat.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {deal.productsProposes.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{p.nom}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p.prixOneShot &&
                          `${formatCHF(Number(p.prixOneShot))} one-shot`}
                        {p.prixOneShot && p.prixMensuel && " · "}
                        {p.prixMensuel &&
                          `${formatCHF(Number(p.prixMensuel))}/mois`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Contact prospect */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Contact
              </p>
              <p className="text-sm">
                {[deal.prospect.contactPrenom, deal.prospect.contactNom]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              {deal.prospect.email && (
                <a
                  href={`mailto:${deal.prospect.email}`}
                  className="text-xs text-primary hover:underline"
                >
                  {deal.prospect.email}
                </a>
              )}
            </div>

            {/* Méta */}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              {deal.assigneA && <p>Assigné à {deal.assigneA.name}</p>}
            </div>

            {/* Workflow signature — 3 états possibles */}
            {(() => {
              const contract = deal.contracts[0];
              const sig = contract?.signatures[0];
              const isSignedByClientOnly =
                !!sig && sig.signeParClient && !sig.signeParAclr;
              const isFullySigned =
                !!sig && sig.signeParClient && sig.signeParAclr;
              const hasContractNoSig = !!contract && !sig?.signeParClient;

              // État 3 — Contre-signé : ne devrait normalement pas être
              // visible (le deal sort du pipeline), mais par sécurité on
              // affiche un message neutre.
              if (isFullySigned) {
                return (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    ✅ Contrat <strong>{contract.numero}</strong> entièrement
                    signé. Ce deal sera retiré du pipeline au prochain rafraîchissement.
                  </div>
                );
              }

              // État 2 — Signé client, attend Arthur
              if (isSignedByClientOnly) {
                return (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-900">
                      ✓ Contrat {contract.numero} signé par le client
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      Signé le{" "}
                      {sig.dateSignatureClient
                        ? formatDateLong(sig.dateSignatureClient)
                        : "—"}
                      . {isAdmin
                        ? "Vérifie le contrat, puis contre-signe pour valider et clore le deal."
                        : "Le contrat attend la validation d'Arthur."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/contrats/${contract.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                      >
                        Voir le contrat
                      </Link>
                      {isAdmin && (
                        <SignAclrButton signatureId={sig.id} />
                      )}
                    </div>
                  </div>
                );
              }

              // État 1b — Contrat créé mais client n'a pas encore signé
              // (Sophie a démarré la signature mais le client n'a pas validé)
              if (hasContractNoSig && sig) {
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      📝 Contrat {contract.numero} prêt — en attente signature
                      client
                    </p>
                    <p className="mt-1 text-xs text-blue-800">
                      Lien envoyé. Expire le {formatDateLong(sig.expireA)}.
                    </p>

                    {/* Switch devise — modifiable tant que le client n'a pas signé */}
                    <div className="mt-3">
                      <ContractDeviseSwitch
                        contractId={contract.id}
                        current={contract.devise ?? "CHF"}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/sign/${sig.lienSignature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Icon name="PenLine" className="h-3.5 w-3.5" />
                        Rouvrir la page de signature
                      </a>
                      <a
                        href={`/api/contrats/${contract.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 text-sm font-medium text-blue-900 hover:bg-blue-100"
                      >
                        <Icon name="Download" className="h-3.5 w-3.5" />
                        Télécharger le PDF
                      </a>
                      <Link
                        href={`/contrats/${contract.id}/modifier`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 text-sm font-medium text-blue-900 hover:bg-blue-100"
                      >
                        <Icon name="Pencil" className="h-3.5 w-3.5" />
                        Modifier le contrat
                      </Link>
                    </div>
                  </div>
                );
              }

              // État 1a — Pas encore de contrat : proposer la signature en RDV
              if (deal.stage !== "PERDU") {
                const noProducts = deal.productsProposes.length === 0;
                return (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-foreground">
                      📱 Tu es face client en RDV ?
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Génère le contrat + ouvre la page de signature sur la
                      tablette en un clic. Une fois signé par le client,
                      Arthur contre-signera pour valider définitivement.
                    </p>
                    {noProducts ? (
                      <div className="mt-3">
                        <Link
                          href={`/pipeline/${deal.id}/modifier`}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                        >
                          <Icon name="Pencil" className="h-4 w-4" />
                          Ajoute d&apos;abord un produit
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <SignDealInPersonButton dealId={deal.id} />
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
              className="block text-center text-sm font-medium text-primary hover:underline"
            >
              Voir la fiche prospect complète →
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
