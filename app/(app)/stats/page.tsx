import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Statistiques" };

export default function Page() {
  return (
    <EnConstruction
      etape={21}
      titre="Statistiques"
      description="Tableau de bord analytique : funnel de conversion, objectifs vs réalisé, performance financière."
    />
  );
}
