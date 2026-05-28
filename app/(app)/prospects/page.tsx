import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Prospects" };

export default function Page() {
  return (
    <EnConstruction
      etape={5}
      titre="Prospects"
      description="Tableau filtrable de tous les prospects, import CSV, détail avec timeline et boutons d'action (appel, email, deal)."
    />
  );
}
