/**
 * Smoke tests — vérifient que les chemins critiques répondent.
 *
 * Pré-requis :
 *   - Dev server lancé sur http://localhost:3000
 *   - DB seedée avec les 2 users (sophie@aclr.ch / arthur@aclr.ch)
 *
 * Pour le full test suite des 10 flux critiques de la spec, voir
 * la roadmap V2.
 */
import { expect, test } from "@playwright/test";

const SOPHIE_EMAIL = "sophie@aclr.ch";
const ARTHUR_EMAIL = "arthur@aclr.ch";
// Mots de passe lus depuis env (ne pas commiter en clair)
const SOPHIE_PWD = process.env.E2E_SOPHIE_PWD ?? "";
const ARTHUR_PWD = process.env.E2E_ARTHUR_PWD ?? "";

test.describe("Smoke — endpoints publics", () => {
  test("page /login répond et affiche le formulaire", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Connexion")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
  });

  test("/ redirige vers /login si pas connecté", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/prospects redirige vers /login si pas connecté", async ({ page }) => {
    await page.goto("/prospects");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Smoke — Sophie connectée", () => {
  test.skip(!SOPHIE_PWD, "Pwd Sophie manquant (E2E_SOPHIE_PWD).");

  test("login Sophie + navigation modules", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SOPHIE_EMAIL);
    await page.getByLabel("Mot de passe").fill(SOPHIE_PWD);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Dashboard
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Bonjour Sophie/)).toBeVisible();

    // Aller sur /prospects
    await page.getByRole("link", { name: "Prospects" }).first().click();
    await expect(page).toHaveURL(/\/prospects/);
    await expect(page.getByRole("heading", { name: "Prospects" })).toBeVisible();

    // Aller sur /aujourd-hui
    await page.goto("/aujourd-hui");
    await expect(page.getByText(/Bonjour Sophie/)).toBeVisible();

    // Aller sur /pipeline
    await page.goto("/pipeline");
    await expect(
      page.getByRole("heading", { name: "Pipeline" }),
    ).toBeVisible();

    // Aller sur /commissions
    await page.goto("/commissions");
    await expect(
      page.getByRole("heading", { name: "Commissions" }),
    ).toBeVisible();

    // /catalogue doit être interdit
    await page.goto("/catalogue");
    // Soit redirect, soit erreur 403 — on vérifie que le titre Catalogue
    // n'est pas dans le DOM
    await expect(
      page.getByRole("heading", { name: "Catalogue produits" }),
    ).not.toBeVisible();
  });
});

test.describe("Smoke — Arthur connecté", () => {
  test.skip(!ARTHUR_PWD, "Pwd Arthur manquant (E2E_ARTHUR_PWD).");

  test("Arthur voit les sections admin", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ARTHUR_EMAIL);
    await page.getByLabel("Mot de passe").fill(ARTHUR_PWD);
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Bonjour Arthur/)).toBeVisible();

    // /catalogue doit être accessible
    await page.goto("/catalogue");
    await expect(
      page.getByRole("heading", { name: "Catalogue produits" }),
    ).toBeVisible();

    // /parametres avec section ACLR Sàrl (admin only)
    await page.goto("/parametres");
    await expect(page.getByText(/Paramètres ACLR Sàrl/)).toBeVisible();

    // /templates-emails accessible
    await page.goto("/templates-emails");
    await expect(
      page.getByRole("heading", { name: "Templates emails" }),
    ).toBeVisible();
  });
});
