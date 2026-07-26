/* Case ② Effort — GATE the batch wire proposals against the graph COPY.
 *
 * id-membership validation (the kg-verdict pattern): every proposed prop target
 * must resolve to a real person node in the graph, and the enrichment props must
 * be structurally sane (no contribution_* number proposed — computeContribution
 * owns those). Drops + logs any failure; NEVER writes.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts [payload-file]
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts payloads/batch-002-props.json
 */
import { readFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";

const FORBIDDEN_PROP = /^(contribution_score|participation_rate|committee_count|leadership_count|absence_rate|bills_authored|interpellations|speech_turns|contribution_provenance)$/;
const LOW_SCORE_REASONS = new Set(["minister", "deputy_pm", "prime_minister", "opposition_leader", "replacement", "new_mp", "dual_mandate", "genuine_absentee", "low_legislative_output", "declined_mandate", "institutional_promotion", "unknown"]);

// ── Q-effort-11 (batch 004): prose-vs-props cross-check ──────────────────────
// A deterministic sibling of the Opus-verification lesson from batch 003:
// effort_notes / effort_bill_focus prose sometimes cites a COUNT (bills,
// interpellations, speeches, tenure) that drifts from the node's own
// deterministic props. Extract Czech/Arabic numerals tied to a small set of
// countable nouns and compare against the props on the SAME proposal (or,
// where the proposal doesn't carry the prop itself — e.g. tenure days come
// from a separate tenure payload — a caller-supplied `graphProps` lookup).
// Soft-fail only: prints a WARNING with both numbers, never drops the proposal
// (a reviewer decides — prose can legitimately describe a subset, e.g.
// "predkladatel" vs "spolupodepsal" rank, case gate (e)).
const CZECH_NUM_WORDS: Record<string, number> = {
  jednoho: 1, jeden: 1, jedna: 1,
  dva: 2, dvou: 2, dvě: 2,
  tři: 3, tří: 3,
  čtyři: 4, čtyř: 4,
  pět: 5, pěti: 5,
  šest: 6, šesti: 6,
  sedm: 7, sedmi: 7,
  osm: 8, osmi: 8,
  devět: 9, devíti: 9,
  deset: 10, deseti: 10,
};

interface NumericClaim { count: number; noun: string; raw: string }

/** Extract "<number> <noun>" claims (Arabic or spelled-out Czech numerals) tied to
 *  countable nouns this loop cares about: tisky/bills, interpelace, projevy/speech
 *  turns, měsíce/tenure. */
function extractNumericClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];
  const nounGroups: { re: RegExp; noun: string }[] = [
    { re: /tisk(?:y|ů|u)?/i, noun: "bills" },
    { re: /interpelac[ei](?:ch|í)?/i, noun: "interpellations" },
    { re: /projev(?:y|ů|u)?|vystoupen[íi](?:ch|m)?/i, noun: "speeches" },
    { re: /měsíc(?:e|ů|i)?/i, noun: "tenure_months" },
  ];
  // Arabic numerals: "6 tisků", "2+1 tisků", "~4 měsíce", "za pouhých ~4 měsíce"
  const arabicRe = /~?\s*(\d+)\s*(?:\+\s*\d+\s*)?~?\s*([a-záčďéěíňóřšťúůýž]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = arabicRe.exec(text))) {
    const word = m[2];
    const count = Number(m[1]);
    if (count > 50) continue; // guards against years ("2026 tisk 28") misread as a count
    const group = nounGroups.find((g) => g.re.test(word));
    if (group) claims.push({ count, noun: group.noun, raw: m[0] });
  }
  // Spelled-out Czech numerals: "šesti autorsky vedených tisků", "čtyři interpelace".
  // NOTE: plain \b is ASCII-only in JS (\w = [A-Za-z0-9_]) and silently fails to bound
  // words starting/ending in Czech diacritics (š, č, ř, ě…) — use \p{L} lookaround
  // (unicode flag) instead, or "šesti" never matches at all.
  // batch-005 reflection fix: "ani jednoho tisku" / "žádného tisku" are Czech NEGATIVES
  // ("not one bill" / "no bill"), not a claim of count 1 — a preceding "ani"/"žádn*"
  // (allowing a short gap, e.g. "ani u jednoho") flips the numeral into a negation and
  // must not be read as a numeric claim at all (caught false-positiving on Ančincová's
  // "u ani jednoho tisku není prvním předkladatelem").
  const spelledRe = new RegExp(`(?<![\\p{L}])(${Object.keys(CZECH_NUM_WORDS).join("|")})(?![\\p{L}])([^.,;]{0,40})`, "giu");
  while ((m = spelledRe.exec(text))) {
    const num = CZECH_NUM_WORDS[m[1].toLowerCase()];
    const tail = m[2];
    const precedingWindow = text.slice(Math.max(0, m.index - 20), m.index);
    if (/\b(ani|žádn[ýáéíůouě]*)\b\s*(u\s+)?$/iu.test(precedingWindow)) continue; // negation, not a count
    const group = nounGroups.find((g) => g.re.test(tail));
    if (group) claims.push({ count: num, noun: group.noun, raw: m[0].trim() });
  }
  return claims;
}

