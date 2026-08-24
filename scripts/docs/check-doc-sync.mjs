#!/usr/bin/env node
/**
 * check-doc-sync — the gate that reads `docs/feature-doc-map.json`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The coupling map has been good for months and enforced by nothing. CLAUDE.md's
 * definition of done says "docs coupled to the touched source are updated in the
 * same change"; AGENTS.md points at the map; `.ai/manifest.yaml` publishes it as
 * a capability. No code read it. A convention that only a conscientious author
 * honours is not a control — it is a hope with a JSON file attached, and the
 * 2026-08-24 registry audit named it a deviation on three separate techniques.
 *
 * This checker is written against the autopsy of one that failed. A doc-sync
 * enforcement in a sibling project ran for fifteen months and fired zero times:
 * it read the change from an agent-session TRANSCRIPT rather than from version
 * control, and its boundary predicate matched the shape of a tool result, so the
 * backward walk stopped before it ever reached an edit — 0 of 2,367 real edits
 * seen, across 100 replayed sessions. Its own 30-assertion test suite was green
 * throughout, over fixtures that contained none of the events production emits.
 * Four refusals follow directly from that, and they are the shape of this file:
 *
 *   1. IT REFUSES TO READ A TRANSCRIPT. The only record of change it accepts is
 *      the version-control diff — `--staged` or `--range` — which is also the
 *      only record that knows renames on both sides, deletions, and files that
 *      left a mapped area. There is no editor-event mode and there will not be.
 *
 *   2. IT REFUSES PREFIX-SHAPED SATISFACTION. An entry names one document; only
 *      a change to THAT path satisfies it. Accepting "some file under docs/"
 *      was measured in the same autopsy over 761 real commits: 54.3% of the
 *      satisfactions were the wrong document. A coupling that can be discharged
 *      by accident is not a coupling.
 *
 *   3. IT REFUSES TWO-STATE ARITHMETIC. Every unit resolves to checked,
 *      drifted (a strict subset of checked) or skipped — and every skip carries
 *      a REASON CLASS: precondition-absent, instrument-absent, record-incomplete,
 *      unresolvable. Unresolvable is printed first among them because it is the
 *      class that looks like coverage and behaves like a hole. The headline is
 *      always a fraction with its bounds, and the skipped figure prints at zero,
 *      so silence can never be read as "the tool did not bring it up".
 *
 *   4. IT REFUSES TO BE GREEN WHEN IT COULD NOT LOOK. See THE EXIT CODE below.
 *
 * WHAT IT CHECKS, AND WHICH SIGNALS CAN ACTUALLY FAIL THE BUILD
 * -------------------------------------------------------------
 * Every block below states its own enforcement status in its own output, because
 * from the outside an enforced signal and a decorative one look identical, and a
 * reader who cannot tell infers protection that does not exist.
 *
 *   A. map integrity          BLOCKING  — per entry: does the named doc still
 *                                         exist, and does every sourceGlob still
 *                                         match at least one real path?
 *   B. derived-claim rot      BLOCKING  — the map's `_comment` states "N contexts
 *                                         / M groups". That is a claim with a
 *                                         stated predicate, so the predicate is
 *                                         re-run against context-map.json and the
 *                                         two are compared. (It was wrong: the
 *                                         header said 25/9 against a real 48/10.)
 *   C. declared exclusions    BLOCKING  — the dated, append-only artifact classes
 *                                         the map deliberately does NOT couple
 *                                         must each still match something. A
 *                                         stale exemption is where obligations go
 *                                         to hide.
 *   D. coverage, both sides   informational — contexts of `context-map.json` that
 *                                         no entry's globs reach, and documents
 *                                         that are no entry's `doc` and no
 *                                         declared exclusion's. These are
 *                                         CANDIDATE couplings; which of them
 *                                         deserves one is a human judgment, and a
 *                                         gate that failed here would be a
 *                                         machine ordering a person to invent a
 *                                         coupling. It reports, it never refuses.
 *   E. same-change            BLOCKING (only when a diff is supplied) — of the
 *                                         entries this change owed, which coupled
 *                                         docs did it not touch.
 *
 * THE DISMISSAL PROTOCOL
 * ----------------------
 * Internal-only changes — refactors, bug fixes with no behaviour shift — owe no
 * documentation, and an enforcement without a first-class dismissal gets muted
 * instead of obeyed. So a commit message may carry a trailer:
 *
 *   Doc-sync: internal-only refactor, no user-visible surface moved
 *   Doc-sync(docs/routes/graf.md): the edge cull is internal, the route is unchanged
 *
 * The unscoped form dismisses every entry this change owes; the scoped form
 * dismisses one named doc and leaves the rest owed. A reason shorter than 12
 * characters is refused — a shrug is not a dismissal. The trailer is the durable
 * carrier ON PURPOSE: the same autopsy could not report a dismissal RATE at all,
 * because the nag wrote to a stream and the reply was prose in a transcript. A
 * dismissal recorded nowhere cannot be counted, improved or argued about. In a
 * commit message it is in the history forever, and this checker counts it.
 *
 * THE EXIT CODE FOLLOWS THE DENOMINATOR
 * -------------------------------------
 * Of the two honest resolutions, this checker takes the first — FAIL ON AN EMPTY
 * DENOMINATOR — for every blocking block, because a documentation gate whose
 * value is "it cannot be skipped quietly" is worthless the first time it can be.
 *
 *   exit 0  every unit was checked and nothing drifted
 *   exit 1  drift: a real finding, in a block that blocks
 *   exit 2  COULD NOT RUN: the map will not parse, it declares no entries,
 *           context-map.json is absent, git is absent, the range does not
 *           resolve, or the tree walk came back below its floor. Never 0.
 *
 * One clarification that decides a lot of behaviour: the denominator of the
 * same-change block is ENTRIES CONSIDERED, not entries owed. A change that
 * touched no mapped source has not produced an empty denominator — all 34
 * entries were evaluated against the diff and 34 were found not-owed. That run
 * prints "0 drifted of 34 checked, 0 skipped (0 of 34 entries owed by this
 * change)" and exits 0, and the sentence is true. The genuinely empty
 * denominator — no entries, no diff, no git — is the exit-2 case above.
 *
 * PROVING IT FIRES
 * ----------------
 * "Has never fired" and "cannot fire" are indistinguishable from outside.
 * `node scripts/docs/self-test.mjs` seeds a real violation into a scratch git
 * repository under the OS temp dir — mapped source edited, coupled doc untouched
 * — and runs THIS FILE as a child process through its real command line, then
 * asserts the exit code and the named document in the output. It also seeds the
 * satisfied case, the wrong-document case, the dismissed case, an unresolvable
 * doc, a glob that matches nothing, a stale exclusion and an empty denominator.
 * It never touches this repository's git state.
 *
 * USAGE
 * -----
 *   node scripts/docs/check-doc-sync.mjs                       # structural only
 *   node scripts/docs/check-doc-sync.mjs --staged --message-file .git/COMMIT_EDITMSG
 *   node scripts/docs/check-doc-sync.mjs --range origin/master..HEAD
 *   node scripts/docs/check-doc-sync.mjs --json
 *   node scripts/docs/check-doc-sync.mjs --update-comment      # re-derive B's numbers
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// Resolved from THIS FILE's location, never from the current working directory.
// A checker that finds its root via cwd walks an empty tree the moment anything
// invokes it from elsewhere, and — absent the floor assertion below — reports
// that empty tree as a clean repository.
const REPO_ROOT = resolve(HERE, '..', '..');

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Exit codes, named so nothing folds could-not-run into pass by accident. */
export const EXIT = { PASS: 0, DRIFT: 1, COULD_NOT_RUN: 2 };

