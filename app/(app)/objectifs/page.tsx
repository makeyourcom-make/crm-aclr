import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Objectifs" };

export default function Page() {
  return (
    <EnConstruction
      etape={20}
      titre="Objectifs"
      description="Définition et suivi des objectifs commerciaux (appels, RDV, signatures, CA) avec progress bars temps réel."
    />
  );
}
