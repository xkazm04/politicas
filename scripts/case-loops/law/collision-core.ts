/* Case ③ Law loop — SHARED collision-text primitives (extracted batch-009).
 *
 * Same reason `triage-core.ts` exists: `collision-check-008.ts` owned the operative-slice /
 * §-extraction / per-statute partition logic privately, and the batch-009 sweep needs exactly
 * that logic over the same cached corpus. Copying it into a new `*-009.ts` script is the
 * copy-drift bug class batch-008's own lessons named (four of its scripts shipped byte-copied
 * prose describing events that never happened in that batch), so it is extracted once and
 * imported by both. Behaviour is unchanged — this is a move, not a rewrite.
 *
 * NFC normalization is applied at the single point cached text is read (batch-008's finding:
 * `pdftotext` can emit the SAME diacritic in two Unicode forms within ONE document, silently
 * breaking a regex literal).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { LAW_CITATION } from "@/lib/ingest/sources/psp-legislation";

export const CACHE_DIR = ".data/law-collision-cache";

/** Every cached document for one print, NFC-normalized and concatenated. */
export function readCachedBillText(cislo: number): string | null {
  const dir = join(CACHE_DIR, `tisk-${cislo}`);
  if (!existsSync(dir)) return null;
  const txts = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (txts.length === 0) return null;
  return txts.map((f) => readFileSync(join(dir, f), "utf8")).join("\n").normalize("NFC");
}

/** Restrict to the operative novelization text. "platné znění" docs (current law + marked
 * changes) carry no explanatory memo — used whole, with a defensive trim if one appears. Bill
 * documents are trimmed to Čl. I / ČÁST PRVNÍ … before DŮVODOVÁ ZPRÁVA, so citations of
 * unrelated law inside the memo do not leak into the §-set. */
export function operativeSlice(text: string): string {
  const memoIdx = text.search(/D[ůu]vodov[áa]\s+zpr[áa]va/i);
  const startMatch = text.match(/(^|\n)\s*(ČÁST PRVNÍ|Čl\.\s*I\b)/);
  const start = startMatch?.index ?? 0;
  const end = memoIdx > start ? memoIdx : text.length;
  return text.slice(start, end);
}

/** Base § reference extraction: "§ 35ba", "§35", "§ 38gb" → "35ba", "35", "38gb" (lowercased). */
export function extractParagraphs(text: string): string[] {
  const re = /§\s?(\d+[a-z]*)/gi;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) set.add(m[1].toLowerCase());
  return [...set].sort((a, b) => a.localeCompare(b, "cs"));
}

export interface StatutePartition {
  paragraphs: Set<string>;
  text: string;
}

/** Split a bill's operative text into per-target-statute §-sets, using the same Čl. N
 * article-boundary + first-citation-per-block convention as `amends-census.ts`. This is the
 * batch-004 Q-law-10 fix for the tisk-248 class of false positive: an omnibus bill's document
 * concatenates ALL its amended statutes, so a flat same-§-number check spuriously "collides"
 * §s that belong to DIFFERENT bundled statutes. Blocks with no citation of their own bucket
 * under "unknown" rather than being guessed. */
export function partitionParagraphsByStatute(operative: string): Map<string, StatutePartition> {
  const artRe = /\n\s*Čl\.\s*([IVXLCDM]+|\d+)\.?\s*\n/g;
  const arts: { label: string; idx: number }[] = [];
  let am: RegExpExecArray | null;
  while ((am = artRe.exec(operative))) arts.push({ label: am[1], idx: am.index });

  const byStatute = new Map<string, StatutePartition>();
  const addBlock = (ref: string, block: string) => {
    const entry = byStatute.get(ref) ?? { paragraphs: new Set<string>(), text: "" };
    for (const p of extractParagraphs(block)) entry.paragraphs.add(p);
    entry.text = entry.text ? `${entry.text}\n${block}` : block;
    byStatute.set(ref, entry);
  };

  if (arts.length === 0) {
    const m = LAW_CITATION.exec(operative);
    LAW_CITATION.lastIndex = 0;
    addBlock(m ? `${Number(m[1])}/${m[2]}` : "unknown", operative);
    return byStatute;
  }

  for (let i = 0; i < arts.length; i++) {
    const start = arts[i].idx;
    const end = i + 1 < arts.length ? arts[i + 1].idx : operative.length;
    const block = operative.slice(start, end);
    const head = block.slice(0, 800); // the citation always sits near an article's top
    const m = LAW_CITATION.exec(head);
    LAW_CITATION.lastIndex = 0;
    addBlock(m ? `${Number(m[1])}/${m[2]}` : "unknown", block);
  }
  return byStatute;
}

