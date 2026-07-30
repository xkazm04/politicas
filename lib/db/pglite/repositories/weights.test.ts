// LensSubmissionRepository (moonshot 7B) — každý zápis projde kodekem čočky
// (neplatné se ODMÍTÁ, ne opravuje), ukládá se kanonický tvar, tabulka nenese
// žádnou identitu a čtení agregátu drží k-anonymitní práh end-to-end.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Izolovaný PGlite adresář — NIKDY ./.pglite (živá data). Nastavit PŘED importem
// čehokoli, co volá open() (vzor: changes.test.ts).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-weights-repo-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../internals");
const { makeWeightsRepo } = await import("./weights");
const { deriveWeightAggregate, K_ANONYMITY_FLOOR } = await import(
  "@/features/landing/referendum/aggregate"
);

describe("LensSubmissionRepository", () => {
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeWeightsRepo>;

  beforeAll(async () => {
    pg = await open();
    repo = makeWeightsRepo(pg);
  });

  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("odmítá vektor, který kodek nepřijme — nic se tiše neopravuje ani neukládá", async () => {
    for (const bad of ["nesmysl", "25-20-20", "25-20-20-15-10-101", "25-20-20-15-10-1.5", ""]) {
      const res = await repo.submitLensVector(bad);
      expect(res.ok).toBe(false);
    }
    expect(await repo.countLensSubmissions()).toBe(0);
  });

  it("ukládá KANONICKÝ tvar (vodicí nuly zmizí průchodem kodekem) i zveřejněnou metodiku", async () => {
    const a = await repo.submitLensVector("05-20-20-15-10-10"); // dekódovatelné, nekanonické
    expect(a).toEqual({ ok: true, count: 1 });
    const b = await repo.submitLensVector("25-20-20-15-10-10"); // hlas „souhlasím s metodikou"
    expect(b).toEqual({ ok: true, count: 2 });
    expect(await repo.listLensVectors()).toEqual(["5-20-20-15-10-10", "25-20-20-15-10-10"]);
  });

  it("tabulka nenese ŽÁDNOU identitu — jen id, vektor a čas", async () => {
    const { rows } = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'lens_submission' order by column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual(["id", "submitted_at", "vahy"]);
  });

  it("end-to-end: uložené vektory → deriveWeightAggregate drží k-anonymitní práh", async () => {
    const before = await repo.countLensSubmissions();
    for (let i = before; i < K_ANONYMITY_FLOOR - 1; i++) {
      const res = await repo.submitLensVector("40-5-10-5-35-5");
      expect(res.ok).toBe(true);
    }
    const under = deriveWeightAggregate(await repo.listLensVectors());
    expect(under.n).toBe(K_ANONYMITY_FLOOR - 1);
    expect(under.median).toBeNull();

    await repo.submitLensVector("40-5-10-5-35-5");
    const at = deriveWeightAggregate(await repo.listLensVectors());
    expect(at.n).toBe(K_ANONYMITY_FLOOR);
    expect(at.median).not.toBeNull();
    expect(at.median?.attendance).toBe(35);
  });
});
