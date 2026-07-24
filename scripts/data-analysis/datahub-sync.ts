/* Publishes the civic corpus's METADATA to DataHub — the catalog layer the
 * `/data-analysis-dh` skill reads instead of hand-carrying context in prompts.
 * METADATA ONLY: no civic rows are ever sent — only schemas, deterministic
 * stats, documentation (source known-issues + corpus rules), coverage state, and
 * lineage. This is a civic-accountability product; the rows stay in the store.
 *
 * What lands in the catalog (platform `politicas`, env PROD):
 *   politicas.corpus.<source>.<entity>        one per graph entity (schema + docs)
 *   politicas.slice.<source>.<term>.<entity>   one per analysis slice (stats + coverage)
 *   politicas.store.slice_quality              the scorer's output + the RUBRIC
 *                                              (each criterion a documented field)
 *
 * Lineage: pumper.<app>.<dataset> → corpus.pumper-psp-opendata.source_release
 *          (the ONE mirrored path); every psp corpus dataset → its slices;
 *          slice_quality ← all corpus datasets.
 *
 *   npx tsx scripts/data-analysis/datahub-sync.ts --stats=<dir>/stats.json [--gms=http://localhost:8080]
 */
import { readFileSync } from "node:fs";
import type { SliceStats } from "./slice-stats";

const PLATFORM = "urn:li:dataPlatform:politicas";
const PUMPER_PLATFORM = "urn:li:dataPlatform:pumper";
const ACTOR = "urn:li:corpuser:data-analysis";
const BATCH = 25;

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const ENV = arg("env", "PROD");
const GMS = arg("gms", process.env.DATAHUB_GMS_URL || "http://localhost:8080").replace(/\/+$/, "");
const clean = (s: string) => s.replace(/[.\-]/g, "_");
const datasetUrn = (name: string) => `urn:li:dataset:(${PLATFORM},${name},${ENV})`;
const corpusName = (source: string, entity: string) => `corpus.${clean(source)}.${entity}`;
const sliceName = (source: string, term: string, entity: string) =>
  `slice.${clean(source)}.${clean(term)}.${entity}`;

/* ── Known issues per source — the institutional memory that otherwise lives
 * only in markdown + the skill's watch-list. Every claim is established by this
 * onboarding pass (docs/data-analysis/onboarding.md). ────────────────────────*/
