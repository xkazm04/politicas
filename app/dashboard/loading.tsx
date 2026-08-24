import { getTranslations } from "next-intl/server";

/*
 * Streaming shell for /dashboard. Next mounts this as the route's Suspense
 * fallback, so the app chrome + the velín masthead paint immediately while
 * the server is still inside `getDashboardData()` — it folds the chamber
 * ranking together with the money layer's `getMoneyData()`, which "walks the
 * whole money layer (~153 k contracts + ~154 k supplies edges) and takes
 * ~12 s cold" (features/dashboard/getDashboardData.ts:30; the same figure
 * features/dashboard/freshness.ts cites as the reason the read is memoized).
 * Only the FIRST request after `MONEY_MEMO_TTL_MS` expires (24 h, the same
 * window /penize and /denik share over the identical layer) pays it; the
 * notice says exactly that rather than promising a duration nobody measured
 * for this machine.
 */

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">
            politicas / {t("headerTag")}
          </span>
        </div>
      </header>
      <div className="px-6 pb-16">
        <div className="py-8">
          <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {t("title")}
            <span className="text-signal">.</span>
          </h1>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 max-w-2xl border-l-4 border-cobalt pl-4 text-base leading-relaxed text-steel"
          >
            <span className="block font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
              {t("loadingTitle")}
            </span>
            <span className="mt-2 block">{t("loadingBody")}</span>
          </p>
          {/* Placeholder rhythm of the stat strip — decorative only, carries no number. */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 w-full border-2 border-hairline bg-paper-strong" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
