"use client";

/*
 * Levá lišta aplikace — vítěz 3. kola prototypu (2026-07-26, dřív varianta
 * „Kontext"; poražená „Obsah" držela navigaci a obsah stránky jako dva
 * oddělené rejstříky).
 *
 * Mentální model: JEDEN STROM. Navigace a obsah stránky nejsou dva seznamy,
 * ale jeden — modul, na kterém právě stojíte, se rozbalí a ukáže, co je
 * uvnitř něj (kotvy sekcí + jeho podstránky). Ostatní moduly zůstávají
 * jednořádkové. Obsah stránky je tedy vidět POUZE u plochy, na které čtenář
 * je, a visí fyzicky pod ní — hloubka se čte z odsazení, ne z nadpisu.
 *
 * Aktivní sekce se rozsvítí podle scrollu (useActiveSection), takže lišta
 * zároveň říká „kde v té stránce jsi".
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import FollowCurrent from "@/features/schranka/FollowCurrent";
import SchrankaBadge from "@/features/schranka/SchrankaBadge";
import { NAV } from "./navModel";
import { BrandBlock, SectionLink, SidebarFooter, useNavLabels, type SidebarProps } from "./sidebarParts";

export default function Sidebar({ pathname, sections, activeSection, activeEntry }: SidebarProps) {
  const t = useTranslations("nav");
  const labels = useNavLabels();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r-2 border-ink bg-paper lg:flex">
      <BrandBlock />

      <nav aria-label={t("sidebarLabel")} className="min-h-0 flex-1 overflow-y-auto">
        {NAV.map((entry, i) => {
          const open = entry.key === activeEntry?.key;
          const onIndex = pathname === entry.href;
          return (
            <div key={entry.key}>
              <Link
                href={entry.href}
                aria-current={onIndex ? "page" : undefined}
                className={`group flex items-start gap-3 border-b border-hairline px-5 py-3 transition-colors ${
                  open ? "bg-ink text-paper" : "hover:bg-paper-strong"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 font-mono text-[11px] font-bold tabular-nums ${
                    open ? "text-signal" : "text-steel"
                  }`}
                >
                  /{String(i).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-black uppercase tracking-tight">
                    {labels.name(entry)}
                  </span>
                  <span
                    className={`mt-0.5 block truncate font-mono text-[11px] uppercase tracking-wider ${
                      open ? "text-paper/60" : "text-steel"
                    }`}
                  >
                    {labels.tag(entry)}
                  </span>
                </span>
                {/* Schránka nese místo metriky odznak novinek sledovaných entit. */}
                {entry.key === "schranka" ? (
                  <SchrankaBadge />
                ) : (
                  !open &&
                  labels.metric(entry) && (
                    <span className="shrink-0 font-mono text-[11px] font-bold text-cobalt">
                      {labels.metric(entry)}
                    </span>
                  )
                )}
              </Link>

              {/* Obsah stránky visí pod svým modulem — a jen pod ním. */}
              {open && (sections.length > 0 || entry.children.length > 0) && (
                <div className="border-b border-hairline bg-paper-strong/50 py-3 pl-8 pr-4">
                  {sections.length > 0 && (
                    <>
                      <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                        {t("onThisPage")}
                      </p>
                      <div className="border-l-2 border-hairline pl-3">
                        {sections.map((s, si) => (
                          <SectionLink
                            key={s.id}
                            index={si + 1}
                            label={labels.label(s.labelKey)}
                            href={`#${s.id}`}
                            active={activeSection === s.id}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {entry.children.length > 0 && (
                    <>
                      <p className="mb-1 mt-3 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                        {t("insideModule")}
                      </p>
                      <div className="border-l-2 border-hairline pl-3">
                        {entry.children.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            aria-current={pathname === c.href ? "page" : undefined}
                            className={`flex items-center justify-between gap-2 py-1.5 text-sm transition-colors ${
                              pathname === c.href ? "font-bold text-signal" : "text-steel hover:text-signal"
                            }`}
                          >
                            {labels.childLabel(c)}
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Afordance schránky: sledovat entitu aktuální stránky (moonshot 7A) —
          kreslí se jen tam, kde adresa nese jednoznačný klíč entity. */}
      <FollowCurrent />
      <SidebarFooter />
    </aside>
  );
}
