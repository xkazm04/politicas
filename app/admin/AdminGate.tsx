import Link from "next/link";
import SectionRule from "@/features/shared/components/SectionRule";
import { submitAdminToken } from "./gateActions";
import type { AdminGateStatus } from "./accessGate";

/*
 * Zavřené dveře před /admin. Server component — token se posílá obyčejným
 * <form action={serverAction}>, takže se nikdy nedostane do klientského
 * bundlu a stránka funguje i bez JavaScriptu.
 *
 * Tři stavy, tři různé věty (nikdy jedna univerzální): konzole není nastavená /
 * ještě ses neidentifikoval / token nesedí. Nesplývají schválně — „nenastaveno"
 * je provozní fakt o prostředí, ne selhaný pokus o přihlášení.
 *
 * Vizuálně drží Konstrukt jako zbytek /admin (holá route bez levé lišty):
 * hlavička s linkou → plakátový titul → červená linka → text.
 */

export default function AdminGate({ status }: { status: Exclude<AdminGateStatus, "ok"> }) {
  const configured = status !== "not-configured";

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
            <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
              <rect width="32" height="32" className="fill-signal" />
              <circle cx="16" cy="16" r="9" className="fill-paper" />
              <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
            </svg>
            <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
          </Link>
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ admin</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
          {configured ? "přístup jen pro operátora" : "konzole není v tomto prostředí nastavená"}
        </p>
        <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {configured ? "Zavřeno" : "Nenastaveno"}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>

        {configured ? (
          <>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-steel">
              Za těmito dveřmi je interní provozní přehled — postup analytických smyček, fronta
              lidské revize a stav systému. Není to veřejná plocha. Zadejte operátorský token
              (<span className="font-mono text-ink">ADMIN_TOKEN</span>); platí půl dne a drží se
              jen v tomto prohlížeči.
            </p>

            {status === "unauthorized" && (
              <p className="mt-6 border-l-4 border-signal bg-signal/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
                token nesouhlasí — zkuste to znovu
              </p>
            )}

            <form action={submitAdminToken} className="mt-8 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
                  token operátora
                </span>
                <input
                  type="password"
                  name="token"
                  autoComplete="off"
                  placeholder="ADMIN_TOKEN"
                  className="w-72 border-2 border-ink bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus:border-signal"
                />
              </label>
              <button
                type="submit"
                className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:bg-signal hover:border-signal"
              >
                Odemknout
              </button>
            </form>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-steel">
              Jeden sdílený token, jeden operátor — ne uživatelské účty. Porovnává se
              v konstantním čase na serveru; nesprávný pokus se nikam nezapisuje.
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-steel">
              V tomhle prostředí není nastavená proměnná{" "}
              <span className="font-mono text-ink">ADMIN_TOKEN</span>, takže operátorskou konzoli
              nemá co odemknout. Přístup je proto <strong className="text-ink">zavřený</strong> —
              nenastavený zámek neznamená otevřené dveře. Žádná interní data se nenačítají.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel">
              Nastavení: <span className="font-mono text-ink">ADMIN_TOKEN</span> v{" "}
              <span className="font-mono">.env.local</span> (lokálně) nebo v proměnných prostředí
              cílového nasazení — jméno je konstantní, hodnota patří tomu prostředí. Viz{" "}
              <span className="font-mono">.env.example</span> a docs/deploy/vercel.md.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-10 inline-block font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          ← zpět na Politicas
        </Link>
      </div>
    </main>
  );
}
