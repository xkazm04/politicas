import type { Metadata } from "next";
import FollowTheMoneyPage from "@/features/money/FollowTheMoneyPage";

export const metadata: Metadata = {
  title: "FollowTheMoney — stopa peněz · Politicas",
  description:
    "Veřejné zakázky, dotace a dary dohledané přes firmy k politikům — graf entit, kniha doložených vazeb a metodika stopy. Sytí pilíř Integrita.",
};

export default function PenizePage() {
  return <FollowTheMoneyPage />;
}
