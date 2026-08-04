"use client";

/*
 * ZAOSTŘENÍ ODPOVĚDI — formulář brány je čistý GET, takže odpověď přijde jako
 * NOVÁ STRÁNKA. Bez tohohle skončí fokus po odeslání na začátku dokumentu a
 * čtečka obrazovky přečte hlavičku, hranici produktu a formulář dřív, než se
 * dostane k verdiktu; `aria-live` na sekci sám nepomůže, protože region se
 * nemění — vzniká rovnou v prvním renderu.
 *
 * Zaostřuje se jen tehdy, když se odeslalo (klíč `token` = vložený vstup), a
 * `preventScroll` nechává skok na starosti prohlížeči/kotvě, ne skriptu.
 */

import { useEffect } from "react";

export default function VerdictFocus({ targetId, token }: { targetId: string; token: string }) {
  useEffect(() => {
    if (token === "") return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [targetId, token]);
  return null;
}
