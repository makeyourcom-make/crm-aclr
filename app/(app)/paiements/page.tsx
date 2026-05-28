import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Paiements clients" };

export default function Page() {
  return (
    <EnConstruction
      etape={11}
      titre="Paiements clients"
      description="Saisie des paiements reçus des clients qui déclenchent automatiquement les versements de commissions."
    />
  );
}
