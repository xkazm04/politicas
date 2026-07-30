/*
 * POHLEDOVÝ MODEL ÚČTENKY — čisté odvození z řádků znalostního grafu.
 *
 * Server (getReceiptData.ts) načte hranu/uzel + auditní stopu a TADY se z nich
 * stane serializovatelná účtenka: co se tvrdí, jak to vzniklo (provenience),
 * v jakém stavu lidské kontroly to je a kde si to čtenář ověří sám
 * (lib/kg/sourceLinks). Kapsle i stránka /zdroj pak jen sázejí — žádná logika
 * v komponentách, celé odvození je testovatelné nad fixture řádky.
 *
 * LIDSKÁ BRÁNA: `linked_to` je human-gated relace (jediný zapisovatel stavu je
 * ReviewRepository). Účtenka hrany bez `review_state` na gated relaci říká
 * „čeká na kontrolu" — přesně jako moneyLoader.ts, nikdy „ověřeno". Negated
 * relace (deterministické odvození) žádný stav kontroly NEMAJÍ a účtenka to
 * říká výslovně, místo aby předstírala prázdnou frontu.
 *
 * KOORDINACE S 2E (lib/claims): slovník tvrzení pro strojové čtení má vlastnit
 * lib/claims/** (Batch 2, položka 2E). V době stavby této plochy modul
 * neexistoval, proto je ClaimReview tvar definovaný lokálně ve STEJNÉM tvaru
 * (schema.org/ClaimReview) — orchestrátor obě definice sladí při review.
 */

import type { KgEdgeRow, KgNodeRow, ReviewAuditRow } from "@/lib/db/types";
import { KG_NODE_KINDS, type KgNodeKind } from "@/lib/analysis/kg-verdict";
import { citableId, sourceLinksFor, type SourceLink } from "@/lib/kg/sourceLinks";
import { encodeClaimRef, type ClaimRef } from "./claimRef";

// ── Slovník relací (kolokovaná česká copy — messages/*.json je mimo hřiště) ──

/** Česká čitelná podoba relace hrany; neznámá relace se vypíše doslova. */
export const REL_LABELS_CS: Record<string, string> = {
  co_votes_with: "hlasuje shodně s",
  rebels_against: "rebeluje proti",
  belongs_to: "náleží k",
  about: "týká se",
  influential_in: "má vliv v",
  linked_to: "má vazbu na",
  supplies: "dodává pro",
};

export const relLabelCs = (rel: string): string => REL_LABELS_CS[rel] ?? rel;

/** Relace procházející lidskou bránou (ReviewRepository je jediný zapisovatel
 *  jejich `review_state`). Drží se v syncu s lib/db/pglite/repositories/review.ts. */
export const GATED_RELS = new Set(["linked_to"]);

// ── Tvar účtenky ────────────────────────────────────────────────────────────

export type ReviewStatus = "verified" | "pending_review" | "rejected";

export interface ReceiptEndpoint {
  id: string;
  kind: string;
  label: string;
  /** Identifikátor, kterým se entita cituje (IČO, psp id…); null = není co uvést. */
  citable: string | null;
  /** Odkazy do veřejných registrů — jen ze ULOŽENÝCH identifikátorů, nikdy hádané. */
  links: SourceLink[];
}

export interface ReceiptProvenance {
  /** Průchod grafu, který záznam odvodil; null = záznam ho nenese. */
  pass: number | null;
  /** "deterministic" | "verdict" | doslovný záznam; null = nezaznamenáno. */
  method: string | null;
  /** Odkaz na vstupní data / pravidlo odvození (doslovný záznam). */
  ref: string | null;
  /** ISO čas odvození; null = nezaznamenáno. */
  computedAt: string | null;
}

export interface ReceiptAuditEntry {
  decision: ReviewAuditRow["decision"];
  reviewer: string;
  decidedAt: string;
  note: string | null;
  priorState: string | null;
}

export interface ReceiptGate {
  status: ReviewStatus;
  /** Kdo bránou naposledy prošel — z hrany (last_reviewer), ne odhad. */
  reviewer: string | null;
  reviewedAt: string | null;
  note: string | null;
  /** Auditní stopa rozhodnutí (nejnovější první), je-li k dispozici. */
  audit: ReceiptAuditEntry[];
}

export type ProvenanceReceipt =
  | {
      kind: "edge";
      /** Stabilní adresa tvrzení — segment do /zdroj/<ref>. */
      ref: string;
      subject: ReceiptEndpoint;
      rel: string;
      relLabel: string;
      object: ReceiptEndpoint;
      /** Váha hrany (míra shody, částka…); null = čistá vazba bez míry. */
      weight: number | null;
      provenance: ReceiptProvenance;
      /** null = relace lidskou branou neprochází (deterministické odvození). */
      gate: ReceiptGate | null;
    }
  | {
      kind: "node";
      ref: string;
      subject: ReceiptEndpoint;
      provenance: ReceiptProvenance;
    };

// ── Odvození ────────────────────────────────────────────────────────────────

const KNOWN_KINDS = new Set<string>(KG_NODE_KINDS);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const finite = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Koncový bod účtenky z uzlu grafu. Uzel, který v grafu (už) není, dostane
 *  poctivý zástupný štítek — id se vypíše, nic se nedomýšlí. */
