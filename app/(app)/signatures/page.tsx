import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Signatures" };

export default function Page() {
  return (
    <EnConstruction
      etape={25}
      titre="Signatures"
      description="Workflow de signature électronique : génération PDF, lien tokenisé pour le client, contre-signature ACLR."
    />
  );
}
