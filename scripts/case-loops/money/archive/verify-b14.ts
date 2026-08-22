/* Money loop — batch 014 verification: what does `/penize` render NOW?
 *
 * Reads the LIVE store through the very same loader the page uses — not a re-derivation
 * of the arithmetic, which would only prove that two copies of my own assumption agree.
 * The kernel's rule after batch 006: a batch that changes a number must show the number
 * changing on the surface, not in the payload that fed it.
 *
 *   npx tsx scripts/case-loops/money/verify-b14.ts
 */
import { getMoneyData } from "@/features/money/getMoneyData";

async function main() {
  const data = await getMoneyData();
  if (!data) throw new Error("getMoneyData returned null — the surface is on the fallback");
  const cz = (n: number) => Math.round(n).toLocaleString("cs-CZ");
  const s = data.stats;
  console.log(`pass                       ${data.pass}`);
  console.log(`attributable (headline)    ${cz(s.contractCzkAttributable)} CZK`);
  console.log(`steward                    ${cz(s.contractCzkSteward)} CZK`);
  console.log(
    `excluded (non-reaching)    ${cz(s.contractsExcludedNonReaching.czk)} CZK over ${s.contractsExcludedNonReaching.count} contracts`,
  );
  console.log(
    `shared-recipient (kept)    ${cz(s.contractsSharedRecipients.czk)} CZK over ${s.contractsSharedRecipients.count} contracts`,
  );
  console.log(`ties                       ${s.totalTies} (pending ${s.pendingTies})`);
  console.log(`MPs with ties              ${s.mpsWithTies}`);

  const before = 42_893_747_930;
  const delta = before - s.contractCzkAttributable;
  console.log(
    `\nheadline before batch 014  ${cz(before)} CZK  ->  delta ${cz(delta)} CZK (${((delta / before) * 100).toFixed(2)} %)`,
  );

  // Teplárny Brno — the company the finding is about, read through the ledger.
  const hladik = data.mps.flatMap((m) => m.ties).filter((t) => t.ico === "46347534");
  for (const t of hladik) {
    console.log(`\n${t.company} (${t.ico}) — ${t.role} · ${t.tieClass} · ${t.reviewState}`);
    console.log(`   contracts counted ${t.contractCount} · ${cz(t.contractCzk)} CZK`);
  }
}

// `await`, ne `main(); process.exit(0)` — to druhé ukončí proces DŘÍV, než se
// promisa vyřeší, takže skript skončí nulou a nevytiskne nic. Bez explicitního
// konce zas PGlite drží event loop otevřený a skript nikdy nedoběhne; visící
// proces pak drží datový adresář a zpomaluje každé další čtení.
main().then(() => process.exit(0));