/**
 * The four skip classes. They are separate counters and not one number because
 * each is fixed by a different person: an operator fetches a missing checkout,
 * a build image installs a missing tool, an author fills in an incomplete
 * record, and somebody repairs a declaration pointing at nothing. A single
 * `skipped: 3` with one hard-coded explanation states a cause confidently and is
 * wrong two times in three.
 */
export const SKIP = {
  PRECONDITION: 'precondition-absent',
  INSTRUMENT: 'instrument-absent',
  INCOMPLETE: 'record-incomplete',
  UNRESOLVABLE: 'unresolvable',
};

const SKIP_ORDER = [SKIP.UNRESOLVABLE, SKIP.PRECONDITION, SKIP.INSTRUMENT, SKIP.INCOMPLETE];

// ------------------------------------------------------------------ globbing --
/**
 * Convert a map `sourceGlob` into an anchored RegExp over posix-relative paths.
 * Supported, and no more: exact paths, `dir/` prefixes, `**`, `**​/` and `*`.
 *
 * `scripts/census/lib/engine.mjs` carries a near-twin of this function, and this
 * file deliberately does NOT import it. That engine is a verbatim port from
 * personas whose header forbids local edits and whose semantics are meant to be
 * fixed upstream and re-ported; binding a locally-authored gate to a copy this
 * repo may not change would mean a future re-port could silently move what this
 * gate matches. Forty lines of duplication is the cheaper of the two prices, and
 * this one is testable here.
 */
export function globToRegExp(pattern) {
  if (pattern.endsWith('/')) return new RegExp('^' + escapeRe(pattern));
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('**/', i)) {
      out += '(?:[^/]*/)*';
      i += 3;
    } else if (pattern.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
    } else {
      out += escapeRe(pattern[i]);
      i += 1;
    }
  }
  return new RegExp('^' + out + '$');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Directories the walk never enters. `.github` is walked on purpose — the map
 * couples `.github/workflows/ci.yml` to the deploy guide — so a blanket
 * "skip anything starting with a dot" would have made that entry unresolvable
 * and the deploy coupling unenforceable, silently.
 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'target', 'out']);
