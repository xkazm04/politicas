import LandingPage, { type LandingData } from "@/features/landing/LandingPage";
import { landingSourceStates } from "@/features/landing/sourceStates";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { getAtlasReport } from "@/features/atlas/getAtlasData";

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
 * Obě vrstvy degradují SAMOSTATNĚ: `null` z jedné nezhasne druhou a každá
 * přizná svou nedostupnost vlastní větou. Nikdy se nespadne na ukázková data
 * z lib/civic/data.ts — PRODUCT.md: „Real-graph wiring is the intended end
 * state." Oba loadery jsou `react.cache()`-ované a čtou týž store, takže se
 * pouštějí souběžně (precedens: features/dashboard/getDashboardData.ts).
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
  return <LandingPage data={landing} sources={landingSourceStates(atlas)} />;
}
