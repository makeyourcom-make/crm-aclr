/**
 * Productivité téléphone (ADMIN UNIQUEMENT) : temps au téléphone, durée
 * moyenne, cadence, plus long appel, temps par jour (recharts), conversion
 * en RDV selon la durée, décomposition par commerciale et top 5 des plus
 * longs appels. La commerciale ne voit RIEN de cette section. Server-safe.
 */
import { Zap } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { formatDuration, formatPercent } from "@/lib/format";
import type { CallProductivity } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

import { CallTimeChart } from "./call-time-chart";
import { Eyebrow, MiniStat, cleanText, formatZurichDate } from "./ui";

/** « 41 h 20 », « 4 min 31 », « 45 s ». */
export function humanDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")}`;
  return `${sec} s`;
}

const BUCKET_STYLE: Record<"court" | "moyen" | "long", { bar: string; text: string }> = {
  court: { bar: "bg-subtle", text: "text-muted-foreground" },
  moyen: { bar: "bg-gold-500", text: "text-gold-700" },
  long: { bar: "bg-win-500", text: "text-win-700" },
};

export function PhoneProductivity({
  data,
  workingDays,
}: {
  data: CallProductivity;
  /** Jours ouvrés de la période (cadence). */
  workingDays: number;
}) {
  const top = data.topLongs[0] ?? null;
  const maxRate = Math.max(...data.parBucket.map((b) => b.tauxConversion), 0.0001);
  // Meilleure tranche (moyen ou long, échantillon ≥ 5 appels) vs appels courts.
  const court = data.parBucket.find((b) => b.bucket === "court");
  const best = data.parBucket
    .filter((b) => b.bucket !== "court" && b.nbAppels >= 5)
    .sort((a, b) => b.tauxConversion - a.tauxConversion)[0];
  const facteur =
    court && best && court.tauxConversion > 0 ? best.tauxConversion / court.tauxConversion : null;
  const bestLabel = best?.bucket === "moyen" ? "de 2 à 5 min" : "de plus de 5 min";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        <MiniStat
          label="Temps au téléphone"
          value={humanDuration(data.totalSeconds)}
          sub={`${formatInt(data.nbAppelsWithDuration)} appel${data.nbAppelsWithDuration > 1 ? "s" : ""} chronométré${data.nbAppelsWithDuration > 1 ? "s" : ""}`}
        />
        <MiniStat label="Durée moyenne" value={humanDuration(data.avgSeconds)} sub="par appel" />
        <MiniStat
          label="Cadence"
          value={
            data.nbAppelsWithDuration > 0 && workingDays > 0
              ? `${(data.nbAppelsWithDuration / workingDays).toFixed(1)} / jour`
              : "0 / jour"
          }
          sub={`sur ${workingDays} jour${workingDays > 1 ? "s" : ""} ouvré${workingDays > 1 ? "s" : ""}`}
        />
        <MiniStat
          label="Plus long appel"
          value={humanDuration(data.maxSeconds)}
          tone="gold"
          sub={
            top && top.secondes === data.maxSeconds ? (
              <Link href={`/prospects/${top.prospectId}`} className="font-bold underline-offset-2 hover:underline">
                {cleanText(top.prospectName)} · {top.userName.split(" ")[0]}
              </Link>
            ) : data.maxSeconds > 0 ? (
              "Appel sans fiche entreprise"
            ) : (
              "Aucun appel chronométré"
            )
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>Temps téléphone par jour</Eyebrow>
        <CallTimeChart data={data.parJour} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Eyebrow>Conversion en RDV selon la durée</Eyebrow>
          {data.parBucket.map((b) => {
            const st = BUCKET_STYLE[b.bucket];
            const widthPct = Math.max(2, (b.tauxConversion / maxRate) * 100);
            return (
              <div key={b.bucket} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[13px]">
                  <span className="font-bold">{b.label}</span>
                  <span className={cn("font-bold tabular-nums", st.text)}>
                    {b.nbRdvPris} RDV / {b.nbAppels} appels · {formatPercent(b.tauxConversion)}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${b.label} : ${formatPercent(b.tauxConversion)} de conversion en RDV`}
                  className="h-2.5 overflow-hidden rounded-full bg-ground"
                >
                  <div className={cn("h-full rounded-full", st.bar)} style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })}
          <div className="flex items-start gap-3 rounded-[14px] bg-navy-700 px-4 py-3.5 text-white">
            <Zap aria-hidden="true" className="mt-0.5 size-5 shrink-0 fill-gold-500 text-gold-500" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-extrabold">
                {facteur !== null && facteur >= 1.5
                  ? `Les appels ${bestLabel} convertissent ${facteur.toFixed(1)} fois mieux que les appels courts`
                  : "Prends le temps de la découverte"}
              </span>
              <span className="text-[13px] text-navy-200">
                Conversion = appel ayant décroché un RDV. Si les appels longs convertissent bien mieux, ça vaut
                la peine d&apos;investir le temps dans la découverte au lieu de pitcher vite.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Eyebrow>Top 5 plus longs appels</Eyebrow>
          {data.topLongs.length === 0 ? (
            <p className="rounded-[14px] bg-ground px-4 py-5 text-sm text-muted-foreground">
              Aucun appel chronométré sur la période.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
              {data.topLongs.map((c, i) => (
                <li key={c.activityId} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-extrabold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/prospects/${c.prospectId}`} className="text-sm font-bold hover:underline">
                      {cleanText(c.prospectName)}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {cleanText(c.sujet)} · {formatZurichDate(c.date)} · {c.userName.split(" ")[0]}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-coral-600 tabular-nums">
                    {formatDuration(c.secondes)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {data.parUser.length > 1 && (
            <div className="overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full min-w-[360px] text-[13px]">
                <caption className="sr-only">Temps téléphone par commerciale</caption>
                <thead>
                  <tr className="bg-ground text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    <th scope="col" className="px-3 py-2.5 text-left">Commerciale</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Appels</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Temps total</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Moy. / appel</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parUser.map((u) => (
                    <tr key={u.userId} className="border-t border-border">
                      <th scope="row" className="px-3 py-2.5 text-left font-bold">{u.name}</th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatInt(u.nbAppels)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{humanDuration(u.totalSeconds)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{humanDuration(u.avgSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
