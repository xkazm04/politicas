// Server-only: reads the two hand-curated "kauzy" lead dossiers off disk — the
// platform's most sensitive content, so this loader does the LEAST possible
// transformation: parse the JSON, validate its shape loosely, hand it back
// verbatim. No summarizing, no re-deriving a verdict — the two-column
// sustained/not-sustained split IS the product and lives entirely in the payload's
// own `whatSourcesSustain` / `whatSourcesDoNotSustain` prose.
//
// Both dossiers are `pending_review` / `annotation_only_proposal` — see each
// payload's own `proposedAnnotation` — never presented as confirmed facts. Missing
// or unparsable files degrade to an empty list, never a thrown error into the page.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LeadDossier } from "./moneyTypes";

const PAYLOAD_DIR = path.join(process.cwd(), "docs", "data-analysis", "case-money", "payloads");
const DOSSIER_FILES = ["batch-005-lead-juchelka.json", "batch-005-lead-okamura.json"];

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
  for (const file of DOSSIER_FILES) {
    try {
      const raw = await readFile(path.join(PAYLOAD_DIR, file), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (isDossier(parsed)) out.push(parsed);
    } catch {
      // one missing/malformed dossier must not take down the surface or the others.
      continue;
    }
  }
  // signal-descending — the more story-worthy lead first, same axis the dossier itself reports.
  return out.sort((a, b) => b.signalScore - a.signalScore);
}
