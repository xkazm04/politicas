"use client";

/**
 * Řádek žebříčku sdílený všemi variantami — a zároveň oprava P1 nálezu
 * z docs/design/impeccable-pass-01.md.
 *
 * Původní `Standings.tsx:36` má `min-w-0` na vnitřním `<span>`, ale ne na jeho
 * flexovém rodiči, takže `truncate` nikdy nedostane omezenou šířku, o kterou by
 * se mohl opřít: při 390 px jméno poslance přetékalo svůj box o 27 px. Tady je
 * `min-w-0` na OBOU úrovních a jméno se skutečně zkrátí.
 *
 * Dělené pořadí se říká, nikdy nepřerovnává (`tiedCount`) — 55 z 207 poslanců
 * sdílí pořadí ve 25 skupinách a stránka to musí umět vyslovit.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import type { LandingMp } from "../getLandingData";

export default function RankRow({
  mp,
  scale = "bold",
}: {
  mp: LandingMp;
  /** `bold` = plakátová sazba (varianta A/D), `quiet` = ledger (varianta B/C). */
  scale?: "bold" | "quiet";
}) {
  const t = useTranslations("landingVariants");
  const f = useFormat();
  const bold = scale === "bold";

  return (
    <li className="border-b border-hairline">
      <Link
        href={`/poslanec/${mp.pspId}`}
        className="group flex min-w-0 items-center gap-4 py-4 transition-colors hover:bg-paper-strong"
      >
        <span
          className={`shrink-0 tabular-nums ${
            bold ? "w-14 text-3xl font-black tracking-tight" : "w-10 font-mono text-sm"
          }`}
        >
          {mp.rank}
        </span>

        {/* min-w-0 na rodiči i na dítěti — bez toho truncate nemá o co se opřít */}
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate ${
              bold ? "text-lg font-black uppercase tracking-tight" : "text-[15px] font-semibold"
            }`}
          >
            {mp.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-xs text-steel-aa">
            {/* barva strany je datový údaj — jediné povolené inline barvy */}
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: mp.clubColor }}
              aria-hidden
            />
            <span className="truncate">{mp.clubAbbrev}</span>
            {mp.tiedCount > 1 && (
              <span className="text-signal-deep">{t("rankShared", { count: mp.tiedCount })}</span>
            )}
          </span>
        </span>

        <span
          className={`shrink-0 tabular-nums ${bold ? "text-3xl font-black tracking-tight" : "font-mono text-sm"}`}
        >
          {f.dec(mp.score)}
        </span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
  );
}
