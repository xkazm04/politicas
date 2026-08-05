/* Case ③ Law loop — the "co to mění" summary builder (batch 009, presentation gate).
 *
 * The measured defect: 0 of 141 bills carried a one-line human summary, so /zakony
 * showed a reader a 200-character truncated legal title and a dozen provenance fields
 * and never one plain Czech sentence saying what the print actually changes.
 *
 * This builder is DETERMINISTIC and derives every summary from the REAL cached bill
 * text under `.data/law-collision-cache/tisk-<cislo>/*.txt` (the `pdftotext` render of
 * the print's own PDF on psp.cz) — never from a model, never from the graph's derived
 * fields, never invented. Three real structures in that text carry "what changes":
 *
 *   1. the ČÁST captions — a Czech novela is organised as `ČÁST PRVNÍ` + a caption line
 *      that literally names the change ("Změna obecního zřízení"). Joined, those captions
 *      ARE the summary, in the drafter's own words;
 *   2. the title preamble — "kterým se mění zákon č. N/RRRR Sb., o …" plus any purpose
 *      clause ("v souvislosti s …"), for prints with no ČÁST structure;
 *   3. the new-act head — `ZÁKON ze dne …, o <subject>` — for prints that are not novely
 *      at all but brand-new acts.
 *
 * A print whose cached text is missing, unreadable, or too sparse to yield either
 * structure gets NO summary — it is reported as `shrnutí zatím není`, never guessed.
 * The honest coverage number is printed at the end and written into the payload.
 *
 * Output (PREPARE only — this script never writes to any database):
 *   docs/data-analysis/case-law/payloads/bill-summaries-cz.json
 *
 *   PGLITE_PATH=./.pglite-copy-law-005 npx tsx scripts/case-loops/law/build-bill-summaries.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

import { czechGateErrors } from "@/lib/analysis/language-gate";
import { getStore } from "@/lib/db/store";

const CACHE_DIR = ".data/law-collision-cache";
const OUT = "docs/data-analysis/case-law/payloads/bill-summaries-cz.json";
const INDEX = "docs/data-analysis/case-law/payloads/bill-index.json";

/** Max characters of a summary — one line on the dossier header, not a paragraph. */
const MAX_SUMMARY = 240;

export interface BillSummaryRow {
  cislo: number;
  billUrn: string;
  /** null ⇒ no honest summary could be derived; the surface says "shrnutí zatím není". */
  summary: string | null;
  /** Which real text structure the summary came from. */
  method: "cast_captions" | "title_preamble" | "repeal" | "new_act" | null;
  /** The public document the summary derives from (batch-018 audit M20: a local cache path
   * is not a citation a reader can follow — the psp.cz print URL is; the cache mirrors it). */
  source: string | null;
  /** Why a summary is missing, when it is. */
  missingReason?: string;
}

/** `pdftotext` inconsistently emits decomposed diacritics; normalise before any regex. */
function normalise(text: string): string {
  return text.normalize("NFC").replace(/ /g, " ");
}

/**
 * The cached plain-text render of the print's OWN BODY, or null when it was never cached.
 * A print usually caches two texts: the bill itself and the „Platné znění … s vyznačením
 * navrhovaných změn" annex (the marked-up consolidated statute), which is often the LARGER
 * of the two and carries no title preamble and no ČÁST structure — picking by size alone
 * silently loses those prints (measured: tisk 40, 120 and 10 others).  The body is the one
 * that contains the enacting formula „Parlament se usnesl na tomto zákoně".
 */
function readCachedText(cislo: number): { text: string; file: string } | null {
  const dir = join(CACHE_DIR, `tisk-${cislo}`);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({ f, text: normalise(readFileSync(join(dir, f), "utf8")) }));
  if (files.length === 0) return null;
  const bodies = files.filter((x) => /Parlament\s+se\s+usnesl/i.test(x.text));
  const pick = (bodies.length > 0 ? bodies : files).sort((a, b) => b.text.length - a.text.length)[0];
  if (pick.text.length < 400) return null; // too sparse to carry any structure
  return { text: pick.text, file: join(dir, pick.f) };
}

const CAST_RE = /^\s*ČÁST\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+\s*$/;

/**
 * The `Změna …` captions that follow each `ČÁST …` heading — the drafter's own words for
 * "what this part changes". A caption frequently wraps across two or three lines in the
 * pdftotext render, so consecutive non-empty lines are joined until the part's first `Čl.`.
 * Only `Změna …` captions are kept: `ÚČINNOST`, `PŘECHODNÁ USTANOVENÍ` and the like are
 * structural, not changes, and listing them as changes would be a false statement.
 */
