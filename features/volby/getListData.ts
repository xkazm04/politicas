// Server-only loader for `/volby/snemovna/[slug]` — one elected party list: its ledger
// rolled up over its CURRENT holders, every member's findings, and the RECORD of where
// the list stood on the chamber's 12 most contested roll calls (positions, never a
// finding — a vote's direction has no derivable valence).
//
// `?kraj=<slug>` pins that kraj's members first; an unknown kraj slug pins nothing
// (`pinnedKraj: null`) and is not a 404 — the list exists, the pin does not.
//
// Ballots are read through `listVoteBallots({ voteIds })` — the indexed read over the
// 12 roll calls (2 400 rows in 33 ms on the live store, 2026-08-27) — never the whole
// ~406 000-row table. `BallotListOptions` carries no per-person filter (ballots are keyed
// by MANDATE, not person), so the list's members are selected here by `mandatePspId`.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore, type Store } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { krajBySlug, regionLabelFromPspName } from "@/lib/analysis/volby/kraje";
import { listLine, topContested } from "@/lib/analysis/volby/contested";
import { dedupeByObject, rollupLedger, outcomeTimeline } from "@/lib/analysis/volby/rules";
import type { ListData, RecordRow } from "@/lib/analysis/volby/types";
import { NOT_FOUND, billsByMp, chamberForVolby, listRollups, ok, volbyProvenance, type ListRollup, type VolbyResult } from "./volbyLoader";

export const CONTESTED_LIMIT = 12;

async function contestedRecord(store: Store, rollup: ListRollup): Promise<RecordRow[]> {
  const events = await store.listVoteEvents({ termCode: "PSP10", limit: KG_READ_CAP });
  const top = topContested(
    events
      .filter((e) => e.yes !== null && e.no !== null)
      .map((e) => ({
        votePspId: e.pspId,
        title: (e.titleLong ?? e.titleShort ?? e.titleNorm ?? "").trim() || `#${e.pspId}`,
        votedOn: e.votedOn ?? "",
        yes: e.yes as number,
        no: e.no as number,
        voided: e.voided,
      })),
    CONTESTED_LIMIT,
  );
  if (top.length === 0) return [];
  const ballots = await store.listVoteBallots({ voteIds: top.map((t) => t.votePspId) });
  const mandates = new Set(rollup.members.map((m) => m.mandatePspId));
  const byVote = new Map<number, { choice: string }[]>();
  for (const b of ballots) {
    if (!mandates.has(b.mandatePspId)) continue;
    const arr = byVote.get(b.votePspId) ?? [];
    arr.push({ choice: b.choice });
    byVote.set(b.votePspId, arr);
  }
  return top.map((t) => ({ ...t, line: listLine(byVote.get(t.votePspId) ?? []) }));
}

export async function getListData(slug: string, kraj?: string): Promise<VolbyResult<ListData>> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person"]))) return null;

    const chamber = await chamberForVolby(store);
    if (!chamber) return null;
    const bills = await billsByMp(store);
    const rollups = listRollups(chamber, bills);
    const rollup = rollups.find((r) => r.key.slug === slug);
    if (!rollup) return NOT_FOUND;

    const pinned = kraj ? krajBySlug(kraj) : null;
    const pinnedRegion = pinned ? regionLabelFromPspName(pinned.pspLabel) : null;
    const members = [...rollup.members]
      .sort((a, b) => {
        const pa = pinnedRegion !== null && a.region === pinnedRegion ? 0 : 1;
        const pb = pinnedRegion !== null && b.region === pinnedRegion ? 0 : 1;
        return pa - pb || a.name.localeCompare(b.name, "cs");
      })
      .map((m) => ({
        pspId: m.pspId,
        name: m.name,
        region: m.region,
        club: m.clubAbbrev,
        findings: rollup.findingsByPspId.get(m.pspId) ?? [],
      }));
    const all = members.flatMap((m) => m.findings);
    const contested = await contestedRecord(store, rollup);

    return ok({
      list: rollup.summary,
      card: {
        subjectId: `list:${rollup.key.partyListPspId}`,
        ballot: "snemovni",
        label: rollup.key.label,
        href: `/volby/snemovna/${rollup.key.slug}`,
        ledger: rollupLedger(dedupeByObject(all), rollup.summary.ledger.baseline),
        findings: dedupeByObject(all),
        timeline: outcomeTimeline(dedupeByObject(all)),
      },
      members,
      contested,
      pinnedKraj: pinned?.slug ?? null,
      provenance: volbyProvenance({
        layer: null,
        chamber,
        bills,
        extraSources: ["vote_event (PSP10)", "vote_ballot (indexed by vote_psp_id, 12 roll calls)"],
        extraCounts: { members: members.length, findings: all.length, contested: contested.length, pinned: pinned ? 1 : 0 },
      }),
    });
  } catch (err) {
    reportLoaderFailure("getListData", err);
    return null;
  }
}
