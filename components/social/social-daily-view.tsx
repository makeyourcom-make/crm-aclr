"use client";

/**
 * Vue "Aujourd'hui" du module Social — actions dues regroupées par compte
 * puis par étape (J+0 / J+2 / J+4 / J+6).
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  redistributeProspects,
  toggleStep,
  updateProspectStatut,
} from "@/app/(app)/social/actions";
import { Icon } from "@/components/icon";
import {
  NETWORK_COLORS,
  NETWORK_LABELS,
  STEP_HINTS,
  STEP_ICONS,
  type SocialStep,
} from "@/lib/social-sequence";

interface DueProspect {
  id: string;
  nom: string;
  profilUrl: string;
  dateDemarrage: string;
}

interface AccountSection {
  id: string;
  nom: string;
  reseau: string;
  responsable: string;
  dueByStep: Record<SocialStep, DueProspect[]>;
  totalDue: number;
}

interface Props {
  accounts: AccountSection[];
  stepLabels: Record<SocialStep, string>;
  steps: SocialStep[];
}

export function SocialDailyView({ accounts, stepLabels, steps }: Props) {
  return (
    <div className="space-y-6">
      {accounts.map((account) => (
        <AccountBlock
          key={account.id}
          account={account}
          stepLabels={stepLabels}
          steps={steps}
        />
      ))}
    </div>
  );
}

function AccountBlock({
  account,
  stepLabels,
  steps,
}: {
  account: AccountSection;
  stepLabels: Record<SocialStep, string>;
  steps: SocialStep[];
}) {
  const empty = account.totalDue === 0;
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              NETWORK_COLORS[account.reseau] ?? NETWORK_COLORS.AUTRE
            }`}
          >
            {NETWORK_LABELS[account.reseau] ?? account.reseau}
          </span>
          <h2 className="text-base font-semibold">{account.nom}</h2>
          <span className="text-xs text-muted-foreground">
            · {account.responsable}
          </span>
        </div>
        <span className="text-xs font-medium tabular-nums">
          {account.totalDue} action(s)
        </span>
      </header>

      {empty ? (
        <p className="p-4 text-center text-xs text-muted-foreground">
          Rien à faire sur ce compte aujourd&apos;hui.
        </p>
      ) : (
        <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <StepColumn
              key={step}
              step={step}
              label={stepLabels[step]}
              hint={STEP_HINTS[step]}
              iconName={STEP_ICONS[step]}
              prospects={account.dueByStep[step]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StepColumn({
  step,
  label,
  hint,
  iconName,
  prospects,
}: {
  step: SocialStep;
  label: string;
  hint: string;
  iconName: string;
  prospects: DueProspect[];
}) {
  return (
    <div className="bg-card">
      <header className="border-b border-border bg-muted/40 p-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Icon name={iconName} className="h-3 w-3" />
          {label}
          <span className="ml-auto tabular-nums text-muted-foreground">
            {prospects.length}
          </span>
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      </header>
      <ul className="divide-y divide-border">
        {prospects.length === 0 ? (
          <li className="p-3 text-center text-[10px] italic text-muted-foreground">
            —
          </li>
        ) : (
          prospects.map((p) => (
            <ProspectRow key={`${p.id}-${step}`} prospect={p} step={step} />
          ))
        )}
      </ul>
    </div>
  );
}

function ProspectRow({
  prospect,
  step,
}: {
  prospect: DueProspect;
  step: SocialStep;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleCheck = () => {
    startTransition(async () => {
      const res = await toggleStep({
        prospectId: prospect.id,
        step,
        done: true,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      if (res.sequenceCompleted) {
        toast.success(
          `Séquence terminée pour ${prospect.nom} — passé en "Pas de réponse" (modifiable).`,
        );
      } else {
        toast.success("Étape cochée ✓");
      }
      router.refresh();
    });
  };

  const handleGagne = () => {
    if (!confirm(`Marquer ${prospect.nom} comme "Gagné" ?`)) return;
    startTransition(async () => {
      const res = await updateProspectStatut({
        prospectId: prospect.id,
        statut: "GAGNE",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("🎉 Gagné !");
      router.refresh();
    });
  };

  const handlePerdu = () => {
    if (!confirm(`Marquer ${prospect.nom} comme "Perdu" ?`)) return;
    startTransition(async () => {
      const res = await updateProspectStatut({
        prospectId: prospect.id,
        statut: "PERDU",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Marqué perdu.");
      router.refresh();
    });
  };

  return (
    <li className="flex items-center gap-2 p-2 text-xs hover:bg-muted/40">
      <input
        type="checkbox"
        checked={false}
        onChange={handleCheck}
        disabled={pending}
        className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600 disabled:opacity-50"
        aria-label={`Cocher étape ${step} pour ${prospect.nom}`}
      />
      <a
        href={prospect.profilUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 truncate font-medium text-foreground hover:text-primary hover:underline"
        title={prospect.profilUrl}
      >
        {prospect.nom}
      </a>
      <button
        type="button"
        onClick={handleGagne}
        disabled={pending}
        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
        title="Marquer gagné"
      >
        <Icon name="Check" className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={handlePerdu}
        disabled={pending}
        className="rounded p-0.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
        title="Marquer perdu"
      >
        <Icon name="X" className="h-3 w-3" />
      </button>
    </li>
  );
}
