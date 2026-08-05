"use client";

/*
 * CITOVAT TENTO POHLED — afordance trvalé citace nad plátnem grafu.
 *
 * Jakmile má čtenář na plátně něco citovatelného (vybraný uzel, kurátorskou
 * trasu, nebo spočítanou cestu „Spoj dva body"), tahle karta vydá trvalý
 * odkaz /graf/p/<ref>: server znovu rozliší obsah pohledu, otiskne ho do
 * adresy (citeViewAction) a klient adresu zkopíruje. Novinář pak necituje
 * screenshot, ale adresu, která nese celý stav pohledu i otisk důkazů.
 *
 * Adresa se skládá až na klientu z window.location.origin (vzor
 * CopyExhibitLink, features/dashboard/ExhibitPage.tsx); selhání schránky se
 * pojmenuje a odkaz zůstane vypsaný k ručnímu výběru — nikdy tiché nic.
 *
 * Texty jdou přes katalog překladů (graph.cite.* v messages/*.json).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { citeViewAction } from "../graphActions";
import type { GraphViewState } from "../permalink";

export default function CiteView({ state }: { state: GraphViewState }) {
  const t = useTranslations("graph");
  const [status, setStatus] = useState<"idle" | "working" | "copied" | "failed" | "unissued">("idle");
  const [issuedPath, setIssuedPath] = useState<string | null>(null);
  const reqRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nový stav pohledu = jiná citace; vydaný odkaz starého pohledu nesmí
  // zůstat viset. Úprava odvozeného stavu při renderu (vzor VariantMapa).
  const stateKey = JSON.stringify(state);
  const [lastKey, setLastKey] = useState(stateKey);
  if (lastKey !== stateKey) {
    setLastKey(stateKey);
    setIssuedPath(null);
    setStatus("idle");
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const settle = (s: "copied" | "failed" | "unissued") => {
    setStatus(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 3600);
  };

  const cite = async () => {
    const req = ++reqRef.current;
    setStatus("working");
    const issued = await citeViewAction(state);
    if (reqRef.current !== req) return;
    if (issued === null) {
      settle("unissued");
      return;
    }
    setIssuedPath(issued.path);
    const url = new URL(issued.path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      settle("copied");
    } catch (err) {
      // Clipboard API může být zakázané (permissions, http) — odkaz je
      // vypsaný pod tlačítkem, takže selhání jen pojmenujeme.
      console.error("citace grafu: kopírování odkazu selhalo", err);
      settle("failed");
    }
  };

  return (
    <div className="border-2 border-ink bg-paper px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={cite}
          disabled={status === "working"}
          className="inline-flex items-center gap-1.5 border border-ink px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt disabled:opacity-60"
        >
          <Link2 className="h-3 w-3" aria-hidden /> {t("cite.button")}
        </button>
        {/* Živá oblast: výsledek se ohlásí i odečítačce, ne jen okem. */}
        <span role="status" aria-live="polite" className="min-h-[1rem] font-mono text-[11px] uppercase tracking-wider">
          {status === "working" && <span className="text-steel-aa">{t("cite.working")}</span>}
          {status === "copied" && (
            <span className="inline-flex items-center gap-1 font-bold text-cobalt">
              <Check className="h-3 w-3" aria-hidden /> {t("cite.copied")}
            </span>
          )}
          {status === "failed" && <span className="text-signal-deep">{t("cite.copyFailed")}</span>}
          {status === "unissued" && <span className="text-signal-deep">{t("cite.issueFailed")}</span>}
        </span>
      </div>
      {issuedPath ? (
        <p className="mt-1 break-all font-mono text-[11px] text-steel-aa">
          <Link href={issuedPath} className="underline decoration-hairline underline-offset-2 transition-colors hover:text-signal">
            {issuedPath}
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-snug text-steel-aa">{t("cite.hint")}</p>
      )}
    </div>
  );
}
