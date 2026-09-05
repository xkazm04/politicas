// The store's own prose, checked against the code it describes (source grep).
// Three headers in lib/db still described the store as it stood before the G2
// review door (2026-09-04) and before three repositories were added; a count or a
// writer name that lives in a comment goes stale the day the code moves.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STORE = readFileSync("lib/db/store.ts", "utf8");
const COMPOSER = readFileSync("lib/db/pglite-store.ts", "utf8");
const TYPES = readFileSync("lib/db/types.ts", "utf8");
const DDL = readFileSync("lib/db/pglite/ddl.ts", "utf8");

describe("store headers describe the store that exists (2026-09-06, documentation-auditor)", () => {
  it("the facade header does not hard-code how many repositories compose it", () => {
    expect(STORE).not.toMatch(/composed from (four|five|six|seven|eight|\d+) narrow repositories/i);
  });

  it("the composer spreads exactly the repositories the Store interface extends", () => {
    const extendsBlock = STORE.slice(STORE.indexOf("export interface Store"), STORE.indexOf("close(): Promise<void>"));
    const interfaces = extendsBlock.match(/\b[A-Z]\w+Repository\b/g) ?? [];
    const spreads = COMPOSER.match(/\.\.\.make\w+Repo\(pg\)/g) ?? [];
    expect(interfaces.length).toBeGreaterThan(0);
    expect(spreads.length).toBe(interfaces.length);
  });

  it("the review door's writer is named as setReviewState, not its tie alias, everywhere the store describes it", () => {
    const reviewDoc = STORE.slice(STORE.indexOf("export interface ReviewRepository") - 900, STORE.indexOf("export interface ReviewRepository"));
    expect(reviewDoc).toMatch(/every claim kind/i);
    expect(TYPES).toMatch(/Written by `ReviewRepository\.setReviewState`/);
    expect(DDL).not.toMatch(/the ONLY writer is ReviewRepository\.setTieReviewState/);
    expect(DDL).toMatch(/ReviewRepository\.setReviewState/);
  });

  it("the vote-tag example slug is one the taxonomy actually uses", () => {
    expect(TYPES).not.toMatch(/`budget-finance`/);
    expect(TYPES).toMatch(/`rozpocet-finance`/);
  });
});