export function castCaptions(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!CAST_RE.test(lines[i])) continue;
    const parts: string[] = [];
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const l = lines[j];
      // A wrapped caption often has a BLANK line inside it in the pdftotext render
      // (measured on tisk 28's ČÁST DRUHÁ), so blanks are skipped, never treated as
      // the caption's end; only the part's first `Čl.`/`§` heading ends it.
      if (l.length === 0) continue;
      if (/^Čl\.\s/i.test(l) || /^§/.test(l) || CAST_RE.test(l)) break;
      parts.push(l);
    }
    // Strip trailing footnote markers ("… s výrobky 21") that pdftotext inlines.
    const caption = parts.join(" ").replace(/\s+/g, " ").replace(/\s+\d{1,3}\)?$/, "").trim();
    if (/^Zm[ěe]na\s+/i.test(caption) && caption.length <= 200) out.push(caption);
  }
  return out;
}

/** `Změna zákoníku práce` → `zákoníku práce` (the genitive the frame sentence needs). */
function stripZmena(caption: string): string {
  return caption.replace(/^Zm[ěe]na\s+/i, "").replace(/[,\s]+$/, "");
}

/** Czech count agreement for „předpis" (1 / 2–4 / 5+). */
function predpisy(n: number): string {
  if (n === 1) return "předpis";
  return n >= 2 && n <= 4 ? "předpisy" : "předpisů";
}

/** A repeal bill: „kterým se zrušuje zákon č. N/RRRR Sb., o …". */
export function repealPreamble(text: string): string | null {
  const m = text.match(/kter[ýéo]u?m?\s+se\s+zru[šs]uj[ei][\s\S]{0,500}?(?=Parlament\s+se\s+usnesl)/i);
  if (!m) return null;
  const line = m[0]
    .replace(/\s+/g, " ")
    .replace(/^kter[ýéo]u?m?\s+se\s+zru[šs]uj[ei]\s+/i, "")
    .replace(/,?\s*ve\s+zn[ěe]n[ií]\s+pozd[ěe]j[šs][ií]ch\s+p[řr]edpis[ůu]/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/[,.\s]+$/, "")
    .trim();
  return line.length >= 15 ? line : null;
}

/** The novela's title preamble — the „kterým se mění …" clause before the enacting formula. */
export function titlePreamble(text: string): string | null {
  const m = text.match(/kter[ýéo]u?m?\s+se\s+m[ěe]n[ií][\s\S]{0,500}?(?=Parlament\s+se\s+usnesl)/i);
  if (!m) return null;
  const line = m[0].replace(/\s+/g, " ").replace(/[,.\s]+$/, "").trim();
  return line.length >= 20 ? line : null;
}

/** A brand-new act (not a novela): the `ZÁKON … ze dne … , o <subject>` head. */
export function newActSubject(text: string): string | null {
  const at = text.search(/Parlament\s+se\s+usnesl/i);
  const head = text.slice(0, at > 0 ? at : 3000);
  const dateAt = head.search(/ze\s+dne/i);
  if (dateAt < 0) return null;
  // The subject wraps across lines in the pdftotext render ("… za účelem\n shromažďování …"),
  // so take every non-empty line after the date head, not just the first.
  const lines = head
    .slice(dateAt)
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 4);
  const subject = lines.join(" ").replace(/\s+/g, " ").replace(/[,.\s]+$/, "").trim();
  return /^o\s+\p{L}/u.test(subject) && subject.length >= 8 ? subject : null;
}

function truncate(s: string): string {
  if (s.length <= MAX_SUMMARY) return s;
  const cut = s.slice(0, MAX_SUMMARY - 1);
  const at = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" — "), cut.lastIndexOf(" "));
  return `${cut.slice(0, at > 60 ? at : cut.length).replace(/[,\s—]+$/, "")}…`;
}

/** Compose the Czech one-liner from whichever real structure the text yields. */
export function composeSummary(text: string): { summary: string; method: BillSummaryRow["method"] } | null {
  const captions = castCaptions(text).map(stripZmena).filter((c) => c.length > 3);
  if (captions.length >= 2) {
    const shown = captions.slice(0, 3);
    const rest = captions.length - shown.length;
    const tail =
      rest === 0 ? "" : rest === 1 ? " a další předpis" : rest <= 4 ? ` a ${rest} další předpisy` : ` a ${rest} dalších předpisů`;
    return {
      summary: truncate(`Mění ${captions.length} ${predpisy(captions.length)} — změna ${shown.join(", ")}${tail}.`),
      method: "cast_captions",
    };
  }

  const preamble = titlePreamble(text);
  if (preamble) {
    // „kterým se mění zákon č. 589/1992 Sb., o pojistném …" → „Mění zákon č. 589/1992 Sb., o pojistném …"
    const core = preamble
      .replace(/^kter[ýéo]u?m?\s+se\s+m[ěe]n[ií]\s+/i, "")
      .replace(/,?\s*ve\s+zn[ěe]n[ií]\s+pozd[ěe]j[šs][ií]ch\s+(?:[úu]stavn[ií]ch\s+)?p[řr]edpis[ůu]/gi, "")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/[,.\s]+$/, "")
      .trim();
    return { summary: truncate(`Mění ${core}.`), method: "title_preamble" };
  }

  const repeal = repealPreamble(text);
  if (repeal) return { summary: truncate(`Ruší ${repeal}.`), method: "repeal" };

  const subject = newActSubject(text);
  if (subject) return { summary: truncate(`Nový zákon ${subject}.`), method: "new_act" };
  return null;
}

