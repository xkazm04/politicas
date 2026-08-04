/**
 * Company identity in the knowledge graph — the ONE place a URL segment becomes a
 * `kg_node` id.
 *
 * A Czech IČO is always 8 digits and this graph keys a company as
 * `company:ico:<ico zero-padded to 8>`. The convention is enforced nowhere in the
 * schema, so an unpadded lookup returns a SILENT false negative rather than an error —
 * money batch 009 found 8 nodes written unpadded by an earlier ingest, one of which was
 * a duplicate that split a real ownership chain across two node identities
 * (see memory/ico-node-id-canonical-form.md).
 *
 * `/penize/firma/[ico]` therefore never touches the raw segment: it normalizes first,
 * and a segment that cannot be an IČO is rejected before any read.
 *
 * Plain module (no server imports) so the route, the loader and the colocated test share
 * one definition.
 */

/** The 8-digit canonical form, or `null` when the input cannot be an IČO at all.
 *  Never "repairs" a 9+ digit or non-numeric segment — that is a different company, or
 *  not a company, and guessing which is exactly the failure this module exists to stop. */
export function canonicalIco(raw: string): string | null {
  const digits = raw.trim();
  if (!/^\d{1,8}$/.test(digits)) return null;
  return digits.padStart(8, "0");
}

/** `company:ico:<8-digit>` — the kg_node id. Takes an ALREADY canonical IČO. */
export function companyNodeId(ico: string): string {
  return `company:ico:${ico}`;
}

/** The IČO carried by a company node id, or null for an id in any other shape. Checks the
 *  PREFIX, not just the tail: `psp:person:6751` also ends in digits, and reading it as an
 *  IČO is precisely the kind of silent mis-join this module exists to stop. */
export function icoFromCompanyNodeId(id: string): string | null {
  if (!id.startsWith("company:ico:")) return null;
  return canonicalIco(id.slice("company:ico:".length));
}
