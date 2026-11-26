// The pure filter (design/components/otp-field.md 4.1), one row per rule and charset.
import { describe, expect, it } from "vitest";
import {
  activeRange,
  applyEdit,
  charsetInputMode,
  charsetPattern,
  filterChars,
  normalizeCode,
} from "./otp-field-filter.js";
import type { EditBefore, EditInput, OTPFieldCharset } from "./otp-field-filter.js";

function before(text: string, start = text.length, end = start): EditBefore {
  return { text, selectionStart: start, selectionEnd: end };
}

/** The browser's edit: `run` replaces `[start, end)` of `text`. */
function insert(
  text: string,
  run: string,
  start = text.length,
  end = start,
  options: Partial<EditInput> = {},
) {
  const dom = text.slice(0, start) + run + text.slice(end);
  return applyEdit({
    before: before(text, start, end),
    dom,
    caret: start + run.length,
    inputType: "insertText",
    charset: "numeric",
    length: 6,
    ...options,
  });
}

describe("filterChars", () => {
  it.each<[OTPFieldCharset, string, string]>([
    ["numeric", "12a3-4 5", "12345"],
    ["numeric", "１２３４５６", "123456"],
    ["numeric", "٣4", "4"],
    ["alphanumeric", "aB-3 x", "aB3x"],
    ["alphabetic", "aB3x-é", "aBx"],
  ])("%s keeps %j as %j", (charset, text, kept) => {
    expect(filterChars(text, charset)).toBe(kept);
  });

  it("does not convert full-width digits outside numeric", () => {
    expect(filterChars("１a", "alphanumeric")).toBe("a");
  });

  it("normalizeCode cuts to length", () => {
    expect(normalizeCode("1234567", "numeric", 6)).toBe("123456");
    expect(normalizeCode("12 34 56 78", "numeric", 4)).toBe("1234");
  });
});

describe("charset table", () => {
  it.each<[OTPFieldCharset, "numeric" | "text", string]>([
    ["numeric", "numeric", "[0-9]{6}"],
    ["alphanumeric", "text", "[A-Za-z0-9]{6}"],
    ["alphabetic", "text", "[A-Za-z]{6}"],
  ])("%s: inputmode %s, pattern %s", (charset, mode, pattern) => {
    expect(charsetInputMode(charset)).toBe(mode);
    expect(charsetPattern(charset, 6)).toBe(pattern);
  });
});

describe("applyEdit", () => {
  it("appends at the end of a partial code (rule 4)", () => {
    expect(insert("12", "3")).toMatchObject({ value: "123", caret: 3, kept: 1 });
  });

  it("overtypes a filled position with a collapsed caret (rule 4)", () => {
    expect(insert("123456", "9", 2)).toMatchObject({ value: "129456", caret: 3, kept: 1 });
    expect(insert("1234", "98", 1)).toMatchObject({ value: "1984", caret: 3 });
  });

  it("replaces a selected range (rule 3)", () => {
    expect(insert("123456", "9", 1, 4)).toMatchObject({ value: "1956", caret: 2 });
  });

  it("replaces the last character of a complete code at its end (rule 5)", () => {
    expect(insert("123456", "7")).toMatchObject({ value: "123457", caret: 6, kept: 1 });
  });

  it("replaces everything with a full code (rule 2), filtered", () => {
    const paste = { inputType: "insertFromPaste" };
    expect(insert("12", "123 456", 2, 2, paste)).toMatchObject({ value: "123456", caret: 6 });
    expect(insert("12", "123-456", 0, 0, paste)).toMatchObject({ value: "123456" });
    expect(insert("", "12345678", 0, 0, paste)).toMatchObject({ value: "123456", kept: 8 });
    expect(insert("98", "１２３４５６", 1, 1, paste)).toMatchObject({ value: "123456" });
  });

  it("a partial paste overtypes from the caret", () => {
    expect(insert("3456", "1 2", 0, 0, { inputType: "insertFromPaste" })).toMatchObject({
      value: "1256",
      caret: 2,
    });
  });

  it("cuts the result to length (rule 7)", () => {
    expect(insert("12345", "99", 4)).toMatchObject({ value: "123499", caret: 6 });
  });

  it("drops an insertion the filter keeps nothing of, restoring the selection", () => {
    expect(insert("12", "a")).toEqual({ value: "12", caret: null, kept: 0, selection: [2, 2] });
    expect(insert("1234", "x", 1, 3)).toEqual({
      value: "1234",
      caret: null,
      kept: 0,
      selection: [1, 3],
    });
  });

  it.each<[OTPFieldCharset, string, string]>([
    ["alphanumeric", "aB", "aB"],
    ["alphanumeric", "a-1", "a1"],
    ["alphabetic", "a1b", "ab"],
  ])("%s keeps %j as %j", (charset, run, kept) => {
    expect(insert("", run, 0, 0, { charset })).toMatchObject({ value: kept });
  });

  it("a deletion is filter(dom), the caret kept (rule 6)", () => {
    expect(
      applyEdit({
        before: before("1234", 2),
        dom: "134",
        caret: 1,
        inputType: "deleteContentBackward",
        charset: "numeric",
        length: 6,
      }),
    ).toEqual({ value: "134", caret: 1, kept: 0, selection: null });
  });

  it("an input with no beforeinput is filter(dom) (rule 6: autofill)", () => {
    expect(
      applyEdit({
        before: null,
        dom: "123 456",
        caret: 7,
        inputType: "insertReplacementText",
        charset: "numeric",
        length: 6,
      }),
    ).toEqual({ value: "123456", caret: 6, kept: 0, selection: null });
  });

  it("falls back to filter(dom) when the edit is not where beforeinput said", () => {
    expect(
      applyEdit({
        before: before("12", 2),
        dom: "9x12",
        caret: 2,
        inputType: "insertText",
        charset: "numeric",
        length: 6,
      }),
    ).toMatchObject({ value: "912", caret: 1 });
  });
});

describe("activeRange", () => {
  it("is empty when not focused", () => {
    expect(activeRange(false, 2, 2, 6)).toEqual([0, 0]);
  });

  it("a collapsed caret marks its slot, the last one at the end of a complete code", () => {
    expect(activeRange(true, 2, 2, 6)).toEqual([2, 3]);
    expect(activeRange(true, 6, 6, 6)).toEqual([5, 6]);
  });

  it("a range marks every slot in it", () => {
    expect(activeRange(true, 1, 4, 6)).toEqual([1, 4]);
    expect(activeRange(true, 0, 6, 6)).toEqual([0, 6]);
  });
});
