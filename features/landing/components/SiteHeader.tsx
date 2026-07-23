/** Horní lišta plakátu — logo + číslovaná navigace kotev + vstup do velína. */

import Link from "next/link";

const NAV: ReadonlyArray<readonly [string, string]> = [
  ["Index", "k-index"],
  ["Žebříček", "k-zebricek"],
  ["Systém", "k-system"],
  ["Data", "k-data"],
  ["Metoda", "k-metoda"],
];

export default function SiteHeader() {
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
        <nav className="hidden items-stretch text-xs font-bold uppercase tracking-widest lg:flex">
          {NAV.map(([label, anchor], i) => (
            <a
              key={anchor}
              href={`#${anchor}`}
              className="flex items-center border-l border-hairline px-5 transition-colors hover:text-signal"
            >
              <span className="mr-2 font-mono text-steel">0{i + 1}</span>
              {label}
            </a>
          ))}
          <Link href="/dashboard" className="flex items-center bg-signal px-5 font-bold text-paper">
            Vstoupit
          </Link>
        </nav>
      </div>
    </header>
  );
}
