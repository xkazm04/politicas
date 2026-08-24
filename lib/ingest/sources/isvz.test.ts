import { describe, expect, it } from "vitest";
import { icoOrNull, parseIsvzMonth } from "./isvz";

/** Shape verbatim from VZ-06-2026 (trimmed): one VZ, two lots, deadline history keyed by
 *  LOT id with end-only records (the register fills the start ~13 % of the time — b001),
 *  a Czech winner on lot 1 and a foreign (Slovak) winner without IČO on lot 2. */
const MONTH = {
  obdobi_od: "2026-06-01T00:00:00",
  obdobi_do: "2026-06-30T23:59:59",
  verze: "2.9.0",
  data: [
    {
      historie_lhut: [
        {
          identifikator_NIPEZ_ke_kteremu_se_zaznamy_vztahuji: "RVZ01/001",
          zaznamy: [
            { druh_lhuty: "Lhůta pro podání nabídky", aktivni: true, datum_a_cas_konce_lhuty: "2026-05-20T10:00:00" },
          ],
        },
      ],
      verejna_zakazka: {
        identifikator_NIPEZ: "RVZ01",
        nazev_verejne_zakazky: "Oprava chodníků",
        druh_verejne_zakazky: "Stavební práce",
        rezim_verejne_zakazky: "Podlimitní",
        zadavaci_postupy: [
          {
            identifikator_NIPEZ: "ZP/RVZ01/001",
            zadavatel_zadavaciho_postupu: {
              zadavatele: [
                {
                  kategorie_zadavatele: "Obec",
                  zadava_zadavaci_postup: true,
                  adresa_profilu: "https://nen.nipez.cz/profil/obec",
                  subjekt: { nazev_subjektu: "Město Test", ico: "255467", kod_NUTS: "CZ032", stat_adresa: "CZE" },
                },
              ],
            },
            zadavaci_postupy_pro_casti: [{ identifikator_NIPEZ: "RVZ01/001" }, { identifikator_NIPEZ: "RVZ01/002" }],
          },
        ],
        casti_verejne_zakazky: [
          {
            identifikator_NIPEZ: "RVZ01/001",
            nazev_casti_verejne_zakazky: "Etapa 1",
            predmet: { hlavni_kod_CPV: "45233161-5" },
            predpokladana_hodnota_casti_bez_DPH_v_CZK: 5_000_000,
            zadavaci_postup_pro_cast: {
              druh_zadavaciho_postupu: "Zjednodušené podlimitní řízení",
              datum_zahajeni_zadavaciho_postupu: "2026-05-01T08:00:00",
              datum_ukonceni_zadavaciho_postupu: "2026-06-15T08:00:00",
              evidence_vysledku_zadavaciho_postupu: "Uzavření smlouvy",
              podane_nabidky_nebo_zadosti_o_ucast: [{ pocet_podanych_nabidek_nebo_zadosti_o_ucast: 3 }],
              hodnoty_podanych_nabidek: { nejnizsi_hodnota_hodnocene_nabidky: 4_400_000, nejvyssi_hodnota_hodnocene_nabidky: 4_800_000 },
              ucastnici: [
                {
                  identifikace: "u1",
                  podani: [
                    {
                      nabidka_byla_hodnocena: true,
                      nabidkove_hodnoty: [{ mena: "CZK", druh_nabidkove_hodnoty_odpovidajici_ciselne_vyjadritelnym_kriteriem_hodnoceni: "Nabídková cena bez DPH", hodnota: 4_400_000 }],
                    },
                  ],
                  dodavatele: [{ role_dodavatele: "Dodavatel bez společné účasti více dodavatelů", subjekt: { nazev_subjektu: "Stavby CZ s.r.o.", ico: "1234567", kod_NUTS: "CZ032", stat_adresa: "CZE", maly_a_stredni_podnik: true } }],
                },
              ],
              vysledek: {
                vysledek_ukonceni_zadavaciho_postupu: "Uzavření smlouvy",
                vybrani_dodavatele_zadavaciho_postupu: [
                  { identifikator_ucastnika_zadavaciho_postupu: "u1", datum_rozhodnuti_o_vyberu_dodavatele: "2026-06-01T12:00:00", dodavatel_podal_pouze_jednu_nabidku: false, subjekt: { nazev_subjektu: "Stavby CZ s.r.o.", ico: "1234567", stat_adresa: "CZE" } },
                ],
              },
            },
          },
          {
            identifikator_NIPEZ: "RVZ01/002",
            nazev_casti_verejne_zakazky: "Etapa 2",
            predmet: { hlavni_kod_CPV: "45233161-5" },
            zadavaci_postup_pro_cast: {
              druh_zadavaciho_postupu: "Otevřené řízení",
              vysledek: {
                vybrani_dodavatele_zadavaciho_postupu: [
                  { subjekt: { nazev_subjektu: "MODULAR SVK s.r.o.", jiny_identifikator: "53852869", kod_NUTS: "SK", stat_adresa: "SVK" } },
                ],
              },
            },
          },
        ],
      },
    },
  ],
};

