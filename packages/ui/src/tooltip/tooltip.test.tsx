// Tooltip tests, mapped to design/components/tooltip.md section 13 and conventions 10.1.
//
// N/A rows (conventions 10.1): Tooltip's open state is browser-owned (the popover's top-layer
// state) and Tooltip has no action props, so these rows cannot apply:
// - Sync action, Async action with `data-pending`, Rejection, Overlap, Superseded rejection,
//   Post-await rule: no action is ever dispatched; nothing is pending. A type-level test below
//   proves `open`, `defaultOpen` and `openChangeAction` are not accepted.
// - Optimistic + rollback: no optimistic state; the DOM is the only source of open state.
// - Controlled/uncontrolled parity: no controllable state.
// Overlapping *interactions* (hover then focus, trigger to popup) are covered under "Hover".
//
// jsdom has no Popover API: `src/__tests__/popover-shim.ts` (loaded from vitest.setup.ts) adds
// `showPopover` / `hidePopover` / `togglePopover` and `:popover-open`. Like browsers, it fires
// `beforetoggle` synchronously and queues `toggle` as a task (a 0 ms timer, flushed by `advance`),
// and throws on a disconnected element. These tests assert on calls and on the shim's open state,
// not on visibility.
//
// Moved to tooltip.browser.test.tsx (real Chromium): actual visibility and `:popover-open`,
// anchor placement next to the trigger, the native `interestfor` path, Escape inside a modal
// `<dialog>` and a `popover="auto"` menu, `hint` stacking over an `auto` menu, and the `@starting-style`
// entry transition that `data-instant` suppresses on a warm open (counted `transitionrun`). Not
// covered anywhere automated: the exit animation and Safari's `hint` -> `manual` degradation.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Suspense, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { MockInstance } from "vitest";
import { createSuspender, silenceErrors } from "../__tests__/helpers.js";
import { stubComputedPlacement } from "../__tests__/placement-stub.js";
import { isPopoverOpen } from "../__tests__/popover-shim.js";
import { CSPProvider } from "../csp/index.js";
import { TOOLTIP_WARM_RULES } from "../internal/tooltip-warm.js";
import { Menu } from "../menu/index.js";
import { Tabs } from "../tabs/index.js";
import { ToggleGroup } from "../toggle-group/index.js";
import { Toolbar } from "../toolbar/index.js";
import { Tooltip } from "./index.js";
import type {
  TooltipArrowState,
  TooltipPopupProps,
  TooltipPopupState,
  TooltipRootProps,
  TooltipRootState,
  TooltipTriggerProps,
  TooltipTriggerState,
} from "./index.js";

interface HarnessProps {
  root?: Omit<TooltipRootProps, "children">;
  trigger?: TooltipTriggerProps;
  popup?: TooltipPopupProps;
}

function Harness({ root, trigger, popup }: HarnessProps) {
  return (
    <>
      <button type="button">Before</button>
      <Tooltip.Root {...root}>
        <Tooltip.Trigger {...trigger}>{trigger?.children ?? "Save"}</Tooltip.Trigger>
        <Tooltip.Popup data-testid="popup" {...popup}>
          {popup?.children ?? "Saves the document"}
        </Tooltip.Popup>
      </Tooltip.Root>
      <button type="button">After</button>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Save" });
const popup = () => screen.getByTestId("popup");

let showSpy: MockInstance<HTMLElement["showPopover"]>;
let hideSpy: MockInstance<HTMLElement["hidePopover"]>;

/**
 * jsdom's `:focus-visible` (via @asamuzakjp/dom-selector) keeps heuristic state across tests, so
 * after a few tests a Tab-focused element stops matching. The shim below models the browser rule
 * the Tooltip relies on instead: focus is visible when the last input was a key press, not a
 * pointer press.
 */
let lastInputWasKeyboard = false;
const onKeyInput = () => {
  lastInputWasKeyboard = true;
};
const onPointerInput = () => {
  lastInputWasKeyboard = false;
};

beforeEach(() => {
  showSpy = vi.spyOn(HTMLElement.prototype, "showPopover");
  hideSpy = vi.spyOn(HTMLElement.prototype, "hidePopover");
  lastInputWasKeyboard = false;
  document.addEventListener("keydown", onKeyInput, true);
  document.addEventListener("pointerdown", onPointerInput, true);
  document.addEventListener("mousedown", onPointerInput, true);
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    if (selector === ":focus-visible") {
      return this === this.ownerDocument.activeElement && lastInputWasKeyboard;
    }
    return matches.call(this, selector);
  });
});

afterEach(() => {
  document.removeEventListener("keydown", onKeyInput, true);
  document.removeEventListener("pointerdown", onPointerInput, true);
  document.removeEventListener("mousedown", onPointerInput, true);
  vi.useRealTimers();
  delete (globalThis as { jest?: unknown }).jest;
});

/**
 * Fake timers plus a `user-event` instance that advances them. Testing Library's async wrapper
 * waits on a `setTimeout(0)` and only advances it when it sees Jest's fake timers, so a minimal
 * `jest` global pointing at vitest's clock is installed for the test (removed in `afterEach`).
 */
function setupTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  (globalThis as { jest?: unknown }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  };
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

/** Renders inside an awaited `act` so React can attach its ping to a suspending child. */
async function renderAsync(ui: ReactNode): Promise<void> {
  await act(async () => {
    render(ui);
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function escape(target: Element = document.activeElement ?? document.body): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function pointer(
  type: "pointerenter" | "pointerleave" | "pointerdown",
  el: Element,
  pointerType = "mouse",
) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: type === "pointerdown" }));
  });
}