const DOT_DIR_ALLOW = new Set(['.github', '.ai', '.claude']);

/** Walk the tree once into posix-relative paths. Returns paths + what it refused. */
export function walkRepo(root) {
  const files = [];
  const skippedDirs = [];
  const visit = (abs) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      // Unreadable directory: disclosed as a not-enumerated population rather
      // than silently shrinking the denominator.
      skippedDirs.push(relative(root, abs).split(sep).join('/') || '.');
      return;
    }
    for (const e of entries) {
      const full = join(abs, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || (e.name.startsWith('.') && !DOT_DIR_ALLOW.has(e.name))) continue;
        visit(full);
      } else if (e.isFile()) {
        files.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  visit(root);
  return { files, skippedDirs };
}

// -------------------------------------------------------------- diff sources --
/**
 * The change record. VERSION CONTROL ONLY.
 *
 * `-M` is not decoration: a rename is two facts (the old path left a mapped
 * area, the new path entered one) and both are returned, because the coupled
 * doc is owed by either. A list of editor destinations knows neither.
 */
export function readChangedPaths(mode, range, root) {
  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-status', '-M', '--no-color']
      : ['diff', '--name-status', '-M', '--no-color', range];
  let raw;
  try {
    raw = execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    return {
      ok: false,
      paths: [],
      reason:
        `could not read the change from git (${mode === 'staged' ? 'staged set' : `range "${range}"`}). ` +
        `This is an INSTRUMENT failure, not a clean repository: ${String(err.stderr || err.message).trim()}`,
    };
  }
  const paths = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R') || status.startsWith('C')) {
      if (parts[1]) paths.add(parts[1]); // the area it LEFT
      if (parts[2]) paths.add(parts[2]); // the area it ENTERED
    } else if (parts[1]) {
      paths.add(parts[1]);
    }
  }
  return { ok: true, paths: [...paths], reason: null };
}

/** Read the commit message(s) the dismissal trailers would live in. */
export function readMessages(mode, range, root, messageFile) {
  if (messageFile) {
    if (!existsSync(messageFile)) {
      return { ok: false, texts: [], channel: `message file "${messageFile}" does not exist` };
    }
    const body = readFileSync(messageFile, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('#'))
      .join('\n');
    return { ok: true, texts: [body], channel: `commit message file (${messageFile})` };
  }
  if (mode === 'range') {
    // `git diff A...B` means "from the merge base to B", which is what a pull
    // request wants. `git log A...B` means something else entirely — the
    // symmetric difference, which drags in commits that live only on the base
    // branch, and with them dismissal trailers this change never wrote. The two
    // dots are not interchangeable, so the log range is normalised.
    const logRange = range.replace('...', '..');
    try {
      const raw = execFileSync('git', ['log', '--format=%B%x00', logRange], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { ok: true, texts: raw.split('\0').filter((t) => t.trim()), channel: `git log ${logRange}` };
    } catch (err) {
      return { ok: false, texts: [], channel: `git log ${logRange} failed: ${String(err.message).trim()}` };
    }
  }
  // Staged with no message file: dismissals are structurally unreadable here.
  // Disclosed rather than assumed absent — "nobody dismissed anything" and
  // "there was nowhere for a dismissal to be written" are different facts.
  return { ok: true, texts: [], channel: 'ABSENT — no --message-file given, so no dismissal can be read' };
}

const TRAILER = /^[ \t]*Doc-sync(?:\(([^)]*)\))?[ \t]*:[ \t]*(.*)$/gim;

/** Parse `Doc-sync:` / `Doc-sync(path):` trailers out of message text. */
export function parseDismissals(texts) {
  const all = [];
  for (const text of texts) {
    TRAILER.lastIndex = 0;
    let m;
    while ((m = TRAILER.exec(text)) !== null) {
      all.push({ doc: (m[1] || '').trim() || null, reason: (m[2] || '').trim() });
    }
  }
  return all;
}

const MIN_REASON = 12;

// --------------------------------------------------------------- the checker --
/**
 * Run the checker. Returns a report and NEVER exits, so the self-test can
 * inspect a failure instead of dying on it.
 */
