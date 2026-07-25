/**
 * Case-loops batch-006, kiosek ingest — the bounded first slice.
 *
 * Parses ALL postings' JSON-LD metadata across the 5 already-cached
 * institutions (516+1420+38+84+244 = 2,302 postings: MS Praha/201000,
 * Obvodní soud Praha 1/201010, Vrchní soud Praha/221000, Nejvyšší soud/
 * 222000, KSZ Praha/302000 — see docs/data-analysis/justice-sources-kiosek.md
 * for why these 5), classifies every posting, then extracts PDF text +
 * join keys for a BOUNDED PDF sample: the 5 already-cached PDFs (matched
 * back to their real posting by the attachment uuid in their download URL)
 * plus up to MAX_ADDITIONAL_PDFS more substantive-classified MS Praha
 * postings from the Obchodní / Insolvenční řízení / Veřejné rejstříky /
 * Správní soudnictví agendas, fetched live from infodeska.gov.cz with the
 * kiosek.ts throttle helper.
 *
 * Run:
 *   npx tsx scripts/case-loops/sources/kiosek-slice.ts
 *
 * Writes docs/data-analysis/case-sources/kiosek-slice-extract.json — the
 * input the Opus verification pass and the join-key validation script both
 * read. No live network calls happen for the 5 cached institutions'
 * metadata (read from .justice-samples/, gitignored); only the additional
 * PDF fetches touch the network, and only up to MAX_ADDITIONAL_PDFS of them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  extractIcos,
  extractStatuteCitations,
  fetchWithThrottle,
  KIOSEK_THROTTLE_MS,
  parsePostings,
  type IcoMention,
  type PostingRow,
  type StatuteCitation,
} from "@/lib/ingest/sources/kiosek";
import { extractPdfText } from "@/lib/ingest/sources/kiosek-pdf";

const SAMPLES_DIR = ".justice-samples";
const CACHE_DIR = ".kiosek-cache/pdfs";
const OUT_PATH = "docs/data-analysis/case-sources/kiosek-slice-extract.json";

const INSTITUTIONS = [
  { code: "201000", nazev: "Městský soud v Praze", file: "201000.jsonld" },
  { code: "201010", nazev: "Obvodní soud pro Prahu 1", file: "201010.jsonld" },
  { code: "221000", nazev: "Vrchní soud v Praze", file: "221000.jsonld" },
  { code: "222000", nazev: "Nejvyšší soud", file: "222000.jsonld" },
  { code: "302000", nazev: "Krajské státní zastupitelství v Praze", file: "302000.jsonld" },
];

// The 5 already-cached PDFs, matched back to a real posting by the
// attachment uuid embedded in the infodeska.gov.cz download URL (per the
// spec doc's "Concrete URLs" section).
const CACHED_PDFS: { file: string; uuid: string; note: string }[] = [
  { file: "obchodni1.pdf", uuid: "4bb11377-8d97-46c4-b9fb-b4e3a606e29d", note: "delivery notice, no IČO" },
  { file: "ins1.pdf", uuid: "22905cfa-e76a-478b-a470-f8ac3ff0d207", note: "INS delivery notice" },
  { file: "vr1.pdf", uuid: "50550b81-18ae-4b44-9d9b-2a6f83b8841b", note: "register delivery notice" },
  { file: "likv.pdf", uuid: "15375249-738d-469d-b43a-994d87fd62f2", note: "liquidation usnesení, 2 IČOs, 5 statutes" },
  { file: "rozsudek1.pdf", uuid: "a071cceb-c1a0-40f1-b534-78e1baf97c9f", note: "asylum rozsudek, 4+ statutes" },
];

// Bounded additional-PDF budget, per the driving prompt's "up to ~15-20 more"
// guidance — kept conservative given the throttle cost (1.5s/call sequential).
const MAX_ADDITIONAL_PDFS = 18;
const TARGET_AGENDAS = new Set(["Obchodní", "Insolvenční řízení (INS, ICm)", "Veřejné rejstříky", "Správní soudnictví"]);

interface PdfExtraction {
  postingId: string;
  institutionCode: string;
  spisovaZnacka: string | null;
  title: string;
  agendas: string[];
  pdfSource: "cached-sample" | "fetched-live";
  pdfFile: string;
  textLength: number;
  statutes: StatuteCitation[];
  icos: IcoMention[];
}

function loadRaw(file: string): unknown {
  return JSON.parse(readFileSync(join(SAMPLES_DIR, file), "utf8"));
}

function prov(sourceUrl: string) {
  return { source: "kiosek-uredni-deska", sourceUrl, fetchedAt: new Date().toISOString() };
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync("docs/data-analysis/case-sources", { recursive: true });

  // ── 1. parse ALL postings across the 5 cached institutions ─────────────
  const allPostings: PostingRow[] = [];
  const perInstitution: Record<string, { total: number; byLabel: Record<string, number> }> = {};
  for (const inst of INSTITUTIONS) {
    const raw = loadRaw(inst.file);
    const rows = parsePostings(raw, inst.code, prov(join(SAMPLES_DIR, inst.file)));
    allPostings.push(...rows);
    const byLabel: Record<string, number> = { boilerplate: 0, substantive: 0, administrative: 0, unclassified: 0 };
    for (const r of rows) byLabel[r.classification.label]++;
    perInstitution[inst.code] = { total: rows.length, byLabel };
  }

  const overallByLabel: Record<string, number> = { boilerplate: 0, substantive: 0, administrative: 0, unclassified: 0 };
  for (const p of allPostings) overallByLabel[p.classification.label]++;

  // ── 2. match the 5 cached PDFs to their real posting ────────────────────
  const byUuid = new Map<string, PostingRow>();
  for (const p of allPostings) {
    for (const a of p.attachments) {
      const m = /soubor\/([0-9a-f-]{36})\/download/.exec(a.url);
      if (m) byUuid.set(m[1], p);
    }
  }

  const extractions: PdfExtraction[] = [];
  const unmatchedCachedPdfs: string[] = [];

  for (const c of CACHED_PDFS) {
    const posting = byUuid.get(c.uuid);
    const pdfPath = join(SAMPLES_DIR, "pdfs", c.file);
    if (!existsSync(pdfPath)) continue;
    const bytes = new Uint8Array(readFileSync(pdfPath));
    const text = await extractPdfText(bytes);
    const postingId = posting?.id ?? `unmatched:${c.file}`;
    if (!posting) unmatchedCachedPdfs.push(c.file);
    extractions.push({
      postingId,
      institutionCode: posting?.institutionCode ?? "unknown",
      spisovaZnacka: posting?.spisovaZnacka ?? null,
      title: posting?.title ?? c.note,
      agendas: posting?.agendas ?? [],
      pdfSource: "cached-sample",
      pdfFile: c.file,
      textLength: text.length,
      statutes: extractStatuteCitations(postingId, text),
      icos: extractIcos(postingId, text),
    });
  }

  // ── 3. bounded additional PDF fetch: MS Praha substantive postings in the target agendas ──
  const alreadyExtractedIds = new Set(extractions.map((e) => e.postingId));
  const candidates = allPostings.filter(
    (p) =>
      p.institutionCode === "201000" &&
      p.classification.label === "substantive" &&
      p.agendas.some((a) => TARGET_AGENDAS.has(a)) &&
      !alreadyExtractedIds.has(p.id) &&
      p.attachments.length > 0 &&
      p.attachments[0].url,
  );
  const toFetch = candidates.slice(0, MAX_ADDITIONAL_PDFS);

  console.log(
    `slice scope: ${allPostings.length} postings parsed across 5 institutions; ${candidates.length} additional substantive MS-Praha candidates found in target agendas; fetching ${toFetch.length} (budget ${MAX_ADDITIONAL_PDFS})`,
  );

  if (toFetch.length > 0) {
    const responses = await fetchWithThrottle(
      toFetch.map((p) => p.attachments[0].url),
      (url) => fetch(url),
      { delayMs: KIOSEK_THROTTLE_MS },
    );
    for (let i = 0; i < toFetch.length; i++) {
      const posting = toFetch[i];
      const res = responses[i];
      const bytes = new Uint8Array(await res.arrayBuffer());
      const safeName = `${posting.institutionCode}-${(posting.spisovaZnacka ?? posting.id).replace(/[^\w.-]+/g, "_")}.pdf`;
      writeFileSync(join(CACHE_DIR, safeName), bytes);
      const text = await extractPdfText(bytes);
      extractions.push({
        postingId: posting.id,
        institutionCode: posting.institutionCode,
        spisovaZnacka: posting.spisovaZnacka,
        title: posting.title,
        agendas: posting.agendas,
        pdfSource: "fetched-live",
        pdfFile: safeName,
        textLength: text.length,
        statutes: extractStatuteCitations(posting.id, text),
        icos: extractIcos(posting.id, text),
      });
    }
  }

  // ── 4. write the slice payload ───────────────────────────────────────────
  const allStatutes = extractions.flatMap((e) => e.statutes);
  const allIcos = extractions.flatMap((e) => e.icos);

  const payload = {
    generatedAt: new Date().toISOString(),
    scope: {
      institutions: INSTITUTIONS.map((i) => i.code),
      postingsParsedTotal: allPostings.length,
      perInstitution,
      overallByLabel,
      pdfsExtracted: extractions.length,
      cachedPdfsMatched: CACHED_PDFS.length - unmatchedCachedPdfs.length,
      unmatchedCachedPdfs,
      additionalPdfCandidatesFound: candidates.length,
      additionalPdfsFetched: toFetch.length,
      additionalPdfBudget: MAX_ADDITIONAL_PDFS,
    },
    extractions,
    distinctStatuteCitations: [...new Set(allStatutes.map((s) => s.lawUrn))].sort(),
    distinctIcos: [...new Set(allIcos.map((m) => m.ico))].sort(),
    totals: {
      statuteCitationMentions: allStatutes.length,
      distinctStatuteCitations: new Set(allStatutes.map((s) => s.lawUrn)).size,
      icoMentions: allIcos.length,
      distinctIcos: new Set(allIcos.map((m) => m.ico)).size,
    },
  };

  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`wrote ${OUT_PATH}`);
  console.log(
    `totals: ${payload.totals.statuteCitationMentions} statute mentions (${payload.totals.distinctStatuteCitations} distinct), ${payload.totals.icoMentions} IČO mentions (${payload.totals.distinctIcos} distinct)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
