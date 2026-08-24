import { getTranslations } from "next-intl/server";

/*
 * Streaming shell for /denik. Next mounts this as the route's Suspense
 * fallback, so the app chrome + the deník masthead paint immediately while
 * the server is still inside `getDenikData()`. It composes four layers, and
 * the first two are the expensive ones: "Dávkové vrstvy (1+2) jsou drahé
 * (~12 s studený start peněz) a mění se jen s `npm run da:kg-compute`"
 * (features/denik/getDenikData.ts:24) — the money layer (`getMoneyData`) and
 * the legislative layer (`getLawData`) share the same `MONEY_MEMO_TTL_MS`
 * cross-request memo /dashboard and /penize use over the identical graph.
 * Only the FIRST request after that memo expires pays the ~12 s; the notice
 * says exactly that, never a duration nobody measured for this machine.
 */

export default async function DenikLoading() {
  const t = await getTranslations("denik");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ denik</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("title")}
          <span className="text-signal">.</span>
        </h1>
        <p
          role="status"
          aria-live="polite"
          className="mt-6 max-w-2xl border-l-4 border-cobalt pl-4 text-base leading-relaxed text-steel-aa"
        >
          <span className="block font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
            {t("loadingTitle")}
          </span>
          <span className="mt-2 block">{t("loadingBody")}</span>
        </p>
        {/* Placeholder rhythm of the chronological ledger — decorative, carries no number. */}
        <div className="mt-10 space-y-3" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full border-b border-hairline bg-paper-strong" />
          ))}
        </div>
      </div>
    </main>
  );
}
