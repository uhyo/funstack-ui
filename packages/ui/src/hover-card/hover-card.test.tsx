// HoverCard tests (design/components/hover-card.md), jsdom. The Popover shim stands in for the
// platform (src/__tests__/popover-shim.ts): `beforetoggle` synchronously, `toggle` a task later
// (a 0 ms timer, flushed by `advance`). Timers are faked (`setTimeout` / `clearTimeout` only), so
// the 600 / 300 ms delays are driven explicitly. The interest shim (interest-shim.ts) dispatches
// `interest` / `loseinterest` for the flagged path; jsdom has no `interestForElement`, so the
// rows that need the flagged path define it on the anchor prototype for the test.
//
// Shared overlay suite: not used. `describeOverlayOpenState` drives part closes and Trigger clicks,
// and a HoverCard has neither (no Close part; the Trigger's click is the consumer's). The rows
// it would cover are written here against hover and focus instead.
//
// In hover-card.browser.test.tsx (three engines): the real top layer and anchoring, real hover
// with the delays, `:focus-visible`, Tab into the card, Escape inside a modal dialog, and the
// `interestfor` flag in Chromium.
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { MockInstance } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  silenceErrors,
} from "../__tests__/helpers.js";
import { gainInterest, dispatchLoseInterest } from "../__tests__/interest-shim.js";
import { isPopoverOpen, popoverSource } from "../__tests__/popover-shim.js";
import { Tooltip } from "../tooltip/index.js";
import { HoverCard } from "./index.js";
import type {
  HoverCardOpenChangeDetails,
  HoverCardPopupProps,
  HoverCardRootProps,
  HoverCardRootState,
  HoverCardTriggerProps,
  HoverCardTriggerState,
} from "./index.js";

type Details = HoverCardOpenChangeDetails;

interface HarnessProps {
  root?: Omit<HoverCardRootProps, "children">;
  trigger?: Partial<HoverCardTriggerProps>;
  popup?: Partial<HoverCardPopupProps>;
  content?: ReactNode;
}

function Harness({ root, trigger, popup, content }: HarnessProps) {
  return (
    <>
      <button type="button">Before</button>
      <HoverCard.Root {...root}>
        <HoverCard.Trigger href="/u/ada" {...trigger}>
          {trigger?.children ?? "@ada"}
        </HoverCard.Trigger>
        <HoverCard.Popup data-testid="popup" {...popup}>
          {content ?? (
            <>
              <span data-testid="content">Ada Lovelace</span>
              <button type="button">Follow</button>
            </>
          )}
        </HoverCard.Popup>
      </HoverCard.Root>
      <button type="button">After</button>
    </>
  );
}

const trigger = () => screen.getByRole("link", { name: "@ada" });
const popup = () => screen.getByTestId("popup");
const content = () => screen.queryByTestId("content");
const follow = () => screen.getByRole("button", { name: "Follow", hidden: true });

let showSpy: MockInstance<HTMLElement["showPopover"]>;

// jsdom's `:focus-visible` keeps heuristic state across tests; model the browser rule the
// HoverCard relies on instead (as tooltip.test.tsx): visible when the last input was a key.
let lastInputWasKeyboard = false;
const onKeyInput = () => {
  lastInputWasKeyboard = true;
};
const onPointerInput = () => {
  lastInputWasKeyboard = false;
};

beforeEach(() => {
  showSpy = vi.spyOn(HTMLElement.prototype, "showPopover");
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
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  (globalThis as { jest?: unknown }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  };
});

afterEach(() => {
  document.removeEventListener("keydown", onKeyInput, true);
  document.removeEventListener("pointerdown", onPointerInput, true);
  document.removeEventListener("mousedown", onPointerInput, true);
  vi.useRealTimers();
  delete (globalThis as { jest?: unknown }).jest;
});

function setupUser() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

/** Advances the fake clock inside an async `act`, so transitions and promises settle too. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Runs the tasks queued so far (the shim's `toggle`, the lost-interest hide). 1 ms rather than 0:
 * the fake clock schedules a 0 ms timer created inside another timer's callback 1 ms later.
 */
async function task(): Promise<void> {
  await advance(1);
}

/** Lets resolved promises and React's queued work run (no timer advances). */
async function flush(): Promise<void> {
  await act(async () => {});
}

async function renderAsync(ui: ReactNode): Promise<void> {
  await act(async () => {
    render(ui);
  });
}

function pointer(
  type: "pointerenter" | "pointerleave" | "pointerdown" | "pointerup",
  el: Element,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    pointerType: "mouse",
    bubbles: type === "pointerdown" || type === "pointerup",
    cancelable: true,
    composed: true,
    ...init,
  });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

