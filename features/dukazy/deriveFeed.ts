// Deník důkazů — PURE derivation of the public evidence feed (batch-2 item 2C).
//
// Every decision that passes the human gate becomes a public, citable,
// chronological entry: verified/rejected/needs-more tie decisions from
// `review_audit` (the ONLY write path — features/money/reviewActions.ts →
// ReviewRepository.setTieReviewState) and human-signed forensic verdicts on
// bill nodes (forensic_review_state flipped off "pending_review").
//
// Plain module, no server imports: the server loader (getDukazyData.ts), the
// feed route handlers AND the tests all run this same function over the same
// shapes. Two disciplines are enforced HERE, not at the call sites:
//
//   1. Accusatory-claim discipline: the public entry renders GATED copy only.
//      The reviewer's free-text `note` is accepted on the input (it is part of
//      ReviewAuditRow) and deliberately NEVER copied to the output — raw
//      reviewer notes are working material, not a publication.
//   2. Feed stability: entry ids are the audit-row uuid (append-only, never
//      renumbered) / the bill's tisk id; the page anchor is `z-<id>`; ordering
//      is decidedAt DESC with the id as a deterministic tiebreak. Permalinks
//      are a public API — nothing here may depend on array order of the input.

import { buildRegistryLinks } from "@/features/money/reviewTypes";

/** The slice of `ReviewAuditRow` (lib/db/types.ts) the feed needs. `note` is
 *  present so the loader can pass rows through unchanged — see discipline #1. */
export interface AuditRowLike {
  id: string;
  src: string;
  dst: string;
  decision: "confirm" | "reject" | "needs-more";
  reviewer: string;
  note: string | null;
  decidedAt: string;
  priorState: string | null;
}

/** A bill node whose forensic verdict a human signed off (state left
 *  "pending_review"). Today the store holds zero of these — every verdict is
 *  still pending — so this path is fixture-tested and renders honestly empty. */
export interface ForensicSignoffLike {
  tiskId: number;
  cislo: number | null;
  title: string;
  severity: string;
  /** kg_node bill props.forensic_review_state — only "verified" is published. */
  reviewState: string;
  /** Best available sign-off timestamp (props or provenance.computedAt). */
  signedAt: string | null;
}

export interface EvidenceLink {
  label: string;
  href: string;
}

export type EvidenceDecision = "confirm" | "reject" | "needs-more" | "forensic-verified";

/** In-page anchor of one evidence entry (`z-<id>`) and its permanent address.
 *  ONE owner of that shape: /denik links a gate decision back here by the SAME
 *  audit-row id, and a second `z-`/`/dukazy#` template on the other side would
 *  be a permalink that drifts silently (both look right until one changes). */
export const evidenceAnchor = (id: string): string => `z-${id}`;
export const evidenceHref = (id: string): string => `/dukazy#${evidenceAnchor(id)}`;

export interface EvidenceEntry {
  /** Stable public id: audit-row uuid, or `tisk-<tiskId>` for forensic. */
  id: string;
  /** In-page anchor (`#z-<id>` per the batch-1/2 anchor convention). */
  anchor: string;
  kind: "tie" | "forensic";
  decision: EvidenceDecision;
  /** Gated Czech decision copy — the only voice the public feed speaks in. */
  decisionCs: string;
  /** Same decision as a `dukazy.*` catalog key — the bilingual page's voice
   *  (2026-08-05). The FEEDS keep publishing `decisionCs` verbatim: they are a
   *  single-locale artifact, not a surface. Optional only for structural
   *  compatibility of foreign fixtures (schránka); this module always sets it
   *  and the page falls back to `decisionCs` without it. */
  decisionKey?: string;
  /** ISO timestamp of the human decision. */
  decidedAt: string;
  /** What was gated, in gated copy: "Jméno ↔ Firma" / bill title. */
  subjectCs: string;
  reviewer: string;
  /** review_state the edge carried before the decision (null = unset / n/a). */
  priorState: string | null;
  /** Primary-registry deep links a reader can verify against (ties only). */
  links: EvidenceLink[];
  /** Internal evidence route (/poslanec/<id>, /zakony/<cislo>), if resolvable. */
  internalHref: string | null;
  /** The MP this decision is about (`psp:person:<n>` on the audit row's src),
   *  when the id is readable. The page composes the deník address from it —
   *  the two journals key on the same public entity, and only the deník can be
   *  asked for „that day, that MP". Absent for forensic entries: a signed
   *  verdict is not a deník row, so no day of it exists to link to. */
  mpPspId?: number | null;
  /** Verbatim provenance line for the entry's SourceNote (feed content). */
  sourceCs: string;
  /** Provenance line as a `dukazy.*` catalog key + verbatim detail — the
   *  bilingual page resolves it; `sourceCs` stays for the feeds. `detail` is
   *  the verbatim edge source (ties) or the severity token (forensic).
   *  Optional for the same fixture-compatibility reason as `decisionKey`. */
  sourceKey?: string;
  sourceDetail?: string | null;
}

