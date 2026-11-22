import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reads the real tokens from styles.css and checks WCAG contrast, so colour changes
// can't silently break legibility.
const css = fs.readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

function token(name: string): [number, number, number] {
  const match = css.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`));
  if (!match) throw new Error(`token --${name} not found as oklch()`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** OKLCH → relative luminance (via OKLab and linear sRGB, clamped to gamut). */
function luminance([l, c, h]: [number, number, number]): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const r = clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
  const g = clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
  const bl = clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const contrast = (x: [number, number, number], y: [number, number, number]) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const white: [number, number, number] = [1, 0, 0];

describe("Ligne colour contrast (WCAG AA)", () => {
  it.each([1, 2, 3, 4, 5])("level %i colour carries white text at 4.5:1 or more", (n) => {
    expect(contrast(token(`level-${n}`), white)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([1, 2, 3, 4, 5])("level %i colour is readable as text on paper", (n) => {
    expect(contrast(token(`level-${n}`), token("paper"))).toBeGreaterThanOrEqual(4.5);
  });

  it("ink and secondary ink are readable on paper and paper-2", () => {
    expect(contrast(token("ink"), token("paper"))).toBeGreaterThanOrEqual(7);
    expect(contrast(token("ink-2"), token("paper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("ink-2"), token("paper-2"))).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on the primary (ink) button and on alerts", () => {
    expect(contrast(token("ink"), white)).toBeGreaterThanOrEqual(7);
    expect(contrast(token("alert"), white)).toBeGreaterThanOrEqual(4.5);
  });
});
