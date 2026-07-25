// PDF text extraction for kiosek postings. Split from kiosek.ts so the pure
// JSON-LD parsers/extractors stay dependency-free and testable without a PDF
// engine in play; this is the one file that touches `unpdf`.
//
// WHY unpdf: no PDF-parsing library was installed (`grep -i pdf package.json`
// returned nothing). Needed a lightweight, actively-maintained, pure-JS/TS
// extractor with no native bindings (this runs inside a Next.js app —
// `serverExternalPackages` already has one wasm dependency, PGlite, per the
// batch-006 status note; a second native-binding dependency was avoided).
// `unpdf` (unjs org) wraps a serverless-optimized pdfjs-dist build, ships
// pure ESM, and is actively maintained (v1.8.0 at install time, 2026-07-25).
// `pdf-parse` and raw `pdfjs-dist` were considered and rejected: pdf-parse's
// default entry point has a documented footgun (executes its own bundled
// test fixture on bare `require`), and raw pdfjs-dist is the much heavier,
// lower-level dependency unpdf itself wraps.

import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract plain text from one PDF's raw bytes (merged across all pages —
 * kiosek postings are short usneseni/rozsudky, not multi-volume documents,
 * so page boundaries carry no extraction-relevant information here).
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
