/* Case ③ Law loop — the psp.cz tisk text pipeline, ONE definition (scan-sweep 2026-09-06).
 *
 * index page (tiskt.sqw, windows-1250) → the print's PDFs (orig2.sqw?idd=) → pdftotext -layout
 * → a `.txt` sidecar beside the PDF, all under CACHE_DIR (collision-core.ts owns the constant).
 *
 * Until now this lived as a byte copy in amends-census.ts and collision-check.ts. The copies
 * had already diverged: batch-008's NFC fix (pdftotext emits the same diacritic in two Unicode
 * forms inside one document, so a regex literal under-matches) landed in the census copy only.
 * Two other things both copies lacked, fixed here once:
 *   · a refusal is CLASSIFIED (lib/ingest/sources/refusal-class.ts): 503/5xx are retried with
 *     jittered backoff, 403/404 are one request and a RefusedError that names the class. The old
 *     loop retried only thrown errors — a 503 was answered once and fell through to `index HTTP
 *     503`, and the bill left the census as a skip on a transient outage;
 *   · `fetchOne` is injectable, so the behaviour above is testable (tiskText.test.ts).
 *
 * collision-check.ts still carries its pre-NFC copy — it belongs to the law-collision-analysis
 * context and is named in that round, not edited here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { backoffDelayMs } from "@/lib/ingest/sources/backoff";
import { classifyResponse, isTerminalRefusal, RefusedError } from "@/lib/ingest/sources/refusal-class";
import { CACHE_DIR } from "./collision-core";

export { CACHE_DIR };
export const PDFTOTEXT_BIN = existsSync("/clangarm64/bin/pdftotext") ? "/clangarm64/bin/pdftotext" : "pdftotext";
export const BASE = "https://www.psp.cz/sqw/text/";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchRetryOptions {
  timeoutMs: number;
  /** Total attempts (default 4). */
  attempts?: number;
  /** Backoff base in ms (default 500); the jittered ceiling is capped at 8× base. */
  baseDelayMs?: number;
  /** Injectable for tests; defaults to global fetch with an AbortSignal timeout. */
  fetchOne?: (url: string) => Promise<Response>;
}

/** psp.cz resets connections under light concurrency and answers 503 under load: transient
 *  failures and `pressure`/`broken` statuses are retried with full-jitter backoff; a `declined`
 *  or `absent` status is terminal after ONE request. */
export async function fetchWithRetry(url: string, opts: FetchRetryOptions): Promise<Response> {
  const attempts = opts.attempts ?? 4;
  const base = opts.baseDelayMs ?? 500;
  const fetchOne = opts.fetchOne ?? ((u: string) => fetch(u, { signal: AbortSignal.timeout(opts.timeoutMs) }));
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchOne(url);
      const cls = classifyResponse(res.status);
      if (cls.kind === "ok") return res;
      if (!cls.retryable) throw new RefusedError("psp.cz", url, cls);
      lastErr = new RefusedError("psp.cz", url, cls);
    } catch (e) {
      if (isTerminalRefusal(e)) throw e;
      lastErr = e;
    }
    if (i < attempts - 1) await sleep(backoffDelayMs(i, base, base * 8));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface IndexEntry {
  header: string;
  idd: string;
  filename: string;
}

/** The print's index page: each PDF link, attributed to the section header above it. */
export function parseIndex(html: string): IndexEntry[] {
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

export async function fetchIndexHtml(cislo: number): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, `tisk-${cislo}`, "index.html");
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const url = `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`;
  const res = await fetchWithRetry(url, { timeoutMs: 30_000 });
  const buf = Buffer.from(await res.arrayBuffer());
  const html = new TextDecoder("windows-1250").decode(buf);
  if (!/Sněmovní tisk/i.test(html)) throw new Error("index page did not contain 'Sněmovní tisk' — unexpected content");
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, html, "utf8");
  return html;
}

export async function fetchPdf(cislo: number, idd: string): Promise<string> {
  const dir = path.join(CACHE_DIR, `tisk-${cislo}`);
  mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${idd}.pdf`);
  if (existsSync(pdfPath)) return pdfPath;
  const url = `${BASE}orig2.sqw?idd=${idd}`;
  const res = await fetchWithRetry(url, { timeoutMs: 60_000 });
  const ct = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!ct.includes("pdf") && buf.slice(0, 4).toString("latin1") !== "%PDF") {
    throw new Error(`response at idd=${idd} was not a PDF (content-type: ${ct})`);
  }
  writeFileSync(pdfPath, buf);
  return pdfPath;
}

/** pdftotext -layout, persisted as `<pdf>.txt` beside the PDF; ALWAYS returned NFC-normalized
 *  (batch-008: the same diacritic can arrive in two Unicode forms inside one document). */
export function extractText(pdfPath: string): string {
  const txtPath = pdfPath.replace(/\.pdf$/, ".txt");
  if (existsSync(txtPath)) return readFileSync(txtPath, "utf8").normalize("NFC");
  const out = execFileSync(PDFTOTEXT_BIN, ["-layout", "-enc", "UTF-8", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 50_000_000,
  }).normalize("NFC");
  writeFileSync(txtPath, out, "utf8");
  return out;
}
