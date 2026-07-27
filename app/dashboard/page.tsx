import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { getDashboardData } from "@/features/dashboard/getDashboardData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("dashboardTitle"),
    description: t("dashboardDescription"),
  };
}

export default async function Dashboard() {
  // Real contribution-index graph for the ranking + summary sections; null
  // when the store is unavailable, in which case DashboardPage falls back to
  // the honestly-labelled lib/civic mock.
  const data = await getDashboardData();
  return <DashboardPage data={data} />;
}
