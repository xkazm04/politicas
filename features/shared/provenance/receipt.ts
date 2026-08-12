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
 * (schema.org/ClaimReview) — orchestrátor obě definice sloučí později.
 * Od 2026-08-12 se ale obě emise řídí TÝMŽ pravidlem, které lib/claims/claim.ts
 * vyhlašuje ve svém §3: ClaimReview jde ven POUZE za tvrzení, které prošlo
 * lidskou branou. Do té doby /zdroj vydávalo fact-check značku i nad hranou
 * s `pending_review` a hodnocením „čeká na lidskou kontrolu" — crawler, který
 * ratingValue nečte jako větu, dostával naši nezkontrolovanou stopu jako
 * ověřený fakt. Viz `toClaimReviewJsonLd` dole.
 */

import type { KgEdgeRow, KgNodeRow, ReviewAuditRow } from "@/lib/db/types";
import { KG_NODE_KINDS, type KgNodeKind } from "@/lib/analysis/kg-verdict";
import { citableId, sourceLinksFor, type SourceLink } from "@/lib/kg/sourceLinks";
import { encodeClaimRef, type ClaimRef } from "./claimRef";

// ── Slovník relací ──────────────────────────────────────────────────────────
//
// DVOJJAZYČNOST (2026-08-05): kanonická cesta je katalogová — komponenty sázejí
// relaci přes `relLabelKey()` + next-intl (`shared.receipt.rel.*`). Česká mapa
// níže zůstává kvůli zpětné kompatibilitě: `relLabel` na účtence ji dál nese
// (konzumuje ho mj. features/overeni/OvereniPage.tsx) a JSON-LD je datový
// artefakt, ne UI sazba.

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

/** Klíč do katalogu `shared.receipt.rel.*` pro známou relaci; null = neznámá
 *  relace a sazba vypíše strojový token doslova (nikdy nevymýšlí větu). */
export const relLabelKey = (rel: string): string | null =>
  rel in REL_LABELS_CS ? `receipt.rel.${rel}` : null;

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

/** Locale-aware varianta téhož dokladového pravidla: přesná uložená hodnota,
 *  jen s desetinným oddělovačem aktivního jazyka (cs čárka, en tečka). */
export const formatWeight = (n: number, locale: string): string =>
  locale === "cs" ? formatWeightCs(n) : Number.isFinite(n) ? String(n) : "—";

// ── Odkud odešla adresa, kterou dnešní graf nenese ───────────────────────────
//
// Stav „gone" (rozluštitelná adresa bez záznamu) je pro čtenáře ta NEJHORŠÍ
// chvíle: přišel po citaci a nemá se čeho chytit. Adresa přitom celé tvrzení
// nese — dekodér z ní vytáhne src/rel/dst — a KONCOVÉ UZLY v grafu obvykle
// dál jsou (zmizela hrana, ne lidé a firmy). Tenhle tvar proto vyplní, co se
// dnes o citovaném tvrzení ještě VÍ, a mlčí o zbytku: chybějící uzel dostane
// doslovné id a `kind: null`, nikdy vymyšlené jméno ani odhadnutý druh.

export interface DecodedEndpoint {
  id: string;
  /** Druh uzlu, JEN pokud ho dnešní graf ještě nese; null = uzel v grafu není
   *  (a plocha pak nesmí nabídnout spis — vedl by do prázdna). */
  kind: string | null;
  /** Štítek uzlu, jinak doslovné id. */
  label: string;
}

export interface DecodedClaim {
  kind: "edge" | "node";
  subject: DecodedEndpoint;
  /** Strojový token relace; null u uzlové adresy. */
  rel: string | null;
  /** Česká čitelná podoba relace (katalogová cesta je `relLabelKey`). */
  relLabel: string | null;
  object: DecodedEndpoint | null;
}

const decodedEndpoint = (id: string, node: KgNodeRow | null | undefined): DecodedEndpoint => ({
  id,
  kind: node ? node.kind : null,
  label: node ? node.label : id,
});

/** Co adresa TVRDILA — čistě z rozluštěného refu plus uzlů, které dnešní graf
 *  ještě nese. `nodes` smí být prázdná mapa (uzel zmizel taky). */
