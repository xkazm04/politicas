// Server-only: the /dukazy loader — reads the human-gate record STRICTLY
// read-only (design doc batch-2 §2C) and hands it to the pure derivation in
// deriveFeed.ts. Three reads, all against the existing Store interface:
//
//   1. review_audit + endpoint labels via the SHARED reader
//      (./readReviewAudit.ts) — the append-only decision trail written by
//      ReviewRepository.setTieReviewState (the only write path), plus the
//      labels that let the feed name the MP and the company instead of
//      leaking node urns. /denik reads the same log; since 2026-08-12 both go
//      through that one reader, so a subscriber poll (which runs BOTH loaders
//      in one Promise.all) pays for the log once and neither surface can
//      forget the cap.
//   2. linked_to edges + bill nodes — the verbatim per-tie `props.source`
//      provenance string, and forensic verdicts a human signed off.
//
// Degrade contract mirrors getAdminData.ts: store unavailable → null (the page
// renders an honest "cannot read" state, DISTINCT from a genuinely empty
// journal, which is `{ entries: [] }`).

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import {
  deriveEvidenceFeed,
  type EvidenceEntry,
  type ForensicSignoffLike,
} from "./deriveFeed";
import { readReviewAudit } from "./readReviewAudit";

export interface DukazyData {
  entries: EvidenceEntry[];
  /** How many audit rows fed the feed — cited in the page header SourceNote. */
  auditRows: number;
  /** The audit read hit its cap, so `auditRows` is a FLOOR, not a count of the
   *  gate's decisions. The page says so beside the figure (the repository's own
   *  warning: a truncated read here "publishes a wrong number"). */
  auditTruncated: boolean;
  auditCap: number;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function getDukazyData(): Promise<DukazyData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    // The audit log + endpoint labels come from the ONE shared reader; a null
    // here means the record is unreadable, which is what this loader's own null
    // means too.
    const gate = await readReviewAudit();
    if (!gate) return null;
    const audit = gate.rows;
    const nodeLabels = gate.nodeLabels;

    // Verbatim provenance string per tie — only for ties the audit mentions.
    const tieSources = new Map<string, string>();
    if (audit.length > 0) {
      try {
        const wanted = new Set(audit.map((r) => `${r.src}→${r.dst}`));
        for (const e of await store.listKgEdges({ rel: "linked_to", limit: 100_000 })) {
          const key = `${e.src}→${e.dst}`;
          if (!wanted.has(key)) continue;
          const source = asStr(e.props?.source);
          if (source) tieSources.set(key, source);
        }
      } catch (err) {
        reportLoaderFailure("getDukazyData.listKgEdges", err);
      }
    }

    // Human-signed forensic verdicts (forensic_review_state === "verified").
    // Today every verdict on the store is still pending_review, so this slice
    // is honestly empty until the first sign-off lands — deriveFeed filters.
    let forensic: ForensicSignoffLike[] = [];
    try {
      const bills = await store.listKgNodes({ kind: "bill", limit: 100_000 });
      forensic = bills.flatMap((n) => {
        const p = (n.props ?? {}) as Record<string, unknown>;
        const state = asStr(p.forensic_review_state);
        if (!state) return [];
        const prov = (p.forensic_provenance ?? {}) as Record<string, unknown>;
        return [
          {
            tiskId: Number(n.id.replace(/^bill:tisk:/, "")) || 0,
            cislo: typeof p.cislo === "number" ? p.cislo : null,
            title: n.label,
            severity: asStr(p.forensic_severity) ?? "low",
            reviewState: state,
            signedAt: asStr(p.forensic_signed_at) ?? asStr(prov.computedAt),
          },
        ];
      });
    } catch (err) {
      reportLoaderFailure("getDukazyData.listKgNodes(bill)", err);
    }

    return {
      entries: deriveEvidenceFeed({ audit, nodeLabels, tieSources, forensic }),
      auditRows: audit.length,
      auditTruncated: gate.truncated,
      auditCap: gate.cap,
    };
  } catch (err) {
    reportLoaderFailure("getDukazyData", err);
    return null;
  }
}
