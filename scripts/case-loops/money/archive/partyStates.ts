/* Money loop — batch 014: reading a contract node's ingested party flags.
 *
 * ONE definition, imported by the census (`direction-refine-b14.ts`) and by the payload
 * builder (`build-nonrecipient-payload-b14.ts`). The lesson `triage.ts` paid for in
 * 2026-08-13 was that two copies of a classification rule drift, and they drift in favour
 * of whoever the drift happens to favour — so this is a module, not a copied block.
 *
 * The `non-recipient` decision itself is NOT re-implemented here: it is
 * `directionFromParties` in the ingest adapter, which is the same function the next
 * re-ingest will run. This module only adds the finer census states that the adapter has
 * no reason to distinguish (co-recipient, silent, sole-party).
 */
import { directionFromParties, type DumpParty } from "@/lib/ingest/sources/smlouvy-dump";

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/**
 * The contracting parties as the batch-012 re-ingest stored them on the contract node.
 *
 * NOTE — this is `smluvniStrany` only. The publisher's own `platce`/`prijemce` flags were
 * not retained at ingest, so every state below is decided from a party list that is one
 * side SHORT of what `directionFor` saw. That makes the two-party branch of
 * `directionFromParties` unreliable here (a stored pair may really be a triple), which is
 * exactly why the backfill accepts only `non-recipient` — a verdict that branch can never
 * produce, because it needs a third party to be reached at all.
 */
export function partiesOf(props: Record<string, unknown>): DumpParty[] {
  const raw = props.parties;
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      ico: str(o.ico),
      nazev: String(o.nazev ?? ""),
      platce: o.platce === true,
      prijemce: o.prijemce === true,
    };
  });
}

export type PartyState =
  /** ours is flagged `prijemce` and nobody else is. */
  | "flagged-recipient"
  /** ours is flagged `platce`. */
  | "flagged-payer"
  /** ours is flagged `prijemce` ALONGSIDE others — the full amount is attributed to each
   *  of them, and the register does not say how it splits. */
  | "co-recipient"
  /** the register named a recipient and it is someone else. */
  | "non-recipient"
  /** no party on the record carries any flag. Genuinely unknown. */
  | "silent"
  /** ours is the only stored contracting party; the counterpart is the publisher. */
  | "sole-party"
  /** nobody flagged US, but the record is genuinely two-sided and the OTHER side is the
   *  flagged recipient — so we are the payer. Money leaving the company, not reaching it.
   *  Only reachable when the stored list is complete (the company published the contract
   *  itself), which is why it is sound despite `partiesOf` being one side short. */
  | "inferred-payer";

/**
 * `publisherIco` is REQUIRED, and it is not decoration.
 *
 * `directionFromParties` has a shortcut for two-sided records — "only the other side is
 * flagged, so we are the mirror of it" — and that shortcut is sound only when the list it
 * sees is the WHOLE record. The stored `parties` is one side short (see `partiesOf`), so
 * feeding it in raw makes a genuine three-sided record look two-sided and the shortcut
 * answers `payer` where the truth is `non-recipient`. That is not hypothetical: delegating
 * without this argument moved 101 of 128 attributable co-signatory edges into `silent` on
 * the first run of this batch, quietly restoring 11 bn CZK of the very attribution the
 * batch exists to remove.
 *
 * So the publisher is re-attached as an UNFLAGGED party. Its own platce/prijemce flags
 * were not retained at ingest and are not invented here — an unflagged side can only ever
 * make the verdict weaker, never stronger, which is the direction an inference over
 * incomplete data is allowed to move.
 */
export function refineState(
  parties: readonly DumpParty[],
  ico: string,
  publisherIco: string | null,
): PartyState {
  const mine = parties.filter((p) => p.ico === ico);
  const others = parties.filter((p) => p.ico !== ico);
  if (mine.some((p) => p.prijemce)) {
    return others.some((p) => p.prijemce) ? "co-recipient" : "flagged-recipient";
  }
  if (mine.some((p) => p.platce)) return "flagged-payer";
  if (others.length === 0) return "sole-party";
  const sides =
    publisherIco && publisherIco !== ico && !parties.some((p) => p.ico === publisherIco)
      ? [...parties, { ico: publisherIco, nazev: "", platce: false, prijemce: false }]
      : parties;
  // Delegated, never re-derived: the adapter owns what the register's flags entail, and
  // the next re-ingest must reach the same verdict on the same record.
  const verdict = directionFromParties(ico, sides);
  if (verdict === "non-recipient") return "non-recipient";
  // `payer` here can only come from the two-sided shortcut, which is reachable only when
  // `sides` was NOT extended — i.e. the company published the contract itself, so the
  // stored list already holds every side. Mapping it to `silent` (as the first draft of
  // this module did) would have filed 85 attributable edges as "unknown" when the
  // register in fact says the money went the other way.
  if (verdict === "payer") return "inferred-payer";
  return "silent";
}

/** The publishing party's IČO as the re-ingest stored it (`props.publisher.ico`). */
export function publisherIcoOf(props: Record<string, unknown>): string | null {
  const p = props.publisher;
  if (!p || typeof p !== "object") return null;
  return str((p as Record<string, unknown>).ico);
}
