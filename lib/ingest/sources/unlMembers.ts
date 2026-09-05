// One UNL-member reader for every psp.cz adapter.
//
// `psp.ts`, `psp-activity.ts` and `psp-legislation.ts` each carried a byte-identical
// private `unlOf` until 2026-09-06 — three copies of „decode + parse one member of a
// dump; a missing member yields []". `readZipMap` lower-cases member names, so the
// lookup does too; a fourth adapter imports this instead of writing a fourth copy.

import { decodeUnl, parseUnl, type UnlRow } from "../unl";

/** Decode + parse one UNL member of a dump; a missing member yields []. */
export function unlOf(members: Map<string, Uint8Array>, name: string): UnlRow[] {
  const bytes = members.get(name.toLowerCase());
  return bytes ? parseUnl(decodeUnl(bytes)) : [];
}
