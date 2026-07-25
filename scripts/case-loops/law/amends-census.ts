/* Case ③ Law loop — batch-003 Q-law-6: deterministic full-population amends-undercount census.
 *
 * batch-001/002 found government omnibus bills undercount `amends` badly (tisk 4: 4 real vs 1
 * recorded; tisk 111: 7 vs 1; tisk 207: 8 vs 1) because psp-legislation.ts's LAW_CITATION regex
 * only catches the FIRST "č. N/RRRR Sb." citation, and only in the TITLE, not the body. This
 * script checks ALL 141 bills: fetches each bill's actual body text (reusing the exact
 * fetch/cache pipeline collision-check.ts built — .data/law-collision-cache/, 71/71 already
 * cached from batch-002, 0 skips), extracts every "č. N/RRRR Sb." citation from the BODY (not
 * just the title) with the shared word-boundary-safe LAW_CITATION regex (no bespoke re-derivation
 * — reuses lib/ingest/sources/psp-legislation.ts's actual regex so this can't drift from the
 * live extractor), and compares real vs recorded amends counts per bill.
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/amends-census.ts
 * → docs/data-analysis/case-law/payloads/amends-census.json
 * → docs/data-analysis/case-law/payloads/amended-laws-full-proposal.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { LAW_CITATION } from "@/lib/ingest/sources/psp-legislation";
import { getStore } from "@/lib/db/store";

const CACHE_DIR = ".data/law-collision-cache";
const PDFTOTEXT_BIN = existsSync("/clangarm64/bin/pdftotext") ? "/clangarm64/bin/pdftotext" : "pdftotext";
const BASE = "https://www.psp.cz/sqw/text/";
const CONCURRENCY = 4;

// batch-007: re-run after the ČÁST/bare-§ splitter fix (N1). Written to NEW filenames — the
// batch-004/005/006 census/proposal files stay untouched as history (amends-regen-005.ts and its
// siblings still read the old ones; batch-007's own regen script points at these new outputs).
const CENSUS_OUT = "docs/data-analysis/case-law/payloads/batch-007-amends-census.json";
const PROPOSAL_OUT = "docs/data-analysis/case-law/payloads/batch-007-amended-laws-full-proposal.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, opts: { timeoutMs: number }, attempts = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs) });
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(500 * 2 ** i);
    }
  }
  throw lastErr;
}

interface IndexEntry {
  header: string;
  idd: string;
  filename: string;
}
function parseIndex(html: string): IndexEntry[] {
  const headers: { idx: number; text: string }[] = [];
  const headerRe = /<th colspan=2 class="lightblue">([^<]+)<\/th>/g;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(html))) headers.push({ idx: hm.index, text: hm[1].replace(/&nbsp;/g, " ").trim() });
  const pdfRe = /<span class="file pdf"><a href="([^"]+)" title="Dokument PDF">([^<]+)<\/a>/g;
  const results: IndexEntry[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = pdfRe.exec(html))) {
    const href = pm[1];
    const filename = pm[2];
    const iddMatch = href.match(/idd=(\d+)/);
    if (!iddMatch) continue;
    let header = "";
    for (const h of headers) {
      if (h.idx < pm.index) header = h.text;
      else break;
    }
    results.push({ header, idd: iddMatch[1], filename });
  }
  return results;
}

async function fetchIndexHtml(cislo: number): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, `tisk-${cislo}`, "index.html");
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const url = `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`;
  const res = await fetchWithRetry(url, { timeoutMs: 30_000 });
  if (!res.ok) throw new Error(`index HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = new TextDecoder("windows-1250").decode(buf);
  if (!/Sněmovní tisk/i.test(html)) throw new Error("index page did not contain 'Sněmovní tisk' — unexpected content");
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, html, "utf8");
  return html;
}

async function fetchPdf(cislo: number, idd: string): Promise<string> {
  const dir = path.join(CACHE_DIR, `tisk-${cislo}`);
  mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${idd}.pdf`);
  if (existsSync(pdfPath)) return pdfPath;
  const url = `${BASE}orig2.sqw?idd=${idd}`;
  const res = await fetchWithRetry(url, { timeoutMs: 60_000 });
  if (!res.ok) throw new Error(`pdf HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!ct.includes("pdf") && buf.slice(0, 4).toString("latin1") !== "%PDF") {
    throw new Error(`response at idd=${idd} was not a PDF (content-type: ${ct})`);
  }
  writeFileSync(pdfPath, buf);
  return pdfPath;
}

function extractText(pdfPath: string): string {
  const txtPath = pdfPath.replace(/\.pdf$/, ".txt");
  if (existsSync(txtPath)) return readFileSync(txtPath, "utf8");
  const out = execFileSync(PDFTOTEXT_BIN, ["-layout", "-enc", "UTF-8", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 50_000_000,
  });
  writeFileSync(txtPath, out, "utf8");
  return out;
}

interface Skip {
  cislo: number;
  stage: "index" | "no-pdf" | "pdf-fetch" | "pdftotext";
  reason: string;
}
interface Row {
  tiskId: string;
  cislo: number;
  origin: string;
  title: string;
  recordedAmends: number;
  recordedLaws: string[];
  realLaws: string[];
  realCount: number;
  undercount: number;
  docType: "platne-zneni" | "navrh-zakona";
  sourceUrl: string;
  structure: "cl" | "cast" | "single-subject-amending" | "single-subject-non-amending";
  skippedParts: { label: string; headingPreview: string }[];
}

/**
 * The naive "every č. N/RRRR Sb. in the operative text" count massively over-counts: Czech
 * amending clauses cite a target law's FULL amendment-history lineage as boilerplate
 * ("zákon č. 586/1992 Sb., ve znění zákona č. 35/1993 Sb., zákona č. 96/1993 Sb., …" — dozens of
 * historical amending laws of the ONE statute being changed, not new targets of THIS bill).
 * Verified against the known-correct batch-002 findings (tisk 111: 7 real laws) — the reliable
 * signal is: each numbered "Čl. N" (Article) in an omnibus bill amends exactly ONE target
 * statute, cited ONCE near the top of that article ("Zákon č. X/Y Sb. … se mění takto:"). So the
 * real amended-laws set = the FIRST law citation found in each Čl. N block, deduped (an
 * "Účinnost" effective-date article, or a coordinating article that cites no new law, correctly
 * contributes nothing).
 *
 * batch-007 fix (N1, batch-006 independent audit): the Čl.-only splitter is structurally blind to
 * the OTHER real-corpus bill structure — omnibus bills organised by "ČÁST <ordinal>" headings
 * instead of "Čl. N" articles (confirmed on 12+ bills incl. the 7 the audit named — tisk
 * 250/69/10/54/113/189/228 — plus 63/76/144, which turn out to ALSO be ČÁST-organised rather than
 * truly single-subject as the old fallback assumed). The same drafting convention applies one
 * level up: a ČÁST that amends another statute carries a "Změna …" sub-heading right after the
 * ČÁST label, then cites its target near the top ("Zákon č. X/Y Sb. … se mění takto:") — but a
 * bill's ČÁST PRVNÍ is almost always the bill's OWN new-law text (never a "Změna" sub-heading),
 * and a "Zrušovací ustanovení" (repeal) or "Účinnost" (effective-date) ČÁST cites its target deep
 * inside the part body, far past the heading window, or not at all. Gating each ČÁST block on a
 * "Změna" sub-heading in its own heading area (not just windowing the citation search) is what
 * correctly excludes those parts — and, as a side effect, fixes 3 of the 6 batch-006 N2 false
 * edges (tisk 55/76/144, all REPEAL clauses the old whole-text fallback misread as amendments —
 * none of those bills has a real "Změna" ČÁST once ČÁST structure is honoured).
 *
 * Structures checked against the real corpus and NOT found to denote amend-block boundaries:
 * "Hlava"/"Oddíl"/"Díl" — sub-structuring WITHIN a bill's own new-law text (chapters, sections) or
 * within a single ČÁST/Čl. block; none of the bills checked carries a "Změna zákona" sub-heading
 * at that level, so they are correctly left unsplit.
 */
