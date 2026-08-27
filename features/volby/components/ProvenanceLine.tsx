/*
 * Řádek provenience plochy — kdy a čím byly nálezy složeny, z jakých zdrojů.
 * Jedna věta z katalogu nad `Provenance`; průchod se vysloví jen tehdy, když
 * ho loader skutečně nese (null = bez průchodu, ne „průchod 0").
 */

import SourceNote from "@/features/shared/components/SourceNote";
import { VOLBY_RULES_REF } from "@/lib/analysis/volby/rules";
import type { Provenance } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";

export default function ProvenanceLine({ provenance, t, f }: { provenance: Provenance; t: VolbyIntl["t"]; f: VolbyIntl["f"] }) {
  const vars = {
    computedAt: f.date(provenance.computedAt),
    ref: VOLBY_RULES_REF,
    sources: provenance.sources.join(", "),
  };
  return (
    <SourceNote>
      {provenance.pass === null
        ? t("provenanceNoPass", vars)
        : t("provenance", { ...vars, pass: f.int(provenance.pass) })}
    </SourceNote>
  );
}