// ---------- batch-009: instruction-vs-citation discrimination ----------
//
// The single largest waste in the collision backlog is the INCIDENTAL class: a § number that
// merely APPEARS in a bill (as a cross-reference, inside quoted statutory text, or as an article
// number of the bill's own new act) matches a § another bill genuinely amends. Every incidental
// pair the driver hand-read in batch-009 was of this shape — tisk 228's "§ 15"/"§ 18" are the
// article numbers of its OWN act, and tisk 124/tisk 67 merely cite the § a sibling amends.
//
// Czech novelization instructions are a small closed grammar, which makes this decidable in code
// rather than by model. An instruction says what to DO to a §; a citation merely points at one.

const escapeNum = (num: string) => num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Start-of-clause anchor. An instruction opens its clause; a citation sits mid-sentence after
// a preposition ("podle § 8", "uvedený v § 8"). The `Čl\.` alternative is load-bearing and was
// added after validation: `pdftotext -layout` frequently renders an article label and its first
// instruction on ONE line ("Čl. VI V § 8 odst. 2 zákona č. 166/1993 Sb., … se slova"), and
// without it every single-article amendment in the corpus read as citation-only. That one gap
// produced all 3 false drops in the first validation run — i.e. it would have silently
// discarded three genuine findings.
const CLAUSE_START = `(^|\\n|\\d+\\.\\s*|\\.\\s+|Čl\\.\\s*[IVXLCDM\\d]+\\.?\\s+|ČÁST\\s+\\p{Lu}+\\s+)`;
// Between "§ N" and its verb: no sentence end, but an abbreviation's period is not one
// („§ 30 odst. 1 zní:" was read as a citation until 2026-10-10).
const TO_VERB = `(?:[^.\\n]|(?:odst|písm|č|bod|Sb)\\.)`;
const ODST = `(?:odst\\.|odstav\\p{L}*)`;
const ODST_LIST = `(\\d+(?:\\s*(?:a|až|,)\\s*\\d+)*)`;

/** Forms that ISSUE an edit instruction against § N. Anchored so a mid-sentence "podle § N"
 * cannot match: an instruction begins its clause (start of line, or after a "12." item number,
 * or after a sentence break).
 *
 * Case-SENSITIVE since 2026-10-10. Under `/i` a layout line break made „uvedený\nv § 228" an
 * instruction: `\n` is a clause start only for a capitalised „V". Over the 141 cached prints, the 9
 * operative pairs only `/i` admitted were 8 such citations and 1 insertion anchor. The `/i`-only
 * pairs are the ones the batch-016 audit (item 16) counted.
 *
 * „Za § N se vkládá …" is not here: it names § N as a POSITION — see `insertionTargets`. */
export function instructionFormsFor(num: string): RegExp[] {
  const n = escapeNum(num);
  const A = CLAUSE_START;
  return [
    // "1. V § 15 odst. 1 písm. b) se slova …" / "V § 26 se na konci …"
    new RegExp(`${A}V\\s*§\\s?${n}\\b`, "u"),
    // "§ 4c zní:" / "§ 22a včetně nadpisu zní:" / "§ 30 odst. 1 zní:" / "§ 4b se zrušuje." /
    // "§ 416 se včetně nadpisu zrušuje." (read as a citation until 2026-10-10)
    new RegExp(`${A}§\\s?${n}\\b${TO_VERB}{0,60}?(zní|znějí|se\\s+(?:včetně\\s+\\p{L}+\\s+)?zrušuj)`, "u"),
    // "V § 22a odstavce 1 a 2 znějí:" is covered by the first form; this catches
    // "§ 101a se odstavce 2 a 3 zrušují" style where the § leads without "V".
    new RegExp(`${A}§\\s?${n}\\s+se\\s+(odstav|písmen|slov|text|čísl)`, "u"),
  ];
}

/** Insertion instructions: „Za § 31 se vkládá nový § 31a", „se za § N vkládá …", „Nad označení
 * § N se vkládá …". The anchor § N is not edited; every § listed after „vkládá" is CREATED.
 * Batch-017 closure M11 corrected this in the census DATA only, from a private regex in
 * `archive/amended-paragraph-census-016.ts`. This is the one shared rule. Over the cached prints
 * it demotes 93 anchors and credits 242 inserted §§, against the census's 333 corrections. Two
 * bills inserting the same new § (tisk 4 and 112, § 31a of 117/1995) collide, and only this sees it. */
