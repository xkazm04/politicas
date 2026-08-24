// isvz.nipez.cz — Registr veřejných zakázek (RVZ) monthly OPEN-DATA JSON (Case ④ tender loop).
//
// WHY THIS EXISTS. Registr smluv records that a contract was SIGNED; it cannot say how it
// was AWARDED. Every established procurement-risk indicator (single bidding in a
// competitive market, short submission windows, tight bid spreads, repeat winners — the
// Fazekas/GTI method, zIndex practice) lives in the TENDER record. ISVZ publishes it:
// monthly zips `VZ-MM-YYYY.zip` at
// https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/, refreshed the 5th,
// aggregating Věstník veřejných zakázek + NEN + Tender arena + TENDERMARKET.
//
// FACTS ESTABLISHED BY MEASUREMENT (2026-08-23, VZ-06-2026 — do not re-derive):
//  • one file = { obdobi_od, obdobi_do, verze, data: [...] }; 16 662 VZ / 20 023 lots in
//    that month. Record-level files exist from 2024-12 (2024-02..11 return 404; the
//    pre-2024-02 „původní" open data is aggregate-only).
//  • the UNIT is the LOT (`casti_verejne_zakazky[]`) — bids, winners and procedure data
//    hang on `zadavaci_postup_pro_cast`, not on the VZ.
//  • the authority sits at `zadavaci_postupy[0].zadavatel_zadavaciho_postupu.zadavatele[]`
//    with a full `subjekt` (IČO, NUTS, category, profile URL).
//  • bid counts: `podane_nabidky_nebo_zadosti_o_ucast[].pocet_podanych_nabidek…` (81 % of
//    lots); participants: `ucastnici[]` with `dodavatele[].subjekt.ico` and per-`podani`
//    evaluation + bid values (79 % of lots); winners: `vysledek.vybrani_dodavatele_…[]`.
//  • deadlines: TOP-LEVEL `historie_lhut[]` (sibling of `verejna_zakazka`), keyed back by
//    `identifikator_NIPEZ_ke_kteremu_se_zaznamy_vztahuji`; the kind that matters is
//    „Lhůta pro podání nabídky" (and „…žádosti o účast" for multi-stage).
//  • a FOREIGN supplier has no `ico` — only `jiny_identifikator` + `stat_adresa`. An IČO
//    join must never coerce those (a Slovak winner is not an 8-digit zero-pad away).
//
// DOCTRINE (the skill's gates, enforced here by construction):
//  • every extracted number is a REGISTER FACT carried verbatim — no flag, no threshold,
//    no judgment lives in this module. Flags are computed downstream where their
//    calibration evidence lives.
//  • absence is absence: a lot without a bid-count block gets `bidCount: null`, never 0 —
//    "no data" and "zero bids" are different claims (the batch-014/015 lesson).
//  • IČOs are zero-padded to 8 exactly when they are 1–8 digits; anything else stays in
//    `foreignId` (memory/ico-node-id-canonical-form).

export interface IsvzSubject {
  /** 8-padded Czech IČO, or null for a foreign / IČO-less subject. */
  ico: string | null;
  foreignId: string | null;
  name: string;
  nuts: string | null;
  country: string | null;
  sme: boolean | null;
}

export interface IsvzParticipant extends IsvzSubject {
  role: string | null;
  /** Any of this participant's podání was evaluated. Null = the record does not say. */
  evaluated: boolean | null;
  /** „Nabídková cena bez DPH" of the participant's (last) evaluated podání, when stated. */
  bidCzkNoVat: number | null;
}

export interface IsvzLot {
  /** `tender:<lotId>` is the graph node id. */
  lotId: string;
  vzId: string;
  name: string;
  authority: (IsvzSubject & { category: string | null; profileUrl: string | null }) | null;
  cpv: string | null;
  cpvDivision: string | null;
  kind: string | null; // druh (stavební práce / dodávky / služby)
  regime: string | null;
  procedureType: string | null;
  estimatedCzkNoVat: number | null;
  euFunded: boolean | null;
  /** Submission window in whole days: PROCEDURE START → bid-deadline END. The lhůta
   *  record always carries its end but its start only ~13 % of the time (measured b001:
   *  996 of 7 507 records), so end−start would exist for 1 % of lots and read like "the
   *  register barely publishes deadlines". Start-of-procedure is the field that is
   *  actually filled, and it is what a bidder experiences. */
  deadlineDays: number | null;
  startedOn: string | null;
  endedOn: string | null;
  resultKind: string | null; // evidence_vysledku (Uzavření smlouvy / Zrušení …)
  bidCount: number | null;
  evaluatedBidCount: number | null;
  lowestBidCzk: number | null;
  highestBidCzk: number | null;
  objectionsCount: number | null;
  participants: IsvzParticipant[];
  winners: (IsvzSubject & { decidedOn: string | null; soleBidderSelfDeclared: boolean | null })[];
  /** NEN/VVZ identifier for a citable per-lot URL, when present. */
  toolRef: { tool: string; id: string } | null;
}

