"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateMonthlyRecurrences } from "@/app/(app)/charges/recurrences/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";

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
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
      />
      <Button onClick={handle} disabled={pending}>
        <Icon
          name={pending ? "Loader" : "Repeat"}
          className={`mr-1.5 h-4 w-4 ${pending ? "animate-spin" : ""}`}
        />
        Générer les charges
      </Button>
    </div>
  );
}