export function insertionTargets(text: string): { anchors: Set<string>; inserted: Set<string> } {
  const anchors = new Set<string>();
  const inserted = new Set<string>();
  const re =
    /(?:Za\s*§\s?(\d+[a-z]*)\s+se\s+vklád\p{L}*|se\s+za\s*§\s?(\d+[a-z]*)\s+vklád\p{L}*|Nad\s+označení\s*§\s?(\d+[a-z]*)\s+se\s+vklád\p{L}*)\s+(?:nov\p{L}*\s+)?(?:§+\s?(\d+[a-z]*)((?:\s*(?:a|až|,)\s*(?:§+\s?)?\d+[a-z]*)*))?/gu;
  for (const m of text.matchAll(re)) {
    anchors.add((m[1] ?? m[2] ?? m[3]).toLowerCase());
    if (!m[4]) continue;
    inserted.add(m[4].toLowerCase());
    for (const t of m[5]?.match(/\d+[a-z]*/g) ?? []) inserted.add(t.toLowerCase());
  }
  return { anchors, inserted };
}

/** „V § 199 odst. 1 a v § 303 odst. 1 se slova … nahrazují": ONE instruction, several targets.
 * Every § named between the clause-opening „V §" and the clause's „se" is edited. The `/i` grammar
 * reached the lowercase „a v § 303" only by luck: a layout line start, or the unanchored odstavec
 * reader, which also read „uvedené v § 30 odst. 3" inside quoted text. Of 11 sampled pairs that
 * reader alone named, 8 were joint clauses and 3 such citations. Over the cached prints this form
 * makes 171 more pairs operative; 10 of 10 sampled are genuine multi-target clauses. */
function jointClauses(text: string): string[] {
  const re = new RegExp(`${CLAUSE_START}V\\s*§(?:[^.]|(?:odst|písm|č|bod|Sb)\\.){0,300}?\\sse\\s`, "gu");
  return [...text.matchAll(re)].map((m) => m[0]);
}

/** „§ 280 až 282 se zrušují" / „§ 1826 a 1827 se zrušují": the grammar's § form reads only the
 * first number, so 281 and 282 were never amended. Every § in the range is repealed. */
export function repealedRange(text: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`${CLAUSE_START}§§?\\s?(\\d+[a-z]*)\\s+(a|až)\\s+(?:§\\s?)?(\\d+[a-z]*)\\s+se\\s+(?:včetně\\s+\\p{L}+\\s+)?zrušuj`, "gu");
  for (const m of text.matchAll(re)) {
    const [first, conj, last] = [m[2].toLowerCase(), m[3], m[4].toLowerCase()];
    out.add(first);
    out.add(last);
    const [a, b] = [Number(first), Number(last)];
    if (conj === "až" && String(a) === first && String(b) === last && b > a && b - a < 200) for (let k = a + 1; k < b; k++) out.add(String(k));
  }
  return out;
}

/** What a bill does to § `num`: edits it, creates it, names it as an insertion point, or only
 * cites it. Only `amends` and `inserts` are collision and amendment input. */
export type InstructionRole = "amends" | "inserts" | "anchor" | "cites";

export function instructionRole(text: string, num: string): InstructionRole {
  const key = num.toLowerCase();
  const named = new RegExp(`§\\s?${escapeNum(num)}\\b`, "u");
  if (
    instructionFormsFor(num).some((re) => re.test(text)) ||
    repealedRange(text).has(key) ||
    jointClauses(text).some((clause) => named.test(clause))
  )
    return "amends";
  const { anchors, inserted } = insertionTargets(text);
  if (inserted.has(key)) return "inserts";
  return anchors.has(key) ? "anchor" : "cites";
}

/** Does `text` (a bill's operative text, ideally partitioned to the target statute) actually
 * operate on § `num` — edit it or create it? An insertion anchor is not operated on. */
export function amendsParagraph(text: string, num: string): boolean {
  const role = instructionRole(text, num);
  return role === "amends" || role === "inserts";
}

/** Which odstavce a bill's instructions against § `num` name. Empty is NOT "the whole §": use
 * `targetedScope`, which keeps whole-§ and undeterminable apart. */
