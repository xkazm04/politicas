/*
 * ČERSTVOST VELÍNU — jedno místo, kde je politika napsaná, a jedno číslo.
 *
 * ── Proč vůbec ──────────────────────────────────────────────────────────────
 * Do 2026-07-28 nemělo /dashboard žádnou revalidaci. Staticky předgenerovaná
 * titulní strana tak mohla ukazovat čísla zmrazená v okamžiku buildu — bez
 * jediné věty o tom, kdy ten okamžik byl. Číslo bez data platnosti je stejný
 * problém jako číslo bez citace.
 *
 * ── Jaká politika a proč zrovna tahle ───────────────────────────────────────
 * Znalostní graf je DÁVKOVÝ artefakt: mění se během `npm run da:kg-compute`,
 * nikdy za běhu požadavku. Denní okno je tedy horní mez toho, jak zastaralá
 * stránka může být, ne příslib, že se čísla denně hýbou. Stejné okno má
 * `/poslanec/[id]` (86 400 s), takže se dvě stránky nad týmž grafem nemohou
 * rozejít o den.
 *
 * ── CO DNES SKUTEČNĚ OMEZUJE STÁŘÍ ČÍSEL (změřeno, ne předpokládáno) ────────
 * `next build --webpack` označí VŠECHNY routy jako `ƒ (Dynamic)`. Není to vada
 * téhle stránky: `lib/i18n/request.ts` čte v `getRequestConfig` locale z cookie
 * (`cookies()`), a tím se dynamickou stává celá aplikace včetně `/poslanec/[id]`,
 * které `revalidate` deklaruje už dřív. `export const revalidate` je proto dnes
 * DEKLAROVANÝ STROP pro den, kdy se routa začne generovat staticky — ne popis
 * dnešního chování.
 *
 * Stáří čísel dnes tedy neomezuje revalidace, ale MEMOIZACE PENĚŽNÍ VRSTVY
 * (getDashboardData.ts): ta se čte ~12 s, takže je zapamatovaná — a bez
 * expirace by ji server po prvním požadavku držel až do restartu procesu, tedy
 * libovolně dlouho. Proto vyprší přesně za tohle okno. Věta na ploše mluví
 * právě o něm, ne o revalidaci: tvrdit cyklus, který se dnes nespouští, by bylo
 * číslo bez krytí.
 *
 * `app/dashboard/page.tsx` musí mít `export const revalidate` jako LITERÁL
 * (Next ho čte staticky, importovanou konstantu nepřijme). Aby se ta dvě čísla
 * nerozešla, hlídá je test — viz freshness.test.ts.
 */

/** Horní mez stáří staticky vygenerované stránky, v sekundách. */
export const DASHBOARD_REVALIDATE_SECONDS = 86_400;

/** Expirace memoizované peněžní vrstvy. Musí být ≤ okno revalidace, jinak by
 *  přegenerovaná stránka nesla stará čísla pod novým datem sestavení. */
export const MONEY_MEMO_TTL_MS = DASHBOARD_REVALIDATE_SECONDS * 1000;

/** Okno v hodinách — do věty na ploše. Číslo, ne text: formátuje ho locale. */
export const DASHBOARD_REVALIDATE_HOURS = DASHBOARD_REVALIDATE_SECONDS / 3600;
