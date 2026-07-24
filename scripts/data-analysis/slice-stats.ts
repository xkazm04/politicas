/* READ-ONLY slice statistics + row export — the DETERMINISTIC ground truth the
 * /data-analysis loop passes to subagents (and /datahub-sync pushes into the
 * catalog). ONE code path, so the vault arm and the DataHub arm quote IDENTICAL
 * numbers; any quality difference between them is about context, never arithmetic.
 *
 * A "slice" here is <source>×<term>×<entity> — e.g. psp-hlasovani×PSP10×vote_event.
 * Entity is the graph table; term scopes the temporal tables (PSP10 = the current
 * chamber). Registry tables (person/organ) are term-agnostic and filed under "all".
 *
 * Emits:
 *   <out>/stats.json                          — every slice's deterministic stats
 *   <out>/rows/<source>__<term>__<entity>.json — a bounded row projection per slice
 *
 * PGLITE IS SINGLE-CONNECTION. If a dev server holds ./.pglite, run against a copy:
 *   cp -r .pglite .pglite-copy
 *   PGLITE_PATH=./.pglite-copy npx tsx scripts/data-analysis/slice-stats.ts --out=<dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";
import {
  buildContext,
  daysBetween,
  latestRunBySource,
  scoreAbsence,
  scoreBallot,
  scoreMandate,
  scoreMembership,
  scoreOrgan,
  scorePerson,
  scoreRelease,
  scoreSlice,
  scoreVoteEvent,
  type RowFlags,
} from "@/lib/analysis/quality";
import { SOURCE_HLASOVANI, SOURCE_POSLANCI } from "@/lib/ingest/sources/psp";
import { SOURCE_PUMPER } from "@/lib/ingest/sources/pumper";
import type { SliceStats } from "@/lib/analysis/context-model";

// SliceStats now lives with the shared context model (lib/analysis/context-model.ts)
// so the DataHub-publish arm, the direct-read arm, and this producer all quote one
// type. Re-exported here for existing importers (e.g. datahub-sync.ts).
export type { SliceStats };

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const pctOf = (rows: RowFlags[], pick: (f: RowFlags) => boolean) =>
  rows.length ? Math.round((100 * rows.filter(pick).length) / rows.length) : 0;

async function main() {
  const out = arg("out", "./.data-analysis");
  const term = arg("term", "PSP10");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }
  mkdirSync(join(out, "rows"), { recursive: true });

  const now = new Date();
  const runs = await store.listIngestRuns(500);
  const latestRun = latestRunBySource(runs);

  // Full registries + the requested term's temporal tables.
  const persons = await store.listPersons();
  const organs = await store.listOrgans();
  const mandates = await store.listMandates();
  const memberships = await store.listMemberships();
  const voteEvents = await store.listVoteEvents({ termCode: term });
  const ballots = await store.listVoteBallots({ termCode: term });
  const absences = await store.listAbsences({ termCode: term });
  const releases = await store.listSourceReleases();
  const clubByMandate = await store.clubByMandate(term);

  const ctx = buildContext({ persons, organs, mandates, voteEvents, clubByMandate });

  // A person is "linked" (categorized) if they hold a mandate or any membership.
  const linked = new Set<number>();
  for (const m of mandates) linked.add(m.personPspId);
  for (const m of memberships) linked.add(m.personPspId);

  const slices: SliceStats[] = [];

  function emit(
    source: string,
    termCode: string,
    entity: string,
    flags: RowFlags[],
    newestRow: string | null,
    extraNotes: string[],
  ) {
    const run = latestRun.get(source);
    const syncAgeDays = daysBetween(now.toISOString(), run?.startedAt ?? null);
    const rowLagDays = daysBetween(run?.startedAt ?? null, newestRow);
    const scored = scoreSlice({
      slice: `${source}×${termCode}×${entity}`,
      source,
      term: termCode,
      entity,
      flags,
      syncAgeDays,
      rowLagDays,
    });
    const notes: string[] = [...extraNotes];
    const validPct = pctOf(flags, (f) => f.valid);
    if (validPct < 100) notes.push(`${100 - validPct}% of rows fail the validity predicate`);
    slices.push({
      slice: scored.slice,
      source,
      term: termCode,
      entity,
      rows: flags.length,
      pct: {
        complete: pctOf(flags, (f) => f.complete),
        categorized: pctOf(flags, (f) => f.categorized),
        valid: validPct,
        rich: pctOf(flags, (f) => f.rich),
      },
      composite: scored.composite,
      criteria: scored.scores as unknown as Record<string, number>,
      freshness: { syncAgeDays, rowLagDays, newestRow },
      notes,
    });
  }

  // ── registry entities (term = "all") ──────────────────────────────────────
  emit(SOURCE_POSLANCI, "all", "person",
    persons.map((p) => scorePerson(p, ctx, linked)),
    persons.map((p) => p.changedAt).filter((d): d is string => !!d).sort().pop() ?? null,
    [`${persons.length - linked.size} persons are unlinked (in registry, hold no mandate/membership) — expected for a historical registry`]);

  emit(SOURCE_POSLANCI, "all", "organ",
    organs.map((o) => scoreOrgan(o, ctx)),
    organs.map((o) => o.validFrom).filter((d): d is string => !!d).sort().pop() ?? null,
    []);

  // ── mandate/membership scoped to the term ─────────────────────────────────
  const termMandates = mandates.filter((m) => m.termCode === term);
  emit(SOURCE_POSLANCI, term, "mandate",
    termMandates.map((m) => scoreMandate(m, ctx)),
    null,
    [`${clubByMandate.size}/${termMandates.length} mandates resolved to a parliamentary club`]);

  const termMemberships = await store.listMemberships({ termCode: term });
  emit(SOURCE_POSLANCI, term, "membership",
    termMemberships.map((m) => scoreMembership(m, ctx)),
    termMemberships.map((m) => m.fromAt).filter((d): d is string => !!d).sort().pop() ?? null,
    []);

  // ── vote entities scoped to the term ──────────────────────────────────────
  emit(SOURCE_HLASOVANI, term, "vote_event",
    voteEvents.map((v) => scoreVoteEvent(v)),
    voteEvents.map((v) => v.votedAt).filter((d): d is string => !!d).sort().pop() ?? null,
    [
      `${voteEvents.filter((v) => v.kind === "manual").length} manual votes (no per-MP ballots)`,
      `${voteEvents.filter((v) => v.voided).length} voided (zmatečné) roll calls`,
    ]);

  emit(SOURCE_HLASOVANI, term, "vote_ballot",
    ballots.map((b) => scoreBallot(b, ctx)),
    null,
    (() => {
      const byChoice = new Map<string, number>();
      for (const b of ballots) byChoice.set(b.choice, (byChoice.get(b.choice) ?? 0) + 1);
      const merged = byChoice.get("abstain_or_not_voting") ?? 0;
      return [
        `choice distribution: ${[...byChoice.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}=${n}`).join(", ")}`,
        `${merged} ballots are the post-1995 merged abstain/not-voting bucket (code K) — cannot be split`,
      ];
    })());

  emit(SOURCE_HLASOVANI, term, "absence",
    absences.map((a) => scoreAbsence(a, ctx)),
    absences.map((a) => a.day).filter((d): d is string => !!d).sort().pop() ?? null,
    [`${absences.filter((a) => a.wholeDay).length} whole-day excuses (untimed — cannot be matched to a roll call clock)`]);

  // ── Pumper mirror ─────────────────────────────────────────────────────────
  emit(SOURCE_PUMPER, "all", "source_release",
    releases.map((r) => scoreRelease(r)),
    releases.map((r) => r.observedAt).filter((d): d is string => !!d).sort().pop() ?? null,
    [`${releases.filter((r) => r.raw._mangled === true).length}/${releases.length} rows carry U+FFFD (Pumper charset defect)`]);

  slices.sort((a, b) => a.slice.localeCompare(b.slice));

  // Row projections (bounded so a 406k-ballot slice does not write a 40 MB file;
  // the subagent reads the deterministic stats + a representative sample).
  const SAMPLE = 400;
  for (const s of slices) {
    const file = join(out, "rows", `${s.slice.replace(/×/g, "__").replace(/\//g, "-")}.json`);
    const sample = projectSample(s, {
      persons, organs, termMandates, termMemberships, voteEvents, ballots, absences, releases,
    }, SAMPLE);
    writeFileSync(file, JSON.stringify(sample, null, 1));
  }

  writeFileSync(
    join(out, "stats.json"),
    JSON.stringify({ generatedAt: now.toISOString(), term, slices }, null, 1),
  );
  console.log(`${slices.length} slices → ${out}/stats.json`);
  for (const s of slices) {
    console.log(`  ${s.slice.padEnd(38)} rows ${String(s.rows).padStart(7)}  composite ${s.composite}`);
  }
}

/** A bounded, analysis-relevant projection of a slice's rows (id + salient fields). */
function projectSample(
  s: SliceStats,
  data: {
    persons: import("@/lib/db/types").PersonRow[];
    organs: import("@/lib/db/types").OrganRow[];
    termMandates: import("@/lib/db/types").MandateRow[];
    termMemberships: import("@/lib/db/types").MembershipRow[];
    voteEvents: import("@/lib/db/types").VoteEventRow[];
    ballots: import("@/lib/db/types").VoteBallotRow[];
    absences: import("@/lib/db/types").AbsenceRow[];
    releases: import("@/lib/db/types").SourceReleaseRow[];
  },
  limit: number,
): unknown[] {
  switch (s.entity) {
    case "person":
      return data.persons.slice(0, limit).map((p) => ({
        id: p.id, name: p.nameFull, nameNorm: p.nameNorm, birthDate: p.birthDate,
        birthDateUnknown: p.birthDateUnknown, gender: p.gender, diedAt: p.diedAt,
      }));
    case "organ":
      return data.organs.slice(0, limit).map((o) => ({
        id: o.id, abbrev: o.abbrev, nameCz: o.nameCz, nameEn: o.nameEn,
        type: o.organTypeCz, parent: o.parentPspId, from: o.validFrom, to: o.validTo,
      }));
    case "mandate":
      return data.termMandates.slice(0, limit).map((m) => ({
        id: m.id, person: m.personPspId, term: m.termCode, region: m.regionPspId,
        partyList: m.partyListPspId, email: m.email, web: m.web, hasPhoto: m.hasPhoto,
      }));
    case "membership":
      return data.termMemberships.slice(0, limit).map((m) => ({
        id: m.id, person: m.personPspId, kind: m.kind, organ: m.organPspId,
        function: m.functionTypeCz, from: m.fromAt, to: m.toAt,
      }));
    case "vote_event":
      return data.voteEvents.slice(0, limit).map((v) => ({
        id: v.id, session: v.sessionNo, voteNo: v.voteNo, at: v.votedAt, title: v.titleLong,
        kind: v.kind, outcome: v.outcome, yes: v.yes, no: v.no, abstain: v.abstain,
        notVoting: v.notVoting, present: v.present, voided: v.voided,
      }));
    case "vote_ballot":
      return data.ballots.slice(0, limit).map((b) => ({
        id: b.id, vote: b.votePspId, mandate: b.mandatePspId, code: b.code, choice: b.choice,
      }));
    case "absence":
      return data.absences.slice(0, limit).map((a) => ({
        id: a.id, mandate: a.mandatePspId, day: a.day, from: a.fromTime, to: a.toTime, wholeDay: a.wholeDay,
      }));
    case "source_release":
      return data.releases.slice(0, limit).map((r) => ({
        id: r.id, app: r.pumperApp, file: r.fileName, url: r.fileUrl,
        description: r.description, sha: r.contentSha256, mangled: r.raw._mangled,
      }));
    default:
      return [];
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