export function toEndpoint(id: string, node: KgNodeRow | null | undefined): ReceiptEndpoint {
  if (!node) {
    return { id, kind: "unknown", label: id, citable: null, links: [] };
  }
  // sourceLinksFor přijímá jen známé druhy uzlů — neznámý druh nedostane
  // vymyšlený odkaz, jen doslovný štítek (pravidlo sourceLinks č. 1).
  const known = KNOWN_KINDS.has(node.kind);
  const subject = known
    ? { kind: node.kind as KgNodeKind, id: node.id, label: node.label, props: node.props }
    : null;
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    citable: subject ? citableId(subject) : null,
    links: subject ? sourceLinksFor(subject) : [],
  };
}

/** Provenience záznamu — doslovný přepis uložených polí, žádné dosazování. */
export function toProvenance(prov: Record<string, unknown> | null | undefined): ReceiptProvenance {
  return {
    pass: finite(prov?.pass),
    method: str(prov?.method),
    ref: str(prov?.ref),
    computedAt: str(prov?.computedAt) ?? str(prov?.computed_at),
  };
}

/** Stav lidské brány hrany — TÁŽ interpretace jako moneyLoader.mapLinkedToTie:
 *  `verified`/`rejected` doslova, cokoli jiného (včetně chybějícího stavu) je
 *  „čeká na kontrolu". Gated hrana nikdy nezíská „ověřeno" mlčky. */
export function gateFromEdge(edge: KgEdgeRow, audit: ReviewAuditRow[]): ReceiptGate | null {
  const props = edge.props ?? {};
  const rawState = str(props.review_state) ?? str(props.state);
  if (!GATED_RELS.has(edge.rel) && rawState === null) return null;
  const status: ReviewStatus =
    rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";
  return {
    status,
    reviewer: str(props.last_reviewer),
    reviewedAt: str(props.last_reviewed_at),
    note: str(props.review_note),
    audit: audit.map((a) => ({
      decision: a.decision,
      reviewer: a.reviewer,
      decidedAt: a.decidedAt,
      note: a.note,
      priorState: a.priorState,
    })),
  };
}

/** Účtenka hrany. `srcNode`/`dstNode` smějí chybět (torzo grafu) — koncové
 *  body pak nesou doslovná id; hrana sama chybět nesmí, bez ní není tvrzení. */
export function deriveEdgeReceipt(args: {
  edge: KgEdgeRow;
  srcNode: KgNodeRow | null | undefined;
  dstNode: KgNodeRow | null | undefined;
  audit?: ReviewAuditRow[];
}): ProvenanceReceipt {
  const { edge, srcNode, dstNode } = args;
  const ref: ClaimRef = { kind: "edge", src: edge.src, rel: edge.rel, dst: edge.dst };
  return {
    kind: "edge",
    ref: encodeClaimRef(ref),
    subject: toEndpoint(edge.src, srcNode),
    rel: edge.rel,
    relLabel: relLabelCs(edge.rel),
    object: toEndpoint(edge.dst, dstNode),
    weight: finite(edge.weight),
    provenance: toProvenance(edge.provenance),
    gate: gateFromEdge(edge, args.audit ?? []),
  };
}

/** Účtenka uzlu. */
export function deriveNodeReceipt(node: KgNodeRow): ProvenanceReceipt {
  return {
    kind: "node",
    ref: encodeClaimRef({ kind: "node", id: node.id }),
    subject: toEndpoint(node.id, node),
    provenance: toProvenance(node.provenance),
  };
}

/**
 * Váha záznamu PŘESNĚ tak, jak je uložená — jen s českou desetinnou čárkou.
 * Účtenka je doklad: zaokrouhlit 0,87 na „0,9" (czech() z lib/format.ts sází
 * 1 desetinné místo) by měnilo doložený údaj. Deterministický String(n) bez
 * Intl/toFixed, takže SSR i klient sází tentýž bajt — týž důvod, proč
 * lib/format.ts nepoužívá toLocaleString.
 */
export const formatWeightCs = (n: number): string =>
  Number.isFinite(n) ? String(n).replace(".", ",") : "—";

// ── Strojově čitelný tvar (schema.org/ClaimReview — viz koordinace s 2E) ────

/** Strukturální ClaimReview objekt pro <script type="application/ld+json"> na
 *  stránce účtenky. Bez sítě, bez validátoru — jen stabilní tvar, který
 *  fact-check crawler přečte. Hodnocení nevymýšlíme: ratingValue nese stav
 *  lidské brány (ověřeno/čeká/zamítnuto), u negated tvrzení metodu odvození. */
export function toClaimReviewJsonLd(receipt: ProvenanceReceipt, permalink: string): Record<string, unknown> {
  const claim =
    receipt.kind === "edge"
      ? `${receipt.subject.label} ${receipt.relLabel} ${receipt.object.label}`
      : receipt.subject.label;
  const rating =
    receipt.kind === "edge" && receipt.gate
      ? receipt.gate.status === "verified"
        ? "ověřeno člověkem"
        : receipt.gate.status === "rejected"
          ? "zamítnuto při kontrole"
          : "čeká na lidskou kontrolu"
      : `deterministické odvození${receipt.provenance.method ? ` (${receipt.provenance.method})` : ""}`;
  return {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    url: permalink,
    claimReviewed: claim,
    reviewRating: { "@type": "Rating", ratingValue: rating },
    author: { "@type": "Organization", name: "politicas" },
    ...(receipt.provenance.computedAt ? { datePublished: receipt.provenance.computedAt } : {}),
    itemReviewed: {
      "@type": "Claim",
      appearance: receipt.subject.links.map((l) => l.url),
    },
  };
}
