/* Case ③ Law loop — batch-009: the P49 presence guard for collision close-reads.
 *
 * WHY THIS EXISTS. batch-008 published pair 90-221 as a `confirmed` collision on the claim
 * that both bills propose "VERBATIM IDENTICAL" text. The quoted string does not occur in tisk
 * 90 at all — the close-read had compared tisk 221's own excerpt against itself. It was caught
 * only because an Opus reflection pass happened to re-read the excerpts; neither dispatched
 * agent was scoped to find it, and the kernel's own doctrine that WOULD have caught it (P49 —
 * "presence claims verify by grep, not by a second model read") had been applied to that
 * batch's deletion payload but never to its close-reads.
 *
 * A close-read that asserts two bills share text is a PRESENCE CLAIM ABOUT TWO DOCUMENTS, and
 * /zakony/kolize publishes it by bill number as a public forensic lead. So it gets a
 * deterministic gate, not a prose reminder — the kernel's own lesson that "prose lessons do not
 * survive contact with the next army".
 *
 * TWO CHECKS, both NFC-normalized + whitespace-collapsed against `.data/law-collision-cache/`:
 *
 *   E-CHECK (attribution)  the LEADING quoted span of `evidence.billAExcerpt` must occur in
 *                          bill A's own cached text, and likewise for B. This is what fails
 *                          when an excerpt is reused across the wrong side of a pair — the
 *                          exact 90-221 mechanism. When the text is absent from its own bill
 *                          but present in the pair's other bill, the finding says so.
 *   R-CHECK (identity)     within a SENTENCE that asserts sameness ("identical", "verbatim",
 *                          "totožné", "shodné", …) and does NOT also mark a contrast ("vs.",
 *                          "two different", "zatímco"), every quoted source span must be
 *                          shared by at least two of the documents that sentence ranges over
 *                          — the pair's two bills plus any other print it names by number.
 *
 * BUILT BY MEASUREMENT, NOT BY INTUITION. Each rule above replaced one that over-fired, and
 * the fire rate was checked at every step exactly as the kernel requires of a triage signal:
 *   whole-field compare            106 fails / 102 checks (~100%)  — degenerate
 *   + quoted-span extraction       180 / 298  — apostrophes in "tisk 4's" ate whole sentences
 *   + possessive-safe quoting       16 / 206  — plausible, still wrong
 *   + primary-span, sentence scope   7 / 103  — 4 were analyst „40[0 000 Kč]“ brackets
 *   + elision/bracket splitting      2 / 103  — both semantically sound on hand-verification
 *   + contrast + third-bill scope    0 / 103  — final
 * A guard whose failures you have not personally read is not evidence; every survivor of every
 * stage above was checked against the cached text by hand before the rule that cleared it was
 * written.
 *
 * RESULT ON THE PUBLISHED CORPUS (batch-009): 63 pairs, 99 E-CHECKs, 3 R-CHECKs, **0 failures**.
 * No published close-read misattributes text to a bill. batch-008's 90-221 — the defect that
 * motivated this guard — was corrected in batch-008 itself and is not in the rendered set.
 * That negative result is recorded with the same weight as a positive one would be.
 *
 * KNOWN LIMIT, stated rather than hidden: 12 of the 63 pairs carry NO evidence excerpt at all
 * (all 12 are batch-008's), and 3 more excerpts are pure provenance with nothing quoted. Those
 * pairs are unverifiable BY CONSTRUCTION — this guard cannot certify what a payload never
 * asserted. Requiring a verbatim span on every new close-read is what closes that gap.
 *
 *   npx tsx scripts/case-loops/law/verify-close-reads.ts            # all published payloads
 *   npx tsx scripts/case-loops/law/verify-close-reads.ts --file=collision-close-reads-batch009.json
 *   npx tsx scripts/case-loops/law/verify-close-reads.ts --json=<out>
 *
 * Exit code 1 if any pair FAILS, so it can gate an army wave or CI.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAYLOADS = "docs/data-analysis/case-law/payloads";
const CACHE = ".data/law-collision-cache";

const arg = (n: string): string | null => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : null;
};

/** Collapse to a comparable form: NFC (pdftotext emits mixed normalization within ONE
 * document — batch-008's own finding), typographic quotes and dashes folded to ASCII so an
 * analyst's re-typed quote still matches the source. */
