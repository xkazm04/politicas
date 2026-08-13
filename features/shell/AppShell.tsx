"use client";

/*
 * Aplikační obal — levá lišta je součástí LAYOUTU, ne jednotlivých ploch.
 * Dřív si každý modul kreslil vlastní hlavičku s logem a navigace mezi
 * moduly neexistovala: čtenář se z modulu dostal jen zpět přes velín.
 *
 * Vyjmuté plochy (isBareRoute): landing má vlastní plakátovou hlavičku,
 * admin je provozní konzole mimo veřejnou navigaci a /rentgen je archivovaný
 * výtvarný směr — obalit ho novým chromem by referenci znehodnotilo.
 *
 * Klientská komponenta, ale `children` sem přicházejí jako prop, takže
 * stránky uvnitř zůstávají serverové.
 *
 * PŘESKOČIT NA OBSAH (2026-08-13). Lišta stojí v DOM PŘED obsahem, takže než
 * se čtenář ovládající aplikaci klávesnicí nebo odečítačkou dostal k tomu, co
 * si přišel přečíst, prošel — na KAŽDÉ z ~23 nebarevných rout — logem, osmi
 * řádky navigace, až pěti kotvami sekcí, až pěti podřízenými odkazy,
 * tlačítkem sledování, dvěma přepínači jazyka a dvěma odkazy do patičky:
 * nejméně 13, nejvýš ~23 zastávek tabulátoru. Orientační body přitom byly
 * v pořádku už dřív (`<aside>`, pojmenovaný `<nav>`, `<main>` ve všech 38
 * plochách) — chyběl jediný prvek, kterým se mezi nimi dá skočit.
 *
 * Cíl je obal `#obsah` ZDE, ne `<main>` uvnitř stránky: `<main>` si kreslí
 * každá plocha sama a přidávat 38 identických `id` by znamenalo 38 míst, kde
 * může jedno vypadnout. `tabIndex={-1}` je na cíli nutnost, ne ozdoba — bez
 * něj Firefox a Safari odrolují, ale fokus nechají v liště, takže další
 * tabulátor pokračuje v navigaci, ne v textu (týž nedostatek, který u kotev
 * lišty zůstává zaznamenaný jako další práce).
 *
 * Odkaz je vidět až při fokusu (`sr-only` + `focus:not-sr-only`) — pro myš
 * neexistuje, pro klávesnici je to první zastávka na stránce.
 */

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import { entryFor, isBareRoute, sectionsFor } from "./navModel";
import { useActiveSection } from "./useActiveSection";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const bare = isBareRoute(pathname);

  const declared = bare ? [] : sectionsFor(pathname);
  const { active, present } = useActiveSection(declared.map((s) => s.id));

  if (bare) return <>{children}</>;

  // Dokud se nezměřilo, kreslí se vše deklarované; po měření jen kotvy, které
  // na stránce opravdu jsou (některé sekce visí na dostupnosti reálných dat).
  const sections = present === null ? declared : declared.filter((s) => present.has(s.id));
  const navProps = {
    pathname,
    sections,
    activeSection: active,
    activeEntry: entryFor(pathname),
  };

  return (
    <div className="flex min-h-screen w-full bg-paper">
      {/* První zastávka tabulátoru na stránce — před lištou, protože přeskočit
          ji lze jen odtud. */}
      <a
        href="#obsah"
        className="sr-only left-4 top-4 z-50 border-2 border-ink bg-paper px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-ink focus:not-sr-only focus:absolute focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-cobalt"
      >
        {t("skipToContent")}
      </a>
      <Sidebar {...navProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav {...navProps} />
        {/* `tabIndex={-1}`: cíl přeskočení musí být zaostřitelný, jinak
            prohlížeč odroluje a fokus nechá v liště. */}
        <div id="obsah" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
