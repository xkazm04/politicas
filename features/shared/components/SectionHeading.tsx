/**
 * @catalog Číslovaná hlavička sekce — mono index /01 + plakátový titulek s tečkou.
 *
 * Jednotná kotva obsahových sekcí (dashboard, spisy, moduly): nad titulkem
 * signální mono index, titulek verzálkami s červenou tečkou, vpravo volitelná
 * meta (odkaz, citace). Drží plakátovou hierarchii landing page i uvnitř aplikace.
 */

export default function SectionHeading({
  index,
  title,
  aside,
}: {
  index: number;
  title: string;
  /** Pravý okraj řádku — odkaz „všech 200 →", SourceNote apod. */
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
          /{String(index).padStart(2, "0")}
        </p>
        <h2 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          {title}
          <span className="text-signal">.</span>
        </h2>
      </div>
      {aside}
    </div>
  );
}
