import { getTranslations } from "next-intl/server";

/*
 * Streaming shell for /kompas — same reason as app/hlasovani/loading.tsx: the
 * compass derives from the same ~406 000-ballot ledger, so a cold request would
 * otherwise show nothing at all for the length of that read.
 */

export default async function KompasLoading() {
  const t = await getTranslations("votetrack");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ kompas</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {t("kompas.title")}
          <span className="text-signal">.</span>
        </h1>
        <p role="status" aria-live="polite" className="mt-6 max-w-2xl border-l-4 border-cobalt pl-4 text-base leading-relaxed text-steel">
          <span className="block font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
            {t("loadingTitle")}
          </span>
          <span className="mt-2 block">{t("kompas.loadingBody")}</span>
        </p>
        {/* Placeholder rhythm of the question grid — decorative, carries no number. */}
        <div className="mt-10 grid gap-6 md:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 w-full border-2 border-hairline bg-paper-strong" />
          ))}
        </div>
      </div>
    </main>
  );
}