/** batch-005 fix (D1, Opus audit): a footnote citation ("1) Zákon č. 354/2019 Sb., o …") reads
 * as a plain LAW_CITATION match with nothing in the regex to tell it apart from a real amending
 * citation. Proven false positives (tisk 219/222/243, all single-subject bills with NO "Čl."
 * numbering — a brand-new standalone act, not a novela — where the naive "first citation in the
 * whole operative text" picked up the first FOOTNOTE instead of the real "Změna zákona č. X"
 * part further down): a Czech legal-text footnote is its own paragraph starting with a bare
 * footnote-number marker "N)" (no legal citation context on that line before it). Skip any
 * citation whose enclosing line starts that way.
 *
 * batch-007 fix (N4, batch-006 independent audit): the single-line check missed multi-line
 * footnote CONTINUATIONS (tisk 69: "3) Například zákon č. 220/1991 Sb., / ve znění pozdějších
 * předpisů, zákon č. 381/1991 Sb., …" — the citation lands on the wrapped second line, which does
 * not itself start with a footnote marker). Generalized to a footnote BLOCK: walk backward through
 * contiguous non-blank lines looking for a line that starts the footnote (bounded hop count so a
 * long unrelated paragraph can't be misread as one big footnote). */
function isFootnoteLine(operative: string, matchIndex: number): boolean {
  const FOOTNOTE_START = /^\s*\d{1,3}\)?\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ§]/u;
  const lineStart = operative.lastIndexOf("\n", matchIndex) + 1;
  const line = operative.slice(lineStart, matchIndex);
  // the footnote DEFINITION line reads "N) Zákon č. X/Y Sb., …" — a bare footnote-number marker
  // at the start of the line, before any legal-citation content (not just "N)" alone, since the
  // citation itself follows on the same line, e.g. "1) Zákon č. 354/2019 Sb., o soudních …").
  // The closing paren is not reliable — some PDFs' pdftotext extraction drops the superscript
  // paren entirely (observed: "3 § 3 zákona č. 240/2000 Sb." with no ")" at all) — so also match
  // a bare leading number directly followed by "Zákon"/"zákona"/"§"/"Čl." with no paren.
  if (FOOTNOTE_START.test(line)) return true;
  // multi-line continuation: walk backward through contiguous non-blank lines (a blank line ends
  // the footnote paragraph) looking for the footnote-start line, up to 5 hops back.
  let cursor = lineStart - 1; // index of the \n immediately before this line, or -1 at text start
  for (let hop = 0; hop < 5 && cursor > 0; hop++) {
    const prevLineEnd = cursor;
    const prevLineStart = operative.lastIndexOf("\n", prevLineEnd - 1) + 1;
    const prevLine = operative.slice(prevLineStart, prevLineEnd);
    if (prevLine.trim() === "") break; // blank line — not a continuation, stop looking
    if (FOOTNOTE_START.test(prevLine)) return true;
    cursor = prevLineStart - 1;
  }
  return false;
}

