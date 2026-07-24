// LOTUS-style semantic operator: sem_agg over a group of votes (one PSP session)
// → a synthesized summary. Two modes that map the key design-space axis:
//   • aggregate — the LLM sees the RAW votes and must count + summarize itself
//   • narrate   — the LLM sees the DETERMINISTIC tally and only writes the prose
// Count fidelity (aggregate mode) vs given-numbers (narrate mode) is the whole
// question: can the LLM aggregate, or must hard data do the arithmetic?

import { runClaude, type RunOpts } from "./engine.js";

export interface Vote {
  title: string;
  outcome: string;
}

export interface Facts {
  n: number;
  accepted: number;
  rejected: number;
  dateFrom: string | null;
  dateTo: string | null;
  topTitles: string[];
}

export interface AggResult {
  headline: string;
  nVotes: number | null;
  nAccepted: number | null;
  nRejected: number | null;
  dominantOutcome: string | null;
  summary: string;
}

export interface SemAggResult {
  result: AggResult;
  inputTokens: number;
  outputTokens: number;
}

function aggregatePrompt(session: string, votes: Vote[]): string {
  const list = votes.map((v, i) => `${i + 1}. ${v.title} | ${v.outcome}`).join("\n");
  return `Shrnuješ jednu schůzi hlasování Poslanecké sněmovny ČR. Níže jsou VŠECHNA jmenovitá hlasování schůze ${session} (název | výsledek).

Spočítej a vytvoř JSON objekt (a nic jiného):
{"headline":"<krátký titulek>","n_votes":<int>,"n_accepted":<int>,"n_rejected":<int>,"dominant_outcome":"accepted|rejected","summary":"<2–3 věty česky, co schůze rozhodla>"}

Počítej PEČLIVĚ. Hlasování:
${list}`;
}

function narratePrompt(session: string, f: Facts): string {
  return `Shrnuješ jednu schůzi hlasování Poslanecké sněmovny ČR. Toto jsou DETERMINISTICKÁ fakta (autoritativní — NEPŘEPOČÍTÁVEJ je):
schůze=${session}, počet hlasování=${f.n}, přijato=${f.accepted}, zamítnuto=${f.rejected}, období ${f.dateFrom ?? "?"}–${f.dateTo ?? "?"}
Významná hlasování: ${f.topTitles.map((t) => `„${t}“`).join("; ")}

Vytvoř JSON objekt (a nic jiného):
{"headline":"<krátký titulek>","dominant_outcome":"accepted|rejected","summary":"<2–3 věty česky, co schůze rozhodla>"}`;
}

function extractObject(text: string): Record<string, unknown> {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return {};
  try {
    const v: unknown = JSON.parse(text.slice(s, e + 1));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function semAgg(
  session: string,
  input: { votes: Vote[]; facts: Facts },
  mode: "aggregate" | "narrate",
  opts: RunOpts = {},
): Promise<SemAggResult> {
  const prompt = mode === "aggregate" ? aggregatePrompt(session, input.votes) : narratePrompt(session, input.facts);
  const res = await runClaude(prompt, opts);
  const o = extractObject(res.text);
  // In narrate mode the counts are given (authoritative), not asked for.
  const result: AggResult = {
    headline: str(o.headline),
    nVotes: mode === "aggregate" ? num(o.n_votes) : input.facts.n,
    nAccepted: mode === "aggregate" ? num(o.n_accepted) : input.facts.accepted,
    nRejected: mode === "aggregate" ? num(o.n_rejected) : input.facts.rejected,
    dominantOutcome: str(o.dominant_outcome) || null,
    summary: str(o.summary),
  };
  return { result, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
}
