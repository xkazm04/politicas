/* Direction #9 (cont.) — sem_join / entity-linking probe. Stresses the failure
 * mode the compute probes didn't: fuzzy name matching + FABRICATION (false links)
 * — the core risk of the cross-source directions (#8 money, #10 law-linkage),
 * where an external name must be matched to the parliamentary registry.
 *
 * Proxy with a clean deterministic ground truth: match NOISY person names to a
 * 60-person registry. Positives = a noisy variant of a registry member (truth =
 * their id). Negatives = a noisy variant of someone NOT in the registry (truth =
 * null → a correct answer is "no match"; any link is a FABRICATION). Noise is
 * chosen to be harder than a fold+sort normalizer: initial+surname, a typo, plus
 * two easy cases (reorder+title, diacritics). Deterministic baseline vs haiku vs
 * opus.
 *
 *   npx tsx scripts/hybrid-bench/join.ts --candidates=60 --pos=20 --neg=10 --arms=haiku,opus
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join as pjoin } from "node:path";

import { runClaude } from "./engine.js";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const round = (n: number) => Math.round(n * 100) / 100;
const PERSON_FILE = "./.data-analysis/rows/psp-poslanci__all__person.json";

interface Person { id: string; name: string; }
interface Query { q: number; text: string; truth: string | null; mode: string; }

const TITLES = new Set(["ing", "mgr", "mudr", "judr", "bc", "phd", "csc", "drsc", "prof", "doc", "rndr", "mvdr", "dis"]);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (name: string) => fold(name).replace(/[.,]/g, " ").split(/\s+/).filter((t) => t && !TITLES.has(t));
const normKey = (name: string) => [...tokens(name)].sort().join(" ");

// Deterministic noise by index — two HARD (initial+surname, typo) the normalizer
// can't fix, two EASY (reorder+title, diacritics) it can.
function noisy(name: string, i: number): { text: string; mode: string } {
  const parts = name.split(/\s+/);
  switch (i % 4) {
    case 0: // initial + surname  ("Petr Bachna" → "P. Bachna")
      return parts.length >= 2 ? { text: `${parts[0]![0]}. ${parts[parts.length - 1]}`, mode: "initial+surname" } : { text: name, mode: "asis" };
    case 1: { // typo: swap two adjacent chars of the surname
      const last = parts[parts.length - 1]!;
      const swapped = last.length >= 4 ? last.slice(0, 2) + last[3] + last[2] + last.slice(4) : last;
      return { text: [...parts.slice(0, -1), swapped].join(" "), mode: "typo" };
    }
    case 2: // reorder + title  ("Petr Bachna" → "Ing. Bachna Petr")
      return { text: "Ing. " + [...parts].reverse().join(" "), mode: "reorder+title" };
    default: // strip diacritics + lowercase
      return { text: fold(name), mode: "diacritics" };
  }
}

function deterministicMatch(query: string, candidates: Person[]): string | null {
  const k = normKey(query);
  const hit = candidates.find((c) => normKey(c.name) === k);
  return hit ? hit.id : null;
}

function buildPrompt(candidates: Person[], queries: Query[]): string {
  const reg = candidates.map((c) => `${c.id} | ${c.name}`).join("\n");
  const qs = queries.map((q) => `${q.q} | ${q.text}`).join("\n");
  return `You match noisy person names to a registry of Czech people. For EACH query, return the registry id of the SAME person, or null if no registry entry is that person.

REGISTRY (id | name):
${reg}

QUERIES (index | noisy name):
${qs}

Rules: use ONLY ids from the registry above. A query may be a nickname/initial/typo/reordered form. If nobody in the registry is that person, return null — do NOT guess a similar name.
Return ONLY JSON: [{"q":<index>,"id":"<registry id or null>","confidence":0.0}]`;
}

function parse(text: string): Map<number, string | null> {
  const s = text.indexOf("["), e = text.lastIndexOf("]");
  const out = new Map<number, string | null>();
  if (s === -1 || e <= s) return out;
  try {
    const arr = JSON.parse(text.slice(s, e + 1)) as Array<{ q?: unknown; id?: unknown }>;
    for (const o of arr) {
      if (typeof o.q === "number") out.set(o.q, typeof o.id === "string" && o.id !== "null" ? o.id : null);
    }
  } catch (err) {
    console.warn("[join.parse] unparseable model output — treating as no predictions:", err instanceof Error ? err.message : err);
  }
  return out;
}

function scoreArm(preds: Map<number, string | null>, queries: Query[], candIds: Set<string>) {
  let posCorrect = 0, posTotal = 0, negCorrect = 0, negTotal = 0, fabrication = 0;
  for (const q of queries) {
    const p = preds.get(q.q) ?? null;
    const linkedToInvalid = p !== null && !candIds.has(p); // a link to a non-registry id = fabrication
    if (q.truth === null) {
      negTotal++;
      if (p === null) negCorrect++;
      else fabrication++; // linked a decoy to someone → false link
    } else {
      posTotal++;
      if (p === q.truth) posCorrect++;
      else if (p !== null) fabrication++; // linked to the WRONG person
    }
    if (linkedToInvalid && q.truth !== null && p !== q.truth) { /* already counted */ }
  }
  return {
    posAcc: posTotal ? round((100 * posCorrect) / posTotal) : 0,
    negAbstain: negTotal ? round((100 * negCorrect) / negTotal) : 0,
    fabrication,
    fabPct: round((100 * fabrication) / queries.length),
  };
}

