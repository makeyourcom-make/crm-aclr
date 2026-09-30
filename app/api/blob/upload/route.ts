/**
 * Génération de token pour l'upload DIRECT navigateur → Vercel Blob.
 *
 * Pourquoi : les Server Actions Vercel plafonnent le corps des requêtes à
 * ~4.5 MB. Envoyer un PDF signé de 8+ pages en base64 à travers une action
 * échoue ("This page couldn't load"). Ici, le navigateur envoie le fichier
 * DIRECTEMENT au blob store (via @vercel/blob/client `upload`), et seule l'URL
 * repart ensuite vers le Server Action `uploadSignedContract`.
 *
 * Exclu du middleware d'auth (proxy.ts) : la vérification de session se fait
 * ci-dessous dans `onBeforeGenerateToken` (le callback de complétion appelé par
 * Vercel n'a pas de cookie de session et ne doit pas être redirigé vers /login).
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Auth : seul un utilisateur connecté peut obtenir un token d'upload.
        const user = await getSessionUser();
        if (!user) throw new Error("Non authentifié.");
        // On restreint strictement le chemin : contrats signés + documents
        // de la bibliothèque d'équipe (dépôt réservé à l'admin, vérifié dans
        // le Server Action `createDocument`).
        if (
          !pathname.startsWith("signed-contracts/") &&
          !pathname.startsWith("documents/")
        ) {
          throw new Error("Chemin d'upload non autorisé.");
        }
        // Bibliothèque de documents : dépôt STRICTEMENT réservé à l'admin.
        // Les commerciaux ont un accès en consultation/téléchargement seulement.
        if (pathname.startsWith("documents/") && user.role !== "ADMIN") {
          throw new Error("Dépôt de documents réservé à l'administrateur.");
        }
        // Contrats signés : PDF/images uniquement. Bibliothèque de documents :
        // types bureautiques élargis (Office, vidéo, archives, texte).
        const isDocs = pathname.startsWith("documents/");
        return {
          allowedContentTypes: isDocs
            ? [
                "application/pdf",
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "text/plain",
                "text/csv",
                "application/zip",
                "video/mp4",
                "video/quicktime",
              ]
            : ["application/pdf", "image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: isDocs
            ? 50 * 1024 * 1024 // 50 MB — supports (slides, courtes vidéos)
            : 20 * 1024 * 1024, // 20 MB — scan couleur multipage
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // Rien à faire : l'enregistrement (URL + signature) est fait par le
        // Server Action `uploadSignedContract` juste après, côté navigateur.
        // NB : ce callback n'est de toute façon pas déclenché en localhost.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur d'upload." },
      { status: 400 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
