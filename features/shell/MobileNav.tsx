"use client";

/*
 * Navigace pro úzké obrazovky — společná oběma variantám lišty.
 * Prototypuje se tvar SVISLÉ lišty; na telefonu by dvě varianty stejného
 * rozbalovacího panelu nic nerozhodly, tak je tu jen jedna, poctivě udělaná:
 * pruh s aktuální plochou + panel s kotvami stránky a se seznamem modulů.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NAV } from "./navModel";
import { SectionLink, useNavLabels, type SidebarProps } from "./sidebarParts";

export default function MobileNav({ pathname, sections, activeSection, activeEntry }: SidebarProps) {
  const t = useTranslations("nav");
  const labels = useNavLabels();
  const [open, setOpen] = useState(false);

  // `open` was only ever set to false from an in-panel <Link onClick> or the
  // toggle button — any navigation that doesn't go through those handlers
  // (browser/OS back-forward, a link followed from elsewhere, a programmatic
  // router.push) left the panel visibly open over the new page. Collapse on
  // any pathname change using React's "adjust state during render" pattern
  // (not a setState-in-effect) regardless of how navigation happened.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="border-b-4 border-ink bg-paper lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 transition-colors hover:text-signal">
          <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden>
            <rect width="32" height="32" className="fill-signal" />
            <circle cx="16" cy="16" r="9" className="fill-paper" />
            <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
          </svg>
          <span className="text-base font-black uppercase tracking-tight">Politicas</span>
        </Link>
        <div className="flex items-center gap-3">
          {activeEntry && (
            <span className="truncate font-mono text-[11px] uppercase tracking-widest text-steel">
              / {labels.name(activeEntry)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("closeMenu") : t("openMenu")}
            className="border border-ink p-1.5 transition-colors hover:bg-paper-strong"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-ink">
          {sections.length > 0 && (
            <div className="border-b-2 border-ink px-4 py-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
                {t("onThisPage")}
              </p>
              <div className="mt-1" onClick={() => setOpen(false)} role="presentation">
                {sections.map((s, i) => (
                  <SectionLink
                    key={s.id}
                    index={i + 1}
                    label={labels.label(s.labelKey)}
                    href={`#${s.id}`}
                    active={activeSection === s.id}
                  />
                ))}
              </div>
            </div>
          )}

          <nav aria-label={t("sidebarLabel")}>
            {NAV.map((entry, i) => (
              <Link
                key={entry.key}
                href={entry.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === entry.href ? "page" : undefined}
                className={`flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3 ${
                  entry.key === activeEntry?.key ? "border-l-4 border-l-signal bg-paper-strong pl-3" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
                    /{String(i).padStart(2, "0")} · {labels.tag(entry)}
                  </span>
                  <span className="block truncate text-base font-black uppercase tracking-tight">
                    {labels.name(entry)}
                  </span>
                </span>
                {labels.metric(entry) && (
                  <span className="shrink-0 font-mono text-[11px] font-bold text-cobalt">
                    {labels.metric(entry)}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="px-4 py-3">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </div>
  );
}
