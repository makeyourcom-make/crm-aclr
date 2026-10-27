/**
 * Lignes et cartes de factures clients (MYC Arena), réutilisées par chaque
 * section de /factures-clients (brouillons, zone rouge, envoyées, payées) et
 * par la vue tableau triable. Server component : les actions sont les
 * boutons client existants (aperçu, envoyer / renvoyer, marquer payée,
 * supprimer).
 */
import Link from "next/link";

import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { DeleteClientInvoiceButton } from "@/components/common/entity-delete-buttons";
import { SortableHeader } from "@/components/common/sortable-header";
import { MarkInvoicePaidButton } from "@/components/paiements/mark-invoice-paid-button";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  CLIENT_INVOICE_TYPE_LABEL,
  ClientInvoiceStatusPill,
} from "./invoice-status";
import { SendInvoiceButton } from "./send-invoice-button";

export interface InvoiceRowData {
  id: string;
  numero: string;
  type: string;
  devise: string;
  total: number;
  statut: string;
  dateEmission: Date;
  dateEcheance: Date;
  datePaiement: Date | null;
  envoiClientLe: Date | null;
  rappelJ20EnvoyeLe: Date | null;
  designation: string | null;
  extraLines: number;
  isOverdue: boolean;
  isStaleDraft: boolean;
  contract: {
    id: string;
    numero: string;
    prospect: { id: string; raisonSociale: string; email: string | null };
  };
}

export type InvoiceRowVariant = "draft" | "sent" | "paid" | "cancelled" | "flat";

const DAY = 86_400_000;

/** Grille desktop commune (en-tête du tableau triable et lignes). */
export const INVOICE_GRID =
  "md:grid md:grid-cols-[minmax(150px,1fr)_minmax(0,2.4fr)_minmax(130px,0.9fr)_minmax(110px,0.8fr)_auto] md:items-center md:gap-4";

function payable(statut: string): boolean {
  return statut === "BROUILLON" || statut === "ENVOYEE" || statut === "EN_RETARD";
}

/** Jours entre l'envoi (ou l'émission) et le paiement. */
export function daysToCash(inv: InvoiceRowData): number | null {
  if (!inv.datePaiement) return null;
  const ref = inv.envoiClientLe ?? inv.dateEmission;
  return Math.max(0, Math.round((inv.datePaiement.getTime() - ref.getTime()) / DAY));
}

export function InvoiceActions({ inv }: { inv: InvoiceRowData }) {
  const canAct = payable(inv.statut);
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      <DocumentPreviewButton
        url={`/api/factures-clients/${inv.id}/pdf`}
        filename={`${inv.numero}.pdf`}
        label="Aperçu"
        icon="Eye"
        className="h-9 gap-1.5 rounded-[10px] border-border-strong bg-card px-3 text-[13px] font-bold hover:bg-navy-50"
      />
      {canAct && (
        <SendInvoiceButton
          invoiceId={inv.id}
          invoiceNumero={inv.numero}
          clientName={inv.contract.prospect.raisonSociale}
          clientEmail={inv.contract.prospect.email}
          alreadySent={inv.statut !== "BROUILLON"}
        />
      )}
      {/* Marquer payée : toute facture non encore payée (brouillon, envoyée OU
          en retard). Une facture en retard est justement celle qu'on veut
          pointer payée. */}
      {canAct && (
        <MarkInvoicePaidButton
          invoiceId={inv.id}
          numero={inv.numero}
          clientName={inv.contract.prospect.raisonSociale}
          total={inv.total}
          devise={inv.devise}
        />
      )}
      <DeleteClientInvoiceButton invoiceId={inv.id} isPayee={inv.statut === "PAYEE"} />
    </div>
  );
}