/* ── small readers — the JSON is deep and optional everywhere ─────────────────────────── */

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const boolOrNull = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** 8-pad ONLY a plausible Czech IČO; anything else is honestly foreign. */
export function icoOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const digits = s.replace(/\s/g, "");
  return /^\d{1,8}$/.test(digits) ? digits.padStart(8, "0") : null;
}

function subjectOf(v: unknown): IsvzSubject | null {
  const s = obj(v);
  const name = str(s.nazev_subjektu);
  if (!name) return null;
  const ico = icoOrNull(s.ico);
  return {
    ico,
    foreignId: ico ? null : (str(s.jiny_identifikator) ?? str(s.ico)),
    name,
    nuts: str(s.kod_NUTS),
    country: str(s.stat_adresa),
    sme: boolOrNull(s.maly_a_stredni_podnik),
  };
}

/** Days between two ISO timestamps, rounded down; null unless both parse. */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.floor((b - a) / 86_400_000);
}

const BID_DEADLINE_KINDS = new Set(["Lhůta pro podání nabídky", "Lhůta pro podání žádosti o účast"]);

/* ── the parse ────────────────────────────────────────────────────────────────────────── */

export interface IsvzMonth {
  from: string | null;
  to: string | null;
  version: string | null;
  lots: IsvzLot[];
  /** Records whose lot could not be formed (no lot id) — counted, never silent. */
  droppedLots: number;
}

