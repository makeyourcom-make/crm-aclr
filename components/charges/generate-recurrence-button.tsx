"use client";

import { Loader2, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateMonthlyRecurrences } from "@/app/(app)/charges/recurrences/actions";
import { FIELD_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GenerateRecurrenceButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const handle = () => {
    start(async () => {
      const res = await generateMonthlyRecurrences({ monthYearMonth: month });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur");
        return;
      }
      const created = (res as { created: number }).created;
      const skipped = (res as { skipped: number }).skipped;
      toast.success(
        `${created} charge(s) générée(s), ${skipped} déjà existante(s).`,
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="min-w-0">
        <span className="sr-only">Mois à générer</span>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={cn(FIELD_CLASS, "w-auto")}
        />
      </label>
      <Button size="lg" onClick={handle} disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Repeat aria-hidden="true" />
        )}
        Générer les charges
      </Button>
    </div>
  );
}
