/* Materialize the #9 winner — the cheap haiku classifier — as a Silver-layer
 * dataset. Runs a multi-class sem_classify over the real PSP10 vote_events and
 * writes one theme tag per roll call into the PGlite `vote_tag` table, which the
 * app's VoteTrack theme filter reads. This is the benchmark→feature→(automation)
 * loop: the proven cheapest reliable path (haiku for classification) turned into
 * product data. See docs/hybrid-benchmark-plan.md §4.
 *
 * Run against a COPY when the dev server holds ./.pglite (single-connection):
 *   cp -r .pglite .pglite-mat && DB_DRIVER=pglite PGLITE_PATH=.pglite-mat \
 *     npx tsx scripts/hybrid-bench/materialize-tags.ts --limit=200
 */
import { runClaude } from "./engine.js";
import { getStore } from "@/lib/db/store";
import type { VoteTagRow } from "@/lib/db/types";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

// Fixed theme taxonomy (slug — Czech gloss). The classifier picks ONE per vote.
const THEMES: ReadonlyArray<readonly [string, string]> = [
  ["procedura", "procedurální — pořad schůze, zařazení/přeřazení bodů, hlasovací procedura"],
  ["rozpocet-finance", "státní rozpočet, daně, veřejné finance, dotace, účetní závěrky"],
  ["personalie", "volba/jmenování/ustavení osob do orgánů, výborů, komisí, delegací, správních rad"],
  ["duvera-vlada", "důvěra/nedůvěra vládě, jmenování/odvolání členů vlády, programové prohlášení"],
  ["zdravotnictvi", "zdravotnictví, zdravotní pojišťovny, léčiva"],
  ["skolstvi-veda", "školství, věda, výzkum, vzdělávání"],
  ["bezpecnost-obrana", "bezpečnost, obrana, armáda, policie, zpravodajské služby"],
  ["justice-pravo", "justice, trestní/občanské právo, soudy, ústavní věci"],
  ["socialni-bydleni", "sociální oblast, důchody, dávky, práce, bydlení"],
  ["prostredi-zemedelstvi", "životní prostředí, zemědělství, energetika"],
  ["doprava-stavebnictvi", "doprava, stavebnictví, infrastruktura"],
  ["zahranici-eu", "zahraniční politika, EU, mezinárodní smlouvy"],
  ["jine", "nic z výše uvedeného"],
];
const THEME_SLUGS = new Set(THEMES.map(([s]) => s));

interface Item { votePspId: number; title: string; }

function classifyPrompt(batch: Item[]): string {
  const themeList = THEMES.map(([slug, gloss]) => `  ${slug} — ${gloss}`).join("\n");
  const list = batch.map((v) => `${v.votePspId} | ${v.title}`).join("\n");
  return `Klasifikuješ hlasování Poslanecké sněmovny ČR podle názvu do právě JEDNOHO tématu.

TÉMATA (slug — popis):
${themeList}

Pro KAŽDOU položku vyber nejvhodnější slug a uveď jistotu 0.0–1.0.
Vrať POUZE JSON pole, jeden objekt na položku: [{"id":<číslo z položky>,"theme":"<slug>","confidence":0.0}]

Položky (id | název):
${list}`;
}

function parseTags(text: string, batch: Item[]): Map<number, { theme: string; confidence: number }> {
  const out = new Map<number, { theme: string; confidence: number }>();
  const s = text.indexOf("["), e = text.lastIndexOf("]");
  if (s === -1 || e <= s) return out;
  try {
    const arr = JSON.parse(text.slice(s, e + 1)) as Array<{ id?: unknown; theme?: unknown; confidence?: unknown }>;
    arr.forEach((o, i) => {
      const id = typeof o.id === "number" ? o.id : batch[i]?.votePspId;
      if (id === undefined) return;
      const theme = typeof o.theme === "string" && THEME_SLUGS.has(o.theme) ? o.theme : "jine";
      const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.5;
      out.set(id, { theme, confidence });
    });
  } catch (err) {
    console.warn("[materialize-tags] unparseable classifier batch — defaulting to 'jine':", err instanceof Error ? err.message : err);
  }
  return out;
}

async function main() {
  const limit = Number(arg("limit", "3000")) || 3000;
  const batchSize = Number(arg("batch", "40")) || 40;
  const model = arg("model", "haiku");

  const store = await getStore();
  if (!store) {
    console.error("no store configured (set DB_DRIVER=pglite PGLITE_PATH=<copy>)");
    process.exit(1);
  }

  const events = await store.listVoteEvents({ termCode: "PSP10", limit });
  const items: Item[] = events
    .filter((e) => !e.voided)
    .map((e) => ({ votePspId: e.pspId, title: (e.titleLong ?? e.titleShort ?? e.titleNorm ?? "").trim() }))
    .filter((v) => v.title);
  console.log(`vote_events=${events.length}  titled non-voided=${items.length}  model=${model}\n`);

  const taggedAt = new Date().toISOString();
  const tags: VoteTagRow[] = [];
  let tokens = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    process.stdout.write(`classify ${i + 1}..${i + batch.length}/${items.length} ... `);
    const res = await runClaude(classifyPrompt(batch), { model });
    tokens += res.outputTokens;
    const parsed = parseTags(res.text, batch);
    for (const it of batch) {
      const t = parsed.get(it.votePspId) ?? { theme: "jine", confidence: 0 };
      tags.push({
        id: `vote_tag:${it.votePspId}`,
        votePspId: it.votePspId,
        theme: t.theme,
        confidence: t.confidence,
        model,
        method: "sem_classify",
        taggedAt,
      });
    }
    console.log(`ok (tok=${res.outputTokens})`);
  }

  const written = await store.upsertVoteTags(tags);
  const counts = await store.voteTagCountsByTheme();
  await store.close();

  console.log(`\nwrote ${written} vote_tag rows (model=${model}, ${tokens} output tokens).`);
  console.log("theme distribution:");
  for (const [theme, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${theme.padEnd(26)} ${n}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
