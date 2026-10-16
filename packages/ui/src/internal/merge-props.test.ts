import { describe, expect, it, vi } from "vitest";
import { mergeProps, mergeRefs, mergeTokenLists } from "./merge-props.js";

describe("mergeTokenLists", () => {
  it("joins tokens in order without duplicates and ignores non-strings", () => {
    expect(mergeTokenLists("a b", "b c")).toBe("a b c");
    expect(mergeTokenLists(undefined, " x  y ")).toBe("x y");
    expect(mergeTokenLists("x", undefined)).toBe("x");
    expect(mergeTokenLists(undefined, undefined)).toBe("");
  });
});

describe("mergeProps", () => {
  it("lets the render element win over pass-through props, and the library over the element", () => {
    const result = mergeProps(
      { "aria-label": "part", "data-kind": "part", type: "button", title: "part", id: "part" },
      { "aria-label": "element", "data-kind": "element", type: "submit", title: "element" },
      { "aria-pressed": true, "data-pressed": "", id: "library" },
    );
    expect(result).toEqual({
      "aria-label": "element",
      "data-kind": "element",
      type: "submit",
      title: "element",
      id: "library",
      "aria-pressed": true,
      "data-pressed": "",
    });
  });

  it("keeps a library-controlled attribute even when the element sets it", () => {
    const result = mergeProps(
      {},
      { role: "switch", "aria-pressed": "false", "data-pending": "no" },
      { role: "button", "aria-pressed": true, "data-pending": undefined },
    );
    // An undefined library value does not win: `data-pending` is absent, not "no".
    expect(result).toEqual({ role: "button", "aria-pressed": true, "data-pending": "no" });
  });

  it("merges ARIA id-reference lists as token lists, element tokens first", () => {
    const result = mergeProps(
      { "aria-describedby": "part-desc", "aria-labelledby": "part-label" },
      { "aria-describedby": "el-desc", "aria-labelledby": "el-label", "aria-owns": "el-owned" },
      {
        "aria-describedby": "tip",
        "aria-controls": "panel",
        "aria-owns": "lib-owned el-owned",
      },
    );
    expect(result).toEqual({
      "aria-describedby": "el-desc part-desc tip",
      "aria-labelledby": "el-label part-label",
      "aria-owns": "el-owned lib-owned",
      "aria-controls": "panel",
    });
  });

  it("concatenates className and merges style with the element winning", () => {
    const result = mergeProps(
      { className: "chip", style: { color: "blue", opacity: 0.5 } },
      { className: "x", style: { color: "red" } },
    );
    expect(result).toEqual({ className: "chip x", style: { color: "red", opacity: 0.5 } });

    expect(mergeProps({ className: "" }, { className: "x" })).toEqual({ className: "x" });
    expect(mergeProps({ className: "chip" }, { className: undefined })).toEqual({
      className: "chip",
    });
  });

  it("runs event handlers element first, then pass-through, then library", () => {
    const order: string[] = [];
    const result = mergeProps(
      { onClick: () => order.push("part") },
      { onClick: () => order.push("element") },
      { onClick: () => order.push("library") },
    );
    (result.onClick as () => void)();
    expect(order).toEqual(["element", "part", "library"]);
  });

  it("passes through a lone handler untouched and forwards arguments", () => {
    const element = vi.fn();
    const result = mergeProps<Record<string, unknown>>({}, { onPointerDown: element });
    expect(result["onPointerDown"]).toBe(element);
    (result["onPointerDown"] as (e: string) => void)("evt");
    expect(element).toHaveBeenCalledWith("evt");
  });

  it("ignores undefined element values", () => {
    const result = mergeProps(
      { "aria-label": "part", title: "part" },
      { "aria-label": undefined, title: undefined, id: undefined },
    );
    expect(result).toEqual({ "aria-label": "part", title: "part" });
  });

  it("attaches every ref", () => {
    const a = { current: null as unknown };
    const b = vi.fn();
    const c = { current: null as unknown };
    const result = mergeProps<Record<string, unknown>>({ ref: a }, { ref: b }, { ref: c });
    const node = {};
    const cleanup = (result["ref"] as (n: unknown) => () => void)(node);
    expect(a.current).toBe(node);
    expect(b).toHaveBeenCalledWith(node);
    expect(c.current).toBe(node);
    cleanup();
    expect(a.current).toBeNull();
    expect(b).toHaveBeenLastCalledWith(null);
    expect(c.current).toBeNull();
  });
});

describe("mergeRefs", () => {
  it("uses a callback ref's own cleanup when it returns one", () => {
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);
    const merged = mergeRefs<unknown>(ref, undefined, null);
    const detach = merged({}) as () => void;
    expect(ref).toHaveBeenCalledTimes(1);
    detach();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledTimes(1);
  });
});
