import { expect, test } from "bun:test";
import { findStop, score } from "../src/match";

const cases: [line: string, stop: string, expected: string][] = [
  ["A", "14th st", "A31"],
  ["A", "14", "A31"],
  ["A", "145", "A12"],
  ["A", "145 st", "A12"],
  ["A", "w 4", "A32"],
  ["A", "west 4th", "A32"],
  ["A", "canl", "A34"],
  ["A", "fultn", "A38"],
  ["A", "fulton", "A38"],
  ["1", "times sq", "127"],
  ["1", "times square", "127"],
  ["L", "union sq", "L03"],
  ["L", "14", "L03"],
  ["E", "queens plaza", "G21"],
  ["A", "168", "A09"],
];

for (const [line, stop, expected] of cases) {
  test(`${line} "${stop}" -> ${expected}`, () => {
    expect(findStop(line, stop)?.station.stopId).toBe(expected);
  });
}

test("no match returns null", () => {
  expect(findStop("A", "qwerty zzz")).toBeNull();
});

test("numbers never prefix-match", () => {
  expect(score(["14"], ["145", "st"])).toBe(0);
});

test("exact name beats a longer name with the same tokens", () => {
  expect(score(["14", "st"], ["14", "st"])).toBeGreaterThan(score(["14", "st"], ["14", "st", "union", "sq"]));
});
