import { describe, expect, it } from "vitest";
import {
  isWorkhorseFlavour,
  workhorseBadgeKey,
  workhorseDetailKey,
  workhorseFlavourCopy,
  WORKHORSE_COPY_KEYS,
  WORKHORSE_FLAVOURS,
} from "./workhorse-flavour";

describe("isWorkhorseFlavour", () => {
  it("accepts both vocabulary values", () => {
    for (const f of WORKHORSE_FLAVOURS) expect(isWorkhorseFlavour(f)).toBe(true);
  });

  it("rejects unknown strings, non-strings, null and undefined", () => {
    expect(isWorkhorseFlavour("committee")).toBe(false);
    expect(isWorkhorseFlavour("")).toBe(false);
    expect(isWorkhorseFlavour(1)).toBe(false);
    expect(isWorkhorseFlavour(null)).toBe(false);
    expect(isWorkhorseFlavour(undefined)).toBe(false);
    expect(isWorkhorseFlavour({})).toBe(false);
  });
});

describe("workhorseFlavourCopy", () => {
  it("returns a distinct message key pair for both flavours", () => {
    const seen = new Set<string>();
    for (const f of WORKHORSE_FLAVOURS) {
      const c = workhorseFlavourCopy(f);
      expect(c).not.toBeNull();
      expect(c!.badgeKey, f).toBe(workhorseBadgeKey(f));
      expect(c!.detailKey, f).toBe(workhorseDetailKey(f));
      expect(seen.has(c!.badgeKey), `${f} reuses a badge key`).toBe(false);
      seen.add(c!.badgeKey);
      seen.add(c!.detailKey);
    }
  });

  it("publishes exactly the keys it can emit", () => {
    const emitted = WORKHORSE_FLAVOURS.flatMap((f) => {
      const c = workhorseFlavourCopy(f)!;
      return [c.badgeKey, c.detailKey];
    }).sort();
    expect([...WORKHORSE_COPY_KEYS].sort()).toEqual(emitted);
  });

  it("degrades to null for missing or unrecognized flavours — never fabricates a label", () => {
    expect(workhorseFlavourCopy(undefined)).toBeNull();
    expect(workhorseFlavourCopy(null)).toBeNull();
    expect(workhorseFlavourCopy("some_other_flavour")).toBeNull();
  });

  it("treats legislative and oversight symmetrically — same shape, no tone hierarchy field", () => {
    const a = workhorseFlavourCopy("legislative")!;
    const b = workhorseFlavourCopy("oversight")!;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });
});

/* The sentences moved to messages/{cs,en}.json (namespace `verdicts`, 2026-08-12)
 * because this module rendered CZECH LITERALS to English readers — and, worse,
 * `WorkhorseBadge` glued them to a TRANSLATED claim, so one sentence came out in
 * two languages. The Czech language gate follows the copy: it now runs over the
 * cs catalog in features/civicscore/messages.test.ts, which also holds the two
 * catalogs to `WORKHORSE_COPY_KEYS` above. The gate assertion is not lost, it
 * MOVED: it used to read strings this file declared, and now reads the strings
 * that actually render. */
