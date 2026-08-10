// Odkazy do veřejných registrů pro uzel znalostního grafu.
//
// Politicas tvrdí, že každá položka je dohledatelná k oficiálnímu zdroji. Tenhle
// modul je ta věta v kódu — z identifikátoru uzlu (pspId, IČO, číslo tisku,
// „č. N/RRRR Sb.") sestaví adresy do registrů, kde si to čtenář ověří sám.
//
// DVĚ PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT:
//
// 1. Odkaz vzniká JEN z uloženého identifikátoru. Žádné hádání podle jména,
//    žádný vzor „nejspíš to bude takhle". Když identifikátor chybí, funkce
//    nevrátí nic a plocha musí říct „zdroj není v záznamu" — u produktu
//    o dohledatelnosti je mlčení lepší než odkaz, který někam ukazuje.
// 2. `tier` rozlišuje, CO odkaz slibuje. `detail` = kanonická stránka té
//    konkrétní entity. `search` = dotaz do registru; tvrdí jen „hledej tady",
//    ne „tohle je ono". Míchat je dohromady by z rešerše dělalo citaci.
//
// Ověřeno 2026-07-26: `psp.cz/sqw/detail.sqw?id=<pspId>` vrací detail poslance;
// `psp.cz/sqw/organy.sqw` je JEN rozcestník výborů, ne stránka jednoho orgánu —
// proto orgány a kluby odkaz nedostávají a zůstává jim čitelný identifikátor.

export type SourceTier = "detail" | "search";

export interface SourceLink {
  /** Jméno registru — renderuje se doslova, je to vlastní jméno. */
  registry: string;
  url: string;
  tier: SourceTier;
}

/** Drží se v syncu s KG_NODE_KINDS v lib/analysis/kg-verdict.ts. */
export type KgNodeKind =
  | "person"
  | "party"
  | "organ"
  | "bloc"
  | "theme"
  | "company"
  | "contract"
  | "bill"
  | "law"
  | "notice";

export interface SourceSubject {
  kind: KgNodeKind;
  /** Id uzlu v grafu, např. `psp:person:6202`, `company:ico:25841991`. */
  id: string;
  label: string;
  props?: Record<string, unknown>;
}

/**
 * Volební období, na kterém celý graf stojí. Bylo zapsané jako literál přímo
 * v URL; od chvíle, kdy adresu skládá víc než jedna funkce, žije na jednom
 * místě — dvě `o=` v jednom souboru je přesně to, jak se dvě adresy nad týmž
 * grafem rozejdou o jedno období.
 */
const TERM_NUMBER = 10;

const str = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

/** Poslední segment id — `psp:person:6202` → `6202`. */
export const idSuffix = (id: string): string | null => {
  const s = id.split(":").pop();
  return s && s.trim() ? s.trim() : null;
};

/** „č. 134/2016 Sb." i holé „134/2016" → {cislo, rok}. */
export function parseLawRef(ref: string): { cislo: string; rok: string } | null {
  const m = ref.match(/(\d+)\s*\/\s*(\d{4})/);
  return m ? { cislo: m[1], rok: m[2] } : null;
}

/**
 * Identifikátor, kterým se entita cituje, i když pro ni nemáme odkaz.
 * Vrací null jen tehdy, když opravdu není co uvést.
 */
export function citableId(subject: SourceSubject): string | null {
  const { kind, id, props } = subject;
  switch (kind) {
    case "person":
    case "party":
    case "organ": {
      const psp = idSuffix(id);
      return psp ? `psp id ${psp}` : null;
    }
    case "company": {
      const ico = str(props?.ico) ?? idSuffix(id);
      return ico ? `IČO ${ico}` : null;
    }
    case "contract":
      return idSuffix(id);
    case "bill": {
      const cislo = str(props?.cislo) ?? idSuffix(id);
      return cislo ? `sn. tisk ${cislo}` : null;
    }
    case "law":
      return str(props?.ref) ?? idSuffix(id);
    case "notice":
      return str(props?.spisovaZnacka) ?? str(props?.postingId);
    case "bloc":
    case "theme":
      // Odvozené uzly — vznikly výpočtem nad grafem, žádný registr je nevede.
      return null;
  }
}

