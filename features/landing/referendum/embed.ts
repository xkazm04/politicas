// Vestavný widget žebříčku (moonshot 7B) — čistý builder samostatného HTML
// dokumentu pro app/embed/zebricek. Widget je iframe-safe: žádný skript,
// žádný externí zdroj, inline styly z tokenů palety (features/landing/
// palette.ts — jediný sankcionovaný zrcadlový bod tokenů mimo globals.css).
// Testy: embed.test.ts (bezpečnost parametru, escapování, poctivé stavy).
//
// BEZPEČNOST PARAMETRU: surová hodnota `?vahy=` se do výstupu NIKDY neotiskne.
// Vysází se jen kanonický vektor znovu-serializovaný z DEKÓDOVANÝCH vah
// (deriveReferendumCard → serializeWeights), takže markup nenese žádný
// útočníkem řízený řetězec. Jména a kluby z grafu se přesto escapují —
// obranná hloubka, ne důvěra.
//
// CITACE JE POVINNÁ SOUČÁST WIDGETU: každý stav (i chybový) nese řádek
// „zdroj: politicas" s odkazem na plný žebříček — widget bez citace by byl
// nástroj na vytrhávání čísel z kontextu.

import { czech, czechDate, czechInt } from "@/lib/format";
import { COBALT, HAIRLINE, INK, PAPER, SIGNAL, STEEL } from "@/features/landing/palette";
import { deriveReferendumCard, type StandingsInput } from "./ogPayload";

export interface EmbedResult {
  html: string;
  /** 200 pro poctivé stavy (oficiální/čočka/bez dat), 400 pro neplatný vektor. */
  status: 200 | 400;
}

/** Minimální HTML escapování — vše, co pochází z dat, jde skrz. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const FONT_MONO = `"IBM Plex Mono", ui-monospace, monospace`;
const FONT_SANS = `Archivo, system-ui, sans-serif`;

function shell(body: string, title: string): string {
  // Barvy: konstanty z palette.ts (tokeny), žádný literál zde.
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${PAPER}; color: ${INK}; font-family: ${FONT_SANS}; }
  .w { border: 2px solid ${INK}; margin: 8px; }
  .head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline;
          border-bottom: 2px solid ${INK}; padding: 10px 12px; }
  .kicker { font-family: ${FONT_MONO}; font-size: 10px; letter-spacing: 2px;
            text-transform: uppercase; color: ${STEEL}; }
  h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; }
  .lens { background: ${COBALT}; color: ${PAPER}; font-family: ${FONT_MONO}; font-size: 10px;
          letter-spacing: 1px; text-transform: uppercase; padding: 5px 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 12px; font-size: 13px; text-align: left; }
  tr + tr td { border-top: 1px solid ${HAIRLINE}; }
  .r { font-family: ${FONT_MONO}; font-size: 11px; color: ${STEEL}; white-space: nowrap; }
  .s { font-family: ${FONT_MONO}; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .s.custom { color: ${COBALT}; }
  .club { font-family: ${FONT_MONO}; font-size: 10px; text-transform: uppercase; color: ${STEEL}; }
  .err { padding: 14px 12px; font-size: 13px; }
  .err b { color: ${SIGNAL}; text-transform: uppercase; }
  .foot { border-top: 2px solid ${INK}; padding: 8px 12px; font-family: ${FONT_MONO};
          font-size: 10px; letter-spacing: 0.5px; color: ${STEEL}; }
  .foot a { color: ${INK}; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * ŘÁDEK „STAV K" DATUJE DATA, NE VYSAZENÍ WIDGETU.
 *
 * Do 2026-08-12 tu stálo `czechDate(generatedAt)`, tedy `new Date()` route
 * handleru: každé načtení widgetu inzerovalo dnešek nad žebříčkem, který je
 * artefakt dávkového přepočtu — čtenář dostal čerstvost, kterou data nemají.
 * Datum přepočtu je `contribution_provenance.computedAt` a agregát ho vydá jen
 * tehdy, když se na jednom dni shodne CELÁ komora nad jedním `{pass, ref}`
 * (features/civicscore/provenance.ts). Když se neshodne — půlkou přepočtená
 * komora, chybějící razítko, nedostupný žebříček — widget to řekne a datum
 * nehádá. Čas vysazení zůstává vedle, pojmenovaný jako to, čím je.
 */
