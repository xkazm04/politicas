/* Case ③ Law loop — deterministic §-level collision check (batch 002).
 *
 * batch-001 found "by luck" that tisk 120 and tisk 244 both amend §35ba of 586/1992 with
 * renumbering instructions that assume DIFFERENT starting letterings — a genuine legislative-
 * drafting collision only visible because a human/LLM happened to read both bills together.
 * This script makes that systematic: `collision-groups.json` (already computed from the graph's
 * `amends` edges) lists 29 groups of bills that amend the SAME statute — only bills WITHIN a
 * group can possibly collide. For every bill in every group we fetch its actual novelization
 * text from psp.cz, extract the § (paragraph) references it touches, and flag any pair within a
 * group that shares ≥1 § reference as a collision candidate. Pure deterministic string/set
 * overlap — no LLM judgment in the comparison logic.
 *
 * Fetch pattern (verified against the live site — differs slightly from the naive "match
 * t0011?0.pdf hrefs" approach: the index page's PDF links are NOT the filename itself but a
 * redirect `/sqw/text/orig2.sqw?idd=<N>`; the filename only appears as the link's visible TEXT.
 * We instead associate each pdf link to the nearest PRECEDING `<th class="lightblue">` row
 * header, which names the document class in Czech ("Návrh zákona včetně důvodové zprávy" vs
 * "Platné znění s vyznačením změn") — far more robust than parsing filename stems):
 *   1. GET tiskt.sqw?o=10&ct=<cislo>&ct1=0 → HTML index, windows-1250 encoded.
 *   2. Prefer the "Platné znění s vyznačením změn" PDF (current law text with the bill's
 *      changes marked — shows exactly which §s change, no explanatory-memo noise to trim).
 *      Fall back to "Návrh zákona včetně důvodové zprávy" (bill text + memo — trim to the
 *      operative Čl. I / ČÁST PRVNÍ … before DŮVODOVÁ ZPRÁVA span) if no Platné znění exists.
 *   3. Download the PDF, run pdftotext -layout -enc UTF-8, regex out § base-numbers.
 *
 * Caching: every index HTML, PDF, and extracted .txt is cached under .data/law-collision-cache/
 * (.data/ is already gitignored) so a re-run only fetches what's missing.
 *
 *   npx tsx scripts/case-loops/law/collision-check.ts
 * → docs/data-analysis/case-law/payloads/collision-report.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const GROUPS_PATH = "docs/data-analysis/case-law/payloads/collision-groups.json";
const OUT_PATH = "docs/data-analysis/case-law/payloads/collision-report.json";
const CACHE_DIR = ".data/law-collision-cache";
const PDFTOTEXT_BIN = existsSync("/clangarm64/bin/pdftotext") ? "/clangarm64/bin/pdftotext" : "pdftotext";
const BASE = "https://www.psp.cz/sqw/text/";
const CONCURRENCY = 3;
const DELAY_MS = 350;

interface Group {
  lawUrn: string;
  lawRef: string;
  lawTitle: string;
  bills: number[];
}

interface Skip {
  cislo: number;
  stage: "index" | "no-pdf" | "pdf-fetch" | "pdftotext";
  reason: string;
}

interface BillExtraction {
  cislo: number;
  docType: "platne-zneni" | "navrh-zakona";
  filename: string;
  idd: string;
  sourceUrl: string;
  paragraphs: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** psp.cz occasionally resets connections under light concurrency (observed, not rate-limit
 * headers) — retry transient network failures a few times with backoff before giving up. */
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

// ---------- fetch + parse index page ----------

interface IndexEntry {
  header: string;
  idd: string;
  filename: string;
}

function parseIndex(html: string): IndexEntry[] {
  const headers: { idx: number; text: string }[] = [];
  const headerRe = /<th colspan=2 class="lightblue">([^<]+)<\/th>/g;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(html))) {
    headers.push({ idx: hm.index, text: hm[1].replace(/&nbsp;/g, " ").trim() });
  }
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

/** Restrict to the operative novelization text. "platne-zneni" docs (current law + marked
 * changes) contain no explanatory memo — used whole, with a defensive trim if one somehow
 * appears. "navrh-zakona" docs (bill + memo) are trimmed to Čl. I / ČÁST PRVNÍ … before
 * DŮVODOVÁ ZPRÁVA, so citations of unrelated law inside the memo don't leak into the §-set. */
