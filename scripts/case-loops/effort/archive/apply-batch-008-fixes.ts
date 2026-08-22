/* Batch 008 — apply the verification pass's recommended fixes to
 * batch-008-props.json. Every fix must match EXACTLY ONCE or the script exits
 * nonzero (batch-005 lesson: driver-applied fixes need a checkable outcome).
 *
 *   npx tsx scripts/case-loops/effort/apply-batch-008-fixes.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/data-analysis/case-effort/payloads/batch-008-props.json";
const payload = JSON.parse(readFileSync(FILE, "utf8")) as {
  proposals: { id: string; name: string; headline?: string; citations?: unknown[]; props: Record<string, unknown> }[];
};
const byName = new Map(payload.proposals.map((p) => [p.name, p]));

let failures = 0;
function fix(name: string, field: "headline" | "effort_bill_focus" | "effort_analyst_note", search: RegExp | "WHOLE", replacement: string) {
  const p = byName.get(name);
  if (!p) {
    console.error(`FAIL ${name}: proposal missing`);
    failures++;
    return;
  }
  const get = () => (field === "headline" ? (p.headline ?? "") : ((p.props[field] as string) ?? ""));
  const set = (v: string) => (field === "headline" ? (p.headline = v) : (p.props[field] = v));
  const text = get();
  if (search === "WHOLE") {
    set(replacement);
    console.log(`ok   ${name} · ${field} · replaced whole`);
    return;
  }
  const matches = text.match(new RegExp(search.source, search.flags.replace("g", "") + "g"));
  if (!matches || matches.length !== 1) {
    console.error(`FAIL ${name} · ${field} · pattern ${search} matched ${matches?.length ?? 0}×`);
    failures++;
    return;
  }
  set(text.replace(search, replacement));
  console.log(`ok   ${name} · ${field} · 1 replacement`);
}

/* ── Ožanová: headline scope-leak ── */
fix("Zuzana Ožanová", "headline", "WHOLE", "Zpravodajka u pěti tisků, autorka 21 pozměňovacích návrhů a 183 vystoupení v rozpravě.");

/* ── Demetrashvili: over-generalised floor claim + off-lens headline ── */
fix("Katerina Demetrashvili", "effort_bill_focus", /K těmto tiskům se také ústně vyjádřila v rozpravě\./u, "Ke dvěma z nich — tiskům 131 a 190 — také vystoupila v rozpravě, k oběma jednou.");
fix("Katerina Demetrashvili", "headline", "WHOLE", "Zpravodajka u čtyř tisků volební agendy, dva z nich už vyhlášeny jako zákon (70/2026 a 108/2026 Sb.)");

/* ── Vondráček: headline qualifier + sample-scoped superlative ── */
fix("Libor Vondráček", "headline", "WHOLE", "Zpravodaj u tří ústavních novel a novely jednacího řádu, autor tří písemných pozměňovacích návrhů, mimo tři spolupodpisy");
fix("Libor Vondráček", "effort_bill_focus", /[^.]*ze svého vzorku[^.]*\./u, " V rozpravě k tisku 47 vystoupil osmkrát — nejvíce ze všech tisků, ke kterým se vyjádřil.");

/* ── Benda: wrong numeral, scope-leak headline, contradictory analyst note ── */
fix("Marek Benda", "effort_bill_focus", /[^.]*jedenácti různými tisky[^.]*\./u, " V rozpravě vystoupil celkem 51krát; k jednotlivým tiskům je z toho evidováno 25 vystoupení u dvanácti různých tisků — nejčastěji k tisku 47 (5 vystoupení) a tisku 72 (4 vystoupení).");
fix("Marek Benda", "headline", "WHOLE", "Zpravodaj u tří tisků, autor dvou pozměňovacích návrhů k novele Ústavy a 51 vystoupení v rozpravě");
fix("Marek Benda", "effort_analyst_note", /\|? ?b008:[^]*$/u, "| b008: 3 zpravodajské role (tisky 15, 101, 102), všechny scope zpravodaj_ov. amendment_bills: pouze tisk 47 s 2 návrhy (sd_cislos 1046, 1089), odpovídá amendments_authored=2. speech_turns=51; per-bill turns v spoke_on_bills dávají součet 25 u dvanácti tisků (47, 72, 85, 90, 124, 125, 173, 210, 67, 131, 174, 187) — zbylých 26 vystoupení není v payloadu přiřazeno k tisku.");

