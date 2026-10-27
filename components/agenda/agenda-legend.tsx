/**
 * Légende de l'agenda : types (teinte + icône), statuts, origine phoning,
 * couleurs des collaborateurs (vue équipe) et rappel des gestes.
 */
import { Star } from "lucide-react";

import type { ActivityCategory } from "@/lib/activity-category";

import {
  AGENDA_HEX,
  CATEGORY_META,
  RDV_TYPE_KEYS,
  TYPE_META,
} from "./agenda-style";

export function AgendaLegend({
  activeCats,
  team,
  month,
}: {
  activeCats: ActivityCategory[];
  /** Vue équipe : collaborateurs et leur couleur. */
  team: Array<{ id: string; name: string; color: string }>;
  month: boolean;
}) {
  const others = activeCats.filter((c) => c !== "rdv");
  return (
    <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs font-semibold text-muted-foreground">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase">Types</span>
        {RDV_TYPE_KEYS.map((k) => {
          const meta = TYPE_META[k];
          const TIcon = meta.icon;
          const hex = AGENDA_HEX[meta.tone];
          return (
            <span key={k} className="inline-flex items-center gap-1.5" style={{ color: hex.text }}>
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-[6px]"
                style={{ background: hex.soft }}
              >
                <TIcon className="size-3.5" strokeWidth={2.2} />
              </span>
              {meta.label}
            </span>
          );
        })}
        {others.map((c) => {
          const meta = CATEGORY_META[c];
          const CIcon = meta.icon;
          const hex = AGENDA_HEX[meta.tone];
          return (
            <span key={c} className="inline-flex items-center gap-1.5" style={{ color: hex.text }}>
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-[6px]"
                style={{ background: hex.soft }}
              >
                <CIcon className="size-3.5" strokeWidth={2.2} />
              </span>
              {meta.label}
            </span>
          );
        })}
        {!month && (
          <>
            <span aria-hidden="true" className="hidden h-[18px] w-px bg-border sm:inline-block" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase">Statuts</span>
            <Swatch style={{ border: "2px dashed #E5484D", background: "#FFF4DC" }} label="À valider" />
            <Swatch style={{ background: "#E3F7EB", borderLeft: "4px solid #12A150" }} label="Effectué" />
            <Swatch style={{ background: "#FDE7E8", borderLeft: "4px solid #E5484D" }} label="Manqué" />
            <Swatch style={{ background: "#F4F6FB", borderLeft: "4px solid #D5DAE6" }} label="Fait · annulé" />
            <span className="inline-flex items-center gap-1.5">
              <Star aria-hidden="true" className="size-3.5 fill-gold-500 text-gold-700" strokeWidth={1.5} />
              Décroché au phoning
            </span>
          </>
        )}
      </div>
      {team.length > 0 && !month && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase">Équipe</span>
          {team.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-1 rounded-full" style={{ background: u.color }} />
              {u.name.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs font-semibold text-muted-foreground">
        {month
          ? "Clique sur un jour pour l'ouvrir en vue Jour."
          : "Clique sur un créneau vide pour planifier, glisse un bloc pour le déplacer (appui long au doigt), tire son bas pour changer la durée."}
      </p>
    </div>
  );
}

function Swatch({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="box-border h-3 w-4 rounded-[4px]" style={style} />
      {label}
    </span>
  );
}
