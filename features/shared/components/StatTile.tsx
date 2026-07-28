/**
 * @catalog Poster stat tile — label, big numeral, sub-line, citation; `variant`
 * marks an ILLUSTRATIVE figure apart from a real one at a glance.
 *
 * Why the variant exists: a stat strip that mixes computed figures with sample
 * ones at identical visual weight makes the label the ONLY thing separating a
 * fact from a demo — and labels are what a skimming reader drops first. The
 * illustrative variant therefore changes the plane (paper-strong), the numeral's
 * colour (steel, never the full ink of a real number), and carries an ochre
 * edge + tag, so the difference survives a glance and greyscale both.
 *
 * Drop into the house tile grid: `grid gap-px border border-ink bg-ink`.
 */

import SourceNote from "./SourceNote";

export default function StatTile({
  label,
  value,
  sub,
  source,
  variant = "real",
  illustrativeTag,
}: {
  label: string;
  /** Already formatted for display (lib/format.ts) — this component never formats. */
  value: string;
  sub?: React.ReactNode;
  /** The citation. Required by the brand rule: no tile renders a number without one. */
  source: React.ReactNode;
  variant?: "real" | "illustrative";
  /** Short uppercase tag for the illustrative variant, e.g. „ilustrativní ukázka". */
  illustrativeTag?: string;
}) {
  const illustrative = variant === "illustrative";
  return (
    <div
      className={
        illustrative
          ? "border-l-4 border-ochre bg-paper-strong px-5 py-4"
          : "bg-paper px-5 py-4"
      }
    >
      {illustrative && illustrativeTag && (
        <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-ochre">
          {illustrativeTag}
        </p>
      )}
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p
        className={`mt-1.5 text-3xl font-black tabular-nums tracking-tight ${
          illustrative ? "text-steel" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-steel">{sub}</p>}
      <SourceNote className="mt-2">{source}</SourceNote>
    </div>
  );
}
