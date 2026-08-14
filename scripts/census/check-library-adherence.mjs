#!/usr/bin/env node
/**
 * Library adherence — what this repo has decided about the shared knowledge library.
 *
 * WHY THIS EXISTS. A knowledge library that lives in another repo is, from here,
 * either advice nobody reads or a dependency that breaks offline. The design that
 * survives is neither: this repo keeps its OWN enforcement (census rules + its
 * ESLint plugin) and records, per library principle, which of three states it is in:
 *
 *   adopted    — a local rule enforces it. Drift fails `npm run check`.
 *   declined   — reviewed and rejected FOR THIS REPO, with a reason. Never nags again.
 *   unreviewed — nobody has looked. This is the only actionable list, and it is a
 *                REPORT, never a failure. A repo is not broken for having a library
 *                principle it has not yet considered.
 *
 * That three-state split is the whole idea. A two-state model (adopted / not) makes
 * every principle a permanent accusation, which is how advisory tooling gets muted.
 *
 * WHAT FAILS THE BUILD (exit 1) — only structural incoherence, never volume:
 *   - a rule citing a principle id the library does not have (a typo, or a principle
 *     that was renamed upstream — either way the citation is a lie)
 *   - a rule with no `principle` field at all (an ungrounded gate)
 *   - the same principle both adopted and declined
 *   - a decline with no reason, or a reason short enough to be a shrug
 *
 * WHAT ONLY WARNS: unreviewed principles, and a stale vendored index.
 *
 * THE INSTRUMENT IS ASSERTED BEFORE THE RESULT. If the index is empty or the rules
 * file will not parse, this exits 2 rather than reporting a healthy repo. The library
 * home found four of its own gates running green while checking nothing; this one is
 * built not to join them.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, 'library-index.json');
const RULES = resolve(HERE, 'rules.json');
const PROV = resolve(HERE, 'PROVENANCE.json');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// ---------------------------------------------------------------- instrument
for (const [label, p] of [['library-index.json', INDEX], ['rules.json', RULES]]) {
  if (!existsSync(p)) {
    console.error(`FATAL: ${label} is missing. Cannot report adherence against a library it cannot see.`);
    process.exit(2);
  }
}

let index, registry;
try { index = JSON.parse(readFileSync(INDEX, 'utf8')); }
catch (e) { console.error(`FATAL: library-index.json will not parse — ${e.message}`); process.exit(2); }
try { registry = JSON.parse(readFileSync(RULES, 'utf8')); }
catch (e) { console.error(`FATAL: rules.json will not parse — ${e.message}`); process.exit(2); }

const principles = index.principles ?? [];
if (principles.length === 0) {
  console.error('FATAL: the vendored index lists zero principles. THE INDEX IS BROKEN, NOT THE LIBRARY EMPTY.');
  process.exit(2);
}

const known = new Map(principles.map((p) => [p.id, p]));
const rules = registry.rules ?? [];
const declined = registry.declined ?? [];
const satisfied = registry.satisfied ?? [];

// ------------------------------------------------------------------ failures
const failures = [];

const adopted = new Map();
for (const r of rules) {
  if (!r.principle) {
    failures.push(`census rule "${r.id}" declares no \`principle\` — a gate with no grounding in the library`);
    continue;
  }
  if (!known.has(r.principle)) {
    failures.push(
      `census rule "${r.id}" cites principle "${r.principle}", which the library does not have.\n` +
      `      Either it is a typo, or it was renamed upstream. Re-generate library-index.json and re-check.`,
    );
    continue;
  }
  if (!adopted.has(r.principle)) adopted.set(r.principle, []);
  adopted.get(r.principle).push(r.id);
}

// `satisfied` — the principle applies and this repo already meets it. It is the
// state the first two adoption attempts here should have started in: both gates
// were written from the principle before the code was read, and both measured 0
// true positives. A claim of "already fine" is only worth anything if the next
// session can re-run the measurement, so an entry MUST carry the mechanism, the
// evidence, and a command that reproduces it. Without those it is a hunch wearing
// a state name.
const satisfiedIds = new Set();
for (const s of satisfied) {
  if (!s.id) { failures.push('a `satisfied` entry has no id'); continue; }
  if (!known.has(s.id)) {
    failures.push(`satisfied principle "${s.id}" is not in the library index — stale entry, or a rename upstream`);
    continue;
  }
  if (!s.mechanism || s.mechanism.trim().length < 40) {
    failures.push(`satisfied principle "${s.id}" does not name HOW it is satisfied — a regression would be unrecognisable`);
  }
  if (!s.verifiedBy) {
    failures.push(
      `satisfied principle "${s.id}" has no \`verifiedBy\` command. "Already fine" that cannot be re-measured ` +
      `is indistinguishable from "nobody looked".`,
    );
  }
  satisfiedIds.add(s.id);
}

const declinedIds = new Set();
for (const d of declined) {
  if (!d.id) { failures.push('a `declined` entry has no id'); continue; }
  if (!known.has(d.id)) {
    failures.push(`declined principle "${d.id}" is not in the library index — stale decline, or a rename upstream`);
    continue;
  }
  // A decline is a real decision and must read like one. "n/a" is not a reason.
  if (!d.reason || d.reason.trim().length < 25) {
    failures.push(
      `declined principle "${d.id}" has no substantive reason. A decline is a DECISION — ` +
      `the next session must be able to tell whether it still holds.`,
    );
  }
  if (adopted.has(d.id)) failures.push(`principle "${d.id}" is BOTH adopted and declined — pick one`);
  declinedIds.add(d.id);
}

// --------------------------------------------------------------- provenance
let provNote = null;
if (existsSync(PROV)) {
  const prov = JSON.parse(readFileSync(PROV, 'utf8'));
  const drifted = [];
  for (const [rel, rec] of Object.entries(prov.files ?? {})) {
    const local = resolve(HERE, rel);
    if (!existsSync(local)) { drifted.push(`${rel} (missing locally)`); continue; }
    // Compare against `portedSha` — the hash of the local copy AS WRITTEN at port
    // time. That answers the only question checkable offline: has this copy been
    // edited here? An earlier version hashed the UPSTREAM file and tried to strip
    // the ported header back off, which mis-reported three byte-identical fixtures
    // as drifted because they legitimately begin with comment lines. A checker that
    // cries wolf on unchanged files gets muted, so this compares like with like.
    const expected = typeof rec === 'string' ? rec : rec.portedSha;
    // Normalise line endings before hashing. Git checks these files out as CRLF on
    // Windows and LF elsewhere, so a raw hash reports every fresh clone as drifted —
    // the cry-wolf failure this check was explicitly built to avoid. Content is what
    // is being compared, not the bytes a particular checkout happens to produce.
    const body = readFileSync(local, 'utf8').replace(/\r\n/g, '\n');
    const sha = createHash('sha256').update(body).digest('hex').slice(0, 16);
    if (sha !== expected) drifted.push(rel);
  }
  provNote = drifted.length
    ? `engine copy diverges from ${prov.source.repo}@${prov.source.commit}: ${drifted.join(', ')}`
    : `engine copy matches ${prov.source.repo}@${prov.source.commit}`;
}

// ------------------------------------------------------------------- report
for (const id of satisfiedIds) {
  if (adopted.has(id)) failures.push(`principle "${id}" is both adopted and satisfied — if a gate holds it, it is adopted`);
  if (declinedIds.has(id)) failures.push(`principle "${id}" is both satisfied and declined — it cannot both apply and not apply`);
}

const unreviewed = principles.filter(
  (p) => !adopted.has(p.id) && !declinedIds.has(p.id) && !satisfiedIds.has(p.id),
);

console.log(
  `library adherence: ${adopted.size} adopted · ${satisfiedIds.size} satisfied · ${declinedIds.size} declined · ` +
  `${unreviewed.length} unreviewed  ${dim(`(of ${principles.length} written principles @ ${index.source.repo} ${index.source.commit})`)}`,
);
if (satisfiedIds.size && adopted.size === 0) {
  console.log(dim('  no adopted rules — the census is not run. Reviewed principles were met by mechanisms already here.'));
}
if (provNote) console.log(dim(`  ${provNote}`));

if (unreviewed.length) {
  console.log(`\n${yellow('unreviewed')} — a report, not a failure. Highest recurrence first:`);
  for (const p of unreviewed.slice(0, 12)) {
    console.log(`  ${String(p.recurrence).padStart(5)}  ${p.id.padEnd(32)} ${dim(p.domain)}`);
  }
  if (unreviewed.length > 12) console.log(dim(`  … and ${unreviewed.length - 12} more`));
  console.log(dim('  Adopt one by adding a census rule with `principle: "<id>"`, or decline it with a reason.'));
}

if (failures.length) {
  console.error(`\n${red(`adherence FAILED — ${failures.length} problem(s):`)}\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(green('\nadherence OK') + ' — every adopted rule cites a real principle, every decline has a reason.');
