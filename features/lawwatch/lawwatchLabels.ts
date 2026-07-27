// Shared Czech labels + tiny formatters for the LawWatch surfaces (browser list,
// per-bill dossier). Split out of LawWatchPage.tsx so the dossier route
// (features/lawwatch/BillDossierPage.tsx) doesn't need to import the whole
// (large, mock-carrying) page component just for these constants.
//
// Inline Czech literals (not next-intl `t()`) — same precedent as
// features/civicscore/components/LeaderboardTable.tsx's "Tiší pracanti" filter:
// messages/*.json is off-boundary for this pass; proposed keys are listed in the
// batch report for the orchestrator to fold in.

import type { BillOrigin } from "./getLawData";

/** Původ tisku (bill.props.origin) → český štítek. */
export const ORIGIN_CZ: Record<BillOrigin, string> = {
  government: "vládní návrh",
  mp: "poslanecký návrh",
  mp_group: "skupina poslanců",
  senate: "senátní návrh",
  other: "jiný návrh",
};

export const SEVERITY_CZ: Record<string, string> = {
  low: "nízká",
  medium: "střední",
  high: "vysoká",
};

/** assigned_to.props.role → český štítek (F15 formální přikázání výborům). */
export const ROLE_CZ: Record<string, string> = {
  garancni: "garanční výbor",
  dalsi: "další výbor",
};

/** assigned_to.props.status → český štítek (nejsilnější dosažený stav přikázání). */
export const STATUS_CZ: Record<string, string> = {
  prikazano: "přikázáno",
  navrzeno: "navrženo",
  iniciativne: "projednáno iniciativně",
};

export const DIFF_OP_CZ: Record<string, string> = { modified: "změněno", added: "přidáno", removed: "zrušeno" };

/** Signature role on the predkladatel list (pass 34): rank 1 vs the rest. */
export const SPONSOR_ROLE_CZ: Record<string, string> = {
  predkladatel: "předložil",
  spolupodepsal: "spolupodepsal",
};

/** Zpravodaj assignment scopes (pass 34, psp.cz tisky.zip hist/hist_vybory/tisky_za). */
export const RAPPORTEUR_SCOPE_CZ: Record<string, string> = {
  zpravodaj_ov: "zpravodaj pro 1. čtení",
  zpravodaj_ps: "zpravodaj (určen předsedou PS)",
  zpravodaj_vyboru: "zpravodaj výboru",
  zpravodaj_dokumentu: "zpravodaj usnesení výboru",
};

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
export const pspBillUrl = (cislo: number | null): string | null =>
  cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null;

/** e-Sbírka — kanonická stránka zákona podle „č. N/RRRR Sb." (shodně s lib/kg/sourceLinks.ts). */
export function esbirkaUrl(ref: string): string | null {
  const m = ref.match(/(\d+)\s*\/\s*(\d{4})/);
  return m ? `https://e-sbirka.gov.cz/sb/${m[2]}/${m[1]}` : null;
}

/** Druh citace → český štítek pro seznam referencí. */
export const CITATION_KIND_CZ: Record<string, string> = {
  bill_text: "text tisku",
  web: "web",
  law: "zákon",
  graph_fact: "záznam v grafu",
};

/** Formátovaná reference — nikdy serializovaný objekt.
 *
 * `registry` je vlastní jméno rejstříku (psp.cz, e-Sbírka), `label` čitelné označení
 * zdroje a `url` odkaz, pokud ho z uloženého identifikátoru lze poctivě sestavit.
 * Když odkaz sestavit nelze (graph_fact — urn uzlu nemá veřejnou stránku), vrací se
 * `url: null` a plocha ukazuje jen čitelný identifikátor. Nikdy se nehádá. */
export interface CitationRef {
  registry: string;
  label: string;
  url: string | null;
}

const HOST_LABEL: Record<string, string> = {
  "www.psp.cz": "psp.cz",
  "psp.cz": "psp.cz",
  "e-sbirka.gov.cz": "e-Sbírka",
  "www.e-sbirka.cz": "e-Sbírka",
  "mf.gov.cz": "Ministerstvo financí",
  "eur-lex.europa.eu": "EUR-Lex",
  "cs.wikipedia.org": "Wikipedie",
};

/** Čitelný název uzlu grafu pro citaci typu graph_fact („firma IČO 26185610"). */
function graphFactLabel(source: string): string {
  const ico = source.match(/^company:ico:(\d+)$/);
  if (ico) return `firma IČO ${ico[1]}`;
  const person = source.match(/^psp:person:(\d+)$/);
  if (person) return `poslanec psp id ${person[1]}`;
  const bill = source.match(/^bill:tisk:(\d+)$/);
  if (bill) return `sněmovní tisk (uzel ${bill[1]})`;
  const law = source.match(/^law:sb:(\d+)-(\d{4})$/);
  if (law) return `zákon č. ${law[1]}/${law[2]} Sb.`;
  return source;
}

export function citationRef(kind: string, source: string): CitationRef {
  if (/^https?:\/\//.test(source)) {
    let host = "";
    try {
      host = new URL(source).hostname;
    } catch {
      host = "";
    }
    const registry = HOST_LABEL[host] ?? host.replace(/^www\./, "");
    const isPsp = host.endsWith("psp.cz");
    const tisk = isPsp ? source.match(/[?&](?:t|ct)=(\d+)/) : null;
    return {
      registry: registry || "web",
      label: tisk ? `sněmovní tisk ${tisk[1]}` : kind === "bill_text" ? "text tisku" : registry || source,
      url: source,
    };
  }
  if (kind === "law") {
    const m = source.match(/(\d+)\s*\/\s*(\d{4})/);
    return {
      registry: "e-Sbírka",
      label: m ? `zákon č. ${m[1]}/${m[2]} Sb.` : source,
      url: esbirkaUrl(source),
    };
  }
  return { registry: "graf", label: graphFactLabel(source), url: null };
}

/** Kompaktní CZK: 5 397 460 397 → „5,4 mld. Kč". */
export function czkCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} mld. Kč`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} mil. Kč`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} tis. Kč`;
  return `${n} Kč`;
}
