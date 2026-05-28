/**
 * API GET /api/deals/[id] — utilisé par le panneau de détail du pipeline.
 */
import { NextResponse } from "next/server";

import { getDealById } from "@/lib/queries/deals";
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
  const deal = await getDealById(user, id);
  if (!deal) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json(deal);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
