import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getVerdictData } from "@/features/overeni/getVerdictData";
import OvereniPage from "@/features/overeni/OvereniPage";

/*
 * /overeni — Civic Claim Gate (moonshot 6C): veřejná ověřovací plocha.
 * Tenká routa: `?ref=` z URL (formulář je čistý GET — ověření je sdílitelná
 * adresa), serverové znovuodvození, presentační komponenta. Metadata česky
 * přímo zde (messages/*.json mimo plochu — precedens /zdroj, /denik).
 */

export const metadata: Metadata = {
  title: "Ověření citace — Politicas",
  description:
    "Civic Claim Gate: vložte politicas odkaz (účtenku původu, citaci grafu, exponát velína nebo data-claim element) a brána tvrzení znovu odvodí proti dnešnímu záznamu. Ověřeno · hodnota se pohnula · neznámý odkaz — nic čtvrtého. Fact-check volného textu to není a nebude.",
};

export default async function OvereniRoute({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.ref;
  const input = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";

  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const data = await getVerdictData(input === "" ? null : input);
  return <OvereniPage data={data} input={input} locale={locale} />;
}
