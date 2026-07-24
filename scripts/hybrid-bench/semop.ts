// LOTUS-style semantic operator: sem_filter over a batch of items. One LLM call
// labels a whole batch (never one call per row), returning {match, confidence}
// per item. This is the LLM "Semantic Plane"; the deterministic baseline + the
// scoring live in run.ts (the "Execution Plane").

import { runClaude, type RunOpts } from "./engine.js";

export interface Item {
  id: string;
  title: string;
}

export interface Label {
  id: string;
  match: boolean;
  confidence: number; // 0..1, the model's own certainty (drives cascade escalation)
}

export interface SemFilterResult {
  labels: Map<string, Label>;
  outputTokens: number;
  calls: number;
}

function buildPrompt(question: string, batch: Item[]): string {
  const list = batch.map((it, i) => `${i + 1}. id=${it.id} | ${it.title}`).join("\n");
  return `Klasifikuješ hlasování Poslanecké sněmovny ČR podle jejich názvu.

PREDIKÁT: ${question}

Pro KAŽDOU položku rozhodni, zda název hlasování predikátu odpovídá, a uveď svou jistotu 0.0–1.0.
Vrať POUZE JSON pole, jeden objekt na položku, ve stejném pořadí, nic jiného:
[{"id":"<id>","match":true|false,"confidence":0.0}]

Položky:
${list}`;
}

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function parseLabels(text: string, batch: Item[]): Label[] {
  const arr = extractJsonArray(text) ?? [];
  const byId = new Map<string, Label>();
  arr.forEach((raw, i) => {
    const o = (raw ?? {}) as { id?: unknown; match?: unknown; confidence?: unknown };
    // Map by id when present + valid, else fall back to positional order.
    const id = typeof o.id === "string" && batch.some((b) => b.id === o.id) ? o.id : batch[i]?.id;
    if (!id) return;
    const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.5;
    byId.set(id, { id, match: o.match === true, confidence });
  });
  return [...byId.values()];
}

export async function semFilter(
  items: Item[],
  question: string,
  opts: RunOpts & { batchSize?: number } = {},
): Promise<SemFilterResult> {
  const batchSize = opts.batchSize ?? 40;
  const labels = new Map<string, Label>();
  let outputTokens = 0;
  let calls = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const res = await runClaude(buildPrompt(question, batch), opts);
    outputTokens += res.outputTokens;
    calls++;
    for (const l of parseLabels(res.text, batch)) labels.set(l.id, l);
    // Any row the model dropped → low-confidence negative (so the cascade escalates it).
    for (const it of batch) if (!labels.has(it.id)) labels.set(it.id, { id: it.id, match: false, confidence: 0 });
  }
  return { labels, outputTokens, calls };
}
