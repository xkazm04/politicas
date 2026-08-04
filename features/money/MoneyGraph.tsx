"use client";

/**
 * Graf entit — peněžní stopa osoba → firma → veřejné peníze. S reálnými daty
 * ze znalostního grafu vykreslí nejsilnější spis (poslanec, jeho firmy a
 * dosažitelné veřejné peníze); bez store se vykreslí původní označený mock
 * (graceful degradation). Řeč Konstrukt: papír, vlasová mřížka, uzly jako
 * ploché tvary (osoba kobalt, firma čerň, peníze signální kosočtverec). Každá
 * hrana osoba↔firma čeká na lidskou kontrolu — nikdy se nevydává za fakt.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { compactCzk, type MoneyGraphData } from "./moneyTypes";
import type { ReviewSummary } from "./reviewSummary";

/* The sample picture is a FALLBACK. Loading it (and the 27 KB `lib/civic/data.ts` it
   draws) at module scope shipped it to every reader who will only ever see the real
   graph. `next/dynamic` without `ssr: false` keeps the fallback server-rendered. */
const MockGraph = dynamic(() => import("./components/MockMoneyGraph"));

const px = (x: number) => x * 6.4;
const py = (y: number) => y * 4;

const NODE_FILL: Record<string, string> = {
  person: "fill-cobalt",
  company: "fill-ink",
  party: "fill-steel",
  money: "fill-signal",
};

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function MoneyGraph({
  data,
  review,
}: {
  data: MoneyGraphData | null;
  review: ReviewSummary;
}) {
  if (data && data.companies.length > 0) return <RealGraph data={data} review={review} />;
  return <MockGraph />;
}

// ── Real: strongest case file from the knowledge graph ───────────────────────

type GNode = {
  id: string;
  kind: "person" | "company" | "money";
  label: string;
  sub: string;
  x: number;
  y: number;
  /** money nodes only: false = a steward institution's own activity, drawn in steel.
   *  Drawing it in the signal colour is how a supervisory seat reads as graft. */
  attributable?: boolean;
};
type GEdge = { from: string; to: string; label: string; trail?: boolean };

