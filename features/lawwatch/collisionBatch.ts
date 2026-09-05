// Which law-loop batch a collision close-read came from, and how that batch worked — read
// from the payload FILE the row was loaded from (scan-sweep 2026-09-07).
//
// Until now the loader resolved the batch by PAIR ID through a ladder of per-file id sets.
// Pair ids are not unique across payloads — the same two prints get close-read again on a
// later topology (4-121 in batch 004 on 586/1992 and in batch 005 on 117/1995; 102-111 and
// 7-221 in batches 008 and 009; 85-88 in 004 and 009) — so the ladder assigned BOTH rows the
// batch it checked first, and the badge plus the method sentence under four rendered pairs
// described a batch that did not produce them. The batch is a property of the row's file.
//
// Plain module (no server imports) so the rule is testable without a store.

/** The two batch-001/002 pairs narrated in batch-001.md / batch-002.md predate the dated
 *  payload files; they enter the loader as literals and are batch 2 by the loader's rule. */
export const PRIOR_PAIRS_BATCH = 2;

/**
 * `collision-close-reads.json` is batch 003's merged output; `collision-close-reads-batchNNN
 * (-gA|-gB).json` names its batch. Anything else (the per-army-group inputs
 * `collision-close-reads-groupN.json`, whose union IS the batch-003 file) is not a source the
 * loader dates — null, never a guess.
 */
export function batchFromSourceFile(file: string): number | null {
  if (file === "collision-close-reads.json") return 3;
  const m = /^collision-close-reads-batch0*(\d+)(?:-g[AB])?\.json$/.exec(file);
  return m ? Number(m[1]) : null;
}

/** One-line Czech method note per batch — the SourceNote under a pair card. */
export function sourceMethodCs(batch: number): string {
  if (batch <= PRIOR_PAIRS_BATCH) return "deterministický §-překryv + ruční porovnání textů (dávka 001/002)";
  if (batch === 5) return "deterministický dělený §-překryv nad přegenerovanou topologií amends (od té doby nasazenou), ruční porovnání textů";
  if (batch === 8) return "deterministický dělený §-překryv nad živou topologií 577 hran amends, ruční porovnání textů, ověřeno grepem";
  if (batch === 9)
    return "deterministický dělený §-překryv nad živou topologií, stratifikovaný vzorek testující signál „přepis proti dílčí náhradě“, ruční porovnání textů, každá citace ověřena vyhledáním v archivovaném textu";
  return "deterministický dělený §-překryv (--v2) + ruční porovnání textů, ověřeno grepem";
}
