/* <!-- OPERATOR REVIEW REQUIRED before launch — see TermsContent.tsx. --> */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TermsContent from "./TermsContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Veřejný právní dokument — indexace vítaná (na rozdíl od /admin a /rentgen).
    robots: { index: true, follow: true },
  };
}

export default function TermsRoute() {
  return <TermsContent />;
}
