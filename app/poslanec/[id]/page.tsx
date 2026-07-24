import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProfilePage from "@/features/profile/ProfilePage";
import { getAllProfilePspIds, getProfileData } from "@/features/profile/getProfileData";
import { formatDecimal } from "@/lib/format";

// URL convention (shared across cases): /poslanec/<pspId> where <pspId> is the
// plain integer psp person id (from the node urn psp:person:<pspId>).
export async function generateStaticParams() {
  const ids = await getAllProfilePspIds(); // 207 real persons; [] if store unavailable
  return ids.map((pspId) => ({ id: String(pspId) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("meta");
  const pspId = Number(id);
  const data = Number.isFinite(pspId) ? await getProfileData(pspId) : null;
  if (!data) return { title: t("profileNotFound") };
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
  const data = Number.isFinite(pspId) ? await getProfileData(pspId) : null;
  if (!data) notFound();
  return <ProfilePage data={data} />;
}
