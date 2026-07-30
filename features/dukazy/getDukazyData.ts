// Server-only: the /dukazy loader — reads the human-gate record STRICTLY
// read-only (design doc batch-2 §2C) and hands it to the pure derivation in
// deriveFeed.ts. Three reads, all against the existing Store interface:
//
//   1. review_audit via store.listReviewAudit — the append-only decision trail
//      written by ReviewRepository.setTieReviewState (the only write path).
//   2. kg nodes via store.getKgNodes — labels for both tie endpoints, so the
//      feed names the MP and the company instead of leaking node urns.
//   3. linked_to edges + bill nodes — the verbatim per-tie `props.source`
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

export interface DukazyData {
  entries: EvidenceEntry[];
  /** How many audit rows fed the feed — cited in the page header SourceNote. */
  auditRows: number;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function getDukazyData(): Promise<DukazyData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const audit = await store.listReviewAudit({ limit: 10_000 });

    // Labels for every node an audit row references (batch fetch, read-only).
    const ids = [...new Set(audit.flatMap((r) => [r.src, r.dst]))];
    const nodeLabels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        for (const n of await store.getKgNodes(ids)) nodeLabels.set(n.id, n.label);
      } catch (err) {
        // Labels are an enrichment; the feed degrades to node ids, never dies.
        reportLoaderFailure("getDukazyData.getKgNodes", err);
      }
    }

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
    };
  } catch (err) {
    reportLoaderFailure("getDukazyData", err);
    return null;
  }
}
