// Model navigace aplikace — jedno místo, kde je napsané „co jsou moduly"
// a „co je uvnitř téhle stránky".
//
// Sekce nejsou odvozené z DOM ani z názvů komponent: jsou to deklarované
// kotvy (`id` na <section>) plus klíč do i18n. Popisky se schválně berou
// z UŽ EXISTUJÍCÍCH klíčů jednotlivých modulů — kdyby si navigace držela
// vlastní kopii titulků, po první úpravě stránky by se rozešly.

/** Kotva uvnitř stránky — `id` na <section> + i18n klíč od kořene katalogu. */
export interface NavSection {
  id: string;
  labelKey: string;
}

/** Reálná podstránka modulu (ne kotva — vlastní route). */
export interface NavChild {
  href: string;
  labelKey: string;
}

export interface NavEntry {
  /** `overview` nebo klíč modulu z MODULES. */
  key: string;
  href: string;
  /** Jen pro velín; moduly nesou jméno značky z MODULES. */
  labelKey?: string;
  children: NavChild[];
}

/** Řádky levé lišty. Pořadí = pořadí modulů v MODULES, velín napřed. */
export const NAV: NavEntry[] = [
  {
    key: "overview",
    href: "/dashboard",
    labelKey: "nav.overview",
    children: [{ href: "/graf", labelKey: "nav.children.graf" }],
  },
  { key: "civic-score", href: "/zebricek", children: [] },
  { key: "vote-track", href: "/hlasovani", children: [] },
  {
    key: "follow-the-money",
    href: "/penize",
    children: [
      { href: "/penize/kauzy", labelKey: "nav.children.kauzy" },
      { href: "/penize/kontrola", labelKey: "nav.children.kontrola" },
    ],
  },
  { key: "budget-mirror", href: "/rozpocty", children: [] },
  {
    key: "law-watch",
    href: "/zakony",
    children: [{ href: "/zakony/kolize", labelKey: "nav.children.kolize" }],
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

/** Modul, pod který cesta patří — spis poslance visí pod žebříčkem. */
export function entryFor(pathname: string): NavEntry | undefined {
  if (pathname.startsWith("/poslanec")) return NAV.find((e) => e.key === "civic-score");
  return NAV.filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
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
