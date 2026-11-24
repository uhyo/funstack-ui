// Document order, used by ToggleGroup, CheckboxGroup, Form.Root, Combobox's options and Tabs'
// transition direction. The component suites cover the call sites.
import { describe, expect, it } from "vitest";
import { compareDocumentOrder, sortByDocumentOrder } from "./dom-order.js";

function tree(): { root: HTMLElement; a: HTMLElement; b: HTMLElement; inner: HTMLElement } {
  const root = document.createElement("div");
  root.innerHTML = '<p id="a"><span id="inner"></span></p><p id="b"></p>';
  document.body.append(root);
  return {
    root,
    a: root.querySelector("#a")!,
    b: root.querySelector("#b")!,
    inner: root.querySelector("#inner")!,
  };
}

describe("compareDocumentOrder", () => {
  it("is negative when the first node comes first, positive when it comes later", () => {
    const { a, b } = tree();
    expect(compareDocumentOrder(a, b)).toBeLessThan(0);
    expect(compareDocumentOrder(b, a)).toBeGreaterThan(0);
  });

  it("is zero for the same node", () => {
    const { a } = tree();
    expect(compareDocumentOrder(a, a)).toBe(0);
  });

  it("puts an ancestor before its descendant", () => {
    const { a, inner, b } = tree();
    expect(compareDocumentOrder(a, inner)).toBeLessThan(0);
    expect(compareDocumentOrder(inner, a)).toBeGreaterThan(0);
    expect(compareDocumentOrder(inner, b)).toBeLessThan(0);
  });
});

describe("sortByDocumentOrder", () => {
  it("returns a sorted copy and leaves the input alone", () => {
    const { a, b, inner } = tree();
    const items = [{ el: b }, { el: inner }, { el: a }];
    const sorted = sortByDocumentOrder(items, (item) => item.el);
    expect(sorted.map((item) => item.el)).toEqual([a, inner, b]);
    expect(items.map((item) => item.el)).toEqual([b, inner, a]);
  });
});
