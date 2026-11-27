// The Escape rule of conventions 15: isEscapeRequest and isComposingKey.
import { describe, expect, it } from "vitest";
import { isComposingKey, isEscapeRequest } from "./escape-key.js";

function keydown(init: KeyboardEventInit, prevent = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  if (prevent) event.preventDefault();
  return event;
}

describe("isEscapeRequest", () => {
  it("is true for a plain Escape", () => {
    expect(isEscapeRequest(keydown({ key: "Escape" }))).toBe(true);
  });

  it.each([
    ["another key", keydown({ key: "Enter" })],
    ["an Escape with isComposing", keydown({ key: "Escape", isComposing: true })],
    ["an Escape with keyCode 229 (WebKit)", keydown({ key: "Escape", keyCode: 229 })],
    ["the IME's Process key", keydown({ key: "Process", keyCode: 229 })],
    ["a prevented Escape", keydown({ key: "Escape" }, true)],
  ])("is false for %s", (_, event) => {
    expect(isEscapeRequest(event)).toBe(false);
  });
});

describe("isComposingKey", () => {
  it("reads isComposing and keyCode 229", () => {
    expect(isComposingKey(keydown({ key: "a" }))).toBe(false);
    expect(isComposingKey(keydown({ key: "a", isComposing: true }))).toBe(true);
    expect(isComposingKey(keydown({ key: "Enter", keyCode: 229 }))).toBe(true);
  });
});
