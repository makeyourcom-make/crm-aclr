/**
 * Bandeau affiché en haut de l'app quand un admin « voit en tant que » un autre
 * collaborateur. Composant serveur : lit l'état d'impersonation et rend un
 * bouton « Quitter » (form → server action, sans JS client).
 */
import { stopImpersonating } from "@/app/(app)/rh/impersonation-actions";
import { Icon } from "@/components/icon";
import { getImpersonation } from "@/lib/session";

export async function ImpersonationBanner() {
  const imp = await getImpersonation();
  if (!imp) return null;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white shadow">
      <Icon name="Eye" className="h-4 w-4 shrink-0" />
      <span>
        Vue support — tu consultes le CRM en tant que{" "}
        <b>{imp.asUser.name}</b>.
      </span>
      <form action={stopImpersonating}>
        <button
          type="submit"
          className="rounded-md bg-white/25 px-2.5 py-0.5 text-xs font-semibold hover:bg-white/40"
        >
          Quitter la vue
        </button>
      </form>
    </div>
  );
}