function RealGraph({ data, review }: { data: MoneyGraphData; review: ReviewSummary }) {
  const t = useTranslations("money");
  const locale = useLocale();
  const f = useFormat();

  const { nodes, edges } = useMemo(() => {
    const ns: GNode[] = [];
    const es: GEdge[] = [];
    const companies = data.companies.slice(0, 5);
    const n = companies.length;
    const yFor = (i: number) => (n === 1 ? 50 : 12 + (i * 76) / (n - 1));

    ns.push({ id: "person", kind: "person", label: data.mp.name, sub: data.mp.club ?? "", x: 8, y: 50 });

    companies.forEach((c, i) => {
      const cy = yFor(i);
      const cid = `c${i}`;
      // `reachCzk` arrives PRECOMPUTED from the shared definition (`tieReach` in the
      // loader). The renderer used to add `contractCzk + subsidiesCzk` itself — a second
      // arithmetic on the same picture, and it painted every result signal-red.
      const reach = c.reachCzk;
      ns.push({ id: cid, kind: "company", label: trunc(c.company, 20), sub: c.role || `IČO ${c.id.split(":").pop()}`, x: 44, y: cy });
      es.push({ from: "person", to: cid, label: trunc(c.role || "vazba", 16), trail: reach > 0 });
      if (reach > 0) {
        const mid = `m${i}`;
        ns.push({
          id: mid,
          kind: "money",
          label: compactCzk(reach, locale),
          sub: c.donationRecipientParty
            ? `→ ${c.donationRecipientParty}`
            : c.attributable
              ? t("real.ledger.reachAttributable")
              : t("real.ledger.reachSteward"),
          x: 82,
          y: cy,
          attributable: c.attributable,
        });
        es.push({ from: cid, to: mid, label: compactCzk(reach, locale), trail: true });
      }
    });
    return { nodes: ns, edges: es };
  }, [data, locale, t]);

  // citation-ok: the review counts and their source note (`money.real.review.source` —
  // kg_edge.props.review_state ⋈ review_audit) are rendered by the parent,
  // FollowTheMoneyPage, immediately above this frame; the footer badge restates the same
  // `ReviewSummary` object rather than introducing a second figure.
  const reviewCounts = { verified: f.int(review.verified), decided: f.int(review.decided), total: f.int(review.total) };

  const nodeById = useMemo(() => new Map(nodes.map((nd) => [nd.id, nd])), [nodes]);
  const [hover, setHover] = useState<string | null>("person");
  const connected = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    edges.forEach((e) => {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    });
    return s;
  }, [hover, edges]);
  const node = nodeById.get(hover ?? "");

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-steel">
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-signal" />
          {t("real.graph.badge")}
        </span>
        <span className="hidden sm:inline">{t("graph.joinCaption")}</span>
      </div>
      <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label={t("graph.ariaLabel")}>
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={i * 46} y1={0} x2={i * 46} y2={400} className="stroke-hairline" strokeWidth={0.5} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={640} y2={i * 50} className="stroke-hairline" strokeWidth={0.5} />
        ))}
        {edges.map((e) => {
          const a = nodeById.get(e.from)!;
          const b = nodeById.get(e.to)!;
          const lit = hover !== null && connected.has(e.from) && connected.has(e.to) && (e.from === hover || e.to === hover);
          const mx = (px(a.x) + px(b.x)) / 2;
          const my = (py(a.y) + py(b.y)) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(b.x)}
                y2={py(b.y)}
                className={lit ? "stroke-signal" : "stroke-steel"}
                strokeOpacity={lit ? 1 : 0.45}
                strokeWidth={lit ? 2.5 : 1.25}
                strokeDasharray={e.trail ? undefined : "4 4"}
              />
              {lit && (
                <text x={mx} y={my - 8} textAnchor="middle" fontSize={11} fontFamily="var(--font-plex)" fontWeight={700} className="fill-signal uppercase">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const lit = connected.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {n.kind === "money" ? (
                <rect
                  x={-7.5}
                  y={-7.5}
                  width={15}
                  height={15}
                  className={lit ? (n.attributable === false ? "fill-steel" : NODE_FILL[n.kind]) : "fill-hairline"}
                  transform="rotate(45)"
                />
              ) : (
                <circle r={n.id === hover ? 10 : 7.5} className={lit ? NODE_FILL[n.kind] : "fill-hairline"} />
              )}
              <text y={-15} textAnchor="middle" fontSize={13.5} fontFamily="var(--font-plex)" fontWeight={700} className={lit ? "fill-ink" : "fill-steel"}>
                {n.label}
              </text>
              <text y={27} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-plex)" className="fill-steel uppercase">
                {trunc(n.sub, 22)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex min-h-[3.25rem] items-center justify-between gap-4 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {node ? (
          <span>
            <span className="font-bold text-signal">▸ {node.label}</span>{" "}
            <span className="text-steel">
              — {node.sub || "—"} ·{" "}
              {t("graph.edgesInRecord", {
                count: f.int(edges.filter((e) => e.from === node.id || e.to === node.id).length),
              })}
            </span>
          </span>
        ) : (
          <span className="text-steel">{t("real.graph.hoverHint")}</span>
        )}
        {/* Derived from the same counts as the lede banner — the badge used to assert
            „všechny hrany … čekají na kontrolu" as a constant.
            citation-ok: the counts and their source note (`money.real.review.source` —
            kg_edge.props.review_state ⋈ review_audit) are rendered by the parent,
            FollowTheMoneyPage, immediately above this frame; the badge is the same
            `ReviewSummary` object restated, not a second figure. */}
        {review.phase !== "empty" && (
          <span
            className={`hidden shrink-0 font-bold uppercase tracking-wider sm:inline ${review.pending > 0 ? "text-ochre" : "text-cobalt"}`}
          >
            {review.phase === "all-pending"
              ? t("real.graph.allPending")
              : review.phase === "all-decided"
                ? t("real.graph.allDecided", { verified: reviewCounts.verified })
                : t("real.graph.mixed", { decided: reviewCounts.decided, total: reviewCounts.total })}
          </span>
        )}
      </div>
    </div>
  );
}
