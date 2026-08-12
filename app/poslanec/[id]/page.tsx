import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import MpProfileBeacon from "@/components/MpProfileBeacon";
import ProfilePage from "@/features/profile/ProfilePage";
import RebellionSlot from "@/features/profile/RebellionSlot";
import { RebellionInstancesPending } from "@/features/profile/components/RebellionInstances";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { getAllProfilePspIds, getProfileData } from "@/features/profile/getProfileData";
import { formatDecimal } from "@/lib/format";

/**
 * The dossier states a date it is current AS OF (committee seats split into
 * current/past against "today" — `ProfileData.seatsAsOf`). Statically generated
 * with no revalidation, that date froze at build time and the page kept
 * asserting it. One day bounds the drift, and the page prints the date it is
 * asserting, so a stale seat is visible rather than silent.
 */
export const revalidate = 86_400;

// URL convention (shared across cases): /poslanec/<pspId> where <pspId> is the
// plain integer psp person id (from the node urn psp:person:<pspId>).
export async function generateStaticParams() {
  const ids = await getAllProfilePspIds(); // 207 real persons; [] if store unavailable
  return ids.map((pspId) => ({ id: String(pspId) }));
}

/**
 * VÝPADEK NENÍ „NENALEZENO" — ani ve sdílené kartě.
 *
 * `getProfileData` vrací `null` ze DVOU důvodů: buď graf nejde přečíst
 * (jednospojkový PGlite drží jiný proces), nebo tohle pspId žádný poslanec
 * není. Tělo stránky ty dva stavy rozlišuje od začátku (`getAllProfilePspIds`
 * — prázdný seznam ⇒ není store); metadata ne, takže při výpadku odcházel do
 * vyhledávačů a náhledů odkazů titulek „spis nenalezen" — výrok o člověku,
 * který si vymyslel výpadek databáze.
 *
 * Cena: pod obojím sedí `buildLeaderboard()`, který je `react.cache()`d v rámci
 * požadavku A memoizovaný napříč požadavky, takže tohle je týž průchod, na
 * který čeká tělo stránky — nikdy druhé čtení.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("meta");
  const pspId = Number(id);
  // Nečíselný slug není poslanec za žádného stavu store — tělo na něj volá
  // `notFound()` bez čtení, a metadata proto taky nečtou.
  if (!Number.isFinite(pspId)) return { title: t("profileNotFound") };
  const data = await getProfileData(pspId);
  if (!data) {
    const known = await getAllProfilePspIds();
    if (known.length === 0) {
      const tp = await getTranslations("profile");
      return {
        title: tp("metaUnavailableTitle"),
        description: tp("metaUnavailableDescription"),
        // Degradovaná stránka se neindexuje: co robot uloží při výpadku, tvrdí
        // pak o poslanci ještě dlouho poté, co je graf zase čitelný.
        robots: { index: false },
      };
    }
    return { title: t("profileNotFound") };
  }
  const locale = await getLocale();
  return {
    title: t("profileTitle", { name: data.person.name, rank: data.person.rank }),
    description: t("profileDescription", {
      score: formatDecimal(data.person.score, locale === "en" ? "en" : "cs"),
      party: data.person.clubName,
      region: data.person.region ?? "—",
    }),
  };
}

export default async function PoslanecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pspId = Number(id);
  if (!Number.isFinite(pspId)) notFound(); // a non-numeric slug is genuinely no MP
  const data = await getProfileData(pspId);
  if (data) {
    // Jmenovité rebelie stojí na čtení celého hlasovacího záznamu (406 000 řádků,
    // 15,8–16,0 s měřeno; pak mezizádostní paměť). Streamují se, aby zbytek spisu
    // nečekal — a fallback říká, na co se čeká.
    return (
      <>
        {/* Aktivační maják (mp-profile-view) — per-route, ne v layoutu;
            bez NEXT_PUBLIC_PLAUSIBLE_DOMAIN tichý no-op. */}
        <MpProfileBeacon mpId={id} />
        <ProfilePage
          data={data}
          rebellionSlot={
            <Suspense fallback={<RebellionInstancesPending />}>
              <RebellionSlot pspId={pspId} />
            </Suspense>
          }
        />
      </>
    );
  }
  // Null means EITHER the graph is unreachable (single-connection PGlite held by
  // another process) OR this pspId is not a real MP. getAllProfilePspIds() tells
  // them apart: empty ⇒ no store. Never answer "neexistuje" for a busy database.
  const known = await getAllProfilePspIds();
  if (known.length === 0) {
    const t = await getTranslations("profile");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/zebricek" backLabel={t("unavailableBack")} />;
  }
  notFound();
}
