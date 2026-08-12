"use client";

/**
 * Graf entit — peněžní stopa osoba → firma → veřejné peníze. S reálnými daty
 * ze znalostního grafu vykreslí nejsilnější spis (poslanec, jeho firmy a
 * dosažitelné veřejné peníze); bez store se vykreslí původní označený mock
 * (graceful degradation). Řeč Konstrukt: papír, vlasová mřížka, uzly jako
 * ploché tvary (osoba kobalt, firma čerň, peníze signální kosočtverec). Každá
 * hrana osoba↔firma čeká na lidskou kontrolu — nikdy se nevydává za fakt.
 *
 * ── KLÁVESNICE A ODEČÍTAČKA (2026-08-12) ────────────────────────────────────
 * Obrázek byl do teď slepá ulice: `role="img"` (LISTOVÁ role) nad jedenácti
 * fokusovatelnými `<g tabIndex={0}>`, takže uzly pro asistivní technologie
 * fakticky neexistovaly — a přesto braly jedenáct tabstopů, každý s
 * `outline: none`, tedy bez jakéhokoli viditelného fokusu. Odkaz z obrázku
 * nevedl žádný, ačkoli spis poslance i spis firmy existují.
 *
 * Teď platí týž vzor jako na plátně velína (features/dashboard —
 * StateGraphCanvas + graphTraversal.ts, IMPORTOVANÉ, ne opsané):
 *   • `role="group"` s přístupným jménem, uvnitř JEDEN tabstop (roving tabindex),
 *   • šipky chodí PO HRANÁCH na souseda, kterým šipka ukazuje; směr bez souseda
 *     nedělá nic (zabalení na druhý konec je teleport, ne navigace),
 *   • Home/End skáčou na první a poslední uzel v pořadí kreslení,
 *   • Enter/mezerník OTEVŘE SPIS uzlu (uzel s adresou je `role="link"`; uzel bez
 *     adresy — peněžní kosočtverec — je `role="img"` a nic nepředstírá),
 *   • fokus má vlastní kobaltově čárkovaný kroužek (týž tvar jako GraphGlyph),
 *   • obsluha se VYPISUJE pod obrázkem: nástroj, o kterém se čtenář nedozví,
 *     neexistuje.
 * Vedle klávesové cesty stojí ve stavovém řádku SKUTEČNÝ `<Link>` na spis
 * uzlu, na kterém je fokus/myš — kvůli otevření v novém panelu a kopírování
 * adresy, což `router.push` neumí (precedens StateGraphCanvas).
 * Ohlašování je nativní: šipka posune SKUTEČNÝ fokus, takže odečítačka přečte
 * jméno nového uzlu sama; vlastní `aria-live` by četl všechno dvakrát.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Crosshair } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { compactCzk, type MoneyGraphData } from "./moneyTypes";
import type { ReviewSummary } from "./reviewSummary";
import {
  firstNodeId,
  isArrowKey,
  lastNodeId,
  neighbourStep,
  rovingNodeId,
} from "@/features/dashboard/graphTraversal";
import {
  degreeOf,
  moneyNodeHref,
  traversalEdges,
  traversalNodes,
  type MoneyNodeKind,
} from "./graphNav";

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
  kind: MoneyNodeKind;
  label: string;
  sub: string;
  x: number;
  y: number;
  /** Entita, za kterou uzel stojí, v id-gramatice grafu — z ní (a jen z ní) se
   *  odvozuje adresa spisu, viz graphNav.ts. Peněžní uzel ji nemá: „23,6 mld Kč"
   *  není entita, je to součet. */
  entityId?: string;
  /** money nodes only: false = a steward institution's own activity, drawn in steel.
   *  Drawing it in the signal colour is how a supervisory seat reads as graft. */
  attributable?: boolean;
  /** Vazba, kterou uzel firmy nese, ještě neprošla lidskou branou. Vypisuje se
   *  U UZLU — obrázek se sdílí jako obrázek a jeho popiska s ním necestuje. */
  pending?: boolean;
};
type GEdge = { from: string; to: string; label: string; trail?: boolean };

