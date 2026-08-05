/*
 * Copy panelu „Vývoj proti minulému období" (TrendPanel) — PURE, bez Reactu.
 *
 * PROČ TENHLE SOUBOR EXISTUJE: až do 2026-08-04 stály všechny čtyři věty tohohle
 * panelu jako inline literály přímo v JSX — jediná čtenářská kopie v /poslanec,
 * která nepatřila žádnému enginu a nebyla přibitá k jazykové bráně. Přesně tahle
 * třída textu už třikrát dojela na plochu anglicky
 * (memory/reader-facing-loaders-need-the-language-gate.md). Verdiktní copy má
 * svůj engine v lib/analysis/*; tenhle panel teď taky.
 *
 * Věta o chybějících složkách navíc VYJMENOVÁVÁ, co doopravdy chybí a co je
 * srovnatelné — dřív tvrdila „Účast při hlasování a docházka" bez ohledu na to,
 * co `trend.pendingComponents` skutečně nese, takže jiná neúplná složka by se
 * ohlásila jménem dvou jiných.
 *
 * Přibito trendCopy.test.ts (jazyková brána + chování na hranicích).
 */

/** Dump, který chybějící složky odemkne — jmenuje se JEN pro období, kterého se týká. */
const PRIOR_TERM_VOTE_DUMP: Record<string, string> = {
  PSP9: "hl-2021ps.zip",
};

/**
 * Dump pro dané období, nebo null — datový přístup pro TrendPanel, který od
 * migrace na dvoujazyčné katalogy (2026-08-05) skládá věty přes next-intl
 * (klíče civicscore.trend*). České buildery níže zůstávají jako testy přibitá
 * referenční kopie (trendCopy.test.ts) do centrální konsolidace.
 */
export function priorTermVoteDump(priorTerm: string): string | null {
  return PRIOR_TERM_VOTE_DUMP[priorTerm] ?? null;
}

/** Nadpis panelu. */
export function trendHeading(priorTerm: string): string {
  return `Vývoj proti období ${priorTerm}`;
}

/** Odznak nad panelem, když minulé období není kompletní. */
export const TREND_PARTIAL_LABEL = "částečné srovnání";

/** Popisky tří surových počtů (objem práce), v pořadí, v jakém se tisknou. */
export const TREND_COUNT_LABELS = {
  billsAuthored: "Tisky (spolu)autorské",
  speechTurns: "Vystoupení v sále",
  committeeCount: "Výbory a komise",
} as const;

/**
 * Věta o složkách, které za minulé období zatím nemáme. Null, když nechybí nic —
 * panel pak žádnou výhradu netiskne.
 *
 * `pendingLabels` / `comparableLabels` jsou LABELY složek (tytéž, které panel
 * vykresluje v řádcích), ne klíče — sestavuje je volající z componentLabels.
 */
export function trendPendingNote(args: {
  priorTerm: string;
  pendingLabels: readonly string[];
  comparableLabels: readonly string[];
}): string | null {
  const { priorTerm, pendingLabels, comparableLabels } = args;
  if (pendingLabels.length === 0) return null;

  const dump = PRIOR_TERM_VOTE_DUMP[priorTerm];
  // Labely složek jsou velkým písmenem („Docházka"); uvnitř věty se snižují všechny
  // kromě prvního, jinak vznikne „Účast při hlasování a Docházka".
  const missing = joinCzech(pendingLabels.map((l, i) => (i === 0 ? l : lower(l))));
  const head =
    `${missing} za období ${priorTerm} se zobrazí po doingestování jmenných hlasování ${priorTerm}` +
    (dump ? ` (dump ${dump})` : "");
  const tail =
    comparableLabels.length > 0
      ? ` — teď je srovnatelné jen tohle: ${joinCzech(comparableLabels.map(lower))}.`
      : " — zatím není srovnatelná žádná složka.";
  return head + tail;
}

/**
 * Citace zdroje pod panelem. `pass` je průchod grafu, který minulé období zapsal —
 * když ho data nenesou, věta o něm mlčí (nikdy se nevymýšlí číslo).
 */
export function trendSourceNote(priorTerm: string, pass?: number | null): string {
  const base = `Zdroj: psp.cz · členství ve výborech + tisky/interpelace/stenozáznamy ${priorTerm}`;
  return typeof pass === "number" && Number.isFinite(pass) ? `${base} · průchod grafu ${pass}` : base;
}

/** První písmeno malé (uvnitř věty) — `toLocaleLowerCase("cs")` kvůli Ch/CH a diakritice. */
function lower(s: string): string {
  return s.length > 0 ? s[0].toLocaleLowerCase("cs") + s.slice(1) : s;
}

/** „a, b a c" — česká výčtová spojka; jednoprvkový výčet zůstane holý. */
function joinCzech(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} a ${items[items.length - 1]}`;
}
