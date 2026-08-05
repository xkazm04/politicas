// Model navigace aplikace — jedno místo, kde je napsané „co jsou moduly"
// a „co je uvnitř téhle stránky".
//
// Sekce nejsou odvozené z DOM ani z názvů komponent: jsou to deklarované
// kotvy (`id` na <section>) plus klíč do i18n. Popisky se schválně berou
// z UŽ EXISTUJÍCÍCH klíčů jednotlivých modulů — kdyby si navigace držela
// vlastní kopii titulků, po první úpravě stránky by se rozešly.
//
// ── REORGANIZACE PO ŠESTI DÁVKÁCH (moonshot 7A) ─────────────────────────────
// Dávky 1–6 přinesly plochy, na které rail nevedl. Strom teď drží:
//   – pět modulů (žebříček, hlasování, peníze, rozpočty, zákony) + velín,
//   – „Schránka" — osobní civic inbox (sledované entity, moonshot 7A),
//   – shluk „Záznam" — evidenční jádro platformy (deník, důkazy, datové
//     verze, atlas kvality, ověření citace + referendum o metodice dle
//     koordinace dávky 7),
//   – /kompas a /kraj vytažené k modulům čtenáře volební sezóny.
// Plochy ZÁMĚRNĚ nevypsané (deep-link produkty) drží UNLISTED_ROUTES níž —
// test úplnosti (navModel.test.ts) hlídá, že žádná veřejná routa nevypadne
// z obou seznamů zároveň.
//
// Popisky nových řádků byly původně česky přímo tady (`labelCs`/`tagCs`) —
// precedens /denik (3A). Rozhodnutí „launch bilingual“ ten precedens ruší:
// všechny popisky railu jdou z katalogu messages/*.json (`nav.entries.*`,
// `nav.children.*`), aby se levá lišta vykreslila celá v cs I en.

/** Kotva uvnitř stránky — `id` na <section> + i18n klíč od kořene katalogu. */
export interface NavSection {
  id: string;
  labelKey: string;
}

/** Reálná podstránka modulu (ne kotva — vlastní route). Popisek je vždy klíč
 *  do katalogu (od bilingvního launche žádné české literály v modelu). */
export interface NavChild {
  href: string;
  labelKey: string;
}

export interface NavEntry {
  /** `overview`, klíč modulu z MODULES, nebo klíč řádku mimo moduly (schranka, zaznam). */
  key: string;
  href: string;
  /** Pro velín a řádky mimo katalog modulů; moduly nesou jméno značky z MODULES. */
  labelKey?: string;
  /** Podtitulek řádku pro řádky s labelKey mimo moduly (moduly ho berou z katalogu obsahu). */
  tagKey?: string;
  children: NavChild[];
}

/** Řádky levé lišty. Pořadí: velín → schránka → záznam → moduly (pořadí MODULES). */
export const NAV: NavEntry[] = [
  {
    key: "overview",
    href: "/dashboard",
    labelKey: "nav.overview",
    children: [{ href: "/graf", labelKey: "nav.children.graf" }],
  },
  {
    key: "schranka",
    href: "/schranka",
    labelKey: "nav.entries.schranka.label",
    tagKey: "nav.entries.schranka.tag",
    children: [],
  },
  {
    key: "zaznam",
    href: "/denik",
    labelKey: "nav.entries.zaznam.label",
    tagKey: "nav.entries.zaznam.tag",
    children: [
      { href: "/dukazy", labelKey: "nav.children.dukazy" },
      { href: "/data", labelKey: "nav.children.data" },
      { href: "/atlas", labelKey: "nav.children.atlas" },
      { href: "/overeni", labelKey: "nav.children.overeni" },
      // Koordinace dávky 7: referendum o metodice (7B) patří do shluku Záznam.
      { href: "/referendum", labelKey: "nav.children.referendum" },
    ],
  },
  {
    key: "civic-score",
    href: "/zebricek",
    children: [
      { href: "/kraj", labelKey: "nav.children.kraj" },
      // Metodika indexu (2026-08-04) — vzorec vykreslený z lib/analysis/contribution.ts.
      // Patří pod žebříček: je to jeho vlastní pravidlo, ne samostatný modul.
      { href: "/metodika", labelKey: "nav.children.metodika" },
    ],
  },
  {
    key: "vote-track",
    href: "/hlasovani",
    children: [{ href: "/kompas", labelKey: "nav.children.kompas" }],
  },
  {
    key: "follow-the-money",
    href: "/penize",
    children: [
      { href: "/penize/kauzy", labelKey: "nav.children.kauzy" },
      { href: "/penize/kontrola", labelKey: "nav.children.kontrola" },
      { href: "/penize/strety", labelKey: "nav.children.strety" },
    ],
  },
  { key: "budget-mirror", href: "/rozpocty", children: [] },
  {
    key: "law-watch",
    href: "/zakony",
    children: [
      { href: "/zakony/kolize", labelKey: "nav.children.kolize" },
      { href: "/zakony/predpis", labelKey: "nav.children.predpis" },
    ],
  },
];

/**
 * Plochy ZÁMĚRNĚ mimo rail — každá s vypsaným důvodem. Test úplnosti
 * (navModel.test.ts) bere tenhle seznam jako jediné povolené „nevypsáno":
 * nová routa, která není ani v NAV, ani tady, test shodí — rozhodnutí
 * o (ne)vypsání musí být vždy VĚDOMÉ.
 */
