// The parser, formatter and stepping arithmetic of NumberField (design/components/number-field.md
// 5, test plan 14.1 "Parser and formatter"). Pure; jsdom's ICU has every locale used here.
import { describe, expect, it } from "vitest";
import { decimalsOf, roundTo } from "../internal/decimal.js";
import { boundValue, isAtBound, stepBy, stepValue } from "./number-field-arithmetic.js";
import { createNumberFormatter } from "./number-field-format.js";

const NBSP = " ";
const NNBSP = " ";

describe("round trips", () => {
  const cases: [string, Intl.NumberFormatOptions][] = [
    ["en-US", {}],
    ["de-DE", {}],
    ["fr-FR", {}],
    ["de-CH", {}],
    ["ar-EG", {}],
    ["ja-JP", {}],
    ["en-IN", {}],
    ["hi-IN", { numberingSystem: "deva" }],
    ["de-DE", { style: "currency", currency: "EUR" }],
    ["en-US", { style: "currency", currency: "EUR", currencySign: "accounting" }],
    ["ja-JP", { style: "currency", currency: "JPY" }],
    ["en-US", { style: "percent", maximumFractionDigits: 1 }],
    ["en-US", { style: "unit", unit: "kilometer" }],
    ["en-US", { style: "unit", unit: "kilometer", unitDisplay: "long" }],
  ];
  const values = [0, 1, -1, 12, 1234.5, -1234567.25, 0.125, 1000000];
  it.each(cases)("%s %o", (locale, options) => {
    const f = createNumberFormatter(locale, options);
    for (const value of values) {
      const text = f.format(value);
      const parsed = f.parse(text);
      expect(parsed, `${text}`).not.toBeUndefined();
      expect(f.format(parsed as number), `${text}`).toBe(text);
    }
  });
});

describe("strict grouping", () => {
  it("en", () => {
    const f = createNumberFormatter("en-US");
    expect(f.parse("1,5")).toBeUndefined();
    expect(f.parse("1,234")).toBe(1234);
    expect(f.parse("1,234,567.5")).toBe(1234567.5);
    expect(f.parse("12,34")).toBeUndefined();
    expect(f.parse("1234,567")).toBeUndefined();
    expect(f.parse("1.234,5")).toBeUndefined();
    expect(f.parse("1.2.3")).toBeUndefined();
    expect(f.parse("1.5,0")).toBeUndefined();
  });

  it("de", () => {
    const f = createNumberFormatter("de-DE");
    expect(f.parse("1.5")).toBeUndefined();
    expect(f.parse("1.234,5")).toBe(1234.5);
    expect(f.parse("1,5")).toBe(1.5);
  });

  it("fr with U+202F, NBSP and a plain space", () => {
    const f = createNumberFormatter("fr-FR");
    expect(f.parse(`1${NNBSP}234,5`)).toBe(1234.5);
    expect(f.parse(`1${NBSP}234,5`)).toBe(1234.5);
    expect(f.parse("1 234,5")).toBe(1234.5);
    expect(f.parse("12 34,5")).toBeUndefined();
  });

  it("de-CH apostrophes", () => {
    const f = createNumberFormatter("de-CH");
    expect(f.parse("1'234.5")).toBe(1234.5);
    expect(f.parse("1’234.5")).toBe(1234.5);
  });

  it("en-IN two-digit groups", () => {
    const f = createNumberFormatter("en-IN");
    expect(f.parse("12,34,567")).toBe(1234567);
    expect(f.parse("1,234,567")).toBeUndefined();
  });
});

