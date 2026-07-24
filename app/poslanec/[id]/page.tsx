import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ProfilePage from "@/features/profile/ProfilePage";
import { MPS } from "@/lib/civic/data";
import { formatDecimal } from "@/lib/format";

export function generateStaticParams() {
  return MPS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mp = MPS.find((m) => m.id === id);
  const t = await getTranslations("meta");
  if (!mp) return { title: t("profileNotFound") };
  const locale = await getLocale();
  const tc = await getTranslations("content");
  return {
    title: t("profileTitle", { name: mp.name, rank: mp.rank }),
    description: t("profileDescription", {
      score: formatDecimal(mp.score, locale === "en" ? "en" : "cs"),
      party: mp.party,
      region: tc(`regions.${mp.region}`),
    }),
  };
}

export default async function PoslanecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mp = MPS.find((m) => m.id === id);
  if (!mp) notFound();
  return <ProfilePage mp={mp} />;
}
