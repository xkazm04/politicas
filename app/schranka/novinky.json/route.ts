import { deriveDenikEntries } from "@/features/denik/deriveDenik";
import { getDenikData } from "@/features/denik/getDenikData";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { deriveDeltas, DELTA_ENTRIES_CAP } from "@/features/schranka/deriveDeltas";
import { isEntityKey, MAX_FOLLOWS } from "@/features/schranka/followCodec";
import type { NovinkyResponse } from "@/features/schranka/novinky";

/*
 * /schranka/novinky.json — delty sledovaných entit (moonshot 7A).
 *
 * Bez účtu a bez identity: klient (schránka je localStorage) pošle seznam
 * veřejných klíčů entit (`e=poslanec:123&e=firma:456…`) a práh `od=YYYY-MM-DD`
 * (den poslední návštěvy); server nad read-only loadery deníku a důkazů
 * spustí čisté odvození (deriveDeltas) a vrátí provenance-orazítkované řádky.
 * Nic se na serveru neukládá — odpověď je funkce (záznam, klíče, práh).
 *
 * Loadery jsou tytéž memoizované vrstvy jako /denik a /dukazy — odznak lišty
 * je proto levný dotaz, ne nový výpočet.
 */

export const dynamic = "force-dynamic";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = url.searchParams
    .getAll("e")
    .filter(isEntityKey)
    .slice(0, MAX_FOLLOWS);
  const odRaw = url.searchParams.get("od");

  const [denik, dukazy] = await Promise.all([getDenikData(), getDukazyData()]);
  if (!denik) {
    // Čestný stav „nečitelné, ne prázdné" — týž kontrakt jako /denik/feed.json.
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const { entries } = deriveDenikEntries({
    contracts: denik.contracts,
    roles: denik.roles,
    bills: denik.bills,
    reviews: denik.reviews,
    changes: denik.changes,
    today: denik.builtOn,
  });

  // Práh: den z `od`, jinak „všechno" (klient bez razítka si okno první
  // návštěvy počítá sám přes sinceDay — sem už posílá hotový den).
  const since = odRaw !== null && DAY_RE.test(odRaw) ? odRaw : "0000-01-01";

  const body: NovinkyResponse = {
    v: 1,
    builtOn: denik.builtOn,
    since,
    coverage: { ...denik.coverage, dukazy: dukazy !== null },
    deltas: deriveDeltas({
      entries,
      forensic: dukazy?.entries ?? [],
      keys,
      since,
      cap: DELTA_ENTRIES_CAP,
    }),
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
