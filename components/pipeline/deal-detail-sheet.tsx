"use client";

/**
 * Panneau latéral (Sheet) qui affiche le détail d'un deal.
 *
 * Fetch côté client via fetch() vers une route API simple. Pour V1 on
 * fait un fetch direct ; en V2 on pourrait mettre un cache SWR/RQ.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCHF, formatDate } from "@/lib/format";
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
            {deal.productsProposes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Produits proposés ({deal.productsProposes.length})
                </p>
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
              </div>
            )}

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

            {/* Workflow validation admin pour les deals SIGNÉ */}
            {deal.stage === "SIGNE" && isAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  ⏳ En attente de ta validation
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Sophie a marqué ce deal comme signé. Valide-le en créant
                  officiellement le contrat — cascade automatique :
                  commission, factures clients, statut prospect.
                </p>
                <Link
                  href={`/contrats/nouveau?dealId=${deal.id}`}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Valider & créer le contrat
                </Link>
              </div>
            )}

            {deal.stage === "SIGNE" && !isAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                ⏳ Ce deal attend la validation d&apos;Arthur. Une fois
                validé, il passe dans la section <strong>Contrats</strong>.
              </div>
            )}

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
