import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DashboardPage from "@/features/dashboard/DashboardPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("dashboardTitle"),
    description: t("dashboardDescription"),
  };
}

export default function Dashboard() {
  return <DashboardPage />;
}
