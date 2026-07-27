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
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { LeadDossier } from "./moneyTypes";

const PAYLOAD_DIR = path.join(process.cwd(), "docs", "data-analysis", "case-money", "payloads");

function isDossier(v: unknown): v is LeadDossier {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.leadId === "string" &&
    typeof d.subject === "object" &&
    Array.isArray(d.claims) &&
    typeof d.whatSourcesSustain === "string" &&
    typeof d.whatSourcesDoNotSustain === "string"
  );
}

export async function getLeadDossiers(): Promise<LeadDossier[]> {
  const out: LeadDossier[] = [];
  let files: string[];
  try {
    files = (await readdir(PAYLOAD_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    // no store/deploy has the payload dir at all → empty list, page still renders.
    return out;
  }
  for (const file of files) {
    try {
      const raw = await readFile(path.join(PAYLOAD_DIR, file), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (isDossier(parsed)) out.push(parsed);
    } catch {
      // one missing/malformed payload must not take down the surface or the others.
      continue;
    }
  }
  // signal-descending — the more story-worthy lead first, same axis the dossier itself reports.
  return out.sort((a, b) => b.signalScore - a.signalScore);
}