export const DECISION_CS: Record<EvidenceDecision, string> = {
  confirm: "vazba ověřena",
  reject: "vazba zamítnuta",
  "needs-more": "vyžádáno doplnění podkladů",
  "forensic-verified": "forenzní posudek potvrzen",
};

/** The same gated vocabulary as `DECISION_CS`, as catalog keys (namespace
 *  `dukazy`). Pure module returns KEYS, the page translates — the pattern of
 *  features/overeni/gateVocabulary.ts. */
export const DECISION_KEYS: Record<EvidenceDecision, string> = {
  confirm: "decision.confirm",
  reject: "decision.reject",
  "needs-more": "decision.needsMore",
  "forensic-verified": "decision.forensicVerified",
};

/** "psp:person:123" → 123; anything else → null. */
export function pspIdFromSrc(src: string): number | null {
  const m = src.match(/^psp:person:(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Company node id → IČO (the trailing segment): "kg:company:04544152" → "04544152". */
export function icoFromDst(dst: string): string | null {
  const seg = dst.split(":").pop() ?? "";
  return /^\d{6,8}$/.test(seg) ? seg : null;
}

export interface EvidenceFeedInput {
  audit: readonly AuditRowLike[];
  /** kg node id → label, for naming both tie endpoints in gated copy. */
  nodeLabels: ReadonlyMap<string, string>;
  /** `${src}→${dst}` → the linked_to edge's verbatim `props.source` string. */
  tieSources: ReadonlyMap<string, string>;
  forensic: readonly ForensicSignoffLike[];
}

function tieEntry(row: AuditRowLike, input: EvidenceFeedInput): EvidenceEntry {
  const mp = input.nodeLabels.get(row.src) ?? row.src;
  const company = input.nodeLabels.get(row.dst) ?? row.dst;
  const ico = icoFromDst(row.dst);
  const pspId = pspIdFromSrc(row.src);
  const source = input.tieSources.get(`${row.src}→${row.dst}`) ?? "";

  const links: EvidenceLink[] = [];
  if (ico) {
    const r = buildRegistryLinks(ico, source);
    links.push(
      { label: "ARES VR", href: r.aresVr },
      { label: "Hlídač státu", href: r.hlidacSubjekt },
      { label: "Registr smluv", href: r.registrSmluv },
    );
  }

  return {
    id: row.id,
    anchor: evidenceAnchor(row.id),
    kind: "tie",
    decision: row.decision,
    decisionCs: DECISION_CS[row.decision],
    decisionKey: DECISION_KEYS[row.decision],
    decidedAt: row.decidedAt,
    subjectCs: `${mp} ↔ ${company}`,
    reviewer: row.reviewer,
    priorState: row.priorState,
    links,
    internalHref: pspId != null ? `/poslanec/${pspId}` : null,
    mpPspId: pspId,
    // Verbatim edge provenance when the edge still exists; the audit table is
    // always cited — it IS the record being published.
    sourceCs: source ? `zdroj: review_audit · kg_edge linked_to · ${source}` : "zdroj: review_audit · kg_edge linked_to",
    sourceKey: source ? "entry.sourceTieDetail" : "entry.sourceTie",
    sourceDetail: source || null,
  };
}

function forensicEntry(f: ForensicSignoffLike): EvidenceEntry {
  const id = `tisk-${f.tiskId}`;
  return {
    id,
    anchor: evidenceAnchor(id),
    kind: "forensic",
    decision: "forensic-verified",
    decisionCs: DECISION_CS["forensic-verified"],
    decisionKey: DECISION_KEYS["forensic-verified"],
    decidedAt: f.signedAt ?? "",
    subjectCs: f.title,
    reviewer: "posudek podepsán",
    priorState: "pending_review",
    links: [],
    internalHref: f.cislo != null ? `/zakony/${f.cislo}` : null,
    // Podepsaný posudek NENÍ řádek deníku (ten nese smlouvy, role, kroky tisku,
    // bránu a change eventy) — nemá tedy den, na který by se dalo odkázat.
    mpPspId: null,
    sourceCs: `zdroj: kg_node bill.forensic_* · závažnost ${f.severity}`,
    sourceKey: "entry.sourceForensic",
    sourceDetail: f.severity,
  };
}

/**
 * The whole feed, newest first. Deterministic: same input rows in ANY order →
 * byte-identical output (decidedAt DESC, id ASC tiebreak). Forensic verdicts
 * are published only once a human flipped them to "verified" — a verdict that
 * is still pending_review is working material, not a decision.
 */
export function deriveEvidenceFeed(input: EvidenceFeedInput): EvidenceEntry[] {
  const entries: EvidenceEntry[] = [
    ...input.audit.map((r) => tieEntry(r, input)),
    ...input.forensic.filter((f) => f.reviewState === "verified").map(forensicEntry),
  ];
  entries.sort((a, b) => {
    if (a.decidedAt !== b.decidedAt) return a.decidedAt < b.decidedAt ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return entries;
}
