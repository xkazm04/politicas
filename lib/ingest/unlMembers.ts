// One UNL-member reader for every psp.cz adapter.
//
// `psp.ts`, `psp-activity.ts` and `psp-legislation.ts` each carried a byte-identical
// private `unlOf` until 2026-09-06 — three copies of „decode + parse one member of a
// dump; a missing member yields []". `readZipMap` lower-cases member names, so the
// lookup does too; a fourth adapter imports this instead of writing a fourth copy.
// It lives beside the unl/zip shims, NOT in lib/ingest/sources/: that directory is the
// atlas's ground truth for „which adapters exist" (lib/analysis/atlas.test.ts derives
// the source registry from it), and a helper there would have to fake a source row.

import { decodeUnl, parseUnl, type UnlRow } from "./unl";

/** Decode + parse one UNL member of a dump; a missing member yields []. */
export function unlOf(members: Map<string, Uint8Array>, name: string): UnlRow[] {
  const bytes = members.get(name.toLowerCase());
  return bytes ? parseUnl(decodeUnl(bytes)) : [];
}
