/**
 * @catalog In-page banner stating plainly that the LIVE data source is unreachable
 * and what the reader is looking at instead — the list-surface counterpart to
 * `DataUnavailable` (which replaces a whole detail route).
 *
 * Why this exists: the loader convention turns every store failure into `null`,
 * and a list surface then falls back to its labelled sample. Labelling each tile
 * „ilustrativní ukázka" is true but insufficient — it reads as an editorial choice,
 * not as an outage, so a reader can browse a whole page of demo figures without
 * ever learning the database was down. This says it once, at the top, in the
 * page's own voice.
 */

import { AlertTriangle } from "lucide-react";
import SourceNote from "./SourceNote";

export default function LiveDataNotice({
  title,
  body,
  source,
}: {
  title: string;
  body: string;
  /** Optional citation for what the surface fell back to. */
  source?: React.ReactNode;
}) {
  return (
    <div role="status" className="border-2 border-signal bg-paper-strong px-5 py-4">
      <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        {title}
      </p>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">{body}</p>
      {source && <SourceNote className="mt-2">{source}</SourceNote>}
    </div>
  );
}
