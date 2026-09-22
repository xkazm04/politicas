// /denik — čipy entit odkazují jen tam, kam se dá dojít. Připnuto GREPEM PŘES
// ZDROJ (vzor features/shell/a11y.test.ts) + čistým odvozením.
//
// CO TU BYLO ŽIVÉ do 2026-09-05: řádek bez čitelné entity (rozhodnutí brány
// nebo change event s nekanonickým IČO a bez pspId) nese ZÁSTUPNOU entitu
// `zaznam:<id>` — deriveDenik ji vydává, aby `entities` nebylo nikdy prázdné.
// Plocha ale každou entitu sázela jako <Link href="/denik?entita=…">, takže
// zástupný klíč vedl na pohled, který o něm říká jen „tvar klíče neodpovídá"
// (`isEntityKey` ho odmítá, schránka by ho neuložila). Odkaz, který vypadá
// jako filtr a vede do věty o vlastní neplatnosti, se nesází — čip zůstane
// textem.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isEntityKey } from "@/features/schranka/followCodec";
import { buildDenik, type DenikInput } from "./deriveDenik";

const PAGE = readFileSync("features/denik/DenikPage.tsx", "utf8");

/** Zdroj bez komentářů — hlavička souboru popisuje, CO se opravovalo, a nesmí
 *  sama žádné tvrzení tohohle testu splnit ani vyvrátit. */
function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const SRC = stripComments(PAGE);

const input = (over: Partial<DenikInput>): DenikInput => ({
  contracts: [],
  roles: [],
  bills: [],
  reviews: [],
  changes: [],
  today: "2026-09-05",
  ...over,
});

describe("zástupná entita `zaznam:<id>` není klíč, který by plocha směla nabídnout jako filtr", () => {
  it("rozhodnutí brány bez pspId a bez kanonického IČO vydá jen zástupný klíč — a ten není entita", () => {
    const view = buildDenik(
      input({
        reviews: [
          {
            id: "r-77",
            decision: "confirm",
            decidedAt: "2026-09-01T10:00:00.000Z",
            mpName: "neznámý",
            company: "Firma bez IČO",
            pspId: null,
            ico: null,
          },
        ],
      }),
    );
    const [entry] = view.ledger.days[0].entries;
    expect(entry.entities).toHaveLength(1);
    expect(entry.entities[0].key).toBe("zaznam:r-77");
    expect(entry.entities[0].href).toBeNull();
    expect(isEntityKey(entry.entities[0].key)).toBe(false);
  });
});

describe("DenikPage sází čip jako odkaz jen pro klíč, který isEntityKey přijme", () => {
  it("the entity-chip Link is guarded by isEntityKey(en.key)", () => {
    // The chip branch: `en.key === followedKey ? <followed> : <guard> ? <Link> : <span>`.
    const chips = SRC.slice(SRC.indexOf("e.entities.map((en) =>"), SRC.indexOf("</li>"));
    expect(chips).toMatch(/isEntityKey\(en\.key\)/);
    // The Link to the filter address must come AFTER the guard, never before it.
    expect(chips.indexOf("isEntityKey(en.key)")).toBeLessThan(chips.indexOf("href={`/denik?entita="));
  });
});