const SOURCE_DOCS: Record<string, { summary: string; knownIssues: string[]; provenance: string }> = {
  "psp-poslanci": {
    summary:
      "Poslanecká sněmovna person/organ/mandate/membership registries, downloaded directly from psp.cz poslanci.zip (UNL, windows-1250). The static side of the entity graph.",
    knownIssues: [
      "Birth date 1900-01-01 is the publisher's UNKNOWN sentinel, not a real birthday — decoded to null + birthDateUnknown; never surface a 1900 age.",
      "The person registry is HISTORICAL (7045 people back to 1992): ~419 have no mandate/membership in any loaded term — 'unlinked' is expected, not a defect.",
      "gender is 'M' or, for ANY other byte, female — a publisher convention, re-encoded to M/F with the raw byte kept in `raw`.",
      "Membership from/to dates carry FAR-FUTURE placeholders (e.g. a 'Předseda' row dated 2925-11-14, a 2025→2925 typo) — these inflate any 'newest row' freshness read; treat a year > 2100 as a placeholder.",
      "CURRENT-TERM (PSP10) mandate CONTACT fields are empty corpus-wide (email/web/facebook 0/207) though 203/207 have photos — the new chamber's contacts are not yet published, so 'backfill email' is not a scrape fix, it is upstream-absent.",
      "A club (poslanecký klub) is NOT the party an MP was elected for (party_list): an MP elected on one list can sit in another club. `categorization` scores club membership via the organ tree, never party_list — conflating them is the classic Czech-politics data error.",
    ],
    provenance: "docs/data-analysis/onboarding.md; lib/ingest/sources/psp.ts",
  },
  "psp-hlasovani": {
    summary:
      "Poslanecká sněmovna roll calls + per-MP ballots + excused absences for one electoral term, from psp.cz hl-<year>ps.zip (UNL, windows-1250). The temporal side of the graph.",
    knownIssues: [
      "vysledek 'K' MERGES abstained + didn't-press: since the 1995 rules amendment (90/1995 Sb.) the Chamber stops distinguishing them, so a modern term has K and never C/F. 44633 PSP10 ballots are this merged bucket — 'abstained' cannot be counted separately; do NOT split it.",
      "Manual votes (druh='R') have NO per-MP ballots by definition — a low per-MP coverage on those is the record type, not missing data. (PSP10 has 0 manual votes so far.)",
      "16 PSP10 roll calls are voided (zmatečné) — the result was disregarded; they must be excluded from any discipline/attendance metric.",
      "short titles (nazev_kratky) are empty for ~100% of PSP10 votes — richness is structurally capped on this slice; the long title carries the content.",
      "omluvy (excuses) in the bundle are NOT term-scoped and repeat whole rows (55 exact duplicate natural keys in PSP10) — the adapter de-dupes and scopes to the term; the duplicate count is reported, not hidden.",
      "Per-vote tallies reconcile: yes+no+abstain+notVoting == present is the validity check; a row that fails it is internally inconsistent regardless of completeness.",
      "Excuses can be filed AHEAD (newest PSP10 excuse dates into the future) — a future 'newest row' is real, not a clock bug.",
    ],
    provenance: "docs/data-analysis/onboarding.md; lib/ingest/sources/psp.ts; psp.cz schema k=1302",
  },
  "pumper-psp-opendata": {
    summary:
      "Release manifest + page fingerprint of the psp.cz open-data index, mirrored from the Pumper scraping backbone (extractor/extracted + watch/pages). This is what makes staleness of the direct psp.cz download DETECTABLE — the dumps carry no version or diff feed.",
    knownIssues: [
      "Pumper's HTML fetch does NOT honour psp.cz's declared charset=windows-1250: Czech letters (ě ř č š ž ů) arrive as U+FFFD. ALL 17 mirrored rows carry mangled text — flagged (`_mangled`), NEVER guess-repaired. validity is structurally 0 here BY DESIGN as the honest signal of that upstream defect. The authoritative Czech text comes from the direct UNL download, not this mirror. This is a SPEC item for Pumper, reported in the onboarding, not a politicas bug.",
      "This is metadata-only (file names, hrefs, sha256, char counts) — it never carries civic rows.",
      "Small (17 rows) → volume is structurally low; that is the size of the release table, not a coverage gap.",
    ],
    provenance: "docs/data-analysis/onboarding.md; lib/ingest/sources/pumper.ts",
  },
};

/* Cross-cutting rules every analyst of this corpus needs. Attached to every dataset's docs. */
const CORPUS_PRIMER = [
  "PRODUCT: politicas is a Czech public-accountability platform over ONE entity graph (person ↔ party ↔ mandate ↔ vote ↔ absence). Five modules (CivicScore, VoteTrack, FollowTheMoney, BudgetMirror, LawWatch) read it. Score quality bounds product quality: a dangling ballot can't feed discipline, a placeholder date can't feed a timeline.",
  "TRUST IS THE PRODUCT: never fabricate. Analysis writes DERIVED metadata only; source fields are never silently overwritten. A smaller real dataset beats a large invented one.",
  "COUNTS come from the deterministic scorer (lib/analysis/quality.ts), never from an LLM. But a count can be SEMANTICALLY HOLLOW — flagging a hollow stat (merged K bucket, empty current-term contacts, 2925 placeholder dates, U+FFFD mirror text) is the analyst's job.",
  "CZECH-FIRST: diacritics are folded to ASCII at ingest into *_norm columns (PGlite has no unaccent extension). A name_norm that is not pure ASCII is a folding defect.",
  "A parliamentary CLUB is not the elected party-list — never conflate them in a categorization or a discipline metric.",
];

/* Coverage ledger — updated by promote-verdicts / re-sync after an analysis pass. */
const LEDGER: Record<string, { status: string; note: string }> = {
  "psp-hlasovani×PSP10×vote_event": {
    status: "analyzed-onboarding-2026-07-23",
    note: "onboarding.md — empty short titles (richness cap), 16 voided votes, tallies reconcile 100%",
  },
  "psp-poslanci×PSP10×mandate": {
    status: "analyzed-onboarding-2026-07-23",
    note: "onboarding.md — current-term contacts empty corpus-wide; club≠party_list categorization verified",
  },
};

/* The 6 universal criteria — the shared rubric, published as documented fields on
 * slice_quality so a score always references one definition. Same six as every
 * other corpus onboarded onto the platform; the MEANING is politicas-specific. */
