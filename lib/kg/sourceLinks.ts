// Odkazy do veřejných registrů pro uzel znalostního grafu.
//
// Politicas tvrdí, že každá položka je dohledatelná k oficiálnímu zdroji. Tenhle
// modul je ta věta v kódu — z identifikátoru uzlu (pspId, IČO, číslo tisku,
// „č. N/RRRR Sb.") sestaví adresy do registrů, kde si to čtenář ověří sám.
//
// TŘI PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT:
//
// 1. Odkaz vzniká JEN z uloženého identifikátoru. Žádné hádání podle jména,
//    žádný vzor „nejspíš to bude takhle". Když identifikátor chybí, funkce
//    nevrátí nic a plocha musí říct „zdroj není v záznamu" — u produktu
//    o dohledatelnosti je mlčení lepší než odkaz, který někam ukazuje.
//    Platí to i obráceně: když uzel adresu NESE, staví se z ní (smlouva nese
//    `props.sourceUrl`, vývěska `props.postingId`) — rekonstrukce z id je
//    hádání i tehdy, když vzor „skoro sedí".
// 2. `tier` rozlišuje, CO odkaz slibuje. `detail` = kanonická stránka té
//    konkrétní entity. `search` = dotaz do registru; tvrdí jen „hledej tady",
//    ne „tohle je ono". Míchat je dohromady by z rešerše dělalo citaci.
// 3. `registry` MUSÍ pojmenovat hostitele, na kterého odkaz opravdu vede.
//    Renderuje se doslova (je to vlastní jméno), takže špatné jméno je
//    přesměrování čtenáře: „Registr smluv" nad adresou na hlidacstatu.cz mu
//    slíbí státní registr a pošle ho na soukromý agregátor.
//
// Ověřeno 2026-07-26: `psp.cz/sqw/detail.sqw?id=<pspId>` vrací detail poslance;
// `psp.cz/sqw/organy.sqw` je JEN rozcestník výborů, ne stránka jednoho orgánu —
// proto orgány a kluby odkaz nedostávají a zůstává jim čitelný identifikátor.
//
// ─────────────────────────────────────────────────────────────────────────────
// ZNÁMÁ MEZ — VOLEBNÍ OBDOBÍ V ADRESE (zapsáno 2026-08-13, NEOPRAVITELNÉ ZDE)
//
// `TERM_NUMBER = 10` je natvrdo v `historie.sqw?o=10&t=<cislo>` (tisk) i
// v `sd.sqw?o=<term>` (sněmovní dokument), ALE uzel tisku v grafu NENESE ŽÁDNÉ
// pole s obdobím (`kind: "bill"` props: cislo, origin, flagged_conflict, …).
// Čísla tisků se každé období číslují od jedničky znovu, takže po ingestu
// dalšího období tyhle citace nespadnou na 404 — vrátí ŽIVOU stránku psp.cz
// O JINÉM TISKU. To je horší než mlčení: čtenář dostane doložení, které vypadá
// v pořádku a mluví o něčem jiném.
//
// Opravit to jde jen v INGESTU, ne tady: `scripts/data-analysis/kg-legislation-ingest.ts`
// musí uzlu tisku zapsat prop `term` (číslo období, ne kód „PSP10"), a tahle
// funkce ho pak přečte a při jeho absenci odkaz NEVYDÁ (pravidlo 1). Do té doby
// je `TERM_NUMBER` vědomý předpoklad „graf je jednoobdobový", ne konstanta.
// ─────────────────────────────────────────────────────────────────────────────

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
 *
 * POZOR: je to PŘEDPOKLAD o celém grafu, ne vlastnost citovaného tisku — viz
 * blok „ZNÁMÁ MEZ" v hlavičce souboru.
 */
const TERM_NUMBER = 10;

const str = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

/**
 * Uložená adresa se propouští jen jako absolutní `https://…`, a DOSLOVA
 * (žádná normalizace: citace má vést tam, kam ji ingest zapsal).
 *
 * Proč vůbec: `props` jsou volný JSON z ingestu. Relativní cesta, `javascript:`
 * nebo prázdný řetězec nejsou citace — pravidlo 1 říká, že se v takovém případě
 * mlčí, ne že se z toho něco vyrobí.
 */
const storedUrl = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
};

/**
 * Číselné psp id z urny `psp:person:<n>` / `psp:organ:<n>`. Nečíselný sufix
 * psp id NENÍ (kluby z ukázkových dat nesou `kg:party:ODS`) — a citace, která
 * se tváří jako registrové číslo, je horší než žádná.
 */
const pspNumber = (id: string): string | null => {
  const s = idSuffix(id);
  return s && /^\d+$/.test(s) ? s : null;
};

/** Dotaz na smlouvy jednoho IČO. Hostitel je hlidacstatu.cz — SOUKROMÝ
 *  agregátor, ne státní Registr smluv; jméno registru to musí říct (pravidlo 3). */
const hlidacContractSearch = (ico: string): SourceLink => ({
  registry: "Hlídač státu — smlouvy",
  url: `https://www.hlidacstatu.cz/hledatsmlouvy?Q=${encodeURIComponent(`ico:${ico}`)}`,
  tier: "search",
});

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
 *
 * PRAVIDLO 1 PLATÍ I TADY. Tohle je řetězec, který se vytiskne vedle jména
 * entity jako její veřejné číslo — dosadit do něj vnitřní id grafu znamená
 * vydat citaci, kterou u zdroje nikdo nedohledá. Do 2026-08-13 to dělaly dvě
 * větve (tisk bez čísla, orgán) a obě jsou níž vysvětlené.
 */
