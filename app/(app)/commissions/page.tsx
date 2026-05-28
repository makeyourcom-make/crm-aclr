import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Commissions" };

export default function Page() {
  return (
    <EnConstruction
      etape={13}
      titre="Commissions"
      description="Vue détaillée des commissions versées et à venir, calendrier des versements mensuels étalés."
    />
  );
}
