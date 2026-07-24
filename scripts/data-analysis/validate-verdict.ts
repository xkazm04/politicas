// Deterministic gate for a /data-analysis subagent verdict — the executable
// version of the skill's "validate every subagent's JSON before using its
// scores" rule. Reads a file-path arg, or stdin if none. Prints OK + a summary,
// or every schema violation, and exits 1 on drift so the loop can discard/re-run
// instead of persisting a drifted score.
//
//   npm run da:validate-verdict -- path/to/subagent-output.txt
//   some-subagent | npm run da:validate-verdict
//
// Pass --rows=<slice-rows.json> (the same file the subagent analyzed) to ALSO
// check that every cited entityId is a real row in that slice — this is what
// catches a field name or a slice-wide phrase sitting in the entityId slot.
import { readFileSync } from "node:fs";
import { parseAndValidateVerdict } from "@/lib/analysis/verdict";

const rowsArg = process.argv.find((a) => a.startsWith("--rows="));

function readInput(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (arg) return readFileSync(arg, "utf8");
  return readFileSync(0, "utf8"); // fd 0 = stdin
}

function knownIds(): string[] | undefined {
  if (!rowsArg) return undefined;
  const rows: unknown = JSON.parse(readFileSync(rowsArg.slice("--rows=".length), "utf8"));
  if (!Array.isArray(rows)) return undefined;
  return rows.map((r) => (r as { id?: unknown }).id).filter((id): id is string => typeof id === "string");
}

const ids = knownIds();
const text = readInput();
const result = parseAndValidateVerdict(text, ids ? { knownEntityIds: ids } : {});

if (result.ok) {
  const v = result.value!;
  const scores = Object.entries(v.quality)
    .map(([k, c]) => `${k}=${c.score}`)
    .join(" ");
  console.log(`OK  slice="${v.slice}" rows=${v.rowsAnalyzed} composite=${v.composite}`);
  console.log(`    ${scores}`);
  console.log(
    `    gaps=${v.entityGaps.length} miscat=${v.miscategorized.length} patterns=${v.patterns.length} opps=${v.opportunities.length} backlog=${v.backlog.length}`,
  );
  process.exit(0);
}

console.error(`DRIFT — ${result.errors.length} problem(s); discard scores and re-run the subagent:`);
for (const e of result.errors) console.error(`  • ${e}`);
process.exit(1);
