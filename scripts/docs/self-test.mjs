#!/usr/bin/env node
/**
 * Self-test for check-doc-sync.
 *
 * WHY THIS EXISTS
 * ---------------
 * A gate you cannot trust is worse than no gate, and this one is a reply to a
 * measured disaster. A doc-sync enforcement in a sibling project ran for fifteen
 * months, exited 0 every time, and was believed. When somebody finally replayed
 * 100 real sessions through it, it had seen 0 of 2,367 edits — and its own suite
 * of thirty assertions had been green the whole time, because every fixture was
 * built as a theory of the input rather than checked against one. The fixtures
 * certified a world that did not exist.
 *
 * So this file refuses the two habits that produced that:
 *
 *   1. IT SEEDS REAL VIOLATIONS INTO A REAL GIT REPOSITORY. Not a synthetic
 *      diff object, not a stubbed `readChangedPaths`. A scratch repo is built
 *      under the OS temp dir, files are edited and committed with actual `git`,
 *      and the checker reads that history the same way it will read this one.
 *      This repository's git state is never touched.
 *
 *   2. THE HEADLINE CASES RUN THROUGH THE REAL COMMAND LINE. `node
 *      scripts/docs/check-doc-sync.mjs --range …` as a child process, asserting
 *      the process exit code and the text a human would read. A hand-run of an
 *      internal function proves the function works and says nothing about
 *      whether the gate can fire — "has never fired" and "cannot fire" are
 *      indistinguishable from outside, and only the real invocation path
 *      separates them.
 *
 * WHAT IT REFUSES TO LET SLIDE. Each of these is a way this checker could go
 * quietly useless, and each has a test below that fails when it does:
 *
 *   - a seeded violation stops being reported          (tests 15, 24)
 *   - satisfaction starts accepting any file under docs/ instead of the named
 *     document — the failure that was 54.3% of satisfactions upstream (test 17)
 *   - a dismissal stops being counted, or a shrug starts counting  (18, 19, 20)
 *   - "I could not look" starts exiting 0             (5, 6, 7, 8, 9, 23)
 *   - a skip loses its reason class, or the class stops being printed (5, 6, 11, 27)
 *   - the informational block starts failing the build (12)
 *   - the skipped figure stops printing at zero        (29)
 *
 * No test framework — same posture as `scripts/census/self-test.mjs`, and the
 * same reason: the gate must be runnable from a bare `node`.
 *
 *   node scripts/docs/self-test.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXIT, SKIP, checkDocSync, globToRegExp, parseDismissals, renderReport } from './check-doc-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = resolve(HERE, 'check-doc-sync.mjs');

// ---------------------------------------------------------------- harness ---
const tests = [];
let passed = 0;
const failures = [];
const scratches = [];
const test = (name, fn) => tests.push([name, fn]);

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}
function ok(cond, what) {
  if (!cond) throw new Error(`expected truthy: ${what}`);
}
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

// ------------------------------------------------------------ scratch repo ---
/**
 * A real git repository in the OS temp dir. Isolated from the machine's git
 * configuration (`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` are pointed at a file
 * that does not exist) so a developer's global hooksPath, template dir or
 * autocrlf setting cannot change what this test proves — the portability half
 * of gate liveness, applied to the test itself.
 */
function gitEnv(dir) {
  const nowhere = join(dir, '.no-such-gitconfig');
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: nowhere,
    GIT_CONFIG_SYSTEM: nowhere,
    GIT_AUTHOR_NAME: 'doc-sync self-test',
    GIT_AUTHOR_EMAIL: 'self-test@example.invalid',
    GIT_COMMITTER_NAME: 'doc-sync self-test',
    GIT_COMMITTER_EMAIL: 'self-test@example.invalid',
  };
}
function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv(dir), stdio: ['ignore', 'pipe', 'pipe'] });
}
function write(dir, rel, body) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

