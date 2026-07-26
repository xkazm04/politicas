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
 */

import { usePathname } from "next/navigation";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import { entryFor, isBareRoute, sectionsFor } from "./navModel";
import { useActiveSection } from "./useActiveSection";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      <Sidebar {...navProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav {...navProps} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
