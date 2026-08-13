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
//      provenance string, and forensic verdicts a human signed off. Both read at
//      `KG_READ_CAP` since 2026-08-13: they used to carry ad-hoc `limit: 100_000`
//      literals, the exact anti-pattern `lib/db/readCap.ts` exists to abolish
//      (no loss on today's corpus — 211 linked_to, 141 bills — which is what a
//      silent cap always looks like right up until it is not).
//
// Degrade contract mirrors getAdminData.ts: store unavailable → null (the page
// renders an honest "cannot read" state, DISTINCT from a genuinely empty
// journal, which is `{ entries: [] }`).
//
// EVERY PARTIAL FAILURE TRAVELS TO THE READER (2026-08-13). Reads 2 fail
// independently and used to fail SILENTLY: the page kept citing a bill layer it
// never read, and thinned every citation from `sourceTieDetail` to `sourceTie`
// without a word. `DukazyLimits` carries what each read lost, so the surface can
// say it — including the largest omission of all, the forensic verdicts the gate
// has not signed.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import {
  deriveEvidenceFeed,
  withheldForensic,
  type EvidenceEntry,
  type ForensicSignoffLike,
  type WithheldForensic,
} from "./deriveFeed";
import { readReviewAudit } from "./readReviewAudit";

/**
 * WHAT THIS READING LOST, COUNTED (2026-08-13).
 *
 * The journal used to publish two absolutes over four silent losses: a capped
 * audit read, a `verified`-only forensic filter that discarded 141 verdicts
 * uncounted, and three `catch` blocks that thinned the page's own citations
 * without a word. Every field here exists so a sentence can be said instead.
 */
export interface DukazyLimits {
  /** The audit read hit its cap, so `auditRows` is a FLOOR, not a count of the
   *  gate's decisions (the repository's own warning: a truncated read here
   *  "publishes a wrong number"). */
  auditTruncated: boolean;
  auditCap: number;
  /** Forensic verdicts READ but not published — the gate has not signed them.
   *  The journal's largest omission by far and, until this pass, its quietest. */
  withheld: WithheldForensic;
  /** `kg_node` bill layer readable. `false` → the source line may NOT cite it,
   *  and a signed verdict could exist that this page does not carry. */
  forensicRead: boolean;
  /** `kg_edge linked_to` provenance strings readable. `false` → every citation
   *  silently degrades from `sourceTieDetail` to `sourceTie`. */
  tieSourcesRead: boolean;
  /** Endpoint labels readable. `false` → rows name graph urns, not people. */
  labelsRead: boolean;
}

export interface DukazyData {
  entries: EvidenceEntry[];
  /** How many audit rows fed the feed — cited in the page header SourceNote. */
  auditRows: number;
  limits: DukazyLimits;
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
    // A failure here does not empty the page, it THINS every citation on it
    // (sourceTieDetail → sourceTie), which is a claim about our sources; the
    // flag travels to the reader rather than dying in the console.
    const tieSources = new Map<string, string>();
    let tieSourcesRead = true;
    if (audit.length > 0) {
      try {
        const wanted = new Set(audit.map((r) => `${r.src}→${r.dst}`));
        for (const e of await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP })) {
          const key = `${e.src}→${e.dst}`;
          if (!wanted.has(key)) continue;
          const source = asStr(e.props?.source);
          if (source) tieSources.set(key, source);
        }
      } catch (err) {
        tieSourcesRead = false;
        reportLoaderFailure("getDukazyData.listKgEdges", err);
      }
    }

    // Human-signed forensic verdicts (forensic_review_state === "verified").
    // Today every verdict on the store is still pending_review, so this slice
    // is honestly empty until the first sign-off lands — deriveFeed filters,
    // and `withheldForensic` counts exactly what that filter kept out.
    let forensic: ForensicSignoffLike[] = [];
    let forensicRead = true;
    try {
      const bills = await store.listKgNodes({ kind: "bill", limit: KG_READ_CAP });
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
      forensicRead = false;
      reportLoaderFailure("getDukazyData.listKgNodes(bill)", err);
    }

    return {
      entries: deriveEvidenceFeed({ audit, nodeLabels, tieSources, forensic }),
      auditRows: audit.length,
      limits: {
        auditTruncated: gate.truncated,
        auditCap: gate.cap,
        // An UNREAD bill layer withholds nothing — it knows nothing. The zero
        // here is „no claim", and `forensicRead: false` is the sentence that
        // says so; a count would read as „nothing is being held back".
        withheld: withheldForensic(forensic),
        forensicRead,
        tieSourcesRead,
        labelsRead: gate.labelsRead,
      },
    };
  } catch (err) {
    reportLoaderFailure("getDukazyData", err);
    return null;
  }
}
