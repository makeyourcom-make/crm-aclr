import { describe, expect, it } from "vitest";

import { motifsDeRetenue, type FicheLiens } from "../sync/prospect-sync";

const AUCUN_LIEN: FicheLiens = {
  activities: 0,
  deals: 0,
  contracts: 0,
  emails: 0,
  expenses: 0,
  expenseAllocations: 0,
  expenseRecurrences: 0,
  dossiers: 0,
};

/** Doublon d'import jamais touché : le seul cas supprimable. */
const coquille = {
  statut: "NOUVEAU",
  notesGenerales: null,
  derniereActionLe: null,
  liens: AUCUN_LIEN,
};

describe("motifsDeRetenue", () => {
  it("autorise la suppression d'une coquille d'import intacte", () => {
    expect(motifsDeRetenue(coquille)).toEqual([]);
  });

  it("autorise VIERGE au même titre que NOUVEAU", () => {
    expect(motifsDeRetenue({ ...coquille, statut: "VIERGE" })).toEqual([]);
  });

  it("retient dès qu'un statut traduit un travail commercial", () => {
    for (const statut of ["CONTACTE", "QUALIFIE", "RDV_PRIS", "SIGNE", "PERDU", "NE_PAS_RAPPELER"]) {
      expect(motifsDeRetenue({ ...coquille, statut })).toContain(`statut ${statut}`);
    }
  });

  it("retient une fiche dont la suppression effacerait l'historique (Cascade)", () => {
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, activities: 3 } })).toEqual([
      "3 activité(s)",
    ]);
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, deals: 1 } })).toEqual([
      "1 affaire(s)",
    ]);
  });

  it("retient une fiche dont la suppression échouerait en base (Restrict)", () => {
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, contracts: 1 } })).toEqual([
      "1 contrat(s)",
    ]);
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, expenseAllocations: 2 } })).toEqual(
      ["2 part(s) de charge"],
    );
  });

  it("retient sur les liens seulement orphelinés (SetNull)", () => {
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, emails: 1 } })).toEqual([
      "1 email(s)",
    ]);
    expect(motifsDeRetenue({ ...coquille, liens: { ...AUCUN_LIEN, dossiers: 1 } })).toEqual([
      "1 dossier(s)",
    ]);
  });

  it("retient sur une trace humaine sans relation", () => {
    expect(motifsDeRetenue({ ...coquille, notesGenerales: "rappeler en mars" })).toEqual([
      "notes saisies",
    ]);
    expect(motifsDeRetenue({ ...coquille, derniereActionLe: new Date("2026-01-01") })).toEqual([
      "action commerciale enregistrée",
    ]);
  });

  it("ne retient pas sur des notes vides ou blanches", () => {
    expect(motifsDeRetenue({ ...coquille, notesGenerales: "   " })).toEqual([]);
    expect(motifsDeRetenue({ ...coquille, notesGenerales: "" })).toEqual([]);
  });

  it("cumule tous les motifs plutôt que de s'arrêter au premier", () => {
    const m = motifsDeRetenue({
      statut: "SIGNE",
      notesGenerales: "client fidèle",
      derniereActionLe: new Date("2026-02-02"),
      liens: { ...AUCUN_LIEN, activities: 2, contracts: 1 },
    });
    expect(m).toContain("1 contrat(s)");
    expect(m).toContain("2 activité(s)");
    expect(m).toContain("statut SIGNE");
    expect(m).toContain("notes saisies");
    expect(m).toContain("action commerciale enregistrée");
  });
});