export function checkDocSync(opts = {}) {
  const root = opts.root ?? REPO_ROOT;
  const mapPath = opts.mapPath ?? resolve(root, 'docs', 'feature-doc-map.json');
  const contextMapPath = opts.contextMapPath ?? resolve(root, 'context-map.json');
  const walkFloor = opts.floor ?? 200;
  const mode = opts.mode ?? null; // null | 'staged' | 'range'
  const range = opts.range ?? null;

  const report = {
    ok: false,
    exitCode: EXIT.COULD_NOT_RUN,
    mode: mode ? `structural + same-change (${mode === 'staged' ? 'staged set' : range})` : 'structural only',
    instrument: { mapPath: rel(root, mapPath), walked: 0, walkFloor, notEnumeratedDirs: [] },
    fatal: [],
    blocks: {},
  };

  // ---- instrument, asserted before any result ------------------------------
  if (!existsSync(mapPath)) {
    report.fatal.push(`the coupling map is not at ${rel(root, mapPath)}. Nothing to enforce; this is not a pass.`);
    return report;
  }
  let map;
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch (err) {
    report.fatal.push(`${rel(root, mapPath)} will not parse — ${err.message}. A map that cannot be read is not a clean map.`);
    return report;
  }
  const entries = Array.isArray(map.entries) ? map.entries : [];
  if (entries.length === 0) {
    report.fatal.push(
      `${rel(root, mapPath)} declares zero entries, so this run checked nothing at all. ` +
        `An empty coupling map is a broken instrument, never a repository with no couplings.`,
    );
    return report;
  }

  const { files, skippedDirs } = walkRepo(root);
  report.instrument.walked = files.length;
  report.instrument.notEnumeratedDirs = skippedDirs;
  if (files.length < walkFloor) {
    report.fatal.push(
      `walked ${files.length} file(s) but the floor is ${walkFloor}. THE WALK IS BROKEN, NOT THE TREE EMPTY — ` +
        `resolved root ${root}.`,
    );
    return report;
  }
  const fileSet = new Set(files);

  // ---- A. map integrity ---------------------------------------------------
  report.blocks.integrity = blockIntegrity(entries, files, fileSet);

  // ---- B. derived-claim rot ----------------------------------------------
  report.blocks.claim = blockClaim(map, contextMapPath, root);

  // ---- C. declared exclusions --------------------------------------------
  report.blocks.exclusions = blockExclusions(map, files);

  // ---- D. coverage, both sides (informational) ---------------------------
  report.blocks.coverage = blockCoverage(map, entries, files, fileSet, contextMapPath);

  // ---- E. same-change ------------------------------------------------------
  if (mode) {
    report.blocks.sameChange = blockSameChange({ mode, range, root, entries, fileSet, messageFile: opts.messageFile });
  }

  // ---- verdict -------------------------------------------------------------
  // A block with no population at all (`vacuous`) is excluded from the verdict:
  // it is a block that had nothing to do, not a block that could not look.
  const blocking = Object.values(report.blocks).filter((b) => b.blocking && !b.vacuous);
  const couldNotRun = blocking.some((b) => b.fatal || b.checked === 0);
  const drifted = blocking.reduce((n, b) => n + b.drifted, 0);
  report.exitCode = couldNotRun ? EXIT.COULD_NOT_RUN : drifted > 0 ? EXIT.DRIFT : EXIT.PASS;
  report.ok = report.exitCode === EXIT.PASS;
  return report;
}

const rel = (root, p) => relative(root, p).split(sep).join('/') || p;

/** An empty three-state tally, with every skip class present at zero. */
function tally(extra = {}) {
  return {
    considered: 0,
    checked: 0,
    drifted: 0,
    skipped: 0,
    skippedByClass: Object.fromEntries(SKIP_ORDER.map((k) => [k, 0])),
    findings: [],
    ...extra,
  };
}
const addSkip = (t, cls, finding) => {
  t.skipped++;
  t.skippedByClass[cls]++;
  if (finding) t.findings.push({ ...finding, skipClass: cls });
};

// ---------------------------------------------------------------- block A -----
function blockIntegrity(entries, files, fileSet) {
  const t = tally({
    id: 'integrity',
    title: 'map integrity — every entry still describes this tree',
    blocking: true,
    fatal: null,
  });
  t.considered = entries.length;

  for (const [i, entry] of entries.entries()) {
    const where = entry?.doc ? `entry "${entry.doc}"` : `entries[${i}]`;
    const globs = Array.isArray(entry?.sourceGlobs) ? entry.sourceGlobs : [];
    if (typeof entry?.doc !== 'string' || entry.doc.length === 0 || globs.length === 0) {
      addSkip(t, SKIP.INCOMPLETE, {
        entry: where,
        message:
          `the record is incomplete — an entry needs a "doc" and at least one "sourceGlob". ` +
          `It cannot be judged, so it is not counted as clean.`,
      });
      continue;
    }

    t.checked++;
    const problems = [];
    if (!fileSet.has(entry.doc)) {
      problems.push(
        `its coupled doc "${entry.doc}" does not exist. The declaration points at nothing, which is the ` +
          `skip class that looks like coverage and behaves like a hole — here it is the finding itself.`,
      );
    }
    for (const g of globs) {
      const re = globToRegExp(g);
      if (!files.some((f) => re.test(f))) {
        problems.push(
          `its sourceGlob "${g}" matches no file in the tree. A glob that matches nothing can never owe ` +
            `this doc an update, so the coupling is dead while still looking declared.`,
        );
      }
    }
    if (problems.length > 0) {
      t.drifted++;
      for (const p of problems) t.findings.push({ entry: where, message: p });
    }
  }
  return t;
}

