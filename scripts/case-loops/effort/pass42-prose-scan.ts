/* Case ② Effort — batch 010: does the pass-42 committee-dedupe correction contradict
 * any PUBLISHED dossier prose?
 *
 * Pass 42 changed what `committee_count` MEANS (psp.cz membership ROWS → DISTINCT
 * BODIES, because a body an MP LEADS is filed twice). Every dossier in batches 001-009
 * was written while the prose author was reading the OLD number. The Q-effort-11 gate
 * in gate.ts cross-checks bills / interpellations / speeches / tenure — it has no
 * committee noun group and no score/rank group, so it is structurally blind to exactly
 * the class this correction created.
 *
 * This scan reads BOTH stores — the pass-11 backup (pre-correction) and the corrected
 * copy — so the committee delta is measured, not inferred, and then greps every
 * reader-facing effort_* prose field for committee/score/rank claims that the corrected
 * props contradict.
 *
 * Each store is read in its OWN process — `lib/db/store` memoizes one PGlite
 * singleton per process, so two paths cannot be opened from one run:
 *
 *   PGLITE_PATH=./.pglite-copy-effort   npx tsx …/pass42-prose-scan.ts --snapshot=<tmp>/corrected.json
 *   PGLITE_PATH=./.pglite-backup-pass11 npx tsx …/pass42-prose-scan.ts --snapshot=<tmp>/pre.json
 *   npx tsx …/pass42-prose-scan.ts --compare --corrected=<tmp>/corrected.json --pre=<tmp>/pre.json
 *
 * No writes to any store. No LLM. Emits payloads/batch-010-prose-scan.json.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-effort";

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x : null);

/** Every effort_* field that can reach a reader (see features/profile + /zebricek).
 *  effort_analyst_note is EXCLUDED by design — it is the non-rendered internals field
 *  (batch 007, guarded by a source-grep test); it is scanned separately and reported
 *  apart so a finding there is never confused with a public defect.
 *
 *  `effort_psp9_trend_note` is scanned but its committee claims are NOT comparable to
 *  `committee_count`: that prop is PSP10-scoped and the note describes the PRIOR term
 *  (a sentence like „v PSP9 seděl v 7 výborech, nyní ve 2" contains two counts, neither
 *  of which is this term's). Excluded from the comparison below, kept in the corpus
 *  census so the exclusion is visible rather than silent. */
const PUBLIC_PROSE_FIELDS = [
  "effort_notes",
  "effort_bill_focus",
  "effort_public_role",
  "effort_committee_focus",
  "effort_work_themes",
  "effort_divergence_note",
  "effort_mandate_note",
  "effort_independence_note",
  "effort_psp9_trend_note",
];
/** Fields whose committee counts belong to a different term — never compared. */
const CROSS_TERM_FIELDS = new Set(["effort_psp9_trend_note"]);
const PRIVATE_PROSE_FIELDS = ["effort_analyst_note"];

const CZECH_NUM_WORDS: Record<string, number> = {
  jednoho: 1, jednom: 1, jeden: 1, jedna: 1, jedné: 1, jednu: 1,
  dva: 2, dvou: 2, dvě: 2, dvěma: 2,
  tři: 3, tří: 3, třech: 3, třemi: 3,
  čtyři: 4, čtyř: 4, čtyřech: 4,
  pět: 5, pěti: 5,
  šest: 6, šesti: 6,
  sedm: 7, sedmi: 7,
  osm: 8, osmi: 8,
};

/** Committee noun. Deliberately NARROW: `výbor` ONLY.
 *
 *  NOT `podvýbor` — the first draft of this scan included subcommittees and 7 of its
 *  30 printed findings were that category error. `Podvýbor` IS in COMMITTEE_ORGAN_TYPES,
 *  but the PSP10 ingest contains ZERO subcommittee membership rows (measured by
 *  pass42-seats.ts: Výbor 512 · Komise 257 · Klub 251 · Poslanecká sněmovna 228 ·
 *  Delegace 86 · Podvýbor 0 — the same absence contribution.ts's own comment records),
 *  so a „sedmi podvýborů" sentence is sourced from psp.cz directly and is not a claim
 *  about this prop at all; pass 42 could not have moved it.
 *
 *  `komise` and `delegace` need no separate noun group: they ARE counted by
 *  committee_count, and the prose that cites them says „výborů a komisí", which this
 *  pattern already catches on its „výbor" head.
 *
 *  Word-boundary via \p{L} lookaround — plain \b is ASCII-only in JS and silently
 *  fails on Czech diacritics (gate.ts, batch 005). */
const COMMITTEE_NOUN = /^výbor(?:u|y|ů|ech|em|a)?$/iu;