export function targetedOdstavce(text: string, num: string): Set<string> {
  const n = escapeNum(num);
  const out = new Set<string>();
  // The WHOLE list after „odst.": „1, 2 a 4", „5 až 7", „1, 3 až 5 a 7". Until 2026-09-09
  // only the first item and ONE connector were read, so „odst. 1, 2 a 4" lost the 4 and two
  // bills both editing odst. 4 read as "different provisions" — the class the 2026-09-07
  // range fix closed for „5 až 7", one shape over. A connector must be followed by a number,
  // so „odst. 2 a v § 9" stays a one-item list.
  // Since 2026-10-10 three more shapes count: the spelled-out „V § 39 odstavec 2 zní:" (the
  // drafting form for replacing a whole paragraph; the batch-015 audit's M19 was tisk 65
  // „V § 3 odstavec 3 zní"), „§ 30 odst. 1 zní:" without „V", and a joint clause. Over the cached
  // prints, 287 operative pairs that this reader left empty named their paragraphs one of these ways.
  const res = [
    new RegExp(`V\\s*§\\s?${n}\\s+(?:se\\s+(?:za\\s+)?)?${ODST}\\s*${ODST_LIST}`, "gu"),
    new RegExp(`V\\s*§\\s?${n}\\s+se\\s+(?:za\\s+${ODST}\\s*\\d+\\s+vklád\\p{L}*\\s+nov\\p{L}*\\s+|doplňuj\\p{L}*\\s+(?:nov\\p{L}*\\s+)?)${ODST}\\s*${ODST_LIST}`, "gu"),
    new RegExp(`${CLAUSE_START}§\\s?${n}\\s+(?:se\\s+)?${ODST}\\s*${ODST_LIST}(?=[^\\n]{0,40}?(?:zní|znějí|zrušuj))`, "gu"),
  ];
  const inJoint = new RegExp(`§\\s?${n}\\s+${ODST}\\s*${ODST_LIST}`, "gu");
  const matches = [...res.flatMap((re) => [...text.matchAll(re)]), ...jointClauses(text).flatMap((c) => [...c.matchAll(inJoint)])];
  for (const m of matches) {
    for (const item of m[m.length - 1].matchAll(/(\d+)(?:\s*až\s*(\d+))?/gu)) {
      const first = Number(item[1]);
      out.add(item[1]);
      if (!item[2]) continue;
      const last = Number(item[2]);
      // „odst. 5 až 7" names every paragraph in the range.
      if (last > first) for (let k = first + 1; k < last; k++) out.add(String(k));
      out.add(item[2]);
    }
  }
  return out;
}

// Inserting or repealing a paragraph, or relabelling the rest, shifts every later paragraph's
// number: „V § 29 se za odstavec 3 vkládá nový odstavec 4" moves the old odst. 4 and 5 down.
const RENUMBERS =
  /vklád\p{L}*\s+nov\p{L}*\s+odstav|odstav\p{L}*\s+[\d ,až]+\s+se\s+zrušuj|se\s+odstav\p{L}*\s+[\d ,až]+\s*zrušuj|[Dd]osavadní\s+odstav|se\s+označuj\p{L}*\s+jako\s+odstav/u;

function renumbersOdstavce(text: string, num: string): boolean {
  for (const m of text.matchAll(new RegExp(`V\\s*§\\s?${escapeNum(num)}\\b`, "gu"))) {
    const rest = text.slice(m.index, m.index + 600);
    const next = rest.slice(1).search(/\n\s*\d+\.\s/);
    if (RENUMBERS.test(next >= 0 ? rest.slice(0, next + 1) : rest)) return true;
  }
  return false;
}

/** How much of § `num` a bill's instructions reach, as three states that must not be conflated:
 *   whole       — the § is replaced, repealed or created („§ 22 zní:", „§ 416 se včetně nadpisu
 *                 zrušuje", an inserted §); it overlaps every edit to the same §;
 *   odstavce    — the named paragraphs. `positional` marks a bill that also shifts paragraph
 *                 numbers, so a different number on the other side is NOT proof of disjointness
 *                 (batch-001's founding collision was two renumberings of § 35ba);
 *   unresolved  — an edit the grammar cannot place („V § 214 se za slovo … vkládají slova").
 * Over the cached prints, the 975 operative pairs that `targetedOdstavce` left empty split into 172
 * whole, 287 named and 419 unresolved; the rest were insertion anchors or the `/i` citations
 * (2026-10-10). Bill pairs whose paragraph overlap could not be decided fell from 114 of 326 to
 * 44 of 341. */
export type ParagraphScope =
  | { kind: "whole" }
  | { kind: "odstavce"; odstavce: Set<string>; positional: boolean }
  | { kind: "unresolved" };

export function targetedScope(text: string, num: string): ParagraphScope {
  const n = escapeNum(num);
  const whole = new RegExp(
    `${CLAUSE_START}§\\s?${n}\\s+(?:(?:včetně\\s+[^\\n]{0,40}?)?(?:zní|se\\s+zrušuje)|se\\s+včetně\\s+\\p{L}+\\s+zrušuje)`,
    "u",
  );
  if (instructionRole(text, num) === "inserts" || repealedRange(text).has(num.toLowerCase()) || whole.test(text))
    return { kind: "whole" };
  const odstavce = targetedOdstavce(text, num);
  if (odstavce.size === 0) return { kind: "unresolved" };
  return { kind: "odstavce", odstavce, positional: renumbersOdstavce(text, num) };
}
