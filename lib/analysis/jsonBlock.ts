// The JSON block a subagent returns, extracted and parsed ONCE.
//
// kg-verdict.ts, law-verdict.ts and verdict.ts each carried a byte-identical
// `extractJsonBlock` and repeated the same prologue in their parseAndValidate*:
// extract → "no JSON block found" → JSON.parse → "JSON parse error: …" → validate.
// One rule in three places is a rule that drifts; since 2026-09-06 the three
// contracts re-export this one and validate what it hands them.

/** The first ```json fence whose body opens with `{`; else the outermost braces; else null. */
export function extractJsonBlock(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim().startsWith("{")) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

/** Extract + parse. A miss and a malformed block are NAMED, never thrown — the
 *  validators put the message straight into their `errors`. */
export function parseJsonBlock(text: string): { parsed: unknown; error: null } | { parsed: null; error: string } {
  const raw = extractJsonBlock(text);
  if (raw === null) return { parsed: null, error: "no JSON block found in subagent output" };
  try {
    return { parsed: JSON.parse(raw) as unknown, error: null };
  } catch (e) {
    return { parsed: null, error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
}
