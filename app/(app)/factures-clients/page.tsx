import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Factures clients" };

export default function Page() {
  return (
    <EnConstruction
      etape={24}
      titre="Factures clients"
      description="Émission, suivi et relance des factures envoyées par ACLR Sàrl aux clients signés."
    />
  );
}
