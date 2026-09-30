// A tagged template that escapes every interpolated value unless it is already
// Html, so markup can only come from literals or from other html`` results.
export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

// Numbers are allowed for values like minutes; guard conditionals with a boolean
// (`xs.length > 0 && ...`), since a bare 0 would render as "0".
type Value = Html | string | number | false | null | undefined | Value[];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

function out(v: Value): string {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(out).join("");
  if (v instanceof Html) return v.value;
  return esc(String(v));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): Html {
  let s = strings[0]!;
  values.forEach((v, i) => (s += out(v) + strings[i + 1]!));
  return new Html(s);
}

// For trusted markup that isn't built with html``, like the inlined stylesheet.
export const raw = (s: string) => new Html(s);

export const queryHref = (q: string) => `/?q=${encodeURIComponent(q)}`;
