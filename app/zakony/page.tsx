import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LawWatchPage from "@/features/lawwatch/LawWatchPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("lawwatchTitle"),
    description: t("lawwatchDescription"),
  };
}

export default function ZakonyPage() {
  return <LawWatchPage />;
}