// ---------------------------------------------------------------- block B -----
const CLAIM_RE = /(\d+)\s*contexts?\s*\/\s*(\d+)\s*groups?/i;

function blockClaim(map, contextMapPath, root) {
  const t = tally({
    id: 'claim',
    title: 'derived-claim rot — the map\'s own header, re-derived',
    blocking: true,
    fatal: null,
  });
  t.considered = 1;

  const comment = typeof map._comment === 'string' ? map._comment : '';
  const claim = CLAIM_RE.exec(comment);
  if (!claim) {
    addSkip(t, SKIP.INCOMPLETE, {
      entry: '_comment',
      message:
        `the header no longer states its derived counts in the form "N contexts / M groups", so there is ` +
        `nothing to re-derive. A claim that carries its predicate is a claim that can be re-run; one that ` +
        `dropped the predicate silently stopped being checkable.`,
    });
    return t;
  }
  if (!existsSync(contextMapPath)) {
    addSkip(t, SKIP.PRECONDITION, {
      entry: '_comment',
      message: `${rel(root, contextMapPath)} is absent, so the claim cannot be recomputed. This is not agreement.`,
    });
    return t;
  }
  let cm;
  try {
    cm = JSON.parse(readFileSync(contextMapPath, 'utf8'));
  } catch (err) {
    addSkip(t, SKIP.INSTRUMENT, { entry: '_comment', message: `${rel(root, contextMapPath)} will not parse — ${err.message}` });
    return t;
  }

  t.checked = 1;
  const actual = { contexts: (cm.contexts ?? []).length, groups: (cm.groups ?? []).length };
  const stated = { contexts: Number(claim[1]), groups: Number(claim[2]) };
  t.stated = stated;
  t.actual = actual;
  if (stated.contexts !== actual.contexts || stated.groups !== actual.groups) {
    t.drifted = 1;
    t.findings.push({
      entry: '_comment',
      message:
        `the header states ${stated.contexts} contexts / ${stated.groups} groups; context-map.json holds ` +
        `${actual.contexts} contexts / ${actual.groups} groups (counted 2026-08-24 by ` +
        `\`contexts.length\` / \`groups.length\`). Fix the prose, or re-derive it with ` +
        `\`node scripts/docs/check-doc-sync.mjs --update-comment\`.`,
    });
  }
  return t;
}

// ---------------------------------------------------------------- block C -----
function blockExclusions(map, files) {
  const t = tally({
    id: 'exclusions',
    title: 'declared exclusions — the dated artifacts the map refuses to couple',
    blocking: true,
    fatal: null,
  });
  const declared = Array.isArray(map.unmappedByDesign) ? map.unmappedByDesign : [];
  t.considered = declared.length;
  if (declared.length === 0) {
    // Nothing declared is a legitimate state, not a broken instrument: a map may
    // genuinely have no append-only artifact classes. `checked === considered`
    // keeps the block out of the empty-denominator rule.
    t.checked = 0;
    t.vacuous = true;
    return t;
  }
  for (const [i, ex] of declared.entries()) {
    if (typeof ex?.glob !== 'string' || typeof ex?.reason !== 'string' || ex.reason.trim().length < MIN_REASON) {
      addSkip(t, SKIP.INCOMPLETE, {
        entry: `unmappedByDesign[${i}]`,
        message: `needs a "glob" and a real "reason" (>= ${MIN_REASON} chars) — an unexplained exemption is how an allowlist becomes a hiding place.`,
      });
      continue;
    }
    t.checked++;
    const re = globToRegExp(ex.glob);
    const hits = files.filter((f) => re.test(f)).length;
    if (hits === 0) {
      t.drifted++;
      t.findings.push({
        entry: ex.glob,
        message: `the exclusion matches no file. It is stale — the artifacts moved or were deleted. (reason on record: ${ex.reason})`,
      });
    }
  }
  return t;
}