function escape(
  target: Element = document.activeElement ?? document.body,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/** Hover the Trigger and let the open delay and the toggle task pass. */
async function hoverOpen(ms = 600): Promise<void> {
  pointer("pointerenter", trigger());
  await advance(ms);
  await task();
}

/** Keyboard focus on the Trigger (`:focus-visible` in the shim's model). */
function keyboardFocus(el: HTMLElement): void {
  lastInputWasKeyboard = true;
  act(() => {
    el.focus();
  });
}

describe("Anatomy, roles and ARIA", () => {
  it("renders a link and a manual popover with role group right after it, no ARIA relation", () => {
    render(<Harness />);
    const link = trigger();
    const card = popup();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/u/ada");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveAttribute("popover", "manual");
    expect(card).toHaveAttribute("role", "group");
    expect(card.id).not.toBe("");
    expect(link.nextElementSibling).toBe(card);
    for (const attribute of [
      "aria-describedby",
      "aria-expanded",
      "aria-haspopup",
      "aria-details",
      "aria-controls",
      "interestfor",
      "data-open",
      "data-pending",
      "data-disabled",
    ]) {
      expect(link).not.toHaveAttribute(attribute);
    }
    expect(card).not.toHaveAttribute("data-open");
    expect(card).toHaveAttribute("data-side", "bottom");
    expect(card).toHaveAttribute("data-align", "center");
    expect(card.getAttribute("style")).toContain("position-area");
    // Content is not rendered while closed.
    expect(content()).toBeNull();
  });

  it("lets the consumer override role, pass aria-* and render a span card", () => {
    const errors = silenceErrors();
    render(
      <p>
        Thanks{" "}
        <HoverCard.Root>
          <HoverCard.Trigger href="/u/ada" aria-details="card">
            @ada
          </HoverCard.Trigger>
          <HoverCard.Popup
            data-testid="popup"
            render={<span />}
            role="dialog"
            aria-label="Ada"
            side="top"
            align="start"
          >
            hi
          </HoverCard.Popup>
        </HoverCard.Root>{" "}
        for the review.
      </p>,
    );
    expect(popup().tagName).toBe("SPAN");
    expect(popup()).toHaveAttribute("role", "dialog");
    expect(popup()).toHaveAttribute("data-side", "top");
    expect(popup()).toHaveAttribute("data-align", "start");
    expect(trigger()).toHaveAttribute("aria-details", "card");
    expect(errors).not.toHaveBeenCalled();
  });

  it("experimental_hint renders popover=hint", () => {
    render(<Harness popup={{ experimental_hint: true }} />);
    expect(popup()).toHaveAttribute("popover", "hint");
  });

  it("side={null} emits no placement", () => {
    render(<Harness popup={{ side: null }} />);
    expect(popup()).not.toHaveAttribute("data-side");
    expect(popup().getAttribute("style") ?? "").not.toContain("position-area");
  });

  it("a button Trigger through render keeps the consumer's onClick and gets no type override", async () => {
    const onClick = vi.fn();
    render(
      <HoverCard.Root>
        <HoverCard.Trigger render={<button type="button" onClick={onClick} />}>
          Ada
        </HoverCard.Trigger>
        <HoverCard.Popup data-testid="popup">card</HoverCard.Popup>
      </HoverCard.Root>,
    );
    const button = screen.getByRole("button", { name: "Ada" });
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("parts outside a Root throw", () => {
    silenceErrors();
    expect(() => render(<HoverCard.Trigger href="/">x</HoverCard.Trigger>)).toThrow(
      "HoverCard.Trigger must be rendered inside a HoverCard.Root.",
    );
    expect(() => render(<HoverCard.Popup>x</HoverCard.Popup>)).toThrow(
      "HoverCard.Popup must be rendered inside a HoverCard.Root.",
    );
  });

  it("warns once when the Trigger is not focusable", () => {
    const errors = silenceErrors();
    render(
      <HoverCard.Root>
        <HoverCard.Trigger>no href</HoverCard.Trigger>
        <HoverCard.Popup>card</HoverCard.Popup>
      </HoverCard.Root>,
    );
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0]?.[0])).toContain(
      "HoverCard.Trigger: the trigger is not focusable",
    );
  });

  it("warns for a controlled Root without onOpenChange", () => {
    const errors = silenceErrors();
    render(<Harness root={{ open: false }} />);
    expect(
      errors.mock.calls.some(([m]) =>
        String(m).includes("HoverCard.Root: `open` is set without `onOpenChange`"),
      ),
    ).toBe(true);
  });

  it("states reach the function forms", async () => {
    const rootStates: HoverCardRootState[] = [];
    const triggerStates: HoverCardTriggerState[] = [];
    await renderAsync(
      <HoverCard.Root>
        {(state) => {
          rootStates.push(state);
          return (
            <>
              <HoverCard.Trigger
                href="/u/ada"
                className={(s) => {
                  triggerStates.push(s);
                  return s.open ? "open" : "closed";
                }}
              >
                @ada
              </HoverCard.Trigger>
              <HoverCard.Popup
                data-testid="popup"
                className={(s) => `card ${String(s.open)} ${String(s.side)}`}
              >
                body
              </HoverCard.Popup>
            </>
          );
        }}
      </HoverCard.Root>,
    );
    expect(rootStates.at(-1)).toEqual({ open: false, pending: false, disabled: false });
    expect(trigger()).toHaveClass("closed");
    expect(popup()).toHaveClass("card false bottom");
    await hoverOpen();
    expect(rootStates.at(-1)).toEqual({ open: true, pending: false, disabled: false });
    expect(triggerStates.at(-1)).toEqual({ open: true, pending: false, disabled: false });
    expect(trigger()).toHaveClass("open");
    expect(popup()).toHaveClass("card true bottom");
  });
});

