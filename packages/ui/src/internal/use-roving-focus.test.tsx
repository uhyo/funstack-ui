// The roving-focus engine (design/components/toggle-group.md 6.2 and 6.3, test row 24).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { isTextEntryItem, itemsOf, useRovingFocus } from "./use-roving-focus.js";
import type { RovingFocusOptions } from "./use-roving-focus.js";

function Container({
  children,
  options,
}: {
  children: ReactNode;
  options?: Partial<RovingFocusOptions>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const handlers = useRovingFocus(ref, {
    orientation: "horizontal",
    loop: true,
    native: false,
    entry: (items) => items[0],
    memory: true,
    ...options,
  });
  return (
    <div ref={ref} data-testid="root" {...handlers}>
      {children}
    </div>
  );
}

const names = (els: readonly Element[]) =>
  els.map((el) => el.textContent || el.getAttribute("aria-label"));

describe("itemsOf", () => {
  it("finds the focusable descendants and applies the exclusions", () => {
    render(
      <div data-testid="root">
        <button type="button">button</button>
        <a href="#x">link</a>
        <a>no href</a>
        <input aria-label="input" />
        <input type="hidden" aria-label="hidden input" />
        <select aria-label="select" />
        <textarea aria-label="textarea" />
        <div contentEditable suppressContentEditableWarning>
          editable
        </div>
        <div contentEditable={false}>not editable</div>
        <span tabIndex={0}>span</span>
        <span tabIndex={-1}>opted out</span>
        <button type="button" disabled>
          disabled
        </button>
        <button type="button" aria-disabled="true">
          aria-disabled
        </button>
        <div inert>
          <button type="button">inert</button>
        </div>
        <div hidden>
          <button type="button">hidden</button>
        </div>
        <div role="toolbar">
          <button type="button">nested toolbar</button>
        </div>
        <div popover="auto">
          <button type="button">popover</button>
        </div>
        <dialog>
          <button type="button">dialog</button>
        </dialog>
        <fieldset disabled>
          <button type="button">fieldset</button>
        </fieldset>
      </div>,
    );
    const root = screen.getByTestId("root");
    expect(names(itemsOf(root, new WeakSet()))).toEqual([
      "button",
      "link",
      "input",
      "select",
      "textarea",
      "editable",
      "span",
      "aria-disabled",
    ]);
  });

  it("an engine-written tabindex=-1 does not opt an element out", () => {
    render(
      <div data-testid="root">
        <button type="button" tabIndex={-1}>
          mine
        </button>
      </div>,
    );
    const root = screen.getByTestId("root");
    expect(itemsOf(root, new WeakSet())).toEqual([]);
    const managed = new WeakSet<Element>([screen.getByText("mine")]);
    expect(names(itemsOf(root, managed))).toEqual(["mine"]);
  });
});

describe("isTextEntryItem", () => {
  it.each([
    ["<input>", true],
    ['<input type="number">', true],
    ['<input type="range">', true],
    ['<input type="checkbox">', false],
    ['<input type="button">', false],
    ['<input type="submit">', false],
    ["<textarea></textarea>", true],
    ["<select></select>", true],
    ["<div contenteditable></div>", true],
    ['<div contenteditable="false"></div>', false],
    ['<div role="spinbutton"></div>', true],
    ['<div role="combobox"></div>', true],
    ['<div role="slider"></div>', true],
    ['<div role="textbox"></div>', true],
    ["<button></button>", false],
    ["<a href='#'></a>", false],
  ])("%s → %s", (html, expected) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(isTextEntryItem(host.firstElementChild!)).toBe(expected);
  });
});

describe("useRovingFocus", () => {
  const stops = () =>
    [...screen.getByTestId("root").querySelectorAll('[tabindex="0"]')].map((el) => el.textContent);

  it("memory: the last focused item stays the stop", () => {
    render(
      <Container>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(stops()).toEqual(["a"]);
    expect(screen.getByText("b")).toHaveAttribute("tabindex", "-1");
    act(() => screen.getByText("b").focus());
    expect(stops()).toEqual(["b"]);
    act(() => screen.getByText("b").blur());
    expect(stops()).toEqual(["b"]);
  });

  it("no memory: entry while focus is outside, the focused item while inside", () => {
    render(
      <Container options={{ memory: false, entry: (items) => items[1] }}>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(stops()).toEqual(["b"]);
    act(() => screen.getByText("a").focus());
    expect(stops()).toEqual(["a"]);
    act(() => screen.getByText("a").blur());
    expect(stops()).toEqual(["b"]);
  });

  it("re-applies on observer records (a disabled current stop moves to entry)", async () => {
    function Child() {
      const [disabled, setDisabled] = useState(false);
      return (
        <button type="button" disabled={disabled} onClick={() => setDisabled(true)}>
          a
        </button>
      );
    }
    render(
      <Container>
        <Child />
        <button type="button">b</button>
      </Container>,
    );
    expect(stops()).toEqual(["a"]);
    // A child-only re-render: the container does not commit, the observer re-applies.
    await act(async () => {
      fireEvent.click(screen.getByText("a"));
    });
    expect(stops()).toEqual(["b"]);
  });

  it("native: writes nothing and handles no key", () => {
    render(
      <Container options={{ native: true }}>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(screen.getByText("a")).not.toHaveAttribute("tabindex");
    expect(screen.getByText("b")).not.toHaveAttribute("tabindex");
    act(() => screen.getByText("a").focus());
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      screen.getByText("a").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByText("a")).toHaveFocus();
  });

  it("switching to native gives back the tabindex it wrote", () => {
    const { rerender } = render(
      <Container>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(screen.getByText("b")).toHaveAttribute("tabindex", "-1");
    rerender(
      <Container options={{ native: true }}>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(screen.getByText("a")).not.toHaveAttribute("tabindex");
    expect(screen.getByText("b")).not.toHaveAttribute("tabindex");
  });

  it("switching to native restores a tabindex the consumer rendered (review finding 2)", () => {
    // The hydration render runs the JS path (server snapshot), then the native path takes over.
    // React will not re-write `tabIndex={0}`, so the engine must put the original value back.
    const items = (
      <>
        <button type="button">a</button>
        <div role="spinbutton" aria-label="spin" tabIndex={0}>
          spin
        </div>
      </>
    );
    const { rerender } = render(<Container>{items}</Container>);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("tabindex", "-1");
    rerender(<Container options={{ native: true }}>{items}</Container>);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("a")).not.toHaveAttribute("tabindex");
  });

  it("an element moved out of the container gets its own tabindex back", async () => {
    render(
      <>
        <Container>
          <button type="button">a</button>
          <div role="spinbutton" aria-label="spin" tabIndex={0}>
            spin
          </div>
        </Container>
        <div data-testid="outside" />
      </>,
    );
    const spin = screen.getByRole("spinbutton");
    expect(spin).toHaveAttribute("tabindex", "-1");
    // A DOM move the container does not render (a portal library, a drag-and-drop list).
    await act(async () => {
      screen.getByTestId("outside").appendChild(spin);
    });
    expect(spin).toHaveAttribute("tabindex", "0");
  });

  it("enabled: false writes nothing", () => {
    render(
      <Container options={{ enabled: false }}>
        <button type="button">a</button>
        <button type="button">b</button>
      </Container>,
    );
    expect(screen.getByText("b")).not.toHaveAttribute("tabindex");
  });
});