export function parseIsvzMonth(payload: unknown): IsvzMonth {
  const root = obj(payload);
  const out: IsvzMonth = {
    from: str(root.obdobi_od),
    to: str(root.obdobi_do),
    version: str(root.verze),
    lots: [],
    droppedLots: 0,
  };

  for (const rec of arr(root.data)) {
    const vz = obj(rec.verejna_zakazka);
    const vzId = str(vz.identifikator_NIPEZ);
    if (!vzId) {
      out.droppedLots += arr(vz.casti_verejne_zakazky).length || 1;
      continue;
    }

    // authority: the zadavatel that actually runs the procedure, else the first listed
    const zadList = arr(obj(arr(vz.zadavaci_postupy)[0]?.zadavatel_zadavaciho_postupu).zadavatele);
    const zad = zadList.find((z) => z.zadava_zadavaci_postup === true) ?? zadList[0];
    const zadSubj = zad ? subjectOf(zad.subjekt) : null;
    const authority = zadSubj
      ? { ...zadSubj, category: str(zad.kategorie_zadavatele), profileUrl: str(zad.adresa_profilu) }
      : null;

    // Deadline history is keyed per identifikátor — which can be the LOT id, the VZ id,
    // OR the ZADÁVACÍ POSTUP id (`ZP/RVZ…/001`, possibly with a per-lot suffix). The
    // first version indexed only lot + VZ ids and resolved a deadline for 1 % of CPV-45
    // lots — a fill rate that read as "the register barely publishes deadlines" when the
    // truth was "we index the wrong key" (caught by the b001 fill-rate gate). The postup
    // ids are mapped back to lots via `zadavaci_postupy[].zadavaci_postupy_pro_casti`.
    const postupKeysForLot = new Map<string, string[]>(); // lotId → [postup ids covering it]
    const vzPostupKeys: string[] = [];
    for (const zpTop of arr(vz.zadavaci_postupy)) {
      const zpId = str(zpTop.identifikator_NIPEZ);
      if (zpId) vzPostupKeys.push(zpId);
      for (const pc of arr(zpTop.zadavaci_postupy_pro_casti)) {
        const pcId = str(pc.identifikator_NIPEZ);
        if (pcId && zpId) postupKeysForLot.set(pcId, [...(postupKeysForLot.get(pcId) ?? []), zpId]);
      }
    }
    const deadlineEndByKey = new Map<string, string>();
    for (const h of arr(rec.historie_lhut)) {
      const key = str(h.identifikator_NIPEZ_ke_kteremu_se_zaznamy_vztahuji) ?? vzId;
      for (const z of arr(h.zaznamy)) {
        const kind = str(z.druh_lhuty) ?? "";
        if (!BID_DEADLINE_KINDS.has(kind)) continue;
        if (z.aktivni === false && deadlineEndByKey.has(key)) continue; // prefer the active record
        const end = str(z.datum_a_cas_konce_lhuty);
        if (end) deadlineEndByKey.set(key, end);
      }
    }
    const deadlineEndForLot = (lotId: string): string | null => {
      const direct = deadlineEndByKey.get(lotId);
      if (direct) return direct;
      for (const k of postupKeysForLot.get(lotId) ?? []) {
        const hit = deadlineEndByKey.get(k);
        if (hit) return hit;
      }
      for (const k of vzPostupKeys) {
        const hit = deadlineEndByKey.get(k);
        if (hit) return hit;
      }
      return deadlineEndByKey.get(vzId) ?? null;
    };

    for (const c of arr(vz.casti_verejne_zakazky)) {
      const lotId = str(c.identifikator_NIPEZ);
      if (!lotId) {
        out.droppedLots += 1;
        continue;
      }
      const zp = obj(c.zadavaci_postup_pro_cast);
      const predmet = obj(c.predmet);
      const cpv = str(predmet.hlavni_kod_CPV);

      // bid counts — the register's own aggregate block
      let bidCount: number | null = null;
      for (const b of arr(zp.podane_nabidky_nebo_zadosti_o_ucast)) {
        const n = num(b.pocet_podanych_nabidek_nebo_zadosti_o_ucast);
        if (n != null) bidCount = (bidCount ?? 0) + n;
      }

      // participants + per-podání evaluation and price
      const participants: IsvzParticipant[] = [];
      let evaluatedBidCount: number | null = null;
      for (const u of arr(zp.ucastnici)) {
        const podani = arr(u.podani);
        const evaluated = podani.length ? podani.some((p) => p.nabidka_byla_hodnocena === true) : null;
        if (evaluated != null) evaluatedBidCount = (evaluatedBidCount ?? 0) + (evaluated ? 1 : 0);
        let bidCzk: number | null = null;
        for (const p of podani) {
          for (const nh of arr(p.nabidkove_hodnoty)) {
            if (str(nh.mena) === "CZK" && /bez DPH/i.test(str(nh.druh_nabidkove_hodnoty_odpovidajici_ciselne_vyjadritelnym_kriteriem_hodnoceni) ?? "")) {
              bidCzk = num(nh.hodnota) ?? bidCzk;
            }
          }
        }
        for (const dd of arr(u.dodavatele)) {
          const s = subjectOf(dd.subjekt);
          if (!s) continue;
          participants.push({ ...s, role: str(dd.role_dodavatele), evaluated, bidCzkNoVat: bidCzk });
        }
      }

      // winners
      const vysledek = obj(zp.vysledek);
      const winners = arr(vysledek.vybrani_dodavatele_zadavaciho_postupu)
        .map((w) => {
          const s = subjectOf(w.subjekt);
          return s
            ? {
                ...s,
                decidedOn: str(w.datum_rozhodnuti_o_vyberu_dodavatele),
                soleBidderSelfDeclared: boolOrNull(w.dodavatel_podal_pouze_jednu_nabidku),
              }
            : null;
        })
        .filter((w): w is NonNullable<typeof w> => w !== null);

      const spread = obj(zp.hodnoty_podanych_nabidek);
      const namitky = arr(zp.namitky);
      const euRaw = c.verejna_zakazka_je_alespon_castecne_financovana_z_prostredku_Evropske_unie;

      const toolIds = arr(c.identifikatory_v_elektronickem_nastroji);
      const tool = toolIds.find((t) => str(t.kod_nastroje) && str(t.identifikator));

      out.lots.push({
        lotId,
        vzId,
        name: str(c.nazev_casti_verejne_zakazky) ?? str(vz.nazev_verejne_zakazky) ?? lotId,
        authority,
        cpv,
        cpvDivision: cpv ? cpv.slice(0, 2) : null,
        kind: str(c.druh_casti_verejne_zakazky) ?? str(vz.druh_verejne_zakazky),
        regime: str(c.rezim_casti_verejne_zakazky) ?? str(vz.rezim_verejne_zakazky),
        procedureType: str(zp.druh_zadavaciho_postupu),
        estimatedCzkNoVat: num(c.predpokladana_hodnota_casti_bez_DPH_v_CZK),
        euFunded: boolOrNull(euRaw),
        deadlineDays: daysBetween(str(zp.datum_zahajeni_zadavaciho_postupu), deadlineEndForLot(lotId)),
        startedOn: str(zp.datum_zahajeni_zadavaciho_postupu),
        endedOn: str(zp.datum_ukonceni_zadavaciho_postupu),
        resultKind: str(zp.evidence_vysledku_zadavaciho_postupu) ?? str(vysledek.vysledek_ukonceni_zadavaciho_postupu),
        bidCount,
        evaluatedBidCount,
        lowestBidCzk: num(spread.nejnizsi_hodnota_hodnocene_nabidky),
        highestBidCzk: num(spread.nejvyssi_hodnota_hodnocene_nabidky),
        objectionsCount: namitky.length ? namitky.length : null,
        participants,
        winners,
        toolRef: tool ? { tool: str(tool.kod_nastroje)!, id: str(tool.identifikator)! } : null,
      });
    }
  }
  return out;
}