const defaultMap = () => ({
  _comment:
    'Fixture coupling map. Globs are scoped to the contexts in context-map.json (2 contexts / 2 groups). ' +
    'Deliberately NOT listed: dated append-only notes under docs/history/.',
  unmappedByDesign: [
    { glob: 'docs/history/**', reason: 'dated append-only fixture notes that must never be retro-edited' },
  ],
  entries: [
    { doc: 'docs/alpha.md', sourceGlobs: ['features/alpha/**'] },
    { doc: 'docs/beta.md', sourceGlobs: ['features/beta/**'] },
  ],
});

const defaultContextMap = () => ({
  contexts: [
    { business_feature: 'Alpha', file_paths: ['features/alpha/index.ts', 'features/alpha/util.ts'] },
    { business_feature: 'Beta', file_paths: ['features/beta/index.ts'] },
  ],
  groups: [{ name: 'g1' }, { name: 'g2' }],
});

/** Build the scratch tree and make it a git repo with one seed commit. */
function seed({ map = defaultMap(), contextMap = defaultContextMap(), extra = {}, noGit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'docsync-'));
  scratches.push(dir);
  write(dir, 'README.md', '# fixture\n');
  write(dir, 'features/alpha/index.ts', 'export const alpha = 1;\n');
  write(dir, 'features/alpha/util.ts', 'export const alphaUtil = 1;\n');
  write(dir, 'features/beta/index.ts', 'export const beta = 1;\n');
  write(dir, 'docs/alpha.md', '# alpha\n');
  write(dir, 'docs/beta.md', '# beta\n');
  write(dir, 'docs/history/2026-01-01-note.md', '# a dated note\n');
  if (map !== null) write(dir, 'docs/feature-doc-map.json', JSON.stringify(map, null, 2) + '\n');
  if (contextMap !== null) write(dir, 'context-map.json', JSON.stringify(contextMap, null, 2) + '\n');
  for (const [rel, body] of Object.entries(extra)) write(dir, rel, body);
  if (!noGit) {
    git(dir, 'init', '-q');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'seed');
  }
  return dir;
}

