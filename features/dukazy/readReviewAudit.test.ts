// Sdílený odečet lidské brány — dvě věci, které jdou v testu ověřit, a jedna,
// která nejde a je proto přiznaná v hlavičce modulu.
//
// OVĚŘITELNÉ: (1) sdílení ROZBĚHNUTÉHO čtení — dva loadery (/denik a /dukazy)
// spouští `getSchrankaDeltas` v jednom `Promise.all`, takže druhý volající
// přichází, dokud první ještě běží, a musí dostat TÝŽ slib; (2) přiznání
// stropu — `listReviewAudit` má tvrdý strop a repozitář u něj sám varuje, že
// useknuté čtení „publikuje špatné číslo".
//
// NEOVĚŘITELNÉ ZDE: `react.cache()` bez React dispatcheru nededuplikuje (viz
// měření v hlavičce readReviewAudit.ts), takže „jedno čtení na požadavek" se
// v vitestu připíchnout nedá. Test proto pin-uje jen tu půlku, která je vidět
// i mimo RSC — a druhá se tím nepředstírá.

import { beforeEach, describe, expect, it, vi } from "vitest";

const listReviewAudit = vi.fn();
const getKgNodes = vi.fn();
const getStore = vi.fn();

vi.mock("@/lib/db/store", () => ({
  getStore: () => getStore(),
}));

const { readReviewAudit, REVIEW_AUDIT_CAP } = await import("./readReviewAudit");

const auditRow = (id: string) => ({
  id,
  src: "psp:person:6543",
  rel: "linked_to",
  dst: "kg:company:04544152",
  decision: "confirm" as const,
  reviewer: "recenzent",
  note: null,
  decidedAt: "2026-07-20T10:00:00.000Z",
  priorState: "pending_review",
});

/** Slib, který doběhne až na povel — tím se dá být „uprostřed čtení". */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  listReviewAudit.mockReset();
  getKgNodes.mockReset();
  getStore.mockReset();
  getStore.mockResolvedValue({ listReviewAudit, getKgNodes });
  getKgNodes.mockResolvedValue([
    { id: "psp:person:6543", label: "Jan Novák" },
    { id: "kg:company:04544152", label: "Alfa s.r.o." },
  ]);
});

describe("readReviewAudit — souběžní volající platí za log jednou", () => {
  it("volání, které přijde během rozběhnutého čtení, dostane týž slib", async () => {
    const gate = deferred<ReturnType<typeof auditRow>[]>();
    listReviewAudit.mockReturnValue(gate.promise);

    // Přesně tvar, ve kterém oba deníky volají schránka: jeden Promise.all.
    const both = Promise.all([readReviewAudit(), readReviewAudit()]);
    gate.resolve([auditRow("r1")]);
    const [a, b] = await both;

    expect(listReviewAudit).toHaveBeenCalledTimes(1);
    expect(getKgNodes).toHaveBeenCalledTimes(1);
    // Táž identita, ne jen shodná data — druhý volající NEČETL.
    expect(a).toBe(b);
    expect(a?.rows.map((r) => r.id)).toEqual(["r1"]);
    expect(a?.nodeLabels.get("psp:person:6543")).toBe("Jan Novák");
  });

  it("po doběhnutí se slib zahodí — brána se čte znovu, žádné okno", async () => {
    // Rozhodnutí revizora se nesmí opozdit o memo okno dávkových vrstev, takže
    // sdílení je omezené na to, co právě běží.
    listReviewAudit.mockResolvedValue([auditRow("r1")]);
    await readReviewAudit();
    await readReviewAudit();
    expect(listReviewAudit).toHaveBeenCalledTimes(2);
  });

  it("nedostupné úložiště je null — nečitelné, ne prázdné", async () => {
    getStore.mockResolvedValue(null);
    expect(await readReviewAudit()).toBeNull();
    expect(listReviewAudit).not.toHaveBeenCalled();
  });
});

describe("readReviewAudit — strop se přizná", () => {
  it("čtení přesně na stropu se hlásí jako useknuté", async () => {
    listReviewAudit.mockResolvedValue(
      Array.from({ length: REVIEW_AUDIT_CAP }, (_, i) => auditRow(`r${i}`)),
    );
    const read = await readReviewAudit();
    expect(read?.truncated).toBe(true);
    expect(read?.cap).toBe(REVIEW_AUDIT_CAP);
    // Čte se PŘESNĚ na stropu, ne pod ním: menší limit by useknutí schoval.
    expect(listReviewAudit.mock.calls[0][0]).toEqual({ limit: REVIEW_AUDIT_CAP });
  });

  it("čtení pod stropem useknuté není", async () => {
    listReviewAudit.mockResolvedValue([auditRow("r1")]);
    const read = await readReviewAudit();
    expect(read?.truncated).toBe(false);
    expect(read?.rows).toHaveLength(1);
  });
});

describe("readReviewAudit — labely jsou obohacení, ne podmínka", () => {
  it("selhání čtení jmen nechá odečet žít; plochy degradují na id uzlů", async () => {
    listReviewAudit.mockResolvedValue([auditRow("r1")]);
    getKgNodes.mockRejectedValue(new Error("labely nedostupné"));
    const read = await readReviewAudit();
    expect(read?.rows).toHaveLength(1);
    expect(read?.nodeLabels.size).toBe(0);
  });
});
