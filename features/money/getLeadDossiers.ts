// Server-only: reads the hand-curated "kauzy" lead dossiers off disk — the
// platform's most sensitive content, so this loader does the LEAST possible
// transformation: parse the JSON, validate its shape loosely, hand it back
// verbatim. No summarizing, no re-deriving a verdict — the two-column
// sustained/not-sustained split IS the product and lives entirely in the payload's
// own `whatSourcesSustain` / `whatSourcesDoNotSustain` prose.
//
// Both dossiers are `pending_review` / `annotation_only_proposal` — see each
// payload's own `proposedAnnotation` — never presented as confirmed facts. Missing
// or unparsable files degrade to an empty list, never a thrown error into the page.
//
// The population is DISCOVERED, not hardcoded (UX audit 2026-07-27, #5): the
// directory holds many batch payloads that are NOT dossiers (review-rank
// tables, corroboration dumps, …), so every *.json is parsed and only the
// ones matching the LeadDossier shape survive `isDossier`. A former version
// listed the two known filenames verbatim, meaning a third dossier required a
// code change and a deploy — `/penize/kauzy` broke at n=3 by construction.

import "server-only";
import { cache } from "react";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
// JEDNA politika memoizace nad dávkovými artefakty téhle aplikace — okno je
// MONEY_MEMO_TTL_MS, importované, nikdy nepředeklarované (dvě mema nad jednou
// vrstvou na dvou hodinách jsou přesně to, jak dvě plochy začnou tisknout dvě
// různá vydání jednoho čísla).
import { createLedgerMemo } from "@/features/votetrack/ledgerMemo";
import type { LeadDossier } from "./moneyTypes";

const PAYLOAD_DIR = path.join(process.cwd(), "docs", "data-analysis", "case-money", "payloads");

/** Kachní typ spisu — schválně VOLNÝ, ale ne děravý.
 *
 *  Adresář drží 18 payloadů a jen 2 z nich jsou spisy; zbytek jsou tabulky
 *  review-ranku, korroborační dumpy a migrační zápisy. Sada podmínek je proto
 *  minimální množina polí, kterou plocha SKUTEČNĚ vykresluje jako spis: bez
 *  `signalWhy` by se vysázel prázdný odstavec pod signálem, bez `confidence`
 *  by slovník dostal `undefined` místo tokenu a bez `mediaContext` /
 *  `registryFindings` by `.map` / `Object.entries` spadly na tvaru, který
 *  loader prohlásil za spis. Kontrola je pin, ne kosmetika — má ji
 *  getLeadDossiers.test.ts. */
export function isDossier(v: unknown): v is LeadDossier {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.leadId === "string" &&
    typeof d.subject === "object" &&
    d.subject !== null &&
    Array.isArray(d.claims) &&
    Array.isArray(d.mediaContext) &&
    typeof d.registryFindings === "object" &&
    d.registryFindings !== null &&
    typeof d.proposedAnnotation === "object" &&
    d.proposedAnnotation !== null &&
    typeof d.signalScore === "number" &&
    typeof d.signalWhy === "string" &&
    typeof d.confidence === "string" &&
    typeof d.whatSourcesSustain === "string" &&
    typeof d.whatSourcesDoNotSustain === "string"
  );
}

/** What the surface needs to tell an empty corpus apart from a broken one. */
export interface LeadDossiers {
  dossiers: LeadDossier[];
  /** The payload directory could not be listed at all — the surface is BLIND here, which
   *  is not the same statement as "there are no kauzy". */
  directoryUnreadable: boolean;
  /** Files that exist but could not be read or parsed. A dossier lost to a stray comma
   *  used to vanish with no log line and no visible difference from never existing. */
  unreadableFiles: string[];
}

/** Memo napříč požadavky. Payloady jsou DÁVKOVÝ artefakt na disku — mění se
 *  commitem, ne za běhu požadavku — a čtou se celé: 18 souborů, ~490 kB
 *  rozparsovaného JSONu, z nichž 2 projdou kachním typem. `react.cache()` má
 *  rozsah jednoho požadavku, takže tuhle práci platila každá návštěva /penize
 *  i /penize/kauzy.
 *
 *  ZAPAMATUJE SE JEN ÚPLNÉ ČTENÍ (`usable`): nedostupný adresář ani jediný
 *  nečitelný soubor se nememoizují — jinak by přechodná chyba na den zmrazila
 *  větu „spisy se nepodařilo přečíst" na nejcitlivější ploše platformy.
 *  Prázdný seznam nad ČITELNÝM adresářem memoizovaný je: to je výsledek
 *  (adresář existuje a spis v něm není), ne výpadek. */
const dossierMemo = createLedgerMemo<LeadDossiers>({
  usable: (v) => !v.directoryUnreadable && v.unreadableFiles.length === 0,
});

/** Testovací šev (vzor `resetSuppliesMemo`) — aplikace ho nikdy nevolá. */
export function resetLeadDossierMemo(): void {
  dossierMemo.reset();
}

export const getLeadDossiers = cache(async function getLeadDossiers(): Promise<LeadDossiers> {
  const memoized = dossierMemo.read();
  if (memoized) return memoized;
  const fresh = await readLeadDossiers();
  dossierMemo.write(fresh);
  return fresh;
});

async function readLeadDossiers(): Promise<LeadDossiers> {
  const dossiers: LeadDossier[] = [];
  const unreadableFiles: string[] = [];
  let files: string[];
  try {
    files = (await readdir(PAYLOAD_DIR)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    // No deploy has the payload dir at all → the page still renders, but it says it is
    // blind rather than claiming the corpus is empty.
    reportLoaderFailure("getLeadDossiers.readdir", err);
    return { dossiers, directoryUnreadable: true, unreadableFiles };
  }
  for (const file of files) {
    try {
      const raw = await readFile(path.join(PAYLOAD_DIR, file), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      // A file that parses but is not a dossier is EXPECTED here: the directory holds
      // review-rank tables and corroboration dumps too. Only a read/parse failure is a
      // loss, and only that is reported.
      if (isDossier(parsed)) dossiers.push(parsed);
    } catch (err) {
      // one malformed payload must not take down the surface or the others — but it
      // must not disappear either.
      reportLoaderFailure(`getLeadDossiers.parse:${file}`, err);
      unreadableFiles.push(file);
    }
  }
  // signal-descending — the more story-worthy lead first, same axis the dossier itself reports.
  dossiers.sort((a, b) => b.signalScore - a.signalScore);
  return { dossiers, directoryUnreadable: false, unreadableFiles };
}
