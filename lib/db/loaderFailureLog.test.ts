/*
 * [G5] THE DEGRADATION LOG.
 *
 * The distinction this file exists to keep is the one a summary is most tempted
 * to collapse: an ABSENT log and an EMPTY log are opposite findings. Absent means
 * nobody was watching; empty means somebody was and nothing happened. Everything
 * downstream — /admin's strip, the sentinel's `loader-degradations` check —
 * hangs off `null` vs `{ total: 0 }`.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendLoaderFailure,
  loaderFailureDisplayPath,
  MAX_ENTRIES,
  readLoaderFailures,
  summarizeLoaderDegradations,
} from "./loaderFailureLog";

const dir = mkdtempSync(join(tmpdir(), "politicas-loaderlog-"));
const path = join(dir, "loader-failures.jsonl");
const NOW = new Date("2026-09-04T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

beforeEach(() => {
  process.env.LOADER_FAILURE_PATH = path;
  rmSync(path, { force: true });
});

afterAll(() => {
  delete process.env.LOADER_FAILURE_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("absent is not empty", () => {
  it("returns null when there is no log — nobody was watching", () => {
    expect(existsSync(path)).toBe(false);
    expect(summarizeLoaderDegradations({ path, now: NOW })).toBeNull();
  });

  it("returns a zero SUMMARY when the log exists and is clean — somebody was", () => {
    writeFileSync(path, "", "utf8");
    expect(summarizeLoaderDegradations({ path, now: NOW })).toMatchObject({ total: 0, lastAt: null });
  });
});

describe("appending", () => {
  it("writes one line per degradation, carrying the loader and the message", () => {
    appendLoaderFailure("getVoteThemes", new Error("store unreadable"), hoursAgo(1));
    const { entries } = readLoaderFailures(path);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ loader: "getVoteThemes", message: "store unreadable" });
  });

  it("keeps the message and NOT the stack — a log is not a crash reporter", () => {
    appendLoaderFailure("x", new Error("boom"), NOW);
    expect(readFileSync(path, "utf8")).not.toContain("at ");
  });

  it("NEVER THROWS — it runs inside a catch block, and a throw would be an outage", () => {
    // A path that cannot be created: the parent is a FILE, not a directory.
    const blocked = join(path, "nested", "log.jsonl");
    writeFileSync(path, "", "utf8");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.LOADER_FAILURE_PATH = blocked;
    expect(() => appendLoaderFailure("x", new Error("boom"), NOW)).not.toThrow();
    // …and it says so once, rather than failing silently about its own failure.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("is bounded — the newest MAX_ENTRIES survive, the oldest are dropped", () => {
    const lines = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) =>
      JSON.stringify({ at: NOW.toISOString(), loader: `l${i}`, message: "m" }),
    );
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    appendLoaderFailure("newest", new Error("m"), NOW);
    const { entries } = readLoaderFailures(path);
    expect(entries).toHaveLength(MAX_ENTRIES);
    expect(entries[entries.length - 1]!.loader).toBe("newest");
    expect(entries.some((e) => e.loader === "l0")).toBe(false);
  });

  it("counts a half-written line rather than reading it as a degradation", () => {
    appendLoaderFailure("a", new Error("m"), NOW);
    writeFileSync(path, `${readFileSync(path, "utf8")}{"at":"2026`, "utf8");
    expect(readLoaderFailures(path)).toMatchObject({ malformed: 1 });
    expect(readLoaderFailures(path).entries).toHaveLength(1);
  });
});

describe("the 24 h roll-up", () => {
  beforeEach(() => {
    writeFileSync(path, "", "utf8");
    appendLoaderFailure("getVoteThemes", new Error("a"), hoursAgo(2));
    appendLoaderFailure("getVoteThemes", new Error("b"), hoursAgo(1));
    appendLoaderFailure("getMoneyData", new Error("c"), hoursAgo(30)); // outside
  });

  it("counts only what fell inside the window", () => {
    const s = summarizeLoaderDegradations({ path, now: NOW })!;
    expect(s.total).toBe(2);
    expect(s.byLoader).toEqual([
      { loader: "getVoteThemes", count: 2, lastAt: hoursAgo(1).toISOString() },
    ]);
    expect(s.lastAt).toBe(hoursAgo(1).toISOString());
  });

  it("widening the window brings the older one back — the entry was never deleted", () => {
    const s = summarizeLoaderDegradations({ path, now: NOW, windowHours: 48 })!;
    expect(s.total).toBe(3);
    expect(s.byLoader.map((l) => l.loader).sort()).toEqual(["getMoneyData", "getVoteThemes"]);
  });

  it("admits the file it counted, portably — the number has to be checkable", () => {
    expect(summarizeLoaderDegradations({ path, now: NOW })!.path).not.toContain("\\");
    expect(loaderFailureDisplayPath()).not.toMatch(/^\.\//);
  });
});