/** Commit a set of file writes/deletes with a message. Returns the message. */
function commit(dir, changes, message) {
  for (const [rel, body] of Object.entries(changes)) {
    if (body === null) git(dir, 'rm', '-q', rel);
    else write(dir, rel, body);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
  return message;
}

/** Run the checker THROUGH ITS REAL COMMAND LINE, as a separate process. */
function runCli(dir, args = []) {
  const r = spawnSync(process.execPath, [CHECKER, '--root', dir, '--floor', '1', ...args], {
    encoding: 'utf8',
    cwd: dir,
    env: gitEnv(dir),
  });
  return { code: r.status, out: strip((r.stdout ?? '') + (r.stderr ?? '')) };
}

const check = (dir, over = {}) => checkDocSync({ root: dir, floor: 1, ...over });

// ============================================================ 1. STRUCTURAL ===

test('01 a clean map over a clean tree is green, and says what it measured over', () => {
  const dir = seed();
  const r = check(dir);
  eq(r.exitCode, EXIT.PASS, 'exit code');
  eq(r.blocks.integrity.considered, 2, 'entries considered');
  eq(r.blocks.integrity.checked, 2, 'entries checked');
  eq(r.blocks.integrity.drifted, 0, 'entries drifted');
  eq(r.blocks.integrity.skipped, 0, 'entries skipped');
  eq(r.blocks.claim.checked, 1, 'the derived claim was checked');
});

test('02 an entry whose coupled doc no longer exists is drift, not silence', () => {
  const dir = seed();
  commit(dir, { 'docs/alpha.md': null }, 'delete the coupled doc');
  const r = check(dir);
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  eq(r.blocks.integrity.drifted, 1, 'drifted entries');
  ok(
    r.blocks.integrity.findings.some((f) => /docs\/alpha\.md" does not exist/.test(f.message)),
    'the finding names the missing document',
  );
});

test('03 a sourceGlob that matches nothing is a dead coupling and fails', () => {
  const map = defaultMap();
  map.entries[0].sourceGlobs.push('features/alpha/aFileNobodyEverWrote.ts');
  const dir = seed({ map });
  const r = check(dir);
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  ok(
    r.blocks.integrity.findings.some((f) => /matches no file in the tree/.test(f.message)),
    'the finding says the glob matches nothing',
  );
});

test('04 REAL BUG CLASS: a derived count in the header that no longer reproduces', () => {
  // This is the exact defect that shipped here: the map's own header said
  // "25 contexts / 9 groups" while context-map.json held 48 and 10, and nothing
  // looked. The claim states its predicate, so the predicate is re-run.
  const map = defaultMap();
  map._comment = map._comment.replace('2 contexts / 2 groups', '25 contexts / 9 groups');
  const dir = seed({ map });
  const r = check(dir);
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  eq(r.blocks.claim.drifted, 1, 'the claim drifted');
  eq(r.blocks.claim.stated, { contexts: 25, groups: 9 }, 'stated');
  eq(r.blocks.claim.actual, { contexts: 2, groups: 2 }, 'recomputed');
});

test('05 a header that dropped its claim is SKIPPED record-incomplete, and exits 2', () => {
  // A claim that no longer carries its predicate has silently stopped being
  // checkable. Folding that into "agrees" would be the whole lie in miniature.
  const map = defaultMap();
  map._comment = 'A header with no numbers in it at all.';
  const dir = seed({ map });
  const r = check(dir);
  eq(r.blocks.claim.checked, 0, 'nothing checked');
  eq(r.blocks.claim.skippedByClass[SKIP.INCOMPLETE], 1, 'record-incomplete skip');
  eq(r.exitCode, EXIT.COULD_NOT_RUN, 'an empty denominator is exit 2, never 0');
});

test('06 an absent context-map.json is SKIPPED precondition-absent, and exits 2', () => {
  const dir = seed({ contextMap: null });
  const r = check(dir);
  eq(r.blocks.claim.skippedByClass[SKIP.PRECONDITION], 1, 'precondition-absent skip');
  eq(r.blocks.claim.checked, 0, 'nothing checked');
  eq(r.exitCode, EXIT.COULD_NOT_RUN, 'could not look != clean');
});

test('07 a map declaring zero entries fails loudly instead of passing', () => {
  const map = defaultMap();
  map.entries = [];
  const dir = seed({ map });
  const r = check(dir);
  eq(r.exitCode, EXIT.COULD_NOT_RUN, 'exit code');
  ok(r.fatal.some((f) => /checked nothing at all/.test(f)), 'it says so out loud');
});

test('08 an absent map is could-not-run, not a repository with no couplings', () => {
  const dir = seed({ map: null });
  const r = check(dir);
  eq(r.exitCode, EXIT.COULD_NOT_RUN, 'exit code');
  ok(r.fatal.some((f) => /not at docs\/feature-doc-map\.json/.test(f)), 'the fatal names the missing map');
});

test('09 a walk below its floor is the broken instrument, not the empty tree', () => {
  const dir = seed();
  const r = check(dir, { floor: 10000 });
  eq(r.exitCode, EXIT.COULD_NOT_RUN, 'exit code');
  ok(r.fatal.some((f) => /THE WALK IS BROKEN, NOT THE TREE EMPTY/.test(f)), 'the fatal names the real cause');
});

test('10 a stale declared exclusion is drift — an exemption pointing at nothing', () => {
  const map = defaultMap();
  map.unmappedByDesign.push({ glob: 'docs/moved-away/**', reason: 'a class of notes that has since been deleted' });
  const dir = seed({ map });
  const r = check(dir);
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  eq(r.blocks.exclusions.drifted, 1, 'one stale exclusion');
  ok(r.blocks.exclusions.findings.some((f) => /stale/.test(f.message)), 'the finding says stale');
});

test('11 an exclusion with a shrug for a reason is skipped, not honoured', () => {
  const map = defaultMap();
  map.unmappedByDesign.push({ glob: 'docs/history/**', reason: 'legacy' });
  const dir = seed({ map });
  const r = check(dir);
  eq(r.blocks.exclusions.checked, 1, 'only the well-formed exclusion was checked');
  eq(r.blocks.exclusions.skippedByClass[SKIP.INCOMPLETE], 1, 'the shrug was skipped as incomplete');
});

test('12 the coverage block reports gaps on both sides and CANNOT fail the build', () => {
  const map = defaultMap();
  map.entries = [map.entries[0]]; // beta is now reached by nothing
  const dir = seed({ map });
  const r = check(dir);
  eq(r.blocks.coverage.blocking, false, 'coverage is informational');
  eq(r.blocks.coverage.source.unmapped, ['Beta'], 'the unmapped context is named');
  ok(r.blocks.coverage.docs.uncoupled.includes('docs/beta.md'), 'the uncoupled doc is named');
  eq(r.exitCode, EXIT.PASS, 'an informational gap does not fail the build');
});

test('13 a doc covered by a declared exclusion is not reported as a coverage gap', () => {
  const dir = seed();
  const r = check(dir);
  ok(!r.blocks.coverage.docs.uncoupled.includes('docs/history/2026-01-01-note.md'), 'the dated note is not a gap');
  eq(r.blocks.coverage.docs.excludedByDesign, 1, 'it is counted as excluded by design');
});

test('14 an incomplete entry is skipped with a class, never counted as clean', () => {
  const map = defaultMap();
  map.entries.push({ doc: 'docs/gamma.md' }); // no sourceGlobs
  const dir = seed({ map });
  const r = check(dir);
  eq(r.blocks.integrity.considered, 3, 'considered');
  eq(r.blocks.integrity.checked, 2, 'checked');
  eq(r.blocks.integrity.skippedByClass[SKIP.INCOMPLETE], 1, 'record-incomplete');
});

// =========================================================== 2. SAME-CHANGE ===

test('15 NON-VACUITY: a seeded violation fires through the REAL command line', () => {
  // The whole file exists for this test. Mapped source is edited; the coupled
  // doc is not; the checker is invoked exactly as the hook and CI invoke it,
  // as a child process, and the assertion is on the PROCESS exit code and the
  // text a human reads. Nothing internal is called by hand.
  const dir = seed();
  commit(dir, { 'features/alpha/index.ts': 'export const alpha = 2;\n' }, 'feat(alpha): change mapped source only');
  const r = runCli(dir, ['--range', 'HEAD~1..HEAD']);
  eq(r.code, EXIT.DRIFT, 'the real CLI exits 1 on a seeded violation');
  ok(/DRIFT docs\/alpha\.md/.test(r.out), 'the named doc appears in the report');
  ok(/did not touch "docs\/alpha\.md"/.test(r.out), 'the message states what was not touched');
  ok(/Doc-sync\(docs\/alpha\.md\):/.test(r.out), 'the report offers the dismissal protocol');
});

test('16 a change that updates the named doc in the SAME commit passes and is counted', () => {
  const dir = seed();
  commit(
    dir,
    { 'features/alpha/index.ts': 'export const alpha = 2;\n', 'docs/alpha.md': '# alpha\n\nnow documented\n' },
    'feat(alpha): source and its coupled doc together',
  );
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.PASS, 'exit code');
  eq(r.blocks.sameChange.owed, 1, 'one entry owed');
  eq(r.blocks.sameChange.satisfied, 1, 'satisfied on the named doc');
  eq(r.blocks.sameChange.drifted, 0, 'nothing drifted');
});

test('17 THE 54.3% TEST: touching a DIFFERENT doc under docs/ does not satisfy', () => {
  // Upstream, satisfaction was checked as "some file under the docs prefix
  // changed". Over 761 real commits, 54.3% of the satisfactions that produced
  // were the wrong document. Satisfaction here is on the named target or it is
  // not satisfaction.
  const dir = seed();
  commit(
    dir,
    { 'features/alpha/index.ts': 'export const alpha = 2;\n', 'docs/beta.md': '# beta\n\nunrelated edit\n' },
    'feat(alpha): source, plus an unrelated doc under docs/',
  );
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.DRIFT, 'a neighbouring doc does not discharge the obligation');
  eq(r.blocks.sameChange.satisfied, 0, 'nothing satisfied');
  eq(r.blocks.sameChange.drifted, 1, 'the alpha coupling still drifts');
});