/** Words that, appearing between the numeral and „výbor", prove the numeral counts
 *  something ELSE. „6 stále ve výborech" is six BILLS still sitting in committees —
 *  the second false-positive class the first draft printed. A preposition or an
 *  adverb in the gap means the numeral's head noun was elided before it. */
const GAP_BREAKS_BINDING = /(?<![\p{L}])(?:ve?|na|do|ze?|o|u|se|stále|dosud|pouze|jen|už|již)(?![\p{L}])/iu;

interface Claim { count: number; raw: string; window: string }

/** "<number> výborech" with a bounded gap for adjectives ("ve dvou sněmovních výborech"). */
function extractCommitteeClaims(text: string): Claim[] {
  const claims: Claim[] = [];
  const push = (count: number, raw: string, idx: number) => {
    claims.push({ count, raw: raw.trim(), window: text.slice(Math.max(0, idx - 70), Math.min(text.length, idx + 90)).replace(/\s+/g, " ") });
  };
  // Arabic: "2 výbory", "ve 2 sněmovních výborech"
  const arabicRe = /(\d+)((?:\s+[a-záčďéěíňóřšťúůýž]+){0,2}\s+)(?:pod)?(výbor[a-záčďéěíňóřšťúůýž]*)/giu;
  let m: RegExpExecArray | null;
  while ((m = arabicRe.exec(text))) {
    const n = Number(m[1]);
    if (n > 20) continue; // a year or a tisk number, not a committee count
    if (/pod(?:výbor)/iu.test(m[0])) continue; // subcommittee — a different, un-ingested organ class
    if (GAP_BREAKS_BINDING.test(m[2])) continue; // the numeral counts something else
    if (COMMITTEE_NOUN.test(m[3])) push(n, m[0], m.index);
  }
  // Spelled-out: "ve dvou výborech", "ve třech sněmovních výborech"
  const spelledRe = new RegExp(
    `(?<![\\p{L}])(${Object.keys(CZECH_NUM_WORDS).join("|")})((?:\\s+[a-záčďéěíňóřšťúůýž]+){0,2}\\s+)(?:pod)?(výbor[a-záčďéěíňóřšťúůýž]*)`,
    "giu",
  );
  while ((m = spelledRe.exec(text))) {
    // Czech negation flips the numeral (gate.ts, batch 005): "ani v jednom výboru"
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    if (/(ani|žádn[\p{L}]*)\s*(v\s+|ve\s+|u\s+)?$/iu.test(before)) continue;
    // "jeden ze šesti výborů" — a PARTITIVE: the numeral binds to the SET, not to the
    // MP's own seat count. Third false-positive class from the first draft (Adámková).
    if (/(?<![\p{L}])(?:jeden|jedním|jedna|jednou|jedné)\s+(?:ze?)\s*$/iu.test(before)) continue;
    if (/pod(?:výbor)/iu.test(m[0])) continue;
    if (GAP_BREAKS_BINDING.test(m[2])) continue;
    if (COMMITTEE_NOUN.test(m[3])) push(CZECH_NUM_WORDS[m[1].toLowerCase()], m[0], m.index);
  }
  return claims;
}

/** Score and rank lenses: TRIED AND RETIRED, recorded here rather than silently dropped.
 *
 *  The first draft also compared „N bodu" against `contribution_score` and „N. místo"
 *  against the ranked chamber. Hand-reading all 12 of their hits: 6/6 score hits were a
 *  DIFFERENT quantity (a PSP9-term score in `effort_psp9_trend_note`, a point DELTA
 *  („o 5,3 bodu"), a component's own contribution („20 bodů" of the 100-point index) —
 *  never a citation of the composite), and 6/6 rank hits were „1. místopředseda" — the
 *  office of First Deputy, not a leaderboard position. Both lenses fired at 100 % false,
 *  so they are removed rather than kept as noise a reader would have to re-adjudicate.
 *  The corpus's published prose does not, in fact, quote the composite or the rank —
 *  which is itself the finding: the dossiers describe WORK, and pass 42 moved NUMBERS.
 *
 *  Consequence for this batch: the exposure is confined to committee counts. */

interface Snap {
  pspId: number; name: string;
  score: number | null; committeeCount: number | null; leadershipCount: number | null;
  prose: Record<string, string>;
}

async function snapshot(): Promise<Snap[]> {
  const { getStore } = await import("@/lib/db/store");
  const store = await getStore();
  if (!store) throw new Error(`no store at PGLITE_PATH=${process.env.PGLITE_PATH}`);
  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const out: Snap[] = [];
  for (const p of persons) {
    const pspId = Number(p.id.split(":").pop());
    const prose: Record<string, string> = {};
    for (const f of [...PUBLIC_PROSE_FIELDS, ...PRIVATE_PROSE_FIELDS]) {
      const v = str(p.props[f]);
      if (v) prose[f] = v;
    }
    out.push({
      pspId,
      name: p.label,
      score: num(p.props.contribution_score),
      committeeCount: num(p.props.committee_count),
      leadershipCount: num(p.props.leadership_count),
      prose,
    });
  }
  await store.close();
  return out;
}