export const UNLISTED_ROUTES: { route: string; reason: string }[] = [
  { route: "/", reason: "landing — vlastní plakátová hlavička, mimo aplikační chrom (isBareRoute)" },
  { route: "/admin", reason: "provozní konzole — není veřejný produkt, rail ji nenabízí" },
  {
    route: "/rentgen",
    reason:
      "noindex press terminál (7C) — odkazuje se z kontextů „pro novináře“, do hlavního railu nepatří (koordinace dávky 7)",
  },
  {
    route: "/svedectvi",
    reason: "referenční ukázka citovatelného formátování — deep-link z dokumentace čísel, ne cíl navigace",
  },
  { route: "/zdroj/[ref]", reason: "trvalá adresa účtenky původu — deep-link z citací, bez indexové stránky" },
  {
    route: "/ochrana-osobnich-udaju",
    reason: "právní dokument (GDPR) — odkaz z patičky, ne cíl navigace railu",
  },
  { route: "/podminky", reason: "právní dokument (podmínky užití) — odkaz z patičky, ne cíl navigace railu" },
  { route: "/plakat/[view]", reason: "tiskové plakátové pohledy — deep-link z ploch (PosterToolbar), ne cíl navigace" },
  {
    route: "/poslanec/[id]",
    reason: "spis poslance — vede na něj žebříček, deník i graf; index spisů JE žebříček (/zebricek)",
  },
];

/**
 * Kotvy na stránce, podle route. Deklarované jsou jen plochy, které kotvy
 * skutečně mají — podstránky (kauzy, kontrola, kolize, detailní spisy) je
 * zatím nemají a lišta pro ně blok „na této stránce" prostě nevykreslí.
 */
export const PAGE_SECTIONS: Record<string, NavSection[]> = {
  "/dashboard": [
    { id: "graf", labelKey: "nav.sections.graf" },
    { id: "provoz", labelKey: "nav.sections.provoz" },
    { id: "zebricek", labelKey: "nav.sections.zebricek" },
  ],
  "/zebricek": [
    { id: "rozlozeni", labelKey: "civicscore.distributionTitle" },
    { id: "souboj", labelKey: "civicscore.duelTitle" },
    { id: "vsichni", labelKey: "civicscore.allTitle" },
  ],
  "/hlasovani": [
    { id: "denik", labelKey: "votetrack.section1Title" },
    { id: "linie", labelKey: "votetrack.section2Title" },
    { id: "rebelie", labelKey: "votetrack.section3Title" },
    { id: "temata", labelKey: "votetrack.section4Title" },
  ],
  "/penize": [
    { id: "graf", labelKey: "money.sections.graph.title" },
    { id: "kniha", labelKey: "money.sections.ledger.title" },
    { id: "metodika", labelKey: "money.sections.method.title" },
  ],
  "/rozpocty": [
    { id: "zrcadlo", labelKey: "budget.section1Title" },
    { id: "dluh", labelKey: "budget.section2Title" },
    { id: "skupina", labelKey: "budget.section3Title" },
  ],
  "/zakony": [
    { id: "tisky", labelKey: "lawwatch.realSection1Title" },
    { id: "zakony", labelKey: "lawwatch.realSection2Title" },
  ],
  "/poslanec": [
    { id: "slozky", labelKey: "profile.componentsHeading" },
    // Peněžní vazby se vykreslují VŽDY (i jako čestný prázdný stav), takže kotva
    // nikdy nevede do prázdna — na rozdíl od podmíněného pracovního profilu.
    { id: "penize", labelKey: "profile.moneyHeading" },
    { id: "spojenci", labelKey: "profile.alliesHeading" },
    { id: "rebelie", labelKey: "profile.rebellionsHeading" },
    { id: "vybory", labelKey: "profile.committeesHeading" },
  ],
};

/**
 * Kotvy pro danou cestu. Shoda je přesná, s jedinou výjimkou pro spis
 * poslance (/poslanec/<id>) — podstránky modulů vlastní kotvy nemají a
 * zdědit ty rodičovské by znamenalo nabídnout odkazy do prázdna.
 */
export function sectionsFor(pathname: string): NavSection[] {
  if (PAGE_SECTIONS[pathname]) return PAGE_SECTIONS[pathname];
  if (pathname.startsWith("/poslanec/")) return PAGE_SECTIONS["/poslanec"];
  return [];
}

const matchesPrefix = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Modul, pod který cesta patří — spis poslance visí pod žebříčkem. Podstránky
 * se od reorganizace 7A NEMUSÍ jmenovat po rodiči (kompas visí pod
 * hlasováním, kraj pod žebříčkem, důkazy pod záznamem) — patří tam, kde jsou
 * vypsané jako `children`; prefixová shoda s hrefem řádku je až druhé kolo.
 */
export function entryFor(pathname: string): NavEntry | undefined {
  if (pathname.startsWith("/poslanec")) return NAV.find((e) => e.key === "civic-score");
  const byChild = NAV.filter((e) => e.children.some((c) => matchesPrefix(pathname, c.href)));
  if (byChild.length > 0) return byChild[0];
  return NAV.filter((e) => matchesPrefix(pathname, e.href)).sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Plochy bez aplikační navigace: landing (má vlastní), admin, archiv Rentgen
 * a plátno grafu — to potřebuje celou šířku okna pro kompozici vlastních
 * lišt kolem plátna (rozhodnutí kola 4, 2026-07-26); zpět vede drobeček
 * v jeho hlavičce.
 */
export function isBareRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/rentgen" ||
    pathname.startsWith("/rentgen/") ||
    pathname === "/graf" ||
    pathname.startsWith("/graf/")
  );
}
