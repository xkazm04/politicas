// Pumper backbone adapter.
//
// Pumper (C:\Users\mkdol\dolla\pumper) is a local-first scraping service that
// runs generic apps on a schedule and stores their output in change-detected,
// per-app datasets. This adapter MIRRORS the psp.cz-related records out of two
// of those datasets into politicas' own corpus over Pumper's HTTP export API.
//
// WHAT IT GIVES US THAT A DIRECT DOWNLOAD DOES NOT:
//   The psp.cz dumps are full snapshots with no diff feed and no version number.
//   "Is our snapshot stale, and did the publisher change what it publishes?" is
//   therefore not answerable from the dumps themselves. Pumper answers it:
//     • `watch/pages`         — content fingerprint (sha256 + char count) of the
//                               release page, with change detection across runs.
//     • `extractor/extracted` — the release page's file table parsed into a
//                               machine-readable manifest (file, href, description),
//                               so a NEW dump appearing upstream is a data event.
//   Both land in `source_release`, which is what `freshness` scores against.
//
// KNOWN DEFECT IN THE UPSTREAM PATH (verified 2026-07-23, reported, not worked
// around): Pumper's HTML fetch does not honour the `charset=windows-1250` that
// psp.cz declares, so Czech letters outside latin-1 (ě ř č š ž ů) arrive as
// U+FFFD in `description`/`title`. The mirrored text is therefore stored as-is
// and FLAGGED (`textMangled`), never "repaired" by guessing — a civic dataset
// must not contain characters nobody published. The authoritative Czech text
// comes from the direct UNL download, which we decode ourselves.

import type { SourceReleaseRow } from "@/lib/db/types";

const DEFAULT_PUMPER_URL = "http://127.0.0.1:8088";

export const SOURCE_PUMPER = "pumper-psp-opendata";

export function pumperUrl(): string {
  return (process.env.PUMPER_URL || DEFAULT_PUMPER_URL).replace(/\/+$/, "");
}

/** Dataset export record shape (Pumper streams a bare array of these). */
export interface PumperRecord {
  key: string;
  data: Record<string, unknown>;
  first_seen?: string;
  last_seen?: string;
  updated_at?: string;
  removed_at?: string | null;
}

/** The two Pumper datasets this corpus mirrors. */
export const MIRRORED_DATASETS = [
  { app: "extractor", dataset: "extracted" },
  { app: "watch", dataset: "pages" },
] as const;

/** U+FFFD anywhere means the fetcher lost bytes it could not decode. */
export function isTextMangled(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => typeof v === "string" && v.includes("�"));
}

/**
 * Fetch one dataset export. Pumper's `/export` streams a bare JSON array; older
 * builds returned `{app,dataset,count,records}`. Both are accepted so a Pumper
 * upgrade does not silently produce an empty mirror.
 */
export async function fetchPumperDataset(
  app: string,
  dataset: string,
  opts: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<PumperRecord[]> {
  const base = (opts.baseUrl ?? pumperUrl()).replace(/\/+$/, "");
  const url = `${base}/datasets/${app}/${dataset}/export?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000) });
  if (!res.ok) {
    throw new Error(`Pumper ${app}/${dataset} export returned HTTP ${res.status} ${res.statusText}`);
  }
  const payload: unknown = await res.json();
  if (Array.isArray(payload)) return payload as PumperRecord[];
  const records = (payload as { records?: unknown }).records;
  if (Array.isArray(records)) return records as PumperRecord[];
  throw new Error(`Pumper ${app}/${dataset} export: unrecognized envelope`);
}

interface Prov {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  ingestRunId: number | null;
}

const asString = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const asNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Resolve a relative href from the psp.cz release page against its own URL. */
export function resolveHref(href: string | null, pageUrl: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

/** True when `url`'s actual HOST is `host` (or a subdomain of it) — NOT a
 * substring match. `url.includes("psp.cz")` would also match
 * "https://example.com/redirect?to=psp.cz" or "https://not-psp.cz.evil.example/",
 * exactly the provenance-poisoning this filter exists to prevent. An
 * unparseable url is treated as a rejection, not a silent pass-through. */
function isOnHost(url: string, host: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === host || hostname.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

/**
 * Turn mirrored Pumper records into `source_release` rows. Only records whose
 * key/url is on the psp.cz host are taken — Pumper's datasets are shared with
 * other products, and importing a neighbour's rows would poison provenance.
 */
export function normalizePumperReleases(
  input: { app: string; dataset: string; records: PumperRecord[] }[],
  prov: Prov,
  hostFilter = "psp.cz",
): SourceReleaseRow[] {
  const out: SourceReleaseRow[] = [];
  for (const { app, dataset, records } of input) {
    for (const rec of records) {
      const key = rec.key ?? "";
      const data = rec.data ?? {};
      const url = asString(data.url) ?? asString(data._url) ?? key;
      if (!isOnHost(url, hostFilter)) continue;
      const observedAt = rec.updated_at ?? rec.last_seen ?? null;

      if (app === "extractor") {
        // One row per dump file in the release manifest.
        const dumps = Array.isArray(data.dumps) ? (data.dumps as Record<string, unknown>[]) : [];
        const pageTitle = asString(data.page_title);
        for (const d of dumps) {
          const fileName = asString(d.file);
          if (!fileName) continue; // header/spacer rows in the source table
          out.push({
            id: `pumper:${app}:${dataset}:${key}:${fileName}`,
            pumperApp: app,
            pumperDataset: dataset,
            recordKey: key,
            fileName,
            fileUrl: resolveHref(asString(d.href), url),
            description: asString(d.description),
            pageTitle,
            contentSha256: null,
            observedChars: null,
            observedAt,
            ...prov,
            sourceUrl: url,
            raw: { ...d, _mangled: isTextMangled(asString(d.description), pageTitle) },
          });
        }
        continue;
      }

      if (app === "watch") {
        out.push({
          id: `pumper:${app}:${dataset}:${key}`,
          pumperApp: app,
          pumperDataset: dataset,
          recordKey: key,
          fileName: null,
          fileUrl: null,
          description: null,
          pageTitle: asString(data.title),
          contentSha256: asString(data.content_sha256),
          observedChars: asNumber(data.chars),
          observedAt,
          ...prov,
          sourceUrl: url,
          raw: {
            title: asString(data.title),
            chars: asNumber(data.chars),
            content_sha256: asString(data.content_sha256),
            _mangled: isTextMangled(asString(data.title), asString(data.excerpt)),
          },
        });
      }
    }
  }
  return out;
}

/** End-to-end mirror: pull both datasets and normalize. */
export async function mirrorPumperReleases(
  prov: Prov,
  opts: { baseUrl?: string } = {},
): Promise<SourceReleaseRow[]> {
  const bundles: { app: string; dataset: string; records: PumperRecord[] }[] = [];
  for (const { app, dataset } of MIRRORED_DATASETS) {
    bundles.push({ app, dataset, records: await fetchPumperDataset(app, dataset, opts) });
  }
  return normalizePumperReleases(bundles, prov);
}
