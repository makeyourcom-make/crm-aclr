import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Contrats" };

export default function Page() {
  return (
    <EnConstruction
      etape={10}
      titre="Contrats"
      description="Tableau des contrats actifs, wizard de création depuis un deal signé, planning paiements et commissions associées."
    />
  );
}
