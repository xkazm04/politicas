"use client";

/*
 * Jeviště grafu — plátno přes celou plochu + REŽIE POPISKŮ.
 *
 * Nahrazuje GraphCanvas z kol 1–2. Dvě poučení, kvůli kterým vzniklo:
 *
 * 1. PLÁTNO JE STRÁNKA. Graf žil v okně 60vh uvnitř dokumentu a data neměla
 *    kam růst. Jeviště vyplní všechno, co dostane (rodič mu dává výšku),
 *    ovládání pluje NAD plátnem a je tu přepnutí na celou obrazovku.
 *
 * 2. VEŠKERÝ TEXT PROCHÁZÍ JEDNOU REŽIÍ. V kole 2 si popisky uzlů, počty
 *    superuzlů a štítky hran kreslil každý sám — a přes sebe. Tady existuje
 *    jediná fronta kandidátů (titulky > vybraný/hover > sousedé ohniska >
 *    štítky hran > ostatní podle stupně), jediný kolizní prostor pro všechny
 *    a rozpočet rostoucí s přiblížením. Co se nevejde, se NEKRESLÍ — uzel
 *    zůstává v seznamech, pod myší a ve vyhledávání.
 *
 * Výkonová pravidla z kola 1 platí dál: dávkované cesty (jeden stroke na
 * všechny hrany, jeden fill na kbelík tvar×barva), pan/zoom/hover v ref
 * (pohyb myši nerenderuje React), rAF s NULOVÁNÍM handle v cleanupu
 * (StrictMode past — memory/raf-guard-strictmode-trap.md).
 *
 * PŘÍSTUPNOST: canvas je obrázek; rovnocennou cestou k uzlům je vyhledávání
 * a seznamy vedle plátna. Proto tu není tabIndex, který by lhal.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Expand, Scan, Shrink, ZoomIn, ZoomOut } from "lucide-react";
import { HAIRLINE, INK, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import type { Point } from "@/lib/kg/layout";
import { KIND_STYLE, traceGlyph, type GlyphShape } from "../kindStyle";
import type { GraphEdge, GraphNode } from "../graphTypes";

export interface StageCaption {
  x: number;
  y: number;
  text: string;
}

/**
 * Čočka — trvalé zvýraznění výřezu (trasa na mapě): uzly a hrany čočky drží
 * plnou barvu a popisky, zbytek ustoupí do pozadí, ale NEZMIZÍ — kontext
 * celku je celý smysl fúze mapy s trasami. Klíč hrany = `src|rel|dst`.
 */
