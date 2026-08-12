// Shared whitelists + tiny formatters for the LawWatch surfaces (browser list,
// per-bill dossier). Split out of LawWatchPage.tsx so the dossier route
// (features/lawwatch/BillDossierPage.tsx) doesn't need to import the whole
// (large, mock-carrying) page component just for these constants.
//
// Bilingual pass: the former *_CZ label maps became key WHITELISTS — the label
// itself lives in messages/*.json under `lawwatch.*` (origin, severity,
// committeeRole, committeeStatus, diffOp, sponsorRole, rapporteurScope,
// citationKind) and is resolved via next-intl `t()` at the render site. The
// whitelist preserves the old `?? raw` fallback: an unknown raw token renders
// verbatim instead of producing a missing-key path.

/** assigned_to.props.role tokens with a `lawwatch.committeeRole.*` label (F15). */
export const COMMITTEE_ROLE_KEYS: ReadonlySet<string> = new Set(["garancni", "dalsi"]);

/** assigned_to.props.status tokens with a `lawwatch.committeeStatus.*` label. */
export const COMMITTEE_STATUS_KEYS: ReadonlySet<string> = new Set(["prikazano", "navrzeno", "iniciativne"]);

/** Forensic severity tokens with a `lawwatch.severity.*` label. */
export const SEVERITY_KEYS: ReadonlySet<string> = new Set(["low", "medium", "high"]);

/** §-diff op tokens with a `lawwatch.diffOp.*` label. */
export const DIFF_OP_KEYS: ReadonlySet<string> = new Set(["modified", "added", "removed"]);

/** Signature-role tokens (pass 34) with a `lawwatch.sponsorRole.*` label. */
export const SPONSOR_ROLE_KEYS: ReadonlySet<string> = new Set(["predkladatel", "spolupodepsal"]);

/** Zpravodaj scope tokens (pass 34) with a `lawwatch.rapporteurScope.*` label. */
export const RAPPORTEUR_SCOPE_KEYS: ReadonlySet<string> = new Set([
  "zpravodaj_ov",
  "zpravodaj_ps",
  "zpravodaj_vyboru",
  "zpravodaj_dokumentu",
]);

/** Citation kind tokens with a `lawwatch.citationKind.*` label. */
export const CITATION_KIND_KEYS: ReadonlySet<string> = new Set(["bill_text", "web", "law", "graph_fact"]);

/** Sector tokens (batch-017 sector-attribution payload) with a `lawwatch.sector.*` label.
 * scripts/case-loops/law/company-sectors.ts's `Sector` type carries more values than the
 * payload actually uses — only the ones present get a label; an unmapped one renders
 * verbatim and labelled untranslated at the render site (the tieFlags.ts precedent). */
export const SECTOR_KEYS: ReadonlySet<string> = new Set(["economy", "environment", "agriculture", "digital", "health"]);

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
export const pspBillUrl = (cislo: number | null): string | null =>
  cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null;

/** e-Sbírka — kanonická stránka zákona podle „č. N/RRRR Sb." (shodně s lib/kg/sourceLinks.ts). */
export function esbirkaUrl(ref: string): string | null {
  const m = ref.match(/(\d+)\s*\/\s*(\d{4})/);
  return m ? `https://e-sbirka.gov.cz/sb/${m[2]}/${m[1]}` : null;
}

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

// Kompaktní CZK tady BÝVALA (`czkCompact`) — vlastní kopie `formatCompactCzk`
// z lib/format.ts, a jediná nesankcionovaná v repozitáři. Byla měřitelně jiná:
// zápornou částku neseskupila (`-5000000 Kč`) a nekonečno/NaN pustila do
// výstupu jako „NaN Kč", což deriveRadar.ts publikoval do VEŘEJNÝCH feedů
// /zakony/kolize. Smazána 2026-08-12; oba volající čtou kanonický formátovač
// (`czkCompact` je zároveň jméno citovatelného DRUHU v lib/format.ts, takže
// druhá funkce téhož jména byla i pojmenovaná past).
