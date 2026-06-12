/**
 * GET /api/version — commit Git actuellement déployé (diagnostic).
 * Public (exclu du middleware) : ne révèle que le SHA + l'heure de build.
 */
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    env: process.env.VERCEL_ENV ?? "dev",
  });
}

export const dynamic = "force-static";
