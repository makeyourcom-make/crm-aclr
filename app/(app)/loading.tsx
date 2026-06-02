/**
 * Skeleton de chargement universel pour toutes les pages /app/(app)/*.
 *
 * Affiché instantanément par Next.js dès que le user clique sur un lien,
 * pendant que le RSC (React Server Component) charge ses données depuis
 * la DB. Améliore drastiquement la perception de vitesse (TTFB perçu
 * passe de "rien ne se passe" à "ça charge").
 */
export default function Loading() {
  return (
    <div className="animate-pulse px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* PageHeader skeleton */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-muted" />
          <div className="h-4 w-80 max-w-full rounded bg-muted/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded bg-muted" />
        </div>
      </div>

      {/* KPI grid skeleton (4 cards) */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="h-3 w-20 rounded bg-muted/60" />
            <div className="mt-3 h-6 w-28 rounded bg-muted" />
            <div className="mt-2 h-3 w-16 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Liste/tableau skeleton */}
      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-4 flex-1 rounded bg-muted/40" />
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-7 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
