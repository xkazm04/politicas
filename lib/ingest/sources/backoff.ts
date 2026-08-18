/* Jittered exponential backoff for the ingest fetch-retry helpers.
 *
 * `bound-the-blast-radius`: a plain `min(cap, base * 2**attempt)` backoff has no
 * randomness, so any two adapter runs that hit the same upstream 429/503 retry
 * in lockstep — re-colliding at each identical delay, a synchronized micro-storm
 * against a public civic-data host. Full jitter spreads the retries uniformly
 * across [0, ceiling], which de-synchronises colliding callers.
 */

/** Exponential ceiling for an attempt (0-based), clamped to `capMs`. */
export const backoffCeilingMs = (attempt: number, baseMs: number, capMs: number): number =>
  Math.min(capMs, baseMs * 2 ** attempt);

/**
 * Full-jitter delay: a uniform sample from [0, ceiling], where the ceiling is
 * the clamped exponential. `rand` is injectable for tests (defaults to
 * Math.random). The result is always in [0, capMs].
 */
export const backoffDelayMs = (
  attempt: number,
  baseMs: number,
  capMs: number,
  rand: () => number = Math.random,
): number => rand() * backoffCeilingMs(attempt, baseMs, capMs);
