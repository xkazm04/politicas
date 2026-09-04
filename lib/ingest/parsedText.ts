/**
 * Durable parsed-text sidecar for the PDF lane (.ai/directions/2026-09-02-durable-parsed-text-sidecar.md).
 *
 * `extractPdfText` is the one expensive, third-party, availability-dependent stage in this
 * repo's ingest tree — every other adapter (UNL, JSON-LD, CSV, XML) is a cheap deterministic
 * decode that is correctly re-run from cached bytes every time. So the parse output is
 * persisted BESIDE the source and read back in preference to re-parsing, exactly as the law
 * loop already does (`scripts/case-loops/law/collision-core.ts` reads the `.txt` files beside
 * the cached bill PDFs). The source stays the authority: the sidecar is a rebuildable derived
 * artifact, it lives inside the same gitignored cache dir as the bytes, and it is deleted
 * with them (`deleteParsedText`) so a pruned PDF can never leave extracted text behind with
 * nothing to re-derive it from.
 *
 * The stamp is the whole contract. Line 1 of the sidecar is `#parsed-text/1 <parser> <digest>`
 * — format version, parser identity+version, and a fingerprint of the exact bytes that were
 * parsed. Reuse requires ALL THREE to match; anything else (an older format, a different
 * unpdf, different bytes under the same filename, no stamp at all) is a loud miss, never a
 * silent pass. If the parser version cannot be read at runtime the guard is undecidable, so
 * the sidecar is disabled altogether rather than degraded into an unverifiable cache.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { extractPdfText } from "@/lib/ingest/sources/kiosek-pdf";

export const SIDECAR_FORMAT = "parsed-text/1";

export interface ParsedTextResult {
  text: string;
  /** `"sidecar"` = the stamp matched and unpdf was not invoked. */
  source: "sidecar" | "parsed";
}

export interface ParsedTextOptions {
  /** Parser stamp, e.g. `unpdf@1.8.1`. `null` disables the sidecar entirely. */
  parser?: string | null;
  extract?: (bytes: Uint8Array) => Promise<string>;
  /** The deliberate override, per the repo's `--refetch` / `--supersede` convention. */
  reparse?: boolean;
  warn?: (message: string) => void;
}

/** The sidecar for one PDF, beside it: `<pdf>.txt`. */
export function parsedTextPath(pdfPath: string): string {
  return `${pdfPath}.txt`;
}

let cachedStamp: string | null | undefined;

/** `unpdf@<installed version>`, or null when it cannot be read (guard undecidable). */
export function currentParserStamp(): string | null {
  if (cachedStamp !== undefined) return cachedStamp;
  cachedStamp = null;
  try {
    let dir = dirname(createRequire(import.meta.url).resolve("unpdf"));
    for (let i = 0; i < 6 && dir; i++) {
      const manifest = join(dir, "package.json");
      if (existsSync(manifest)) {
        const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; version?: string };
        if (pkg.name === "unpdf" && pkg.version) cachedStamp = `unpdf@${pkg.version}`;
        break;
      }
      dir = dirname(dir);
    }
  } catch (err) {
    console.warn(`[parsedText] unpdf version unreadable (${(err as Error).message})`);
  }
  return cachedStamp;
}

function stampLine(parser: string, bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `#${SIDECAR_FORMAT} ${parser} sha256:${digest}`;
}

/**
 * Read the parsed text from the sidecar when its stamp matches, otherwise extract it and
 * write the sidecar atomically (`.part` then rename — a partial write must never be
 * mistaken for a parse, the discipline `dataor.ts` already states for downloads).
 *
 * Backfill: every PDF cached before this existed has no sidecar and simply parses once more.
 */
export async function readOrExtractText(
  pdfPath: string,
  bytes: Uint8Array,
  opts: ParsedTextOptions = {},
): Promise<ParsedTextResult> {
  const { extract = extractPdfText, reparse = false, warn = console.warn } = opts;
  const parser = opts.parser === undefined ? currentParserStamp() : opts.parser;
  if (parser === null) {
    warn("[parsedText] no parser stamp available — sidecar disabled, parsing");
    return { text: await extract(bytes), source: "parsed" };
  }
  const path = parsedTextPath(pdfPath);
  const want = stampLine(parser, bytes);
  if (!reparse) {
    const cached = await readFile(path, "utf8").catch(() => null);
    const eol = cached === null ? -1 : cached.indexOf("\n");
    if (cached !== null) {
      const head = eol < 0 ? cached : cached.slice(0, eol);
      if (eol > 0 && head === want) return { text: cached.slice(eol + 1), source: "sidecar" };
      warn(`[parsedText] ${path}: stamp ${JSON.stringify(head.slice(0, 80))} != ${JSON.stringify(want)} — re-parsing`);
    }
  }
  const text = await extract(bytes);
  const part = `${path}.part`;
  await writeFile(part, `${want}\n${text}`, "utf8");
  await rename(part, path);
  return { text, source: "parsed" };
}

/** The reaper: a sidecar must never outlive the bytes it was derived from. */
export async function deleteParsedText(pdfPath: string): Promise<void> {
  await rm(parsedTextPath(pdfPath), { force: true });
}
