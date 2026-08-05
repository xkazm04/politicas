/** Patička plakátu. Kontakt jen když je NEXT_PUBLIC_CONTACT_EMAIL nastaven —
 *  bez proměnné žádný odkaz, žádná smyšlená adresa (fail-honest). Metodika
 *  bez čísla verze: skutečná verze vzorce je otisk v lib/analysis/
 *  contribution.ts a nese ji /metodika — „v1.4" byla fikce ukázky. */

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SiteFooter() {
  const t = useTranslations("landing");
  // NEXT_PUBLIC_* se inlinuje při buildu; prázdný řetězec = nenastaveno.
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="border-t-4 border-ink py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
        <span>{t("footerLeft")}</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="normal-case tracking-normal text-cobalt transition-colors hover:text-signal"
            >
              {contactEmail}
            </a>
          )}
          <span>{t("footerRight")}</span>
          <Link href="/metodika" className="text-cobalt transition-colors hover:text-signal">
            {t("footerMethod")}
          </Link>
        </span>
      </div>
    </footer>
  );
}
