/* Surgical re-mirror of the Pumper psp.cz datasets into source_release, WITHOUT
 * re-downloading the 467k-row bulk corpus. Run after Pumper's windows-1250
 * charset fix (2026-07) landed: the extractor/watch datasets were re-fetched with
 * correct decoding, so this pulls the clean text over the mangled rows.
 *
 *   DB_DRIVER=pglite NEXT_PUBLIC_DEV_AUTH=1 npx tsx scripts/data-analysis/remirror-pumper.ts
 */
import { getStore } from "@/lib/db/store";
import { PSP_OPENDATA_INDEX } from "@/lib/ingest/sources/psp";
import { SOURCE_PUMPER, mirrorPumperReleases } from "@/lib/ingest/sources/pumper";

async function main() {
  const store = await getStore();
  if (!store) {
    console.error("no store");
    process.exit(1);
  }
  const run = await store.startIngestRun({
    source: SOURCE_PUMPER,
    sourceUrl: PSP_OPENDATA_INDEX,
    sourceLastModified: null,
    note: "re-mirror after Pumper windows-1250 charset fix",
  });
  const releases = await mirrorPumperReleases({
    source: SOURCE_PUMPER,
    sourceUrl: PSP_OPENDATA_INDEX,
    fetchedAt: new Date().toISOString(),
    ingestRunId: run,
  });
  const written = await store.upsertSourceReleases(releases);
  await store.finishIngestRun(run, "ok", written);

  // The adapter stamps `raw._mangled` per row (U+FFFD in any decoded text) — the
  // authoritative flag the onboarding report counted at 17.
  const stillMangled = releases.filter((r) => (r.raw as { _mangled?: boolean })._mangled === true);
  console.log(`source_release re-mirrored: ${written} rows`);
  console.log(`rows carrying U+FFFD now: ${stillMangled.length} (was 17 before the charset fix)`);
  for (const r of stillMangled) {
    console.log(`   still mangled: ${(r as { key?: string }).key ?? JSON.stringify(r).slice(0, 80)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
