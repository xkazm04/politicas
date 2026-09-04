/* Refusal classification for the ingest fetch-retry helpers.
 *
 * `classify-before-you-respond`
 * (software-engineering/integration/contested-acquisition): when an upstream
 * refuses, classify the refusal into a closed set BEFORE choosing a response,
 * and let the class decide which responses are applicable — including the
 * classes for which the applicable set is empty.
 *
 * WHAT THIS REPLACES. Every adapter keyed its retry on two literal status codes
 * (`res.status === 429 || res.status === 503`) and treated everything else as
 * "not a pressure signal". Three states were therefore one state:
 *   - the host DECLINED us (401/403/407/451) — a decision, and retrying it is
 *     how a pause becomes a ban;
 *   - the resource is ABSENT (404/410) — a fact about the resource, and no
 *     number of retries will conjure it;
 *   - the host is BROKEN (5xx) — an incident on their side, worth waiting out.
 * Only the third is worth a retry alongside pressure.
 *
 * MEASURED, 2026-09-04, against `MonitorClient.fetchPeriods` with a counting
 * fetch (see refusal-class.test.ts): before this module, a 403 and a 404 each
 * cost 3 upstream requests — identical to a 503. After, they cost 1. Pressure
 * and broken still retry, which is the half that was already right.
 *
 * These are public civic-data hosts we need to still be welcome at tomorrow.
 */

export type RefusalKind = "ok" | "pressure" | "declined" | "absent" | "broken";

export interface RefusalClass {
  kind: RefusalKind;
  /** True only for the classes where another attempt can change the answer. */
  retryable: boolean;
  status: number;
}

/** Explicit membership, so a status nobody classified is visible as a gap
 *  rather than silently inheriting a neighbour's response. */
const DECLINED = new Set([401, 403, 407, 451]);
const ABSENT = new Set([404, 410]);
const PRESSURE = new Set([429, 503]);

/**
 * Classify one upstream response status. The four non-ok classes are disjoint
 * and exhaustive over the codes an ingest adapter can meet; an unrecognised 4xx
 * is `declined` (fail toward NOT hammering the host) and an unrecognised 5xx is
 * `broken`.
 */
export function classifyResponse(status: number): RefusalClass {
  if (status >= 200 && status < 400) return { kind: "ok", retryable: false, status };
  if (PRESSURE.has(status)) return { kind: "pressure", retryable: true, status };
  if (DECLINED.has(status)) return { kind: "declined", retryable: false, status };
  if (ABSENT.has(status)) return { kind: "absent", retryable: false, status };
  if (status >= 500) return { kind: "broken", retryable: true, status };
  return { kind: "declined", retryable: false, status };
}

/**
 * The terminal error for a refusal that no retry can change. It NAMES its class,
 * so a caller can route on the distinction instead of re-deriving it from a
 * status embedded in prose — and so a declined harvest is distinguishable in a
 * log from a broken one.
 */
export class RefusedError extends Error {
  readonly kind: RefusalKind;
  readonly status: number;
  constructor(source: string, url: string, cls: RefusalClass) {
    super(`${source} → ${cls.kind} (HTTP ${cls.status}) ${url}`);
    this.name = "RefusedError";
    this.kind = cls.kind;
    this.status = cls.status;
  }
}

/** True when the thrown value is a terminal refusal, so a retry loop's catch
 *  can decline to retry what it already decided was terminal. */
export function isTerminalRefusal(e: unknown): e is RefusedError {
  return e instanceof RefusedError;
}