export function citableId(subject: SourceSubject): string | null {
  const { kind, id, props } = subject;
  switch (kind) {
    case "person": {
      const psp = pspNumber(id);
      return psp ? `psp id ${psp}` : null;
    }
    // Klub i výbor mají urnu `psp:organ:<n>` (kg-compute.ts) — je to číslo
    // ORGÁNU, ne osoby. Do 2026-08-13 se obojí tisklo jako „psp id 172", tedy
    // nerozeznatelně od poslance; citace proto jednotku pojmenuje.
    case "party":
    case "organ": {
      const psp = pspNumber(id);
      return psp ? `psp id orgánu ${psp}` : null;
    }
    case "company": {
      const ico = str(props?.ico) ?? idSuffix(id);
      return ico ? `IČO ${ico}` : null;
    }
    // `contract:<idSmlouvy>` — idSmlouvy JE klíč registru, ale NENÍ to číslo
    // z webové adresy `/smlouva/<n>` (tam se používá idVerze; viz
    // memory/registr-smluv-token-free-access.md). Holé číslo bez jednotky zve
    // čtenáře přesně do téhle pasti, tak ji citace pojmenuje.
    case "contract": {
      const n = idSuffix(id);
      return n ? `idSmlouvy ${n}` : null;
    }
    // Číslo tisku je VEŘEJNÉ číslo z `props.cislo`. Sufix urny `bill:tisk:<tiskId>`
    // je nesouvisející vnitřní id — app/zakony/[cislo]/page.tsx to říká doslova
    // a `sourceLinksFor` to níž respektuje. Tisk bez čísla se přesto tiskl jako
    // „sn. tisk 43111": vymyšlená citace na ploše, která nic jiného neslibuje.
    case "bill": {
      const cislo = str(props?.cislo);
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
        // `ares.gov.cz/ekonomicke-subjekty?ico=` je FILTR seznamu subjektů, ne
        // stránka jednoho subjektu — do 2026-08-13 se vydával jako `detail`.
        // Adresa zůstává (funguje a dovede čtenáře k firmě); mění se TVRZENÍ,
        // které o ní děláme. Entitní adresu ARES nedosazujeme: ověřit ji offline
        // nejde a pravidlo 1 zakazuje vzory „nejspíš to bude takhle".
        { registry: "ARES", url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${ico}`, tier: "search" },
        // Totéž, a vlastní forenzní audit tohohle repa to už jednou vyslovil
        // (docs/data-analysis/case-law/batch-012-p1-audit.md): „a search URL …
        // not a permalink to the entity — a weak source anchor".
        {
          registry: "Obchodní rejstřík",
          url: `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`,
          tier: "search",
        },
        // Jediný `detail` v téhle skupině: adresa nese IČO v CESTĚ, ne v dotazu.
        { registry: "Hlídač státu", url: `https://www.hlidacstatu.cz/subjekt/${ico}`, tier: "detail" },
        hlidacContractSearch(ico),
      ];
    }

    case "contract": {
      const links: SourceLink[] = [];
      // Uzel smlouvy NESE svou kanonickou adresu: `<odkaz>` z bulk dumpu jde do
      // `props.sourceUrl` (scripts/case-loops/money/persist-contract-harvest.ts).
      // Do 2026-08-13 ji builder zahazoval, takže každá smlouva citovala dotaz
      // na svého dodavatele místo sebe sama — rešerše místo citace, přesně to,
      // co pravidlo 2 zakazuje.
      //
      // NESKLÁDÁ SE Z ID: `/smlouva/<n>` používá idVerze, kdežto uzel je keyovaný
      // na idSmlouvy (memory/registr-smluv-token-free-access.md — „THE TRAP").
      // Buď uložená adresa, nebo žádná.
      const own = storedUrl(props?.sourceUrl);
      if (own) links.push({ registry: "Registr smluv", url: own, tier: "detail" });
      // Dotaz na dodavatele zůstává vedle detailu jako jiná otázka („co ještě
      // ta firma dodává"), ale je to dotaz a jmenuje svého hostitele.
      const supplier = str(props?.supplierIco);
      if (supplier) links.push(hlidacContractSearch(supplier));
      return links;
    }

    // Adresa nese `o=<období>` z TERM_NUMBER, ne z uzlu — viz „ZNÁMÁ MEZ"
    // v hlavičce souboru.
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

    // Úřední deska. OPRAVENÝ PŘEDPOKLAD (2026-08-13): tenhle komentář — a
    // memory/kg-has-no-source-urls.md — do dneška tvrdily, že ingest URL vývěsky
    // na uzel nepřenáší, a vývěsky proto mlčely. Přenáší:
    // `lib/ingest/sources/kiosek.ts` dělá z VLASTNÍ adresy vývěsky její id
    // (ne z `iri`, jehož host data.justice.cz je mrtvý) a
    // `scripts/case-loops/sources/kiosek-build-payload.ts` ji nese jako
    // `props.postingId` — 20 z 20 uzlů v docs/data-analysis/case-sources/kiosek-payload.json.
    // Je to adresa té konkrétní vývěsky, tedy `detail`; hostitel je
    // infodeska.gov.cz a jméno registru to říká (pravidlo 3).
    case "notice": {
      const posting = storedUrl(props?.postingId);
      return posting ? [{ registry: "infodeska.gov.cz", url: posting, tier: "detail" }] : [];
    }

    // Bloky a témata vznikly výpočtem nad grafem; nevede je žádný registr.
    // Jejich zdrojem je provenience záznamu, ne externí adresa.
    case "bloc":
    case "theme":
      return [];
  }
}