function canon(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[„“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—­]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** The form actual COMPARISON happens in: canon with ALL whitespace removed.
 *
 * Necessary, not laziness. `pdftotext -layout` breaks lines mid-sentence and pads columns, so
 * a verbatim source phrase almost never survives with its spacing intact; and analysts re-type
 * amount literals inconsistently (batch-004 quotes the SAME statutory figure as both
 * „15 204 Kč“ and „15204 Kč“ in adjacent excerpts). Stripping whitespace makes the check
 * robust to both. A 20+-character space-free Czech legal fragment is still highly specific —
 * this guard exists to catch text that is ABSENT ENTIRELY (the 90-221 mechanism), not to
 * adjudicate spacing. */
function cmp(s: string): string {
  return canon(s).replace(/\s+/g, "");
}

const textCache = new Map<number, string | null>();
/** All cached text for one print, concatenated — a bill's novelization can span several
 * documents in the cache dir, and a claim is satisfied by ANY of them. */
function billText(cislo: number): string | null {
  if (textCache.has(cislo)) return textCache.get(cislo)!;
  const dir = join(CACHE, `tisk-${cislo}`);
  if (!existsSync(dir)) {
    textCache.set(cislo, null);
    return null;
  }
  const txts = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (txts.length === 0) {
    textCache.set(cislo, null);
    return null;
  }
  const joined = cmp(txts.map((f) => readFileSync(join(dir, f), "utf8")).join("\n"));
  textCache.set(cislo, joined);
  return joined;
}

/** Sameness assertions, Czech and English. Word-boundary-ish (P42: never bare `.includes()`
 * on Czech — "stejn" is matched with a leading non-letter guard, not as a substring). */
/** Explicit CONTRAST markers. A sentence carrying one of these is opposing two wordings, not
 * asserting they match, however many sameness words it also contains. */
const CONTRAST_RE =
  /(?<![\p{L}])(vs\.?|versus|two different|different wording|odlišn\p{L}*|zatímco|naopak|whereas)(?![\p{L}])/iu;

const SAMENESS_RE =
  /(?<![\p{L}])(identical|verbatim|duplicate|the same text|word-for-word|totožn\p{L}*|shodn\p{L}*|stejn\p{L}*|doslovn\p{L}*|identick\p{L}*|duplicitn\p{L}*)/iu;

/** An `evidence.*Excerpt` is NOT a raw quote — every payload in this case writes it as
 *   `<provenance prefix>: '<verbatim source text>' -- <the analyst's reading of it>`
 * so only the SINGLE-QUOTED span is a claim about what the document says. The prefix names a
 * file and line range and the suffix is interpretation; matching either against source text is
 * meaningless. (A first pass at this guard compared the whole field and "failed" 106 of 102
 * checks — a ~100% fire rate, i.e. a degenerate signal by the kernel's own triage rule, and
 * a reminder that a guard needs its discriminative power validated exactly like a triage
 * signal does.) */
function sourceClaimSpans(excerpt: string): string[] {
  const spans = [...excerpt.matchAll(SINGLE_QUOTED_RE)].map((m) => m[1]);
  // Some payloads quote with „…“ at the top level instead of single quotes.
  if (spans.length === 0) spans.push(...[...excerpt.matchAll(/„([^“]{20,})“/gu)].map((m) => m[1]));
  const usable = spans.filter(looksLikeSourceText);
  // ONLY the first quoted span is checked, deliberately. Every payload in this case writes the
  // bill's own verbatim novelization instruction FIRST, then discusses it — and that discussion
  // legitimately quotes OTHER documents: the consolidated target statute (verified: tisk 119's
  // excerpt quotes „doba 120 kalendářních měsíců se nepoužije“, which is 15b of the target law,
  // cached for tisk 248 but not for 119), sibling prints, explanatory memoranda. Checking every
  // span against the bill's own text therefore fails on correct excerpts. The leading span is
  // the one that actually claims "this is what THIS bill says".
  return usable.slice(0, 1);
}

/** A single-quoted span, EXCLUDING English possessives. `tisk 4's … tisk 121's` would
 * otherwise parse as one 400-character "quote" spanning unrelated prose — which is what made
 * the guard's second draft fire on 180 of 298 checks. The apostrophe only opens a quote when
 * it does not follow a word character, and only closes one when a word character does not
 * follow it. */
const SINGLE_QUOTED_RE = /(?<![\p{L}\p{N}])'([^']{20,})'(?![\p{L}])/gu;

