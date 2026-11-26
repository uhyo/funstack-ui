import { describe, expect, it } from "vitest";
import {
  createTypeaheadBuffer,
  findTypeahead,
  isTypingAhead,
  pushTypeahead,
  TYPEAHEAD_RESET_MS,
  typeaheadMatch,
} from "./typeahead.js";

const TEXTS = ["green olive", "green pepper", "garlic", "ham"];

describe("typeahead (menu.md 5.1)", () => {
  it("a repeated letter cycles from the item after the current one, wrapping", () => {
    const buffer = createTypeaheadBuffer();
    expect(typeaheadMatch(buffer, "g", TEXTS, -1, 0)).toBe(0);
    expect(typeaheadMatch(buffer, "g", TEXTS, 0, 10)).toBe(1);
    expect(typeaheadMatch(buffer, "g", TEXTS, 1, 20)).toBe(2);
    expect(typeaheadMatch(buffer, "g", TEXTS, 2, 30)).toBe(0);
  });

  it("a longer buffer keeps the current item while it matches, case-insensitively", () => {
    const buffer = createTypeaheadBuffer();
    expect(typeaheadMatch(buffer, "G", TEXTS, -1, 0)).toBe(0);
    expect(typeaheadMatch(buffer, "r", TEXTS, 0, 10)).toBe(0);
    for (const [i, c] of [..."een p"].entries()) typeaheadMatch(buffer, c, TEXTS, 0, 20 + i);
    expect(findTypeahead(buffer, TEXTS, 0)).toBe(1);
    expect(buffer.text).toBe("green p");
  });

  it("a Space is taken only by a live buffer; the buffer expires", () => {
    const buffer = createTypeaheadBuffer();
    expect(pushTypeahead(buffer, " ", 0)).toBe(false);
    expect(isTypingAhead(buffer, 0)).toBe(false);
    expect(pushTypeahead(buffer, "h", 0)).toBe(true);
    expect(isTypingAhead(buffer, TYPEAHEAD_RESET_MS)).toBe(true);
    expect(pushTypeahead(buffer, " ", 100)).toBe(true);
    expect(buffer.text).toBe("h ");
    expect(isTypingAhead(buffer, 100 + TYPEAHEAD_RESET_MS + 1)).toBe(false);
    expect(typeaheadMatch(buffer, "h", TEXTS, -1, 100 + TYPEAHEAD_RESET_MS + 1)).toBe(3);
    expect(buffer.text).toBe("h");
  });

  it("no match and no items give -1", () => {
    const buffer = createTypeaheadBuffer();
    expect(typeaheadMatch(buffer, "z", TEXTS, -1, 0)).toBe(-1);
    expect(typeaheadMatch(createTypeaheadBuffer(), "a", [], -1, 0)).toBe(-1);
  });
});