function ClientCell({ inv }: { inv: InvoiceRowData }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/prospects/${inv.contract.prospect.id}`}
        className="block truncate text-sm font-extrabold text-foreground hover:underline"
      >
        {inv.contract.prospect.raisonSociale}
      </Link>
      {inv.designation && (
        <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
          {inv.designation}
          {inv.extraLines > 0 ? ` (+${inv.extraLines} ligne${inv.extraLines > 1 ? "s" : ""})` : ""}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {CLIENT_INVOICE_TYPE_LABEL[inv.type] ?? inv.type} · contrat{" "}
        <Link
          href={`/contrats/${inv.contract.id}`}
          className="font-semibold tabular-nums hover:text-foreground hover:underline"
        >
          {inv.contract.numero}
        </Link>
      </p>
    </div>
  );
}

function DatesCell({
  inv,
  variant,
  now,
}: {
  inv: InvoiceRowData;
  variant: InvoiceRowVariant;
  now: Date;
}) {
  if (variant === "draft") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span className="text-xs font-semibold text-muted-foreground md:hidden">Émise le </span>
        {formatDate(inv.dateEmission)}
        {inv.isStaleDraft && (
          <span
            title="Brouillon émis un mois précédent : à envoyer d'urgence"
            className="inline-flex size-5 items-center justify-center rounded-full bg-alert-500 text-xs font-extrabold text-white"
          >
            <span aria-hidden="true">!</span>
            <span className="sr-only">Brouillon d&apos;un mois précédent, à envoyer d&apos;urgence</span>
          </span>
        )}
      </p>
    );
  }
  if (variant === "paid") {
    const d = daysToCash(inv);
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="rounded-full bg-win-50 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-win-700">
          Payée le {formatDate(inv.datePaiement)}
        </span>
        {d !== null && (
          <span className="text-xs text-muted-foreground">payée à J+{d}</span>
        )}
      </div>
    );
  }
  if (variant === "sent") {
    const days = Math.ceil((inv.dateEcheance.getTime() - now.getTime()) / DAY);
    return (
      <div className="flex flex-col">
        <span className="text-[13px] font-bold whitespace-nowrap">
          Échéance {formatDate(inv.dateEcheance)}
        </span>
        <span className="text-xs text-muted-foreground">
          {days <= 0 ? "aujourd'hui" : `dans ${days} j`}
          {inv.envoiClientLe ? ` · envoyée le ${formatDate(inv.envoiClientLe)}` : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col text-[13px]">
      <span className="whitespace-nowrap">
        <span className="text-xs text-muted-foreground">Émise </span>
        {formatDate(inv.dateEmission)}
        {inv.isStaleDraft && (
          <span className="ml-1 font-extrabold text-alert-700" title="Brouillon émis un mois précédent">
            !
          </span>
        )}
      </span>
      <span className={cn("whitespace-nowrap", inv.isOverdue && "font-bold text-alert-700")}>
        <span className="text-xs font-normal text-muted-foreground">Éch. </span>
        {inv.statut === "PAYEE" && inv.datePaiement
          ? `payée le ${formatDate(inv.datePaiement)}`
          : formatDate(inv.dateEcheance)}
      </span>
    </div>
  );
}

export function InvoiceRow({
  inv,
  variant,
  now,
}: {
  inv: InvoiceRowData;
  variant: InvoiceRowVariant;
  now: Date;
}) {
  const d = variant === "paid" ? daysToCash(inv) : null;
  const flash = d !== null && d <= 10;
  // Encaissée dans les dernières 24 h : ligne en vert (le cash du jour).
  const paidToday =
    variant === "paid" &&
    !!inv.datePaiement &&
    now.getTime() - inv.datePaiement.getTime() < DAY;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-[14px] border p-3.5",
        INVOICE_GRID,
        variant === "draft"
          ? inv.isStaleDraft
            ? "border-coral-100 bg-coral-50"
            : "border-border bg-ground"
          : inv.isOverdue
            ? "border-coral-100 bg-coral-50/70"
            : paidToday
              ? "border-win-500/30 bg-win-50"
              : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2 md:flex-col md:items-start md:justify-start">
        <div className="flex flex-col items-start gap-1.5">
          <a
            href={`/api/factures-clients/${inv.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-extrabold text-foreground tabular-nums hover:underline"
            title="Ouvrir le PDF dans un nouvel onglet"
          >
            {inv.numero}
          </a>
          <ClientInvoiceStatusPill
            statut={inv.statut}
            overdue={inv.isOverdue && inv.statut === "ENVOYEE"}
            staleDraft={inv.isStaleDraft}
          />
        </div>
        <p className="font-display text-lg font-extrabold whitespace-nowrap tabular-nums md:hidden">
          {formatMoney(inv.total, inv.devise)}
        </p>
      </div>
      <ClientCell inv={inv} />
      <DatesCell inv={inv} variant={variant} now={now} />
      <p
        className={cn(
          "hidden text-right font-display text-[19px] font-extrabold whitespace-nowrap tabular-nums md:block",
          variant === "paid" && "text-win-700",
        )}
      >
        {formatMoney(inv.total, inv.devise)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {flash && (
          <span className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap text-gold-700">
            Encaisseur éclair
          </span>
        )}
        <InvoiceActions inv={inv} />
      </div>
    </li>
  );
}

/** Carte « zone rouge » : jours de retard en gros, relance, actions. */
export function OverdueCard({ inv, now }: { inv: InvoiceRowData; now: Date }) {
  const days = Math.max(0, Math.floor((now.getTime() - inv.dateEcheance.getTime()) / DAY));
  return (
    <li className="flex min-w-0 gap-3.5 rounded-[14px] border border-coral-100 bg-coral-50 p-3.5 sm:gap-4 sm:p-4">
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-alert-50 py-2 sm:w-[76px]">
        <span className="score-number text-[28px] text-alert-700 sm:text-[32px]">{days}</span>
        <span className="mt-1 text-[11px] font-bold text-alert-700">
          jour{days > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <Link
            href={`/prospects/${inv.contract.prospect.id}`}
            className="min-w-0 truncate text-[15px] font-extrabold text-foreground hover:underline"
          >
            {inv.contract.prospect.raisonSociale}
          </Link>
          <span className="font-display text-[19px] font-extrabold whitespace-nowrap tabular-nums">
            {formatMoney(inv.total, inv.devise)}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          <a
            href={`/api/factures-clients/${inv.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold tabular-nums hover:text-foreground hover:underline"
          >
            {inv.numero}
          </a>
          {inv.designation ? ` · ${inv.designation}` : ""}
        </p>
        <p className="text-xs font-bold text-alert-700">
          Échue le {formatDate(inv.dateEcheance)} · émise le {formatDate(inv.dateEmission)}
        </p>
        <p>
          <span className="inline-block rounded-full bg-mail-50 px-2.5 py-0.5 text-xs font-bold text-mail-700">
            {inv.rappelJ20EnvoyeLe
              ? `Relance auto J+20 envoyée le ${formatDate(inv.rappelJ20EnvoyeLe)}`
              : inv.envoiClientLe
                ? "Relance auto J+20 non partie"
                : "Jamais envoyée par email"}
          </span>
        </p>
        <div className="mt-1">
          <InvoiceActions inv={inv} />
        </div>
      </div>
    </li>
  );
}

/** En-tête de la vue tableau triable (desktop). */
export function InvoiceTableHeader() {
  return (
    <div
      className={cn(
        "hidden px-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
        INVOICE_GRID,
      )}
    >
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        <SortableHeader label="N°" field="numero" defaultSortBy="dateEmission" />
        <SortableHeader label="Statut" field="statut" defaultSortBy="dateEmission" />
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        <SortableHeader label="Client" field="raisonSociale" defaultSortBy="dateEmission" />
        <SortableHeader label="Type" field="type" defaultSortBy="dateEmission" />
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        <SortableHeader
          label="Émise le"
          field="dateEmission"
          defaultSortBy="dateEmission"
          defaultDir="desc"
        />
        <SortableHeader
          label="Échéance"
          field="dateEcheance"
          defaultSortBy="dateEmission"
          defaultDir="asc"
        />
      </span>
      <span className="text-right">
        <SortableHeader
          label="Total"
          field="total"
          defaultSortBy="dateEmission"
          defaultDir="desc"
        />
      </span>
      <span className="text-right">Actions</span>
    </div>
  );
}
