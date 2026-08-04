import { describe, expect, it } from "vitest";
import {
  EMPTY_SCHRANKA,
  entityDenikHref,
  entityHref,
  followableFromRoute,
  isEntityKey,
  MAX_FOLLOWS,
  parseSchrankaState,
  serializeSchrankaState,
  withFollow,
  withoutFollow,
  withSeen,
} from "./followCodec";

const NOW = "2026-07-31T10:00:00.000Z";

describe("isEntityKey", () => {
  it("přijímá čtyři držené tvary klíče", () => {
    expect(isEntityKey("poslanec:123")).toBe(true);
    expect(isEntityKey("tisk:141")).toBe(true);
    expect(isEntityKey("firma:04544152")).toBe(true);
    expect(isEntityKey("obec:00241717")).toBe(true);
  });

  it("odmítá cizí a zkažené tvary", () => {
    expect(isEntityKey("")).toBe(false);
    expect(isEntityKey("poslanec:")).toBe(false);
    expect(isEntityKey("poslanec:abc")).toBe(false);
    expect(isEntityKey("firma:123")).toBe(false); // ičo má 6–8 číslic
    expect(isEntityKey("zaznam:xyz")).toBe(false);
    expect(isEntityKey(42)).toBe(false);
    expect(isEntityKey(null)).toBe(false);
  });
});

describe("entityHref", () => {
  it("mapuje klíče na evidenční stránky včetně spisu firmy", () => {
    expect(entityHref("poslanec:123")).toBe("/poslanec/123");
    expect(entityHref("tisk:141")).toBe("/zakony/141");
    expect(entityHref("obec:00241717")).toBe("/rozpocty/00241717");
    expect(entityHref("firma:04544152")).toBe("/penize/firma/04544152");
  });

  it("ičo v adrese je kanonické (klíč nese 6–8 číslic, uzel vždy 8)", () => {
    expect(entityHref("firma:2867681")).toBe("/penize/firma/02867681");
    expect(entityHref("firma:123456")).toBe("/penize/firma/00123456");
  });

  it("deník entity je adresa filtru (URL je odběr)", () => {
    expect(entityDenikHref("firma:04544152")).toBe("/denik?entita=firma%3A04544152");
  });
});

