import { describe, expect, it } from "vitest";
import { ANSWERS_PARAM, decodeAnswers, encodeAnswers } from "./codec";
import type { Answer } from "./score";

const m = (entries: Array<[number, Answer]>): Map<number, Answer> => new Map(entries);

describe("kompas answers codec", () => {
  it("encodes canonically: ascending ids, a=pro / n=proti", () => {
    expect(encodeAnswers(m([[92810, "proti"], [92793, "pro"]]))).toBe("92793a-92810n");
    expect(ANSWERS_PARAM).toBe("hlasy");
  });

  it("empty answers encode to null (clean address)", () => {
    expect(encodeAnswers(m([]))).toBeNull();
  });

  it("round-trips every answer set", () => {
    const sets: Array<Array<[number, Answer]>> = [
      [[1, "pro"]],
      [[92793, "pro"], [92810, "proti"], [93001, "proti"]],
      [[7, "proti"], [8, "pro"], [1234567, "pro"]],
    ];
    for (const s of sets) {
      const encoded = encodeAnswers(m(s))!;
      const decoded = decodeAnswers(encoded)!;
      expect(encodeAnswers(decoded)).toBe(encoded);
      expect([...decoded.entries()].sort(([a], [b]) => a - b)).toEqual([...s].sort(([a], [b]) => a - b));
    }
  });

  it("rejects anything non-canonical — never repairs", () => {
    for (const raw of [
      "", // empty
      "nesmysl",
      "92793x", // unknown stance letter
      "92793a-", // trailing empty part
      "-92793a",
      "92793a-92793n", // duplicate id
      "92810a-92793n", // non-ascending
      "0a", // zero id
      "12345678a", // over 7 digits
      "92793a 92810n", // wrong separator
      "92793A", // uppercase
    ]) {
      expect(decodeAnswers(raw), raw).toBeNull();
    }
  });

  it("null/undefined decode to null", () => {
    expect(decodeAnswers(null)).toBeNull();
    expect(decodeAnswers(undefined)).toBeNull();
  });
});
