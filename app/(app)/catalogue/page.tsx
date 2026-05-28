import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Catalogue produits" };

export default function Page() {
  return (
    <EnConstruction
      etape={9}
      titre="Catalogue produits"
      description="Gestion du catalogue (produits + packs) avec leurs prix one-shot et récurrents."
    />
  );
}