export function toDecodedClaim(
  ref: ClaimRef,
  nodes: ReadonlyMap<string, KgNodeRow>,
): DecodedClaim {
  if (ref.kind === "node") {
    return {
      kind: "node",
      subject: decodedEndpoint(ref.id, nodes.get(ref.id)),
      rel: null,
      relLabel: null,
      object: null,
    };
  }
  return {
    kind: "edge",
    subject: decodedEndpoint(ref.src, nodes.get(ref.src)),
    rel: ref.rel,
    relLabel: relLabelCs(ref.rel),
    object: decodedEndpoint(ref.dst, nodes.get(ref.dst)),
  };
}

// ── Strojově čitelný tvar (schema.org/ClaimReview — viz koordinace s 2E) ────

/** Strukturální tvar emitovaného JSON-LD — minimální stabilní podmnožina
 *  schema.org/ClaimReview, tvarově shodná s `lib/claims/claim.ts`
 *  (`ClaimReviewJsonLd`): numerické `ratingValue` s bestRating/worstRating,
 *  `itemReviewed.name` = trvalá adresa tvrzení, `appearance` jako CreativeWork.
 *  Řetězcový ratingValue, který tu stál dřív, není platné hodnocení — je to
 *  věta v poli, kde spotřebitel čeká číslo. */
export interface ReceiptClaimReviewJsonLd {
  "@context": "https://schema.org";
  "@type": "ClaimReview";
  claimReviewed: string;
  itemReviewed: {
    "@type": "Claim";
    name: string;
    appearance?: Array<{ "@type": "CreativeWork"; url: string }>;
  };
  reviewRating: {
    "@type": "Rating";
    ratingValue: 5;
    bestRating: 5;
    worstRating: 1;
    alternateName: "ověřeno";
  };
  author: { "@type": "Organization"; name: "Politicas" };
  datePublished?: string;
  url?: string;
}

/**
 * ClaimReview POUZE za záznam, který prošel lidskou branou; jinak null.
 *
 * Brána je vynucená TADY, ne na volajícím — přesně jako v `lib/claims/claim.ts`
 * (`claimReviewJsonLd`), jehož §3 pravidlo tenhle modul do 2026-08-12 porušoval:
 * /zdroj sázelo fact-check značku na každou účtenku a stav brány schovávalo do
 * `ratingValue` jako českou větu. Nezkontrolovaná vazba, deterministické
 * odvození (`gate === null`) ani uzlová účtenka fact-check značku nedostanou —
 * mlčení je jediné poctivé strojové vyjádření „tohle nikdo neschválil".
 * Zeslabený náhradní typ se ZÁMĚRNĚ nevymýšlí.
 *
 * `permalink` musí být ABSOLUTNÍ adresa (relativní URL spotřebitelé odmítají);
 * null = základ adresy se nedal poctivě zjistit a pole `url` se vynechá —
 * vymyšlená doména by byla horší než chybějící pole (precedens app/sitemap.ts).
 */
export function toClaimReviewJsonLd(
  receipt: ProvenanceReceipt,
  permalink: string | null,
): ReceiptClaimReviewJsonLd | null {
  if (receipt.kind !== "edge") return null;
  if (receipt.gate?.status !== "verified") return null;

  // „Kde se tvrzení objevuje" = veřejné registry OBOU koncových bodů, doslova
  // z uložených identifikátorů (sourceLinksFor nikdy nehádá). Deduplikace drží
  // pořadí, ať je výstup bajtově stabilní.
  const appearance = [...new Set([...receipt.subject.links, ...receipt.object.links].map((l) => l.url))].map(
    (url) => ({ "@type": "CreativeWork" as const, url }),
  );
  // datePublished je datum RECENZE, ne odvození — u ověřené hrany tedy nejdřív
  // okamžik rozhodnutí brány, teprve pak výpočet, který hranu navrhl.
  const published = receipt.gate.reviewedAt ?? receipt.provenance.computedAt;

  const jsonLd: ReceiptClaimReviewJsonLd = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    claimReviewed: `${receipt.subject.label} ${receipt.relLabel} ${receipt.object.label}`,
    itemReviewed: {
      "@type": "Claim",
      name: receipt.ref,
      ...(appearance.length > 0 ? { appearance } : {}),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: 5,
      bestRating: 5,
      worstRating: 1,
      alternateName: "ověřeno",
    },
    author: { "@type": "Organization", name: "Politicas" },
  };
  if (published) jsonLd.datePublished = published;
  if (permalink) jsonLd.url = permalink;
  return jsonLd;
}
