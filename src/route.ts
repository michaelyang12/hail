export type Mode = "subway" | "bus";

// Bus routes are a letter prefix plus a number (M15, Bx12, B44+, S79-SBS); subway
// lines never start with a letter followed by a digit (A, 7, 6X, SIR). So Q is a
// train and Q10 a bus. Anything else stays subway so its errors read as before.
export function modeOf(q: string): Mode {
  const first = q.trim().split(/\s+/, 1)[0] ?? "";
  return /^[a-z]+\d/i.test(first) ? "bus" : "subway";
}