test('18 a dismissal trailer with a real reason passes AND is counted as dismissed', () => {
  const dir = seed();
  commit(
    dir,
    { 'features/alpha/index.ts': 'export const alpha = 2;\n' },
    'refactor(alpha): rename a local\n\nDoc-sync: internal-only rename, no user-visible surface moved',
  );
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.PASS, 'exit code');
  eq(r.blocks.sameChange.dismissed, 1, 'the dismissal is counted, not merely obeyed');
  eq(r.blocks.sameChange.drifted, 0, 'nothing drifted');
  ok(
    r.blocks.sameChange.findings.some((f) => f.dismissed && /internal-only rename/.test(f.message)),
    'the recorded reason travels with the count',
  );
});

test('19 a SCOPED dismissal discharges one named doc and leaves the others owed', () => {
  const dir = seed();
  commit(
    dir,
    { 'features/alpha/index.ts': 'export const alpha = 2;\n', 'features/beta/index.ts': 'export const beta = 2;\n' },
    'chore: touch both areas\n\nDoc-sync(docs/alpha.md): alpha changed internally only, its route is unchanged',
  );
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.blocks.sameChange.dismissed, 1, 'exactly one dismissed');
  eq(r.blocks.sameChange.drifted, 1, 'beta is still owed');
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  ok(r.blocks.sameChange.findings.some((f) => f.entry === 'docs/beta.md' && !f.dismissed), 'beta is the one that drifts');
});