/**
 * The (cislo → bill urn) index the payload is keyed by. Read from the checked-in
 * `bill-index.json` when it exists — opening the 1.5 GB PGlite copy costs minutes per
 * run and the index is stable between ingests — otherwise regenerated from a graph COPY
 * (`PGLITE_PATH`, never the live store) and written back for the next run.
 */
async function loadBillIndex(): Promise<{ cislo: number | null; billUrn: string }[]> {
  if (existsSync(INDEX)) {
    const raw = JSON.parse(readFileSync(INDEX, "utf8")) as { cislo: number; billUrn: string }[];
    if (Array.isArray(raw) && raw.length > 0) return raw.map((r) => ({ cislo: r.cislo >= 0 ? r.cislo : null, billUrn: r.billUrn }));
  }
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a COPY of .pglite, never the live one");
  const bills = await store.listKgNodes({ kind: "bill", limit: 100_000 });
  const index = bills.map((n) => {
    const props = (n.props ?? {}) as Record<string, unknown>;
    return { cislo: typeof props.cislo === "number" ? props.cislo : null, billUrn: n.id };
  });
  writeFileSync(INDEX, `${JSON.stringify(index.map((r) => ({ cislo: r.cislo ?? -1, billUrn: r.billUrn })), null, 2)}\n`);
  return index;
}

async function main(): Promise<void> {
  const bills = await loadBillIndex();

  const rows: BillSummaryRow[] = [];
  for (const n of bills) {
    const cislo = n.cislo;
    if (cislo == null) {
      rows.push({ cislo: -1, billUrn: n.billUrn, summary: null, method: null, source: null, missingReason: "tisk bez veřejného čísla — není cache ani routa" });
      continue;
    }
    const cached = readCachedText(cislo);
    if (!cached) {
      rows.push({ cislo, billUrn: n.billUrn, summary: null, method: null, source: null, missingReason: "text tisku není v cache (.data/law-collision-cache) nebo je příliš krátký" });
      continue;
    }
    const pspUrl = `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`;
    const composed = composeSummary(cached.text);
    if (!composed) {
      rows.push({ cislo, billUrn: n.billUrn, summary: null, method: null, source: pspUrl, missingReason: "text tisku neobsahuje členění na ČÁSTi se změnovými nadpisy, čitelné návětí („kterým se mění …\") ani nadpis nového zákona" });
      continue;
    }
    rows.push({ cislo, billUrn: n.billUrn, summary: composed.summary, method: composed.method, source: pspUrl });
  }

  // The summaries are reader-facing Czech copy — run the same gate the verdicts run.
  const gate = czechGateErrors(rows.filter((r) => r.summary).map((r) => ({ label: `tisk ${r.cislo}`, text: r.summary })));
  if (gate.length > 0) {
    console.error("LANGUAGE GATE FAILED on derived summaries:");
    for (const g of gate) console.error("  -", g);
    throw new Error(`language gate rejected ${gate.length} derived summaries`);
  }

  const covered = rows.filter((r) => r.summary).length;
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "deterministic derivation from .data/law-collision-cache/tisk-<cislo>/*.txt (pdftotext of the print's own PDF on psp.cz)",
    total: rows.length,
    covered,
    byMethod: {
      cast_captions: rows.filter((r) => r.method === "cast_captions").length,
      title_preamble: rows.filter((r) => r.method === "title_preamble").length,
      repeal: rows.filter((r) => r.method === "repeal").length,
      new_act: rows.filter((r) => r.method === "new_act").length,
    },
    missing: rows.filter((r) => !r.summary).map((r) => ({ cislo: r.cislo, reason: r.missingReason })),
    rows,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`summaries: ${covered}/${rows.length} covered (ČÁST ${payload.byMethod.cast_captions}, návětí ${payload.byMethod.title_preamble}, zrušení ${payload.byMethod.repeal}, nový zákon ${payload.byMethod.new_act})`);
  for (const m of payload.missing) console.log(`  MISSING tisk ${m.cislo}: ${m.reason}`);
  console.log(`written ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
