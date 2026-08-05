/*
 * Plausible — klientský helper pro vlastní události aktivačního trychtýře.
 *
 * ENV-GATED, cookieless: skript se vykresluje jen s nastaveným
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN (app/layout.tsx); bez něj `window.plausible`
 * neexistuje a trackEvent je úplný tichý no-op — týž vzor jako Sentry
 * v instrumentation-client.ts. Žádná fronta, žádné cookies, žádný consent.
 *
 * Trychtýř (viz .env.example):
 *   landing visit      → výchozí pageview, nic se nevolá ručně
 *   reached-zebricek   → pageview /zebricek, opět výchozí pageview
 *   mp-profile-view    → components/MpProfileBeacon.tsx na /poslanec/[id]
 *   weights-adjusted   → posuvník vah v features/civicscore (WeightPanel)
 */

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean> },
) => void;

/** Pošle vlastní událost do Plausible; bez skriptu (env nenastaven) no-op. */
export function trackEvent(
  event: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  const plausible = (window as Window & { plausible?: PlausibleFn }).plausible;
  if (typeof plausible !== "function") return;
  plausible(event, props ? { props } : undefined);
}
