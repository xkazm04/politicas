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

import { canonicalIco } from "@/features/money/companyId";
import { buildRegistryLinks } from "@/features/money/reviewTypes";
import { claimRefPath, decodeClaimRef, edgeClaimRef } from "@/features/shared/provenance/claimRef";

/** The slice of `ReviewAuditRow` (lib/db/types.ts) the feed needs. `note` is
 *  present so the loader can pass rows through unchanged — see discipline #1. */
export interface AuditRowLike {
  id: string;
  src: string;
  /** The audited relation. Present on every `ReviewAuditRow` the writer emits
   *  (always `linked_to` today) and REQUIRED here rather than assumed, because
   *  the receipt address is composed from it — a hardcoded `"linked_to"` would
   *  mint a permanent address for a relation the row is not about. */
  rel: string;
  dst: string;
  decision: "confirm" | "reject" | "needs-more";
  reviewer: string;
  note: string | null;
  decidedAt: string;
  priorState: string | null;
  /**
   * Position in the tamper-evident append-only chain (`review_audit.chain_pos`)
   * and this row's own hash. Optional: rows written before the chain existed
   * carry neither, and a surface must render „this row predates the chain"
   * rather than a fabricated position. See `lib/db/pglite/ledger.ts`.
   */
  chainPos?: number | null;
  rowHash?: string | null;
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
  /**
   * The row's place in the tamper-evident chain and its own hash — the two
   * fields that make a published decision INDEPENDENTLY checkable (order +
   * non-tampering). `null` = this row is not chained (legacy) or the entry is
   * not an audit row at all; a surface then says so instead of printing a
   * position nobody assigned. Optional for the same structural-compatibility
   * reason as `decisionKey` (foreign fixtures, schránka): this module always
   * sets all four, and every consumer treats absent exactly as `null`.
   */
  chainPos?: number | null;
  rowHash?: string | null;
  /**
   * Permanent receipt address of the gated record (`/zdroj/<ref>`), composed
   * with the ONE ref grammar (`edgeClaimRef`) from the row's own endpoints and
   * VERIFIED by decoding it back. `null` when the endpoints cannot form a
   * canonical ref — the house shape-refusal rule: no link beats an address
   * into nothing.
   */
  receiptHref?: string | null;
  /** The tied company's own case file (`/penize/firma/<ičo>`), when the dst id
   *  yields a canonical IČO. Same refusal rule. */
  companyHref?: string | null;
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

/**
 * `/zdroj/<ref>` for one gated edge — the SAME grammar `/penize` mints its
 * receipts with (`edgeClaimRef`, imported, never a hand-built string).
 *
 * The ref is minted and then DECODED BACK: a segment the codec cannot carry
 * (empty endpoint, an address past `MAX_REF_LENGTH`) would encode into
 * something that looks like an address and resolves to nothing. A ref that does
 * not survive the round trip yields `null`, and the row renders without a
 * receipt link — the same shape-refusal `features/dashboard/entityLinks.ts` and
 * `canonicalIco` apply to their own ids.
 */
export function receiptHrefFor(src: string, rel: string, dst: string): string | null {
  if (!src || !rel || !dst) return null;
  const ref = edgeClaimRef(src, rel, dst);
  const back = decodeClaimRef(ref);
  if (back === null || back.kind !== "edge") return null;
  if (back.src !== src || back.rel !== rel || back.dst !== dst) return null;
  return claimRefPath(ref);
}

/** The ONE publication rule for a forensic verdict: only a verdict a human
 *  flipped to `verified` is a decision. Everything else is working material —
 *  used BOTH by the feed and by the counter below, so „published" and
 *  „withheld" can never drift apart into two different predicates. */
export const isPublishedForensic = (f: ForensicSignoffLike): boolean =>
  f.reviewState === "verified";

/** What the publication rule KEPT OUT, counted rather than dropped in silence. */
export interface WithheldForensic {
  total: number;
  /** Verbatim `forensic_review_state` tokens with their counts, state asc —
   *  deterministic, and never rewritten into a friendlier word. */
  byState: { state: string; count: number }[];
}

/**
 * The verdicts the gate has NOT signed. The journal reads every bill node and
 * publishes only the signed ones; on today's corpus that is 141 verdicts held
 * back, and until 2026-08-13 the page answered „0 řádků; žádný záznam není
 * zamlčen" over exactly them. A queue at capacity is not an empty feature.
 */
export function withheldForensic(forensic: readonly ForensicSignoffLike[]): WithheldForensic {
  const counts = new Map<string, number>();
  let total = 0;
  for (const f of forensic) {
    if (isPublishedForensic(f)) continue;
    total += 1;
    counts.set(f.reviewState, (counts.get(f.reviewState) ?? 0) + 1);
  }
  const byState = [...counts]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => (a.state < b.state ? -1 : a.state > b.state ? 1 : 0));
  return { total, byState };
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

  const canonical = ico ? canonicalIco(ico) : null;

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
    chainPos: row.chainPos ?? null,
    rowHash: row.rowHash ?? null,
    receiptHref: receiptHrefFor(row.src, row.rel, row.dst),
    companyHref: canonical ? `/penize/firma/${canonical}` : null,
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
    // Posudek se nezapisuje do review_audit — nemá v řetězu místo ani hash a
    // netvrdí se, že má. Účtenka /zdroj cituje HRANU; verdikt je vlastnost uzlu
    // tisku, takže adresa tohohle tvaru pro něj neexistuje.
    chainPos: null,
    rowHash: null,
    receiptHref: null,
    companyHref: null,
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
    ...input.forensic.filter(isPublishedForensic).map(forensicEntry),
  ];
  entries.sort((a, b) => {
    if (a.decidedAt !== b.decidedAt) return a.decidedAt < b.decidedAt ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return entries;
}