function operativeSlice(text: string, docType: BillExtraction["docType"]): string {
  const memoIdx = text.search(/D[ůu]vodov[áa]\s+zpr[áa]va/i);
  if (docType === "platne-zneni") {
    return memoIdx > 0 ? text.slice(0, memoIdx) : text;
  }
  const startMatch = text.match(/(^|\n)\s*(ČÁST PRVNÍ|Čl\.\s*I\b)/);
  const start = startMatch?.index ?? 0;
  const end = memoIdx > start ? memoIdx : text.length;
  return text.slice(start, end);
}

/** Base § reference extraction: "§ 35ba", "§35", "§ 38gb" → "35ba", "35", "38gb" (lowercased). */
function extractParagraphs(text: string): string[] {
  const re = /§\s?(\d+[a-z]*)/gi;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) set.add(m[1].toLowerCase());
  return [...set].sort((a, b) => a.localeCompare(b, "cs"));
}

/** Short deterministic excerpt around a §'s first occurrence — prefers a standalone section-
 * header line (the way "platne-zneni" docs render each touched §) over the first inline hit. */
function excerptFor(text: string, num: string): string {
  const esc = escapeRegExp(num);
  const lines = text.split(/\r?\n/);
  const headerRe = new RegExp(`^\\s*§\\s?${esc}\\b`, "i");
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      return lines
        .slice(i, i + 4)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 320);
    }
  }
  const inlineRe = new RegExp(`§\\s?${esc}\\b`, "i");
  const m = inlineRe.exec(text);
  if (!m) return "";
  const start = Math.max(0, m.index - 80);
  const end = Math.min(text.length, m.index + 240);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

// ---------- per-bill pipeline ----------

async function processBill(cislo: number): Promise<{ extraction?: BillExtraction; skip?: Skip; rawText?: string }> {
  let html: string;
  try {
    html = await fetchIndexHtml(cislo);
  } catch (e) {
    return { skip: { cislo, stage: "index", reason: (e as Error).message } };
  }

  const entries = parseIndex(html);
  const platne = entries.find((e) => /Platné znění/i.test(e.header));
  const navrh = entries.find((e) => /Návrh zákona/i.test(e.header));
  const chosen = platne ?? navrh;
  if (!chosen) {
    const headers = [...new Set(entries.map((e) => e.header))];
    return {
      skip: {
        cislo,
        stage: "no-pdf",
        reason: `no "Platné znění" or "Návrh zákona" PDF found in index (attachment headers present: ${headers.join(" | ") || "none"})`,
      },
    };
  }
  const docType: BillExtraction["docType"] = chosen === platne ? "platne-zneni" : "navrh-zakona";

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

  const operative = operativeSlice(text, docType);
  const paragraphs = extractParagraphs(operative);
  return {
    extraction: {
      cislo,
      docType,
      filename: chosen.filename,
      idd: chosen.idd,
      sourceUrl: `${BASE}orig2.sqw?idd=${chosen.idd}`,
      paragraphs,
    },
    rawText: operative,
  };
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(workers);
}

// ---------- main ----------