export interface StageLens {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export const edgeKey = (e: { src: string; rel: string; dst: string }) => `${e.src}|${e.rel}|${e.dst}`;

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.1;
const MAX_K = 9;

/** Kolizní box popisku: [x0, y0, x1, y1] v obrazových souřadnicích. */
type Box = [number, number, number, number];
const collides = (a: Box, boxes: Box[]) =>
  boxes.some((b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]);

export default function GraphStage({
  nodes,
  edges,
  positions,
  world,
  selectedId,
  onSelect,
  fitKey,
  focusId,
  fitBounds,
  lens,
  captions,
  relLabel,
  ariaLabel,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  positions: Map<string, Point>;
  world: { width: number; height: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Změna hodnoty = srovnat pohled na obsah. */
  fitKey: string;
  /** Změna hodnoty = najet na tenhle uzel beze změny přiblížení. */
  focusId?: string | null;
  /** Najet pohledem na obdélník světa (výřez trasy). Null = nic. */
  fitBounds?: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Trvalé zvýraznění výřezu — viz StageLens. */
  lens?: StageLens | null;
  /** Titulky ve světových souřadnicích (sloupce tras) — nejvyšší priorita. */
  captions?: StageCaption[];
  /** Překlad relace pro štítek hran vybraného uzlu; null = bez štítku. */
  relLabel?: (rel: string) => string | null;
  ariaLabel: string;
}) {
  const t = useTranslations("graph.stage");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const hoverRef = useRef<string | null>(null);
  const frameRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const fontRef = useRef<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isFull, setIsFull] = useState(false);

  const radiusOf = useCallback((n: GraphNode) => n.size ?? KIND_STYLE[n.kind].radius, []);

  // ── Kreslení ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || size.w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const view = viewRef.current;
    const k = view.k;
    const hover = hoverRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.translate(view.x, view.y);
    ctx.scale(k, k);

    // Výřez světa viditelný na obrazovce (s rezervou na popisky).
    const bx0 = -view.x / k - 120;
    const by0 = -view.y / k - 60;
    const bx1 = (size.w - view.x) / k + 120;
    const by1 = (size.h - view.y) / k + 60;
    const inView = (p: Point) => p.x >= bx0 && p.x <= bx1 && p.y >= by0 && p.y <= by1;

    const focus = hover ?? selectedId;
    const incident = new Set<string>();
    const focusEdges: GraphEdge[] = [];
    if (focus) {
      incident.add(focus);
      for (const e of edges) {
        if (e.src === focus || e.dst === focus) {
          incident.add(e.src === focus ? e.dst : e.src);
          focusEdges.push(e);
        }
      }
    }
    // Uzel je „jasný", když ho drží čočka NEBO okolí ohniska; bez obojího
    // platí jasné všechno.
    const bright = (id: string): boolean => {
      if (focus) return incident.has(id) || (!!lens && lens.nodes.has(id) && incident.size === 0);
      if (lens) return lens.nodes.has(id);
      return true;
    };
    const dimming = focus !== null || lens != null;

    // ── Hrany: jedna cesta plné, jedna čárkované; minK gate; culling. ──
    const bulk = (dashed: boolean) => {
      ctx.beginPath();
      let drew = false;
      for (const e of edges) {
        if (e.pending !== dashed) continue;
        if (e.minK !== undefined && k < e.minK) continue;
        if (focus && (e.src === focus || e.dst === focus)) continue;
        if (lens && lens.edges.has(edgeKey(e))) continue; // kreslí je vrstva čočky
        const a = positions.get(e.src);
        const b = positions.get(e.dst);
        if (!a || !b) continue;
        if (!inView(a) && !inView(b)) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        drew = true;
      }
      if (!drew) return;
      ctx.setLineDash(dashed ? [5, 5] : []);
      ctx.strokeStyle = STEEL;
      ctx.globalAlpha = lens ? 0.1 : focus ? 0.22 : 0.6;
      ctx.lineWidth = 1.3 / k;
      ctx.stroke();
    };
    bulk(false);
    bulk(true);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Hrany čočky — inkoustové, nad pozadím, pod ohniskem.
    if (lens) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9 / k;
      ctx.globalAlpha = 0.85;
      for (const e of edges) {
        if (!lens.edges.has(edgeKey(e))) continue;
        if (focus && (e.src === focus || e.dst === focus)) continue;
        const a = positions.get(e.src);
        const b = positions.get(e.dst);
        if (!a || !b) continue;
        ctx.setLineDash(e.pending ? [5, 5] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (focus) {
      ctx.strokeStyle = SIGNAL;
      ctx.lineWidth = 2 / k;
      for (const e of focusEdges) {
        const a = positions.get(e.src);
        const b = positions.get(e.dst);
        if (!a || !b) continue;
        ctx.setLineDash(e.pending ? [5, 5] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // ── Uzly po kbelících (tvar × barva × poloměr). ──
    const visible: GraphNode[] = [];
    for (const n of nodes) {
      const p = positions.get(n.id);
      if (p && inView(p)) visible.push(n);
    }
    const buckets = new Map<string, { shape: GlyphShape; fill: string; r: number; items: GraphNode[] }>();
    for (const n of visible) {
      const st = KIND_STYLE[n.kind];
      const dim = dimming && !bright(n.id);
      const r = radiusOf(n);
      const key = `${st.shape}|${dim ? HAIRLINE : st.fill}|${r}`;
      const b = buckets.get(key);
      if (b) b.items.push(n);
      else buckets.set(key, { shape: st.shape, fill: dim ? HAIRLINE : st.fill, r, items: [n] });
    }
    for (const b of buckets.values()) {
      ctx.beginPath();
      for (const n of b.items) {
        const p = positions.get(n.id)!;
        ctx.save();
        ctx.translate(p.x, p.y);
        traceGlyph(ctx, b.shape, b.r);
        ctx.restore();
      }
      if (b.shape === "ring") {
        ctx.strokeStyle = b.fill;
        ctx.lineWidth = 2.5 / k;
        ctx.stroke();
      } else {
        ctx.fillStyle = b.fill;
        ctx.fill();
      }
    }

    // Označení „už rozkvetlé" (ohnisko) — tenký inkoustový kroužek.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5 / k;
    for (const n of visible) {
      if (!n.mark) continue;
      const p = positions.get(n.id)!;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusOf(n) + 4 / k, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (selectedId) {
      const p = positions.get(selectedId);
      if (p) {
        const n = nodes.find((x) => x.id === selectedId);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (n ? radiusOf(n) : 8) + 8 / k, 0, Math.PI * 2);
        ctx.strokeStyle = SIGNAL;
        ctx.lineWidth = 2.2 / k;
        ctx.stroke();
      }
    }

    // ── REŽIE POPISKŮ: jedna fronta, jeden kolizní prostor, jeden rozpočet. ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fontRef.current ??=
      getComputedStyle(document.documentElement).getPropertyValue("--font-plex").trim() || "ui-monospace";
    const font = (px: number, weight = 600) => `${weight} ${px}px ${fontRef.current}, ui-monospace, monospace`;

    const placed: Box[] = [];
    const screen = (p: Point) => ({ sx: p.x * k + view.x, sy: p.y * k + view.y });

    const paintLabel = (
      sx: number,
      y: number,
      text: string,
      color: string,
      px: number,
      weight: number,
      force: boolean,
      sub?: string,
    ): boolean => {
      ctx.font = font(px, weight);
      const w = ctx.measureText(text).width;
      const subH = sub ? 15 : 0;
      const box: Box = [sx - w / 2 - 3, y - px - 3, sx + w / 2 + 3, y + 3 + subH];
      if (!force && collides(box, placed)) return false;
      placed.push(box);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, sx, y);
      if (sub) {
        ctx.font = font(10.5, 500);
        ctx.fillStyle = STEEL;
        ctx.fillText(sub, sx, y + 14);
      }
      return true;
    };

    // 1. Titulky (sloupce tras) — vždy, blokují prostor pod sebou.
    for (const c of captions ?? []) {
      const { sx, sy } = screen(c);
      if (sx < -100 || sx > size.w + 100) continue;
      paintLabel(sx, sy, c.text.toUpperCase(), INK, 13, 800, true);
    }

    // 2. Uzly podle priority; rozpočet roste s přiblížením.
    const prio = (n: GraphNode) =>
      n.id === selectedId || n.id === hover ? 3 : (focus && incident.has(n.id)) || (lens && lens.nodes.has(n.id)) ? 2 : 1;
    const ranked = [...visible].sort((a, b) => prio(b) - prio(a) || b.degree - a.degree);
    const budget = Math.min(150, 22 + Math.floor(k * 70));
    let used = 0;
    for (const n of ranked) {
      const p = prio(n);
      if (p === 1 && (dimming || used >= budget)) continue;
      const pos = positions.get(n.id)!;
      const { sx, sy } = screen(pos);
      const text = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
      const ok = paintLabel(
        sx,
        sy - radiusOf(n) * k - 5,
        text,
        p === 3 ? SIGNAL : INK,
        p === 3 ? 12.5 : 12,
        p >= 2 ? 700 : 600,
        p === 3,
        n.sub,
      );
      if (ok) used++;
    }

    // 3. Štítky hran: trvalé (e.label) a k vybranému uzlu (relLabel).
    ctx.textAlign = "center";
    const edgeLabel = (e: GraphEdge, text: string, color: string) => {
      const a = positions.get(e.src);
      const b = positions.get(e.dst);
      if (!a || !b) return;
      const mx = ((a.x + b.x) / 2) * k + view.x;
      const my = ((a.y + b.y) / 2) * k + view.y;
      if (mx < 0 || my < 0 || mx > size.w || my > size.h) return;
      ctx.font = font(11, 600);
      const w = ctx.measureText(text).width;
      const box: Box = [mx - w / 2 - 3, my - 13, mx + w / 2 + 3, my + 3];
      if (collides(box, placed)) return;
      placed.push(box);
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, mx, my);
    };
    for (const e of edges) {
      if (e.label && (e.minK === undefined || k >= e.minK)) edgeLabel(e, e.label, STEEL);
    }
    if (focus && relLabel) {
      for (const e of focusEdges) {
        const text = relLabel(e.rel);
        if (text) edgeLabel(e, text, SIGNAL);
      }
    }
  }, [nodes, edges, positions, selectedId, size, captions, relLabel, radiusOf, lens]);

  const schedule = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      draw();
    });
  }, [draw]);

  // ── Rozměry, fit, focus ───────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(wrap);
    const onFull = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    schedule();
  }, [size, schedule]);

  const fitView = useCallback(() => {
    if (size.w === 0) return;
    const k = Math.min(size.w / world.width, size.h / world.height, 1.5);
    viewRef.current = {
      k,
      x: (size.w - world.width * k) / 2,
      y: (size.h - world.height * k) / 2,
    };
    schedule();
  }, [size, world.width, world.height, schedule]);

  useEffect(() => {
    fitView();
  }, [fitKey, fitView]);

  // Najetí na obdélník světa (výřez trasy) — s rezervou na plovoucí panely.
  useEffect(() => {
    if (!fitBounds || size.w === 0) return;
    const pad = 90;
    const w = Math.max(fitBounds.x1 - fitBounds.x0, 60);
    const h = Math.max(fitBounds.y1 - fitBounds.y0, 60);
    const k = Math.max(MIN_K, Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h, 1.4));
    viewRef.current = {
      k,
      x: size.w / 2 - (fitBounds.x0 + w / 2) * k,
      y: size.h / 2 - (fitBounds.y0 + h / 2) * k,
    };
    schedule();
  }, [fitBounds, size, schedule]);

  useEffect(() => {
    if (!focusId || size.w === 0) return;
    const p = positions.get(focusId);
    if (!p) return;
    const view = viewRef.current;
    if (view.k < 0.85) view.k = 0.85; // najetí bez čitelného přiblížení je k ničemu
    view.x = size.w / 2 - p.x * view.k;
    view.y = size.h / 2 - p.y * view.k;
    schedule();
  }, [focusId, positions, size, schedule]);

  useEffect(() => {
    schedule();
  }, [schedule]);

  useEffect(
    () => () => {
      // Nulovat, ne jen zrušit: StrictMode dvojí mount jinak nechá v ref
      // mrtvý handle a `schedule()` už nikdy nenaplánuje kreslení.
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  // ── Ukazovátko ────────────────────────────────────────────────────────────
  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const wx = (clientX - rect.left - view.x) / view.k;
      const wy = (clientY - rect.top - view.y) / view.k;
      let best: string | null = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const p = positions.get(n.id);
        if (!p) continue;
        const d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
        const reach = (radiusOf(n) + 7 / view.k) ** 2;
        if (d < reach && d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      return best;
    },
    [nodes, positions, radiusOf],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const view = viewRef.current;
      const k = Math.max(MIN_K, Math.min(MAX_K, view.k * factor));
      view.x = cx - ((cx - view.x) / view.k) * k;
      view.y = cy - ((cy - view.y) / view.k) * k;
      view.k = k;
      schedule();
    },
    [schedule],
  );

  const toggleFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void wrapRef.current?.requestFullscreen();
    } catch (err) {
      // Fullscreen API není všude (starší Safari, iframy bez allowfullscreen).
      console.warn("[graph-stage] fullscreen", err);
    }
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-paper">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="block touch-none select-none"
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (drag) {
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
            viewRef.current.x += dx;
            viewRef.current.y += dy;
            drag.x = e.clientX;
            drag.y = e.clientY;
            schedule();
            return;
          }
          const hit = hitTest(e.clientX, e.clientY);
          if (hit !== hoverRef.current) {
            hoverRef.current = hit;
            if (canvasRef.current) canvasRef.current.style.cursor = hit ? "pointer" : "grab";
            schedule();
          }
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          dragRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          // Tažení nesmí končit výběrem — posun plátna není klik.
          if (drag && !drag.moved) onSelect(hitTest(e.clientX, e.clientY));
        }}
        onPointerLeave={() => {
          dragRef.current = null;
          if (hoverRef.current !== null) {
            hoverRef.current = null;
            schedule();
          }
        }}
        onWheel={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0016));
        }}
      />

      {/* Ovládání pohledu — pluje nad plátnem vpravo dole. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col border-2 border-ink bg-ink" style={{ gap: 1 }}>
        <StageButton label={t("zoomIn")} onClick={() => zoomAt(size.w / 2, size.h / 2, 1.45)}>
          <ZoomIn className="h-4 w-4" />
        </StageButton>
        <StageButton label={t("zoomOut")} onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.45)}>
          <ZoomOut className="h-4 w-4" />
        </StageButton>
        <StageButton label={t("fit")} onClick={fitView}>
          <Scan className="h-4 w-4" />
        </StageButton>
        <StageButton label={isFull ? t("exitFullscreen") : t("fullscreen")} onClick={toggleFullscreen}>
          {isFull ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </StageButton>
      </div>
    </div>
  );
}

function StageButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="bg-paper p-2 text-ink transition-colors hover:bg-paper-strong"
    >
      {children}
    </button>
  );
}
