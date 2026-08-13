// Deník důkazů — feed serializations (RSS 2.0 + JSON Feed 1.1). Pure, no
// server imports; the route handlers under app/dukazy/feed.* are thin shells
// over these. The ids/permalinks emitted here are a PUBLIC API (design doc
// batch-2 §2C: "feed stability contract") — guids are `politicas:dukazy:<id>`
// with isPermaLink=false and every url points at `/dukazy#z-<id>`.

import { formatInt } from "@/lib/format";
import type { EvidenceEntry } from "./deriveFeed";

export interface FeedContext {
  /** Origin, no trailing slash — e.g. "https://politicas.cz". */
  baseUrl: string;
  /** ISO timestamp the feed was generated at (injected for determinism). */
  generatedAt: string;
  /**
   * Strop, se kterým se deník brány čte. POVINNÝ: popis kanálu ho vyslovuje,
   * takže volající, který strop nezná, nesmí umět feed vůbec složit — jinak se
   * absolutní věta vrátí zadními vrátky. Hodnota jde z odečtu (`DukazyLimits
   * .auditCap`), nikdy z literálu tady (`REVIEW_AUDIT_CAP` žije v `server-only`
   * modulu, tenhle kodek je čistý).
   */
  auditCap: number;
  /**
   * Jedna až dvě věty o tom, co tenhle výpis NENESE (skládá `./feedNotes.ts`).
   * Přilepují se k popisu KANÁLU, ne jako položka: syntetický záznam „vrstva je
   * tmavá" by v čtečce stál mezi datovanými rozhodnutími a tvářil se jako jedno
   * z nich (precedens features/denik/feedCodecs.ts). `null`/vynecháno = popis
   * beze změny.
   */
  notice?: string | null;
}

export const FEED_TITLE = "Deník důkazů — Politicas";
/** Věcný popis BEZ ABSOLUTNA (2026-08-13). Dřív tu stálo „každé rozhodnutí
 *  revizora … a každý podepsaný forenzní posudek" — tvrzení o úplnosti nad
 *  čtením s tvrdým stropem, které obě routy uměly detekovat a zahazovaly. */
export const FEED_DESCRIPTION =
  "Veřejný věstník lidské brány: rozhodnutí revizora nad vazbou poslanec ↔ firma a podepsané forenzní posudky, chronologicky, s odkazy na primární registry, s pozicí v řetězu brány a s trvalou účtenkou u každého záznamu.";

/**
 * Popis kanálu VČETNĚ STROPU, kterým se věstník čte (vzor
 * `denikFeedDescription()`). Číslo se dosazuje z konstanty, která řez opravdu
 * dělá — přepsané do věty by se s kódem rozešlo první změnou stropu.
 */
export function dukazyFeedDescription(auditCap: number): string {
  return (
    `${FEED_DESCRIPTION} ` +
    `Deník brány se čte se stropem ${formatInt(auditCap, "cs")} řádků; posudek, který branou ` +
    `zatím neprošel, je pracovní materiál a tenhle výpis ho nenese.`
  );
}

export function entryUrl(baseUrl: string, e: EvidenceEntry): string {
  return `${baseUrl}/dukazy#${e.anchor}`;
}

export function entryGuid(e: EvidenceEntry): string {
  return `politicas:dukazy:${e.id}`;
}

/**
 * Gated one-line body shared by both formats — never the reviewer's raw note.
 *
 * Od 2026-08-13 nese i to, čím se rozhodnutí dá NEZÁVISLE ověřit: pozici
 * v připojeném řetězu a otisk vlastního řádku (`review_audit.chain_pos` /
 * `row_hash`), plus trvalou účtenku `/zdroj/<ref>`. RSS ani JSON Feed pro ně
 * nemají vlastní element, takže jdou do textu položky — tam, kde je čtečka
 * skutečně ukáže, a bez rozšíření, které by validátor obou deníků zahodil.
 */
