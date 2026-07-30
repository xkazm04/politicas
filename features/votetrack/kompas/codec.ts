// URL codec for the reader's answers — the whole result state lives in the
// address (?hlasy=92793a-92810n-…), so a result is shareable with no account
// and no server state. Same discipline as features/civicscore/lens.ts:
// the address is a claim; an invalid value is NEVER silently repaired into
// the nearest valid one (that would claim someone else's answers) — it
// decodes to null and the UI drops it from the address.
//
// Canonical form: parts sorted by vote id ascending, `<pspId>a` (pro) /
// `<pspId>n` (proti), joined by "-"; skipped questions are simply absent;
// an empty answer set encodes to null (clean address). Round-trip tested in
// codec.test.ts.

import type { Answer } from "./score";

/** Query parametr nesoucí odpovědi. Česky, jako `?vahy=` u žebříčku. */
export const ANSWERS_PARAM = "hlasy";

const PART = /^(\d{1,7})([an])$/;

/** Answers → URL value, canonical (ascending ids); empty → null. */
export function encodeAnswers(answers: ReadonlyMap<number, Answer>): string | null {
  if (answers.size === 0) return null;
  return [...answers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, answer]) => `${id}${answer === "pro" ? "a" : "n"}`)
    .join("-");
}

/**
 * URL value → answers, or null for ANYTHING non-canonical: bad part shape,
 * zero/unsafe id, duplicate or non-ascending ids. Never repaired.
 */
export function decodeAnswers(raw: string | null | undefined): Map<number, Answer> | null {
  if (!raw) return null;
  const out = new Map<number, Answer>();
  let prev = 0;
  for (const part of raw.split("-")) {
    const m = PART.exec(part);
    if (!m) return null;
    const id = Number(m[1]);
    if (!Number.isSafeInteger(id) || id <= prev) return null;
    out.set(id, m[2] === "a" ? "pro" : "proti");
    prev = id;
  }
  return out;
}