const RUBRIC: { field: string; doc: string }[] = [
  { field: "completeness", doc: "1–5. Share of rows carrying the identity fields the entity cannot function without (e.g. a person's names; a vote's timestamp + reconciling tally)." },
  { field: "freshness", doc: "1–5. Mean of sync-age (days since the snapshot was fetched) and row-lag (newest row vs snapshot). Beware future-dated placeholders and parliamentary recesses — both distort row-lag." },
  { field: "categorization", doc: "1–5. Share of rows placed in the graph's taxonomy: a person linked to a mandate/membership, a mandate resolved to a CLUB (not party_list), a ballot mapped to the documented choice vocabulary." },
  { field: "validity", doc: "1–5. Share of rows passing referential + arithmetic + encoding checks: edges resolve, vote tallies reconcile, name_norm is pure ASCII, no U+FFFD." },
  { field: "richness", doc: "1–5. Share of rows with the OPTIONAL depth the product needs (contactable MP, distinguishable vote position, timed excuse, bilingual organ label)." },
  { field: "volume", doc: "1–5 by row count (≥1000:5, ≥200:4, ≥50:3, ≥10:2, else 1) — rows vs expected-for-slice." },
];

type Entity = Record<string, unknown>;
const envelope = (urn: string, aspect: Record<string, unknown>): Entity => ({
  entityType: "dataset",
  entityUrn: urn,
  aspect,
});

const props = (name: string, description: string, custom: Record<string, string>): Record<string, unknown> => ({
  __type: "DatasetProperties",
  name,
  description,
  customProperties: custom,
});
const profile = (ms: number, rowCount: number) => ({ __type: "DatasetProfile", timestampMillis: ms, rowCount });
const operation = (ms: number) => ({
  __type: "Operation",
  timestampMillis: ms,
  lastUpdatedTimestamp: ms,
  operationType: "UPDATE",
});
const lineage = (upstreams: string[], ms: number) => ({
  __type: "UpstreamLineage",
  upstreams: upstreams.map((dataset) => ({ auditStamp: { time: ms, actor: ACTOR }, dataset, type: "TRANSFORMED" })),
});

function schemaOf(name: string, fields: { field: string; doc: string; type?: string }[]) {
  return {
    __type: "SchemaMetadata",
    schemaName: name,
    platform: PLATFORM,
    version: 0,
    hash: "",
    platformSchema: { __type: "OtherSchema", rawSchema: "" },
    fields: fields.map((f) => ({
      fieldPath: f.field,
      description: f.doc,
      nativeDataType: f.type ?? "string",
      type: { type: { __type: f.type === "number" ? "NumberType" : "StringType" } },
    })),
  };
}