export function entrySummaryCs(e: EvidenceEntry, baseUrl?: string): string {
  const prior = e.priorState ? ` (předchozí stav: ${e.priorState})` : "";
  const parts = [`${e.decisionCs} — ${e.subjectCs}`, `Rozhodl: ${e.reviewer}${prior}`];
  if (e.chainPos != null && e.rowHash) {
    parts.push(`řetěz brány: pozice ${e.chainPos}, otisk řádku ${e.rowHash}`);
  } else if (e.kind === "tie") {
    // Řádek zapsaný před zavedením řetězu pozici nemá — a nevymýšlí se mu.
    parts.push("řetěz brány: tenhle řádek v něm místo nemá, je z doby před jeho zavedením");
  }
  if (e.receiptHref) parts.push(`účtenka: ${baseUrl ?? ""}${e.receiptHref}`);
  parts.push(e.sourceCs);
  return `${parts.join(". ")}.`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC-822 date for RSS `pubDate`; null when the timestamp doesn't parse
 *  (the element is then omitted rather than published wrong). */
function rfc822(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toUTCString() : null;
}

/** Popis kanálu + přilepené upozornění o tomhle vydání (viz `FeedContext.notice`). */
function channelDescription(ctx: FeedContext): string {
  const base = dukazyFeedDescription(ctx.auditCap);
  return ctx.notice ? `${base} ${ctx.notice}` : base;
}

export function evidenceFeedToRss(entries: readonly EvidenceEntry[], ctx: FeedContext): string {
  const items = entries
    .map((e) => {
      const pub = rfc822(e.decidedAt);
      return [
        "    <item>",
        `      <guid isPermaLink="false">${escapeXml(entryGuid(e))}</guid>`,
        `      <link>${escapeXml(entryUrl(ctx.baseUrl, e))}</link>`,
        `      <title>${escapeXml(`${e.decisionCs}: ${e.subjectCs}`)}</title>`,
        ...(pub ? [`      <pubDate>${pub}</pubDate>`] : []),
        `      <description>${escapeXml(entrySummaryCs(e, ctx.baseUrl))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const build = rfc822(ctx.generatedAt);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `  <channel>`,
    `    <title>${escapeXml(FEED_TITLE)}</title>`,
    `    <link>${escapeXml(`${ctx.baseUrl}/dukazy`)}</link>`,
    `    <description>${escapeXml(channelDescription(ctx))}</description>`,
    `    <language>cs</language>`,
    ...(build ? [`    <lastBuildDate>${build}</lastBuildDate>`] : []),
    items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

/** JSON Feed 1.1 item shape (the subset we emit). */
export interface EvidenceFeedJsonItem {
  id: string;
  url: string;
  title: string;
  content_text: string;
  date_published: string;
  authors: { name: string }[];
  external_url?: string;
}

export interface EvidenceFeedJson {
  version: string;
  title: string;
  home_page_url: string;
  feed_url: string;
  description: string;
  language: string;
  items: EvidenceFeedJsonItem[];
}

export function evidenceFeedToJson(entries: readonly EvidenceEntry[], ctx: FeedContext): string {
  const feed: EvidenceFeedJson = {
    version: "https://jsonfeed.org/version/1.1",
    title: FEED_TITLE,
    home_page_url: `${ctx.baseUrl}/dukazy`,
    feed_url: `${ctx.baseUrl}/dukazy/feed.json`,
    description: channelDescription(ctx),
    language: "cs",
    items: entries.map((e) => ({
      id: entryGuid(e),
      url: entryUrl(ctx.baseUrl, e),
      title: `${e.decisionCs}: ${e.subjectCs}`,
      content_text: entrySummaryCs(e, ctx.baseUrl),
      date_published: e.decidedAt,
      authors: [{ name: e.reviewer }],
      ...(e.links[0] ? { external_url: e.links[0].href } : {}),
    })),
  };
  return JSON.stringify(feed, null, 2);
}

/**
 * Strict reader for the JSON representation — the round-trip half of the codec
 * (tests pin serialize → parse → same ids/urls/titles). Throws on a payload
 * that is not a politicas evidence feed; a subscriber-side validator can reuse
 * it as-is.
 */
export function parseEvidenceFeedJson(text: string): EvidenceFeedJson {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null) throw new Error("feed: not an object");
  const o = raw as Record<string, unknown>;
  if (o.version !== "https://jsonfeed.org/version/1.1") throw new Error("feed: unknown version");
  if (typeof o.title !== "string" || typeof o.home_page_url !== "string" || typeof o.feed_url !== "string") {
    throw new Error("feed: missing channel fields");
  }
  if (!Array.isArray(o.items)) throw new Error("feed: items is not an array");
  const items: EvidenceFeedJsonItem[] = o.items.map((it, i) => {
    if (typeof it !== "object" || it === null) throw new Error(`feed: item ${i} is not an object`);
    const r = it as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.url !== "string" || typeof r.title !== "string") {
      throw new Error(`feed: item ${i} missing id/url/title`);
    }
    return {
      id: r.id,
      url: r.url,
      title: r.title,
      content_text: typeof r.content_text === "string" ? r.content_text : "",
      date_published: typeof r.date_published === "string" ? r.date_published : "",
      authors: Array.isArray(r.authors)
        ? r.authors.flatMap((a) =>
            typeof a === "object" && a !== null && typeof (a as Record<string, unknown>).name === "string"
              ? [{ name: (a as Record<string, unknown>).name as string }]
              : [],
          )
        : [],
      ...(typeof r.external_url === "string" ? { external_url: r.external_url } : {}),
    };
  });
  return {
    version: o.version,
    title: o.title,
    home_page_url: o.home_page_url,
    feed_url: o.feed_url,
    description: typeof o.description === "string" ? o.description : "",
    language: typeof o.language === "string" ? o.language : "",
    items,
  };
}
