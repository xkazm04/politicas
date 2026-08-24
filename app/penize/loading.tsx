import { getTranslations } from "next-intl/server";

/*
 * Streaming shell for /penize. Next mounts this as the route's Suspense
 * fallback, so the app chrome + the ledger masthead paint immediately while
 * the server is still inside `getMoneyData()`. It walks the money layer's
 * shared supplies fold — "`listKgEdges({rel:"supplies"})` returns ~153 731
 * rows" (features/money/moneyLoader.ts:366) — the same read
 * features/dashboard/getDashboardData.ts:30 measures at "~12 s cold", since
 * /dashboard, /denik and /penize/strety all read the identical layer through
 * the same `MONEY_MEMO_TTL_MS` cross-request memo. Only the FIRST request
 * after that memo expires (24 h) pays it; the notice says exactly that
 * rather than promising a duration nobody measured for this machine.
 */

export default async function PenizeLoading() {
  const t = await getTranslations("money");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ followthemoney</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {t("title")}
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
          <span className="mt-2 block">{t("loadingBody")}</span>
        </p>
        {/* Placeholder rhythm of the ledger rows — decorative, carries no number. */}
        <div className="mt-10 space-y-3" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 w-full border-b border-hairline bg-paper-strong" />
          ))}
        </div>
      </div>
    </main>
  );
}