test('20 a shrug is not a dismissal — a too-short reason fails', () => {
  const dir = seed();
  commit(dir, { 'features/alpha/index.ts': 'export const alpha = 2;\n' }, 'chore: x\n\nDoc-sync: n/a');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
  ok(r.blocks.sameChange.findings.some((f) => /shorter than 12 characters/.test(f.message)), 'the shrug is named');
  eq(r.blocks.sameChange.dismissed, 0, 'and it dismissed nothing');
});

test('21 a dismissal aimed at a doc this change never owed is a note, not a pass or a failure', () => {
  const dir = seed();
  commit(
    dir,
    { 'README.md': '# fixture\n\nunmapped edit\n' },
    'docs: touch nothing mapped\n\nDoc-sync(docs/alpha.md): pasted out of habit, nothing here is coupled',
  );
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.PASS, 'exit code');
  ok(
    r.blocks.sameChange.findings.some((f) => f.informational && /did not owe/.test(f.message)),
    'the pasted trailer is disclosed',
  );
});

test('22 EMPTY OWED SET: a change touching no mapped source is checked, not skipped', () => {
  // The denominator is entries CONSIDERED, not entries owed. All entries were
  // evaluated against the diff and found not-owed; that is a verdict, so the
  // run is honestly green and says what it measured over.
  const dir = seed();
  commit(dir, { 'README.md': '# fixture\n\nunmapped edit\n' }, 'docs: an unmapped file');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.exitCode, EXIT.PASS, 'exit code');
  eq(r.blocks.sameChange.owed, 0, 'nothing owed');
  eq(r.blocks.sameChange.checked, 2, 'both entries were still evaluated');
  eq(r.blocks.sameChange.skipped, 0, 'and none was skipped');
});