// ---------------------------------------------------------------- block D -----
function blockCoverage(map, entries, files, fileSet, contextMapPath) {
  const t = tally({
    id: 'coverage',
    title: 'coverage measured from the other side',
    blocking: false,
    fatal: null,
  });
  const globRes = entries.flatMap((e) => (Array.isArray(e?.sourceGlobs) ? e.sourceGlobs : []).map(globToRegExp));
  const covered = (p) => globRes.some((re) => re.test(p));

  // --- source side: contexts no entry reaches
  const src = { population: 0, mapped: 0, unmapped: [], notEnumerated: [] };
  if (existsSync(contextMapPath)) {
    let cm = null;
    try {
      cm = JSON.parse(readFileSync(contextMapPath, 'utf8'));
    } catch {
      cm = null;
    }
    for (const ctx of cm?.contexts ?? []) {
      src.population++;
      const live = (ctx.file_paths ?? []).filter((p) => fileSet.has(p));
      if (live.length === 0) {
        // Every path this context names is gone: it cannot be judged mapped or
        // unmapped, so it is neither. Checked + skipped must equal the
        // population the run set out to examine, and this is the fourth number.
        src.notEnumerated.push(ctx.business_feature ?? ctx.id ?? '(unnamed context)');
        continue;
      }
      if (live.some(covered)) src.mapped++;
      else src.unmapped.push(ctx.business_feature ?? ctx.id ?? '(unnamed context)');
    }
  }

  // --- doc side: documents no entry couples
  const docSet = new Set(entries.map((e) => e?.doc).filter(Boolean));
  const exRes = (map.unmappedByDesign ?? [])
    .filter((e) => typeof e?.glob === 'string')
    .map((e) => globToRegExp(e.glob));
  const docs = { population: 0, coupled: 0, excludedByDesign: 0, uncoupled: [] };
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    if (!(f.startsWith('docs/') || !f.includes('/'))) continue; // docs/** plus root-level *.md
    docs.population++;
    if (docSet.has(f)) docs.coupled++;
    else if (exRes.some((re) => re.test(f))) docs.excludedByDesign++;
    else docs.uncoupled.push(f);
  }

  t.considered = src.population + docs.population;
  t.checked = src.mapped + src.unmapped.length + docs.coupled + docs.excludedByDesign + docs.uncoupled.length;
  t.drifted = 0; // informational by construction: this block cannot fail a build
  for (const n of src.notEnumerated) addSkip(t, SKIP.UNRESOLVABLE, { entry: n, message: 'every file_path this context names is gone from the tree; it can be neither mapped nor unmapped.' });
  t.source = src;
  t.docs = docs;
  return t;
}

// ---------------------------------------------------------------- block E -----
function blockSameChange({ mode, range, root, entries, fileSet, messageFile }) {
  const t = tally({
    id: 'same-change',
    title: 'same-change — what this change owed and did not touch',
    blocking: true,
    fatal: null,
  });
  t.considered = entries.length;

  const diff = readChangedPaths(mode, range, root);
  if (!diff.ok) {
    t.fatal = diff.reason;
    for (let i = 0; i < entries.length; i++) t.skippedByClass[SKIP.INSTRUMENT]++;
    t.skipped = entries.length;
    t.findings.push({ entry: '(all)', message: diff.reason, skipClass: SKIP.INSTRUMENT });
    return t;
  }
  const changed = new Set(diff.paths);
  t.changedPaths = diff.paths.length;

  const msg = readMessages(mode, range, root, messageFile);
  t.dismissalChannel = msg.channel;
  const dismissals = parseDismissals(msg.texts);
  const globalDismissals = dismissals.filter((d) => !d.doc);
  const scoped = new Map(dismissals.filter((d) => d.doc).map((d) => [d.doc, d]));

  // A shrug is not a dismissal, and it blocks — otherwise "Doc-sync: n/a" becomes
  // the cheapest possible way to discharge every obligation this file exists for.
  for (const d of dismissals) {
    if (d.reason.length < MIN_REASON) {
      t.drifted++;
      t.findings.push({
        entry: d.doc ?? '(all owed entries)',
        message:
          `the dismissal reason "${d.reason}" is shorter than ${MIN_REASON} characters. A dismissal names WHY ` +
          `("internal-only, no user-visible surface moved"); a shrug recorded in the history is worse than silence, ` +
          `because it will be counted as a considered decision.`,
      });
    }
  }
  const usableGlobal = globalDismissals.find((d) => d.reason.length >= MIN_REASON) ?? null;

  t.owed = 0;
  t.satisfied = 0;
  t.dismissed = 0;
  const owedDocs = new Set();

  for (const [i, entry] of entries.entries()) {
    const globs = Array.isArray(entry?.sourceGlobs) ? entry.sourceGlobs : [];
    if (typeof entry?.doc !== 'string' || globs.length === 0) {
      addSkip(t, SKIP.INCOMPLETE, { entry: `entries[${i}]`, message: 'incomplete record — cannot be evaluated against a diff.' });
      continue;
    }
    const res = globs.map(globToRegExp);
    // The entry's own doc never counts as its own trigger: editing the doc does
    // not oblige you to edit the doc.
    const triggers = [...changed].filter((p) => p !== entry.doc && res.some((re) => re.test(p)));
    if (triggers.length === 0) {
      t.checked++; // evaluated, and found not-owed. That IS a verdict.
      continue;
    }
    owedDocs.add(entry.doc);

    if (!fileSet.has(entry.doc)) {
      // Owed, but the target does not exist: we cannot say whether the change
      // should have touched it, and calling that satisfied would be the lie.
      addSkip(t, SKIP.UNRESOLVABLE, {
        entry: entry.doc,
        message:
          `this change touched ${triggers.length} path(s) coupled to "${entry.doc}", but that document does not ` +
          `exist. The obligation cannot be judged — repair the map entry.`,
      });
      continue;
    }

    t.checked++;
    t.owed++;

    // SATISFACTION IS ON THE NAMED TARGET. Not "a file under docs/".
    if (changed.has(entry.doc)) {
      t.satisfied++;
      continue;
    }
    const dismissal = scoped.get(entry.doc) ?? usableGlobal;
    if (dismissal && dismissal.reason.length >= MIN_REASON) {
      t.dismissed++;
      t.findings.push({
        entry: entry.doc,
        dismissed: true,
        message: `dismissed with a reason on the commit: "${dismissal.reason}"`,
      });
      continue;
    }
    t.drifted++;
    t.findings.push({
      entry: entry.doc,
      triggers: triggers.slice(0, 8),
      message:
        `this change touched ${triggers.length} coupled path(s) (${triggers.slice(0, 4).join(', ')}` +
        `${triggers.length > 4 ? ', …' : ''}) and did not touch "${entry.doc}". Update it in THIS change, or ` +
        `record a dismissal trailer: Doc-sync(${entry.doc}): <why this needs no doc update>`,
    });
  }

  // A dismissal aimed at a doc this change never owed is not a failure, but it
  // is a sign the trailer is being pasted rather than decided.
  for (const [doc] of scoped) {
    if (!owedDocs.has(doc)) {
      t.findings.push({
        entry: doc,
        informational: true,
        message: `a Doc-sync dismissal names "${doc}", which this change did not owe. Nothing was dismissed by it.`,
      });
    }
  }
  return t;
}

