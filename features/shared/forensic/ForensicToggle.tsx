"use client";

/*
 * Přepínač forenzního režimu — bydlí v hlavičce stránek, které režim
 * podporují (referenčně /graf). Nepřepíná stav v paměti: mění ADRESU
 * (?rezim=forenzni), takže zapnutý pohled je sdílitelný odkaz a tlačítko
 * Zpět režim opouští. Aktuální parametry čte až v obsluze kliknutí
 * z window.location — render tak nepotřebuje useSearchParams a komponenta
 * nevyžaduje Suspense hranici.
 */

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { useForensicMode } from "./ForensicProvider";
import { withForensic } from "./forensicMode";

export default function ForensicToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("forensic");
  const on = useForensicMode();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? t("hintOn") : t("hintOff")}
      onClick={() => {
        router.push(withForensic(pathname, window.location.search, !on), { scroll: false });
      }}
      className={`flex shrink-0 items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
        on
          ? "border-signal bg-signal text-paper hover:bg-signal-deep"
          : "border-ink bg-paper text-ink hover:bg-paper-strong"
      } ${className}`}
    >
      <ScanLine className="h-3.5 w-3.5" aria-hidden />
      {t("toggle")}
    </button>
  );
}
