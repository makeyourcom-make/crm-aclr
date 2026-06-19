/**
 * Endpoint d'upload des pièces jointes email — pattern « client upload » de
 * Vercel Blob : le navigateur envoie le fichier DIRECTEMENT à Blob (pas via la
 * fonction serverless), ce qui contourne la limite dure de 4.5 MB du corps des
 * requêtes serverless Vercel — la cause des crashs « This page couldn't load »
 * sur les fichiers volumineux (scans, PDF signés…).
 *
 * Cette route ne fait que générer un token d'upload signé (après auth) ; le
 * fichier ne transite jamais par elle. La ligne EmailAttachment n'est créée
 * qu'au moment de l'envoi du mail.
 *
 * Nécessite BLOB_READ_WRITE_TOKEN (auto-injecté par Vercel quand un store Blob
 * est connecté au projet). Sans store, la route renvoie 400 et le client bascule
 * sur l'upload via server action (dev local).
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Auth : seul un utilisateur connecté peut obtenir un token d'upload.
        const user = await requireUser();
        return {
          // 20 MB max par fichier (cohérent avec le quota côté UI).
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      // Rien à faire à la complétion : la PJ est persistée à l'envoi du mail.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload impossible." },
      { status: 400 },
    );
  }
}