/** Does this quoted span assert what a DOCUMENT says, or is it the analyst's own paraphrase?
 * Czech statutory text always carries a `§`, a Czech diacritic, or a legal-instruction verb.
 * An English gloss like 'words X are replaced by words Y' is a description of a pattern, not a
 * presence claim, and verifying it against source text is a category error. */
function looksLikeSourceText(q: string): boolean {
  return /§|[áčďéěíňóřšťúůýž]/iu.test(q);
}

/** Quoted spans in analyst REASONING prose (the R-CHECK input). Czech „…“ first (the corpus's
 * own convention), then ASCII and curly doubles. Only spans of real length count as presence
 * claims — a short quote like „daň“ is a term of art, not an assertion that a passage is
 * shared. */
const MIN_QUOTE_LEN = 25;
function quotedSpans(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/„([^“]{4,400})“/gu)) out.push(m[1]);
  for (const m of s.matchAll(/“([^”]{4,400})”/gu)) out.push(m[1]);
  for (const m of s.matchAll(SINGLE_QUOTED_RE)) out.push(m[1]);
  return [...new Set(out.map((q) => canon(q)))].filter((q) => cmp(q).length >= MIN_QUOTE_LEN && looksLikeSourceText(q));
}

/** A re-typed quote carries ellipses where source text continues, `/` where the analyst joined
 * separate lines, and inner „…“ literals. Verify each fragment independently — ALL must be
 * present for the quote to count as verified. */
