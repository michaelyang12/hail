import { expect, test } from "bun:test";
import { normalize } from "../src/normalize";

test("ordinals and street aliases", () => {
  expect(normalize("125th Street")).toEqual(["125", "st"]);
  expect(normalize("West 4th")).toEqual(["w", "4"]);
  expect(normalize("1st Avenue")).toEqual(["1", "av"]);
});

test("splits station names on hyphens and slashes", () => {
  expect(normalize("14 St-Union Sq")).toEqual(["14", "st", "union", "sq"]);
  expect(normalize("W 4 St-Wash Sq")).toEqual(["w", "4", "st", "wash", "sq"]);
  expect(normalize("Jay St-MetroTech")).toEqual(["jay", "st", "metrotech"]);
});

test("punctuation and ampersand", () => {
  expect(normalize("Hoyt & Schermerhorn Sts.")).toEqual(["hoyt", "and", "schermerhorn", "sts"]);
  expect(normalize("  Times   Square ")).toEqual(["times", "sq"]);
});
