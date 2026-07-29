/** Patička plakátu. */

import { useTranslations } from "next-intl";

export default function SiteFooter() {
  const t = useTranslations("landing");
  return (
    <footer className="border-t-4 border-ink py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
        <span>{t("footerLeft")}</span>
        <span>{t("footerRight")}</span>
      </div>
    </footer>
  );
}