describe("icoOrNull — the 8-pad boundary", () => {
  it("pads a short Czech IČO and leaves a foreign identifier alone", () => {
    expect(icoOrNull("255467")).toBe("00255467");
    expect(icoOrNull("53852869")).toBe("53852869"); // 8 digits: structurally an IČO shape
    expect(icoOrNull("DE123456789")).toBeNull(); // not digits → foreign, never coerced
    expect(icoOrNull("")).toBeNull();
    expect(icoOrNull(undefined)).toBeNull();
  });
});

describe("parseIsvzMonth", () => {
  const m = parseIsvzMonth(MONTH);

  it("emits one row per LOT, with the VZ and authority attached", () => {
    expect(m.lots).toHaveLength(2);
    expect(m.droppedLots).toBe(0);
    const l = m.lots[0];
    expect(l.lotId).toBe("RVZ01/001");
    expect(l.vzId).toBe("RVZ01");
    expect(l.authority?.ico).toBe("00255467"); // 8-padded
    expect(l.authority?.category).toBe("Obec");
    expect(l.cpvDivision).toBe("45");
  });

  it("reads bid facts verbatim: count, spread, evaluated participant with price", () => {
    const l = m.lots[0];
    expect(l.bidCount).toBe(3);
    expect(l.lowestBidCzk).toBe(4_400_000);
    expect(l.highestBidCzk).toBe(4_800_000);
    expect(l.participants[0]).toMatchObject({ ico: "01234567", evaluated: true, bidCzkNoVat: 4_400_000, sme: true });
    expect(l.winners[0]).toMatchObject({ ico: "01234567", decidedOn: "2026-06-01T12:00:00" });
  });

  it("THE DEADLINE BASIS (b001): procedure start → lhůta END, not the mostly-absent lhůta start", () => {
    // 2026-05-01 → 2026-05-20 = 19 days. The lhůta record carries NO start on purpose.
    expect(m.lots[0].deadlineDays).toBe(19);
  });

  it("absence is absence: a lot without a bid-count block carries null, never 0", () => {
    const l2 = m.lots[1];
    expect(l2.bidCount).toBeNull();
    expect(l2.evaluatedBidCount).toBeNull();
    expect(l2.deadlineDays).toBeNull(); // no procedure start on lot 2
  });

  it("a foreign winner keeps its identity and is NEVER zero-padded into an IČO", () => {
    const w = m.lots[1].winners[0];
    // 53852869 is 8 digits — shape-wise an IČO — but the join layer decides by country,
    // and the parse must carry the country for it to be able to.
    expect(w.country).toBe("SVK");
    expect(w.name).toBe("MODULAR SVK s.r.o.");
  });
});
