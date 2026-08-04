import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { getDashboardData } from "@/features/dashboard/getDashboardData";
import { toDashboardWire } from "@/features/dashboard/publicWire";

/**
 * Denní okno. Musí být LITERÁL — Next čte segmentovou konfiguraci staticky a
 * importovanou konstantu nepřijme; že se nerozejde s
 * `DASHBOARD_REVALIDATE_SECONDS` (features/dashboard/freshness.ts, kde je celé
 * odůvodnění), hlídá freshness.test.ts.
 *
 * POZOR: dnes je to deklarovaný STROP, ne popis chování — `lib/i18n/request.ts`
 * čte locale z cookie, takže `next build` označí všechny routy jako dynamické.
 * Co stáří čísel skutečně omezuje, je expirace memoizované peněžní vrstvy na
 * TÉŽE okno; stránka datum svého sestavení navíc vypisuje.
 */
export const revalidate = 86_400;

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
  // The wire projection sits BETWEEN the loader and the client (the /penize
  // pattern, features/money/publicWire.ts): the slice's `sources` working set and
  // /penize's own money aggregates are consumed on this side and never rendered,
  // so they must not cross the network. `getExhibitData()` keeps the full shape.
  return <DashboardPage data={data ? toDashboardWire(data) : null} />;
}