describe("digits and signs", () => {
  it("Arabic-Indic digits, decimal and group", () => {
    const f = createNumberFormatter("ar-EG");
    expect(f.parse("١٢٣")).toBe(123);
    expect(f.parse("١٬٢٣٤٫٥")).toBe(1234.5);
    expect(f.parse(f.format(-5))).toBe(-5);
  });

  it("full-width digits", () => {
    const f = createNumberFormatter("ja-JP");
    expect(f.parse("１２")).toBe(12);
    expect(f.parse("－１２")).toBe(-12);
  });

  it("Devanagari digits", () => {
    const f = createNumberFormatter("hi-IN", { numberingSystem: "deva" });
    expect(f.parse("२")).toBe(2);
    expect(f.parse("2")).toBe(2);
  });

  it("minus, U+2212, accounting, trailing minus, plus", () => {
    const f = createNumberFormatter("en-US");
    expect(f.parse("-1")).toBe(-1);
    expect(f.parse("−1")).toBe(-1);
    expect(f.parse("1-")).toBe(-1);
    expect(f.parse("+1")).toBe(1);
    expect(f.parse("-")).toBeUndefined();
    expect(f.parse("+")).toBeUndefined();
    const accounting = createNumberFormatter("en-US", {
      style: "currency",
      currency: "USD",
      currencySign: "accounting",
    });
    expect(accounting.parse("(1)")).toBe(-1);
    expect(accounting.parse("($1.50)")).toBe(-1.5);
  });
});

describe("styles", () => {
  it("percent scales by 100", () => {
    const f = createNumberFormatter("en-US", { style: "percent", maximumFractionDigits: 1 });
    expect(f.parse("50")).toBe(0.5);
    expect(f.parse("50%")).toBe(0.5);
    expect(f.parse("0.5")).toBe(0.005);
    expect(f.format(0.5)).toBe("50%");
  });

  it("currency strings in every spelling", () => {
    const de = createNumberFormatter("de-DE", { style: "currency", currency: "EUR" });
    expect(de.parse("1,50 €")).toBe(1.5);
    expect(de.parse("€ 1,50")).toBe(1.5);
    const en = createNumberFormatter("en-US", { style: "currency", currency: "EUR" });
    expect(en.parse("EUR 1.50")).toBe(1.5);
    expect(en.parse("1.50 euros")).toBe(1.5);
    expect(en.parse("€1.50")).toBe(1.5);
    expect(en.parse("1.50 $")).toBeUndefined();
  });

  it("units", () => {
    const short = createNumberFormatter("en-US", { style: "unit", unit: "kilometer" });
    expect(short.parse("12 km")).toBe(12);
    const long = createNumberFormatter("en-US", {
      style: "unit",
      unit: "kilometer",
      unitDisplay: "long",
    });
    expect(long.parse("12 kilometers")).toBe(12);
    expect(long.parse("1 kilometer")).toBe(1);
    expect(long.parse("12 km")).toBe(12);
  });

  it("affixes are stripped at the edges only, never inside the number", () => {
    const fr = createNumberFormatter("fr-FR", { style: "currency", currency: "EUR" });
    expect(fr.parse("1€234")).toBeUndefined();
    expect(fr.parse("1 234,50 €")).toBe(1234.5);
    expect(fr.parse("€ 1 234,50")).toBe(1234.5);
    const en = createNumberFormatter("en-US", { style: "currency", currency: "EUR" });
    expect(en.parse("-€1.50")).toBe(-1.5);
    expect(en.parse("€-1.50")).toBe(-1.5);
    expect(en.parse("1EUR5")).toBeUndefined();
    const percent = createNumberFormatter("en-US", { style: "percent" });
    expect(percent.parse("5%0")).toBeUndefined();
  });

  it("a percent sign outside percent style is garbage", () => {
    expect(createNumberFormatter("en-US").parse("50%")).toBeUndefined();
  });
});

