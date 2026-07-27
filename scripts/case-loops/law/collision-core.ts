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

/** Forms that ISSUE an instruction against § N. Anchored so a mid-sentence "podle § N" cannot
 * match: an instruction begins its clause (start of line, or after a "12." item number, or
 * after a sentence break). */
export function instructionFormsFor(num: string): RegExp[] {
  const n = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Start-of-clause anchor. An instruction opens its clause; a citation sits mid-sentence after
  // a preposition ("podle § 8", "uvedený v § 8"). The `Čl\.` alternative is load-bearing and was
  // added after validation: `pdftotext -layout` frequently renders an article label and its first
  // instruction on ONE line ("Čl. VI V § 8 odst. 2 zákona č. 166/1993 Sb., … se slova"), and
  // without it every single-article amendment in the corpus read as citation-only. That one gap
  // produced all 3 false drops in the first validation run — i.e. it would have silently
  // discarded three genuine findings.
  const A = `(^|\\n|\\d+\\.\\s*|\\.\\s+|Čl\\.\\s*[IVXLCDM\\d]+\\.?\\s+|ČÁST\\s+\\p{Lu}+\\s+)`;
  return [
    // "1. V § 15 odst. 1 písm. b) se slova …" / "V § 26 se na konci …"
    new RegExp(`${A}V\\s*§\\s?${n}\\b`, "iu"),
    // "§ 4c zní:" / "§ 22a včetně nadpisu zní:" / "§ 4b se zrušuje."
    new RegExp(`${A}§\\s?${n}\\b[^.\\n]{0,60}?(zní|znějí|se\\s+zrušuj)`, "iu"),
    // "Za § 13 se vkládá nový § 13a" — an anchor instruction naming § N as the insertion point
    new RegExp(`${A}(Za|Nad\\s+označení)\\s*§\\s?${n}\\b`, "iu"),
    // "V § 22a odstavce 1 a 2 znějí:" is covered by the first form; this catches
    // "§ 101a se odstavce 2 a 3 zrušují" style where the § leads without "V".
    new RegExp(`${A}§\\s?${n}\\s+se\\s+(odstav|písmen|slov|text|čísl)`, "iu"),
  ];
}

/** Does `text` (a bill's operative text, ideally partitioned to the target statute) actually
 * issue a novelization instruction against § `num`? */
export function amendsParagraph(text: string, num: string): boolean {
  return instructionFormsFor(num).some((re) => re.test(text));
}

/** Which odstavce a bill's instructions against § `num` target — used to tell a genuine
 * same-provision clash from two edits that merely share a § number. Empty means "the § as a
 * whole, or not determinable from the instruction". */
export function targetedOdstavce(text: string, num: string): Set<string> {
  const n = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out = new Set<string>();
  const re = new RegExp(`V\\s*§\\s?${n}\\s+odst\\.\\s*(\\d+)(?:\\s*(?:a|až|,)\\s*(\\d+))?`, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.add(m[1]);
    if (m[2]) out.add(m[2]);
  }
  return out;
}
