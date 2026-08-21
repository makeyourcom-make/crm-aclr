/**
 * Petite explosion de confettis pour célébrer une signature validée.
 * Import dynamique : canvas-confetti n'est chargé que la première fois qu'on
 * fête quelque chose, il ne pèse donc pas sur le bundle initial.
 */
export async function fireConfetti(): Promise<void> {
  if (typeof window === "undefined") return;
  const confetti = (await import("canvas-confetti")).default;

  const duration = 1400;
  const end = Date.now() + duration;
  const colors = ["#0E1936", "#F47174", "#10b981", "#ffffff"];

  // Deux jets latéraux qui se rejoignent au centre.
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      startVelocity: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      startVelocity: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Gros bouquet central au démarrage.
  confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.6 },
    colors,
  });
}
