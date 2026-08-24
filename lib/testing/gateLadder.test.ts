/*
 * THE LADDER, DERIVED — CI must be a superset of `npm run check`.
 *
 * Same standards, several rungs, escalating cost. The rungs are allowed to
 * differ in SCOPE and in when they run; they are not allowed to differ in WHAT
 * THEY ENFORCE, because every local rung can be bypassed with a flag or simply
 * never installed on a fresh clone. The merge pipeline is the only rung that
 * refuses, so:
 *
 *   Every check on a lower rung also exists on the merge rung.
 *   A check that runs only locally is a courtesy, not a gate.
 *
 * The 2026-08-24 registry audit found the two sides had drifted apart in BOTH
 * directions: `census:test` and `library:check` ran only in `npm run check`,
 * while the schema-drift check and `build` ran only in CI. The first asymmetry
 * is the defect (courtesy masquerading as a gate) and is now fixed in ci.yml.
 * The second is a DECISION, listed below by name: those two need a clean room —
 * no local caches, no uncommitted state — which is the one thing a workstation
 * cannot supply, so they are hard-pass steps and stay CI-only on purpose.
 *
 * Why a test and not a comment: CLAUDE.md, AGENTS.md and this workflow have all
 * described the gate before, and the audit found all three disagreeing with
 * package.json and with each other (a "three-step chain" for a six-step script,
 * "six custom rules" for eight). A projection of policy that is hand-maintained
 * is a copy, and copies drift. This one is DERIVED: it reads the real `check`
 * script and the real workflow, so adding a seventh step to `check` without
 * adding it to CI fails here, at the push rung, in seconds.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const ciYaml = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

/**
 * Steps CI runs that no local rung does, each with the reason it needs the
 * remote layer. A step earns a slot here only by needing something the
 * workstation cannot supply — a clean room, credentials, or the merge decision
 * itself. This list is the reviewable half of the asymmetry; the test below
 * checks the other half.
 */
const CI_ONLY_BY_DESIGN: Record<string, string> = {
  "db:snapshot": "clean room — compares the committed SQL snapshot against CORE_DDL at the commit, with no local build state",
  build: "clean room — a full Next build from a fresh `npm ci` tree, too slow for any local rung",
  audit: "input-shaped and deliberately non-blocking (advisory signal for Dependabot)",
};

/** The npm scripts `npm run check` chains, in order. */
function checkChain(): string[] {
  const check = pkg.scripts.check;
  expect(check, "package.json must declare a `check` script").toBeTruthy();
  return check
    .split("&&")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("npm run "))
    .map((s) => s.slice("npm run ".length).trim());
}

/** Every `run:` command in the workflow, flattened. */
function ciRunCommands(): string[] {
  return [...ciYaml.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1].trim());
}

describe("gate ladder — CI is a superset of `npm run check`", () => {
  const chain = checkChain();
  const ciRuns = ciRunCommands();

  it("enumerates a real chain and a real workflow (the walk still sees both)", () => {
    // Empty success is the failure mode this whole file exists to prevent: a
    // reshaped `check` or a reshaped workflow that made either list empty would
    // otherwise pass as "nothing missing".
    expect(chain.length).toBeGreaterThanOrEqual(4);
    expect(ciRuns.length).toBeGreaterThanOrEqual(5);
  });

  it("every step of `npm run check` also runs in CI", () => {
    const missing = chain.filter((step) => !ciRuns.some((cmd) => cmd.includes(`npm run ${step}`)));
    expect(
      missing,
      `${missing.length} of ${chain.length} local gate steps have no CI counterpart — ` +
        "a check that runs only on the author's machine is a courtesy, not a gate",
    ).toEqual([]);
  });

  it("every CI-only step is one someone decided on, by name", () => {
    const localSteps = new Set(chain);
    const undeclared = ciRuns
      .filter((cmd) => cmd.startsWith("npm run ") || cmd.startsWith("npm audit"))
      .filter((cmd) => !chain.some((step) => cmd.includes(`npm run ${step}`)))
      .filter((cmd) => !Object.keys(CI_ONLY_BY_DESIGN).some((k) => cmd.includes(k)));
    expect(
      undeclared,
      "a CI step with no local counterpart and no recorded reason — either add it to " +
        "`npm run check` so the author learns of the failure first, or name it in " +
        "CI_ONLY_BY_DESIGN with what the workstation cannot supply",
    ).toEqual([]);
    // Sanity: the declared list describes steps that exist, not ghosts.
    for (const key of Object.keys(CI_ONLY_BY_DESIGN)) {
      expect(ciRuns.some((cmd) => cmd.includes(key)), `CI_ONLY_BY_DESIGN names "${key}", which CI does not run`).toBe(
        true,
      );
      expect(localSteps.has(key)).toBe(false);
    }
  });
});
