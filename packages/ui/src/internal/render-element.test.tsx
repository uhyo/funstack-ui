// The `disabled` branch helpers (conventions 1.2, #158): which renders take native `disabled` and
// which `aria-disabled`, and how the branch meets a pure trigger's pending `aria-disabled`. The
// parts' own tests cover the rendered behaviour; this table pins the rule in one place.
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it } from "vitest";
import { PlainButton } from "../__tests__/helpers.js";
import { disabledButton, pendingAriaDisabled } from "./render-element.js";
import type { RenderProp } from "./types.js";

type Render = RenderProp<ComponentPropsWithRef<"button">, object> | undefined;

const renders: readonly (readonly [string, Render])[] = [
  ["no render", undefined],
  ["the function form", (props) => <button {...props} />],
  ["a host <button>", <button key="b" />],
  ["a host <input>", <input key="i" type="submit" />],
  ["a component", <PlainButton key="c" />],
  ["a host <a>", <a key="a" href="#x" />],
  ["a host <div>", <div key="d" />],
];

const NATIVE = { disabled: true };
const ARIA = { disabled: undefined, "aria-disabled": true };

describe("disabledButton", () => {
  // [render, handlesClick true (the part's handler is the action), handlesClick false (browser)]
  const expected: Record<string, readonly [object, object]> = {
    "no render": [NATIVE, NATIVE],
    "the function form": [NATIVE, NATIVE],
    "a host <button>": [NATIVE, NATIVE],
    "a host <input>": [ARIA, NATIVE],
    "a component": [ARIA, NATIVE],
    "a host <a>": [ARIA, ARIA],
    "a host <div>": [ARIA, ARIA],
  };

  it.each(renders)("%s: the branch by who runs the click", (name, render) => {
    const [own, browser] = expected[name]!;
    expect(disabledButton(render, true).props).toEqual(own);
    expect(disabledButton(render, true, { handlesClick: false }).props).toEqual(browser);
  });

  it.each(renders)("%s: alwaysFocusable is aria-disabled in every case", (_, render) => {
    for (const handlesClick of [true, false]) {
      expect(disabledButton(render, true, { handlesClick, alwaysFocusable: true }).props).toEqual(
        ARIA,
      );
    }
  });

  it.each(renders)("%s: enabled owns nothing but an absent attribute", (_, render) => {
    for (const handlesClick of [true, false]) {
      const result = disabledButton(render, false, { handlesClick });
      expect(result.props.disabled).not.toBe(true);
      expect(result.props["aria-disabled"]).toBeUndefined();
      expect(result.invoker).toBe(true);
    }
  });

  it("invoker is false only in the aria branch while disabled", () => {
    expect(disabledButton(<PlainButton />, true).invoker).toBe(false);
    expect(disabledButton(<PlainButton />, true, { handlesClick: false }).invoker).toBe(true);
    expect(disabledButton(undefined, true).invoker).toBe(true);
  });
});

describe("pendingAriaDisabled", () => {
  it("native disabled wins over pending; the aria branch is true; else the pending rule", () => {
    expect(pendingAriaDisabled({ disabled: true }, true)).toBeUndefined();
    expect(pendingAriaDisabled({ disabled: true }, false)).toBeUndefined();
    expect(pendingAriaDisabled({ disabled: undefined, "aria-disabled": true }, false)).toBe(true);
    expect(pendingAriaDisabled({ disabled: undefined, "aria-disabled": true }, true)).toBe(true);
    expect(pendingAriaDisabled({ disabled: false }, true)).toBe(true);
    expect(pendingAriaDisabled({ disabled: false }, false)).toBeUndefined();
    expect(pendingAriaDisabled({ disabled: undefined, "aria-disabled": undefined }, true)).toBe(
      true,
    );
  });
});
