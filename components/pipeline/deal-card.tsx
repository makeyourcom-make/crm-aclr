"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DeleteDealButton } from "@/components/common/entity-delete-buttons";
import { Icon } from "@/components/icon";
import { formatCHFCompact, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DealForKanban } from "@/lib/queries/deals";

interface DealCardProps {
  deal: DealForKanban;
  onOpen: (dealId: string) => void;
}

export function DealCard({ deal, onOpen }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue =
    deal.closeAttenduLe &&
    deal.closeAttenduLe < new Date() &&
    deal.stage !== "SIGNE" &&
    deal.stage !== "PERDU";

  // État signature : on dérive du premier contrat lié (généralement 1 seul
  // car le deal ne sort du pipeline qu'à la contre-signature admin).
  const contract = deal.contracts[0];
  const sig = contract?.signatures[0];
  const isSignedByClientOnly =
    !!sig && sig.signeParClient && !sig.signeParAclr;
  const hasContractButNoSignature =
    !!contract && (!sig || (!sig.signeParClient && !sig.signeParAclr));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Évite d'ouvrir si on est en train de drag
        if (isDragging) return;
        // Bypass le drag listener si pointer move est court (click pur)
        e.stopPropagation();
        onOpen(deal.id);
      }}
      className={cn(
        "cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "ring-2 ring-primary",
      )}
    >
      {/* Titre du deal */}
      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {deal.titre}
      </p>

      {/* Prospect */}
      <p className="mt-1 text-xs text-muted-foreground">
        {deal.prospect.raisonSociale}
      </p>

      {/* Badge de statut signature — précis selon l'avancement */}
      {isSignedByClientOnly ? (
        <p className="mt-1 inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
          ✓ Signé client · attend validation Arthur
        </p>
      ) : hasContractButNoSignature ? (
        <p className="mt-1 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
          📝 Contrat prêt — en attente signature client
        </p>
      ) : (
        deal.stage === "SIGNE" && (
          <p className="mt-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            ⏳ Marqué signé — créer le contrat
          </p>
        )
      )}

      {/* Montant + probabilité */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatCHFCompact(Number(deal.montantPrevu))}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            deal.probabilite >= 70
              ? "bg-emerald-100 text-emerald-700"
              : deal.probabilite >= 40
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {deal.probabilite}%
        </span>
      </div>

      {/* Date close attendue */}
      {deal.closeAttenduLe && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px]",
            isOverdue ? "text-red-600" : "text-muted-foreground",
          )}
        >
          <Icon name="Calendar" className="h-3 w-3" />
          {formatDate(deal.closeAttenduLe)}
          {isOverdue && " · en retard"}
        </p>
      )}

      {/* Commerciale + bouton supprimer (admin/assigné) */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {deal.assigneA ? (
          <p className="text-[10px] text-muted-foreground">
            → {deal.assigneA.name}
          </p>
        ) : (
          <span />
        )}
        {/*
          Wrapper qui stoppe la propagation : sinon le clic sur la
          poubelle déclencherait le onOpen du Deal (drawer).
        */}
        <span onClick={(e) => e.stopPropagation()}>
          <DeleteDealButton dealId={deal.id} variant="icon" />
        </span>
      </div>
    </div>
  );
}
