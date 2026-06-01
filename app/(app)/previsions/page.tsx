/**
 * Page /previsions — DÉPRÉCIÉE.
 *
 * Les prévisions étaient redondantes avec /stats (KPIs + funnel + projections)
 * et /commissions (calendrier des versements à venir). On redirige donc
 * vers /stats pour ne pas casser les bookmarks.
 */
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";

export const metadata = { title: "Prévisions" };
export const dynamic = "force-dynamic";

export default async function PrevisionsPage() {
  await requireUser();
  redirect("/stats");
}
