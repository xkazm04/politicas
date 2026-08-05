import { ImageResponse } from "next/og";
import { HAIRLINE, INK, OCHRE, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";

/*
 * Kořenová OG karta — dědí ji každá routa, která nemá vlastní obraz
 * (vlastní mají /graf/p/[ref] a /referendum). Tmavá řeč domu podle
 * precedensu app/graf/p/[ref]/opengraph-image.tsx: inkoustový podklad,
 * papírový titulek, rudý čtverec, mono kicker.
 *
 * Obsah nese jen skutečná čísla (207 poslanců, šest složek) a hodnotovou
 * větu produktu z PRODUCT.md — nic vymyšleného.
 *
 * Písmo: satori bundluje jen latin subset — česká diakritika by vypadla.
 * Podmnožina Archivo + IBM Plex Mono přes Google Fonts; když fetch selže,
 * jede výchozí písmo — degradace, ne výpadek karty.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "politicas — 207 poslanců, jeden srovnatelný index přispění; každé číslo cituje svůj zdroj";

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

export default async function Image() {
  const kicker = "politicas / index přispění";
  const statLine = "šest zveřejněných složek · celá sněmovna, žádný výběr";
  const title = "207 poslanců. Jeden srovnatelný index.";
  const claimLine = "každé číslo cituje svůj zdroj";
  const sourcesLine = "zdroje: psp.cz · ares · registr smluv · e-sbírka";

  // Podmnožina písma přesně na vysázené znaky — malý soubor, žádné tofu.
  const allText = [kicker, statLine, title, claimLine, sourcesLine].join("");
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
          <div
            style={{
              fontFamily: sans,
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.02,
              textTransform: "uppercase",
              letterSpacing: -1,
              marginTop: 18,
              display: "flex",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 28,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: SIGNAL,
              marginTop: 26,
              display: "flex",
            }}
          >
            {claimLine}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: `3px solid ${STEEL}`,
            paddingTop: 24,
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 22, color: STEEL, display: "flex" }}>{sourcesLine}</div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
