import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Pipeline" };

export default function Page() {
  return (
    <EnConstruction
      etape={8}
      titre="Pipeline"
      description="Vue Kanban des deals (Découverte → Proposition → Négociation → Signé/Perdu) avec drag & drop entre stages."
    />
  );
}
