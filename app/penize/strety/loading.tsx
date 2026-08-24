import { getTranslations } from "next-intl/server";

/*
 * Streaming shell for /penize/strety. Next mounts this as the route's
 * Suspense fallback, so the app chrome + masthead paint immediately while
 * the server is still inside `getCollisionCandidates()`.
 *
 * Two costs, not one — same lesson as app/kompas/loading.tsx: don't promise
 * the worse one unconditionally. (1) The money layer is read unconditionally
 * via `loadMoneyLayer()` — the same ~153 731-row supplies fold
 * features/dashboard/getDashboardData.ts:30 measures at "~12 s cold" (shared
 * `MONEY_MEMO_TTL_MS` memo with /penize and /dashboard). (2) The vote ledger
 * + legislative layer are read ONLY when at least one tie clears the join's
 * entry gate (`tieEntersJoin`) — on today's live graph all 211 ties sit
 * `pending_review`, so that gate is empty and the ~410 000-row read never
 * happens. Before that short-circuit existed, the unconditional read
 * "změřeno 15 800 ms studeně, 10 409 ms znovu" (features/money/collisions/
 * getCollisionCandidates.ts:18) — the figure this loader would pay again the
 * day a reviewer confirms the first tie. The notice below names the read
 * that is actually happening, not the worse one that isn't, today.
 */

export default async function StretyLoading() {
  const t = await getTranslations("money");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ penize / strety</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("strety.title")}
          <span className="text-signal">.</span>
        </h1>
        <p
          role="status"
          aria-live="polite"
          className="mt-6 max-w-2xl border-l-4 border-cobalt pl-4 text-base leading-relaxed text-steel"
        >
          <span className="block font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
            {t("loadingTitle")}
          </span>
          <span className="mt-2 block">{t("strety.loadingBody")}</span>
        </p>
        {/* Placeholder rhythm of the candidate rows — decorative, carries no number. */}
        <div className="mt-10 space-y-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full border-2 border-hairline bg-paper-strong" />
          ))}
        </div>
      </div>
    </main>
  );
}