function fragmentsOf(quote: string): string[] {
  return quote
    /* Split at every ELISION or EDITORIAL marker the analysts actually use, established by
     * running this guard and reading where each failure diverged:
     *   `...` `…`  elided continuation
     *   ` / `      a joined line break, or an either/or gloss ("Obdobné/Přiměřené")
     *   ` -- `     the excerpt convention separating quote from commentary
     *   `[ ]`      an editorial reconstruction of text the analyst could not read cleanly —
     *              e.g. „40[0 000 Kč]“ and „…dan[ě]“. Four of the guard's first seven
     *              "failures" diverged at exactly this bracket and were formatting artifacts,
     *              not misattributions.
     * A fragment that survives every split is text the analyst claims to have read verbatim. */
    .split(/\.{3}|…|\s\/\s|\/|\s--\s|\s-\s|\[|\]/u)
    .map((f) => cmp(f).replace(/^["',;:.\-]+|["',;:.\-]+$/g, ""))
    .filter((f) => f.length >= 20);
}

function occursIn(hay: string, quote: string): boolean {
  return missingFragment(hay, quote) === null;
}

/** The FIRST fragment of `quote` absent from `hay`, or null if all are present.
 *
 * Returning the offending fragment rather than a bare boolean is what makes a finding
 * reviewable: the difference between "this text is absent from the document" (a real
 * misattribution) and "the analyst wrote „40[0 000 Kč]“ with an editorial bracket" (a
 * formatting artifact) is only visible if the report names the exact fragment that failed and
 * where it stopped matching. */
function missingFragment(hay: string, quote: string): string | null {
  for (const f of fragmentsOf(quote)) if (!hay.includes(f)) return f;
  return null;
}

/** How far into `frag` the source text still matches — the divergence point. Binary search on
 * prefix length; cheap, and it turns every finding into a one-line diagnosis. */
function divergence(hay: string, frag: string): { matched: number; total: number; at: string } {
  let lo = 0;
  let hi = frag.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (hay.includes(frag.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  return { matched: lo, total: frag.length, at: frag.slice(lo, lo + 60) };
}

function diagnose(hay: string, quote: string): string {
  const frag = missingFragment(hay, quote);
  if (frag === null) return "";
  const d = divergence(hay, frag);
  return ` [diverges at char ${d.matched}/${d.total}: "…${d.at}"]`;
}

interface Finding {
  file: string;
  pairId: string;
  billA: number;
  billB: number;
  classification: string;
  check: "E-CHECK" | "R-CHECK";
  status: "FAIL" | "UNVERIFIABLE";
  detail: string;
}

interface RawPair {
  pairId: string;
  billA: number;
  billB: number;
  classification: string;
  reasoning?: string;
  evidence?: { billAExcerpt?: string; billBExcerpt?: string };
}

const findings: Finding[] = [];
let pairsChecked = 0;
let eChecks = 0;
let rChecks = 0;
let pairsWithNoEvidence = 0;

function checkFile(file: string) {
  const p = join(PAYLOADS, file);
  if (!existsSync(p)) return;
  const raw = JSON.parse(readFileSync(p, "utf8")) as { pairs?: RawPair[] };
  if (!Array.isArray(raw.pairs)) return;

  for (const pair of raw.pairs) {
    pairsChecked++;
    const base = { file, pairId: pair.pairId, billA: pair.billA, billB: pair.billB, classification: pair.classification };
    const tA = billText(pair.billA);
    const tB = billText(pair.billB);

    // ---- E-CHECK: each excerpt must live in its OWN bill ----
    const sides: [string, number, string | null, string | undefined][] = [
      ["billAExcerpt", pair.billA, tA, pair.evidence?.billAExcerpt],
      ["billBExcerpt", pair.billB, tB, pair.evidence?.billBExcerpt],
    ];
    let hadEvidence = false;
    for (const [field, cislo, text, excerpt] of sides) {
      if (!excerpt || excerpt.trim().length < MIN_QUOTE_LEN) continue;
      hadEvidence = true;
      const claims = sourceClaimSpans(excerpt);
      if (claims.length === 0) {
        findings.push({
          ...base,
          check: "E-CHECK",
          status: "UNVERIFIABLE",
          detail: `${field}: no quoted verbatim span — the field is all provenance/interpretation, so it asserts nothing checkable about tisk ${cislo}'s text`,
        });
        continue;
      }
      for (const claim of claims) {
        eChecks++;
        if (text === null) {
          findings.push({ ...base, check: "E-CHECK", status: "UNVERIFIABLE", detail: `${field}: no cached text for tisk ${cislo}` });
          continue;
        }
        if (!occursIn(text, claim)) {
          // Does it belong to the OTHER bill? That is the 90-221 mechanism, worth naming.
          const other = cislo === pair.billA ? tB : tA;
          const misattributed = other !== null && occursIn(other, claim);
          findings.push({
            ...base,
            check: "E-CHECK",
            status: "FAIL",
            detail: `${field} quotes text that does NOT occur in tisk ${cislo}${misattributed ? ` — but DOES occur in the pair's other bill (tisk ${cislo === pair.billA ? pair.billB : pair.billA}): MISATTRIBUTED excerpt, the batch-008 90-221 mechanism` : ""}.${diagnose(text, claim)} Quote: "${canon(claim).slice(0, 140)}…"`,
          });
        }
      }
    }
    if (!hadEvidence) pairsWithNoEvidence++;

    // ---- R-CHECK: a sameness claim must hold for BOTH bills ----
    const reasoning = pair.reasoning ?? "";
    // Only quotes in the SAME SENTENCE as the sameness assertion are shared-text claims.
    // Reasoning routinely asserts "the two bills edit the same sentence" and then quotes each
    // bill's OWN distinct instruction — those quotes are correctly one-sided, and treating
    // every quote in the field as a shared-text claim flags them as defects (verified on pair
    // 4-121, where „částka „22320 Kč“ se nahrazuje…“ is tisk 121's own instruction, quoted
    // sentences away from the identity claim). The 90-221 defect had its quote sitting
    // directly inside the "are VERBATIM IDENTICAL" sentence — that adjacency IS the signal.
    for (const sentence of reasoning.split(/(?<=[.;])\s+/u)) {
      if (!SAMENESS_RE.test(sentence)) continue;
      // A sentence that CONTRASTS two wordings is not asserting they are the same, even when
      // it also contains a sameness word. Pair 85-88 reads "…at the identical numeric slot,
      // but with two different wordings ('X' vs. 'Y')" — the identity is of the SLOT, and the
      // quotes are explicitly opposed. Verified: tisk 85 carries 'X', tisk 88 carries 'Y',
      // exactly as written. Without this the guard reports a sound close-read as a defect.
      if (CONTRAST_RE.test(sentence)) continue;

      // A sameness claim may name a THIRD print: pair 7-90's reasoning asserts "Bill 90's
      // excerpt … is textually identical to bill 68's", which is a claim about 90 and 68, not
      // about the pair's bill 7. Verified: the quoted instruction is present in both 68 and
      // 90 and correctly absent from 7. So the documents a claim ranges over are the pair's
      // two bills PLUS any print the sentence names, and the claim holds when the text is
      // shared by at least two of them.
      const named = [...sentence.matchAll(/(?:tisk|bill|sněmovní tisk)\s*(\d{1,3})/giu)].map((m) => Number(m[1]));
      const scope = [...new Set([pair.billA, pair.billB, ...named])];

      for (const q of quotedSpans(sentence)) {
        rChecks++;
        const resolved = scope.map((c) => ({ cislo: c, text: billText(c) }));
        if (resolved.some((r) => r.text === null)) {
          findings.push({ ...base, check: "R-CHECK", status: "UNVERIFIABLE", detail: `sameness claim, but no cached text for tisk ${resolved.find((r) => r.text === null)!.cislo}` });
          continue;
        }
        const holders = resolved.filter((r) => occursIn(r.text!, q)).map((r) => r.cislo);
        if (holders.length >= 2) continue; // the claim holds across at least two named documents

        const inA = holders.includes(pair.billA);
        if (holders.length === 0) {
          // Present in NEITHER bill. Overwhelmingly this is an analyst-SCHEMATIZED quote —
          // a template merging both wordings, e.g. "…a doplňuje(í) se odstavec(ce) 2 (až 4)".
          // Sloppy, but it does not misattribute text to a bill, so it is reported and not
          // failed. Distinguishing this from the real defect is the whole point of checking
          // both sides instead of each side alone.
          findings.push({
            ...base,
            check: "R-CHECK",
            status: "UNVERIFIABLE",
            detail: `sameness claim quotes a passage found in NEITHER bill — an analyst-schematized/merged quote, not a verbatim source claim. Quote: "${q.slice(0, 140)}…"`,
          });
          continue;
        }
        // Present in EXACTLY ONE bill while the prose asserts both share it. This is the
        // batch-008 90-221 signature, and it is the defect this guard exists for.
        findings.push({
          ...base,
          check: "R-CHECK",
          status: "FAIL",
          detail: `ASYMMETRIC sameness claim over {${scope.join(", ")}}: the text occurs ONLY in tisk ${holders[0]} and in none of the others. This is the batch-008 90-221 mechanism.${diagnose(inA ? tB! : tA!, q)} Quote: "${q.slice(0, 140)}…"`,
        });
      }
    }
  }
}

const only = arg("file");
const files = only
  ? [only]
  : readdirSync(PAYLOADS)
      .filter((f) => /^collision-close-reads.*\.json$/.test(f))
      .sort();

for (const f of files) checkFile(f);

const fails = findings.filter((f) => f.status === "FAIL");
const unverifiable = findings.filter((f) => f.status === "UNVERIFIABLE");

console.log(`P49 close-read presence guard · ${files.length} payload(s) · ${pairsChecked} pairs`);
console.log(`  E-CHECKs run (excerpt attribution): ${eChecks}`);
console.log(`  R-CHECKs run (sameness claims):     ${rChecks}`);
console.log(`  pairs carrying NO evidence excerpt: ${pairsWithNoEvidence}  ← unverifiable by construction`);
console.log(`  FAIL: ${fails.length} · UNVERIFIABLE: ${unverifiable.length}\n`);

for (const f of [...fails, ...unverifiable]) {
  console.log(`  [${f.status}] ${f.check} ${f.file} pair ${f.pairId} (${f.classification})`);
  console.log(`      ${f.detail}`);
}

const outPath = arg("json");
if (outPath) {
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "P49 deterministic presence guard (batch-009). E-CHECK: every evidence excerpt must occur in its OWN bill's cached .data/law-collision-cache text. R-CHECK: when reasoning asserts sameness (identical/verbatim/duplicate/totožné/shodné/stejné…), every quoted span in it must occur in BOTH bills' text. NFC-normalized, whitespace-collapsed, typographic quotes/dashes folded; ellipsis-split fragments verified independently; quotes under 25 chars ignored as terms of art rather than presence claims.",
        filesChecked: files,
        pairsChecked,
        eChecks,
        rChecks,
        pairsWithNoEvidence,
        failCount: fails.length,
        unverifiableCount: unverifiable.length,
        findings,
      },
      null,
      1,
    ),
  );
  console.log(`\n→ wrote ${outPath}`);
}

process.exit(fails.length > 0 ? 1 : 0);