const AMENDING_TITLE_RE = /kter(?:ým|ou|ými)\s+se\s+mění/iu;
const PART_RE = /\n\s*ČÁST\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+)\b([^\n]*)\n/g;
const HEADING_WINDOW = 320; // how far past a ČÁST label its own "Změna …" sub-heading can sit
const PART_CITATION_WINDOW = 1200; // citation is always near a real amending part's top
const ART_CITATION_WINDOW = 800; // unchanged from the original Čl.-block logic

function firstNonFootnoteCitation(text: string): { ref: string } | null {
  LAW_CITATION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LAW_CITATION.exec(text))) {
    if (isFootnoteLine(text, m.index)) continue;
    const hit = { ref: `${Number(m[1])}/${m[2]}` };
    LAW_CITATION.lastIndex = 0;
    return hit;
  }
  LAW_CITATION.lastIndex = 0;
  return null;
}

interface ExtractResult {
  laws: Set<string>;
  structure: "cl" | "cast" | "single-subject-amending" | "single-subject-non-amending";
  skippedParts: { label: string; headingPreview: string }[];
}

function extractRealAmendedLaws(operative: string): ExtractResult {
  const artRe = /\n\s*Čl\.\s*([IVXLCDM]+|\d+)\.?\s*\n/g;
  const arts: { label: string; idx: number }[] = [];
  let am: RegExpExecArray | null;
  while ((am = artRe.exec(operative))) arts.push({ label: am[1], idx: am.index });

  const out = new Set<string>();

  if (arts.length > 0) {
    // Čl.-organised bill — unchanged, proven logic (batch-001 through batch-006's live 150 edges).
    for (let i = 0; i < arts.length; i++) {
      const start = arts[i].idx;
      const end = i + 1 < arts.length ? arts[i + 1].idx : Math.min(operative.length, start + 4000);
      const slice = operative.slice(start, Math.min(end, start + ART_CITATION_WINDOW));
      const hit = firstNonFootnoteCitation(slice);
      if (hit) out.add(hit.ref);
    }
    return { laws: out, structure: "cl", skippedParts: [] };
  }

  // No Čl. markers — check for ČÁST-organised structure (batch-007 N1 fix).
  const parts: { label: string; headingLine: string; idx: number }[] = [];
  PART_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PART_RE.exec(operative))) parts.push({ label: pm[1], headingLine: pm[2] ?? "", idx: pm.index });

  const skippedParts: { label: string; headingPreview: string }[] = [];
  if (parts.length > 0) {
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i].idx;
      const headingArea = operative.slice(start, Math.min(operative.length, start + HEADING_WINDOW));
      // Only a part whose OWN heading area names itself as an amendment ("Změna zákona o …", "–
      // změna …") gets its citation searched. This is what correctly excludes ČÁST PRVNÍ (the
      // bill's own new-law body — never "Změna"), "Zrušovací ustanovení" (repeal, N2's tisk
      // 55/76/144 class) and "Účinnost" (effective-date) parts, whose real target — if any — sits
      // far past this window, not near the heading.
      if (!/změn[aiy]/iu.test(headingArea)) {
        skippedParts.push({ label: parts[i].label, headingPreview: headingArea.replace(/\s+/g, " ").trim().slice(0, 140) });
        continue;
      }
      const end = i + 1 < parts.length ? parts[i + 1].idx : operative.length;
      const slice = operative.slice(start, Math.min(end, start + PART_CITATION_WINDOW));
      const hit = firstNonFootnoteCitation(slice);
      if (hit) out.add(hit.ref);
    }
    return { laws: out, structure: "cast", skippedParts };
  }

  // Truly single-subject bill — no Čl., no ČÁST. batch-007 fix: only treat this as an AMENDING
  // novela (and search for a target) if the bill's OWN title/preamble (first ~600 chars of the
  // operative text) says so ("kterým/kterou/kterými se mění …") — otherwise it is a brand-new
  // standalone act (or a bare-§-organised bill whose only "č. N/RRRR Sb." citations are
  // cross-references or a repeal clause, N2's tisk 6/63 class) and correctly amends nothing.
  if (!AMENDING_TITLE_RE.test(operative.slice(0, 600))) {
    return { laws: out, structure: "single-subject-non-amending", skippedParts: [] };
  }
  const hit = firstNonFootnoteCitation(operative);
  if (hit) out.add(hit.ref);
  return { laws: out, structure: "single-subject-amending", skippedParts: [] };
}

