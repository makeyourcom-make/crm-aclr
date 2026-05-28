import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Prévisions" };

export default function Page() {
  return (
    <EnConstruction
      etape={22}
      titre="Prévisions"
      description="Projection du salaire / revenu sur 12 mois (commissions, renouvellements, pipeline pondéré)."
    />
  );
}
