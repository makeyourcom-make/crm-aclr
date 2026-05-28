import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Renouvellements" };

export default function Page() {
  return (
    <EnConstruction
      etape={23}
      titre="Renouvellements"
      description="Vue calendaire des contrats arrivant à échéance, taux de renouvellement, alertes à risque."
    />
  );
}
