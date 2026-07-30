import { ImageResponse } from "next/og";
import { getPermalinkData } from "@/features/graph/getPermalinkData";
import { HASH_ALGORITHM, KIND_LABELS } from "@/features/graph/permalink";
import { KIND_STYLE } from "@/features/graph/kindStyle";
import { glyphPath, type GlyphShape } from "@/lib/kg/glyph";
import { COBALT, HAIRLINE, INK, OCHRE, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import { czechDate, formatInt } from "@/lib/format";

/*
 * OG obraz trvalé citace — karta odkazu ve tmavé řeči domu: inkoustový
 * podklad, papírový titulek, rudý akcent, tvarosloví uzlů z plátna.
 *
 * DOKTRÍNA EXPORTU: stav lidské kontroly hran NESMÍ zmizet žádným formátem
 * citace — karta proto nese „vše ověřeno" / „N hran čeká na kontrolu" a
 * otisk obsahu s datem, stejně jako sazba a JSON-LD.
 *
 * Písmo: satori bundluje jen latin subset — česká diakritika by vypadla.
 * Načítá se proto Archivo + IBM Plex Mono podmnožinou přes Google Fonts
 * (vzor z dokumentace next/og „dynamic text"); když fetch selže, obraz se
 * vykreslí výchozím písmem — degradace, ne výpadek karty.
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
  const result = await getPermalinkData(ref);

  const view = result.status === "ok" ? result.view : null;
  const title = view ? view.title : "Znalostní graf české politiky";
  const kicker = "politicas / graf · trvalá citace";
  const sourcesLine = "zdroje: psp.cz · ares · registr smluv · e-sbírka";

  // Stav kontroly + statistika — spočítané dopředu (žádné formátování v JSX).
  let reviewLine = "";
  let statLine = "";
  const glyphs: Array<{ shape: GlyphShape; fill: string }> = [];
  if (view?.kind === "cesta") {
    const pending = view.trail?.pendingCount ?? 0;
    reviewLine =
      view.trail === null
        ? "cesta v dnešním grafu už doložena není"
        : pending === 0
          ? "vše ověřeno"
          : pending === 1
            ? "1 hrana čeká na kontrolu"
            : `${formatInt(pending, "cs")} hran čeká na kontrolu`;
    if (view.trail) {
      const hops = view.trail.hops;
      statLine = `důkazní cesta · ${formatInt(hops, "cs")} ${hops === 1 ? "krok" : hops <= 4 ? "kroky" : "kroků"}`;
    } else {
      statLine = "důkazní cesta";
    }
    glyphs.push(
      { shape: KIND_STYLE[view.from.kind].shape, fill: darkFill(KIND_STYLE[view.from.kind].fill) },
      { shape: KIND_STYLE[view.to.kind].shape, fill: darkFill(KIND_STYLE[view.to.kind].fill) },
    );
  } else if (view?.kind === "trasa") {
    const pending = view.trail.edges.filter((e) => e.pending).length;
    reviewLine =
      pending === 0
        ? "vše ověřeno"
        : pending === 1
          ? "1 hrana čeká na kontrolu"
          : `${formatInt(pending, "cs")} hran čeká na kontrolu`;
    statLine = `kurátorská trasa · ${formatInt(view.trail.nodes.length, "cs")} uzlů · ${formatInt(view.trail.edges.length, "cs")} hran`;
    for (const kind of view.trail.columns.slice(0, 4)) {
      const style = KIND_STYLE[kind as keyof typeof KIND_STYLE];
      if (style) glyphs.push({ shape: style.shape, fill: darkFill(style.fill) });
    }
  } else if (view?.kind === "uzel") {
    statLine = `${KIND_LABELS[view.detail.node.kind] ?? view.detail.node.kind} ve znalostním grafu`;
    reviewLine =
      view.detail.provenance.method === "deterministic"
        ? "spočítáno deterministicky"
        : view.detail.provenance.method
          ? "návrh modelu prošlý branou"
          : "";
    const style = KIND_STYLE[view.detail.node.kind];
    glyphs.push({ shape: style.shape, fill: darkFill(style.fill) });
  }

  const hashLine = view
    ? `otisk ${HASH_ALGORITHM} ${view.currentHash} · stav ověření k ${czechDate(view.retrievedOn)}`
    : "trvalá adresa nese celý pohled i otisk důkazů";

  // Podmnožina písma přesně na vysázené znaky — malý soubor, žádné tofu.
  const allText = [kicker, title, statLine, reviewLine, hashLine, sourcesLine].join("");
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
                color: reviewLine === "vše ověřeno" ? COBALT : SIGNAL,
                marginTop: 26,
                display: "flex",
              }}
            >
              {reviewLine}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderTop: `3px solid ${STEEL}`,
            paddingTop: 24,
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 24, color: HAIRLINE, display: "flex" }}>{hashLine}</div>
          <div style={{ fontFamily: mono, fontSize: 22, color: STEEL, display: "flex" }}>{sourcesLine}</div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
