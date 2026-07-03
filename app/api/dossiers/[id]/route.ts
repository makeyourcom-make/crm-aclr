/**
 * API GET /api/dossiers/[id] — détail affiché par le panneau latéral du kanban.
 */
import { NextResponse } from "next/server";

import { getDossierById } from "@/lib/queries/dossiers";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const dossier = await getDossierById(user, id);
  if (!dossier) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json(dossier);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
