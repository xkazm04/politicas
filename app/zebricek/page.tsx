import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CivicScorePage from "@/features/civicscore/CivicScorePage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { decodeWeights, isPublishedWeights, LENS_PARAM } from "@/features/civicscore/lens";
import { serializeWeights } from "@/features/landing/referendum/aggregate";

/*
 * /zebricek — plný žebříček. Tenká routa; čočka (?vahy=…) žije v adrese a
 * SDÍLENÝ odkaz ji musí nést i do náhledu: „Sdílet moji čočku" kopírovalo
 * adresu s vlastními vahami, ale karta pod ní byla obecná kořenová OG —
 * čtenářova metodika se do náhledu nikdy nedostala, ačkoli generátor, který
 * přesně tenhle parametr umí, existuje od moonshotu 7B.
 *
 * Karta se proto BERE (app/referendum/og), nekopíruje: jeden generátor, jeden
 * kodek čočky, jedno pravidlo pro neplatný vektor. Metadata se skládají týmž
 * postupem jako v app/referendum/page.tsx — decodeWeights + isPublishedWeights
 * + serializeWeights jsou importované, ne přepsané.
 *
 * Režim vykreslování se tím nemění: lib/i18n/request.ts čte v getRequestConfig
 * cookie s jazykem, takže KAŽDÁ routa aplikace je už dnes ƒ (Dynamic) — čtení
 * searchParams v generateMetadata nic nestatičtí ani nedynamičtí.
 */

interface SearchParams {
  searchParams: Promise<{ [LENS_PARAM]?: string | string[] }>;
}

/** První hodnota parametru — Next dodává `string | string[]`. Tvarová pojistka
 *  nad searchParams, ne kodek čočky (ten se importuje); týž tvar jako
 *  app/referendum/page.tsx. */
const one = (v: string | string[] | undefined): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;

export async function generateMetadata({ searchParams }: SearchParams): Promise<Metadata> {
  const t = await getTranslations("meta");
  const raw = one((await searchParams)[LENS_PARAM]);
  const present = raw !== null && raw !== "";
  const weights = present ? decodeWeights(raw) : null;
  const custom = weights !== null && !isPublishedWeights(weights);
  const vector = custom ? serializeWeights(weights) : null;

  // Neplatný vektor se NIKDY tiše neopravuje ani nezahazuje: surová hodnota jde
  // na kartu tak, jak přišla, a generátor vydá svou vlastní „Neplatné váhy"
  // (deriveReferendumCard → kind: "invalid"). Zahodit ji by znamenalo ukázat
  // oficiální index pod adresou, která tvrdí něco jiného.
  const ogParam = vector ?? (present && weights === null ? encodeURIComponent(raw) : null);
  const ogImage = ogParam !== null ? `/referendum/og?${LENS_PARAM}=${ogParam}` : "/referendum/og";

  return {
    title: vector !== null ? t("civicscoreLensTitle", { weights: vector }) : t("civicscoreTitle"),
    description:
      vector !== null
        ? t("civicscoreLensDescription", { weights: vector })
        : t("civicscoreDescription"),
    openGraph: { images: [{ url: ogImage, width: 1200, height: 630 }] },
  };
}

export default async function ZebricekPage() {
  // Real knowledge-graph read: all 207 MPs ranked by the contribution index.
  // Null when no store / empty graph → CivicScorePage renders a labelled notice.
  const data = await getLeaderboardListData();
  return <CivicScorePage data={data} />;
}