describe("Opening on interest (JS path)", () => {
  it("hover opens after 600 ms: a request with the pointerenter, shown against the Trigger, no focus move", async () => {
    const action = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    const before = screen.getByRole("button", { name: "Before" });
    act(() => before.focus());
    const enter = pointer("pointerenter", trigger());
    await advance(599);
    expect(action).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
    await advance(1);
    expect(action).toHaveBeenCalledTimes(1);
    const [next, details] = action.mock.calls[0]!;
    expect(next).toBe(true);
    expect(details.reason).toBe("activate");
    expect(details.event).toBe(enter);
    expect(Object.keys(details)).toEqual(["reason"]);
    expect(isPopoverOpen(popup())).toBe(true);
    expect(popoverSource(popup())).toBe(trigger());
    expect(content()).not.toBeNull();
    expect(document.activeElement).toBe(before);
    expect(trigger()).toHaveAttribute("data-open");
  });

  it("every show is a no-focus show: the card is inert during showPopover and autofocus is ignored", async () => {
    const inertAtShow: boolean[] = [];
    showSpy.mockRestore();
    const original = HTMLElement.prototype.showPopover;
    showSpy = vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
      this: HTMLElement,
      options?: ShowPopoverOptions,
    ) {
      inertAtShow.push(this.hasAttribute("inert"));
      original.call(this, options);
    });
    // keepMounted, so the content exists before the open and carries a real `autofocus`
    // attribute (React drops `autoFocus` on client-rendered content).
    await renderAsync(<Harness popup={{ keepMounted: true }} />);
    popup().querySelector("button")?.setAttribute("autofocus", "");
    await hoverOpen();
    expect(inertAtShow).toEqual([true]);
    expect(popup()).not.toHaveAttribute("inert");
    expect(document.activeElement).toBe(document.body);
  });

  it("a hover that leaves before the delay opens nothing", async () => {
    const action = vi.fn();
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    pointer("pointerenter", trigger());
    await advance(300);
    pointer("pointerleave", trigger());
    await advance(2000);
    expect(action).not.toHaveBeenCalled();
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("touch pointers open nothing", async () => {
    await renderAsync(<Harness />);
    pointer("pointerenter", trigger(), { pointerType: "touch" });
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("keyboard focus opens after the delay; focus stays on the Trigger", async () => {
    const action = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    keyboardFocus(trigger());
    await advance(600);
    await task();
    expect(action.mock.calls[0]?.[1].event?.type).toBe("focus");
    expect(isPopoverOpen(popup())).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it("pointer focus (a click) does not open", async () => {
    await renderAsync(<Harness />);
    lastInputWasKeyboard = false;
    act(() => trigger().focus());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("delay and closeDelay are configurable", async () => {
    await renderAsync(<Harness root={{ delay: 100, closeDelay: 50 }} />);
    pointer("pointerenter", trigger());
    await advance(100);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
    pointer("pointerleave", trigger());
    await advance(49);
    expect(isPopoverOpen(popup())).toBe(true);
    await advance(1);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("disabled: interest opens nothing; the Trigger renders data-disabled and still navigates", async () => {
    await renderAsync(<Harness root={{ disabled: true }} />);
    expect(trigger()).toHaveAttribute("data-disabled", "");
    expect(trigger()).toHaveAttribute("href", "/u/ada");
    expect(trigger()).not.toHaveAttribute("aria-disabled");
    pointer("pointerenter", trigger());
    keyboardFocus(trigger());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });
});

describe("Async open: pending, Suspense, overlap, rejection", () => {
  it("an async action: the Trigger is optimistic open and pending; the card appears when it resolves", async () => {
    const d = deferred();
    await renderAsync(<Harness root={{ openChangeAction: () => d.promise }} />);
    await hoverOpen();
    expect(trigger()).toHaveAttribute("data-open", "");
    expectPending(trigger());
    expect(isPopoverOpen(popup())).toBe(false);
    expect(content()).toBeNull();
    await act(async () => d.resolve());
    await task();
    expectNotPending(trigger());
    expect(isPopoverOpen(popup())).toBe(true);
    expect(content()).not.toBeNull();
  });

  it("suspending content holds the open; the card shows once the data arrives", async () => {
    const { Suspender, resolve } = createSuspender();
    await renderAsync(<Harness content={<Suspender value="ada" />} />);
    await hoverOpen();
    expectPending(trigger());
    expect(trigger()).toHaveAttribute("data-open", "");
    expect(isPopoverOpen(popup())).toBe(false);
    expect(showSpy).not.toHaveBeenCalled();
    await act(async () => resolve("ada", "Ada Lovelace"));
    await task();
    expectNotPending(trigger());
    expect(isPopoverOpen(popup())).toBe(true);
    expect(screen.getByTestId("suspender")).toHaveTextContent("Ada Lovelace");
  });

  it("a skeleton boundary inside the Popup opens at once and swaps later", async () => {
    const { Suspender, resolve } = createSuspender();
    await renderAsync(
      <Harness
        content={
          <Suspense fallback={<span data-testid="skeleton">…</span>}>
            <Suspender value="ada2" />
          </Suspense>
        }
      />,
    );
    await hoverOpen();
    expect(isPopoverOpen(popup())).toBe(true);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    await act(async () => resolve("ada2"));
    expect(screen.getByTestId("suspender")).toBeInTheDocument();
  });

  it("the user leaves while it loads: the open is cancelled with a dismiss request and nothing appears", async () => {
    const { Suspender, resolve } = createSuspender();
    const action = vi.fn<(next: boolean, details: Details) => void>();
    const onOpenChange = vi.fn();
    await renderAsync(
      <Harness
        root={{ openChangeAction: action, onOpenChange }}
        content={<Suspender value="slow" />}
      />,
    );
    await hoverOpen();
    expectPending(trigger());
    const leave = pointer("pointerleave", trigger());
    await advance(300);
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]?.[0]).toBe(false);
    expect(action.mock.calls[1]?.[1].reason).toBe("dismiss");
    expect(action.mock.calls[1]?.[1].event).toBe(leave);
    expect(trigger()).not.toHaveAttribute("data-open");
    await act(async () => resolve("slow"));
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
    expect(showSpy).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("coming back within closeDelay keeps the pending open", async () => {
    const d = deferred();
    const action = vi.fn(() => d.promise);
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    await hoverOpen();
    pointer("pointerleave", trigger());
    await advance(200);
    pointer("pointerenter", trigger());
    await advance(1000);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve());
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
  });

  it("overlap: true, false, true resolves by latest intent", async () => {
    const ds = [deferred(), deferred(), deferred()];
    let call = 0;
    const action = vi.fn((_next: boolean) => ds[call++]!.promise);
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    await hoverOpen();
    pointer("pointerleave", trigger());
    await advance(300);
    pointer("pointerenter", trigger());
    await advance(600);
    expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
    await act(async () => {
      ds[0]!.resolve();
      ds[1]!.resolve();
    });
    expect(isPopoverOpen(popup())).toBe(false);
    await act(async () => ds[2]!.resolve());
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
  });

  it("a rejected open reverts data-open and reaches the Error Boundary above Root", async () => {
    silenceErrors();
    const onError = vi.fn();
    const d = deferred();
    await renderAsync(
      <ErrorCatcher onError={onError}>
        <Harness root={{ openChangeAction: () => d.promise }} />
      </ErrorCatcher>,
    );
    await hoverOpen();
    expect(trigger()).toHaveAttribute("data-open");
    await act(async () => d.reject(new Error("nope")));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "@ada" })).toBeNull();
  });

  // #207 (conventions 2.4.1): a handled rejection of the open; the card stays closed.
  it("an open whose action calls details.reject(): stays closed, no boundary, no reportError", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const onError = vi.fn();
    const d = deferred();
    await renderAsync(
      <ErrorCatcher onError={onError}>
        <Harness
          root={{
            openChangeAction: async (_next, details) => {
              await d.promise;
              details.reject();
            },
          }}
        />
      </ErrorCatcher>,
    );
    await hoverOpen();
    expect(trigger()).toHaveAttribute("data-open");
    await act(async () => d.resolve());
    await task();
    expect(trigger()).not.toHaveAttribute("data-open");
    expect(isPopoverOpen(popup())).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("an Error Boundary inside the Popup keeps the link when the content fails", async () => {
    silenceErrors();
    function Fails(): ReactNode {
      throw new Error("load failed");
    }
    await renderAsync(
      <Harness
        content={
          <ErrorCatcher>
            <Fails />
          </ErrorCatcher>
        }
      />,
    );
    await hoverOpen();
    expect(trigger()).toBeInTheDocument();
    expect(isPopoverOpen(popup())).toBe(true);
  });
});

describe("Closing: every user close is a fact", () => {
  it("lost interest while shown: onOpenChange(false, dismiss, pointerleave) urgently; no action for false", async () => {
    const action = vi.fn();
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ openChangeAction: action, onOpenChange }} />);
    await hoverOpen();
    const leave = pointer("pointerleave", trigger());
    await advance(299);
    expect(isPopoverOpen(popup())).toBe(true);
    await advance(1);
    expect(isPopoverOpen(popup())).toBe(false);
    await task();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
    expect(onOpenChange.mock.calls[0]?.[1].event).toBe(leave);
    expect(action).toHaveBeenCalledTimes(1);
    expect(trigger()).not.toHaveAttribute("data-open");
    expectNotPending(trigger());
    expect(content()).toBeNull();
  });

  it("the pointer may cross from the Trigger into the card; leaving the card closes it", async () => {
    await renderAsync(<Harness />);
    await hoverOpen();
    pointer("pointerleave", trigger());
    await advance(100);
    pointer("pointerenter", popup());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(true);
    pointer("pointerleave", popup());
    await advance(300);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("a text selection dragged out of the card closes it only after the release", async () => {
    await renderAsync(<Harness />);
    await hoverOpen();
    pointer("pointerleave", trigger());
    pointer("pointerenter", popup());
    pointer("pointerleave", popup(), { buttons: 1 });
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(true);
    pointer("pointerup", document.body);
    await advance(300);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("Escape closes a shown card, is prevented, and is reported with the keydown", async () => {
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ onOpenChange }} />);
    await hoverOpen();
    const key = escape(document.body);
    expect(key.defaultPrevented).toBe(true);
    expect(isPopoverOpen(popup())).toBe(false);
    await task();
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
    expect(onOpenChange.mock.calls[0]?.[1].event).toBe(key);
  });

  it("Escape while closed passes through untouched", async () => {
    await renderAsync(<Harness />);
    expect(escape(document.body).defaultPrevented).toBe(false);
  });

  it("Escape with focus inside returns focus to the Trigger, and that focus does not re-open", async () => {
    const action = vi.fn();
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    keyboardFocus(trigger());
    await advance(600);
    await task();
    // Tab into the card: the Trigger's blur starts the close timer, the card's focusin cancels it.
    keyboardFocus(follow());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(true);
    escape(follow());
    expect(isPopoverOpen(popup())).toBe(false);
    expect(document.activeElement).toBe(trigger());
    await advance(2000);
    expect(isPopoverOpen(popup())).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    // Fresh interest: focus leaves and returns.
    keyboardFocus(screen.getByRole("button", { name: "After" }));
    keyboardFocus(trigger());
    await advance(600);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("Escape while the open is pending cancels it (a dismiss request)", async () => {
    const d = deferred();
    const action = vi.fn<(next: boolean, details: Details) => unknown>(() => d.promise);
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    await hoverOpen();
    const key = escape(document.body);
    await flush();
    expect(action.mock.calls[1]?.[0]).toBe(false);
    expect(action.mock.calls[1]?.[1].event).toBe(key);
    expect(trigger()).not.toHaveAttribute("data-open");
  });

  it("Escape before the delay passes cancels the coming open", async () => {
    await renderAsync(<Harness />);
    keyboardFocus(trigger());
    await advance(300);
    escape(trigger());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  // Conventions 15 (#191): Escape during an IME composition cancels the composition only.
  it.each([
    ["isComposing", { isComposing: true }],
    ["keyCode 229 (WebKit)", { keyCode: 229 }],
  ] as const)(
    "an Escape of an IME composition (%s) neither closes nor cancels",
    async (_, init) => {
      await renderAsync(<Harness />);
      // Before anything is intended: the Trigger's listener keeps the coming open.
      keyboardFocus(trigger());
      await advance(300);
      escape(trigger(), init);
      await advance(600);
      await task();
      expect(isPopoverOpen(popup())).toBe(true);
      // Shown: the document listener leaves it open and does not prevent.
      expect(escape(trigger(), init).defaultPrevented).toBe(false);
      expect(isPopoverOpen(popup())).toBe(true);
      expect(escape(trigger()).defaultPrevented).toBe(true);
      expect(isPopoverOpen(popup())).toBe(false);
    },
  );

  it("a prevented Escape before the delay keeps the coming open (the Trigger's listener)", async () => {
    await renderAsync(<Harness />);
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener("keydown", prevent, true);
    try {
      keyboardFocus(trigger());
      await advance(300);
      escape(trigger());
      await advance(600);
      await task();
      expect(isPopoverOpen(popup())).toBe(true);
    } finally {
      document.removeEventListener("keydown", prevent, true);
    }
  });

  it("Escape stands down while a popover is open inside the card, and when already prevented", async () => {
    await renderAsync(
      <Harness
        content={
          <div popover="manual" data-testid="inner">
            inner
          </div>
        }
      />,
    );
    await hoverOpen();
    const inner = screen.getByTestId("inner");
    act(() => inner.showPopover());
    const key = escape(document.body);
    expect(key.defaultPrevented).toBe(false);
    expect(isPopoverOpen(popup())).toBe(true);
    act(() => inner.hidePopover());
    const prevent = (event: Event) => event.preventDefault();
    popup().addEventListener("keydown", prevent);
    escape(popup());
    expect(isPopoverOpen(popup())).toBe(true);
    popup().removeEventListener("keydown", prevent);
    escape(document.body);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  // Conventions 15 rule 4 (#194): recorded on the window in capture, decided last, so the
  // signal is `preventDefault()`, never `stopPropagation()`.
  describe("stopPropagation() does not keep it open; preventDefault() does (#194)", () => {
    const stop = (event: Event) => event.stopPropagation();
    const stopAndPrevent = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };

    it("a native listener on the focused element stops it: closes, after the dispatch", async () => {
      await renderAsync(<Harness />);
      await hoverOpen();
      const button = follow();
      act(() => button.focus());
      button.addEventListener("keydown", stop);
      escape(button);
      expect(isPopoverOpen(popup())).toBe(true);
      await flush();
      expect(isPopoverOpen(popup())).toBe(false);
      // Focus was inside: it returns to the Trigger.
      expect(document.activeElement).toBe(trigger());
    });

    it("a React onKeyDown on an ancestor stops it: closes", async () => {
      await renderAsync(
        <div onKeyDown={(event) => event.stopPropagation()}>
          <Harness />
        </div>,
      );
      await hoverOpen();
      escape(trigger());
      await flush();
      expect(isPopoverOpen(popup())).toBe(false);
    });

    it("with preventDefault() as well (native and React): stays", async () => {
      await renderAsync(
        <div
          onKeyDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
        >
          <Harness />
        </div>,
      );
      await hoverOpen();
      escape(trigger());
      await flush();
      expect(isPopoverOpen(popup())).toBe(true);
      const button = follow();
      button.addEventListener("keydown", stopAndPrevent);
      escape(button);
      await flush();
      expect(isPopoverOpen(popup())).toBe(true);
    });

    it("the Trigger's cancel: a child of the Trigger stops it, the open is cancelled", async () => {
      await renderAsync(<Harness trigger={{ children: <span data-testid="label">@ada</span> }} />);
      keyboardFocus(trigger());
      await advance(300);
      const label = screen.getByTestId("label");
      label.addEventListener("keydown", stop);
      const key = escape(label);
      await flush();
      await advance(1000);
      await task();
      expect(isPopoverOpen(popup())).toBe(false);
      expect(key.defaultPrevented).toBe(false);
    });

    it("the Trigger's cancel: a prevented Escape from a child does not cancel", async () => {
      await renderAsync(<Harness trigger={{ children: <span data-testid="label">@ada</span> }} />);
      keyboardFocus(trigger());
      await advance(300);
      const label = screen.getByTestId("label");
      label.addEventListener("keydown", stopAndPrevent);
      escape(label);
      await flush();
      await advance(600);
      await task();
      expect(isPopoverOpen(popup())).toBe(true);
    });
  });

  it("a press outside closes now, with the pointerdown; a press inside does not", async () => {
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ onOpenChange }} />);
    await hoverOpen();
    pointer("pointerdown", follow());
    expect(isPopoverOpen(popup())).toBe(true);
    const press = pointer("pointerdown", screen.getByRole("button", { name: "After" }));
    expect(isPopoverOpen(popup())).toBe(false);
    await task();
    expect(onOpenChange.mock.calls[0]?.[1].event).toBe(press);
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
  });

  it("lost interest and a press outside do not focus the Trigger when focus was inside", async () => {
    await renderAsync(<Harness />);
    await hoverOpen();
    act(() => follow().focus());
    pointer("pointerleave", trigger());
    await advance(300);
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
    expect(document.activeElement).not.toBe(trigger());
    expect(popup().contains(document.activeElement)).toBe(false);
  });

  it("a press on the Trigger closes a shown card and nothing re-opens until fresh interest", async () => {
    const action = vi.fn();
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ openChangeAction: action, onOpenChange }} />);
    await hoverOpen();
    const press = pointer("pointerdown", trigger());
    expect(isPopoverOpen(popup())).toBe(false);
    await task();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[1].event).toBe(press);
    expect(action).toHaveBeenCalledTimes(1);
    await advance(2000);
    expect(isPopoverOpen(popup())).toBe(false);
    pointer("pointerleave", trigger());
    pointer("pointerenter", trigger());
    await advance(600);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("a press on the Trigger cancels the open timer and a pending open", async () => {
    const d = deferred();
    const action = vi.fn<(next: boolean, details: Details) => unknown>(() => d.promise);
    await renderAsync(<Harness root={{ openChangeAction: action }} />);
    pointer("pointerenter", trigger());
    await advance(300);
    pointer("pointerdown", trigger());
    await advance(1000);
    expect(action).not.toHaveBeenCalled();
    pointer("pointerleave", trigger());
    await hoverOpen();
    expect(action).toHaveBeenCalledTimes(1);
    const press = pointer("pointerdown", trigger());
    await flush();
    expect(action.mock.calls[1]?.[0]).toBe(false);
    expect(action.mock.calls[1]?.[1].event).toBe(press);
    await act(async () => d.resolve());
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("becoming disabled closes a shown card as a dismissal with no event", async () => {
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    const { rerender } = render(<Harness root={{ onOpenChange }} />);
    await hoverOpen();
    expect(isPopoverOpen(popup())).toBe(true);
    rerender(<Harness root={{ onOpenChange, disabled: true }} />);
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
    expect(onOpenChange.mock.calls[0]?.[1].event).toBeUndefined();
  });

  it("script hidePopover() is a fact with the toggle event", async () => {
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(<Harness root={{ onOpenChange }} />);
    await hoverOpen();
    act(() => popup().hidePopover());
    await task();
    expect(onOpenChange.mock.calls[0]?.[1].event?.type).toBe("toggle");
  });
});

// Conventions 15 rule 4 (#194): HoverCard and Tooltip are global layers, decided in the order
// they opened; a layer inside the card is taken first (the card's stand-down snapshot).
describe("Escape with other layers: one Escape closes one layer (#194)", () => {
  const tip = () => screen.getByTestId("tip");
  const tipTrigger = () => screen.getByRole("button", { name: "Info", hidden: true });
  const tooltip = (
    <Tooltip.Root delay={0}>
      <Tooltip.Trigger>Info</Tooltip.Trigger>
      <Tooltip.Popup data-testid="tip">More</Tooltip.Popup>
    </Tooltip.Root>
  );
  async function showTooltip(): Promise<void> {
    pointer("pointerenter", tipTrigger());
    await advance(1);
    expect(isPopoverOpen(tip())).toBe(true);
  }
  /** An Escape at `target`; with `stop`, a native listener there stops its propagation. */
  async function escapeAt(target: Element, stop: boolean): Promise<void> {
    const listener = (event: Event) => event.stopPropagation();
    if (stop) target.addEventListener("keydown", listener);
    escape(target);
    target.removeEventListener("keydown", listener);
    await flush();
  }

  it.each([
    ["the card opened first", "card", false],
    ["the tooltip opened first", "tooltip", false],
    ["the card opened first, propagation stopped", "card", true],
    ["the tooltip opened first, propagation stopped", "tooltip", true],
  ] as const)(
    "a Tooltip and a HoverCard showing apart: %s closes first",
    async (_, first, stop) => {
      await renderAsync(
        <>
          <Harness />
          {tooltip}
        </>,
      );
      if (first === "card") {
        await hoverOpen();
        await showTooltip();
      } else {
        await showTooltip();
        await hoverOpen();
      }
      expect(isPopoverOpen(popup())).toBe(true);
      const outside = screen.getByRole("button", { name: "After" });
      await escapeAt(outside, stop);
      expect(isPopoverOpen(popup())).toBe(first !== "card");
      expect(isPopoverOpen(tip())).toBe(first === "card");
      await task();
      await escapeAt(outside, stop);
      expect(isPopoverOpen(popup())).toBe(false);
      expect(isPopoverOpen(tip())).toBe(false);
    },
  );

  it.each([false, true])(
    "a Tooltip inside the card: the tooltip, then the card (propagation stopped: %s)",
    async (stop) => {
      await renderAsync(<Harness content={tooltip} />);
      await hoverOpen();
      await showTooltip();
      await escapeAt(tipTrigger(), stop);
      expect(isPopoverOpen(tip())).toBe(false);
      expect(isPopoverOpen(popup())).toBe(true);
      await task();
      await escapeAt(tipTrigger(), stop);
      expect(isPopoverOpen(popup())).toBe(false);
    },
  );

  // The cancels group (#194 review): the Trigger's cancel decides before the global layers, so
  // a Tooltip that closes on the same Escape does not skip it.
  it("a Tooltip showing elsewhere, focus on the Trigger with a coming open: Escape closes the tooltip and the card never opens", async () => {
    await renderAsync(
      <>
        <Harness />
        {tooltip}
      </>,
    );
    await showTooltip();
    keyboardFocus(trigger());
    await advance(300);
    escape(trigger());
    expect(isPopoverOpen(tip())).toBe(false);
    await advance(1000);
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("the same with a page preventDefault(): nothing is cancelled and nothing closes", async () => {
    await renderAsync(
      <>
        <Harness />
        {tooltip}
      </>,
    );
    await showTooltip();
    keyboardFocus(trigger());
    await advance(300);
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener("keydown", prevent);
    onTestFinished(() => document.removeEventListener("keydown", prevent));
    escape(trigger());
    expect(isPopoverOpen(tip())).toBe(true);
    await advance(600);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
  });

  it("an auto popover inside the card, propagation stopped: the card stays (the snapshot)", async () => {
    await renderAsync(
      <Harness
        content={
          <div popover="auto" data-testid="inner">
            <button type="button">In popover</button>
          </div>
        }
      />,
    );
    await hoverOpen();
    const inner = screen.getByTestId("inner");
    act(() => inner.showPopover());
    const button = screen.getByRole("button", { name: "In popover", hidden: true });
    // Stands in for the popover's close watcher, which closes it after the dispatch, before
    // the card decides on the late path: the decision must not find it closed.
    const watcher = (event: Event) => {
      event.stopPropagation();
      inner.hidePopover();
    };
    button.addEventListener("keydown", watcher);
    escape(button);
    button.removeEventListener("keydown", watcher);
    await flush();
    expect(isPopoverOpen(inner)).toBe(false);
    expect(isPopoverOpen(popup())).toBe(true);
    await escapeAt(button, true);
    expect(isPopoverOpen(popup())).toBe(false);
  });
});

describe("Keyboard and focus", () => {
  it("Tab from the Trigger into the open card keeps it open; Shift+Tab back keeps it open", async () => {
    await renderAsync(<Harness />);
    keyboardFocus(trigger());
    await advance(600);
    await task();
    const user = setupUser();
    await user.tab();
    expect(document.activeElement).toBe(follow());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(true);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(trigger());
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(true);
  });

  it("Tab out of the card's last element closes it after closeDelay", async () => {
    await renderAsync(<Harness />);
    keyboardFocus(trigger());
    await advance(600);
    await task();
    const user = setupUser();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    await advance(300);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("Tab before the delay passes cancels the open", async () => {
    await renderAsync(<Harness />);
    keyboardFocus(trigger());
    await advance(300);
    keyboardFocus(screen.getByRole("button", { name: "After" }));
    await advance(1000);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("a card opened by keyboard focus closes when the pointer crosses it and leaves (latest event wins)", async () => {
    await renderAsync(<Harness />);
    keyboardFocus(trigger());
    await advance(600);
    await task();
    pointer("pointerenter", popup());
    pointer("pointerleave", popup());
    await advance(300);
    expect(isPopoverOpen(popup())).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });
});

describe("Controlled", () => {
  function Controlled({
    refuseClose = false,
    refuseOpen = false,
  }: {
    refuseClose?: boolean;
    refuseOpen?: boolean;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Harness
          root={{
            open,
            openChangeAction: (next) => {
              if (!(next && refuseOpen)) setOpen(next);
            },
            onOpenChange: (next) => {
              if (!refuseClose) setOpen(next);
            },
          }}
        />
        <output data-testid="committed">{String(open)}</output>
      </>
    );
  }

  it("adopts opens from the action and closes from onOpenChange", async () => {
    await renderAsync(<Controlled />);
    await hoverOpen();
    expect(screen.getByTestId("committed")).toHaveTextContent("true");
    expect(isPopoverOpen(popup())).toBe(true);
    escape(document.body);
    await task();
    expect(screen.getByTestId("committed")).toHaveTextContent("false");
    expect(content()).toBeNull();
  });

  it("a refused close re-shows the card without moving focus", async () => {
    await renderAsync(<Controlled refuseClose />);
    await hoverOpen();
    const before = screen.getByRole("button", { name: "Before" });
    act(() => before.focus());
    pointer("pointerleave", trigger());
    await advance(300);
    expect(isPopoverOpen(popup())).toBe(false);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
    expect(document.activeElement).toBe(before);
  });

  it("a vetoed open snaps data-open back and shows nothing", async () => {
    await renderAsync(<Controlled refuseOpen />);
    await hoverOpen();
    expect(trigger()).not.toHaveAttribute("data-open");
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("open={true} shows the card without interest, also when disabled", async () => {
    await renderAsync(<Harness root={{ open: true, onOpenChange: () => {}, disabled: true }} />);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
    expect(content()).not.toBeNull();
  });

  it("defaultOpen shows after mount; Escape closes it", async () => {
    await renderAsync(<Harness root={{ defaultOpen: true }} />);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
    escape(document.body);
    expect(isPopoverOpen(popup())).toBe(false);
  });
});

describe("Flagged path (experimental_interestFor)", () => {
  /** jsdom has no Interest Invokers: give anchors `interestForElement` for the test. */
  function defineInterestFor(): void {
    Object.defineProperty(HTMLAnchorElement.prototype, "interestForElement", {
      configurable: true,
      get() {
        return null;
      },
    });
    onTestFinished(() => {
      delete (HTMLAnchorElement.prototype as { interestForElement?: unknown }).interestForElement;
    });
  }

  it("writes interestfor after mount (never in the server HTML) and the inline delays", () => {
    const html = renderToString(<Harness trigger={{ experimental_interestFor: true }} />);
    expect(html).not.toContain("interestfor");
    expect(html).toContain("interest-delay-start:600ms");
    expect(html).toContain("interest-delay-end:300ms");
    render(<Harness trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).toHaveAttribute("interestfor", popup().id);
  });

  it("disabled removes interestfor", () => {
    const { rerender } = render(<Harness trigger={{ experimental_interestFor: true }} />);
    rerender(<Harness root={{ disabled: true }} trigger={{ experimental_interestFor: true }} />);
    expect(trigger()).not.toHaveAttribute("interestfor");
  });

  it("where the element implements interestForElement, the JS hover path is off and the interest show is routed", async () => {
    defineInterestFor();
    const action = vi.fn<(next: boolean, details: Details) => void>();
    const onOpenChange = vi.fn<(next: boolean, details: Details) => void>();
    await renderAsync(
      <Harness
        root={{ openChangeAction: action, onOpenChange }}
        trigger={{ experimental_interestFor: true }}
      />,
    );
    pointer("pointerenter", trigger());
    await advance(1000);
    expect(action).not.toHaveBeenCalled();
    act(() => gainInterest(popup(), trigger()));
    await task();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].reason).toBe("activate");
    expect(action.mock.calls[0]?.[1].event?.type).toBe("beforetoggle");
    expect(isPopoverOpen(popup())).toBe(true);
    // Lost interest: the library hides it a task later, as a dismissal.
    const lose = (() => {
      let event!: Event;
      act(() => {
        event = dispatchLoseInterest(popup(), trigger());
      });
      return event;
    })();
    await task();
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
    expect(onOpenChange.mock.calls[0]?.[1].event).toBe(lose);
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
  });

  it("after a press on the Trigger, an interest show is cancelled and dispatches nothing", async () => {
    defineInterestFor();
    const action = vi.fn();
    await renderAsync(
      <Harness root={{ openChangeAction: action }} trigger={{ experimental_interestFor: true }} />,
    );
    pointer("pointerdown", trigger());
    act(() => gainInterest(popup(), trigger()));
    await task();
    expect(action).not.toHaveBeenCalled();
    expect(isPopoverOpen(popup())).toBe(false);
    // Fresh interest: the pointer leaves and returns.
    pointer("pointerleave", trigger());
    act(() => gainInterest(popup(), trigger()));
    await task();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("Escape with focus inside: the focus return's interest is cancelled", async () => {
    defineInterestFor();
    const action = vi.fn();
    await renderAsync(
      <Harness root={{ openChangeAction: action }} trigger={{ experimental_interestFor: true }} />,
    );
    act(() => gainInterest(popup(), trigger()));
    await task();
    act(() => follow().focus());
    escape(follow());
    expect(document.activeElement).toBe(trigger());
    act(() => gainInterest(popup(), trigger()));
    await task();
    expect(action).toHaveBeenCalledTimes(1);
    expect(isPopoverOpen(popup())).toBe(false);
  });

  it("the lost-interest hide blurs focus inside the card first; the link is not focused", async () => {
    defineInterestFor();
    const blurred: EventTarget[] = [];
    await renderAsync(<Harness trigger={{ experimental_interestFor: true }} />);
    act(() => gainInterest(popup(), trigger()));
    await task();
    const button = follow();
    act(() => button.focus());
    button.addEventListener("blur", (event) => {
      // Blurred while the card is still shown: before the hide, not by its focus fixup.
      if (isPopoverOpen(popup())) blurred.push(event.target!);
    });
    act(() => {
      dispatchLoseInterest(popup(), trigger());
    });
    await task();
    await task();
    expect(isPopoverOpen(popup())).toBe(false);
    expect(blurred).toEqual([button]);
    expect(document.activeElement).toBe(document.body);
  });

  it("Escape and a press outside work right after a routed interest open, before its commit", async () => {
    defineInterestFor();
    const d = deferred();
    const action = vi.fn<(next: boolean, details: Details) => unknown>(() => d.promise);
    await renderAsync(
      <Harness root={{ openChangeAction: action }} trigger={{ experimental_interestFor: true }} />,
    );
    let key!: KeyboardEvent;
    act(() => {
      gainInterest(popup(), trigger());
      key = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      document.body.dispatchEvent(key);
    });
    await flush();
    expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
    expect(action.mock.calls[1]?.[1].event).toBe(key);
  });

  it("a script showPopover() is routed even while suppressed (not the Trigger's interest)", async () => {
    defineInterestFor();
    const action = vi.fn();
    await renderAsync(
      <Harness root={{ openChangeAction: action }} trigger={{ experimental_interestFor: true }} />,
    );
    pointer("pointerdown", trigger());
    act(() => popup().showPopover());
    await task();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("a render element without interestForElement keeps the JS path under the flag", async () => {
    defineInterestFor();
    await renderAsync(
      <Harness
        trigger={{ experimental_interestFor: true, render: <span tabIndex={0} role="link" /> }}
      />,
    );
    pointer("pointerenter", trigger());
    await advance(600);
    await task();
    expect(isPopoverOpen(popup())).toBe(true);
  });
});

describe("keepMounted and server rendering", () => {
  it("keepMounted keeps the content in a hidden Activity while closed", async () => {
    await renderAsync(<Harness popup={{ keepMounted: true }} />);
    expect(content()).not.toBeNull();
    await hoverOpen();
    expect(content()).toBeVisible();
  });

  it("server HTML: the closed card, no content, no ARIA relation", () => {
    const html = renderToString(<Harness />);
    expect(html).toContain('popover="manual"');
    expect(html).toContain('role="group"');
    expect(html).not.toContain("Ada Lovelace");
    expect(html).not.toContain("aria-");
  });
});
