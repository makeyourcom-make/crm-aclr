import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Aujourd'hui" };

export default function Page() {
  return (
    <EnConstruction
      etape={7}
      titre="Aujourd'hui"
      description="Vue cockpit pour piloter sa journée : objectifs du jour, liste des tâches/appels/RDV à faire, raccourcis clavier."
    />
  );
}