const PROP_FOR_NOUN: Record<string, string> = {
  bills: "bills_authored",
  interpellations: "interpellations",
  speeches: "speech_turns",
  // tenure_months has no direct contribution_* prop — cross-checked against
  // effort_tenure_days (persisted batch-003+) converted to whole months, with a
  // ±20-day tolerance for "~N měsíce"-style hedged prose.
  tenure_months: "effort_tenure_days",
};

/** Returns WARNING strings (never DROP reasons) for numeric prose/props mismatches.
 *  `graphNumericProps` is the deterministic-owned prop bag for this person
 *  (contribution_* fields) read from the graph, since bills_authored etc. are
 *  gate-forbidden on the proposal itself — the prose is compared against the
 *  SOURCE OF TRUTH, not against another LLM-authored number. */
function proseVsPropsWarnings(prop: { id: string; name: string; props: Record<string, unknown>; headline?: string }, graphNumericProps: Record<string, number | null | undefined>): string[] {
  const warnings: string[] = [];
  // batch-004 reflection (Opus QA) fix: the real Výborný "šesti autorsky vedených tisků"
  // defect lived in effort_public_role, which this scan did NOT cover — the gate's
  // headline "2/2 caught" claim for Q-effort-11 was wrong because of exactly this gap.
  // `headline` is also now scanned: it is the single most public-facing string in the
  // payload and where this batch's order-of-magnitude money slips lived (Kolovratník's
  // "desítky milionů" vs his own notes' 564 mil. Kč — a headline-vs-notes case the old
  // scope could never reach).
  const proseFields = ["effort_notes", "effort_bill_focus", "effort_public_role"].filter((k) => typeof prop.props[k] === "string") as string[];
  const textsToScan: { field: string; text: string }[] = proseFields.map((field) => ({ field, text: prop.props[field] as string }));
  if (typeof prop.headline === "string") textsToScan.push({ field: "headline", text: prop.headline });
  for (const { field, text } of textsToScan) {
    for (const claim of extractNumericClaims(text)) {
      const propKey = PROP_FOR_NOUN[claim.noun];
      const actual = graphNumericProps[propKey];
      if (typeof actual !== "number") continue;
      if (claim.noun === "tenure_months") {
        const claimedDays = claim.count * 30;
        if (Math.abs(actual - claimedDays) > 20 + 30) { // ±20d hedge tolerance, +1 month granularity slack
          warnings.push(`${prop.id} (${prop.name}) — ${field} claims "${claim.raw.trim()}" (~${claim.count} months ≈ ${claimedDays}d) but graph effort_tenure_days=${actual}`);
        }
        continue;
      }
      if (actual !== claim.count) {
        warnings.push(`${prop.id} (${prop.name}) — ${field} claims "${claim.raw.trim()}" (${claim.count} ${claim.noun}) but graph ${propKey}=${actual}`);
      }
    }
  }
  return warnings;
}

// ── Q-effort-14 (batch 006): PUBLIC-COPY check on verbatim-rendered fields ───
// batch 005's reflection wrote the lesson "public-render fields need a 'would I
// show this to a voter' check, SEPARATE from factual-accuracy checks" after
// finding 4 leaking profiles. Batch 006 found the same class in 99 field
// instances across 42/42 dossiers — i.e. the prose lesson did not survive
// contact with a new army. So it becomes CODE here.
//
// effort_notes / effort_public_role / effort_bill_focus render VERBATIM to end
// users on /poslanec (DossierSection "Poznámky k datům" / "Veřejná role" /
// "Legislativní stopa", and effort_public_role also via LowScoreReasonBadge).
// A raw pipeline identifier or an internal process reference in those strings is
// never legitimate reader copy, regardless of whether the statement is TRUE —
// which is exactly why an accuracy-only gate passed all 99.
//
// Hard DROP (never valid public copy): raw prop/field identifiers, internal case
// names, gate-rule citations, batch/sample self-references, API mechanics.
// Rules live in lib/analysis/public-copy.ts — the SAME module getProfileData.ts and
// getLeaderboardData.ts import for render-time withholding, so persist-time DROP and
// render-time withhold can never diverge again (batch 006 introduced this module with
// that intent but gate.ts kept a local fork missing the "API/pipeline mechanics" rule
// until Q-effort-15 (batch 007) unified them).
const PUBLIC_RENDER_FIELDS = ["effort_notes", "effort_public_role", "effort_bill_focus"] as const;

