// smlouvy.gov.cz — Registr smluv (ISRS) OPEN-DATA BULK DUMPS.
//
// WHY THIS EXISTS. Money batch 011 proved the graph's contract corpus is a capped
// per-company SAMPLE, not a census: 35 companies sit at exactly 25 `supplies` edges and
// the original money feed's contracts stop in 2019. Every CZK figure in the case is
// therefore a floor. The HTML party-search client (`smlouvy.ts`) can lift one company at
// a time, but it is rate-limited, gives no signature date, and — decisively — carries NO
// direction of money, so a row can as easily be the company paying the state.
//
// The bulk export fixes all three at once. Documented at
// https://smlouvy.gov.cz/stranka/otevrena-data; index at https://data.smlouvy.gov.cz/,
// monthly files `dump_<YYYY>_<MM>.xml` (2016-05 → present, ~26 GB total, ~7–185 MB each).
//
// THREE FACTS ESTABLISHED BY MEASUREMENT (batch 012 — do not re-derive):
//
//  1. **`idSmlouvy` is the graph's contract id.** The existing corpus keys
//     `contract:<n>` on `idSmlouvy`, NOT on the id in the web URL. `<odkaz>` and
//     `/smlouva/<n>` use **`idVerze`**, a different sequence — `idSmlouvy` 1443766 is
//     "Mořidla" (AGROFERT, 2017-03-08, matching the graph node exactly) while `idVerze`
//     1443766 is an unrelated pharmaceutical contract. Keying a re-ingest on the URL id
//     would have silently duplicated the entire corpus. (This also means batch-011's
//     party-search sweep recorded `idVerze` under the name `contractId`.)
//
//  2. **Direction is in the data.** `<subjekt>` (the publishing party) and each
//     `<smluvniStrana>` may carry `<platce>1</platce>` and/or `<prijemce>1</prijemce>`.
//     That is the field the HTML search cannot give, and it is what separates "the state
//     paid this company" from "this company paid the state" — a distinction batch 011
//     found running BOTH ways in the same result set. The flags are optional, so absence
//     is `unknown`, never an assumed direction.
//
//  3. **Values come in three mutually exclusive shapes**: `hodnotaBezDph`,
//     `hodnotaVcetneDph`, and a foreign-currency pair `<ciziMena><mena>/<hodnota>`.
//     They are NOT summable with each other, and a CZK total that mixes them is wrong.
//     Each is parsed into its own field; no coercion, no fallback.
//
// Also carried: `platnyZaznam` (0 = superseded version — the dumps retain both, and a
// count that ignores this over-counts by ~8 %), and `navazanyZaznam` (amendment links).
//
// GDPR — A CONDITION OF USE, NOT A FOOTNOTE. The publisher states that the dataset
// contains personal data and that "Příjemce této datové sady se stává správcem osobních
// údajů", with an explicit obligation to delete records that were later made
// inaccessible (znepřístupněny). Two consequences this module enforces by construction:
// the harvester keeps ONLY records matching an explicit IČO allow-list (so no bulk
// personal-data corpus is retained), and `schvalil` / `datovaSchranka` / `adresa` are
// dropped at parse time — they are not needed for money analysis and one of them is a
// named natural person. Re-harvesting from the current dumps is how deletions propagate.

/** One party to a contract, as the dump records it. */
export interface DumpParty {
  ico: string | null;
  nazev: string;
  /** true only when the record explicitly flags it; absence means unknown, not false. */
  platce: boolean;
  prijemce: boolean;
}

export interface DumpRecord {
  /** THE graph key — `contract:<idSmlouvy>`. Stable across versions of one contract. */
  idSmlouvy: string;
  /** Version id; this is what `/smlouva/<n>` and `<odkaz>` use. */
  idVerze: string;
  odkaz: string | null;
  casZverejneni: string | null;
  /** The publishing party (always a public body or state-owned entity, by law). */
  subjekt: DumpParty | null;
  smluvniStrany: DumpParty[];
  predmet: string;
  /** Signature date — the same semantics as the corpus's existing `signedOn`. */
  datumUzavreni: string | null;
  cisloSmlouvy: string | null;
  hodnotaBezDph: number | null;
  hodnotaVcetneDph: number | null;
  /** Foreign-currency value; never converted to CZK (no rate is published here). */
  ciziMena: { mena: string; hodnota: number } | null;
  /** false = a superseded version of the contract; exclude from counts. */
  platnyZaznam: boolean;
  navazanyZaznam: string[];
}

