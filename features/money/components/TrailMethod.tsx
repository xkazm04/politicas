/**
 * Jak stopa vzniká — čtyři kroky od rejstříků k doloženému faktu,
 * sutnarovské glyfy + kadence zdrojů. Poslední krok je lidská kontrola:
 * práh spolehlivosti je součást metodiky, ne provozní detail.
 */

import SourceNote from "@/features/shared/components/SourceNote";

const STEPS = [
  {
    n: "01",
    title: "ARES v3",
    body: "Rejstřík firem a statutárních orgánů — kdo ve které firmě figuruje.",
    cadence: "téměř real-time · 500 req/min",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <circle cx="24" cy="24" r="18" className="fill-cobalt" />
        <circle cx="24" cy="24" r="7" className="fill-paper" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Registr smluv + dotací",
    body: "Veřejné peníze tekoucí k firmám — smlouvy denně, dotace čtvrtletně.",
    cadence: "denně / čtvrtletně",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <rect x="7" y="24" width="9" height="17" className="fill-cobalt" />
        <rect x="20" y="14" width="9" height="27" className="fill-signal" />
        <rect x="33" y="20" width="9" height="21" className="fill-ink" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Hlídač státu",
    body: "Osoby, stranické vazby a dary — druhá strana grafu.",
    cadence: "průběžně · REST API",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <line x1="10" y1="37" x2="38" y2="11" className="stroke-ink" strokeWidth="3" />
        <circle cx="10" cy="37" r="6.5" className="fill-signal" />
        <circle cx="38" cy="11" r="6.5" className="fill-cobalt" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "Rozlišení entit + lidská kontrola",
    body: "Osoba nemá veřejný identifikátor — párujeme jméno, ročník a adresu, neseme spolehlivost. Sporné záznamy nezveřejňujeme.",
    cadence: "práh spolehlivosti · člověk schvaluje",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <path d="M24 7 42 40 6 40Z" className="fill-signal" />
        <path d="M24 19 33 37 15 37Z" className="fill-paper" />
      </svg>
    ),
  },
];

export default function TrailMethod() {
  return (
    <div>
      <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="flex min-h-52 flex-col justify-between bg-paper p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-2xl font-bold text-signal">{s.n}</span>
                {s.glyph}
              </div>
              <p className="mt-3 text-lg font-black uppercase leading-tight tracking-tight">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-steel">{s.body}</p>
            </div>
            <SourceNote className="mt-3 !text-[10px]">{s.cadence}</SourceNote>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        Spojovacím klíčem celého grafu je osmimístné IČO — čisté spojení firma ↔ smlouva
        ↔ dotace ↔ dar. Nejtěžší hrana je osoba ↔ firma; proto je poslední krok metodiky
        člověk, ne heuristika.
      </p>
    </div>
  );
}
