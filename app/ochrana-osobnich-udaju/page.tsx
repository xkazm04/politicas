/* <!-- OPERATOR REVIEW REQUIRED before launch — see PrivacyContent.tsx. --> */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PrivacyContent from "./PrivacyContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Veřejný právní dokument — indexace vítaná (na rozdíl od /admin a /rentgen).
    robots: { index: true, follow: true },
  };
}

export default function PrivacyRoute() {
  return <PrivacyContent />;
}