export interface DumpIndexEntry {
  rok: number;
  mesic: number;
  odkaz: string;
  velikostDumpu: number;
  /** true once the month is closed and no further data is expected. */
  dokoncenyMesic: boolean;
  /** Daily incremental files carry a day in the filename; monthly files do not. */
  isMonthly: boolean;
}

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1] : null;
};

const text = (xml: string, name: string): string | null => {
  const raw = tag(xml, name);
  return raw === null ? null : decodeXml(raw).trim() || null;
};

/** The dumps are plain XML with the standard five predefined entities. */
export function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" does not become "<"
}

/** Numeric fields are plain decimals with a dot. Returns null (never 0) when absent or
 *  unparseable — a missing value is not a zero value. */
function numberOrNull(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseParty(xml: string): DumpParty {
  return {
    ico: text(xml, "ico"),
    nazev: text(xml, "nazev") ?? "",
    // Presence of the element at all is the flag; the value is "1".
    platce: /<platce>\s*1\s*<\/platce>/.test(xml),
    prijemce: /<prijemce>\s*1\s*<\/prijemce>/.test(xml),
  };
}

/** Parse one `<zaznam>…</zaznam>` block. Returns null if it carries no `idSmlouvy`
 *  (malformed) rather than inventing an id. */
export function parseDumpRecord(zaznam: string): DumpRecord | null {
  const idSmlouvy = text(zaznam, "idSmlouvy");
  if (!idSmlouvy) return null;
  const smlouva = tag(zaznam, "smlouva") ?? "";
  const subjektXml = tag(smlouva, "subjekt");
  const strany = [...smlouva.matchAll(/<smluvniStrana>([\s\S]*?)<\/smluvniStrana>/g)].map((m) => parseParty(m[1]));
  const ciziMenaXml = tag(smlouva, "ciziMena");
  const ciziHodnota = ciziMenaXml ? numberOrNull(text(ciziMenaXml, "hodnota")) : null;
  const mena = ciziMenaXml ? text(ciziMenaXml, "mena") : null;

  return {
    idSmlouvy,
    idVerze: text(zaznam, "idVerze") ?? "",
    odkaz: text(zaznam, "odkaz"),
    casZverejneni: text(zaznam, "casZverejneni"),
    subjekt: subjektXml ? parseParty(subjektXml) : null,
    smluvniStrany: strany,
    predmet: text(smlouva, "predmet") ?? "",
    datumUzavreni: text(smlouva, "datumUzavreni"),
    cisloSmlouvy: text(smlouva, "cisloSmlouvy"),
    hodnotaBezDph: numberOrNull(text(smlouva, "hodnotaBezDph")),
    hodnotaVcetneDph: numberOrNull(text(smlouva, "hodnotaVcetneDph")),
    ciziMena: mena && ciziHodnota !== null ? { mena, hodnota: ciziHodnota } : null,
    platnyZaznam: /<platnyZaznam>\s*1\s*<\/platnyZaznam>/.test(zaznam),
    navazanyZaznam: [...zaznam.matchAll(/<navazanyZaznam>([\s\S]*?)<\/navazanyZaznam>/g)]
      .map((m) => text(m[1], "idSmlouvy"))
      .filter((v): v is string => Boolean(v)),
  };
}

/**
 * Which side of the contract a given IČO is on.
 *
 * `recipient` = the register explicitly flags this party as příjemce (or flags the OTHER
 * side as plátce, which entails it for a two-party contract). `payer` is the mirror.
 * Everything else is `unknown` — the flags are optional and roughly half of records omit
 * them, so guessing from "the publisher is a public body" would be exactly the inference
 * batch 011 caught running the wrong way.
 */
export function directionFor(ico: string, rec: DumpRecord): "recipient" | "payer" | "unknown" {
  const sides = [rec.subjekt, ...rec.smluvniStrany].filter((p): p is DumpParty => p !== null);
  const mine = sides.filter((p) => p.ico === ico);
  if (mine.length === 0) return "unknown";
  if (mine.some((p) => p.prijemce)) return "recipient";
  if (mine.some((p) => p.platce)) return "payer";
  // Two-party contract where only the OTHER side is flagged.
  const others = sides.filter((p) => p.ico !== ico);
  if (sides.length === 2 && others.length === 1) {
    if (others[0].platce) return "recipient";
    if (others[0].prijemce) return "payer";
  }
  return "unknown";
}

/** Split a dump body into `<zaznam>` blocks. Exposed so a streaming harvester can feed
 *  it partial buffers without materialising a whole 185 MB file as one string. */
export function splitRecords(xml: string): string[] {
  return [...xml.matchAll(/<zaznam>([\s\S]*?)<\/zaznam>/g)].map((m) => m[1]);
}

/** Which side of a record our allow-listed company sits on. */
export function matchSide(rec: DumpRecord, icos: ReadonlySet<string>): "party" | "publisher" | "none" {
  if (rec.smluvniStrany.some((s) => s.ico && icos.has(s.ico))) return "party";
  if (rec.subjekt?.ico && icos.has(rec.subjekt.ico)) return "publisher";
  return "none";
}

export interface ParseDumpResult {
  /** Records where an allow-listed company is a CONTRACTING PARTY (the non-publishing
   *  side) — the same relation the graph's `supplies` edges model. */
  party: DumpRecord[];
  /** How many records matched only because an allow-listed company was the PUBLISHER.
   *  These are a public body's own contracting activity, which the case never attributes
   *  to a politician (the steward rule), and they dominate the raw match count — a single
   *  regional hospital publishes thousands a month. Counted, not silently dropped. */
  publisherOnly: number;
  /** Publisher-side counts per IČO, so the drop is auditable rather than a bare number. */
  publisherOnlyByIco: Record<string, number>;
}

/** Parse a dump, keeping records touching one of `icos`. The allow-list is required (not
 *  optional) — retaining the full personal-data corpus is exactly what the publisher's
 *  GDPR condition warns against.
 *
 *  `keepPublisherSide` defaults to false: the money question is which of OUR companies
 *  appear as a counterparty, while a match on the publishing side is the institution
 *  acting in its own public mandate. The dropped count is always returned. */
export function parseDump(
  xml: string,
  icos: ReadonlySet<string>,
  opts: { keepPublisherSide?: boolean } = {},
): ParseDumpResult {
  const party: DumpRecord[] = [];
  let publisherOnly = 0;
  const publisherOnlyByIco: Record<string, number> = {};
  for (const block of splitRecords(xml)) {
    // Cheap pre-filter before the expensive per-field parse.
    if (![...block.matchAll(/<ico>(\d+)<\/ico>/g)].some((m) => icos.has(m[1]))) continue;
    const rec = parseDumpRecord(block);
    if (!rec) continue;
    const side = matchSide(rec, icos);
    if (side === "party") party.push(rec);
    else if (side === "publisher") {
      if (opts.keepPublisherSide) party.push(rec);
      else {
        publisherOnly++;
        const ico = rec.subjekt?.ico ?? "(unknown)";
        publisherOnlyByIco[ico] = (publisherOnlyByIco[ico] ?? 0) + 1;
      }
    }
  }
  return { party, publisherOnly, publisherOnlyByIco };
}

/** Parse the index at https://data.smlouvy.gov.cz/ into typed entries. */
export function parseDumpIndex(xml: string): DumpIndexEntry[] {
  return [...xml.matchAll(/<dump>([\s\S]*?)<\/dump>/g)].flatMap((m) => {
    const body = m[1];
    const odkaz = text(body, "odkaz");
    const rok = numberOrNull(text(body, "rok"));
    const mesic = numberOrNull(text(body, "mesic"));
    if (!odkaz || rok === null || mesic === null) return [];
    return [
      {
        rok,
        mesic,
        odkaz,
        velikostDumpu: numberOrNull(text(body, "velikostDumpu")) ?? 0,
        dokoncenyMesic: text(body, "dokoncenyMesic") === "1",
        // dump_2026_07.xml is monthly; dump_2026_07_07.xml is a daily increment whose
        // contents are a subset — harvesting both would double-count.
        isMonthly: /dump_\d{4}_\d{2}\.xml$/.test(odkaz),
      },
    ];
  });
}