async function main() {
  const groups: Group[] = JSON.parse(readFileSync(GROUPS_PATH, "utf8")).groups;
  const worklist = [...new Set(groups.flatMap((g) => g.bills))].sort((a, b) => a - b);

  console.log(`collision-check: ${groups.length} groups, ${worklist.length} unique bills to fetch/parse\n`);

  const extractions = new Map<number, BillExtraction>();
  const rawTexts = new Map<number, string>();
  const skips: Skip[] = [];

  await pool(worklist, CONCURRENCY, async (cislo) => {
    const result = await processBill(cislo);
    if (result.skip) {
      skips.push(result.skip);
      console.log(`  ✗ tisk ${cislo}: SKIP [${result.skip.stage}] ${result.skip.reason}`);
    } else if (result.extraction) {
      extractions.set(cislo, result.extraction);
      if (result.rawText) rawTexts.set(cislo, result.rawText);
      console.log(
        `  ✓ tisk ${cislo}: ${result.extraction.docType} (${result.extraction.filename}) → ${result.extraction.paragraphs.length} §-refs [${result.extraction.paragraphs.join(", ")}]`,
      );
    }
  });

  // ---------- pairwise comparison within each group ----------

  interface CollisionPair {
    billA: number;
    billB: number;
    sharedParagraphs: {
      paragraph: string;
      excerptA: string;
      excerptB: string;
    }[];
  }

  interface GroupReport {
    lawUrn: string;
    lawRef: string;
    lawTitle: string;
    bills: number[];
    billsFetched: number[];
    billsSkipped: number[];
    collisions: CollisionPair[];
  }

  const groupReports: GroupReport[] = [];
  let groupsWithCollision = 0;
  const involvedBills = new Set<number>();
  const allPairs: { lawRef: string; billA: number; billB: number; paragraphs: string[] }[] = [];

  for (const g of groups) {
    const fetched = g.bills.filter((b) => extractions.has(b));
    const skipped = g.bills.filter((b) => !extractions.has(b));
    const collisions: CollisionPair[] = [];

    for (let i = 0; i < fetched.length; i++) {
      for (let j = i + 1; j < fetched.length; j++) {
        const a = fetched[i];
        const b = fetched[j];
        const setA = new Set(extractions.get(a)!.paragraphs);
        const setB = extractions.get(b)!.paragraphs;
        const shared = setB.filter((p) => setA.has(p));
        if (shared.length === 0) continue;
        const textA = rawTexts.get(a) ?? "";
        const textB = rawTexts.get(b) ?? "";
        collisions.push({
          billA: a,
          billB: b,
          sharedParagraphs: shared.map((p) => ({
            paragraph: p,
            excerptA: excerptFor(textA, p),
            excerptB: excerptFor(textB, p),
          })),
        });
        involvedBills.add(a);
        involvedBills.add(b);
        allPairs.push({ lawRef: g.lawRef, billA: a, billB: b, paragraphs: shared });
      }
    }

    if (collisions.length > 0) groupsWithCollision++;

    groupReports.push({
      lawUrn: g.lawUrn,
      lawRef: g.lawRef,
      lawTitle: g.lawTitle,
      bills: g.bills,
      billsFetched: fetched,
      billsSkipped: skipped,
      collisions,
    });
  }

  // sanity check: known 120<->244 collision on 586/1992 (§35ba)
  const sanityPair = allPairs.find(
    (p) => p.lawRef === "586/1992" && ((p.billA === 120 && p.billB === 244) || (p.billA === 244 && p.billB === 120)),
  );
  const sanityPass = !!sanityPair && sanityPair.paragraphs.includes("35ba");

  const report = {
    generatedAt: new Date().toISOString(),
    method:
      "deterministic §-level extraction (pdftotext regex on the psp.cz novelization PDF, preferring 'Platné znění s vyznačením změn' over 'Návrh zákona včetně důvodové zprávy') + pairwise base-§ set overlap within each amends-collision-groups.json group. No LLM judgment in the comparison.",
    caveat:
      "A shared § here is a CANDIDATE, not a confirmed drafting collision — base-§ overlap over the whole operative text also catches ordinary co-occurrence (both bills touch the same statute's generic/definitional §s, e.g. §2/§4/§6, or one bill's 'Platné znění' excerpt includes a neighbouring untouched § for context). A genuine collision like 120<->244 (both amend §35ba with renumbering instructions that assume different starting letterings) requires reading the shared-§ excerpts to confirm the instructions actually conflict. Treat `collisions` as a triage list for that review, not a verdict.",
    sourceGroups: GROUPS_PATH,
    stats: {
      groupsTotal: groups.length,
      groupsWithCollision,
      billsInWorklist: worklist.length,
      billsFetched: extractions.size,
      billsSkipped: skips.length,
      distinctBillsInCollisions: involvedBills.size,
      totalCollidingPairs: allPairs.length,
    },
    sanityCheck: {
      description: "tisk 120 <-> tisk 244 both amend §35ba of 586/1992 with renumbering instructions assuming different starting letterings (batch-001 finding, found by human/LLM reading both bills together).",
      reproduced: sanityPass,
      sharedParagraphs: sanityPair?.paragraphs ?? [],
    },
    skips,
    groups: groupReports,
    billExtractions: [...extractions.values()],
  };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 1));

  console.log(`\n${"=".repeat(70)}`);
  console.log(`groups with ≥1 confirmed §-level collision: ${groupsWithCollision} / ${groups.length}`);
  console.log(`distinct bills involved in a collision: ${involvedBills.size}`);
  console.log(`bills fetched/parsed: ${extractions.size} / ${worklist.length}  (skipped: ${skips.length})`);
  console.log(`sanity check (120 <-> 244, §35ba): ${sanityPass ? "PASS ✓" : "FAIL ✗ — debug extraction before trusting the rest"}`);
  if (allPairs.length > 0) {
    console.log(`\ncolliding pairs:`);
    for (const p of allPairs) {
      console.log(`  ${p.lawRef.padEnd(10)} tisk ${p.billA} <-> tisk ${p.billB}   shared §: ${p.paragraphs.join(", ")}`);
    }
  }
  if (skips.length > 0) {
    console.log(`\nskips:`);
    for (const s of skips) console.log(`  tisk ${s.cislo} [${s.stage}]: ${s.reason}`);
  }
  console.log(`\n→ ${OUT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
