"use client";

/**
 * Wizard de création de contrat — 4 étapes en cartes empilées.
 *
 * Étape 1 : sélection prospect (pré-rempli si ?prospectId= ou ?dealId=)
 * Étape 2 : lignes de produits (multi-add, quantité, override prix)
 * Étape 3 : modalité paiement + dates
 * Étape 4 : récap commission + bouton Créer
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createContractFromDeal } from "@/app/(app)/contrats/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ModalitePaiement } from "@prisma/client";

interface ProductOption {
  id: string;
  nom: string;
  type: string;
  prixOneShot: string | null;
  prixMensuel: string | null;
}

interface DealOption {
  id: string;
  titre: string;
  montantPrevu: string;
  prospectId: string;
}

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface ContractWizardProps {
  prospects: ProspectOption[];
  deals: DealOption[];
  products: ProductOption[];
  tauxCommission: number;
}

interface LineState {
  id: string; // identifiant local
  productId: string;
  quantite: number;
  prixOneShot: string; // string pour input
  prixMensuel: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ContractWizard({
  prospects,
  deals,
  products,
  tauxCommission,
}: ContractWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initialDealId = searchParams.get("dealId") ?? "";
  const initialDeal = deals.find((d) => d.id === initialDealId);
  const initialProspectId =
    initialDeal?.prospectId ?? searchParams.get("prospectId") ?? "";

  // ---- État du wizard ----
  const [prospectId, setProspectId] = useState(initialProspectId);
  const [dealId, setDealId] = useState(initialDealId);

  const [lines, setLines] = useState<LineState[]>([]);

  const [dateSignature, setDateSignature] = useState(todayLocalIso());
  const [dateDebut, setDateDebut] = useState(todayLocalIso());
  const [dureeMois, setDureeMois] = useState("12");
  const [modalitePaiement, setModalitePaiement] =
    useState<ModalitePaiement>("CINQUANTE_CINQUANTE");

  // Si on change le deal, on synchronise le prospect
  useEffect(() => {
    if (dealId) {
      const d = deals.find((dd) => dd.id === dealId);
      if (d && d.prospectId !== prospectId) {
        setProspectId(d.prospectId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // ---- Calculs live (étape 4 récap) ----
  const calc = useMemo(() => {
    let oneShot = 0;
    let mensuel = 0;
    for (const l of lines) {
      const prod = products.find((p) => p.id === l.productId);
      if (!prod) continue;
      const po =
        l.prixOneShot !== ""
          ? Number(l.prixOneShot)
          : prod.prixOneShot
            ? Number(prod.prixOneShot)
            : 0;
      const pm =
        l.prixMensuel !== ""
          ? Number(l.prixMensuel)
          : prod.prixMensuel
            ? Number(prod.prixMensuel)
            : 0;
      oneShot += po * l.quantite;
      mensuel += pm * l.quantite;
    }
    const valeurAn1 = oneShot + mensuel * 12;
    const commissionTotale = valeurAn1 * tauxCommission;
    const commissionPart1 = commissionTotale / 2;
    const commissionPart2 = commissionTotale / 2;
    return {
      oneShot,
      mensuel,
      valeurAn1,
      commissionTotale,
      commissionPart1,
      commissionPart2,
    };
  }, [lines, products, tauxCommission]);

  // ---- Mutations ----
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: uid(), productId: "", quantite: 1, prixOneShot: "", prixMensuel: "" },
    ]);
  };

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const updateLine = (id: string, patch: Partial<LineState>) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );

  const canSubmit =
    prospectId !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.productId !== "") &&
    Number(dureeMois) > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Complète les sections en rouge.");
      return;
    }
    startTransition(async () => {
      const res = await createContractFromDeal({
        prospectId,
        dealId: dealId || undefined,
        dateSignature: new Date(dateSignature),
        dateDebut: new Date(dateDebut),
        dureeMois: Number(dureeMois),
        modalitePaiement,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantite: l.quantite,
          prixOneShot: l.prixOneShot ? Number(l.prixOneShot) : undefined,
          prixMensuel: l.prixMensuel ? Number(l.prixMensuel) : undefined,
        })),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la création.");
        return;
      }
      toast.success(`Contrat ${res.numero} créé !`);
      router.push(`/contrats/${res.contractId}`);
      router.refresh();
    });
  };

  // ---- Filtre deals visibles selon prospect ----
  const dealsForProspect = prospectId
    ? deals.filter((d) => d.prospectId === prospectId)
    : deals;

  return (
    <div className="space-y-6">
      {/* ÉTAPE 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={1} done={prospectId !== ""} /> Prospect & deal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prospectId">
              Prospect <span className="text-red-500">*</span>
            </Label>
            <select
              id="prospectId"
              value={prospectId}
              onChange={(e) => {
                setProspectId(e.target.value);
                setDealId("");
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                  {p.ville ? ` · ${p.ville}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealId">Deal d&apos;origine (optionnel)</Label>
            <select
              id="dealId"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={!prospectId}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50"
            >
              <option value="">— Sans deal —</option>
              {dealsForProspect.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.titre} · {formatCHF(Number(d.montantPrevu))}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Si fourni, le deal passera automatiquement en stage Signé.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ÉTAPE 2 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            <StepBadge n={2} done={lines.length > 0 && lines.every((l) => l.productId)} />
            {" "}Lignes du contrat
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
          >
            + Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Ajoute au moins une ligne (produit ou pack).
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  products={products}
                  onChange={(patch) => updateLine(line.id, patch)}
                  onRemove={() => removeLine(line.id)}
                />
              ))}
              <div className="flex justify-end pt-2 text-xs text-muted-foreground tabular-nums">
                Sous-total : {formatCHF(calc.oneShot)} one-shot ·{" "}
                {formatCHF(calc.mensuel)}/mois
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ÉTAPE 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={3} done={true} /> Modalités
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modalité de paiement</Label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {(
                [
                  {
                    value: "CINQUANTE_CINQUANTE",
                    label: "50 / 50",
                    desc: "Acompte signature + solde livraison",
                  },
                  {
                    value: "CENT_AU_SIGNING",
                    label: "100 % signature",
                    desc: "Tout réglé à la signature",
                  },
                  {
                    value: "MENSUEL",
                    label: "Mensuel",
                    desc: "12 mensualités successives",
                  },
                ] as { value: ModalitePaiement; label: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModalitePaiement(opt.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm",
                    modalitePaiement === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateSignature">Date de signature</Label>
              <Input
                id="dateSignature"
                type="date"
                value={dateSignature}
                onChange={(e) => setDateSignature(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input
                id="dateDebut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dureeMois">Durée (mois)</Label>
              <Input
                id="dureeMois"
                type="number"
                min={1}
                max={60}
                value={dureeMois}
                onChange={(e) => setDureeMois(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ÉTAPE 4 — Récap */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={4} done={canSubmit} /> Récap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <RecapLine
              label="One-shot"
              value={formatCHF(calc.oneShot)}
            />
            <RecapLine
              label="Récurrent mensuel"
              value={`${formatCHF(calc.mensuel)} / mois`}
            />
            <RecapLine
              label="Valeur an 1"
              value={formatCHF(calc.valeurAn1)}
              big
            />
            <RecapLine
              label={`Commission totale (${(tauxCommission * 100).toFixed(0)} %)`}
              value={formatCHF(calc.commissionTotale)}
              big
            />
          </div>

          <div className="mt-4 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">
              Cascade automatique à la création :
            </p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>
                Numéro contrat séquentiel (ex. <code className="rounded bg-muted px-1">ACLR-{new Date().getFullYear()}-XXXX</code>)
              </li>
              <li>
                Commission {formatCHF(calc.commissionTotale)} en{" "}
                <strong>2 parts</strong> : {formatCHF(calc.commissionPart1)} à la
                signature + {formatCHF(calc.commissionPart2)} étalé sur 11 mois
              </li>
              <li>
                Factures clients (selon modalité {modalitePaiement.replace(/_/g, " ")})
              </li>
              <li>Prospect → statut <strong>Signé</strong></li>
              {dealId && <li>Deal → stage <strong>Signé</strong></li>}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || pending}
            >
              {pending ? "Création…" : `Créer le contrat (${formatCHF(calc.valeurAn1)})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
        done
          ? "bg-emerald-500 text-white"
          : "bg-slate-200 text-slate-600",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}

function LineRow({
  line,
  products,
  onChange,
  onRemove,
}: {
  line: LineState;
  products: ProductOption[];
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}) {
  const prod = products.find((p) => p.id === line.productId);
  const defaultOneShot = prod?.prixOneShot ? Number(prod.prixOneShot) : 0;
  const defaultMensuel = prod?.prixMensuel ? Number(prod.prixMensuel) : 0;

  return (
    <div className="grid grid-cols-12 gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div className="col-span-12 md:col-span-5">
        <select
          value={line.productId}
          onChange={(e) => onChange({ productId: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">— Choisir un produit —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-3 md:col-span-1">
        <Input
          type="number"
          min={0.01}
          step="0.5"
          value={line.quantite}
          onChange={(e) =>
            onChange({ quantite: Number(e.target.value) || 1 })
          }
          className="text-center"
        />
      </div>

      <div className="col-span-4 md:col-span-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={line.prixOneShot}
          onChange={(e) => onChange({ prixOneShot: e.target.value })}
          placeholder={`${defaultOneShot}`}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-4 md:col-span-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={line.prixMensuel}
          onChange={(e) => onChange({ prixMensuel: e.target.value })}
          placeholder={`${defaultMensuel}`}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-1 flex items-center justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          aria-label="Supprimer la ligne"
          title="Supprimer"
        >
          <Icon name="LogOut" className="h-4 w-4 rotate-180" />
        </button>
      </div>

      {line.productId === "" && (
        <p className="col-span-12 text-[11px] text-red-600">
          Sélectionne un produit.
        </p>
      )}
    </div>
  );
}

function RecapLine({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 tabular-nums",
          big ? "text-xl font-semibold" : "text-sm",
        )}
      >
        {value}
      </p>
    </div>
  );
}