async function processBill(
  cislo: number,
): Promise<{
  realLaws?: string[];
  docType?: Row["docType"];
  sourceUrl?: string;
  structure?: Row["structure"];
  skippedParts?: Row["skippedParts"];
  skip?: Skip;
}> {
  let html: string;
  try {
    html = await fetchIndexHtml(cislo);
  } catch (e) {
    return { skip: { cislo, stage: "index", reason: (e as Error).message } };
  }
  const entries = parseIndex(html);
  // For amends-census, body TEXT (not the "platné znění s vyznačením změn" excerpt) is what we
  // want — the actual bill text (návrh zákona) is where every "č. N/RRRR Sb." amendment
  // citation lives (the platné znění doc is the TARGET law's post-change text, not useful here).
  const navrh = entries.find((e) => /Návrh zákona/i.test(e.header));
  const platne = entries.find((e) => /Platné znění/i.test(e.header));
  const chosen = navrh ?? platne;
  if (!chosen) {
    const headers = [...new Set(entries.map((e) => e.header))];
    return { skip: { cislo, stage: "no-pdf", reason: `no "Návrh zákona" or "Platné znění" PDF found (headers: ${headers.join(" | ") || "none"})` } };
  }
  const docType: Row["docType"] = chosen === navrh ? "navrh-zakona" : "platne-zneni";
  let pdfPath: string;
  try {
    pdfPath = await fetchPdf(cislo, chosen.idd);
  } catch (e) {
    return { skip: { cislo, stage: "pdf-fetch", reason: `${chosen.filename} (idd=${chosen.idd}): ${(e as Error).message}` } };
  }
  let text: string;
  try {
    text = extractText(pdfPath);
  } catch (e) {
    return { skip: { cislo, stage: "pdftotext", reason: `${chosen.filename}: ${(e as Error).message}` } };
  }
  // BODY-WIDE (not title-only) extraction, but restricted to the OPERATIVE novelization text —
  // the actual amending articles (Čl. I, Čl. II…), not the explanatory memo (důvodová zpráva),
  // which cites many unrelated statutes for EU-compliance/context/comparative-law reasons and
  // would massively over-count if included. Same operative-slice discipline collision-check.ts
  // uses, applied here to prevent a body-wide false-positive-inflation bug of its own.
  const memoIdx = text.search(/D[ůu]vodov[áa]\s+zpr[áa]va/i);
  let operative: string;
  if (docType === "platne-zneni") {
    operative = memoIdx > 0 ? text.slice(0, memoIdx) : text;
  } else {
    const startMatch = text.match(/(^|\n)\s*(ČÁST PRVNÍ|Čl\.\s*I\b)/);
    const start = startMatch?.index ?? 0;
    const end = memoIdx > start ? memoIdx : text.length;
    operative = text.slice(start, end);
  }
  const extracted = extractRealAmendedLaws(operative);
  return {
    realLaws: [...extracted.laws].sort(),
    docType,
    sourceUrl: `${BASE}orig2.sqw?idd=${chosen.idd}`,
    structure: extracted.structure,
    skippedParts: extracted.skippedParts,
  };
}

