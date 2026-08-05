import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SchrankaPage from "@/features/schranka/SchrankaPage";

/*
 * /schranka — Občanská schránka (moonshot 7A): osobní civic inbox.
 * Tenká routa: plocha je klientská z nutnosti (sledování žije v localStorage,
 * server ho nezná). Metadata jdou od 2026-08-05 katalogem (`schranka.meta.*`
 * v messages/{cs,en}.json — precedens /overeni).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("schranka");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default function SchrankaRoute() {
  return <SchrankaPage />;
}
