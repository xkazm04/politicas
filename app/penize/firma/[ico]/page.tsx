import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import CompanyCaseFilePage from "@/features/money/CompanyCaseFilePage";
import { getCompanyCaseFile } from "@/features/money/getCompanyDetail";
import { canonicalIco } from "@/features/money/companyId";
import { pragueDay } from "@/features/denik/pragueDay";

/** The page asserts a signature-plausibility bound drawn against a DAY (contracts signed
 *  after "today" are data faults, not dates), so a build-frozen page would slowly start
 *  calling a real 2027 signature impossible. What keeps `todayIso` moving TODAY is not
 *  this line: `lib/i18n/request.ts` reads the locale cookie, so every route renders
 *  dynamically and `revalidate` is inert (memory/revalidate-is-inert-every-route-is-dynamic).
 *  It stays as the declared ceiling for the day the app goes static — the same window as
 *  /dashboard and /penize/strety — so that day cannot arrive with the bound frozen. */
export const revalidate = 86_400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ico: string }>;
}): Promise<Metadata> {
  const { ico } = await params;
  const canonical = canonicalIco(ico);
  const t = await getTranslations("meta");
  return {
    title: t("moneyCompanyTitle", { ico: canonical ?? ico }),
    description: t("moneyCompanyDescription"),
  };
}

export default async function CompanyCaseFileRoute({
  params,
}: {
  params: Promise<{ ico: string }>;
}) {
  const { ico: icoRaw } = await params;
  // A segment that cannot be an IČO at all is a genuine 404 — the loader's null is
  // reserved for "the graph has no such tie", which is a different sentence.
  if (!canonicalIco(icoRaw)) notFound();

  // ONE instant for the whole page (see lib/analysis/plausible-date.ts): reading the
  // clock inside the render would drift SSR against CSR. The day is the PRAGUE day
  // (features/denik/pragueDay.ts): the UTC slice lagged Prague by up to two hours after
  // midnight, and a contract signed "today" read as signed in the future.
  const todayIso = pragueDay();
  // Dvě varianty, jeden loader: firma s vazbou dostane peněžní spis, firma bez vazby, ale
  // se zapsaným vlastnictvím, rejstříkový výpis. `getCompanyDetail()` (užší kontrakt pro
  // /overeni) tu schválně nestojí — vrátil by `null` i pro firmu, o které graf něco ví.
  const data = await getCompanyCaseFile(icoRaw, todayIso);
  return <CompanyCaseFilePage data={data} />;
}
