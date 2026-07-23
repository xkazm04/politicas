import type { Metadata } from "next";
import CivicScorePage from "@/features/civicscore/CivicScorePage";

export const metadata: Metadata = {
  title: "CivicScore — žebříček republiky · Politicas",
  description:
    "Všech 200 poslanců podle kompozitního skóre efektivity: rozložení sněmovny, plný žebříček s filtrem po stranách a souboj dvou poslanců pilíř po pilíři.",
};

export default function ZebricekPage() {
  return <CivicScorePage />;
}
