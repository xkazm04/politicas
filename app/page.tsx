import { Suspense } from "react";
import LandingPage, { type LandingData } from "@/features/landing/LandingPage";
import { landingSourceStates } from "@/features/landing/sourceStates";
import DenikSlot from "@/features/landing/components/DenikSlot";
import DenikTeaserPending from "@/features/landing/components/DenikTeaserPending";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { getAtlasReport } from "@/features/atlas/getAtlasData";
import { pragueDay } from "@/features/denik/pragueDay";

/*
 * Titulní strana čte REÁLNÝ graf dvěma nezávislými vrstvami:
 *
 *  1. ŽEBŘÍČEK — týž loader jako /zebricek (getLeaderboardListData). Sem dolů
 *     se posílá jen to, co titulní strana skutečně vykreslí: špička žebříčku,
 *     vektor skóre pro hemicykl, definice složek a komorová provenience
 *     (základ citace skóre) — ne celý ~120KB payload žebříčku.
 *  2. STAV ZDROJŮ — týž atlas kvality jako /atlas (getAtlasReport). Rubrika
 *     „Surový materiál" do 2026-08-12 vypisovala ukázkové kadence z
 *     lib/civic/data.ts; teď nese měřené pokrytí, čerstvost a souhrn.
 *
 * TŘETÍ VRSTVA — DENÍK — STREAMUJE (2026-08-12). Rubrika „Dnešní zápis" si
 * feed do teď stahovala sama v prohlížeči a do té doby psala „Zápis se
 * načítá…". Odečet teď dělá server (`DenikSlot`), ale VĚDOMĚ MIMO `Promise.all`
 * níž: `getDenikData()` není `react.cache()`-ované a studený běh stojí ~12 s
 * (peněžní vrstva), takže by na jednu rubriku čekala celá titulní strana.
 * `<Suspense>` s pojmenovaným fallbackem je tu proto nosný prvek — skořápka
 * odchází hned, rubrika dopluje. Fallback je KLIENTSKÝ soubor: `async` fallback
 * by uspal tutéž hranici, kvůli které existuje (precedens
 * RebellionInstancesPending).
 *
 * Pražský dnešek (features/denik/pragueDay.ts) jde dolů jako DATA, ne jako
 * funkce — podle něj se pozná „dnešní" zápis; v prohlížeči by to byl UTC den
 * návštěvníka.
 *
 * Všechny vrstvy degradují SAMOSTATNĚ: `null` z jedné nezhasne druhou a každá
 * přizná svou nedostupnost vlastní větou. Nikdy se nespadne na ukázková data
 * z lib/civic/data.ts — PRODUCT.md: „Real-graph wiring is the intended end
 * state." Oba awaitované loadery jsou `react.cache()`-ované a čtou týž store,
 * takže se pouštějí souběžně (precedens: features/dashboard/getDashboardData.ts).
 */

const FEATURED_COUNT = 5;

export default async function Home() {
  const [data, atlas] = await Promise.all([getLeaderboardListData(), getAtlasReport()]);
  const landing: LandingData | null = data
    ? {
        featured: data.entries.slice(0, FEATURED_COUNT),
        scores: data.entries.map((e) => e.score),
        count: data.entries.length,
        components: data.components,
        provenance: data.provenance,
      }
    : null;
  return (
    <LandingPage
      data={landing}
      sources={landingSourceStates(atlas)}
      denikSlot={
        <Suspense fallback={<DenikTeaserPending />}>
          <DenikSlot pragueDay={pragueDay()} />
        </Suspense>
      }
    />
  );
}