function statusLine(data: StandingsInput | null, generatedAt: string): string {
  const prov = data?.provenance ?? null;
  const rendered = `vysazeno ${czechDate(generatedAt)}`;
  if (!prov || prov.computedAt === null) {
    return `datum přepočtu indexu graf neuvádí jednotně · ${rendered}`;
  }
  const pass = prov.pass !== null ? `, průchod č. ${czechInt(prov.pass)}` : "";
  return `stav k ${czechDate(prov.computedAt)} (přepočet indexu${pass}) · ${rendered}`;
}

function footer(origin: string, href: string, status: string): string {
  const url = `${origin}${href}`;
  return `<div class="foot">zdroj: <a href="${escapeHtml(url)}" target="_blank" rel="noopener">politicas — otevřený index přispění</a> · psp.cz, deterministický výpočet · ${escapeHtml(status)}</div>`;
}

/**
 * Celý widget: žebříček + surový `?vahy=` → hotový HTML dokument + status.
 * `origin` je počátek adresy nasazení (z požadavku), `generatedAt` ISO čas
 * vysazení (parametr kvůli determinismu testů).
 */
export function buildEmbedHtml(input: {
  data: StandingsInput | null;
  rawVahy: string | null;
  origin: string;
  generatedAt: string;
  /** Počet řádků (výchozí 10, mez 3–25). */
  rows?: number;
}): EmbedResult {
  const { data, rawVahy, origin, generatedAt } = input;
  const rows = Math.max(3, Math.min(25, input.rows ?? 10));
  const card = deriveReferendumCard(data, rawVahy, rows);
  const status = statusLine(data, generatedAt);

  if (card.kind === "invalid") {
    // Surový parametr se záměrně NEOTISKUJE — ani escapovaný (adresa je
    // tvrzení; neplatné tvrzení se odmítá, ne cituje).
    const body = `<div class="w">
<div class="head"><div><div class="kicker">politicas / vestavný žebříček</div><h1>Neplatné váhy</h1></div></div>
<div class="err"><b>chyba parametru.</b> Parametr <code>vahy</code> nesplňuje kodek čočky — šest celých čísel 0–100 oddělených pomlčkou (např. 40-5-10-5-35-5). Nic se tiše neopravuje.</div>
${footer(origin, "/referendum", status)}
</div>`;
    return { html: shell(body, "politicas — neplatné váhy"), status: 400 };
  }

  if (card.kind === "nodata") {
    const body = `<div class="w">
<div class="head"><div><div class="kicker">politicas / vestavný žebříček</div><h1>Záznam teď není k dispozici</h1></div></div>
<div class="err">Žebříček se nepodařilo načíst ze znalostního grafu — widget nikdy neukazuje náhradní čísla.</div>
${footer(origin, "/zebricek", status)}
</div>`;
    return { html: shell(body, "politicas — žebříček nedostupný"), status: 200 };
  }

  const custom = card.kind === "lens";
  const lensStrip = custom
    ? `<div class="lens">váš index — váhy ${escapeHtml(card.vector)} · nejde o zveřejněnou metodiku</div>`
    : "";
  const trs = card.top
    .map((r) => {
      const rank = r.tiedCount > 1 ? `${czechInt(r.rank)}.=` : `${czechInt(r.rank)}.`;
      return `<tr><td class="r">${escapeHtml(rank)}</td><td>${escapeHtml(r.name)} <span class="club">${escapeHtml(r.clubAbbrev)}</span></td><td class="s${custom ? " custom" : ""}">${escapeHtml(czech(r.score))}</td></tr>`;
    })
    .join("\n");
  const href = custom ? `/zebricek?vahy=${card.vector}` : "/zebricek";
  const title = custom
    ? `politicas — žebříček pod vahami ${card.vector}`
    : "politicas — otevřený index přispění";
  const body = `<div class="w">
<div class="head">
  <div><div class="kicker">politicas / ${custom ? "čtenářova čočka" : "zveřejněná metodika"}</div>
  <h1>Index přispění — top ${czechInt(card.top.length)} z ${czechInt(card.count)}</h1></div>
</div>
${lensStrip}
<table>${trs}</table>
${footer(origin, href, status)}
</div>`;
  return { html: shell(body, title), status: 200 };
}
