import type { Metadata } from "next";
import ReferendumPage from "@/features/landing/referendum/ReferendumPage";
import { getReferendumData } from "@/features/landing/referendum/getReferendumData";
import { decodeWeights, isPublishedWeights, LENS_PARAM } from "@/features/civicscore/lens";
import { serializeWeights } from "@/features/landing/referendum/aggregate";

/*
 * /referendum — Referendum o metodice (moonshot 7B). Tenká routa: server načte
 * reálný žebříček + anonymní agregát vah a předá klientovi; čočka žije v
 * adrese (?vahy=…, týž kodek jako /zebricek). Sdílený odkaz s vlastní čočkou
 * dostává vlastní OG kartu (app/referendum/og — otisk vah + top 5 pod čočkou);
 * neplatný či zveřejněný vektor kartu nemění (čistá adresa = oficiální index).
 * Metadata česky přímo zde (messages/*.json mimo plochu — precedens /kompas).
 */

interface SearchParams {
  searchParams: Promise<{ [LENS_PARAM]?: string | string[] }>;
}

const one = (v: string | string[] | undefined): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;

export async function generateMetadata({ searchParams }: SearchParams): Promise<Metadata> {
  const raw = one((await searchParams)[LENS_PARAM]);
  const weights = raw !== null ? decodeWeights(raw) : null;
  const custom = weights !== null && !isPublishedWeights(weights);
  const vector = custom ? serializeWeights(weights) : null;
  return {
    title: vector
      ? `Referendum o metodice — váhy ${vector} — Politicas`
      : "Referendum o metodice — Politicas",
    description: vector
      ? `Žebříček 207 poslanců přepočtený čtenářskou čočkou ${vector} nad šesti zveřejněnými složkami indexu přispění (psp.cz, deterministický výpočet). Odkaz nese metodiku v sobě.`
      : "Nastavte si vlastní váhy šesti složek indexu přispění, přepočtěte žebříček sněmovny pod svou čočkou a odevzdejte anonymní hlas do agregátu „jak váží Česko“ vedle zveřejněné metodiky.",
    openGraph: {
      images: [{ url: vector ? `/referendum/og?${LENS_PARAM}=${vector}` : "/referendum/og", width: 1200, height: 630 }],
    },
  };
}

export default async function ReferendumRoute() {
  const { leaderboard, aggregate } = await getReferendumData();
  return <ReferendumPage data={leaderboard} initialAggregate={aggregate} />;
}
