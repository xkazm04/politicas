import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { LENS_PARAM } from "@/features/civicscore/lens";
import { deriveReferendumCard } from "@/features/landing/referendum/ogPayload";
import { COMPONENT_FILL } from "@/features/civicscore/components/LeaderboardTable";
import { HAIRLINE, INK, OCHRE, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import { czech, czechInt } from "@/lib/format";

/*
 * OG karta referenda o metodice (moonshot 7B) — sdílený odkaz /referendum
 * (?vahy=…) nese kartu ve tmavé řeči domu (vzor: app/graf/p/[ref]/
 * opengraph-image.tsx): otisk vah (šest pruhů s efektivními vahami) + top 5
 * poslanců pod tou čočkou. DOKTRÍNA: vlastní čočka je NEZAMĚNITELNÁ i na
 * kartě — kobaltový řádek „váš index … nejde o zveřejněnou metodiku"; při
 * zveřejněné metodice (či bez parametru) karta ukazuje autoritativní index.
 * Neplatný vektor → poctivá chybová karta, nikdy tichá oprava.
 *
 * Písmo: satori bundluje jen latin subset — česká diakritika by vypadla;
 * podmnožina Archivo + Plex Mono přes Google Fonts, degradace na výchozí
 * písmo bez sítě (týž vzor jako graf precedens).
 */

export const size = { width: 1200, height: 630 };

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
    console.error("[og/referendum] načtení písma selhalo — jede výchozí", err);
    return null;
  }
}

/** Tmavá varianta složkové barvy: inkoust na inkoustu by zmizel. */
const darkFill = (light: string): string => (light === INK ? PAPER : light);

const COMPONENT_SHORT: Record<string, string> = {
  participation: "účast",
  committee: "výbory",
  legislative: "legislativa",
  speech: "vystoupení",
  attendance: "docházka",
  leadership: "vedení",
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get(LENS_PARAM);
  const data = await getLeaderboardListData();
  const card = deriveReferendumCard(data, raw, 5);

  const kicker = "politicas / referendum o metodice";
  const sourcesLine = "zdroj: psp.cz · deterministický výpočet · index přispění 0–100";

  const title =
    card.kind === "invalid"
      ? "Neplatné váhy"
      : card.kind === "nodata"
        ? "Kolik váží dobrý poslanec?"
        : card.kind === "lens"
          ? "Můj index přispění"
          : "Otevřený index přispění";
  const stateLine =
    card.kind === "invalid"
      ? "vektor nesplňuje kodek čočky — nic se tiše neopravuje"
      : card.kind === "nodata"
        ? "nastavte si váhy šesti složek na politicas/referendum"
        : card.kind === "lens"
          ? `váš index — váhy ${card.vector} · nejde o zveřejněnou metodiku`
          : "zveřejněná metodika 25-20-20-15-10-10";

  const rows =
    card.kind === "official" || card.kind === "lens"
      ? card.top.map((r) => ({
          rank: `${czechInt(r.rank)}.${r.tiedCount > 1 ? "=" : ""}`,
          name: r.name,
          club: r.clubAbbrev,
          score: czech(r.score),
        }))
      : [];
  const bars =
    card.kind === "official" || card.kind === "lens"
      ? card.fingerprint.map((fp) => ({
          label: COMPONENT_SHORT[fp.key] ?? fp.key,
          value: czech(fp.eff),
          width: Math.max(6, Math.round(fp.eff * 6)),
          color: darkFill(COMPONENT_FILL[fp.key]?.color ?? STEEL),
          opacity: COMPONENT_FILL[fp.key]?.opacity ?? 1,
        }))
      : [];

  const allText = [
    kicker,
    title,
    stateLine,
    sourcesLine,
    ...rows.flatMap((r) => [r.rank, r.name, r.club, r.score]),
    ...bars.flatMap((b) => [b.label, b.value]),
  ].join("");
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
          padding: "52px 64px",
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
              fontFamily: sans,
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.02,
              textTransform: "uppercase",
              letterSpacing: -1,
              display: "flex",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: card.kind === "lens" ? OCHRE : card.kind === "invalid" ? SIGNAL : HAIRLINE,
              marginTop: 18,
              display: "flex",
            }}
          >
            {stateLine}
          </div>

          {(rows.length > 0 || bars.length > 0) && (
            <div style={{ display: "flex", gap: 56, marginTop: 34 }}>
              {/* otisk vah */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 400 }}>
                {bars.map((b) => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 19,
                        textTransform: "uppercase",
                        color: STEEL,
                        width: 132,
                        display: "flex",
                      }}
                    >
                      {b.label}
                    </div>
                    <div
                      style={{
                        width: b.width,
                        height: 16,
                        backgroundColor: b.color,
                        opacity: b.opacity,
                        display: "flex",
                      }}
                    />
                    <div style={{ fontFamily: mono, fontSize: 19, color: HAIRLINE, display: "flex" }}>{b.value}</div>
                  </div>
                ))}
              </div>
              {/* top 5 pod čočkou */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1 }}>
                {rows.map((r) => (
                  <div key={r.rank + r.name} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                    <div style={{ fontFamily: mono, fontSize: 21, color: STEEL, width: 52, display: "flex" }}>
                      {r.rank}
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 27, fontWeight: 800, display: "flex" }}>{r.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 18, color: STEEL, display: "flex" }}>{r.club}</div>
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 24,
                        // Ochra = řeč čočky na tmavé kartě (kobalt by na
                        // inkoustu nebyl čitelný — týž důvod jako darkFill).
                        color: card.kind === "lens" ? OCHRE : PAPER,
                        marginLeft: "auto",
                        display: "flex",
                      }}
                    >
                      {r.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            borderTop: `3px solid ${STEEL}`,
            paddingTop: 22,
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 22, color: STEEL, display: "flex" }}>{sourcesLine}</div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
