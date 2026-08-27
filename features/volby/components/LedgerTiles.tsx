/*
 * Ledger závažnosti — tři dlaždice (otázky · pozitivní · nezhodnoceno), každá
 * s rozpadem po závažnosti a citací. ŽÁDNÝ souhrnný index: čísla jsou počty
 * nálezů podle pravidla a závažnosti (rules.rollupLedger), a věta o základu
 * arény říká, proti čemu se pravidla vyhodnotila — nebo že proti ničemu.
 */

import SourceNote from "@/features/shared/components/SourceNote";
import StatTile from "@/features/shared/components/StatTile";
import type { SeverityLedger, Valence } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import { sharePct } from "../labels";

const VALENCES: readonly Valence[] = ["negative", "positive", "unrated"];
const LABEL_KEY: Record<Valence, string> = {
  negative: "card.ledgerNegative",
  positive: "card.ledgerPositive",
  unrated: "card.ledgerUnrated",
};

const total = (c: SeverityLedger["counts"][Valence]) => c.high + c.medium + c.low;

export default function LedgerTiles({ ledger, t, f }: { ledger: SeverityLedger; t: VolbyIntl["t"]; f: VolbyIntl["f"] }) {
  return (
    <div>
      <div className="grid gap-px border border-ink bg-ink sm:grid-cols-3">
        {VALENCES.map((v) => {
          const c = ledger.counts[v];
          return (
            <StatTile
              key={v}
              label={t(LABEL_KEY[v])}
              value={f.int(total(c))}
              sub={t("card.ledgerSub", { high: f.int(c.high), medium: f.int(c.medium), low: f.int(c.low) })}
              source={t("card.ledgerSource")}
            />
          );
        })}
      </div>
      <SourceNote className="mt-3">
        {ledger.baseline
          ? t("card.baseline", { share: `${f.dec(sharePct(ledger.baseline.share))} %`, label: ledger.baseline.label })
          : t("card.baselineNone")}
      </SourceNote>
    </div>
  );
}