/** The schema published per entity — the columns a subagent reasons about. */
const ENTITY_FIELDS: Record<string, { field: string; doc: string; type?: string }[]> = {
  person: [
    { field: "id", doc: "Natural key psp:osoba:<id>." },
    { field: "nameFull", doc: "Display name (first + last)." },
    { field: "nameNorm", doc: "ASCII-folded name for search/matching. Pure ASCII or it is a folding defect." },
    { field: "birthDate", doc: "ISO date, or null when the publisher's 1900-01-01 unknown sentinel was seen." },
    { field: "birthDateUnknown", doc: "True when the birth date was the unknown sentinel.", type: "number" },
    { field: "gender", doc: "M, or F for any other source byte (publisher convention)." },
  ],
  organ: [
    { field: "id", doc: "Natural key psp:organ:<id>." },
    { field: "abbrev", doc: "Organ abbreviation (PSP10 = the 10th-term chamber; ANO2011/ODS/… = clubs)." },
    { field: "organTypeCz", doc: "Taxonomy: Klub / Výbor / Komise / Delegace / Parlament / …." },
    { field: "parentPspId", doc: "Enclosing organ (a club's parent is its chamber).", type: "number" },
    { field: "validFrom", doc: "Establishment date (ISO)." },
    { field: "validTo", doc: "Dissolution date (ISO), null while active." },
  ],
  mandate: [
    { field: "id", doc: "Natural key psp:poslanec:<id> — one MP's seat in one term." },
    { field: "personPspId", doc: "→ person.pspId.", type: "number" },
    { field: "termCode", doc: "Electoral term (PSP10)." },
    { field: "partyListPspId", doc: "The list the MP was ELECTED on — NOT necessarily their club.", type: "number" },
    { field: "email", doc: "MP contact — EMPTY corpus-wide for the current term (upstream-absent)." },
    { field: "hasPhoto", doc: "Whether the publisher has a photo (203/207 in PSP10).", type: "number" },
  ],
  membership: [
    { field: "id", doc: "Natural key psp:zarazeni:<person>:<target>:<kind>:<from>." },
    { field: "kind", doc: "'member' (in an organ) or 'function' (holds an office in one)." },
    { field: "organPspId", doc: "The organ the membership resolves to (a function resolves via funkce→organ).", type: "number" },
    { field: "functionTypeCz", doc: "Office held (Předseda/Místopředseda/…) for function rows." },
    { field: "fromAt", doc: "Start (ISO). Far-future values (year>2100) are publisher placeholders." },
  ],
  vote_event: [
    { field: "id", doc: "Natural key psp:hlasovani:<id>." },
    { field: "votedAt", doc: "Roll-call timestamp (ISO)." },
    { field: "kind", doc: "normal / manual (no per-MP ballots) / technical_fault." },
    { field: "outcome", doc: "accepted / rejected / quorum_not_reached / unknown / void." },
    { field: "yes/no/abstain/notVoting/present", doc: "Tallies; yes+no+abstain+notVoting must equal present." },
    { field: "titleShort", doc: "Short label — EMPTY for ~all PSP10 votes (richness cap)." },
    { field: "voided", doc: "True for zmatečné (disregarded) votes — exclude from metrics.", type: "number" },
  ],
  vote_ballot: [
    { field: "id", doc: "Natural key psp:hlas:<vote>:<mandate>." },
    { field: "votePspId", doc: "→ vote_event.pspId.", type: "number" },
    { field: "mandatePspId", doc: "→ mandate.pspId.", type: "number" },
    { field: "choice", doc: "yes/no/abstain/not_voting/abstain_or_not_voting(K, merged since 1995)/not_logged_in/excused/pre_oath." },
  ],
  absence: [
    { field: "id", doc: "Natural key psp:omluva:<term>:<mandate>:<day>:<from>:<to>." },
    { field: "mandatePspId", doc: "→ mandate.pspId.", type: "number" },
    { field: "day", doc: "Excused day (ISO); may be in the future (filed ahead)." },
    { field: "fromTime/toTime", doc: "Timed window, or null for a whole-day excuse (untimed — can't match a roll-call clock)." },
  ],
  source_release: [
    { field: "id", doc: "Natural key pumper:<app>:<dataset>:<key>[:<file>]." },
    { field: "fileName", doc: "Dump file name (poslanci.zip, hl-2025ps.zip, …) for manifest rows." },
    { field: "contentSha256", doc: "Page fingerprint for watch rows — change detection over the release page." },
    { field: "description", doc: "Manifest description — carries U+FFFD from Pumper's charset defect." },
  ],
};

function documentation(source: string, term: string, entity: string, s: SliceStats | null): string {
  const doc = SOURCE_DOCS[source];
  const lines: string[] = [];
  if (s) {
    lines.push(`Analysis slice: ${source} × ${term} × ${entity} (${s.rows} rows). The unit the deterministic scorer persists to slice_quality.`);
  } else {
    lines.push(`Corpus entity: ${source} × ${entity}. The graph table; slices are lenses over it, scoped by term.`);
  }
  if (doc) {
    lines.push("", `SOURCE — ${doc.summary}`, "", "KNOWN ISSUES (established by prior analysis runs):");
    for (const issue of doc.knownIssues) lines.push(`  • ${issue}`);
    lines.push("", `Provenance: ${doc.provenance}`);
  }
  lines.push("", "CORPUS RULES:");
  for (const p of CORPUS_PRIMER) lines.push(`  • ${p}`);
  if (s) {
    const ledger = LEDGER[s.slice];
    lines.push("", `COVERAGE: ${ledger ? `${ledger.status} — ${ledger.note}` : "pending — never analyzed"}`);
    for (const n of s.notes) lines.push(`NOTE: ${n}`);
  }
  return lines.join("\n");
}

function customProps(s: SliceStats): Record<string, string> {
  const out: Record<string, string> = {
    rows: String(s.rows),
    source: s.source,
    term: s.term,
    entity: s.entity,
    quality_composite: String(s.composite),
    ...Object.fromEntries(Object.entries(s.pct).map(([k, v]) => [`pct_${k}`, String(v)])),
    ...Object.fromEntries(Object.entries(s.criteria).map(([k, v]) => [`quality_${k}`, String(v)])),
    fresh_sync_age_days: String(s.freshness.syncAgeDays ?? "null"),
    fresh_row_lag_days: String(s.freshness.rowLagDays ?? "null"),
    fresh_newest_row: s.freshness.newestRow ?? "null",
  };
  const ledger = LEDGER[s.slice];
  out.coverage_status = ledger?.status ?? "pending";
  if (ledger) out.coverage_note = ledger.note;
  return out;
}

