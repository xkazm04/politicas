/* ONE retry rule for the token-free Registr smluv sweeps (scan-sweep 2026-09-07).
 *
 * company-contract-sweep.ts and parent-contract-sweep.ts each carried a `withBackoff` with
 * its own idea of "transient": the first tested the status right after the client's arrow
 * (`→ 429 ` / `→ 5xx `), the second `msg.includes("429")` - which also matched an IČO carrying
 * those digits in the URL the message quotes, so a 404 for such a company was retried three
 * times as a rate limit. SmlouvyClient throws prose (`smlouvy.gov.cz search → <status> (<url>)`),
 * so the status is read from that shape here and nowhere else; the day the client throws
 * `RefusedError` (backlog card, ingest-external-sources) this is the one place to change. */

const SLEEP = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 429 (rate limit), any 5xx (the site returned a real 500 mid-sweep on 2026-07-27) and
 *  transport failures are transient. A header-drift or parse error is NOT - retrying those
 *  just repeats a bug. */
export function retryableSmlouvyFailure(msg: string): boolean {
  return /→ (?:429|5\d\d) /.test(msg) || msg.includes("fetch failed");
}

/** Run `run`, backing off through `waits` on a transient failure. Returns the result or
 *  rethrows the last error - never converts a rate limit into an empty result set. */
export async function withBackoff<T>(label: string, run: () => Promise<T>, waits: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!retryableSmlouvyFailure(msg) || attempt >= waits.length) throw e;
      console.log(`\n      rate-limited on ${label} — backing off ${waits[attempt] / 1000}s (${attempt + 1}/${waits.length})`);
      await SLEEP(waits[attempt]);
    }
  }
}
