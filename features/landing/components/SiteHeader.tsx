/** Horní lišta plakátu — logo + číslovaná navigace kotev + vstup do velína. */

import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const NAV: ReadonlyArray<readonly [string, string]> = [
  ["index", "k-index"],
  ["ranking", "k-zebricek"],
  ["system", "k-system"],
  ["data", "k-data"],
  ["method", "k-metoda"],
];

export default function SiteHeader() {
  const t = useTranslations("landing");
  return (
    <header className="border-b-4 border-ink">
      <div className="mx-auto flex max-w-6xl items-stretch justify-between px-6">
        <div className="flex items-center gap-3 py-4">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
            <rect width="32" height="32" className="fill-signal" />
            <circle cx="16" cy="16" r="9" className="fill-paper" />
            <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
          </svg>
          <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Section-anchor tabs only make sense once the poster layout is wide
              enough to show them as a horizontal strip — hidden below lg. The
              "enter dashboard" CTA is the primary conversion path, though, so
              it stays outside this hidden block and visible at every
              breakpoint instead of disappearing along with the anchor nav on
              mobile/tablet, where it was previously unreachable from the header. */}
          <nav className="hidden items-stretch text-xs font-bold uppercase tracking-widest lg:flex">
            {NAV.map(([key, anchor], i) => (
              <a
                key={anchor}
                href={`#${anchor}`}
                className="flex items-center border-l border-hairline px-5 transition-colors hover:text-signal"
              >
                <span className="mr-2 font-mono text-steel">0{i + 1}</span>
                {t(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <Link href="/dashboard" className="flex items-center bg-signal px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper lg:px-5 lg:py-0">
            {t("enter")}
          </Link>
          <LanguageSwitcher className="my-auto" />
        </div>
      </div>
    </header>
  );
}
