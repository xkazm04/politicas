import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import LeaderboardPoster, {
  type LeaderboardPosterData,
} from "@/features/shared/poster/demo/LeaderboardPoster";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";

/*
 * /plakat/<view> — Režim plakátu (batch 1D): tisková podoba klíčových ploch.
 * Referenční integrace je žebříček (`/plakat/zebricek`); další pohledy
 * (spis poslance, seismograf) adoptují PosterFrame v pozdějších dávkách a
 * jen se přidají do VIEWS. Tenká routa: data ořeže na to, co arch sází,
 * a vše ostatní žije ve features/shared/poster/**.
 *
 * Copy je záměrně česky přímo zde (ne přes messages/*.json): katalog překladů
 * je mimo plochu batch-1D; až plakát dostane en mutaci, přesune se to tam.
 */

const VIEWS = ["zebricek"] as const;
type PosterView = (typeof VIEWS)[number];
const isPosterView = (v: string): v is PosterView => (VIEWS as readonly string[]).includes(v);

/** Živá URL žebříčku z request hlaviček — na patičce plakátu nesmí být
 *  vymyšlená doména; v dev čestně stojí localhost, v nasazení reálný host. */
async function liveLeaderboardUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/zebricek` : "/zebricek";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  if (!isPosterView(view)) return { title: "Plakát — Politicas" };
  return {
    title: "Plakát — Otevřený index · Politicas",
    description:
      "Tisková podoba žebříčku indexu přispění: arch A4/A3 s archivní citační patičkou (zdroj, stav dat, metodika).",
  };
}

export default async function PlakatPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!isPosterView(view)) notFound();

  // Reálný znalostní graf; null (store nedostupný) → poctivý stav, nikdy mock.
  const data = await getLeaderboardListData();
  if (!data) {
    return <DataUnavailable what="plakát žebříčku" backHref="/zebricek" backLabel="zpět na žebříček" />;
  }

  const poster: LeaderboardPosterData = {
    // Datum, ke kterému čísla platí = den vykreslení ze živého grafu.
    retrievedAt: new Date().toISOString().slice(0, 10),
    liveUrl: await liveLeaderboardUrl(),
    provenancePass: data.provenancePass,
    summary: data.summary,
    histogram: data.histogram,
    top: data.entries.slice(0, 10).map((e) => ({
      rank: e.rank,
      name: e.name,
      clubAbbrev: e.clubAbbrev,
      clubColor: e.clubColor,
      score: e.score,
      tiedCount: e.tiedCount,
    })),
  };

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ plakát</span>
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            otevřený index · tisková podoba
          </span>
        </div>
      </header>
      <LeaderboardPoster data={poster} />
    </main>
  );
}
