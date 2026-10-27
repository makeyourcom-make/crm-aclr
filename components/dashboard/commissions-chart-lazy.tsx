"use client";

/**
 * Wrapper lazy du graphique de commissions/CA.
 *
 * `recharts` (~150 KB) n'est pas nécessaire au premier rendu du dashboard :
 * on le charge côté client uniquement (`ssr: false`) après hydratation, avec
 * un skeleton pendant le chargement. Ça sort recharts du bundle initial de la
 * page d'accueil (la plus visitée).
 */
import dynamic from "next/dynamic";

const CommissionsChart = dynamic(
  () => import("./commissions-chart").then((m) => m.CommissionsChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 w-full animate-pulse rounded-[14px] bg-navy-50" />
    ),
  },
);

interface CommissionsChartLazyProps {
  data: Array<{ label: string; montant: number }>;
  tooltipLabel?: string;
}

export function CommissionsChartLazy(props: CommissionsChartLazyProps) {
  return <CommissionsChart {...props} />;
}
