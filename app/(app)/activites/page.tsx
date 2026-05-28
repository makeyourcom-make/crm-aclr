import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Activités" };

export default function Page() {
  return (
    <EnConstruction
      etape={6}
      titre="Activités"
      description="Liste filtrable de toutes les activités (appels, emails, RDV, notes). Vue calendrier alternative et création rapide."
    />
  );
}
