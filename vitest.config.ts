import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclut les tests Playwright (e2e/) qui tournent dans un runner séparé
    exclude: ["node_modules", "dist", ".next", "e2e/**"],
    include: ["lib/**/__tests__/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
