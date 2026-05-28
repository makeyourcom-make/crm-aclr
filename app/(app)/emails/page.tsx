import { EnConstruction } from "@/components/layout/en-construction";

export const metadata = { title: "Emails" };

export default function Page() {
  return (
    <EnConstruction
      etape={26}
      titre="Emails"
      description="Boîte unifiée vision 360 : tous les emails sortants et entrants liés aux prospects, threading, tracking ouvertures/clics."
    />
  );
}
