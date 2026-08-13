// Meze věstníku brány, vypsané větou — a hlavně ta, kvůli které tenhle modul
// vznikl: prázdný deník tvrdil „žádný záznam není zamlčen" nad 141 forenzními
// posudky, které týž požadavek přečetl a publikační filtr zahodil.

import { describe, expect, it } from "vitest";
import { allLayersRead, dukazyLimitNotes } from "./limitNotes";
import type { DukazyLimits } from "./getDukazyData";

const limits = (over: Partial<DukazyLimits> = {}): DukazyLimits => ({
  auditTruncated: false,
  auditCap: 10_000,
  withheld: { total: 0, byState: [] },
  forensicRead: true,
  tieSourcesRead: true,
  labelsRead: true,
  ...over,
});

const keys = (l: DukazyLimits) => dukazyLimitNotes(l, "cs").map((n) => n.key);

describe("dukazyLimitNotes — mez, která se dat nedotkla, mlčí", () => {
  it("zdravý odečet vysloví JEDINOU větu, a je to odvozený závěr o zadržování", () => {
    expect(keys(limits())).toEqual(["limits.nothingWithheld"]);
  });

  it("useknutý odečet brány závěr o nezadržování NEVYSLOVÍ", () => {
    // Strop se vypisuje přímo u čísla (`section.sourceFloor`), ale absolutní
    // závěr o úplnosti nad useknutým čtením neplatí.
    expect(keys(limits({ auditTruncated: true }))).toEqual([]);
  });
});

describe("dukazyLimitNotes — fronta u brány", () => {
  const queued = limits({
    withheld: {
      total: 141,
      byState: [{ state: "pending_review", count: 141 }],
    },
  });

  it("zadržené posudky se počítají a absolutní věta zmizí", () => {
    expect(keys(queued)).toEqual(["limits.withheld"]);
  });

  it("předává syrové číslo pro plurál i zformátované pro oči", () => {
    const [note] = dukazyLimitNotes(queued, "cs");
    expect(note.values.n).toBe(141);
    // Formátuje lib/format (české oddělovače), plurál vybírá syrové `n`.
    expect(note.values.nFmt).toBe("141");
    expect(note.values.states).toBe("pending_review — 141");
  });

  it("stavy jde vypsat víc a jsou VERBATIM tokeny grafu", () => {
    const [note] = dukazyLimitNotes(
      limits({
        withheld: {
          total: 3,
          byState: [
            { state: "pending_review", count: 2 },
            { state: "withheld", count: 1 },
          ],
        },
      }),
      "cs",
    );
    expect(note.values.states).toBe("pending_review — 2 · withheld — 1");
  });

  it("tisíce se formátují po česku (nezlomitelná mezera z lib/format)", () => {
    const [note] = dukazyLimitNotes(
      limits({ withheld: { total: 1234, byState: [{ state: "pending_review", count: 1234 }] } }),
      "cs",
    );
    expect(note.values.n).toBe(1234);
    expect(String(note.values.nFmt)).not.toBe("1234");
  });
});

describe("dukazyLimitNotes — tři degradace, které se odehrávaly potichu", () => {
  it("každá nečitelná vrstva má vlastní větu", () => {
    expect(keys(limits({ forensicRead: false }))).toEqual(["limits.forensicUnread"]);
    expect(keys(limits({ tieSourcesRead: false }))).toEqual(["limits.tieSourcesUnread"]);
    expect(keys(limits({ labelsRead: false }))).toEqual(["limits.labelsUnread"]);
  });

  it("nečitelná vrstva NIKDY nevysloví závěr o nezadržování", () => {
    // Nečitelná vrstva o zadržování nic neví — a nevědomost není záruka.
    for (const over of [{ forensicRead: false }, { tieSourcesRead: false }, { labelsRead: false }]) {
      expect(keys(limits(over))).not.toContain("limits.nothingWithheld");
    }
  });

  it("pořadí je stabilní: nejdřív fronta, pak degradace", () => {
    expect(
      keys(
        limits({
          withheld: { total: 2, byState: [{ state: "pending_review", count: 2 }] },
          forensicRead: false,
          tieSourcesRead: false,
          labelsRead: false,
        }),
      ),
    ).toEqual([
      "limits.withheld",
      "limits.forensicUnread",
      "limits.tieSourcesUnread",
      "limits.labelsUnread",
    ]);
  });
});

describe("allLayersRead", () => {
  it("je pravda jen tehdy, když se přečetly všechny tři", () => {
    expect(allLayersRead(limits())).toBe(true);
    expect(allLayersRead(limits({ forensicRead: false }))).toBe(false);
    expect(allLayersRead(limits({ tieSourcesRead: false }))).toBe(false);
    expect(allLayersRead(limits({ labelsRead: false }))).toBe(false);
  });
});
