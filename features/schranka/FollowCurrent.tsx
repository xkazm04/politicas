"use client";

/*
 * „Sledovat tuhle stránku" — afordance sledování v chromu aplikace.
 *
 * Lišta (Sidebar/MobileNav) ji kreslí na každé ploše; komponenta sama pozná,
 * jestli aktuální adresa nese jednoznačný klíč entity (followableFromRoute):
 * spis poslance (i jeho peněžní spis), spis firmy, sněmovní tisk, filtrovaný
 * deník. Jinde se nevykreslí nic — sledovat „stránku bez entity" nedává smysl,
 * a obec se nenabízí proto, že by odběr neměl co doručit (viz followCodec).
 *
 * Popisek entity se bere z <title> dokumentu (po hydrataci, v efektu — SSR
 * titulek nezná), očištěný o brandovou příponu; je to jen nápověda uložená
 * k odběru, schránka pak kreslí popisky ze samotných záznamů.
 */

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { followableFromRoute } from "./followCodec";
import FollowButton from "./FollowButton";

function cleanTitle(title: string): string {
  return title.replace(/\s*[—·|-]\s*Politicas.*$/i, "").trim();
}

function FollowCurrentInner() {
  const t = useTranslations("schranka");
  const pathname = usePathname();
  const params = useSearchParams();
  const entityKey = followableFromRoute(pathname, params.get("entita"));

  const [label, setLabel] = useState("");
  useEffect(() => {
    // Titulek dokumentu je vnější systém a po navigaci se usadí až po
    // vykreslení — čte se v rAF (precedens useActiveSection), ne synchronně
    // v těle efektu (react-hooks/set-state-in-effect).
    const frame = requestAnimationFrame(() => {
      setLabel(cleanTitle(document.title));
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, entityKey]);

  if (entityKey === null) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-hairline px-5 py-2.5">
      <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wider text-steel-aa">
        {t("followCurrent.thisPage")}
      </span>
      <FollowButton entityKey={entityKey} label={label || entityKey} compact />
    </div>
  );
}

export default function FollowCurrent() {
  // useSearchParams vyžaduje Suspense hranici (statické generování stránek
  // pod layoutem) — fallback nic nekreslí, afordance přijde s hydratací.
  return (
    <Suspense fallback={null}>
      <FollowCurrentInner />
    </Suspense>
  );
}