test('23 a range git cannot resolve is instrument-absent and exits 2, never 0', () => {
  const dir = seed();
  const r = runCli(dir, ['--range', 'no-such-ref..HEAD']);
  eq(r.code, EXIT.COULD_NOT_RUN, 'exit code');
  ok(/INSTRUMENT failure, not a clean repository/.test(r.out), 'it names itself as an instrument failure');
  ok(/instrument-absent 2/.test(r.out) || /instrument-absent \d+/.test(r.out), 'the skip class is counted');
});

test('24 NON-VACUITY, staged path: the commit-msg invocation fires on a staged violation', () => {
  // The rung wired into lefthook is `--staged --message-file {1}`. This is that
  // exact command line, with a real staged set and a real message file.
  const dir = seed();
  write(dir, 'features/alpha/index.ts', 'export const alpha = 3;\n');
  git(dir, 'add', 'features/alpha/index.ts');
  write(dir, 'MSG.txt', 'feat(alpha): staged mapped source\n# a comment line git would strip\n');
  const r = runCli(dir, ['--staged', '--message-file', join(dir, 'MSG.txt')]);
  eq(r.code, EXIT.DRIFT, 'the staged violation is caught');
  ok(/DRIFT docs\/alpha\.md/.test(r.out), 'the named doc appears');

  // ...and the same staged set with a dismissal in the message passes.
  write(dir, 'MSG.txt', 'feat(alpha): staged mapped source\n\nDoc-sync: internal-only, no surface moved\n');
  const r2 = runCli(dir, ['--staged', '--message-file', join(dir, 'MSG.txt')]);
  eq(r2.code, EXIT.PASS, 'the dismissal discharges it');
  ok(/dismissed docs\/alpha\.md/.test(r2.out), 'and the dismissal is printed');
});

test('25 a RENAME out of a mapped area owes the doc — the diff knows both sides', () => {
  // A transcript of editor destinations knows only the new path, so a file
  // moved OUT of a mapped area disappears from it entirely. `git diff -M`
  // reports both sides, and both are treated as changes to that area.
  const dir = seed();
  git(dir, 'mv', 'features/alpha/util.ts', 'features/gamma-util.ts');
  git(dir, 'commit', '-q', '-m', 'refactor: move a file out of the alpha area');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.blocks.sameChange.owed, 1, 'the doc for the area it LEFT is owed');
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
});

test('26 a DELETION inside a mapped area owes the doc', () => {
  const dir = seed();
  commit(dir, { 'features/alpha/util.ts': null }, 'chore: delete mapped source');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.blocks.sameChange.owed, 1, 'a deletion is a change to the area');
  eq(r.exitCode, EXIT.DRIFT, 'exit code');
});

test('27 an owed entry whose doc does not exist is SKIPPED unresolvable, not satisfied', () => {
  // The class the technique calls the most urgent: it looks like coverage and
  // behaves like a hole. It must never land in "checked and clean".
  const dir = seed();
  commit(dir, { 'docs/alpha.md': null }, 'chore: remove the doc');
  commit(dir, { 'features/alpha/index.ts': 'export const alpha = 9;\n' }, 'feat(alpha): edit the orphaned area');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.blocks.sameChange.skippedByClass[SKIP.UNRESOLVABLE], 1, 'unresolvable skip');
  eq(r.blocks.sameChange.satisfied, 0, 'nothing was called satisfied');
  eq(r.blocks.sameChange.owed, 0, 'and it was not counted as an evaluated obligation');
});

test('28 --json puts the denominators inside the same object as the findings', () => {
  // A findings list beside a separate availability flag has technically
  // disclosed the skip, and every consumer that reads the list and not the flag
  // is wrong. No consumer can reach a numerator here without the population.
  const dir = seed();
  commit(dir, { 'features/alpha/index.ts': 'export const alpha = 4;\n' }, 'feat(alpha): mapped source only');
  const r = runCli(dir, ['--range', 'HEAD~1..HEAD', '--json']);
  eq(r.code, EXIT.DRIFT, 'exit code');
  const parsed = JSON.parse(r.out);
  for (const [id, b] of Object.entries(parsed.blocks)) {
    for (const key of ['considered', 'checked', 'drifted', 'skipped', 'skippedByClass', 'findings']) {
      ok(key in b, `block ${id} carries "${key}" alongside its findings`);
    }
    ok('blocking' in b, `block ${id} states whether it can fail the build`);
  }
  eq(parsed.blocks.sameChange.drifted, 1, 'the numerator is there too');
});

