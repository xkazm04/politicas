import { ImageResponse } from "next/og";
import { getLocale, getTranslations } from "next-intl/server";
import { getPermalinkData } from "@/features/graph/getPermalinkData";
import {
  HASH_ALGORITHM,
  KIND_LABELS,
  permalinkCardModel,
  permalinkSources,
} from "@/features/graph/permalink";
import { KIND_STYLE } from "@/features/graph/kindStyle";
import { glyphPath, type GlyphShape } from "@/lib/kg/glyph";
import { COBALT, HAIRLINE, INK, OCHRE, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import { formatDate, formatInt } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/*
 * OG obraz trvalé citace — karta odkazu ve tmavé řeči domu: inkoustový
 * podklad, papírový titulek, rudý akcent, tvarosloví uzlů z plátna.
 *
 * DOKTRÍNA EXPORTU: stav lidské kontroly hran NESMÍ zmizet žádným formátem
 * citace — karta proto nese „vše ověřeno" / „N hran čeká na kontrolu" a
 * otisk obsahu s datem, stejně jako sazba a JSON-LD.
 *
 * A ZASTARALOST TAKY NE (2026-08-13). Karta je nejhůř opravitelný artefakt,
 * který produkt vydává: sítě si ji nacachují a redakce ji screenshotují do
 * článků, takže ji za rok nikdo neopraví. Do dneška `fresh` VŮBEC nečetla —
 * nad citací, o které stránka za ní vyvěsila rozpor, tiskla dnešní otisk
 * s dnešním datem a „vše ověřeno" v potvrzující modré. Teď zastaralost
 * vyvěšuje NAD obsahem (pravidlo Exponátu, jako sazba) a potvrzující barvu
 * zastaralý pohled nedostane.
 *
 * TŘI NEPOHLEDY SE NESLÉVAJÍ. `invalid` (404), `gone` (410) a `unavailable`
 * (503) měly jeden společný náhradní rám, který navíc tvrdil „trvalá adresa
 * nese celý pohled i otisk důkazů" nad adresou, která nenese nic — takže náš
 * výpadek vypadal jako zánik doloženého pohledu. Rozhodnutí, co karta smí
 * říct, dělá čistý `permalinkCardModel`; tenhle soubor jen sází.
 *
 * Písmo: satori bundluje jen latin subset — česká diakritika by vypadla.
 * Načítá se proto Archivo + IBM Plex Mono podmnožinou přes Google Fonts
 * (vzor z dokumentace next/og „dynamic text"); když fetch selže, obraz se
 * vykreslí výchozím písmem — degradace, ne výpadek karty. KAŽDÝ nový řetězec
 * musí být v `allText`, jinak se z něj stanou tofu obdélníky.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Trvalá citace pohledu na znalostní graf české politiky — politicas";

async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const resource = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!resource) return null;
    const res = await fetch(resource[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    // Bez sítě jede výchozí písmo — karta se vykreslí vždycky.
    console.error("[og] načtení písma selhalo — jede výchozí", err);
    return null;
  }
}

function Glyph({ shape, fill, px }: { shape: GlyphShape; fill: string; px: number }) {
  return (
    <svg width={px} height={px} viewBox="-12 -12 24 24">
      <path d={glyphPath(shape, 10)} fill={fill} />
    </svg>
  );
}

/** Tmavá varianta tvarosloví: inkoustové výplně by na inkoustu zmizely. */
const darkFill = (light: string): string => (light === INK ? PAPER : light);

export default async function Image({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const [result, t, rawLocale] = await Promise.all([
    getPermalinkData(ref),
    getTranslations("graph"),
    getLocale(),
  ]);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const fInt = (n: number) => formatInt(n, locale);

  // Co karta SMÍ říct — čisté pravidlo (permalink.ts), tady jen sazba.
  const card = permalinkCardModel(result);
  const view = result.status === "ok" ? result.view : null;
  const kicker = `politicas / graf · ${t("permalink.tag")}`;
  const pendingLine = (pending: number) =>
    pending === 0 ? t("allVerified") : t("pendingEdges", { count: pending, countFmt: fInt(pending) });

  // Prameny: registry uzlu mají přednost před pramennou základnou platformy —
  // TÉŽ pravidlo, kterým se řídí citační lišta a `isBasedOn` (permalinkSources).
  const sources = view ? permalinkSources(view) : null;
  const sourcesLine = !sources
    ? ""
    : sources.fromView
      ? t("permalink.og.sourcesLine", {
          list: [...new Set(sources.links.map((l) => l.label))].slice(0, 4).join(" · "),
        })
      : t("permalink.og.sources");

  // Stav kontroly + statistika — spočítané dopředu (žádné formátování v JSX).
  let reviewLine = "";
  let statLine = "";
  let title = "";
  let hashLine = "";
  const glyphs: Array<{ shape: GlyphShape; fill: string }> = [];

  if (view?.kind === "cesta") {
    title = view.title;
    reviewLine = view.trail === null ? t("permalink.og.pathGone") : pendingLine(view.trail.pendingCount);
    if (view.trail) {
      const hops = view.trail.hops;
      statLine = `${t("permalink.og.evidencePath")} · ${t("steps", { count: hops, countFmt: fInt(hops) })}`;
    } else {
      statLine = t("permalink.og.evidencePath");
    }
    glyphs.push(
      { shape: KIND_STYLE[view.from.kind].shape, fill: darkFill(KIND_STYLE[view.from.kind].fill) },
      { shape: KIND_STYLE[view.to.kind].shape, fill: darkFill(KIND_STYLE[view.to.kind].fill) },
    );
  } else if (view?.kind === "trasa") {
    title = view.title;
    reviewLine = pendingLine(view.trail.edges.filter((e) => e.pending).length);
    statLine = `${t("permalink.og.curatedTrail")} · ${t("counts", {
      nodes: fInt(view.trail.nodes.length),
      edges: fInt(view.trail.edges.length),
    })}`;
    for (const kind of view.trail.columns.slice(0, 4)) {
      const style = KIND_STYLE[kind as keyof typeof KIND_STYLE];
      if (style) glyphs.push({ shape: style.shape, fill: darkFill(style.fill) });
    }
  } else if (view?.kind === "uzel") {
    title = view.title;
    const kindKey = `kinds.${view.detail.node.kind}`;
    const kindLabel = t.has(kindKey)
      ? t(kindKey)
      : (KIND_LABELS[view.detail.node.kind] ?? view.detail.node.kind);
    statLine = t("permalink.og.inGraph", { kind: kindLabel });
    reviewLine =
      view.detail.provenance.method === "deterministic"
        ? t("permalink.og.deterministic")
        : view.detail.provenance.method
          ? t("permalink.og.verdict")
          : "";
    const style = KIND_STYLE[view.detail.node.kind];
    glyphs.push({ shape: style.shape, fill: darkFill(style.fill) });
  } else if (card.state === "gone") {
    // Adresa je čitelná a otisk v ní JE — zanikl doklad, ne citace.
    title = t("permalink.goneTitle");
    reviewLine = t("permalink.og.goneNote");
  } else if (card.state === "unavailable") {
    // NÁŠ výpadek. Nikdy se nesmí číst jako „graf tenhle pohled nedokládá".
    title = t("permalink.og.unavailableTitle");
    reviewLine = t("permalink.og.unavailableNote");
    // Adresa opravdu nese celý stav pohledu i citovaný otisk — jen se dnes
    // nedá znovuodvodit. Tady je ta věta pravdivá; nad neplatnou adresou ne.
    hashLine = t("permalink.og.hashFallback");
  } else {
    // invalid: o adrese nevíme NIC, takže karta jmenuje jen produkt.
    title = t("permalink.og.fallbackTitle");
    reviewLine = t("permalink.og.invalidNote");
  }

  if (card.imprint) {
    hashLine =
      card.state === "gone"
        ? t("permalink.goneImprint", {
            algo: HASH_ALGORITHM,
            hash: card.imprint.hash,
            date: formatDate(card.imprint.retrievedOn, locale),
          })
        : t("permalink.og.hashLine", {
            algo: HASH_ALGORITHM,
            hash: card.imprint.hash,
            date: formatDate(card.imprint.retrievedOn, locale),
          });
  }

  // Zastaralost NAD obsahem — čtenář karty ji musí potkat dřív než důkazy.
  const staleLine =
    card.stale && card.imprint?.citedHash
      ? t("permalink.og.stale", {
          urlHash: card.imprint.citedHash,
          currentHash: card.imprint.hash,
        })
      : "";

  /*
   * Podmnožina písma přesně na vysázené znaky — malý soubor, žádné tofu.
   *
   * VELKÁ PÍSMENA SE MUSÍ VYŽÁDAT ZVLÁŠŤ (nalezeno 2026-08-13 na vyrenderované
   * kartě). Titulek, kicker i řádek kontroly sázíme přes `textTransform:
   * "uppercase"`, ale podmnožina se do teď žádala nad NEPŘEVEDENÝM textem —
   * takže z „Data se právě nedají přečíst" přišlo z Archiva jediné velké „D"
   * a zbytek verzálek spadl na náhradní písmo. Karta pak míchala dvě písma
   * uprostřed slova. Připojujeme proto i verzálkovou podobu; přírůstek je pár
   * desítek glyfů, ne nová sada.
   */
  const rendered = [kicker, title, statLine, reviewLine, staleLine, hashLine, sourcesLine].join("");
  const allText = rendered + rendered.toUpperCase();
  const [archivo, plex] = await Promise.all([
    loadGoogleFont("Archivo", 800, allText),
    loadGoogleFont("IBM Plex Mono", 500, allText),
  ]);
  const fonts: Array<{ name: string; data: ArrayBuffer; weight: 500 | 800 }> = [
    ...(archivo ? [{ name: "Archivo", data: archivo, weight: 800 as const }] : []),
    ...(plex ? [{ name: "Plex", data: plex, weight: 500 as const }] : []),
  ];

  const mono = plex ? "Plex" : undefined;
  const sans = archivo ? "Archivo" : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          color: PAPER,
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, backgroundColor: SIGNAL, display: "flex" }} />
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: HAIRLINE,
              display: "flex",
            }}
          >
            {kicker}
          </div>
        </div>

        {/* Zastaralost se říká NAD obsahem (pravidlo Exponátu) — na kartě
            stejně jako v sazbě, protože kartu nikdo nikdy neopraví. */}
        {staleLine !== "" && (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              borderLeft: `10px solid ${SIGNAL}`,
              paddingLeft: 18,
              paddingTop: 8,
              paddingBottom: 8,
              fontFamily: mono,
              fontSize: 25,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: SIGNAL,
            }}
          >
            {staleLine}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          {statLine !== "" && (
            <div
              style={{
                fontFamily: mono,
                fontSize: 28,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: OCHRE,
                display: "flex",
              }}
            >
              {statLine}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 18 }}>
            {glyphs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {glyphs.map((g, i) => (
                  <Glyph key={i} shape={g.shape} fill={g.fill} px={54} />
                ))}
              </div>
            )}
            <div
              style={{
                fontFamily: sans,
                fontSize: title.length > 60 ? 52 : 68,
                fontWeight: 800,
                lineHeight: 1.02,
                textTransform: "uppercase",
                letterSpacing: -1,
                display: "flex",
                maxWidth: 980,
              }}
            >
              {title.length > 110 ? `${title.slice(0, 109)}…` : title}
            </div>
          </div>
          {reviewLine !== "" && (
            <div
              style={{
                fontFamily: mono,
                fontSize: 28,
                letterSpacing: 3,
                textTransform: "uppercase",
                // Potvrzující modrá JEN když ji karta smí použít — zastaralý
                // pohled ji nedostane, i když dnešní hrany ověřené jsou.
                color: card.review?.confirming ? COBALT : SIGNAL,
                marginTop: 26,
                display: "flex",
              }}
            >
              {reviewLine}
            </div>
          )}
        </div>

        {/* Patička jen když je co pod čáru napsat — nad neplatnou adresou
            nemáme otisk ani prameny a prázdná linka slibuje obojí. */}
        <div
          style={{
            display: hashLine === "" && sourcesLine === "" ? "none" : "flex",
            flexDirection: "column",
            gap: 10,
            borderTop: `3px solid ${STEEL}`,
            paddingTop: 24,
          }}
        >
          {hashLine !== "" && (
            <div style={{ fontFamily: mono, fontSize: 24, color: HAIRLINE, display: "flex" }}>{hashLine}</div>
          )}
          {/* Prameny jen tam, kde je pohled skutečně má — nad neplatnou adresou
              ani nad výpadkem se registry nejmenují: nedokládají nic. */}
          {sourcesLine !== "" && (
            <div style={{ fontFamily: mono, fontSize: 22, color: STEEL, display: "flex" }}>{sourcesLine}</div>
          )}
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
