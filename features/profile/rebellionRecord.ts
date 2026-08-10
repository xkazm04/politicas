/*
 * REBELIE PO JMÉNECH — čistá projekce kroniky /hlasovani na jednoho poslance.
 *
 * Pravidlo rebelie (poziční hlas proti striktní většině pozičních hlasů klubu;
 * sloučený koš K nikdy nepočítá ani pro, ani proti — 90/1995 Sb.) se tu
 * NEPOČÍTÁ. Řádky přicházejí z `deriveVoteRecord()`, téže derivace, ze které
 * žije deník hlasování; tenhle modul je jen index podle osoby a strop výpisu.
 * Druhá implementace téhož pravidla by byla druhá odpověď o pojmenovaném
 * člověku — přesně to, co si tahle platforma nesmí dovolit.
 *
 * Čistý modul (žádný server, žádný store), takže ho sdílí loader i test.
 */

import { voteAnchorId, votePspUrl } from "@/features/votetrack/record/anchor";
import type { ChronicleEntry, VoteRecordData } from "@/features/votetrack/record/types";

/** Rows the spis prints per MP. The rest is COUNTED and the section says so —
 *  the record runs to 89 instances for the chamber's most frequent rebel. */
export const PROFILE_REBELLION_ROWS = 12;

/** One rebellion the reader can open: which way the MP voted, which way the club
 *  stood, on what and when — with both addresses of the roll call. */
export interface RebellionInstance {
  votePspId: number;
  title: string;
  votedOn: string | null;
  /** how this MP voted (the minority side, by definition of a rebellion). */
  choice: "yes" | "no";
  /** the club's line on that vote. */
  line: "yes" | "no";
  club: string;
  /** `/hlasovani#h-<votePspId>` — only when the roll call is inside the ledger
   *  window that page actually renders; otherwise the anchor would be dead. */
  appHref: string | null;
  /** the roll call's public psp.cz page (hlasy.sqw). */
  pspUrl: string;
  /** the archive the bytes were ingested from — provenance, not a reading link. */
  sourceUrl: string;
}

export interface ProfileRebellionRecord {
  /** newest first, capped at PROFILE_REBELLION_ROWS. */
  instances: RebellionInstance[];
  /** every instance in the record, before the row cap. */
  total: number;
  /** valid roll calls the derivation covered, and the window it covered them in. */
  coverage: { votes: number; from: string | null; to: string | null };
}

export interface RebellionIndex {
  byMp: Map<number, RebellionInstance[]>;
  coverage: ProfileRebellionRecord["coverage"];
}

/** One chronicle row → one openable instance. */
export function toInstance(c: ChronicleEntry): RebellionInstance {
  return {
    votePspId: c.votePspId,
    title: c.title,
    votedOn: c.votedOn,
    choice: c.choice,
    line: c.line,
    club: c.club,
    appHref: c.inLedger ? `/hlasovani#${voteAnchorId(c.votePspId)}` : null,
    pspUrl: votePspUrl(c.votePspId),
    sourceUrl: c.sourceUrl,
  };
}

/**
 * The whole chronicle, indexed by person. Order inside a person is the
 * chronicle's own (newest first) — this function never re-sorts, because the
 * ordering is the derivation's statement, not the profile's.
 *
 * IMPORTANT: feed it a record derived with an UNCAPPED `chronicleCap`. The
 * chamber-wide default (24 rows) is a presentation bound for /hlasovani; index
 * that and nearly every MP answers „no rebellions" for the wrong reason.
 */
export function indexRebellions(record: VoteRecordData): RebellionIndex {
  const byMp = new Map<number, RebellionInstance[]>();
  for (const c of record.chronicle) {
    const list = byMp.get(c.personPspId) ?? [];
    list.push(toInstance(c));
    byMp.set(c.personPspId, list);
  }
  return {
    byMp,
    coverage: { votes: record.coverage.valid, from: record.coverage.from, to: record.coverage.to },
  };
}

/** One MP's record. An MP with no rebellion gets `total: 0`, which is an answer. */
export function rebellionRecordFor(
  index: RebellionIndex,
  pspId: number,
  rows: number = PROFILE_REBELLION_ROWS,
): ProfileRebellionRecord {
  const all = index.byMp.get(pspId) ?? [];
  return { instances: all.slice(0, rows), total: all.length, coverage: index.coverage };
}