describe("Roles and ARIA", () => {
  it("renders a button that is described by a manual popover with role tooltip", () => {
    render(<Harness />);
    const button = trigger();
    const tip = popup();

    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(tip.tagName).toBe("DIV");
    expect(tip).toHaveAttribute("popover", "manual");
    expect(tip).toHaveAttribute("role", "tooltip");
    expect(tip.id).not.toBe("");
    expect(button).toHaveAttribute("aria-describedby", tip.id);
    expect(button).not.toHaveAttribute("aria-labelledby");
    expect(button).toHaveAccessibleDescription("Saves the document");
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).not.toHaveAttribute("interestfor");
    expect(button).not.toHaveAttribute("data-disabled");
    expect(tip).not.toHaveAttribute("data-open");
    expect(tip).not.toHaveAttribute("data-disabled");
    expect(tip).toHaveAttribute("data-side", "top");
    expect(tip).toHaveAttribute("data-align", "center");
  });

  it('provides="name" labels the trigger with the popup and does not describe it', () => {
    render(
      <Tooltip.Root provides="name">
        <Tooltip.Trigger>
          <svg aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Popup data-testid="popup">Bold</Tooltip.Popup>
      </Tooltip.Root>,
    );
    const button = screen.getByRole("button", { name: "Bold" });
    expect(button).toHaveAttribute("aria-labelledby", popup().id);
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("merges the consumer's aria-describedby with the popup id as a token list", () => {
    render(<Harness trigger={{ "aria-describedby": "x" }} />);
    expect(trigger()).toHaveAttribute("aria-describedby", `x ${popup().id}`);
  });

  it("merges a render element's and the part's aria-describedby tokens, element first", () => {
    render(
      <Harness
        trigger={{ "aria-describedby": "part", render: <button aria-describedby="element" /> }}
      />,
    );
    expect(trigger()).toHaveAttribute("aria-describedby", `element part ${popup().id}`);
  });

  it('merges the consumer\'s aria-labelledby with provides="name"', () => {
    render(<Harness root={{ provides: "name" }} trigger={{ "aria-labelledby": "lbl" }} />);
    const button = screen.getAllByRole("button")[1]!;
    expect(button).toHaveAttribute("aria-labelledby", `lbl ${popup().id}`);
  });

  it("does not own the relation it does not provide: the other one passes through", () => {
    render(<Harness trigger={{ "aria-labelledby": "own-label" }} />);
    const button = screen.getAllByRole("button")[1]!;
    expect(button).toHaveAttribute("aria-labelledby", "own-label");
    expect(button).toHaveAttribute("aria-describedby", popup().id);
  });

  it("gives each tooltip its own id", () => {
    render(
      <>
        <Harness />
        <Harness />
      </>,
    );
    const ids = screen.getAllByTestId("popup").map((el) => el.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("lets the consumer override type", () => {
    render(<Harness trigger={{ type: "submit" }} />);
    expect(trigger()).toHaveAttribute("type", "submit");
  });

  it('experimental_hint renders popover="hint"', () => {
    render(<Harness popup={{ experimental_hint: true }} />);
    expect(popup()).toHaveAttribute("popover", "hint");
    expect(popup()).toHaveAttribute("role", "tooltip");
  });

  it("experimental_interestFor renders interestfor and the interest-delay styles", () => {
    render(<Harness trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).toHaveAttribute("interestfor", popup().id);
    // Zero while another tooltip is showing (skip-delay, design 6).
    expect(trigger().style.getPropertyValue("interest-delay-start")).toBe(
      "calc(250ms * (1 - var(--fsui-tooltip-warm, 0)))",
    );
    expect(trigger().style.getPropertyValue("interest-delay-end")).toBe("150ms");
  });

  it("writes delay and closeDelay into the interest-delay styles", () => {
    render(
      <Harness root={{ delay: 400, closeDelay: 0 }} trigger={{ experimental_interestFor: true }} />,
    );
    expect(trigger().style.getPropertyValue("interest-delay-start")).toBe(
      "calc(400ms * (1 - var(--fsui-tooltip-warm, 0)))",
    );
    expect(trigger().style.getPropertyValue("interest-delay-end")).toBe("0ms");
  });

  it("the consumer's style wins over the interest-delay styles", () => {
    render(
      <Harness
        trigger={{
          experimental_interestFor: true,
          style: { interestDelayStart: "1s", color: "red" },
        }}
      />,
    );
    expect(trigger().style.getPropertyValue("interest-delay-start")).toBe("1s");
    expect(trigger().style.getPropertyValue("interest-delay-end")).toBe("150ms");
    expect(trigger().style.color).toBe("red");
  });

  it("without the flag, renders no interestfor and no interest-delay styles", () => {
    render(<Harness trigger={{ style: { color: "red" } }} />);
    expect(trigger()).not.toHaveAttribute("interestfor");
    expect(trigger().getAttribute("style")).toBe("color: red;");
  });

  it("without the flag, a render element's interestfor is not owned and passes through", () => {
    render(<Harness trigger={{ render: <button interestfor="elsewhere" /> }} />);
    expect(trigger()).toHaveAttribute("interestfor", "elsewhere");
  });

  it("server-renders the lowercase interestfor attribute and hyphenated delay styles", () => {
    const html = renderToString(
      <Tooltip.Root delay={300}>
        <Tooltip.Trigger experimental_interestFor>Save</Tooltip.Trigger>
        <Tooltip.Popup experimental_hint>Saves</Tooltip.Popup>
      </Tooltip.Root>,
    );
    const id = / id="([^"]+)" popover="hint" role="tooltip"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`interestfor="${id}"`);
    expect(html).toContain(`aria-describedby="${id}"`);
    expect(html).toContain(
      "interest-delay-start:calc(300ms * (1 - var(--fsui-tooltip-warm, 0)));interest-delay-end:150ms",
    );
    // The skip-delay rule is server-rendered too (React hoists it; `renderToString` has no
    // <head>, so it precedes the button here).
    expect(html).toContain('data-href="@funstack/ui/tooltip-warm"');
    expect(html).toContain("data-fsui-tooltip-trigger");
    expect(html).toMatch(/popover="hint"/);
    expect(html).toContain("position-area:top");
    expect(html).not.toContain("interestFor");
  });

  it("disabled renders data-disabled on Trigger and Popup and keeps the ARIA relation", () => {
    render(<Harness root={{ disabled: true }} trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).toHaveAttribute("data-disabled", "");
    expect(popup()).toHaveAttribute("data-disabled", "");
    expect(trigger()).toHaveAttribute("aria-describedby", popup().id);
    expect(trigger()).not.toHaveAttribute("interestfor");
    expect(trigger().style.getPropertyValue("interest-delay-start")).toBe("");
  });

  it("owns interestfor while flagged: a disabled tooltip removes a render element's value", () => {
    render(
      <Harness
        root={{ disabled: true }}
        trigger={{ experimental_interestFor: true, render: <button interestfor="other" /> }}
      />,
    );
    expect(trigger()).not.toHaveAttribute("interestfor");
  });

  it("owns id, popover, role and the data state on the Popup", () => {
    render(
      <Harness
        popup={{
          render: (
            <div
              {...({ id: "mine", popover: "auto", role: "note" } as ComponentPropsWithRef<"div">)}
              data-side="left"
              data-disabled=""
            />
          ),
        }}
      />,
    );
    expect(popup().id).not.toBe("mine");
    expect(popup()).toHaveAttribute("popover", "manual");
    expect(popup()).toHaveAttribute("role", "tooltip");
    expect(popup()).toHaveAttribute("data-side", "top");
    expect(popup()).not.toHaveAttribute("data-disabled");
  });

  it("throws a clear error when a part is rendered outside Tooltip.Root", () => {
    silenceErrors();
    expect(() => render(<Tooltip.Trigger>Save</Tooltip.Trigger>)).toThrow(
      "Tooltip.Trigger must be rendered inside a Tooltip.Root.",
    );
    expect(() => render(<Tooltip.Popup>Tip</Tooltip.Popup>)).toThrow(
      "Tooltip.Popup must be rendered inside a Tooltip.Root.",
    );
  });

  it("does not accept open state or action props (type level)", () => {
    const props: TooltipRootProps = {
      // @ts-expect-error open state is browser-owned (design section 4.1)
      open: true,
    };
    const props2: TooltipRootProps = {
      // @ts-expect-error no defaultOpen
      defaultOpen: true,
    };
    const props3: TooltipRootProps = {
      // @ts-expect-error no action props at all
      openChangeAction: () => {},
    };
    const popupProps: TooltipPopupProps = {
      // @ts-expect-error the popover type is library-controlled
      popover: "auto",
    };
    // @ts-expect-error Root renders no DOM and takes no ref
    const rootRef: TooltipRootProps = { ref: null };
    expect([props, props2, props3, popupProps, rootRef]).toHaveLength(5);
  });
});

describe("Keyboard", () => {
  it("opens after delay when the trigger gets keyboard focus, anchored to the trigger", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.tab();
    await user.tab();
    expect(trigger()).toHaveFocus();

    advance(249);
    expect(showSpy).not.toHaveBeenCalled();
    advance(1);
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy.mock.contexts[0]).toBe(popup());
    expect(showSpy).toHaveBeenCalledWith({ source: trigger() });
    expect(isPopoverOpen(popup())).toBe(true);
  });

  it("Escape closes the open tooltip and focus stays on the trigger", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.tab();
    await user.tab();
    advance(250);
    expect(isPopoverOpen(popup())).toBe(true);

    await user.keyboard("{Escape}");
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);
    expect(trigger()).toHaveFocus();
  });

  it("Tab away closes after closeDelay", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.tab();
    await user.tab();
    advance(250);

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    advance(149);
    expect(hideSpy).not.toHaveBeenCalled();
    advance(1);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("Escape when closed calls nothing", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.keyboard("{Escape}");
    expect(hideSpy).not.toHaveBeenCalled();
  });

  it("Escape that closes the tooltip is preventDefault()ed, so an enclosing dialog stays open", () => {
    setupTimers();
    render(<Harness />);
    pointer("pointerenter", trigger());
    advance(250);
    expect(isPopoverOpen(popup())).toBe(true);

    const first = escape(trigger());
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);

    // Closed now: the next Escape passes through untouched (it reaches the dialog).
    advance(0);
    const second = escape(trigger());
    expect(second.defaultPrevented).toBe(false);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("Escape while closed is never preventDefault()ed, even before the toggle task runs", () => {
    setupTimers();
    render(<Harness />);
    expect(escape().defaultPrevented).toBe(false);

    pointer("pointerenter", trigger());
    advance(250);
    act(() => popup().hidePopover());
    // The `toggle` task is still queued, so the document listener is still attached.
    expect(escape().defaultPrevented).toBe(false);
  });

  it("Escape before the delay elapses cancels the pending open", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.tab();
    await user.tab();
    advance(100);
    await user.keyboard("{Escape}");
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("pointer focus (a click) does not open the tooltip", async () => {
    const user = setupTimers();
    render(<Harness />);
    // Focus by a pointer press (keyboard used before, so the modality really changes).
    await user.keyboard("a");
    await user.click(trigger());
    expect(trigger()).toHaveFocus();
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe("Hover", () => {
  it("opens after delay on hover", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(249);
    expect(showSpy).not.toHaveBeenCalled();
    advance(1);
    expect(showSpy).toHaveBeenCalledWith({ source: trigger() });
  });

  it("never opens when the pointer leaves before the delay", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(200);
    await user.unhover(trigger());
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("closes closeDelay after the pointer leaves the trigger", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(250);
    await user.unhover(trigger());
    advance(149);
    expect(hideSpy).not.toHaveBeenCalled();
    advance(1);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("stays open while the pointer moves from the trigger into the popup", () => {
    setupTimers();
    render(<Harness />);
    pointer("pointerenter", trigger());
    advance(250);
    pointer("pointerleave", trigger());
    advance(100);
    pointer("pointerenter", popup());
    advance(1000);
    expect(hideSpy).not.toHaveBeenCalled();
    expect(isPopoverOpen(popup())).toBe(true);

    pointer("pointerleave", popup());
    advance(150);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("re-entering the trigger during closeDelay cancels the close", () => {
    setupTimers();
    render(<Harness />);
    pointer("pointerenter", trigger());
    advance(250);
    pointer("pointerleave", trigger());
    advance(100);
    pointer("pointerenter", trigger());
    advance(1000);
    expect(hideSpy).not.toHaveBeenCalled();
    // Already open: the open timer does not call showPopover again.
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores touch pointers", () => {
    setupTimers();
    render(<Harness />);
    pointer("pointerenter", trigger(), "touch");
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("any pointerdown closes immediately: outside, on the popup, on the trigger", async () => {
    const user = setupTimers();
    render(<Harness />);

    await user.hover(trigger());
    advance(250);
    pointer("pointerdown", document.body);
    expect(hideSpy).toHaveBeenCalledTimes(1);

    await user.unhover(trigger());
    await user.hover(trigger());
    advance(250);
    pointer("pointerdown", popup());
    expect(hideSpy).toHaveBeenCalledTimes(2);

    await user.unhover(trigger());
    await user.hover(trigger());
    advance(250);
    await user.click(trigger());
    expect(hideSpy).toHaveBeenCalledTimes(3);
    // Still hovering after the click: nothing reopens it until the pointer leaves and re-enters.
    advance(1000);
    expect(showSpy).toHaveBeenCalledTimes(3);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("a click before the delay elapses cancels the pending open", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(100);
    await user.click(trigger());
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("delay={0} opens on the next tick", () => {
    setupTimers();
    render(<Harness root={{ delay: 0 }} />);
    pointer("pointerenter", trigger());
    expect(showSpy).not.toHaveBeenCalled();
    advance(0);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("follows closes it did not perform (native light dismiss) through the toggle event", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(250);
    const removeSpy = vi.spyOn(document, "removeEventListener");
    // The browser closes a `hint` popover itself on light dismiss.
    act(() => popup().hidePopover());
    expect(hideSpy).toHaveBeenCalledTimes(1);
    // `toggle` is a queued task: the document listeners go when it runs.
    expect(removeSpy).not.toHaveBeenCalled();
    advance(0);
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    // Escape and pointerdown call nothing more.
    await user.keyboard("{Escape}");
    pointer("pointerdown", document.body);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("listens for dismissal right after showPopover, before the toggle task runs", () => {
    setupTimers();
    render(<Harness />);
    pointer("pointerenter", trigger());
    advance(249);
    // Runs only the open timer; the shim's `toggle` task stays queued.
    act(() => {
      vi.advanceTimersToNextTimer();
    });
    expect(showSpy).toHaveBeenCalledTimes(1);
    pointer("pointerdown", document.body);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);

    pointer("pointerleave", trigger());
    pointer("pointerenter", trigger());
    advance(249);
    act(() => {
      vi.advanceTimersToNextTimer();
    });
    expect(showSpy).toHaveBeenCalledTimes(2);
    expect(escape().defaultPrevented).toBe(true);
    expect(hideSpy).toHaveBeenCalledTimes(2);
  });

  it("reads the latest delay without re-subscribing", () => {
    setupTimers();
    const { rerender } = render(<Harness root={{ delay: 100 }} />);
    rerender(<Harness root={{ delay: 500 }} />);
    pointer("pointerenter", trigger());
    advance(499);
    expect(showSpy).not.toHaveBeenCalled();
    advance(1);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("lets the consumer's own pointer and focus handlers run (nothing is omitted)", async () => {
    const user = setupTimers();
    const onPointerEnter = vi.fn();
    const onFocus = vi.fn();
    render(<Harness trigger={{ onPointerEnter, onFocus }} />);
    await user.hover(trigger());
    await user.tab();
    expect(onPointerEnter).toHaveBeenCalled();
    advance(250);
    expect(showSpy).toHaveBeenCalledTimes(1);
    act(() => trigger().focus());
    expect(onFocus).toHaveBeenCalled();
  });

  it("unmounting while open neither throws nor leaves listeners behind", async () => {
    const user = setupTimers();
    const { unmount } = render(<Harness />);
    await user.hover(trigger());
    advance(250);
    const removeSpy = vi.spyOn(document, "removeEventListener");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    advance(1000);
    expect(() => {
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }).not.toThrow();
    expect(hideSpy).not.toHaveBeenCalled();
  });
});

describe("Skip-delay (wave 11, #21)", () => {
  // Design section 6: while any `[role="tooltip"]:popover-open` exists in the document, a hover or
  // keyboard focus opens the next tooltip at once and hides the showing one. Global, stateless.
  function Pair({ flag = false }: { flag?: boolean }) {
    return (
      <>
        <Tooltip.Root>
          <Tooltip.Trigger experimental_interestFor={flag}>Bold</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip-a">Bold text</Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger experimental_interestFor={flag}>Italic</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip-b">Italic text</Tooltip.Popup>
        </Tooltip.Root>
      </>
    );
  }
  const triggerA = () => screen.getByRole("button", { name: "Bold" });
  const triggerB = () => screen.getByRole("button", { name: "Italic" });
  const tipA = () => screen.getByTestId("tip-a");
  const tipB = () => screen.getByTestId("tip-b");
  const enter = (element: Element) => {
    act(() => {
      fireEvent.pointerEnter(element, { pointerType: "mouse" });
    });
  };
  const leave = (element: Element) => {
    act(() => {
      fireEvent.pointerLeave(element, { pointerType: "mouse" });
    });
  };
  /** Opens A by hover and lets its `toggle` task run, then forgets the calls. */
  const openA = () => {
    enter(triggerA());
    advance(250);
    expect(isPopoverOpen(tipA())).toBe(true);
    showSpy.mockClear();
    hideSpy.mockClear();
  };

  it("hovering B while A is open shows B synchronously and hides A", () => {
    setupTimers();
    render(<Pair />);
    openA();
    leave(triggerA());
    enter(triggerB());
    // No timer advanced.
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy.mock.contexts[0]).toBe(tipB());
    expect(showSpy).toHaveBeenCalledWith({ source: triggerB() });
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(hideSpy.mock.contexts[0]).toBe(tipA());
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(isPopoverOpen(tipA())).toBe(false);
    // A's pending close timer finds A closed: nothing more.
    advance(1000);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(tipB())).toBe(true);
  });

  it("keyboard focus on B while A is open shows B at once", () => {
    setupTimers();
    render(<Pair />);
    openA();
    act(() => {
      fireEvent.keyDown(document.body, { key: "Tab" });
      triggerB().focus();
    });
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy.mock.contexts[0]).toBe(tipB());
    expect(hideSpy.mock.contexts[0]).toBe(tipA());
    expect(isPopoverOpen(tipA())).toBe(false);
  });

  it("with nothing open, B waits its delay", () => {
    setupTimers();
    render(<Pair />);
    enter(triggerB());
    expect(showSpy).not.toHaveBeenCalled();
    advance(249);
    expect(showSpy).not.toHaveBeenCalled();
    advance(1);
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(hideSpy).not.toHaveBeenCalled();
  });

  it("after A closed, B waits its delay again (no cooldown)", () => {
    setupTimers();
    render(<Pair />);
    openA();
    leave(triggerA());
    advance(150);
    expect(isPopoverOpen(tipA())).toBe(false);
    showSpy.mockClear();
    enter(triggerB());
    expect(showSpy).not.toHaveBeenCalled();
    advance(250);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("a tooltip popover that is not FUNSTACK's counts", () => {
    setupTimers();
    render(
      <>
        <div role="tooltip" popover="manual" data-testid="foreign">
          Elsewhere
        </div>
        <Pair />
      </>,
    );
    const foreign = screen.getByTestId("foreign");
    act(() => foreign.showPopover());
    enter(triggerB());
    expect(showSpy.mock.contexts.at(-1)).toBe(tipB());
    expect(isPopoverOpen(foreign)).toBe(false);
    expect(isPopoverOpen(tipB())).toBe(true);
  });

  it("an open popover that is not a tooltip does not count", () => {
    setupTimers();
    render(
      <>
        <div popover="manual" data-testid="other">
          Panel
        </div>
        <Pair />
      </>,
    );
    act(() => screen.getByTestId("other").showPopover());
    showSpy.mockClear();
    enter(triggerB());
    expect(showSpy).not.toHaveBeenCalled();
    expect(isPopoverOpen(screen.getByTestId("other"))).toBe(true);
  });

  it("re-entering A's own trigger while A is open calls nothing", () => {
    setupTimers();
    render(<Pair />);
    openA();
    leave(triggerA());
    enter(triggerA());
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
    expect(hideSpy).not.toHaveBeenCalled();
    expect(isPopoverOpen(tipA())).toBe(true);
  });

  it("touch never opens, warm or not", () => {
    setupTimers();
    render(<Pair />);
    openA();
    act(() => {
      fireEvent.pointerEnter(triggerB(), { pointerType: "touch" });
    });
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  describe("native markup (experimental_interestFor)", () => {
    // React records a hoisted style per document and never removes it, so each row renders into
    // a document of its own to count the <style> it inserts.
    function renderFresh(ui: ReactNode) {
      const doc = document.implementation.createHTMLDocument("");
      const container = doc.createElement("div");
      doc.body.append(container);
      const result = render(ui, { container });
      const styles = () =>
        doc.head.querySelectorAll('style[data-href="@funstack/ui/tooltip-warm"]');
      // Role queries need a window; the fresh document has none.
      const button = (name: string) => {
        const found = Array.from(container.querySelectorAll("button")).find(
          (element) => element.textContent === name,
        );
        if (found === undefined) throw new Error(`no button "${name}"`);
        return found;
      };
      return { ...result, doc, styles, button };
    }

    it("renders the warm delay, the marker and one hoisted <style> for any number of Triggers", () => {
      const { styles, button, container } = renderFresh(<Pair flag />);
      for (const element of [button("Bold"), button("Italic")]) {
        expect(element.style.getPropertyValue("interest-delay-start")).toBe(
          "calc(250ms * (1 - var(--fsui-tooltip-warm, 0)))",
        );
        expect(element.getAttribute("data-fsui-tooltip-trigger")).toBe("");
      }
      // Nothing lands in place.
      expect(container.querySelector("style")).toBeNull();
      expect(styles()).toHaveLength(1);
      const style = styles()[0]!;
      expect(style.getAttribute("data-precedence")).toBe("fsui");
      expect(style.textContent).toBe(TOOLTIP_WARM_RULES);
      expect(style.textContent).toContain(
        '@property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }',
      );
      expect(style.textContent).toContain(
        ':root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1; }',
      );
      expect(style.hasAttribute("nonce")).toBe(false);
    });

    it("without the flag: no calc, no marker, no <style>", () => {
      const { styles, button } = renderFresh(<Pair />);
      expect(button("Bold").getAttribute("style")).toBeNull();
      expect(button("Bold").hasAttribute("data-fsui-tooltip-trigger")).toBe(false);
      expect(styles()).toHaveLength(0);
    });

    it("disabled: no calc, no marker, no <style>", () => {
      const { styles, button } = renderFresh(
        <Harness root={{ disabled: true }} trigger={{ experimental_interestFor: true }} />,
      );
      expect(button("Save").style.getPropertyValue("interest-delay-start")).toBe("");
      expect(button("Save").hasAttribute("data-fsui-tooltip-trigger")).toBe(false);
      expect(styles()).toHaveLength(0);
    });

    it("the nonce of a <CSPProvider> lands on the <style>", () => {
      const { styles } = renderFresh(
        <CSPProvider nonce="n0nce">
          <Pair flag />
        </CSPProvider>,
      );
      expect(styles()).toHaveLength(1);
      expect(styles()[0]!.getAttribute("nonce")).toBe("n0nce");
    });

    it("a render element with its own children keeps the <style>", () => {
      // `mergeProps` lets the render element's children win over `children`, so the rule must
      // not travel in them.
      const doc = document.implementation.createHTMLDocument("");
      const container = doc.createElement("div");
      doc.body.append(container);
      render(
        <Tooltip.Root>
          <Tooltip.Trigger experimental_interestFor render={<a href="/pricing">Pricing</a>} />
          <Tooltip.Popup>Plans and prices</Tooltip.Popup>
        </Tooltip.Root>,
        { container },
      );
      const link = container.querySelector("a")!;
      expect(link.textContent).toBe("Pricing");
      expect(link.getAttribute("data-fsui-tooltip-trigger")).toBe("");
      expect(container.querySelector("style")).toBeNull();
      const styles = doc.head.querySelectorAll('style[data-href="@funstack/ui/tooltip-warm"]');
      expect(styles).toHaveLength(1);
      expect(styles[0]!.textContent).toBe(TOOLTIP_WARM_RULES);
    });
  });
});

describe("Warm open attribute (wave 12, #93)", () => {
  // Design amendment for #93: `data-instant` on the Popup, written by presence from its own
  // `beforetoggle` (the shim dispatches it synchronously, before `:popover-open` matches, like
  // browsers): present iff another `[role="tooltip"]:popover-open` exists at that moment, removed
  // at the close's `beforetoggle`. Never rendered by React.
  function Pair({
    flag = false,
    disabledB = false,
    popupB,
  }: {
    flag?: boolean;
    disabledB?: boolean;
    popupB?: TooltipPopupProps;
  }) {
    return (
      <>
        <button type="button">Elsewhere</button>
        <Tooltip.Root>
          <Tooltip.Trigger experimental_interestFor={flag}>Bold</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip-a">Bold text</Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root disabled={disabledB}>
          <Tooltip.Trigger experimental_interestFor={flag}>Italic</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip-b" {...popupB}>
            Italic text
          </Tooltip.Popup>
        </Tooltip.Root>
      </>
    );
  }
  const triggerA = () => screen.getByRole("button", { name: "Bold" });
  const triggerB = () => screen.getByRole("button", { name: "Italic" });
  const tipA = () => screen.getByTestId("tip-a");
  const tipB = () => screen.getByTestId("tip-b");
  const enter = (element: Element) => {
    act(() => {
      fireEvent.pointerEnter(element, { pointerType: "mouse" });
    });
  };
  /** Opens A by hover (a cold open) and lets its `toggle` task run. */
  const openA = () => {
    enter(triggerA());
    advance(250);
    expect(isPopoverOpen(tipA())).toBe(true);
    expect(tipA()).not.toHaveAttribute("data-instant");
  };
  /** Opens A, then B warm by hover; B carries the attribute. */
  const openWarmB = () => {
    openA();
    enter(triggerB());
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(tipB()).toHaveAttribute("data-instant", "");
  };
  /**
   * Records, at each `beforetoggle` / `toggle` of `element`, whether it had the attribute, and at
   * its opening `beforetoggle` whether A matched `:popover-open`. A capture listener on the
   * document, so it runs before the library's listener on the popup.
   */
  function watch(element: Element) {
    const log: string[] = [];
    const onEvent = (event: Event) => {
      if (event.target !== element) return;
      const { newState } = event as ToggleEvent;
      const extra =
        event.type === "beforetoggle" && newState === "open"
          ? ` A-open:${String(tipA().matches(":popover-open"))}`
          : "";
      log.push(
        `${event.type}:${newState}${extra} instant:${String(element.hasAttribute("data-instant"))}`,
      );
    };
    document.addEventListener("beforetoggle", onEvent, true);
    document.addEventListener("toggle", onEvent, true);
    onTestFinished(() => {
      document.removeEventListener("beforetoggle", onEvent, true);
      document.removeEventListener("toggle", onEvent, true);
    });
    return log;
  }

  it("hovering B while A is open: B carries it synchronously, A still open at B's beforetoggle", () => {
    setupTimers();
    render(<Pair />);
    openA();
    const log = watch(tipB());
    enter(triggerB());
    // Synchronously, no timer advanced: B open with the attribute, A closed.
    expect(tipB()).toHaveAttribute("data-instant", "");
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(isPopoverOpen(tipA())).toBe(false);
    // Show before hide: A was still showing when B's `beforetoggle` classified the open.
    expect(log).toEqual(["beforetoggle:open A-open:true instant:false"]);
    expect(showSpy.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      hideSpy.mock.invocationCallOrder.at(-1)!,
    );
    advance(0);
    expect(log.at(-1)).toBe("toggle:open instant:true");
  });

  it("keyboard focus on B while A is open: the same", () => {
    setupTimers();
    render(<Pair />);
    openA();
    const log = watch(tipB());
    act(() => {
      fireEvent.keyDown(document.body, { key: "Tab" });
      triggerB().focus();
    });
    expect(tipB()).toHaveAttribute("data-instant", "");
    expect(isPopoverOpen(tipA())).toBe(false);
    expect(log).toEqual(["beforetoggle:open A-open:true instant:false"]);
  });

  it("with nothing open, B opens after its delay without the attribute", () => {
    setupTimers();
    render(<Pair />);
    enter(triggerB());
    advance(250);
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("Escape removes it at the close's beforetoggle, before toggle", () => {
    setupTimers();
    render(<Pair />);
    openWarmB();
    advance(0);
    const log = watch(tipB());
    escape(triggerB());
    expect(isPopoverOpen(tipB())).toBe(false);
    expect(tipB()).not.toHaveAttribute("data-instant");
    advance(0);
    // The capture listener ran before the library's: present then, absent by `toggle`.
    expect(log).toEqual(["beforetoggle:closed instant:true", "toggle:closed instant:false"]);
  });

  it("a pointerdown removes it", () => {
    setupTimers();
    render(<Pair />);
    openWarmB();
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(isPopoverOpen(tipB())).toBe(false);
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("the closeDelay timer removes it", () => {
    setupTimers();
    render(<Pair />);
    openWarmB();
    act(() => {
      fireEvent.pointerLeave(triggerB(), { pointerType: "mouse" });
    });
    expect(tipB()).toHaveAttribute("data-instant", "");
    advance(150);
    expect(isPopoverOpen(tipB())).toBe(false);
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("disabled flipped while warm-open removes it on the JS path", () => {
    setupTimers();
    const { rerender } = render(<Pair />);
    openWarmB();
    rerender(<Pair disabledB />);
    expect(isPopoverOpen(tipB())).toBe(false);
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("an open the library did not perform is classified too; alone, it carries nothing", () => {
    setupTimers();
    render(<Pair />);
    // Stands in for the browser's `interestfor` open, or a consumer's `showPopover()`.
    act(() => tipB().showPopover());
    expect(tipB()).not.toHaveAttribute("data-instant");
    act(() => tipB().hidePopover());
    openA();
    act(() => tipB().showPopover());
    expect(tipB()).toHaveAttribute("data-instant", "");
    // Nothing hid A here: the library only hides on its own warm open.
    expect(isPopoverOpen(tipA())).toBe(true);
  });

  it("a foreign open tooltip popover counts", () => {
    setupTimers();
    render(
      <>
        <div role="tooltip" popover="manual" data-testid="foreign">
          Elsewhere
        </div>
        <Pair />
      </>,
    );
    act(() => screen.getByTestId("foreign").showPopover());
    enter(triggerB());
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(tipB()).toHaveAttribute("data-instant", "");
  });

  it("an open popover that is not a tooltip does not count", () => {
    setupTimers();
    render(
      <>
        <div popover="manual" data-testid="other">
          Panel
        </div>
        <Pair />
      </>,
    );
    act(() => screen.getByTestId("other").showPopover());
    act(() => tipB().showPopover());
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("render={<section />} on Popup: the attribute lands on the section", () => {
    setupTimers();
    render(<Pair popupB={{ render: <section data-testid="tip-b-section" /> }} />);
    openA();
    enter(triggerB());
    const section = screen.getByTestId("tip-b-section");
    expect(section.localName).toBe("section");
    expect(section).toHaveAttribute("data-instant", "");
  });

  it("is never rendered: not in server markup, and a consumer prop is removed by a cold open", () => {
    expect(renderToString(<Pair flag />)).not.toContain("data-instant");
    setupTimers();
    render(<Pair popupB={{ "data-instant": "" } as TooltipPopupProps} />);
    expect(tipB()).toHaveAttribute("data-instant", "");
    enter(triggerB());
    advance(250);
    expect(isPopoverOpen(tipB())).toBe(true);
    expect(tipB()).not.toHaveAttribute("data-instant");
  });

  it("unmounting while warm-open writes nothing afterwards", () => {
    setupTimers();
    const { unmount } = render(<Pair />);
    openWarmB();
    const popupB = tipB();
    const setSpy = vi.spyOn(popupB, "setAttribute");
    const removeSpy = vi.spyOn(popupB, "removeAttribute");
    unmount();
    advance(1000);
    expect(setSpy).not.toHaveBeenCalledWith("data-instant", expect.anything());
    expect(removeSpy).not.toHaveBeenCalledWith("data-instant");
  });

  describe("under the interestForElement stub (native path)", () => {
    beforeEach(() => {
      Object.defineProperty(HTMLButtonElement.prototype, "interestForElement", {
        configurable: true,
        get() {
          return null;
        },
      });
    });
    afterEach(() => {
      delete (HTMLButtonElement.prototype as { interestForElement?: unknown }).interestForElement;
    });

    it("the beforetoggle listener is still attached, and the only one", () => {
      setupTimers();
      const added = vi.spyOn(HTMLElement.prototype, "addEventListener");
      render(<Pair flag />);
      const typesOn = (element: Element) =>
        new Set(
          added.mock.contexts.flatMap((context, index) =>
            context === element ? [added.mock.calls[index]![0]] : [],
          ),
        );
      // No interaction listener (the JS path would add pointer, focus and key listeners); the
      // popup's `toggle` is `useResolvedPlacement`'s, attached on every path (7.4).
      expect(typesOn(triggerA())).toEqual(new Set());
      expect(typesOn(tipA())).toEqual(new Set(["beforetoggle", "toggle"]));
      // The browser performed both opens (stand-in: `showPopover()` from the test).
      act(() => tipB().showPopover());
      expect(tipB()).not.toHaveAttribute("data-instant");
      act(() => tipB().hidePopover());
      act(() => tipA().showPopover());
      act(() => tipB().showPopover());
      expect(tipB()).toHaveAttribute("data-instant", "");
      expect(tipA()).not.toHaveAttribute("data-instant");
    });

    it("disabled flipped while warm-open removes it", () => {
      setupTimers();
      const { rerender } = render(<Pair flag />);
      act(() => tipA().showPopover());
      act(() => tipB().showPopover());
      expect(tipB()).toHaveAttribute("data-instant", "");
      rerender(<Pair flag disabledB />);
      expect(isPopoverOpen(tipB())).toBe(false);
      expect(tipB()).not.toHaveAttribute("data-instant");
    });
  });
});

describe("Native step-aside (experimental_interestFor)", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLButtonElement.prototype, "interestForElement", {
      configurable: true,
      get() {
        return null;
      },
    });
  });
  afterEach(() => {
    delete (HTMLButtonElement.prototype as { interestForElement?: unknown }).interestForElement;
  });

  it("attaches nothing where the trigger implements interestForElement", async () => {
    const user = setupTimers();
    render(<Harness trigger={{ experimental_interestFor: true }} />);
    await user.hover(trigger());
    advance(1000);
    await user.tab();
    await user.tab();
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("without the flag, the same engine runs the JS path (the flag gates the detection)", async () => {
    const user = setupTimers();
    render(<Harness />);
    await user.hover(trigger());
    advance(250);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("detection is per element: a rendered <span> keeps the JS path", async () => {
    silenceErrors();
    const user = setupTimers();
    render(
      <Harness
        trigger={{
          experimental_interestFor: true,
          render: <span data-testid="span-trigger" tabIndex={0} />,
        }}
      />,
    );
    const span = screen.getByTestId("span-trigger");
    expect(span).toHaveAttribute("interestfor", popup().id);
    await user.hover(span);
    advance(250);
    expect(showSpy).toHaveBeenCalledWith({ source: span });
  });

  it("re-detects when the flag changes after mount", async () => {
    const user = setupTimers();
    const { rerender } = render(<Harness />);
    rerender(<Harness trigger={{ experimental_interestFor: true }} />);
    await user.hover(trigger());
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();

    rerender(<Harness trigger={{ experimental_interestFor: false }} />);
    await user.unhover(trigger());
    await user.hover(trigger());
    advance(250);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("becoming disabled while open hides the popup on the native path too", () => {
    const { rerender } = render(<Harness trigger={{ experimental_interestFor: true }} />);
    // The browser opened it (interest shown).
    act(() => popup().showPopover());
    hideSpy.mockClear();
    rerender(<Harness root={{ disabled: true }} trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).not.toHaveAttribute("interestfor");
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("a flagged but disabled tooltip runs neither path", async () => {
    const user = setupTimers();
    render(<Harness root={{ disabled: true }} trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).not.toHaveAttribute("interestfor");
    await user.hover(trigger());
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe("Positioning", () => {
  // Conventions 13.1: inline-relative `align` on a horizontal side, `self-x-*` for the inline
  // sides; never a plain logical keyword.
  const matrix = [
    ["top", "start", "top span-self-x-end"],
    ["top", "center", "top"],
    ["top", "end", "top span-self-x-start"],
    ["bottom", "start", "bottom span-self-x-end"],
    ["bottom", "center", "bottom"],
    ["bottom", "end", "bottom span-self-x-start"],
    ["left", "start", "left span-bottom"],
    ["left", "center", "left"],
    ["left", "end", "left span-top"],
    ["right", "start", "right span-bottom"],
    ["right", "center", "right"],
    ["right", "end", "right span-top"],
    ["inline-start", "start", "self-x-start span-bottom"],
    ["inline-start", "center", "self-x-start"],
    ["inline-start", "end", "self-x-start span-top"],
    ["inline-end", "start", "self-x-end span-bottom"],
    ["inline-end", "center", "self-x-end"],
    ["inline-end", "end", "self-x-end span-top"],
  ] as const;

  it.each(matrix)("side=%s align=%s sets position-area: %s", (side, align, area) => {
    render(<Harness popup={{ side, align }} />);
    expect(popup().style.getPropertyValue("position-area")).toBe(area);
    expect(popup().style.getPropertyValue("position-try-fallbacks")).toBe(
      "flip-block, flip-inline, flip-block flip-inline",
    );
    expect(popup()).toHaveAttribute("data-side", side);
    expect(popup()).toHaveAttribute("data-align", align);
  });

  it("defaults to side top, align center", () => {
    render(<Harness />);
    expect(popup().style.getPropertyValue("position-area")).toBe("top");
  });

  it("side={null} emits no inline positioning and no data-side / data-align", () => {
    render(<Harness popup={{ side: null, align: "end", style: { color: "red" } }} />);
    expect(popup().getAttribute("style")).toBe("color: red;");
    expect(popup()).not.toHaveAttribute("data-side");
    expect(popup()).not.toHaveAttribute("data-align");
  });

  it("side={null} does not own data-side: the consumer may set it", () => {
    render(<Harness popup={{ side: null, render: <div data-side="inline-end" /> }} />);
    expect(popup()).toHaveAttribute("data-side", "inline-end");
  });

  it("the consumer's style wins over the inline placement", () => {
    render(<Harness popup={{ style: { positionArea: "bottom span-right" } }} />);
    expect(popup().style.getPropertyValue("position-area")).toBe("bottom span-right");
    expect(popup().style.getPropertyValue("position-try-fallbacks")).toBe(
      "flip-block, flip-inline, flip-block flip-inline",
    );
  });
});

describe("Resolved placement (wave 11)", () => {
  // Conventions 13.2: while shown, data-side / data-align and the state are where the browser
  // placed the popup (the computed position-area); otherwise the requested values. jsdom has no
  // layout, so `getComputedStyle` is stubbed for the popup; the shim's `toggle` drives the hook
  // (no ResizeObserver in jsdom).
  const arrow = () => screen.getByTestId("arrow");

  function Placed(props: { popup?: TooltipPopupProps; onRender?: (s: TooltipPopupState) => void }) {
    const { popup: popupProps, onRender } = props;
    return (
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup
          data-testid="popup"
          className={({ side, align }) => `tip tip-${side ?? "custom"}-${align}`}
          {...popupProps}
        >
          {(s) => {
            onRender?.(s);
            return (
              <>
                Saves the document
                <Tooltip.Arrow data-testid="arrow" className={({ side }) => `arrow-${side}`} />
              </>
            );
          }}
        </Tooltip.Popup>
      </Tooltip.Root>
    );
  }

  /** Shows (or hides) the popup and lets the shim's queued `toggle` task run. */
  async function setShown(shown: boolean): Promise<void> {
    await act(async () => {
      if (shown) popup().showPopover({ source: trigger() });
      else popup().hidePopover();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("renders the requested values while shown when the computed value is unknown (jsdom)", async () => {
    render(<Placed popup={{ side: "bottom", align: "end" }} />);
    await setShown(true);
    expect(isPopoverOpen(popup())).toBe(true);
    expect(popup()).toHaveAttribute("data-side", "bottom");
    expect(popup()).toHaveAttribute("data-align", "end");
    expect(arrow()).toHaveAttribute("data-side", "bottom");
  });

  it("a flipped position-area becomes data-side / data-align on Popup and Arrow, and the state", async () => {
    const states: TooltipPopupState[] = [];
    stubComputedPlacement(() => screen.queryByTestId("popup"), {
      positionArea: "span-left bottom",
      direction: "ltr",
    });
    render(<Placed onRender={(s) => states.push(s)} />);
    expect(popup()).toHaveAttribute("data-side", "top");
    await setShown(true);
    expect(popup()).toHaveAttribute("data-side", "bottom");
    expect(popup()).toHaveAttribute("data-align", "end");
    expect(popup()).toHaveClass("tip-bottom-end");
    expect(arrow()).toHaveAttribute("data-side", "bottom");
    expect(arrow()).toHaveAttribute("data-align", "end");
    expect(arrow()).toHaveClass("arrow-bottom");
    expect(states.at(-1)).toEqual({ disabled: false, side: "bottom", align: "end" });
    // The inline style keeps the requested keywords: the browser keeps choosing from them.
    expect(popup().style.getPropertyValue("position-area")).toBe("top");

    await setShown(false);
    expect(popup()).toHaveAttribute("data-side", "top");
    expect(popup()).toHaveAttribute("data-align", "center");
    expect(arrow()).toHaveAttribute("data-side", "top");
    expect(states.at(-1)).toEqual({ disabled: false, side: "top", align: "center" });
  });

  it.each([
    ["span-all bottom", "ltr", "bottom", "center"], // Firefox's serialisation of a flip
    ["span-self-x-end bottom", "ltr", "bottom", "start"],
    ["span-self-x-end bottom", "rtl", "bottom", "start"],
    ["self-x-end span-bottom", "rtl", "left", "start"],
  ])("%s (%s) reads as %s / %s", async (positionArea, direction, side, align) => {
    stubComputedPlacement(() => screen.queryByTestId("popup"), { positionArea, direction });
    render(<Placed />);
    await setShown(true);
    expect(popup()).toHaveAttribute("data-side", side);
    expect(popup()).toHaveAttribute("data-align", align);
  });

  it("an open where it was asked costs no render", async () => {
    let renders = 0;
    const stub = stubComputedPlacement(() => screen.queryByTestId("popup"), {
      positionArea: "top",
      direction: "ltr",
    });
    render(<Placed onRender={() => renders++} />);
    const before = renders;
    await setShown(true);
    expect(stub.calls()).toBeGreaterThan(0);
    expect(renders).toBe(before);
    await setShown(false);
    expect(renders).toBe(before);
  });

  it('side="inline-end" renders inline-end while closed and the physical side while shown', async () => {
    const stub = stubComputedPlacement(() => screen.queryByTestId("popup"), {
      positionArea: "self-x-end",
      direction: "ltr",
    });
    render(<Placed popup={{ side: "inline-end" }} />);
    expect(popup().style.getPropertyValue("position-area")).toBe("self-x-end");
    expect(popup()).toHaveAttribute("data-side", "inline-end");
    expect(arrow()).toHaveAttribute("data-side", "inline-end");
    await setShown(true);
    expect(popup()).toHaveAttribute("data-side", "right");
    await setShown(false);
    expect(popup()).toHaveAttribute("data-side", "inline-end");
    stub.set({ positionArea: "self-x-end", direction: "rtl" });
    await setShown(true);
    expect(popup()).toHaveAttribute("data-side", "left");
    expect(arrow()).toHaveAttribute("data-side", "left");
  });

  it("a changed side while shown is read again", async () => {
    const stub = stubComputedPlacement(() => screen.queryByTestId("popup"), {
      positionArea: "top",
      direction: "ltr",
    });
    const { rerender } = render(<Placed popup={{ side: "top" }} />);
    await setShown(true);
    expect(popup()).toHaveAttribute("data-side", "top");
    stub.set({ positionArea: "span-all top", direction: "ltr" });
    rerender(<Placed popup={{ side: "bottom" }} />);
    // The engine kept `top` (say, no room below): the attribute reports it.
    expect(popup()).toHaveAttribute("data-side", "top");
    stub.set({ positionArea: "bottom", direction: "ltr" });
    rerender(<Placed popup={{ side: "bottom", align: "start" }} />);
    expect(popup()).toHaveAttribute("data-side", "bottom");
  });

  it("side={null} never reads the computed style and emits nothing", async () => {
    const stub = stubComputedPlacement(() => screen.queryByTestId("popup"), {
      positionArea: "bottom",
      direction: "ltr",
    });
    render(<Placed popup={{ side: null }} />);
    await setShown(true);
    await setShown(false);
    expect(stub.calls()).toBe(0);
    expect(popup()).not.toHaveAttribute("data-side");
    expect(arrow()).not.toHaveAttribute("data-side");
    expect(arrow()).not.toHaveAttribute("data-align");
  });

  it("the server renders the requested values on Popup and Arrow", () => {
    const html = renderToString(<Placed popup={{ side: "inline-start", align: "end" }} />);
    expect(html).toContain('data-side="inline-start"');
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*data-side="inline-start"/);
    expect(html).toContain("position-area:self-x-start span-top");
  });
});

describe("Arrow", () => {
  it("renders an aria-hidden span with the Popup's data-side / data-align", () => {
    render(
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup side="right" align="start">
          Saves
          <Tooltip.Arrow data-testid="arrow" className="arrow" />
        </Tooltip.Popup>
      </Tooltip.Root>,
    );
    const el = screen.getByTestId("arrow");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-side", "right");
    expect(el).toHaveAttribute("data-align", "start");
    expect(el).toHaveClass("arrow");
    expect(el).toBeEmptyDOMElement();
  });

  it("className / style / children / render receive { side, align }", () => {
    const states: TooltipArrowState[] = [];
    render(
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup side="bottom" align="end">
          Saves
          <Tooltip.Arrow
            data-testid="arrow"
            className={({ side }) => `arrow-${side}`}
            style={({ align }) => ({ insetInlineEnd: align === "end" ? "12px" : undefined })}
            render={(props, s) => {
              states.push(s);
              return <i {...props} />;
            }}
          >
            {({ side, align }) => `${side}/${align}`}
          </Tooltip.Arrow>
        </Tooltip.Popup>
      </Tooltip.Root>,
    );
    const el = screen.getByTestId("arrow");
    expect(el.tagName).toBe("I");
    expect(el).toHaveClass("arrow-bottom");
    expect(el).toHaveStyle({ insetInlineEnd: "12px" });
    expect(el).toHaveTextContent("bottom/end");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(states.at(-1)).toEqual({ side: "bottom", align: "end" });
  });

  it("the consumer cannot remove aria-hidden", () => {
    render(
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup>
          Saves
          <Tooltip.Arrow data-testid="arrow" render={<span aria-hidden={false} />} />
        </Tooltip.Popup>
      </Tooltip.Root>,
    );
    expect(screen.getByTestId("arrow")).toHaveAttribute("aria-hidden", "true");
  });

  it("throws outside a Tooltip.Popup", () => {
    silenceErrors();
    expect(() => render(<Tooltip.Arrow />)).toThrow(/Tooltip\.Popup/);
  });
});

describe("Disabled", () => {
  it("hover and focus never open a disabled tooltip", async () => {
    const user = setupTimers();
    render(<Harness root={{ disabled: true }} />);
    await user.hover(trigger());
    advance(1000);
    await user.tab();
    await user.tab();
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("becoming disabled while open hides the popup", () => {
    setupTimers();
    const { rerender } = render(<Harness />);
    pointer("pointerenter", trigger());
    advance(250);
    expect(isPopoverOpen(popup())).toBe(true);
    rerender(<Harness root={{ disabled: true }} />);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("becoming disabled while closed calls nothing", () => {
    const { rerender } = render(<Harness />);
    rerender(<Harness root={{ disabled: true }} />);
    expect(hideSpy).not.toHaveBeenCalled();
  });

  it("a pending open timer does nothing once disabled", () => {
    setupTimers();
    const { rerender } = render(<Harness />);
    pointer("pointerenter", trigger());
    advance(100);
    rerender(<Harness root={{ disabled: true }} />);
    advance(1000);
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe("Suspending content", () => {
  it("a Suspense boundary inside the Popup shows its fallback there; nothing is pending", async () => {
    const { Suspender, resolve } = createSuspender();
    await renderAsync(
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup data-testid="popup">
          <Suspense fallback={<span>Loading…</span>}>
            <Suspender value="tip" />
          </Suspense>
        </Tooltip.Popup>
      </Tooltip.Root>,
    );
    expect(trigger()).toBeInTheDocument();
    expect(popup()).toHaveTextContent("Loading…");
    expect(document.querySelector("[data-pending]")).toBeNull();

    await act(async () => resolve("tip", "Saves the document"));
    // React throttles revealing a resolved boundary, so wait for it.
    await screen.findByText("Saves the document");
    expect(trigger()).toHaveAccessibleDescription("Saves the document");
  });
});

describe("Function props", () => {
  it("Root children receive { disabled }", () => {
    const states: TooltipRootState[] = [];
    render(
      <Tooltip.Root disabled>
        {(state) => {
          states.push(state);
          return <Tooltip.Trigger>Save</Tooltip.Trigger>;
        }}
      </Tooltip.Root>,
    );
    expect(states.at(-1)).toEqual({ disabled: true });
  });

  it("Trigger className / style / children receive { disabled } and agree with the attributes", () => {
    function Probe() {
      const [disabled, setDisabled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setDisabled((d) => !d)}>
            flip
          </button>
          <Tooltip.Root disabled={disabled}>
            <Tooltip.Trigger
              data-testid="trigger"
              className={(s: TooltipTriggerState) => (s.disabled ? "muted" : "live")}
              style={(s: TooltipTriggerState) => ({ opacity: s.disabled ? 0.5 : 1 })}
            >
              {(s: TooltipTriggerState): ReactNode => (s.disabled ? "off" : "on")}
            </Tooltip.Trigger>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Root>
        </>
      );
    }
    render(<Probe />);
    const el = screen.getByTestId("trigger");
    expect(el).toHaveClass("live");
    expect(el).toHaveStyle({ opacity: "1" });
    expect(el).toHaveTextContent("on");
    fireEvent.click(screen.getByRole("button", { name: "flip" }));
    expect(el).toHaveClass("muted");
    expect(el).toHaveStyle({ opacity: "0.5" });
    expect(el).toHaveTextContent("off");
    expect(el).toHaveAttribute("data-disabled", "");
  });

  it("Popup className / style / children receive { disabled, side, align }", () => {
    const states: TooltipPopupState[] = [];
    render(
      <Tooltip.Root>
        <Tooltip.Trigger>Save</Tooltip.Trigger>
        <Tooltip.Popup
          data-testid="popup"
          side="bottom"
          align="end"
          className={({ side }) => `tip tip-${side ?? "custom"}`}
          style={({ align }) => ({ textAlign: align === "end" ? "right" : "left" })}
        >
          {(s) => {
            states.push(s);
            return `${s.side}/${s.align}`;
          }}
        </Tooltip.Popup>
      </Tooltip.Root>,
    );
    expect(states.at(-1)).toEqual({ disabled: false, side: "bottom", align: "end" });
    expect(popup()).toHaveClass("tip", "tip-bottom");
    expect(popup()).toHaveStyle({ textAlign: "right" });
    expect(popup()).toHaveTextContent("bottom/end");
    expect(popup()).toHaveAttribute("data-side", "bottom");
  });

  it("render function receives the merged props and the state", () => {
    const states: TooltipTriggerState[] = [];
    render(
      <Tooltip.Root>
        <Tooltip.Trigger
          render={(props, state) => {
            states.push(state);
            return <button {...props} data-testid="custom" />;
          }}
        >
          Save
        </Tooltip.Trigger>
        <Tooltip.Popup data-testid="popup">Tip</Tooltip.Popup>
      </Tooltip.Root>,
    );
    const el = screen.getByTestId("custom");
    expect(el).toHaveAttribute("aria-describedby", popup().id);
    expect(el).toHaveAttribute("type", "button");
    expect(states.at(-1)).toEqual({ disabled: false });
  });
});

describe("render element", () => {
  it("renders a link trigger with the ARIA relation and working hover", async () => {
    const user = setupTimers();
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<a href="/docs" />} className="link">
          Docs
        </Tooltip.Trigger>
        <Tooltip.Popup data-testid="popup">Opens the docs</Tooltip.Popup>
      </Tooltip.Root>,
    );
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("aria-describedby", popup().id);
    expect(link).toHaveClass("link");
    expect(link).not.toHaveAttribute("type");
    await user.hover(link);
    advance(250);
    expect(showSpy).toHaveBeenCalledWith({ source: link });
  });

  it("a custom component receives the ref and the props; consumer refs see the elements", () => {
    function IconButton(props: ComponentPropsWithRef<"button">) {
      return <button {...props} className={`icon ${props.className ?? ""}`} />;
    }
    const triggerRef = vi.fn();
    const popupRef = { current: null as HTMLDivElement | null };
    setupTimers();
    render(
      <Tooltip.Root provides="name">
        <Tooltip.Trigger ref={triggerRef} render={<IconButton />}>
          <svg aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Popup ref={popupRef}>Bold</Tooltip.Popup>
      </Tooltip.Root>,
    );
    const button = screen.getByRole("button", { name: "Bold" });
    expect(button).toHaveClass("icon");
    expect(triggerRef).toHaveBeenCalledWith(button);
    expect(popupRef.current).toHaveAttribute("role", "tooltip");
    // The library's own ref is attached too: the interaction works.
    pointer("pointerenter", button);
    advance(250);
    expect(showSpy).toHaveBeenCalledWith({ source: button });
  });
});

describe("Dev warnings", () => {
  let errorSpy: MockInstance<typeof console.error>;
  beforeEach(() => {
    errorSpy = silenceErrors();
  });

  it('warns for provides="name" with aria-label on the trigger', () => {
    render(<Harness root={{ provides: "name" }} trigger={{ "aria-label": "Save" }} />);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("announces the name twice"));
  });

  it("warns once when the trigger is not focusable", () => {
    const { rerender } = render(<Harness trigger={{ render: <span /> }} />);
    rerender(<Harness trigger={{ render: <span />, className: "x" }} />);
    const calls = errorSpy.mock.calls.filter(([m]) => String(m).includes("not focusable"));
    expect(calls).toHaveLength(1);
  });

  const notFocusable = () =>
    errorSpy.mock.calls.filter(([m]) => String(m).includes("not focusable"));

  it("warns for tabindex=-1 outside a composite widget, and for an item without tabindex", () => {
    render(<Harness trigger={{ render: <button type="button" tabIndex={-1} /> }} />);
    expect(notFocusable()).toHaveLength(1);
    errorSpy.mockClear();
    render(
      <div role="menu">
        <Harness trigger={{ render: <span role="menuitem" /> }} />
      </div>,
    );
    expect(notFocusable()).toHaveLength(1);
  });

  describe("inside a roving container whose engine writes tabindex (#75, toggle-group.md 18)", () => {
    /** Two tooltip Items; the second gets the engine's `tabindex="-1"`. */
    function Group({ remount }: { remount: number }) {
      return (
        <ToggleGroup.Root aria-label="Style">
          <ToggleGroup.Item value="a">A</ToggleGroup.Item>
          <Tooltip.Root key={remount}>
            <Tooltip.Trigger render={<ToggleGroup.Item value="b" />}>B</Tooltip.Trigger>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Root>
        </ToggleGroup.Root>
      );
    }

    it.each([
      ["a standalone ToggleGroup.Root", (n: number) => <Group remount={n} />],
      [
        "a Toolbar.Root",
        (n: number) => (
          <Toolbar.Root aria-label="T">
            <button type="button">first</button>
            <Tooltip.Root key={n}>
              <Tooltip.Trigger>Second</Tooltip.Trigger>
              <Tooltip.Popup>Tip</Tooltip.Popup>
            </Tooltip.Root>
          </Toolbar.Root>
        ),
      ],
    ] as const)(
      "%s: no warning, also when the check runs after the engine's write",
      async (_l, ui) => {
        const { rerender } = render(ui(0));
        const trigger = () => screen.getAllByRole("button")[1]!;
        expect(trigger()).toHaveAttribute("tabindex", "-1");
        // Re-mount the Tooltip alone: its element starts without the attribute; once the engine
        // (observer) has written it, a fresh check reads `-1` under the container.
        rerender(ui(1));
        await act(async () => {});
        expect(trigger()).toHaveAttribute("tabindex", "-1");
        rerender(ui(2));
        await act(async () => {});
        expect(notFocusable()).toHaveLength(0);
      },
    );

    it("a tabindex=-1 trigger under a plain div still warns", () => {
      render(
        <div>
          <Harness trigger={{ render: <button type="button" tabIndex={-1} /> }} />
        </div>,
      );
      expect(notFocusable()).toHaveLength(1);
    });
  });

  it("accepts a roving-tabindex Menu.Item (#57)", () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>Rename</Menu.Item>
          <Tooltip.Root>
            <Tooltip.Trigger render={<Menu.Item data-testid="share" />}>Share</Tooltip.Trigger>
            <Tooltip.Popup>Copy a link</Tooltip.Popup>
          </Tooltip.Root>
        </Menu.Popup>
      </Menu.Root>,
    );
    expect(screen.getByTestId("share").tabIndex).toBe(-1);
    expect(notFocusable()).toHaveLength(0);
  });

  it("accepts an unselected Tabs.Tab (#57)", () => {
    render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="Sections">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tooltip.Root>
            <Tooltip.Trigger render={<Tabs.Tab value="b" data-testid="b" />}>B</Tooltip.Trigger>
            <Tooltip.Popup>Second section</Tooltip.Popup>
          </Tooltip.Root>
        </Tabs.List>
      </Tabs.Root>,
    );
    expect(screen.getByTestId("b").tabIndex).toBe(-1);
    expect(notFocusable()).toHaveLength(0);
  });

  it("accepts a role=toolbar item with tabindex=-1", () => {
    render(
      <div role="toolbar" aria-label="Format">
        <Harness trigger={{ render: <button type="button" tabIndex={-1} /> }} />
      </div>,
    );
    expect(notFocusable()).toHaveLength(0);
  });

  it("warns when the popup contains interactive content", () => {
    render(
      <Harness
        popup={{
          children: (
            <>
              See <a href="/more">more</a>
            </>
          ),
        }}
      />,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("must not contain interactive content"),
    );
  });

  it("stays silent for a correct tooltip", () => {
    render(<Harness />);
    render(
      <Tooltip.Root provides="name">
        <Tooltip.Trigger>
          <svg aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Popup>Bold</Tooltip.Popup>
      </Tooltip.Root>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("Popover shim (jsdom) fidelity", () => {
  it("queues toggle as a task and coalesces changes made before it runs", () => {
    setupTimers();
    render(<Harness />);
    const events: string[] = [];
    popup().addEventListener("beforetoggle", (e) => {
      events.push(`before:${(e as ToggleEvent).newState}`);
    });
    popup().addEventListener("toggle", (e) => {
      const t = e as ToggleEvent;
      events.push(`toggle:${t.oldState}->${t.newState}`);
    });
    act(() => {
      popup().showPopover();
      popup().hidePopover();
    });
    expect(events).toEqual(["before:open", "before:closed"]);
    expect(popup().matches(":popover-open")).toBe(false);
    advance(0);
    expect(events).toEqual(["before:open", "before:closed", "toggle:closed->closed"]);
  });

  it("dispatches beforetoggle synchronously, before :popover-open matches, and toggle after", () => {
    setupTimers();
    render(<Harness />);
    const events: string[] = [];
    popup().addEventListener("beforetoggle", () => {
      events.push(`before open:${String(popup().matches(":popover-open"))}`);
    });
    popup().addEventListener("toggle", () => {
      events.push(`toggle open:${String(popup().matches(":popover-open"))}`);
    });
    act(() => popup().showPopover());
    expect(events).toEqual(["before open:false"]);
    advance(0);
    expect(events).toEqual(["before open:false", "toggle open:true"]);
  });

  it("throws on a state change of a disconnected element, like browsers", () => {
    const el = document.createElement("div");
    el.setAttribute("popover", "manual");
    expect(() => el.showPopover()).toThrow(expect.objectContaining({ name: "InvalidStateError" }));
    // Already closed: a redundant hide returns silently.
    expect(() => el.hidePopover()).not.toThrow();
  });
});