/* ── Pospíšil: sample-scoped superlative ── */
fix("Jiří Pospíšil", "effort_bill_focus", /[^.]*ze svého vzorku[^.]*\./u, " V rozpravě k tisku 52 vystoupil šestkrát — nejvíce ze všech tisků, ke kterým se vyjádřil — následováno čtyřmi vystoupeními k tisku 173.");

/* ── Jurečka: unreported tie in the concentration claim ── */
fix("Marian Jurečka", "effort_bill_focus", /[^.]*nejvyšší koncentrací u tisku 198[^.]*\./u, " Jurečka podal 40 písemných pozměňovacích návrhů rozložených do deseti projednávaných tisků, s nejvyšší koncentrací u tisku 198 (novela zákona o státní sociální podpoře, 6 návrhů); po pěti návrzích podal k tisku 125 (novela zákona o sociálních službách a dávkách pro osoby se zdravotním postižením, vyhlášeného jako zákon č. 92/2026 Sb.) a k tisku 145 (novela zákona o spotřebitelském úvěru).");

/* ── Haas: sample-scoped concentration + scope-translation ── */
fix("Karel Haas", "effort_bill_focus", /[^.]*v této skupině[^.]*\./u, " Haas podal 22 písemných pozměňovacích návrhů, z toho 17 samotných k tisku 67 (novela stavebního zákona a dalších 21 předpisů); zbylých 5 návrhů rozdělil mezi tisk 90 (2) a tisk 145 (3).");
fix("Karel Haas", "effort_bill_focus", /[^.]*zpravodaj(?:em)? pro 1\. čtení[^.]*\./u, " U dvou návrhů zákona je zpravodajem — tisk 76 a tisk 77, oba o právních poměrech státních zaměstnanců v ministerstvech a jiných správních úřadech — v obou případech současně jako zpravodaj určený organizačním výborem, zpravodaj výboru i zpravodaj usnesení výboru.");

/* ── Richterová: prior-text bill-number error (sanctioned correction) + scope-leak ── */
fix("Olga Richterová", "effort_bill_focus", /Zbylé 4 tisky \(5, 6, 7, 156\)[^.]*\./u, "Zbylé 4 tisky (5, 6, 7, 49) vede jako druhá v pořadí za I. Bartošem nebo Z. Hříbem — jde tedy o spolupodpisy.");
fix("Olga Richterová", "effort_bill_focus", /Zpravodajskou roli v tomto přehledu nezastává u žádného tisku\./u, "Zpravodajskou roli nezastává u žádného tisku.");

/* ── Kovářová: sample-scoped concentration + scope-translation ── */
fix("Veronika Kovářová", "effort_bill_focus", /[^.]*v této skupině[^.]*\./u, " Kovářová podala všech svých 14 písemných pozměňovacích návrhů výhradně k jedinému tisku 67 (novela stavebního zákona a dalších 21 předpisů).");
fix("Veronika Kovářová", "effort_bill_focus", /[^.]*zpravodajky pro 1\. čtení[^.]*\./u, " dále je zpravodajkou určenou organizačním výborem u tisku 65 (novela agend Digitální a informační agentury) a tisku 234 (novela autorizačního zákona pro architekty a inženýry ve výstavbě).");