describe("rounding (5.4)", () => {
  it("rounds to the resolved fraction digits", () => {
    const eur = createNumberFormatter("de-DE", { style: "currency", currency: "EUR" });
    expect(eur.parse("1,999")).toBe(2);
    expect(eur.format(2)).toBe(`2,00${NBSP}€`);
    const jpy = createNumberFormatter("ja-JP", { style: "currency", currency: "JPY" });
    expect(jpy.parse("12.6")).toBe(13);
    const decimal = createNumberFormatter("en-US");
    expect(decimal.parse("1.23456")).toBe(1.235);
    const percent = createNumberFormatter("en-US", { style: "percent" });
    expect(percent.parse("12.4")).toBe(0.12);
    expect(percent.fractionDigits).toBe(0);
  });

  it("empty and whitespace are null; garbage is unparsable", () => {
    const f = createNumberFormatter("en-US");
    expect(f.parse("")).toBeNull();
    expect(f.parse("   ")).toBeNull();
    expect(f.parse("abc")).toBeUndefined();
    expect(f.parse("1a")).toBeUndefined();
    expect(f.format(null)).toBe("");
  });

  it("flags compact notation and significant digits", () => {
    expect(createNumberFormatter("en-US", { notation: "compact" }).warning).toMatch(/compact/);
    const significant = createNumberFormatter("en-US", { maximumSignificantDigits: 2 });
    expect(significant.warning).toMatch(/SignificantDigits/);
    expect(significant.round(1.23456)).toBe(1.23456);
    expect(createNumberFormatter("en-US").warning).toBeNull();
  });

  it("allowsFractions by format", () => {
    expect(createNumberFormatter("en-US").allowsFractions).toBe(true);
    expect(createNumberFormatter("en-US", { maximumFractionDigits: 0 }).allowsFractions).toBe(
      false,
    );
    expect(
      createNumberFormatter("ja-JP", { style: "currency", currency: "JPY" }).allowsFractions,
    ).toBe(false);
    expect(createNumberFormatter("en-US", { style: "percent" }).allowsFractions).toBe(true);
  });

  it("caches per (locale, format) content", () => {
    expect(createNumberFormatter("en-US", { style: "percent" })).toBe(
      createNumberFormatter("en-US", { style: "percent" }),
    );
  });
});

describe("decimal helpers", () => {
  it("decimalsOf and roundTo", () => {
    expect(decimalsOf(0.001)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
    expect(Object.is(roundTo(-0.0001, 2), 0)).toBe(true);
  });
});

describe("stepping (5.5)", () => {
  const b = (min: number | undefined, max: number | undefined, step = 1) => ({ min, max, step });

  it("snaps off-grid values in the stepping direction", () => {
    expect(stepValue(1.5, 1, b(undefined, undefined))).toBe(2);
    expect(stepValue(1.5, -1, b(undefined, undefined))).toBe(1);
  });

  it("steps from empty", () => {
    expect(stepValue(null, 1, b(3, undefined))).toBe(3);
    expect(stepValue(null, -1, b(3, undefined))).toBe(3);
    expect(stepValue(null, -1, b(undefined, undefined))).toBe(-1);
    expect(stepValue(null, 1, b(undefined, undefined))).toBe(1);
  });

  it("clamps at the bounds, an unreachable max stays unreachable", () => {
    expect(stepValue(99, 1, b(1, 99))).toBe(99);
    expect(stepValue(4, 1, b(0, 5, 2))).toBe(4);
    expect(stepValue(2, 1, b(0, 5, 2))).toBe(4);
    expect(isAtBound(4, 1, b(0, 5, 2))).toBe(true);
    expect(isAtBound(2, 1, b(0, 5, 2))).toBe(false);
    expect(isAtBound(null, 1, b(0, 0))).toBe(false);
    expect(stepValue(150, 1, b(0, 99))).toBe(150);
    expect(stepValue(150, -1, b(0, 99))).toBe(99);
    expect(stepValue(-5, -1, b(0, 99))).toBe(-5);
  });

  it("rounds fractional steps", () => {
    expect(stepValue(0.2, 1, b(undefined, undefined, 0.1))).toBe(0.3);
    expect(stepValue(0.3, -1, b(undefined, undefined, 0.1))).toBe(0.2);
    expect(stepValue(1, 1, b(0.05, undefined, 0.1))).toBe(1.05);
  });

  it("largeStep: whole and fractional multiples", () => {
    expect(stepBy(5, 10, b(0, 100))).toBe(15);
    expect(stepBy(5, -10, b(0, 100))).toBe(0);
    expect(stepBy(0, 5, b(0, 100, 2))).toBe(4);
    expect(stepBy(0, 1, b(0, 100, 2))).toBe(2);
    expect(stepBy(95, 10, b(0, 100))).toBe(100);
  });

  it("Home / End targets", () => {
    expect(boundValue("min", b(3, 10))).toBe(3);
    expect(boundValue("max", b(0, 5, 2))).toBe(4);
    expect(boundValue("max", b(undefined, undefined))).toBeUndefined();
  });
});
