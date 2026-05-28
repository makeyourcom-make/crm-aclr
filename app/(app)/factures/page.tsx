import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Mes factures" };

export default function Page() {
  return (
    <EnConstruction
      etape={14}
      titre="Mes factures"
      description="Factures mensuelles d'Arthur vers la commerciale, générées automatiquement avec garantie absorbable + forfait frais."
    />
  );
}