async function pMapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
      await sleep(150);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a copy, e.g. PGLITE_PATH=./.pglite-copy-law");
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const bills = nodes.filter((n) => n.kind === "bill");
  const amendsEdges = edges.filter((e) => e.rel === "amends");
  const amendsByBill = new Map<string, string[]>();
  const lawByNodeId = new Map(nodes.filter((n) => n.kind === "law").map((n) => [n.id, String((n.props as Record<string, unknown>).ref ?? "")]));
  for (const e of amendsEdges) {
    const ref = lawByNodeId.get(e.dst);
    if (!ref) continue;
    const arr = amendsByBill.get(e.src) ?? [];
    arr.push(ref);
    amendsByBill.set(e.src, arr);
  }

  console.log(`Fetching body text for all ${bills.length} bills (cache: ${CACHE_DIR})…`);
  const results = await pMapLimit(bills, CONCURRENCY, async (b) => {
    const p = b.props as Record<string, unknown>;
    const cislo = Number(p.cislo);
    const r = await processBill(cislo);
    return { bill: b, cislo, ...r };
  });

  const rows: Row[] = [];
  const skips: Skip[] = [];
  for (const r of results) {
    if (r.skip) {
      skips.push(r.skip);
      continue;
    }
    const p = r.bill.props as Record<string, unknown>;
    const recordedLaws = (amendsByBill.get(r.bill.id) ?? []).sort();
    const realLaws = r.realLaws ?? [];
    rows.push({
      tiskId: r.bill.id,
      cislo: r.cislo,
      origin: String(p.origin ?? "unknown"),
      title: String(r.bill.label ?? p.title ?? ""),
      recordedAmends: recordedLaws.length,
      recordedLaws,
      realLaws,
      realCount: realLaws.length,
      undercount: realLaws.length - recordedLaws.length,
      docType: r.docType!,
      sourceUrl: r.sourceUrl!,
      structure: r.structure!,
      skippedParts: r.skippedParts ?? [],
    });
  }
  rows.sort((a, b) => b.undercount - a.undercount);

  const byOrigin = (originFilter: (o: string) => boolean) => {
    const sub = rows.filter((r) => originFilter(r.origin));
    const n = sub.length;
    const mean = n ? sub.reduce((a, r) => a + r.undercount, 0) / n : 0;
    return { n, mean };
  };
  const govt = byOrigin((o) => o === "government");
  const mpAny = byOrigin((o) => o === "mp" || o === "mp_group");
  const senate = byOrigin((o) => o === "senate");
  const other = byOrigin((o) => o === "other");

  const totalUndercount = rows.reduce((a, r) => a + Math.max(0, r.undercount), 0);
  const billsWithAnyUndercount = rows.filter((r) => r.undercount > 0).length;

  const census = {
    generatedAt: new Date().toISOString(),
    method: "body-text LAW_CITATION extraction (word-boundary-safe, shared regex from psp-legislation.ts) vs recorded `amends` graph edges",
    totals: {
      billsInGraph: bills.length,
      billsChecked: rows.length,
      billsSkipped: skips.length,
      billsWithAnyUndercount,
      totalUndercountSum: totalUndercount,
    },
    originCorrelation: {
      government: govt,
      mp_or_mp_group: mpAny,
      senate,
      other,
      note: "mean = mean(realCount - recordedCount) per bill in that origin bucket; positive = undercount",
    },
    skips,
    rows,
  };
  mkdirSync(path.dirname(CENSUS_OUT), { recursive: true });
  writeFileSync(CENSUS_OUT, JSON.stringify(census, null, 1), "utf8");

  const proposal = {
    generatedAt: new Date().toISOString(),
    note: "ADDITIVE proposal only — proposed amended_laws_full prop per bill (real body-extracted citation list). Does NOT rewrite existing `amends` edges; orchestrator decision, out of scope for batch-003.",
    proposals: rows
      .filter((r) => r.undercount > 0)
      .map((r) => ({ billNodeId: r.tiskId, cislo: r.cislo, amended_laws_full: r.realLaws, recordedLaws: r.recordedLaws, undercount: r.undercount })),
  };
  writeFileSync(PROPOSAL_OUT, JSON.stringify(proposal, null, 1), "utf8");

  console.log(`\nChecked ${rows.length}/${bills.length} bills, ${skips.length} skipped:`);
  for (const s of skips) console.log(`  SKIP tisk ${s.cislo} (${s.stage}): ${s.reason}`);
  console.log(`\nOrigin-correlation (mean undercount): government n=${govt.n} mean=${govt.mean.toFixed(2)} · mp/mp_group n=${mpAny.n} mean=${mpAny.mean.toFixed(2)} · senate n=${senate.n} mean=${senate.mean.toFixed(2)} · other n=${other.n} mean=${other.mean.toFixed(2)}`);
  console.log(`Top 15 undercounts:`);
  for (const r of rows.slice(0, 15)) console.log(`  tisk ${r.cislo} (${r.origin}): recorded ${r.recordedAmends} vs real ${r.realCount} (Δ${r.undercount >= 0 ? "+" : ""}${r.undercount})`);
  console.log(`\nWrote ${CENSUS_OUT} and ${PROPOSAL_OUT}`);
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
