import { expect, test } from "bun:test";
import { modeOf } from "../src/route";

test("subway lines stay subway", () => {
  for (const q of ["A downtown 14th st", "7 flushing", "6X 125", "Q dekalb", "S times sq", "SIR st george", "si tottenville", "x 14", ""]) {
    expect(modeOf(q)).toBe("subway");
  }
});

test("bus routes go to bus", () => {
  for (const q of ["M15 south 23rd", "m15+ 1st av 23", "Bx12 sbs fordham", "B44+ nostrand", "Q10 lefferts", "S79-SBS hylan", "M14A 14th", "BM1 wall st"]) {
    expect(modeOf(q)).toBe("bus");
  }
});
