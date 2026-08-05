import LandingPage, { type LandingData } from "@/features/landing/LandingPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";

/*
 * Titulní strana čte REÁLNÝ graf — týž loader jako /zebricek
 * (getLeaderboardListData). Sem dolů se ale posílá jen to, co titulní
 * strana skutečně vykreslí: špička žebříčku, vektor skóre pro hemicykl a
 * definice složek — ne celý ~120KB payload žebříčku.
 *
 * `null` (obsazený/chybějící store) → LandingPage vykreslí poctivý
 * degradovaný stav. NIKDY nespadne na ukázková data z lib/civic/data.ts —
 * PRODUCT.md: „Real-graph wiring is the intended end state."
 */

const FEATURED_COUNT = 5;

export default async function Home() {
  const data = await getLeaderboardListData();
  const landing: LandingData | null = data
    ? {
        featured: data.entries.slice(0, FEATURED_COUNT),
        scores: data.entries.map((e) => e.score),
        count: data.entries.length,
        components: data.components,
      }
    : null;
  return <LandingPage data={landing} />;
}
