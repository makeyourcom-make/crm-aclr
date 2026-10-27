/**
 * Construit une URL de la liste /prospects à partir des paramètres courants,
 * en appliquant une modification (vue, statut…). Revient toujours à la page 1.
 * Pur, server-safe.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function toSearchParams(raw: RawSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  return sp;
}

export function prospectsHref(
  raw: RawSearchParams,
  mut: (sp: URLSearchParams) => void,
): string {
  const sp = toSearchParams(raw);
  mut(sp);
  sp.delete("page");
  const qs = sp.toString();
  return qs ? `/prospects?${qs}` : "/prospects";
}