/** DROP reasons for pipeline jargon in verbatim-rendered public copy. */
function publicCopyViolations(prop: { id: string; name: string; props: Record<string, unknown> }): string[] {
  const out: string[] = [];
  for (const field of PUBLIC_RENDER_FIELDS) {
    const text = prop.props[field];
    if (typeof text !== "string") continue;
    for (const { what, match } of jargonViolationDetails(text)) {
      out.push(`${field} contains ${what} ${JSON.stringify(match)} — this string renders verbatim on /poslanec`);
    }
  }
  return out;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const payloadFile = process.argv[2] ?? "batch-001-props.json";
  const payloadPath = payloadFile.includes("/") ? `docs/data-analysis/case-effort/${payloadFile}` : `docs/data-analysis/case-effort/payloads/${payloadFile}`;
  const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const personIds = new Set(persons.map((p) => p.id));

  let ok = 0;
  const drops: string[] = [];
  const warnings: string[] = [];
  for (const prop of payload.proposals as { id: string; name: string; props: Record<string, unknown> }[]) {
    if (!personIds.has(prop.id)) {
      drops.push(`${prop.id} (${prop.name}) — id not a person node in graph`);
      continue;
    }
    const forbidden = Object.keys(prop.props).filter((k) => FORBIDDEN_PROP.test(k));
    if (forbidden.length) {
      drops.push(`${prop.id} (${prop.name}) — proposes deterministic-owned prop(s): ${forbidden.join(", ")}`);
      continue;
    }
    // every effort_* prop must be namespaced
    const badNs = Object.keys(prop.props).filter((k) => !k.startsWith("effort_"));
    if (badNs.length) {
      drops.push(`${prop.id} (${prop.name}) — non-namespaced prop(s): ${badNs.join(", ")}`);
      continue;
    }
    // effort_low_score_reason, if present, must be from the closed vocabulary
    const reason = prop.props.effort_low_score_reason as string | undefined;
    if (reason !== undefined && !LOW_SCORE_REASONS.has(reason)) {
      drops.push(`${prop.id} (${prop.name}) — effort_low_score_reason "${reason}" not in the closed vocabulary`);
      continue;
    }
    // Q-effort-14: public-copy check on verbatim-rendered fields (batch 006).
    const copyViolations = publicCopyViolations(prop);
    if (copyViolations.length) {
      drops.push(`${prop.id} (${prop.name}) — public-copy violation(s): ${copyViolations.join(" · ")}`);
      continue;
    }
    ok++;
    // Q-effort-11: prose-vs-props numeric cross-check, sourced from this person's
    // deterministic graph props (not the proposal itself — those are gate-forbidden).
    const person = persons.find((p) => p.id === prop.id);
    if (person) {
      warnings.push(...proseVsPropsWarnings(prop, {
        bills_authored: person.props.bills_authored as number | undefined,
        interpellations: person.props.interpellations as number | undefined,
        speech_turns: person.props.speech_turns as number | undefined,
        effort_tenure_days: person.props.effort_tenure_days as number | undefined,
      }));
    }
  }

  console.log(`GATE · ${payload.proposals.length} proposals · ${ok} PASS · ${drops.length} DROP`);
  if (drops.length) {
    console.log("DROPS:");
    drops.forEach((d) => console.log(`  ✗ ${d}`));
  } else {
    console.log("All proposals reference real person nodes, are effort_*-namespaced, and touch no deterministic-owned number.");
  }
  if (warnings.length) {
    console.log(`\nQ-effort-11 WARNINGS (prose-vs-props numeric mismatch, soft-fail — reviewer decides) · ${warnings.length}:`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  } else {
    console.log("Q-effort-11: no prose-vs-props numeric mismatches detected.");
  }
  await store.close();
  process.exit(drops.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
