import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLISHED_WEIGHTS } from "@/features/civicscore/lens";
import { carriesLens, serializeWeights } from "./aggregate";

/* Server action referenda — dveře urny. Tři věci, které se tu hlídají:
 *  · vektor se součtem 0 se odmítá U DVEŘÍ týmž pravidlem, jakým ho agregát
 *    přeskakuje (aggregate.ts, pravidlo 1) — do 2026-09-06 se uložil, čtenář
 *    dostal „hlas odevzdán" a místní zábrana mu zamkla urnu za hlas, který
 *    se nikdy nezapočítal;
 *  · výjimka úložiště se vrací jako `unavailable`, ne jako neošetřený pád
 *    serverové akce (klient pak neměl žádnou větu);
 *  · šťastná cesta vrací agregát z reálného odvození. */

const state = vi.hoisted(() => ({
  repo: null as null | {
    submitLensVector: (raw: string) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
    listLensVectors: () => Promise<string[]>;
  },
  revalidated: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }));
vi.mock("@/lib/db/pglite/repositories/weights", () => ({ getWeightsRepo: async () => state.repo }));

import { submitLensVector } from "./actions";

const ZERO = "0-0-0-0-0-0";
const OFFICIAL = serializeWeights(PUBLISHED_WEIGHTS);

beforeEach(() => {
  state.repo = null;
  state.revalidated = [];
});

describe("carriesLens — vektor se součtem 0 nenese žádnou čočku", () => {
  it("rozhoduje podle součtu, ne podle tvaru", () => {
    expect(carriesLens(PUBLISHED_WEIGHTS)).toBe(true);
    expect(carriesLens({ ...PUBLISHED_WEIGHTS, participation: 0 })).toBe(true);
    const zero = Object.fromEntries(Object.keys(PUBLISHED_WEIGHTS).map((k) => [k, 0]));
    expect(carriesLens(zero as typeof PUBLISHED_WEIGHTS)).toBe(false);
  });
});

describe("submitLensVector — dveře urny", () => {
  it("odmítá vektor se součtem 0 dřív, než sáhne na úložiště", async () => {
    const submit = vi.fn();
    state.repo = { submitLensVector: submit, listLensVectors: async () => [] };
    expect(await submitLensVector(ZERO)).toEqual({ status: "invalid" });
    expect(submit).not.toHaveBeenCalled();
    expect(state.revalidated).toEqual([]);
  });

  it("odmítá, co kodek nepřijme, a přeteklý řetězec bez jakékoli práce", async () => {
    expect(await submitLensVector("1-2-3")).toEqual({ status: "invalid" });
    expect(await submitLensVector("x".repeat(65))).toEqual({ status: "invalid" });
  });

  it("bez úložiště přiznává `unavailable`", async () => {
    expect(await submitLensVector(OFFICIAL)).toEqual({ status: "unavailable" });
  });

  it("výjimka úložiště je `unavailable`, ne pád akce", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.repo = {
      submitLensVector: async () => {
        throw new Error("PGlite: database is locked");
      },
      listLensVectors: async () => [],
    };
    expect(await submitLensVector(OFFICIAL)).toEqual({ status: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
    expect(state.revalidated).toEqual([]);
    error.mockRestore();
  });

  it("šťastná cesta: zapíše, odvodí agregát a revaliduje /referendum", async () => {
    const stored: string[] = [];
    state.repo = {
      submitLensVector: async (raw) => {
        stored.push(raw);
        return { ok: true, count: stored.length };
      },
      listLensVectors: async () => stored,
    };
    const res = await submitLensVector(OFFICIAL);
    expect(res).toEqual({ status: "ok", aggregate: { n: 1, median: null } });
    expect(stored).toEqual([OFFICIAL]);
    expect(state.revalidated).toEqual(["/referendum"]);
  });
});
