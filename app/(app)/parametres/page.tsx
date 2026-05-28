import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Paramètres" };

export default function Page() {
  return (
    <EnConstruction
      etape={18}
      titre="Paramètres"
      description="Coordonnées ACLR Sàrl, IBAN, logo, taux de commission, garantie mensuelle, forfait frais."
    />
  );
}
