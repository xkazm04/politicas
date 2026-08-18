import { getSchrankaDeltas } from "@/features/schranka/getSchrankaDeltas";
import { parseFollowKeys } from "@/features/schranka/followCodec";
import type { NovinkyResponse } from "@/features/schranka/novinky";

/*
 * /schranka/novinky.json — delty sledovaných entit (moonshot 7A).
 *
 * Bez účtu a bez identity: klient (schránka je localStorage) pošle seznam
 * veřejných klíčů entit (`e=poslanec:123&e=firma:456…`) a práh `od=YYYY-MM-DD`
 * (den poslední návštěvy); server nad read-only loadery deníku, důkazů a
 * provenance indexu spustí čisté odvození (deriveDeltas) a vrátí
 * provenance-orazítkované řádky. Nic se na serveru neukládá — odpověď je
 * funkce (záznam, klíče, práh).
 *
 * Loadery jsou tytéž memoizované vrstvy jako /denik a /dukazy — odznak lišty
 * je proto levný dotaz, ne nový výpočet.
 */

export const dynamic = "force-dynamic";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = parseFollowKeys(url.searchParams.getAll("e"));
  const odRaw = url.searchParams.get("od");

  // Práh: den z `od`, jinak „všechno" (klient bez razítka si okno první
  // návštěvy počítá sám přes sinceDay — sem už posílá hotový den).
  const since = odRaw !== null && DAY_RE.test(odRaw) ? odRaw : "0000-01-01";

  const built = await getSchrankaDeltas(keys, since);
  if (!built) {
    // Čestný stav „nečitelné, ne prázdné" — týž kontrakt jako /denik/feed.json.
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const body: NovinkyResponse = {
    v: 1,
    builtOn: built.builtOn,
    since: built.since,
    coverage: built.coverage,
    // Meze čtení jedou s odpovědí: plocha o nich píše větu (features/denik/
    // limitNotes.ts, tentýž modul jako deník) a odznak je ignoruje.
    limits: built.limits,
    deltas: built.deltas,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Krátká klientská cache: odznak se ptá z každé stránky; loadery jsou
      // memoizované, ale ani ten dotaz nemusí létat při každé navigaci.
      "cache-control": "private, max-age=60",
    },
  });
}
