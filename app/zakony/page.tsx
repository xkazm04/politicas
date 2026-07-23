import type { Metadata } from "next";
import LawWatchPage from "@/features/lawwatch/LawWatchPage";

export const metadata: Metadata = {
  title: "LawWatch — hlídač paragrafů · Politicas",
  description:
    "Co se v zákonech skutečně změnilo: rozdíly po paragrafech propojené na jmenovitá hlasování a legislativní potrubí sněmovních tisků.",
};

export default function ZakonyPage() {
  return <LawWatchPage />;
}