// -------------------------------------------------------------- --update-comment
function updateComment(mapPath, contextMapPath) {
  const raw = readFileSync(mapPath, 'utf8');
  const map = JSON.parse(raw);
  const cm = JSON.parse(readFileSync(contextMapPath, 'utf8'));
  const actual = { contexts: (cm.contexts ?? []).length, groups: (cm.groups ?? []).length };
  const before = CLAIM_RE.exec(map._comment ?? '');
  if (!before) {
    console.error(c.red('check-doc-sync: the header states no "N contexts / M groups" claim to re-derive.'));
    return EXIT.COULD_NOT_RUN;
  }
  map._comment = map._comment.replace(CLAIM_RE, `${actual.contexts} contexts / ${actual.groups} groups`);
  writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
  console.log(
    `check-doc-sync: header re-derived — ${before[1]} contexts / ${before[2]} groups -> ` +
      `${actual.contexts} contexts / ${actual.groups} groups (from context-map.json).`,
  );
  return EXIT.PASS;
}

// ------------------------------------------------------------------- report ---
const tag = (blocking) => (blocking ? c.red('[BLOCKING]') : c.dim('[informational — cannot fail the build]'));
const LIST_CAP = 15;

function skipLine(t) {
  // Printed even when every class is zero. A report that mentions skips only
  // when there are some teaches its readers that silence means "nothing to say".
  return SKIP_ORDER.map((k) => `${k} ${t.skippedByClass[k]}`).join(', ');
}

