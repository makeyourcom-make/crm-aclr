/**
 * Squelette de chargement universel pour toutes les pages /app/(app)/*.
 *
 * Affiché instantanément par Next.js dès que l'utilisateur clique sur un
 * lien, pendant que le Server Component charge ses données. Améliore
 * nettement la vitesse perçue.
 *
 * Aux couleurs MYC Arena : en-tête avec tuile de rubrique, tuiles de stats
 * (rayon 16), carte de liste (rayon 20, ombre arena), pulsation douce
 * désactivée si l'utilisateur préfère réduire les animations.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
    >
      <span className="sr-only">Chargement de la page…</span>

      <div aria-hidden="true" className="motion-safe:animate-pulse">
        {/* En-tête : tuile de rubrique + titre + action */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="size-11 shrink-0 rounded-[15px] bg-navy-100" />
            <div className="space-y-2">
              <div className="h-7 w-48 max-w-[60vw] rounded-[10px] bg-navy-100" />
              <div className="h-4 w-72 max-w-[70vw] rounded-full bg-navy-50" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-32 rounded-[12px] bg-navy-50" />
            <div className="h-11 w-36 rounded-[12px] bg-navy-100" />
          </div>
        </div>

        {/* Tuiles de stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-[12px] bg-navy-50" />
                <div className="h-3.5 w-24 rounded-full bg-navy-50" />
              </div>
              <div className="h-8 w-32 rounded-[10px] bg-navy-100" />
              <div className="h-3 w-20 rounded-full bg-navy-50" />
            </div>
          ))}
        </div>

        {/* Carte de liste / tableau */}
        <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="size-9 rounded-[12px] bg-navy-50" />
            <div className="h-5 w-40 rounded-[8px] bg-navy-100" />
          </div>
          <div className="space-y-4 p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-20 shrink-0 rounded-full bg-navy-50" />
                <div className="h-4 min-w-0 flex-1 rounded-full bg-ground" />
                <div className="hidden h-4 w-24 rounded-full bg-navy-50 sm:block" />
                <div className="h-8 w-20 shrink-0 rounded-[10px] bg-navy-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