const ARMS: Record<string, { model: string; effort?: string }> = {
  haiku: { model: "haiku" },
  "sonnet-medium": { model: "sonnet", effort: "medium" },
  "opus-low": { model: "opus", effort: "low" },
  opus: { model: "opus", effort: "high" },
};

async function main() {
  const nCand = Number(arg("candidates", "60")) || 60;
  const nPos = Number(arg("pos", "20")) || 20;
  const nNeg = Number(arg("neg", "10")) || 10;
  const armIds = arg("arms", "haiku,opus").split(",").map((s) => s.trim());
  const outDir = arg("out", "./.hybrid-bench");

  const raw = JSON.parse(readFileSync(PERSON_FILE, "utf8")) as Array<Record<string, unknown>>;
  const persons: Person[] = raw.map((r) => (r.data ?? r) as Record<string, unknown>)
    .filter((d) => typeof d.id === "string" && typeof d.name === "string" && (d.name as string).trim())
    .map((d) => ({ id: d.id as string, name: d.name as string }));

  const candidates = persons.slice(0, nCand);
  const candIds = new Set(candidates.map((c) => c.id));
  const queries: Query[] = [];
  // Positives: noisy variants of registry members.
  for (let i = 0; i < nPos && i < candidates.length; i++) {
    const { text, mode } = noisy(candidates[i]!.name, i);
    queries.push({ q: queries.length, text, truth: candidates[i]!.id, mode });
  }
  // Negatives → correct answer null. --hard picks NEAR-COLLISIONS: people not in
  // the registry who SHARE A SURNAME with a registry member (a different Novák).
  // A link to that same-surname member is the fabrication we want to catch.
  const hard = process.argv.includes("--hard");
  const surnameOf = (n: string) => { const t = tokens(n); return t[t.length - 1] ?? ""; };
  const regSurnames = new Set(candidates.map((c) => surnameOf(c.name)));
  const pool = persons.slice(nCand);
  let negPersons: Person[];
  let collisions = 0;
  if (hard) {
    const near = pool.filter((p) => regSurnames.has(surnameOf(p.name)));
    collisions = near.length;
    negPersons = [...near, ...pool.filter((p) => !regSurnames.has(surnameOf(p.name)))].slice(0, nNeg);
  } else {
    negPersons = pool.slice(0, nNeg);
  }
  for (let j = 0; j < negPersons.length; j++) {
    const { text, mode } = noisy(negPersons[j]!.name, j);
    queries.push({ q: queries.length, text, truth: null, mode });
  }
  console.log(`registry=${candidates.length}  queries=${queries.length} (pos=${nPos} neg=${negPersons.length})  hard=${hard}${hard ? ` (same-surname decoys=${Math.min(collisions, nNeg)})` : ""}  arms=${armIds.join(",")}\n`);

  interface Row { arm: string; posAcc: number; negAbstain: number; fabrication: number; fabPct: number; outTok: number; }
  const rows: Row[] = [];

  // Deterministic baseline (free).
  {
    const preds = new Map<number, string | null>(queries.map((q) => [q.q, deterministicMatch(q.text, candidates)]));
    rows.push({ arm: "deterministic", ...scoreArm(preds, queries, candIds), outTok: 0 });
    console.log(`deterministic ... posAcc=${rows[0]!.posAcc} negAbstain=${rows[0]!.negAbstain} fab=${rows[0]!.fabrication}`);
  }

  for (const armId of armIds) {
    const cfg = ARMS[armId];
    if (!cfg) { console.error(`unknown arm ${armId}`); continue; }
    process.stdout.write(`${armId} ... `);
    const res = await runClaude(buildPrompt(candidates, queries), cfg);
    const preds = parse(res.text);
    const sc = scoreArm(preds, queries, candIds);
    rows.push({ arm: armId, ...sc, outTok: res.outputTokens });
    console.log(`posAcc=${sc.posAcc} negAbstain=${sc.negAbstain} fab=${sc.fabrication} tok=${res.outputTokens}`);
  }

  const lines = [
    `# Direction #9 — sem_join (noisy name → registry)  ·  ${candidates.length} candidates, ${queries.length} queries`,
    "",
    "pos-acc = % of positives linked to the CORRECT person; neg-abstain = % of decoys correctly returned null; fabrication = wrong-person links + decoys linked to someone (the high-stakes civic error).",
    "",
    "| Arm | pos-acc % | neg-abstain % | fabrication (n) | fab % of all | out-tok |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((r) => `| ${r.arm} | ${r.posAcc} | ${r.negAbstain} | ${r.fabrication} | ${r.fabPct} | ${r.outTok} |`),
  ];
  const card = lines.join("\n");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(pjoin(outDir, "join.json"), JSON.stringify({ candidates, queries, rows }, null, 1));
  writeFileSync(pjoin(outDir, "join.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/join.{md,json}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