/**
 * SNĚMOVNÍ DOKUMENT — text jednoho písemného pozměňovacího návrhu na psp.cz.
 *
 * Není to uzel grafu, a proto to není větev `sourceLinksFor`: číslo `sd_cislo`
 * nese HRANA `proposes_amendment` v props `sd_cislos` (sd.zip / sd_dokument
 * typ 13, průchod grafu 35). Spis o něm do 2026-08-11 četl jen `weight`, takže
 * z návrhu, který někdo napsal a podal, zbyl na stránce pouhý počet.
 *
 * Ověřeno 2026-08-10 staženim: `psp.cz/sqw/sd.sqw?o=10&cd=822` vrací stránku
 * s titulkem „Sněmovní dokument 822". Proto `tier: "detail"` — je to kanonická
 * stránka toho dokumentu, ne dotaz do rejstříku.
 *
 * Číslo, které není celé kladné číslo, vrací `null`: platí pravidlo 1 z hlavičky
 * tohohle souboru — adresa vzniká jen z uloženého identifikátoru, jinak mlčíme.
 */
export function snemovniDokumentLink(sdCislo: unknown, term: number = TERM_NUMBER): SourceLink | null {
  const cislo = str(sdCislo);
  if (!cislo || !/^\d+$/.test(cislo)) return null;
  return {
    registry: "psp.cz",
    url: `https://www.psp.cz/sqw/sd.sqw?o=${term}&cd=${cislo}`,
    tier: "detail",
  };
}

/**
 * Adresy registrů pro uzel. Prázdné pole je legitimní odpověď (odvozené uzly,
 * orgány bez kanonické stránky) — volající pak vykreslí „zdroj není v záznamu"
 * a spolehne se na provenienci ze záznamu grafu.
 */
export function sourceLinksFor(subject: SourceSubject): SourceLink[] {
  const { kind, id, label, props } = subject;

  switch (kind) {
    case "person": {
      const psp = idSuffix(id);
      const links: SourceLink[] = [];
      if (psp) {
        links.push({ registry: "psp.cz", url: `https://www.psp.cz/sqw/detail.sqw?id=${psp}`, tier: "detail" });
      }
      // Hlídač nemá z grafu stabilní slug osoby — dotaz je poctivější než hádaný profil.
      links.push({
        registry: "Hlídač státu",
        url: `https://www.hlidacstatu.cz/hledat?q=${encodeURIComponent(label)}`,
        tier: "search",
      });
      return links;
    }

    case "company": {
      const ico = str(props?.ico) ?? idSuffix(id);
      if (!ico) return [];
      return [
        { registry: "ARES", url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${ico}`, tier: "detail" },
        {
          registry: "Obchodní rejstřík",
          url: `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`,
          tier: "detail",
        },
        { registry: "Hlídač státu", url: `https://www.hlidacstatu.cz/subjekt/${ico}`, tier: "detail" },
        {
          registry: "Registr smluv",
          url: `https://www.hlidacstatu.cz/hledatsmlouvy?Q=${encodeURIComponent(`ico:${ico}`)}`,
          tier: "search",
        },
      ];
    }

    case "contract": {
      const supplier = str(props?.supplierIco);
      const links: SourceLink[] = [];
      if (supplier) {
        links.push({
          registry: "Registr smluv",
          url: `https://www.hlidacstatu.cz/hledatsmlouvy?Q=${encodeURIComponent(`ico:${supplier}`)}`,
          tier: "search",
        });
      }
      return links;
    }

    case "bill": {
      const cislo = str(props?.cislo);
      if (!cislo) return [];
      return [
        {
          registry: "psp.cz",
          url: `https://www.psp.cz/sqw/historie.sqw?o=${TERM_NUMBER}&t=${cislo}`,
          tier: "detail",
        },
      ];
    }

    case "law": {
      const ref = str(props?.ref) ?? idSuffix(id)?.replace("-", "/");
      const parsed = ref ? parseLawRef(ref) : null;
      if (!parsed) return [];
      return [
        {
          registry: "e-Sbírka",
          url: `https://e-sbirka.gov.cz/sb/${parsed.rok}/${parsed.cislo}`,
          tier: "detail",
        },
      ];
    }

    // Kluby a výbory: psp.cz vede jen rozcestník orgánů, ne stránku jednoho —
    // odkaz by sliboval víc, než umí. Zůstává citovatelný identifikátor.
    case "party":
    case "organ":
      return [];

    // Úřední deska: zdrojová JSON-LD data URL vývěsky NESOU, ale ingest ji na
    // uzel nepřenáší (lib/ingest/sources/kiosek.ts). Je to opravitelná mezera
    // v ingestu, ne vlastnost entity — dokud se URL neukládá, radši mlčíme,
    // než abychom ji rekonstruovali. Spisová značka jako citace zůstává.
    case "notice":
      return [];

    // Bloky a témata vznikly výpočtem nad grafem; nevede je žádný registr.
    // Jejich zdrojem je provenience záznamu, ne externí adresa.
    case "bloc":
    case "theme":
      return [];
  }
}
