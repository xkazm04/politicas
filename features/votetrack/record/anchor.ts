// Per-vote permalink anchors: every real roll call rendered in the ledger gets a
// stable element id `h-<pspId>` (the vote's psp.cz numeric id), so
// /hlasovani#h-92793 is a permanent public address for one chamber vote.
// Pure + tested (anchor.test.ts); the scroll/highlight behaviour lives in
// components/useVoteAnchor.ts.

/** DOM id (and URL fragment) for one roll call. */
export const voteAnchorId = (votePspId: number): string => `h-${votePspId}`;

/** The vote's public address on psp.cz (the reader-facing roll-call page with
 * the full per-MP listing). Distinct from the row's provenance `sourceUrl`,
 * which points at the opendata archive the bytes were ingested from. */
export const votePspUrl = (votePspId: number): string => `https://www.psp.cz/sqw/hlasy.sqw?g=${votePspId}`;

/** `#h-92793` / `h-92793` → 92793; anything else (incl. section anchors like
 * `#denik`, negative or non-integer ids) → null. */
export function parseVoteAnchor(hash: string): number | null {
  const m = /^#?h-(\d+)$/.exec(hash.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