/* ── Sedmihradská: "návrh zákona č. N" collision — replace her whole appended block ── */
fix("Lucie Sedmihradská", "effort_bill_focus", /K projednávaným návrhům[^]*$|Podala celkem[^]*$|[^.]*návrh(?:u|ům)? zákona č\.[^]*$/u, "K projednávaným návrhům zákonů podala celkem 12 písemných pozměňovacích návrhů, rozložených do čtyř tisků (72, 90, 189 a 221). U dvou tisků (140 a 141, oba novely zákona o rozpočtovém určení daní) je zpravodajkou určenou organizačním výborem. V rozpravě vystoupila celkem 44krát, nejčastěji k tisku 90 (novela v oblasti veřejných rozpočtů) se sedmi vystoupeními.");

/* ── Urbanová: wrong attribution + Sb. collision — replace both offending sentences ── */
fix("Barbora Urbanová", "effort_bill_focus", /[^.]*K těmto tiskům dále podala 11[^.]*\./u, " Mimo vlastní a spolupodepsané tisky podala 11 písemných pozměňovacích návrhů k jiným projednávaným tiskům — 67 (1), 72 (5) a 115 (5).");
fix("Barbora Urbanová", "effort_bill_focus", /[^.]*návrh(?:u|ů)? zákona č\. 115[^]*$/u, " U tisku 115 (novela trestního zákoníku) je zpravodajkou určenou organizačním výborem i zpravodajkou usnesení výboru. V rozpravě vystoupila celkem 42krát, nejčastěji k tisku 72 (novela jednacího řádu Sněmovny) s osmi vystoupeními.");

/* ── Okamura: neutrality violation + scope-leak; drop the roster citation ── */
fix("Tomio Okamura", "effort_bill_focus", /[^.]*Spolupodepisování je mezi členy poslaneckých klubů běžnou praxí[^.]*\./u, "");
fix("Tomio Okamura", "effort_bill_focus", /[^.]*v tomto přehledu jedinou[^.]*\./u, " Vlastní pozměňovací aktivita je minimální — jeden písemný pozměňovací návrh, k tisku 47 (novela Ústavy ČR).");

/* ── Kršková: wrong attribution + Sb. collision ── */
fix("Marie Kršková", "effort_bill_focus", /[^.]*K nim podala 5 písemných pozměňovacích návrhů[^.]*\./u, " Mimo tuto desítku podala 5 písemných pozměňovacích návrhů ke dvěma jiným projednávaným tiskům — 48 (1) a 67 (4) — a u tisku 146 (novela obecního a krajského zřízení) je zpravodajkou určenou organizačním výborem.");
fix("Marie Kršková", "effort_bill_focus", /[^.]*návrhům zákona č\. 67 a č\. 76[^.]*\./u, " V rozpravě vystoupila celkem 23krát, nejčastěji k tiskům 67 a 76 se třemi vystoupeními u každého.");

/* Okamura: remove the SPD-club-roster citation backing the deleted claim */
{
  const o = byName.get("Tomio Okamura");
  if (o && Array.isArray(o.citations)) {
    const before = o.citations.length;
    o.citations = (o.citations as { url?: string; claim?: string }[]).filter(
      (c) => !/klub|SPD/iu.test(`${c.claim ?? ""} ${c.url ?? ""}`),
    );
    console.log(`ok   Tomio Okamura · citations · ${before} → ${o.citations.length}`);
  }
}

/* tidy any double spaces / stray whitespace the sentence surgery may leave */
for (const p of payload.proposals) {
  for (const f of ["effort_bill_focus", "effort_analyst_note"] as const) {
    if (typeof p.props[f] === "string") p.props[f] = (p.props[f] as string).replace(/ {2,}/g, " ").trim();
  }
}

if (failures > 0) {
  console.error(`\n${failures} FIX(ES) DID NOT APPLY — payload NOT written`);
  process.exit(1);
}
writeFileSync(FILE, JSON.stringify(payload, null, 2));
console.log(`\nAll fixes applied → ${FILE}`);
