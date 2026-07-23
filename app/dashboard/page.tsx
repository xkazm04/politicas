import type { Metadata } from "next";
import DashboardPage from "@/features/dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Politicas — velín republiky",
  description:
    "Přehled sněmovny: kompozitní skóre, žebříček, události v grafu veřejných peněz a vstupy do pěti nástrojů.",
};

export default function Dashboard() {
  return <DashboardPage />;
}
