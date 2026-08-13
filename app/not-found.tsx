/*
 * NEEXISTUJÍCÍ ADRESA — druhá polovina dvojice, kterou začal
 * features/shared/components/DataUnavailable.tsx.
 *
 * Ta komponenta vznikla proto, aby „zdroj je zaneprázdněný" nemohlo vypadat
 * jako „tenhle záznam neexistuje". Druhá polovina té dvojice ale do 2026-08-13
 * neexistovala vůbec: repozitář neměl app/not-found.tsx, takže DVANÁCT ploch,
 * které volají notFound() (/poslanec/[id], /zakony/[cislo], /zakony/predpis/[ref],
 * /penize/[pspId], /penize/[pspId]/paket, /penize/firma/[ico], /rozpocty/[ico],
 * /kraj/[kraj], /zdroj/[ref], /graf/p/[ref], /dashboard/exponat/[id],
 * /plakat/[view]) — a s nimi každá překlepnutá adresa — odpovídalo vestavěnou
 * záložkou Nextu: natvrdo ANGLICKOU větou „This page could not be found.",
 * systémovým fontem z inline stylu a bez jediného odkazu ven, uvnitř českého
 * kořenového layoutu.
 *
 * Tahle plocha proto dělá tři věci a žádnou navíc:
 *   1. říká, co se stalo, česky i anglicky z katalogu,
 *   2. ODLIŠUJE SE od výpadku zdroje — „záznam neexistuje" a „zdroj se
 *      nepodařilo přečíst" jsou dvě různá tvrzení a plést je znamená lhát
 *      jedním nebo druhým směrem,
 *   3. nabízí rozcestí podle TYPU záznamu, na který čtenář mířil (překlepnuté
 *      číslo mandátu, zvětralé IČO, špatné číslo zákona), protože „zpět na
 *      úvodní stranu" je odpověď na jinou otázku.
 *
 * Serverová komponenta: nepotřebuje ani bajt klientského JS. Vykresluje se
 * UVNITŘ kořenového layoutu (týž vzor jako app/error.tsx), takže levá lišta
 * zůstává a čtenář má kudy odejít i mimo tenhle výčet.
 *
 * ŽÁDNÉ ČÍSLO: plocha vědomě nevypisuje stav odpovědi. Next vrací 404 jen
 * u nestreamovaných odpovědí a u streamovaných 200 (viz
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * not-found.md), takže vysázet „404" do textu by znamenalo tvrdit číslo, které
 * pro část odpovědí neplatí. Stav nese hlavička, ne sazba.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import SectionRule from "@/features/shared/components/SectionRule";

/**
 * Rozcestí podle TYPU hledaného záznamu — ne kopie navigace (tu vedle kreslí
 * levá lišta), ale odpověď na otázku „co jsem to vlastně otevíral". Pořadí
 * kopíruje četnost dynamických ploch, které notFound() volají: spis poslance,
 * zákon/tisk, firma, obec, citace.
 */
const DOORS: { href: string; key: string }[] = [
  { href: "/zebricek", key: "poslanec" },
  { href: "/zakony", key: "zakon" },
  { href: "/penize", key: "firma" },
  { href: "/rozpocty", key: "obec" },
  { href: "/overeni", key: "citace" },
];

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-6 text-base leading-relaxed text-steel-aa">{t("body")}</p>
        {/* Odlišení od DataUnavailable je JÁDRO téhle plochy, ne poznámka pod
            čarou — proto stojí v textu, ne v patičce. */}
        <p className="mt-3 text-sm leading-relaxed text-steel-aa">{t("distinction")}</p>

        <nav aria-labelledby="kudy-dal" className="mt-10 border-t-2 border-ink pt-5">
          <h2
            id="kudy-dal"
            className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa"
          >
            {t("doorsTitle")}
          </h2>
          <ul className="mt-3 divide-y divide-hairline">
            {DOORS.map((door) => (
              <li key={door.href}>
                <Link
                  href={door.href}
                  className="flex items-baseline gap-3 py-2.5 text-sm transition-colors hover:text-signal"
                >
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-cobalt">
                    {door.href}
                  </span>
                  <span className="min-w-0 text-steel-aa">{t(`doors.${door.key}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:border-signal hover:bg-signal"
          >
            {t("home")}
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong"
          >
            {t("dashboard")}
          </Link>
        </div>
      </div>
    </main>
  );
}
