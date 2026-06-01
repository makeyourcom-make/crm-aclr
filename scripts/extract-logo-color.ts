/**
 * Extrait la couleur dominante (coin) du logo PNG pour aligner le fond
 * de l'en-tête de facture.
 */
// @ts-nocheck — utilitaire one-shot, pas dans le bundle Next
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const png = PNG.sync.read(
  readFileSync(
    "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\brand\\logo-full.png",
  ),
);

// Échantillon plusieurs pixels du coin haut-gauche (zone uniforme)
const samples: Array<[number, number, number]> = [];
for (let y = 5; y < 30; y += 5) {
  for (let x = 5; x < 30; x += 5) {
    const idx = (png.width * y + x) << 2;
    samples.push([png.data[idx], png.data[idx + 1], png.data[idx + 2]]);
  }
}

const avg = samples.reduce(
  (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
  [0, 0, 0],
);
const n = samples.length;
const [r, g, b] = [
  Math.round(avg[0] / n),
  Math.round(avg[1] / n),
  Math.round(avg[2] / n),
];
const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
console.log(`Logo PNG ${png.width}x${png.height}`);
console.log(`${n} samples coin haut-gauche → RGB(${r}, ${g}, ${b}) = ${hex}`);