const arg = (k: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

async function main() {
  const snapOut = arg("snapshot");
  if (snapOut) {
    const rows = await snapshot();
    writeFileSync(snapOut, JSON.stringify(rows, null, 2));
    console.log(`snapshot of PGLITE_PATH=${process.env.PGLITE_PATH}: ${rows.length} persons → ${snapOut}`);
    return;
  }

  const load = (p: string) => new Map((JSON.parse(readFileSync(p, "utf8")) as Snap[]).map((s) => [s.pspId, s]));
  const corrected = load(arg("corrected")!);
  const pre = load(arg("pre")!);
  console.log(`corrected store: ${corrected.size} persons · pass-11 backup: ${pre.size} persons`);

  // ── 1. the measured committee delta ────────────────────────────────────────
  const deltas = [...corrected.values()]
    .map((c) => ({ c, p: pre.get(c.pspId) }))
    .filter((x) => x.p && x.p.committeeCount !== x.c.committeeCount)
    .map((x) => ({ pspId: x.c.pspId, name: x.c.name, before: x.p!.committeeCount, after: x.c.committeeCount, scoreBefore: x.p!.score, scoreAfter: x.c.score }));
  console.log(`\ncommittee_count changed on ${deltas.length}/207 MPs:`);
  for (const d of deltas.slice(0, 40)) console.log(`  ${d.name.padEnd(26)} committees ${d.before} → ${d.after}   score ${d.scoreBefore} → ${d.scoreAfter}`);

  // ── 2. prose claims contradicted by the CORRECTED props ────────────────────
  const findings: Record<string, unknown>[] = [];
  let proseNodes = 0, proseFieldInstances = 0, skippedCrossTerm = 0;
  for (const c of corrected.values()) {
    const fields = Object.keys(c.prose);
    if (fields.length) proseNodes++;
    proseFieldInstances += fields.length;
    for (const [field, text] of Object.entries(c.prose)) {
      const isPublic = PUBLIC_PROSE_FIELDS.includes(field);
      if (CROSS_TERM_FIELDS.has(field)) { skippedCrossTerm += extractCommitteeClaims(text).length; continue; }
      for (const claim of extractCommitteeClaims(text)) {
        // A committee claim is compared against the CORRECTED distinct-body count.
        // Equal → fine. Different → report, and say whether it matches the PRE-correction
        // value exactly (which makes it stale BECAUSE OF pass 42, the defect class this
        // batch exists for) or neither (a pre-existing error the correction merely exposed).
        if (c.committeeCount != null && claim.count !== c.committeeCount) {
          findings.push({
            kind: "committee", pspId: c.pspId, name: c.name, field, isPublic,
            claimed: claim.count, corrected: c.committeeCount,
            preCorrection: pre.get(c.pspId)?.committeeCount ?? null,
            matchedPreCorrection: claim.count === (pre.get(c.pspId)?.committeeCount ?? null),
            raw: claim.raw, window: claim.window,
          });
        }
      }
    }
  }

  console.log(`\nprose corpus: ${proseNodes}/207 nodes carry at least one effort_* prose field (${proseFieldInstances} field-instances)`);
  const pub = findings.filter((f) => f.isPublic);
  console.log(`FINDINGS: ${findings.length} total · ${pub.length} on reader-facing fields`);
  const byKind: Record<string, number> = {};
  for (const f of findings) byKind[f.kind as string] = (byKind[f.kind as string] ?? 0) + 1;
  console.log(`  by kind: ${JSON.stringify(byKind)}`);
  const inherited = findings.filter((f) => f.matchedPreCorrection === true);
  console.log(`  matching the PRE-correction value exactly (i.e. stale because of pass 42): ${inherited.length}`);
  console.log(`  cross-term committee claims skipped (effort_psp9_trend_note): ${skippedCrossTerm}`);
  console.log(`\nALL SURVIVORS (hand-read every one — a guard whose failures nobody has read is not evidence):`);
  for (const f of findings) {
    console.log(`\n  [${f.matchedPreCorrection ? "STALE-BY-42" : "other"}] ${f.name} · ${f.field} · claims ${f.claimed}, corrected ${f.corrected}, pre ${f.preCorrection}`);
    console.log(`     …${f.window}…`);
  }

  mkdirSync(`${OUT}/payloads`, { recursive: true });
  writeFileSync(`${OUT}/payloads/batch-010-prose-scan.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    committeeDeltas: deltas,
    proseNodes, proseFieldInstances,
    findings,
  }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-prose-scan.json`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