describe("parseSchrankaState — tolerantní vstup", () => {
  it("null / prázdno / rozbitý JSON → prázdná schránka, nikdy výjimka", () => {
    expect(parseSchrankaState(null)).toEqual(EMPTY_SCHRANKA);
    expect(parseSchrankaState("")).toEqual(EMPTY_SCHRANKA);
    expect(parseSchrankaState("{nevalidní")).toEqual(EMPTY_SCHRANKA);
    expect(parseSchrankaState("42")).toEqual(EMPTY_SCHRANKA);
    expect(parseSchrankaState('"text"')).toEqual(EMPTY_SCHRANKA);
  });

  it("vadné položky zahodí, zdravé zachová; duplicitní klíč vyhraje první", () => {
    const raw = JSON.stringify({
      follows: [
        { key: "poslanec:1", label: "A", followedAt: NOW },
        { key: "nesmysl", label: "B", followedAt: NOW },
        { key: "poslanec:1", label: "duplikát", followedAt: NOW },
        { key: "tisk:141", label: "", followedAt: "kdysi" },
        null,
        "řetězec",
      ],
      lastVisit: NOW,
      cizi: true,
    });
    const state = parseSchrankaState(raw);
    expect(state.follows.map((f) => f.key)).toEqual(["poslanec:1", "tisk:141"]);
    // Prázdný popisek degraduje na klíč, vadné razítko na epochu — nikdy vyhazov.
    expect(state.follows[1].label).toBe("tisk:141");
    expect(state.follows[1].followedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(state.lastVisit).toBe(NOW);
  });

  it("drží strop MAX_FOLLOWS", () => {
    const raw = JSON.stringify({
      follows: Array.from({ length: MAX_FOLLOWS + 20 }, (_, i) => ({
        key: `poslanec:${i + 1}`,
        label: `p${i}`,
        followedAt: NOW,
      })),
      lastVisit: null,
    });
    expect(parseSchrankaState(raw).follows).toHaveLength(MAX_FOLLOWS);
  });
});

describe("serialize/parse round-trip", () => {
  it("stav přežije okruh beze změny (klíče deterministicky seřazené)", () => {
    let state = EMPTY_SCHRANKA;
    state = withFollow(state, "tisk:141", "sn. tisk 141", NOW);
    state = withFollow(state, "poslanec:123", "Jan Novák", NOW);
    state = { ...state, lastVisit: NOW };
    const round = parseSchrankaState(serializeSchrankaState(state));
    expect(round.follows.map((f) => f.key)).toEqual(["poslanec:123", "tisk:141"]);
    expect(round.lastVisit).toBe(NOW);
    // Serializace je deterministická — dvakrát totéž = byte-identické.
    expect(serializeSchrankaState(round)).toBe(serializeSchrankaState(state));
  });
});

describe("vodoznak viděného (seen)", () => {
  it("stav bez vodoznaku je platný stav — neodečítá se nic", () => {
    expect(parseSchrankaState(JSON.stringify({ follows: [], lastVisit: NOW })).seen).toBeNull();
  });

  it("vodoznak platí jen celý; vadný tvar → null", () => {
    const read = (seen: unknown) =>
      parseSchrankaState(JSON.stringify({ follows: [], lastVisit: NOW, seen })).seen;
    expect(read({ day: "2026-08-04", count: 3 })).toEqual({ day: "2026-08-04", count: 3 });
    expect(read({ day: "2026-08-04" })).toBeNull();
    expect(read({ day: "včera", count: 3 })).toBeNull();
    expect(read({ day: "2026-08-04", count: -1 })).toBeNull();
    expect(read({ day: "2026-08-04", count: 1.5 })).toBeNull();
    expect(read("nesmysl")).toBeNull();
  });

  it("withSeen zapisuje jen platnou změnu (týž vodoznak je no-op)", () => {
    const a = withSeen(EMPTY_SCHRANKA, { day: "2026-08-04", count: 2 });
    expect(a.seen).toEqual({ day: "2026-08-04", count: 2 });
    expect(withSeen(a, { day: "2026-08-04", count: 2 })).toBe(a);
    expect(withSeen(a, { day: "kdysi", count: 2 })).toBe(a);
    expect(withSeen(a, { day: "2026-08-05", count: 0 }).seen).toEqual({ day: "2026-08-05", count: 0 });
  });

  it("přežije okruh serializace", () => {
    const state = withSeen({ ...EMPTY_SCHRANKA, lastVisit: NOW }, { day: "2026-08-04", count: 7 });
    expect(parseSchrankaState(serializeSchrankaState(state)).seen).toEqual({
      day: "2026-08-04",
      count: 7,
    });
  });
});

describe("withFollow / withoutFollow", () => {
  it("nepřidá nevalidní klíč ani duplikát; odebrání neexistujícího je no-op", () => {
    const a = withFollow(EMPTY_SCHRANKA, "poslanec:1", "A", NOW);
    expect(withFollow(a, "poslanec:1", "znovu", NOW)).toBe(a);
    expect(withFollow(a, "nesmysl", "X", NOW)).toBe(a);
    expect(withoutFollow(a, "tisk:9")).toBe(a);
    expect(withoutFollow(a, "poslanec:1").follows).toHaveLength(0);
  });
});

describe("followableFromRoute", () => {
  it("odvodí klíč z evidenčních stránek", () => {
    expect(followableFromRoute("/poslanec/123", null)).toBe("poslanec:123");
    expect(followableFromRoute("/zakony/141", null)).toBe("tisk:141");
  });

  it("peněžní spis poslance je táž entita jako jeho spis", () => {
    expect(followableFromRoute("/penize/6881", null)).toBe("poslanec:6881");
    // Podstránky spisu ani konzole entitu z adresy nenesou.
    expect(followableFromRoute("/penize/6881/paket", null)).toBeNull();
    expect(followableFromRoute("/penize/kontrola", null)).toBeNull();
    expect(followableFromRoute("/penize", null)).toBeNull();
  });

  it("spis firmy je sledovatelný, s kanonickým ičem", () => {
    expect(followableFromRoute("/penize/firma/46347534", null)).toBe("firma:46347534");
    expect(followableFromRoute("/penize/firma/2867681", null)).toBe("firma:02867681");
    expect(followableFromRoute("/penize/firma/abc", null)).toBeNull();
  });

  it("obec se z chromu už nenabízí — deník pro ni nemá co doručit", () => {
    expect(followableFromRoute("/rozpocty/00241717", null)).toBeNull();
    // Uložené sledování obce ale zůstává platným klíčem (kodek ho parsuje)
    // a filtrovaný deník ho pořád adresuje.
    expect(isEntityKey("obec:00241717")).toBe(true);
    expect(followableFromRoute("/denik", "obec:00241717")).toBe("obec:00241717");
  });

  it("filtrovaný deník sleduje filtrovanou entitu; jinde je filtr ignorován", () => {
    expect(followableFromRoute("/denik", "firma:04544152")).toBe("firma:04544152");
    expect(followableFromRoute("/zebricek", "firma:04544152")).toBeNull();
    expect(followableFromRoute("/denik", "nesmysl")).toBeNull();
  });

  it("plochy bez jednoznačné entity sledovatelné nejsou", () => {
    expect(followableFromRoute("/zakony", null)).toBeNull();
    expect(followableFromRoute("/zakony/predpis", null)).toBeNull();
    expect(followableFromRoute("/poslanec/123/cokoli", null)).toBeNull();
    expect(followableFromRoute("/", null)).toBeNull();
  });
});
