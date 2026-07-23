/**
 * @catalog Citační řádek — mono verzálky pro „zdroj: …" pod každým číslem.
 *
 * Důkaz na prvním místě je značka Politicas (politicas.md §6): každé
 * vykreslené číslo nese citaci datasetu. Tohle je kanonický tvar té citace —
 * nesázet ručně, importovat odsud.
 */

const TONE = {
  steel: "text-steel",
  signal: "text-signal",
  paper: "text-paper/80",
} as const;

export default function SourceNote({
  children,
  tone = "steel",
  dot = false,
  className = "",
}: {
  children: React.ReactNode;
  /** Barevný tón textu; `paper` pro tmavé/modré plochy. */
  tone?: keyof typeof TONE;
  /** Předsadit signální tečku (●) — pro zdrojové stopy u obrázků. */
  dot?: boolean;
  className?: string;
}) {
  // Záměrně <div>, ne <p>: citace se vnořuje do ledasčeho a <p> uvnitř <p>
  // je nevalidní HTML → rozbitá hydratace (incident 2026-07-22).
  return (
    <div className={`font-mono text-[11px] uppercase tracking-widest ${TONE[tone]} ${className}`}>
      {dot && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" aria-hidden />}
      {children}
    </div>
  );
}