function RealGraph({ data, review }: { data: MoneyGraphData; review: ReviewSummary }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const f = useFormat();
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const ns: GNode[] = [];
    const es: GEdge[] = [];
    // ŘEZ DĚLÁ SERVER (getMoneyData, GRAPH_COMPANY_CAP) — tady stál bezejmenný
    // `slice(0, 5)`, tedy druhá definice téhož stropu. Renderer kreslí, co dostal;
    // že jde o výřez, přiznává popiska pod obrázkem (`money.real.graphCap`).
    const companies = data.companies;
    const n = companies.length;
    const yFor = (i: number) => (n === 1 ? 50 : 12 + (i * 76) / (n - 1));

    ns.push({
      id: "person",
      kind: "person",
      label: data.mp.name,
      sub: data.mp.club ?? "",
      x: 8,
      y: 50,
      entityId: `psp:person:${data.mp.pspId}`,
    });

    companies.forEach((c, i) => {
      const cy = yFor(i);
      const cid = `c${i}`;
      // `reachCzk` arrives PRECOMPUTED from the shared definition (`tieReach` in the
      // loader). The renderer used to add `contractCzk + subsidiesCzk` itself — a second
      // arithmetic on the same picture, and it painted every result signal-red.
      const reach = c.reachCzk;
      ns.push({
        id: cid,
        kind: "company",
        label: trunc(c.company, 20),
        sub: c.role || `IČO ${c.id.split(":").pop()}`,
        x: 44,
        y: cy,
        entityId: c.id,
        pending: c.reviewState === "pending_review",
      });
      es.push({ from: "person", to: cid, label: trunc(c.role || t("graph.tieFallback"), 16), trail: reach > 0 });
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
  // Kde stojí KLÁVESNICE (vizuální stav, padá s odchodem fokusu) a kam se má
  // tabulátor vrátit (paměť tabstopu) — dva různé údaje, stejně jako na velíně.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rovingMemo, setRovingMemo] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement | null>());

  // Obrázek nemá VÝBĚR (ten je stav plochy a tenhle graf žádný nedrží), takže
  // se do pravidla posílá `null` — tabstop drží paměť, jinak první uzel.
  const navNodes = useMemo(() => traversalNodes(nodes), [nodes]);
  const navEdges = useMemo(() => traversalEdges(edges), [edges]);
  const rovingId = rovingNodeId(rovingMemo, null, navNodes);

  const focusNode = useCallback((id: string | null) => {
    if (id === null) return;
    const el = nodeRefs.current.get(id);
    if (!el) return;
    setRovingMemo(id);
    el.focus();
  }, []);

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
  const nodeHref = moneyNodeHref(node?.entityId);

  const kindLabel = useCallback((kind: MoneyNodeKind) => t(`graph.kind.${kind}`), [t]);

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-steel">
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-signal" />
          {t("real.graph.badge")}
        </span>
        <span className="hidden sm:inline">{t("graph.joinCaption")}</span>
      </div>
      {/* role="group", ne role="img": `img` je LISTOVÁ role — prvky uvnitř ní
          asistivní technologie nezpřístupní, takže jedenáct fokusovatelných uzlů
          v ní fakticky neexistovalo (týž nález jako na plátně velína). */}
      <svg viewBox="0 0 640 400" className="w-full" role="group" aria-label={t("graph.ariaLabel")}>
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
        {nodes.map((n, i) => {
          const lit = connected.has(n.id);
          const href = moneyNodeHref(n.entityId);
          const degree = degreeOf(n.id, navEdges);
          // Popisek nese JMÉNO, DRUH, POZICI a počet vazeb — bez pozice je krok
          // šipkou pohyb naslepo, protože obrázek odečítačka nevidí. Stav brány
          // a existence spisu se přidávají jen tam, kde platí.
          const label = [
            `${kindLabel(n.kind)}: ${n.label}`,
            n.sub,
            t("graph.nodePosition", { index: f.int(i + 1), total: f.int(nodes.length) }),
            degree > 0 ? t("graph.edgesInRecord", { count: f.int(degree) }) : null,
            n.pending ? tcom("pendingReview") : null,
            href ? t("graph.nodeOpens") : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <g
              key={n.id}
              ref={(el) => {
                nodeRefs.current.set(n.id, el);
              }}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              // Uzel s adresou JE odkaz; uzel bez adresy (peněžní kosočtverec)
              // je popsaný obrázek a žádnou akci nepředstírá.
              role={href ? "link" : "img"}
              tabIndex={rovingId === n.id ? 0 : -1}
              aria-label={label}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => {
                setFocusedId(n.id);
                setRovingMemo(n.id);
                setHover(n.id);
              }}
              onBlur={() => setFocusedId(null)}
              onClick={href ? () => router.push(href) : undefined}
              onKeyDown={(ev) => {
                if (href && (ev.key === "Enter" || ev.key === " ")) {
                  ev.preventDefault();
                  router.push(href);
                  return;
                }
                // Šipka jde PO HRANĚ. Když tím směrem soused není, klávesa
                // nedělá nic — zabalení na druhý konec je teleport.
                if (isArrowKey(ev.key)) {
                  const next = neighbourStep(n.id, ev.key, navNodes, navEdges);
                  if (next !== null) {
                    ev.preventDefault();
                    focusNode(next);
                  }
                  return;
                }
                if (ev.key === "Home") {
                  ev.preventDefault();
                  focusNode(firstNodeId(navNodes));
                } else if (ev.key === "End") {
                  ev.preventDefault();
                  focusNode(lastNodeId(navNodes));
                }
              }}
              style={{ cursor: href ? "pointer" : "default" }}
            >
              {/* Fokus má vlastní, kobaltově čárkovaný kroužek — indikátor fokusu
                  musí ukazovat, kde je klávesnice. Dosud tu stálo `outline: none`,
                  tedy fokus neviditelný docela. */}
              {focusedId === n.id && (
                <circle r={20} className="fill-none stroke-cobalt" strokeWidth={2.5} strokeDasharray="4 3" />
              )}
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
              {/* Stav lidské brány U UZLU, ne jen v patičce: obrázek se sdílí
                  samostatně a neprověřená vazba nesmí na něm vypadat jako fakt.
                  Vlastní řádek, aby ho ořez podtitulu nemohl spolknout. */}
              {n.pending && (
                <text y={38} textAnchor="middle" fontSize={9.5} fontFamily="var(--font-plex)" fontWeight={700} className="fill-ochre uppercase">
                  {tcom("pendingReview")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Klávesová obsluha se VYPISUJE — jeden tabstop plus šipky po hranách
          není vzor, který by šel uhodnout. */}
      <p className="border-t border-hairline px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
        {t("graph.keyboardHint")}
      </p>
      <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {node ? (
          <span className="min-w-0">
            <span className="font-bold text-signal">▸ {node.label}</span>{" "}
            <span className="text-steel">
              — {node.sub || "—"} ·{" "}
              {t("graph.edgesInRecord", {
                // citation-ok: counts the edges THIS picture draws, not the graph; the frame's own source note (`money.real.graphSelection`, incl. the selection rule) is rendered by the parent, FollowTheMoneyPage, immediately below it.
                count: f.int(edges.filter((e) => e.from === node.id || e.to === node.id).length),
              })}
            </span>
          </span>
        ) : (
          <span className="text-steel">{t("real.graph.hoverHint")}</span>
        )}
        <span className="flex shrink-0 items-center gap-4">
          {/* SKUTEČNÝ odkaz vedle klávesové cesty: `router.push` neumí otevřít
              v novém panelu ani zkopírovat adresu (precedens StateGraphCanvas). */}
          {node && nodeHref && (
            <Link
              href={nodeHref}
              className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("graph.openCaseFile")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
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
        </span>
      </div>
    </div>
  );
}
