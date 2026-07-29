import LandingSwitcher from "@/features/landing/LandingSwitcher";
import { getLandingData } from "@/features/landing/getLandingData";

export default async function Home() {
  // Skutečný graf: tytéž hodnoty, které renderuje /zebricek (getLandingData
  // přebírá getLeaderboardListData a nic nepřepočítává), takže se úvodní strana
  // a žebříček nemohou rozejít v pořadí ani ve skóre.
  // Null = obchod nedostupný → přepínač ukáže LiveDataNotice a zůstane na
  // zděděné stránce, která má vlastní OZNAČENOU ukázku. Viz PRODUCT.md
  // „Capabilities and Constraints" a docs/design/impeccable-pass-01.md.
  const data = await getLandingData();
  return <LandingSwitcher data={data} />;
}
