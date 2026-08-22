/* Money loop — batch 005, Q-money-13: build the props-edit PAYLOAD (not a live edit)
 * for stale prop-CONTENT mentions of the purged bogus company IČO 04627695
 * ("OSVČ" false-edge purge, batch 004 — see purge-osvc.ts header for the full story).
 *
 * A structural edge/node check can't see prose/JSON text inside `props` — this script
 * locates every kg_node whose props mention the literal IČO string, and proposes an
 * ANNOTATED correction (never a silent delete — the dossier prose should stay honest
 * about what was found and later corrected). It does NOT write to the store: the
 * effort/law props are owned by sibling loops, so this money-loop script only emits
 * a payload for the orchestrator to review and apply.
 *
 * READ-ONLY against the store. Run against a COPY, never live ./.pglite:
 *
 *   PGLITE_PATH=./.pglite-copy-money-q13 npx tsx scripts/case-loops/money/build-stale-ico-payload.ts
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TARGET_ICO = "04627695";
const PAYLOAD_PATH = "docs/data-analysis/case-money/payloads/batch-005-stale-ico-mentions.json";

const PURGE_CONTEXT =
  "batch-004 Q-money-11: 49 false `linked_to` edges to company:ico:04627695 (an exact-name-match " +
  'bug matched the literal ARES obchodniJmeno string "OSVČ" against 49 MPs\' loosely-described ' +
  "occupations) were purged as confirmed false_edge_suspected; the company node itself was also " +
  "deleted (nothing else referenced it). See scripts/case-loops/money/purge-osvc.ts header and " +
  "docs/data-analysis/case-money/handoff.md batch-004 §5.";

const CZ_ANNOTATION =
  " [BATCH-005 DOPLNĚNÍ, driver, money-loop]: Money-loop (batch 004) tuto otázku formálně uzavřel: " +
  "IČO 04627695 NENÍ neresolvovaný datový placeholder, ale skutečná, s tímto poslancem nesouvisející " +
  'firma (Agrární demokratická strana, registrovaná mikro-strana), jejíž pole ARES `obchodniJmeno` ' +
  'obsahuje doslovný textový řetězec „OSVČ" — chyba přesného name-matchingu (pickExactIco v ' +
  "lib/analysis/money-feed.ts) tuto firmu chybně spárovala se 49 poslanci, jejichž povolání bylo v " +
  'datech Hlídače popsáno volně jako „OSVČ". Všech 49 nulových hran `linked_to` → ' +
  "company:ico:04627695 bylo v batch 004 smazáno jako potvrzené false_edge_suspected; uzel " +
  "company:ico:04627695 byl rovněž smazán, protože na něj nic jiného neodkazovalo. Úsudek tohoto " +
  "záznamu (nejde o ověřenou vazbu) byl správný už předtím — tato poznámka jen formálně potvrzuje " +
  "uzávěr, ne odvolání předchozího hodnocení.";

const EN_ANNOTATION =
  " [BATCH-005 UPDATE, driver, money-loop]: Money-loop batch 004 formally closed this question: " +
  "IČO 04627695 is NOT an unresolved data-pipeline placeholder but a real, unrelated entity " +
  "(Agrární demokratická strana, a registered micro political party) whose ARES `obchodniJmeno` " +
  'field literally contains the string "OSVČ" — an exact-name-matching bug (pickExactIco in ' +
  "lib/analysis/money-feed.ts) incorrectly linked this company to 49 MPs whose occupation was " +
  'loosely described as "OSVČ" in Hlídač data. All 49 zero-value `linked_to` edges to ' +
  "company:ico:04627695 were deleted in batch 004 as confirmed false_edge_suspected; the " +
  "company:ico:04627695 node itself was also deleted (nothing else referenced it). This entry's " +
  "own conclusion (no individuating substance / not a conflict) already stood — this note only " +
  "formalizes closure of the data-quality question already flagged here.";

interface Mention {
  nodeId: string;
  nodeKind: string;
  propKey: string;
  currentText: string;
  proposedText: string;
  rationale: string;
}

// NOTE: language is keyed off nodeKind/propKey, not sniffed from the text itself —
// a naive diacritic sniff misfires on borrowed terms like "ičo" appearing inside
// otherwise-English bill prose (the "č" alone false-positives as Czech). In this
// corpus person `effort_notes` are consistently Czech and bill `forensic_*` props
// are consistently English (confirmed by inspecting the scan output).
function isCzech(nodeKind: string, propKey: string): boolean {
  return nodeKind === "person" || propKey.startsWith("effort_notes");
}

async function main() {
  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH to a copy/fixture — never the live ./.pglite)");
    process.exit(1);
  }

  const nodes = await store.listKgNodes({ limit: 2_000_000 });
  console.log(`scanned ${nodes.length} kg_node rows for "${TARGET_ICO}"`);

  const mentions: Mention[] = [];

  for (const n of nodes) {
    const props = (n.props ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(props)) {
      const entries: { entry: unknown; index: number | null }[] = Array.isArray(value)
        ? value.map((entry, i) => ({ entry, index: i }))
        : [{ entry: value, index: null }];

      for (const { entry, index } of entries) {
        const isString = typeof entry === "string";
        const s = isString ? (entry as string) : JSON.stringify(entry);
        if (!s || !s.includes(TARGET_ICO)) continue;

        const propKey = index !== null ? `${key}[${index}]` : key;
        let currentText: string;
        let proposedText: string;
        const annotation = isCzech(n.kind, propKey) ? CZ_ANNOTATION : EN_ANNOTATION;

        if (isString) {
          currentText = entry as string;
          proposedText = currentText + annotation;
        } else if (entry && typeof entry === "object" && "claim" in (entry as Record<string, unknown>)) {
          // structured forensic_citations entry — annotate the claim text, keep source/kind as-is
          // (source stays a truthful historical record of what was cited; the claim gets the caveat).
          const obj = entry as Record<string, unknown>;
          currentText = JSON.stringify(obj);
          const proposedObj = { ...obj, claim: `${obj.claim as string}${annotation}` };
          proposedText = JSON.stringify(proposedObj);
        } else {
          currentText = JSON.stringify(entry);
          proposedText = currentText; // no safe structured field to append to — flag as ambiguous
        }

        const rationale =
          currentText === proposedText
            ? "AMBIGUOUS: structured prop with no obvious text field to annotate — needs manual review before payload application."
            : `Node's props mention purged IČO ${TARGET_ICO} as free text; annotated with the batch-004 purge outcome rather than silently deleted, to keep the dossier/citation trail honest.`;

        mentions.push({ nodeId: n.id, nodeKind: n.kind, propKey, currentText, proposedText, rationale });
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    batch: 5,
    track: "money",
    item: "Q-money-13",
    targetIco: TARGET_ICO,
    purgeContext: PURGE_CONTEXT,
    counts: {
      totalMentions: mentions.length,
      distinctNodes: new Set(mentions.map((m) => m.nodeId)).size,
      byKind: mentions.reduce<Record<string, number>>((acc, m) => {
        acc[m.nodeKind] = (acc[m.nodeKind] ?? 0) + 1;
        return acc;
      }, {}),
      ambiguous: mentions.filter((m) => m.currentText === m.proposedText).length,
    },
    mentions,
  };

  writeFileSync(PAYLOAD_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`\nwrote ${mentions.length} mention(s) across ${payload.counts.distinctNodes} node(s) to ${PAYLOAD_PATH}`);
  console.log("by kind:", payload.counts.byKind);
  console.log("ambiguous (needs manual review):", payload.counts.ambiguous);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