export function renderReport(report) {
  const lines = [];
  const p = (s = '') => lines.push(s);

  p('');
  p(c.bold('doc-sync') + c.dim(`  ${report.mode}`));
  p(c.dim(`  map: ${report.instrument.mapPath} · walked ${report.instrument.walked} file(s), floor ${report.instrument.walkFloor}`));
  if (report.instrument.notEnumeratedDirs.length > 0) {
    p(c.yellow(`  ${report.instrument.notEnumeratedDirs.length} director(ies) were unreadable and are NOT in any denominator below`));
  }

  if (report.fatal.length > 0) {
    p('');
    for (const f of report.fatal) p(`  ${c.red('COULD NOT RUN')} ${f}`);
    p('');
    p(`  ${c.red('doc-sync COULD NOT RUN')} — nothing was checked, so nothing is clean. exit 2.`);
    p('');
    return lines.join('\n');
  }

  for (const b of Object.values(report.blocks)) {
    p('');
    p(`  ${tag(b.blocking)} ${c.bold(b.title)}`);
    if (b.fatal) p(`    ${c.red('could not run')} ${b.fatal}`);

    if (b.id === 'coverage') {
      const s = b.source;
      const d = b.docs;
      p(
        c.dim(
          `    source side: ${s.mapped} of ${s.population} context(s) in context-map.json are reached by at least ` +
            `one sourceGlob; ${s.unmapped.length} are reached by none; ${s.notEnumerated.length} could not be enumerated.`,
        ),
      );
      for (const n of s.unmapped) p(c.dim(`      unmapped context: ${n}`));
      for (const n of s.notEnumerated) p(c.yellow(`      not enumerated: ${n} (every file_path it names is gone)`));
      p(
        c.dim(
          `    doc side: ${d.coupled} of ${d.population} markdown doc(s) under docs/ and the repo root are some ` +
            `entry's coupled doc; ${d.excludedByDesign} are declared append-only and deliberately uncoupled; ` +
            `${d.uncoupled.length} are neither.`,
        ),
      );
      // Truncated for the terminal, never for the count: the number above is the
      // whole population, `--json` carries every name, and the cutoff is stable
      // (sorted by the walk) so consecutive runs list the same head.
      for (const n of d.uncoupled.slice(0, LIST_CAP)) p(c.dim(`      uncoupled doc: ${n}`));
      if (d.uncoupled.length > LIST_CAP) {
        p(c.dim(`      … and ${d.uncoupled.length - LIST_CAP} more uncoupled doc(s) — all of them in --json`));
      }
      p(
        c.dim(
          `    These are CANDIDATE couplings, not violations. Nothing here can fail a build, and that is a ` +
            `decision: which of them deserves an entry is a human judgment, and an informational number that ` +
            `has been rising for months is itself a finding about the project.`,
        ),
      );
    }

    if (b.id === 'same-change') {
      p(c.dim(`    change record: git diff (${b.changedPaths ?? 0} changed path(s)) — never a session transcript`));
      p(c.dim(`    dismissal channel: ${b.dismissalChannel}`));
      p(
        c.dim(
          `    ${b.owed ?? 0} of ${b.considered} entries were owed by this change · ` +
            `${b.satisfied ?? 0} satisfied on the named doc · ${b.dismissed ?? 0} dismissed with a recorded reason`,
        ),
      );
    }

    for (const f of b.findings) {
      const mark = f.dismissed
        ? c.yellow('dismissed')
        : f.informational || f.skipClass
          ? c.yellow(f.skipClass ? `skipped/${f.skipClass}` : 'note')
          : b.blocking
            ? c.red('DRIFT')
            : c.yellow('note');
      p(`    ${mark} ${c.bold(f.entry)} — ${f.message}`);
    }

    if (b.vacuous) {
      p(c.dim('    nothing declared; the block has no population and is excluded from the verdict.'));
    } else {
      p(
        `    ${b.drifted} drifted of ${b.checked} checked, ${b.skipped} skipped ` +
          `(${skipLine(b)}) — over ${b.considered} unit(s) considered`,
      );
      if (b.blocking && b.checked === 0) {
        p(`    ${c.red('empty denominator')} — this block could not check a single unit. That is exit 2, never a pass.`);
      }
    }
  }

  const blocking = Object.values(report.blocks).filter((x) => x.blocking && !x.vacuous);
  const D = blocking.reduce((n, x) => n + x.drifted, 0);
  const C = blocking.reduce((n, x) => n + x.checked, 0);
  const S = blocking.reduce((n, x) => n + x.skipped, 0);
  const classes = Object.fromEntries(SKIP_ORDER.map((k) => [k, blocking.reduce((n, x) => n + x.skippedByClass[k], 0)]));

  p('');
  const verdict =
    report.exitCode === EXIT.PASS
      ? c.green('doc-sync OK')
      : report.exitCode === EXIT.DRIFT
        ? c.red('doc-sync FAILED')
        : c.red('doc-sync COULD NOT RUN');
  p(
    `  ${verdict} — ${D} drifted of ${C} checked, ${S} skipped ` +
      `(${SKIP_ORDER.map((k) => `${k} ${classes[k]}`).join(', ')}), across the blocking blocks only.`,
  );
  p(c.dim('  The informational coverage block is excluded from that fraction on purpose — it cannot fail a build.'));
  p('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------- CLI ---
function parseArgs(argv) {
  const args = { json: false, mode: null, range: null, messageFile: null, root: REPO_ROOT, updateComment: false, floor: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--staged') args.mode = 'staged';
    else if (a === '--range') {
      args.mode = 'range';
      args.range = argv[++i];
    } else if (a === '--message-file') args.messageFile = argv[++i];
    else if (a === '--root') args.root = resolve(process.cwd(), argv[++i]);
    else if (a === '--floor') args.floor = Number(argv[++i]);
    else if (a === '--update-comment') args.updateComment = true;
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]);
      process.exit(0);
    } else {
      console.error(`check-doc-sync: unknown argument "${a}"`);
      process.exit(EXIT.COULD_NOT_RUN);
    }
  }
  if (args.mode === 'range' && !args.range) {
    console.error('check-doc-sync: --range needs a git range, e.g. --range origin/master..HEAD');
    process.exit(EXIT.COULD_NOT_RUN);
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.updateComment) {
    process.exit(updateComment(resolve(args.root, 'docs', 'feature-doc-map.json'), resolve(args.root, 'context-map.json')));
  }
  const report = checkDocSync(args);
  if (args.json) {
    // The denominators live INSIDE the same object as the findings, in every
    // block. A consumer physically cannot reach a numerator without passing the
    // population it came from.
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(report));
  }
  process.exit(report.exitCode);
}
