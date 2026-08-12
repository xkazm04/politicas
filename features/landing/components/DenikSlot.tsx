import "server-only";

/*
 * Streamovaný slot rubriky „Dnešní zápis".
 *
 * PROČ SLOT: rubrika si do 2026-08-12 stahovala `/denik/feed.json` sama —
 * v PROHLÍŽEČI, po hydrataci, z `force-dynamic` route, tedy druhý kompletní
 * běh loaderu deníku (~58 kB odpovědi) za data, která server v tu chvíli držel.
 * Do té doby stálo na titulní straně „Zápis se načítá…".
 *
 * `getDenikData()` je memoizovaný na MONEY_MEMO_TTL_MS, ale NENÍ `react.cache()`
 * a studený běh stojí ~12 s (peněžní vrstva). Čekat s CELOU titulní stranou na
 * jednu rubriku by znamenalo, že žebříček, hemicykl i stav zdrojů dorazí o těch
 * dvanáct vteřin později — proto `<Suspense>` v app/page.tsx a proto tenhle
 * odečet NEVSTUPUJE do tamního `Promise.all`: skořápka odchází hned, rubrika
 * dopluje. Precedens je features/profile/RebellionSlot.tsx.
 *
 * Výřez je TÝŽ, jaký serializuje `/denik/feed.json` (deriveDenikEntries →
 * `FEED_ENTRIES`), takže rubrika ukazuje totéž co dřív a její věta o stropu
 * feedu zůstává pravdivá. `features/denik` se odsud jen ČTE.
 */

import { getTranslations } from "next-intl/server";
import { deriveDenikEntries, FEED_ENTRIES } from "@/features/denik/deriveDenik";
import { getDenikData } from "@/features/denik/getDenikData";
import DenikTeaser, { type TeaserTitle } from "./DenikTeaser";

/** Kolik prvních vět dne rubrika vypíše. Zbytek přizná „…a další zápisy dne". */
const TEASER_TITLES = 3;

export default async function DenikSlot({ pragueDay }: { pragueDay: string }) {
  const [data, t] = await Promise.all([getDenikData(), getTranslations("denik")]);
  // Nedostupné ≠ prázdné: loader vrací `null`, jen když není čitelná ŽÁDNÁ
  // vrstva, a to je výpadek — ne tvrzení, že se dnes nic nestalo.
  if (!data) return <DenikTeaser state={{ kind: "unavailable" }} feedCap={FEED_ENTRIES} />;

  const { entries } = deriveDenikEntries({
    contracts: data.contracts,
    roles: data.roles,
    bills: data.bills,
    reviews: data.reviews,
    changes: data.changes,
    // Horní mez dne je pražský dnešek loaderu (`builtOn`) — týž vstup, jaký
    // dostává strojový feed, aby oba výřezy nemohly vzniknout nad jiným dnem.
    today: data.builtOn,
  });
  const feed = entries.slice(0, FEED_ENTRIES);
  if (feed.length === 0) return <DenikTeaser state={{ kind: "empty" }} feedCap={FEED_ENTRIES} />;

  // Feed je seřazený dny sestupně — poslední zapsaný den je první položka.
  const date = feed[0].date;
  const dayEntries = feed.filter((e) => e.date === date);
  const titles: TeaserTitle[] = dayEntries.slice(0, TEASER_TITLES).map((e) => ({
    id: e.id,
    // Věta záznamu je KLÍČ + parametry (deriveDenik), takže rubrika mluví
    // jazykem čtenáře stejně jako /denik; `titleCs` je záloha pro cizí fixtures.
    text: e.title ? t(e.title.key, e.title.params) : e.titleCs,
  }));

  return (
    <DenikTeaser
      state={{
        kind: "day",
        day: { date, count: dayEntries.length, titles },
        // Pražský dnešek počítá SERVER (app/page.tsx → pragueDay()); v prohlížeči
        // by to byl UTC den návštěvníka, a ten mezi půlnocí a druhou hodinou
        // označí dnešní zápis za „poslední".
        isToday: date === pragueDay,
      }}
      feedCap={FEED_ENTRIES}
    />
  );
}
