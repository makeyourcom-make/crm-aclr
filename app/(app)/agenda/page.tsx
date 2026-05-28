import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Agenda" };

export default function Page() {
  return (
    <EnConstruction
      etape={19}
      titre="Agenda"
      description="Calendrier semaine/mois avec drag & drop pour replanifier appels et RDV, codes couleur, notifications avant échéance."
    />
  );
}
