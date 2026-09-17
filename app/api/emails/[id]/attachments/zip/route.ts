/**
 * GET /api/emails/[id]/attachments/zip
 * Télécharge TOUTES les pièces jointes d'un email dans un seul .zip.
 * Récupère chaque fichier côté serveur (pas de souci CORS) et déduplique les
 * noms (les emails ont souvent des pièces jointes homonymes).
 */
import JSZip from "jszip";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const email = await prisma.email.findUnique({
    where: { id },
    select: {
      userId: true,
      expediteurNom: true,
      expediteurEmail: true,
      attachments: { select: { nom: true, url: true } },
    },
  });
  if (!email) return new NextResponse("Email introuvable", { status: 404 });
  if (user.role !== "ADMIN" && email.userId !== user.id) {
    return new NextResponse("Accès refusé", { status: 403 });
  }
  if (email.attachments.length === 0) {
    return new NextResponse("Aucune pièce jointe", { status: 404 });
  }

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const a of email.attachments) {
    try {
      const res = await fetch(a.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());

      // Dédoublonnage des noms : "photo.jpg" → "photo (2).jpg", etc.
      let name = a.nom?.trim() || "piece-jointe";
      if (used.has(name)) {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let n = 2;
        while (used.has(`${base} (${n})${ext}`)) n++;
        name = `${base} (${n})${ext}`;
      }
      used.add(name);
      zip.file(name, buf);
      added++;
    } catch {
      // pièce inaccessible → on l'ignore, le zip contient le reste
    }
  }

  if (added === 0) {
    return new NextResponse("Pièces jointes inaccessibles", { status: 502 });
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const slug = (email.expediteurNom || email.expediteurEmail || "email")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "email";

  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pieces-jointes-${slug}.zip"`,
      "Content-Length": String(content.length),
    },
  });
}