async function post(entities: Entity[]): Promise<void> {
  const url = `${GMS}/openapi/entities/v1/`;
  const token = process.env.DATAHUB_TOKEN;
  for (let i = 0; i < entities.length; i += BATCH) {
    const chunk = entities.slice(i, i + BATCH);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} → ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`);
    }
    process.stdout.write(`  … ${Math.min(i + BATCH, entities.length)}/${entities.length}\r`);
  }
}

/** Which Pumper dataset each mirrored source draws from (for lineage). */
const PUMPER_UPSTREAMS: Record<string, string[]> = {
  "pumper-psp-opendata": [
    `urn:li:dataset:(${PUMPER_PLATFORM},extractor.extracted,${ENV})`,
    `urn:li:dataset:(${PUMPER_PLATFORM},watch.pages,${ENV})`,
  ],
};

async function main() {
  const statsPath = arg("stats", "./.data-analysis/stats.json");
  const { slices } = JSON.parse(readFileSync(statsPath, "utf8")) as { slices: SliceStats[] };
  const ms = Date.now();
  const entities: Entity[] = [];

  // The rubric dataset.
  const sqUrn = datasetUrn("store.slice_quality");
  entities.push(
    envelope(
      sqUrn,
      props(
        "store/slice_quality",
        [
          "Deterministic quality snapshot per slice, written by scoreSlice (lib/analysis/quality.ts) and promoted from validated verdicts.",
          "",
          "THE RUBRIC IS THE SCHEMA BELOW: each criterion field carries its definition, so a score always references one shared meaning.",
          "Scores are 1–5; composite is their mean. LLM analysis NEVER authors these numbers — it adds qualitative findings on top and may flag a number as semantically hollow.",
        ].join("\n"),
        { taxonomy_version: "det-cz-v1", written_by: "scoreSlice" },
      ),
    ),
    envelope(
      sqUrn,
      schemaOf("store.slice_quality", [
        { field: "slice", doc: "source×term×entity." },
        { field: "source", doc: "Ingest adapter key." },
        { field: "term", doc: "Electoral term or 'all' for registries." },
        { field: "entity", doc: "Graph entity." },
        ...RUBRIC,
        { field: "composite", doc: "1–5, the mean of the six criteria.", type: "number" },
        { field: "rowsTotal", doc: "Rows in the slice.", type: "number" },
        { field: "rowsValid", doc: "Rows passing the validity predicate.", type: "number" },
      ]),
    ),
    envelope(sqUrn, operation(ms)),
  );

  // Corpus entity datasets (one per source×entity present).
  const corpusUrns = new Set<string>();
  const seenCorpus = new Set<string>();
  for (const s of slices) {
    const cn = corpusName(s.source, s.entity);
    if (seenCorpus.has(cn)) continue;
    seenCorpus.add(cn);
    const urn = datasetUrn(cn);
    corpusUrns.add(urn);
    entities.push(
      envelope(urn, props(`corpus/${s.source}/${s.entity}`, documentation(s.source, "all", s.entity, null), {
        source: s.source,
        entity: s.entity,
      })),
      envelope(urn, schemaOf(cn, ENTITY_FIELDS[s.entity] ?? [{ field: "id", doc: "Natural key." }])),
      envelope(urn, operation(ms)),
    );
    const ups = PUMPER_UPSTREAMS[s.source];
    if (ups) entities.push(envelope(urn, lineage(ups, ms)));
  }

  // Slice datasets (stats + coverage + lineage back to the corpus entity).
  for (const s of slices) {
    const urn = datasetUrn(sliceName(s.source, s.term, s.entity));
    entities.push(
      envelope(urn, props(`slice/${s.source}/${s.term}/${s.entity}`, documentation(s.source, s.term, s.entity, s), customProps(s))),
      envelope(urn, profile(ms, s.rows)),
      envelope(urn, operation(ms)),
      envelope(urn, lineage([datasetUrn(corpusName(s.source, s.entity))], ms)),
    );
  }

  // slice_quality is derived FROM the corpus datasets.
  entities.push(envelope(sqUrn, lineage([...corpusUrns], ms)));

  console.log(`pushing ${entities.length} aspects for ${slices.length} slices → ${GMS}`);
  await post(entities);
  console.log(`\ndone: ${seenCorpus.size} corpus datasets, ${slices.length} slice datasets, 1 rubric dataset`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
