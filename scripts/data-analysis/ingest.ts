/* Ingest the REAL civic corpus into the PGlite store.
 *
 *   npx tsx scripts/data-analysis/ingest.ts [--term=PSP10] [--no-pumper] [--refetch]
 *
 * Two paths, deliberately different:
 *   1. psp.cz bulk dumps — downloaded directly (binary ZIP of windows-1250 UNL;
 *      see lib/ingest/sources/psp.ts for why this does not go through Pumper).
 *   2. Pumper mirror     — the release page's fingerprint + parsed file manifest,
 *      exported out of the running Pumper service. This is what makes staleness
 *      of (1) detectable, since psp.cz publishes no version or diff feed.
 *
 * Downloads are cached under ./.data/psp and re-used unless --refetch is passed,
 * so re-running the ingest does not re-hit the publisher.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";
import {
  PSP_OPENDATA_BASE,
  PSP_OPENDATA_INDEX,
  SOURCE_HLASOVANI,
  SOURCE_POSLANCI,
  normalizeHlasovani,
  normalizePoslanci,
} from "@/lib/ingest/sources/psp";
import { SOURCE_PUMPER, mirrorPumperReleases, pumperUrl } from "@/lib/ingest/sources/pumper";

const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
// Identify politicas honestly to the publisher; psp.cz's robots.txt does not
// disallow /eknih/cdrom/opendata/ and the licence is "free, cite the source".
const UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

interface Dump {
  fileName: string;
  url: string;
  bytes: Uint8Array;
  lastModified: string | null;
  fetchedAt: string;
}

async function getDump(fileName: string, refetch: boolean): Promise<Dump> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  const metaPath = `${path}.meta.json`;
  const url = `${PSP_OPENDATA_BASE}/${fileName}`;

  if (!refetch && existsSync(path) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      lastModified: string | null;
      fetchedAt: string;
    };
    const bytes = new Uint8Array(readFileSync(path));
    console.log(`  cached ${fileName} (${bytes.length.toLocaleString()} B, fetched ${meta.fetchedAt})`);
    return { fileName, url, bytes, lastModified: meta.lastModified, fetchedAt: meta.fetchedAt };
  }

  const t0 = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const lastModified = res.headers.get("last-modified");
  const fetchedAt = new Date().toISOString();
  writeFileSync(path, bytes);
  writeFileSync(metaPath, JSON.stringify({ lastModified, fetchedAt, url }, null, 1));
  console.log(
    `  fetched ${fileName} (${bytes.length.toLocaleString()} B, ${Date.now() - t0} ms, last-modified ${lastModified ?? "—"})`,
  );
  return { fileName, url, bytes, lastModified, fetchedAt };
}

async function main() {
  const wantTerm = arg("term", "PSP10");
  const refetch = flag("refetch");
  const t0 = Date.now();

  const store = await getStore();
  if (!store) throw new Error("no store configured (DB_DRIVER)");

  const totals: Record<string, number> = {};
  const add = (k: string, n: number) => {
    totals[k] = (totals[k] ?? 0) + n;
  };

  /* ── 1. poslanci.zip → person / organ / mandate / membership ───────────── */
  console.log("psp.cz poslanci.zip");
  const poslanci = await getDump("poslanci.zip", refetch);
  const runPoslanci = await store.startIngestRun({
    source: SOURCE_POSLANCI,
    sourceUrl: poslanci.url,
    sourceLastModified: poslanci.lastModified,
    note: "full snapshot; person/organ/mandate/membership registries",
  });
  const prov1 = {
    source: SOURCE_POSLANCI,
    sourceUrl: poslanci.url,
    fetchedAt: poslanci.fetchedAt,
    ingestRunId: runPoslanci,
  };
  const bundle = normalizePoslanci(poslanci.bytes, prov1);
  add("organ", await store.upsertOrgans(bundle.organs));
  add("person", await store.upsertPersons(bundle.persons));
  add("mandate", await store.upsertMandates(bundle.mandates));
  add("membership", await store.upsertMemberships(bundle.memberships));
  const rows1 = bundle.organs.length + bundle.persons.length + bundle.mandates.length + bundle.memberships.length;
  const dup1 = Object.values(bundle.duplicates).reduce((a, b) => a + b, 0);
  await store.finishIngestRun(runPoslanci, "ok", rows1, dup1 ? `${dup1} duplicate natural keys in source` : null);
  console.log(
    `  → organ ${bundle.organs.length}, person ${bundle.persons.length}, mandate ${bundle.mandates.length}, membership ${bundle.memberships.length}` +
      (dup1 ? `  (${dup1} duplicate natural keys collapsed: ${JSON.stringify(bundle.duplicates)})` : ""),
  );

  /* ── 2. hl-<year>ps.zip → vote_event / vote_ballot / absence ───────────── */
  // Map the requested term code back to the dump the publisher files it under.
  const termOrgan = [...bundle.termCodes.entries()].find(([, code]) => code === wantTerm);
  if (!termOrgan) {
    throw new Error(`term ${wantTerm} not found in the organ registry (available: ${[...bundle.termCodes.values()].join(", ")})`);
  }
  const termStart = bundle.organs.find((o) => o.pspId === termOrgan[0])?.validFrom;
  const dumpYear = termStart ? termStart.slice(0, 4) : "";
  const hlFile = `hl-${dumpYear}ps.zip`;
  console.log(`psp.cz ${hlFile}  (term ${wantTerm}, organ ${termOrgan[0]}, opened ${termStart})`);

  const hl = await getDump(hlFile, refetch);
  const runHl = await store.startIngestRun({
    source: SOURCE_HLASOVANI,
    sourceUrl: hl.url,
    sourceLastModified: hl.lastModified,
    note: `roll calls + per-MP ballots + excused absences, term ${wantTerm}`,
  });
  const prov2 = {
    source: SOURCE_HLASOVANI,
    sourceUrl: hl.url,
    fetchedAt: hl.fetchedAt,
    ingestRunId: runHl,
  };
  const votes = normalizeHlasovani(hl.bytes, prov2, bundle.termCodes);
  add("vote_event", await store.upsertVoteEvents(votes.voteEvents));
  console.log(`  → vote_event ${votes.voteEvents.length}; writing ${votes.ballots.length.toLocaleString()} ballots…`);
  const tb = Date.now();
  add("vote_ballot", await store.upsertVoteBallots(votes.ballots));
  console.log(`  → vote_ballot ${votes.ballots.length.toLocaleString()} in ${((Date.now() - tb) / 1000).toFixed(1)}s`);
  add("absence", await store.upsertAbsences(votes.absences));
  const rows2 = votes.voteEvents.length + votes.ballots.length + votes.absences.length;
  const dup2 = Object.values(votes.duplicates).reduce((a, b) => a + b, 0);
  await store.finishIngestRun(runHl, "ok", rows2, dup2 ? `${dup2} duplicate natural keys in source` : null);
  console.log(
    `  → absence ${votes.absences.length}` +
      (dup2 ? `  (${dup2} duplicate natural keys collapsed: ${JSON.stringify(votes.duplicates)})` : ""),
  );

  /* ── 3. Pumper mirror → source_release ─────────────────────────────────── */
  if (!flag("no-pumper")) {
    console.log(`pumper mirror (${pumperUrl()})`);
    const runPumper = await store.startIngestRun({
      source: SOURCE_PUMPER,
      sourceUrl: PSP_OPENDATA_INDEX,
      sourceLastModified: null,
      note: "mirror of extractor/extracted + watch/pages, psp.cz records only",
    });
    try {
      const releases = await mirrorPumperReleases({
        source: SOURCE_PUMPER,
        sourceUrl: PSP_OPENDATA_INDEX,
        fetchedAt: new Date().toISOString(),
        ingestRunId: runPumper,
      });
      add("source_release", await store.upsertSourceReleases(releases));
      await store.finishIngestRun(runPumper, "ok", releases.length);
      const mangled = releases.filter((r) => r.raw._mangled === true).length;
      console.log(
        `  → source_release ${releases.length}` +
          (mangled ? `  (⚠ ${mangled} rows carry U+FFFD from Pumper's charset handling — flagged, not repaired)` : ""),
      );
    } catch (e) {
      // A down Pumper must not fail the civic ingest — the corpus's primary data
      // comes from the direct download. Record the failure honestly instead.
      const msg = e instanceof Error ? e.message : String(e);
      await store.finishIngestRun(runPumper, "failed", 0, msg);
      console.error(`  ! pumper mirror failed: ${msg}`);
    }
  }

  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`\ningested ${total.toLocaleString()} rows in ${wall}s`);
  for (const [k, v] of Object.entries(totals).sort()) console.log(`  ${k.padEnd(16)} ${v.toLocaleString()}`);
  await store.close();
}

// Do NOT process.exit(0) here: PGlite's final flush to the data directory is
// completed by store.close(), and an eager exit can race it — a 406k-row write
// followed by a small run-status update reliably lost the update on Windows when
// the process was killed immediately after close() resolved. Letting the event
// loop drain naturally is the durable path.
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
