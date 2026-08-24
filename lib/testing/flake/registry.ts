/**
 * THE QUARANTINE REGISTER — load, validate, publish, gate.
 *
 * test-harness/flake-lifecycle says a flaky test is a process with five
 * transitions (detected → labelled → quarantined → fixed → released) and an owner
 * at each one, and that a register only works if it is LOUD. This module is the
 * loud part: `assertRegisterHealthy()` runs as a plain test in the blocking unit
 * lane, so an expired quarantine turns the gate red without anybody remembering to
 * look at a dashboard.
 *
 * The two figures the technique asks to publish travel with their predicate here:
 * `size` (with the ceiling it is measured against) and `oldestAgeDays` (more
 * diagnostic than size — 40 entries none older than a fortnight is a working
 * process; 6 entries with one 14 months old is a broken one).
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not label automatically. Automatic
 * labelling needs retained run history, which `history.ts` has only just started
 * collecting and which CI (a fresh machine per run) does not accumulate at all.
 * `detect.ts` computes transition counts from whatever history exists and PRINTS
 * candidates; promoting a candidate into this register stays a human decision, and
 * that is stated rather than dressed up as automation.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type QuarantineCause = "test" | "harness" | "product";
export type QuarantineForm = "muted" | "skipped";

export interface QuarantineEntry {
  /** Repo-relative path of the test FILE that leaves the blocking lane. */
  file: string;
  /** The test that actually flaked, for the record. Does not narrow the exclusion. */
  test: string;
  /** A named person. Never a team — unowned quarantine is never reviewed. */
  owner: string;
  /** ISO date (YYYY-MM-DD) the entry was made. */
  entered: string;
  /** ISO date (YYYY-MM-DD) after which the gate goes red. Debt, not amnesty. */
  expires: string;
  /** Which of the three is suspected. `product` must escalate immediately. */
  cause: QuarantineCause;
  /** Prefer `muted`; `skipped` needs its reason recorded in `evidence`. */
  form: QuarantineForm;
  /** Where the failure was seen — a run URL, a memo path, a commit. */
  evidence: string;
}

export interface FlakeRegister {
  ceiling: number;
  maxQuarantineDays: number;
  entries: QuarantineEntry[];
}

export interface RegisterHealth {
  size: number;
  ceiling: number;
  oldestAgeDays: number | null;
  oldestEntry: string | null;
  expired: string[];
  problems: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CAUSES: readonly string[] = ["test", "harness", "product"];
const FORMS: readonly string[] = ["muted", "skipped"];
/** A team, a rota or a role is not an owner. */
const NOT_A_PERSON = /^(team|the team|platform|devs?|everyone|nobody|unassigned|tbd|n\/?a)$/i;

export const REGISTRY_PATH = join(process.cwd(), "lib/testing/flake/registry.json");

export function loadRegister(path: string = REGISTRY_PATH): FlakeRegister {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<FlakeRegister>;
  return {
    ceiling: typeof raw.ceiling === "number" ? raw.ceiling : 5,
    maxQuarantineDays: typeof raw.maxQuarantineDays === "number" ? raw.maxQuarantineDays : 60,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
}

const days = (from: string, to: Date): number =>
  Math.floor((to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

/**
 * Every rule the register enforces, in one place, returning findings rather than
 * throwing — so the test can assert on them and `registry.test.ts` can prove each
 * rule is capable of firing.
 */
export function inspectRegister(register: FlakeRegister, now: Date = new Date()): RegisterHealth {
  const problems: string[] = [];
  const expired: string[] = [];
  const seen = new Set<string>();

  for (const [i, e] of register.entries.entries()) {
    const at = `entries[${i}]`;
    const id = `${e?.file} :: ${e?.test}`;
    if (!e || typeof e !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }
    if (!e.file) problems.push(`${at}: missing "file"`);
    if (!e.test) problems.push(`${at} (${e.file}): missing "test" — record WHICH test flaked`);
    if (!e.owner) problems.push(`${at} (${id}): missing "owner"`);
    else if (NOT_A_PERSON.test(e.owner.trim()))
      problems.push(`${at} (${id}): owner "${e.owner}" is a team or a placeholder — name a person`);
    if (!ISO_DATE.test(e.entered ?? "")) problems.push(`${at} (${id}): "entered" must be YYYY-MM-DD`);
    if (!ISO_DATE.test(e.expires ?? "")) problems.push(`${at} (${id}): "expires" must be YYYY-MM-DD`);
    if (!CAUSES.includes(e.cause)) problems.push(`${at} (${id}): "cause" must be one of ${CAUSES.join(" | ")}`);
    if (!FORMS.includes(e.form)) problems.push(`${at} (${id}): "form" must be one of ${FORMS.join(" | ")}`);
    if (!e.evidence) problems.push(`${at} (${id}): missing "evidence" — link the failure that put it here`);
    if (e.cause === "product")
      problems.push(
        `${at} (${id}): cause is "product" — a product defect wearing a test's clothing must be ESCALATED, ` +
          `not quarantined. Fix it or record it as a known product bug outside this register.`,
      );
    if (e.file && seen.has(e.file)) problems.push(`${at}: "${e.file}" is quarantined twice`);
    if (e.file) seen.add(e.file);

    if (ISO_DATE.test(e.entered ?? "") && ISO_DATE.test(e.expires ?? "")) {
      const span = days(e.entered, new Date(`${e.expires}T00:00:00Z`));
      if (span <= 0) problems.push(`${at} (${id}): "expires" must be after "entered"`);
      else if (span > register.maxQuarantineDays)
        problems.push(
          `${at} (${id}): quarantined for ${span} days — the ceiling is ${register.maxQuarantineDays}. ` +
            `An expiry far enough away is amnesty with a date on it.`,
        );
      if (days(e.expires, now) > 0) expired.push(`${id} (expired ${e.expires}, owner ${e.owner})`);
    }
  }

  const entered = register.entries.map((e) => e.entered).filter((d) => ISO_DATE.test(d ?? ""));
  const oldest = entered.length ? entered.reduce((a, b) => (a < b ? a : b)) : null;

  if (register.entries.length > register.ceiling)
    problems.push(
      `the register holds ${register.entries.length} entries against a ceiling of ${register.ceiling} — ` +
        `stop the line for the suite rather than absorbing another one.`,
    );

  return {
    size: register.entries.length,
    ceiling: register.ceiling,
    oldestAgeDays: oldest ? days(oldest, now) : null,
    oldestEntry: oldest,
    expired,
    problems,
  };
}

/** The two published figures, with their predicate attached. */
export function publishedFigures(h: RegisterHealth): string {
  return (
    `quarantine register: ${h.size}/${h.ceiling} entries` +
    (h.oldestAgeDays === null
      ? ", none older than any date (empty)"
      : `, oldest entered ${h.oldestEntry} (${h.oldestAgeDays} days ago)`)
  );
}

/** Repo-relative files currently out of the blocking lanes. Read by every config. */
export function quarantinedFiles(path: string = REGISTRY_PATH): string[] {
  try {
    return loadRegister(path).entries.map((e) => e.file).filter(Boolean);
  } catch (err) {
    // A malformed register must not silently empty the quarantine lane; the gate in
    // registry.test.ts reports the parse failure with its message. This warn is the
    // only channel a CONFIG-time failure has — configs load before any test runs.
    console.warn("[flake] the quarantine register did not parse; treating it as empty", err);
    return [];
  }
}