test('29 the rendered headline prints the skipped figure and every class AT ZERO', () => {
  // A report that mentions skips only when there are some teaches its readers
  // that silence means "the tool did not bring it up".
  const dir = seed();
  const out = strip(renderReport(check(dir)));
  ok(/0 drifted of \d+ checked, 0 skipped/.test(out), 'the fraction carries its bounds');
  for (const cls of Object.values(SKIP)) ok(new RegExp(`${cls} 0`).test(out), `skip class "${cls}" prints at zero`);
  ok(/\[BLOCKING\]/.test(out) && /informational — cannot fail the build/.test(out), 'each signal states its own status');
});

test('30 an entry never triggers itself: editing only the coupled doc owes nothing', () => {
  const map = defaultMap();
  map.entries[0].sourceGlobs.push('docs/alpha.md'); // the DESIGN.md mirror shape
  const dir = seed({ map });
  commit(dir, { 'docs/alpha.md': '# alpha\n\nedited\n' }, 'docs: edit the coupled doc alone');
  const r = check(dir, { mode: 'range', range: 'HEAD~1..HEAD' });
  eq(r.blocks.sameChange.owed, 0, 'editing the doc does not oblige editing the doc');
  eq(r.exitCode, EXIT.PASS, 'exit code');
});

// ============================================================= 3. UNIT BITS ===

test('31 globToRegExp handles the shapes the real map actually uses', () => {
  ok(globToRegExp('app/**').test('app/graf/page.tsx'), 'dir wildcard');
  ok(!globToRegExp('app/**').test('features/graph/page.tsx'), 'dir wildcard is anchored');
  ok(globToRegExp('features/**/get*Data.ts').test('features/civicscore/getLeaderboardData.ts'), 'nested + partial');
  ok(!globToRegExp('features/**/get*Data.ts').test('features/civicscore/getLeaderboard.ts'), 'partial is precise');
  ok(globToRegExp('scripts/data-analysis/kg-*.ts').test('scripts/data-analysis/kg-compute.ts'), 'prefix wildcard');
  ok(!globToRegExp('scripts/data-analysis/kg-*.ts').test('scripts/data-analysis/nested/kg-x.ts'), '* stops at /');
  ok(globToRegExp('.env.example').test('.env.example'), 'exact dotfile');
  ok(!globToRegExp('.env.example').test('.env.example.bak'), 'exact is anchored');
  ok(globToRegExp('.github/workflows/ci.yml').test('.github/workflows/ci.yml'), 'the dot-directory the walk allows');
});

test('32 dismissal trailers parse in both forms and ignore prose that merely mentions them', () => {
  const d = parseDismissals([
    'feat: x\n\nDoc-sync: a perfectly good reason here\nDoc-sync(docs/a.md): another good reason here',
  ]);
  eq(d.length, 2, 'two trailers');
  eq(d[0].doc, null, 'unscoped');
  eq(d[1].doc, 'docs/a.md', 'scoped');
  eq(parseDismissals(['a sentence about Doc-sync in the middle of a line']).length, 0, 'mid-line prose is not a trailer');
});

// ------------------------------------------------------------------- run ---
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}
for (const dir of scratches) rmSync(dir, { recursive: true, force: true });

console.log(`\ndoc-sync self-test: ${passed}/${tests.length} passed`);
if (failures.length > 0) {
  console.error(
    `\n${failures.length} failure(s). Tests 15 and 24 are the non-vacuity probes: if either goes red or, worse, ` +
      `starts passing for the wrong reason, treat every green doc-sync run as untrustworthy until it is fixed.`,
  );
  process.exit(1);
}
process.exit(0);
