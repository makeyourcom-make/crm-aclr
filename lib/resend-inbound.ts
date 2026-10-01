/**
 * Récupération du contenu d'un mail ENTRANT via l'API Receiving de Resend.
 *
 * Le webhook Resend ne transmet jamais le corps du mail (juste les
 * métadonnées) : il faut rappeler `GET /emails/receiving/{id}`. Cette API
 * « générale » peut échouer ponctuellement (incidents Resend) ; sans réessai,
 * le mail est alors enregistré sans corps. On réessaie donc quelques fois.
 *
 * Utilisé par le webhook (app/api/webhooks/resend/inbound/route.ts) et par
 * l'action de rattrapage (refetchEmailBody).
 */

export interface ResendInboundContent {
  html: string;
  text: string;
  headers:
    | Record<string, string>
    | Array<{ name: string; value: string }>
    | undefined;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchResendInboundContent(
  inboundEmailId: string,
  { attempts = 3 }: { attempts?: number } = {},
): Promise<ResendInboundContent | null> {
  const key = process.env.RESEND_API_KEY ?? "";
  if (!inboundEmailId || !key) return null;

  const backoff = [400, 1200, 2500];
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(
        `https://api.resend.com/emails/receiving/${inboundEmailId}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          html?: string;
          text?: string;
          headers?:
            | Record<string, string>
            | Array<{ name: string; value: string }>;
        };
        // 200 mais vide peut arriver juste après réception : on réessaie tant
        // qu'on n'a ni html ni text.
        if ((data.html && data.html.length) || (data.text && data.text.length)) {
          return {
            html: data.html ?? "",
            text: data.text ?? "",
            headers: data.headers,
          };
        }
      } else if (
        res.status >= 400 &&
        res.status < 500 &&
        res.status !== 404 &&
        res.status !== 429
      ) {
        // Erreur client définitive (auth, requête invalide…) hors 404/429 :
        // inutile d'insister.
        console.warn(
          `[resend-inbound] Fetch content ${res.status} (définitif) pour ${inboundEmailId}`,
        );
        return null;
      }
      // 404 (pas encore prêt), 429 (rate limit) ou 5xx : on réessaie.
    } catch {
      // erreur réseau : on réessaie
    }
    if (i < attempts - 1) await sleep(backoff[i] ?? 2500);
  }
  return null;
}
