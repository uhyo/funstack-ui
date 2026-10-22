// Popover tests (jsdom), mapped to design/components/popover.md section 13.2. jsdom has no Popover
// API and no Invoker Commands; `src/__tests__/popover-shim.ts` and `invoker-shim.ts` provide them
// (13.1): a synchronous `beforetoggle` (cancelable for an open), a task-queued `toggle`,
// `:popover-open`, the recorded `source`, and invoker clicks for `show-popover` / `hide-popover` /
// `toggle-popover`.
//
// Not testable here, covered by `popover.browser.test.tsx` (conventions 10.1):
// - Escape and light dismiss (no close watcher in jsdom): the dismiss path is driven with
//   `hidePopover()`, which is what the platform does for them.
// - Top layer, anchoring and `position-try-fallbacks`, the platform's focusing steps and focus
//   return, nesting and stacking, exit animations (`getAnimations()` is `[]`, so the hold for a
//   CSS fade is a browser test) and ViewTransition (`transition` is smoke-tested only).
//
// N/A rows: none of conventions 10.1 is N/A in library mode. JS-free mode has no action state, so
// its sync/async/rejection/overlap/parity rows do not apply (it is covered by the ARIA, platform
// path, function props and Close rows). For the Close part's own `action`, Overlap and Superseded
// rejection are N/A: the re-entry guard means a Close never has two of its own runs in flight
// (#79, #81); the Close rows P1-P4 (design/components/button.md 16.4) replace them.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useRef, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../__tests__/invoker-shim.js";
import { popoverSource } from "../__tests__/popover-shim.js";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Popover } from "./index.js";
import type {
  PopoverCloseProps,
  PopoverCloseState,
  PopoverOpenChangeDetails,
  PopoverPopupProps,
  PopoverPopupState,
  PopoverRootState,
  PopoverTriggerProps,
  PopoverTriggerState,
} from "./index.js";

type ActionFn = (next: boolean, details: PopoverOpenChangeDetails) => unknown;
type Mode = ControlMode | "static";

interface HarnessProps {
  mode: Mode;
  /** Initial committed open state. */
  initialOpen?: boolean;
  /** The consumer's work, awaited by the harness's `openChangeAction`. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Controlled mode: never adopt `false` (a parent that refuses to close). */
  refuseClose?: boolean;
  /** Controlled mode: never adopt `true` (a parent that vetoes the open). */
  refuseOpen?: boolean;
  /** Wrap the Root in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Wrap everything in a Suspense boundary (above the Root). */
  suspense?: boolean;
  trigger?: Partial<PopoverTriggerProps> | false;
  popup?: Partial<PopoverPopupProps>;
  close?: Partial<PopoverCloseProps>;
  /** Popup content; default: a span and a Close button. */
  content?: ReactNode;
  /** Rendered next to the Root (for controlled tests that flip `open` from outside). */
  outside?: (setOpen: (open: boolean) => void) => ReactNode;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows "update on success"
 * (`startTransition` after the await, design 2.2).
 */
function Harness({
  mode,
  initialOpen = false,
  action,
  catchErrors = false,
  refuseClose = false,
  refuseOpen = false,
  boundary,
  suspense = false,
  trigger,
  popup,
  close,
  content,
  outside,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);

  const openChangeAction = async (next: boolean, details: PopoverOpenChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (error) {
      if (!catchErrors) throw error;
      return;
    }
    if ((next && refuseOpen) || (!next && refuseClose)) return;
    startTransition(() => setOpen(next));
  };

  const rootProps =
    mode === "static"
      ? {}
      : mode === "controlled"
        ? { open, openChangeAction }
        : { defaultOpen: initialOpen, openChangeAction };

  let popover: ReactNode = (
    <Popover.Root {...rootProps}>
      {trigger !== false && (
        <Popover.Trigger data-testid="trigger" {...trigger}>
          Filters
        </Popover.Trigger>
      )}
      <Popover.Popup data-testid="popup" {...popup}>
        <Popover.Title data-testid="title">Filters</Popover.Title>
        <Popover.Description data-testid="description">Narrow the list.</Popover.Description>
        {content ?? (
          <>
            <span data-testid="content">content</span>
            <Popover.Close data-testid="close" {...close}>
              Done
            </Popover.Close>
          </>
        )}
      </Popover.Popup>
    </Popover.Root>
  );
  if (boundary) popover = <ErrorCatcher onError={boundary}>{popover}</ErrorCatcher>;

  const body = (
    <>
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {popover}
      {outside?.((next) => startTransition(() => setOpen(next)))}
      <output data-testid="committed">{String(open)}</output>
    </>
  );
  return suspense ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{body}</Suspense>
  ) : (
    body
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const content = () => screen.queryByTestId("content");
const committedText = () => screen.getByTestId("committed").textContent;
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

/** Runs the tasks the shim queued (`toggle`) and React's work after them. */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function spyShow() {
  return vi.spyOn(HTMLElement.prototype, "showPopover");
}
function spyHide() {
  return vi.spyOn(HTMLElement.prototype, "hidePopover");
}
function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

/** `defaultPrevented` of every click once it bubbled past React's root listener. */
function recordClicks(): { seen: boolean[]; stop: () => void } {
  const seen: boolean[] = [];
  const listener = (event: Event) => seen.push(event.defaultPrevented);
  document.addEventListener("click", listener);
  return { seen, stop: () => document.removeEventListener("click", listener) };
}

/** Opens a library-mode popover through the Trigger and waits for it to be shown. */
async function openThroughTrigger(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flush();
  expect(isOpen()).toBe(true);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

describe("Popover", () => {
  describe("roles and ARIA", () => {
    it("renders the documented elements and wires the ids (JS-free mode)", () => {
      render(<Harness mode="static" />);
      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("command", "toggle-popover");
      expect(t).toHaveAttribute("aria-expanded", "false");
      expect(t).not.toHaveAttribute("aria-haspopup");
      expect(t).not.toHaveAttribute("aria-controls");
      const id = t.getAttribute("commandfor");
      expect(id).toBeTruthy();
      const p = popup();
      expect(p.tagName).toBe("DIALOG");
      expect(p.id).toBe(id);
      expect(p).toHaveAttribute("popover", "auto");
      expect(p).toHaveAttribute("role", "dialog");
      expect(p).toHaveAttribute("aria-modal", "false");
      expect(p).toHaveAttribute("data-side", "bottom");
      expect(p).toHaveAttribute("data-align", "center");
      expect(p).not.toHaveAttribute("open");
      expect(p).not.toHaveAttribute("data-open");
      expect(p.style.getPropertyValue("position-area")).toBe("bottom");
      expect(p.style.getPropertyValue("position-try-fallbacks")).toBe(
        "flip-block, flip-inline, flip-block flip-inline",
      );
      const title = screen.getByTestId("title");
      const description = screen.getByTestId("description");
      expect(title.tagName).toBe("H2");
      expect(description.tagName).toBe("P");
      expect(p.getAttribute("aria-labelledby")).toBe(title.id);
      expect(p.getAttribute("aria-describedby")).toBe(description.id);
      const close = screen.getByTestId("close");
      expect(close).toHaveAttribute("type", "button");
      expect(close).toHaveAttribute("commandfor", id);
      expect(close).toHaveAttribute("command", "hide-popover");
      // The content is always mounted in JS-free mode.
      expect(content()).toBeInTheDocument();
    });

    it("renders the same markup in library mode, minus the content", () => {
      render(<Harness mode="uncontrolled" />);
      expect(trigger()).toHaveAttribute("command", "toggle-popover");
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(popup()).toHaveAttribute("popover", "auto");
      expect(popup()).toHaveAttribute("aria-modal", "false");
      expect(content()).toBeNull();
    });

    it("names and describes the popup by its Title and Description", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      expect(screen.getByRole("dialog", { name: "Filters" })).toBe(popup());
      expect(popup()).toHaveAccessibleDescription("Narrow the list.");
    });

    it("token-merges the consumer's aria-describedby / aria-labelledby", () => {
      render(
        <Harness
          mode="static"
          popup={{ "aria-describedby": "extra", "aria-labelledby": "label" }}
        />,
      );
      expect(popup().getAttribute("aria-describedby")).toBe(
        `extra ${screen.getByTestId("description").id}`,
      );
      expect(popup().getAttribute("aria-labelledby")).toBe(
        `label ${screen.getByTestId("title").id}`,
      );
    });

    it("a consumer role wins over the default; aria-haspopup and aria-controls pass through", () => {
      render(
        <Harness
          mode="static"
          popup={{ role: "region" }}
          trigger={{ "aria-haspopup": "dialog", "aria-controls": "x" }}
        />,
      );
      expect(popup()).toHaveAttribute("role", "region");
      expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
      expect(trigger()).toHaveAttribute("aria-controls", "x");
    });

    it("render={<div />} keeps role, aria-modal, popover and the ids", () => {
      render(<Harness mode="static" popup={{ render: <div /> }} />);
      const p = popup();
      expect(p.tagName).toBe("DIV");
      expect(p).toHaveAttribute("role", "dialog");
      expect(p).toHaveAttribute("aria-modal", "false");
      expect(p).toHaveAttribute("popover", "auto");
      expect(p.id).toBe(trigger().getAttribute("commandfor"));
      expect(p.getAttribute("aria-labelledby")).toBe(screen.getByTestId("title").id);
    });

    it("never renders `open`, also with defaultOpen (server HTML) or a render element", () => {
      const html = renderToString(
        <Popover.Root defaultOpen>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Popup render={<dialog open />} aria-label="x">
            content
          </Popover.Popup>
        </Popover.Root>,
      );
      expect(html).not.toMatch(/<dialog[^>]*\sopen[\s=>]/);
      expect(html).toContain('popover="auto"');
      // Library mode, closed: the content is not in the server HTML.
      const closed = renderToString(
        <Popover.Root defaultOpen={false}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Popup aria-label="x">secret content</Popover.Popup>
        </Popover.Root>,
      );
      expect(closed).not.toContain("secret content");
    });

    it("never lets a render element override the owned keys", () => {
      render(
        <Harness
          mode="uncontrolled"
          trigger={{
            render: (
              <button
                type="submit"
                commandfor="other"
                command="show-popover"
                aria-expanded="true"
                data-open=""
              />
            ),
          }}
          popup={{
            render: <dialog id="other" popover="manual" aria-modal="true" />,
          }}
        />,
      );
      expect(trigger()).toHaveAttribute("type", "button");
      expect(trigger()).toHaveAttribute("command", "toggle-popover");
      expect(trigger().getAttribute("commandfor")).toBe(popup().id);
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(popup().id).not.toBe("other");
      expect(popup()).toHaveAttribute("popover", "auto");
      expect(popup()).toHaveAttribute("aria-modal", "false");
    });
  });

  describe("JS-free mode", () => {
    it("the Trigger's command opens and closes the popup; Close hides it", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      expect(isOpen()).toBe(true);
      await user.click(trigger());
      expect(isOpen()).toBe(false);
      await user.click(trigger());
      expect(isOpen()).toBe(true);
      await user.click(screen.getByTestId("close"));
      expect(isOpen()).toBe(false);
    });

    it("the command runs with the Trigger as source (the implicit anchor)", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      expect(popoverSource(popup())).toBe(trigger());
    });

    it("a disabled Trigger never opens", async () => {
      const user = setupUser();
      render(<Harness mode="static" trigger={{ disabled: true }} />);
      await user.click(trigger());
      fireEvent.click(trigger());
      expect(isOpen()).toBe(false);
      expect(trigger()).toBeDisabled();
      // `data-disabled` is library mode only.
      expect(trigger()).not.toHaveAttribute("data-disabled");
    });

    it("keeps aria-expanded current on the Trigger element without a React render", async () => {
      const user = setupUser();
      let renders = 0;
      render(
        <Popover.Root>
          {() => {
            renders++;
            return (
              <>
                <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
                <Popover.Popup data-testid="popup" aria-label="x">
                  <button type="button">Inside</button>
                </Popover.Popup>
              </>
            );
          }}
        </Popover.Root>,
      );
      await flush();
      const before = renders;
      await user.click(trigger());
      await flush();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      await act(async () => popup().hidePopover());
      await flush();
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      // A foreign open (script) is followed too.
      await act(async () => popup().showPopover());
      await flush();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(renders).toBe(before);
    });
  });

  describe("keyboard", () => {
    it("Enter and Space on the Trigger toggle through the library", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      trigger().focus();
      await user.keyboard("{Enter}");
      await flush();
      expect(action).toHaveBeenLastCalledWith(true, expect.anything());
      expect(isOpen()).toBe(true);
      // Focus moved into the popup on open; back to the Trigger for the next key.
      trigger().focus();
      await user.keyboard(" ");
      await flush();
      expect(action).toHaveBeenLastCalledWith(false, expect.anything());
      expect(isOpen()).toBe(false);
    });

    it("Enter on the Trigger runs the native command in JS-free mode", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      trigger().focus();
      await user.keyboard("{Enter}");
      expect(isOpen()).toBe(true);
    });
  });

  renderBoth("sync action", (mode) => {
    it("a Trigger click dispatches (true, details) with the native click, cancelled", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event!.type).toBe("click");
      // The command was cancelled: the library opens the popover, not the browser.
      expect(details.event!.defaultPrevented).toBe(true);
      // `details` is serialisable; `event` is virtual (conventions 2.2).
      expect(Object.keys(details)).toEqual(["reason"]);
      await flush();
      expect(isOpen()).toBe(true);
      expect(committedText()).toBe("true");
    });

    it("a click while open dispatches (false, 'activate'): a library-owned close", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("click");
      expect(details.event!.defaultPrevented).toBe(true);
      await flush();
      expect(isOpen()).toBe(false);
      expect(committedText()).toBe("false");
      // The library's own hide echoes back through `toggle` without a second dispatch.
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("a disabled Trigger never dispatches", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} trigger={{ disabled: true }} />);
      await user.click(trigger());
      fireEvent.click(trigger());
      await flush();
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(trigger()).toHaveAttribute("data-disabled", "");
    });

    it("a foreign open (script showPopover) is cancelled at beforetoggle and dispatched", async () => {
      const action = vi.fn<ActionFn>();
      const showPopover = spyShow();
      render(<Harness mode={mode} action={action} />);
      let before!: Event;
      popup().addEventListener("beforetoggle", (event) => (before = event), { once: true });
      await act(async () => popup().showPopover());
      expect(before.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.event).toBe(before);
      await flush();
      expect(isOpen()).toBe(true);
      // The test's call and the library's own (with the Trigger as source).
      expect(showPopover).toHaveBeenCalledTimes(2);
      expect(showPopover).toHaveBeenLastCalledWith({ source: trigger() });
    });

    it("a foreign show-popover invoker is routed through the library", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const foreign = screen.getByTestId("elsewhere");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "show-popover");
      await user.click(foreign);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![1].event!.type).toBe("beforetoggle");
      await flush();
      expect(isOpen()).toBe(true);
      expect(popoverSource(popup())).toBe(trigger());
    });

    it("a foreign hide-popover invoker records an 'activate' intent the toggle consumes", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const foreign = screen.getByTestId("elsewhere");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "hide-popover");
      await user.click(foreign);
      await flush();
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("command");
    });
  });

  renderBoth("async action", (mode) => {
    it("open: pending Trigger, popup hidden and content unmounted until it resolves", async () => {
      const user = setupUser();
      const showPopover = spyShow();
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(trigger()).toHaveAttribute("data-open", "");
      expectPending(trigger());
      expect(showPopover).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(content()).toBeNull();
      await act(async () => d.resolve());
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(showPopover).toHaveBeenCalledWith({ source: trigger() });
      expect(isOpen()).toBe(true);
      expect(content()).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(trigger()).toHaveAttribute("data-open", "");
      expectNotPending(trigger());
    });

    it("part-initiated close: the popup stays open while pending, hides on resolve", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const hidePopover = spyHide();
      const d = deferred();
      action.mockImplementation(() => d.promise);
      await user.click(trigger());
      await flush();
      expect(isOpen()).toBe(true);
      expect(content()).toBeInTheDocument();
      expectPending(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(hidePopover).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      expectNotPending(trigger());
      await flush();
      expect(content()).toBeNull();
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("dismissal: notified as (false, 'dismiss') with the toggle event; pending meanwhile", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const d = deferred();
      action.mockImplementation(() => d.promise);
      // What Escape or a click outside does: the browser hides the popover.
      await act(async () => popup().hidePopover());
      expect(isOpen()).toBe(false);
      await flush();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event!.type).toBe("toggle");
      expectPending(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(content()).toBeInTheDocument(); // committed is still true
      await act(async () => d.resolve());
      await flush();
      expectNotPending(trigger());
      expect(content()).toBeNull();
      expect(committedText()).toBe("false");
      expect(isOpen()).toBe(false);
    });

    it("a commit between the native hide and its `toggle` event does not re-open", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const { rerender } = render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const showPopover = spyShow();
      await act(async () => {
        popup().hidePopover();
        // A re-render of the Root lands before the queued `toggle` event.
        rerender(<Harness mode={mode} action={action} popup={{ className: "re-rendered" }} />);
      });
      expect(popup()).toHaveClass("re-rendered");
      expect(isOpen()).toBe(false);
      await flush();
      expect(showPopover).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenLastCalledWith(false, expect.anything());
    });
  });

  renderBoth("rejection", (mode) => {
    it("open rejects: the boundary gets it, the popup never opened, no data-open", async () => {
      const user = setupUser();
      silenceErrors();
      const showPopover = spyShow();
      const d = deferred();
      const caught = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={caught} />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      await act(async () => d.reject(new Error("nope")));
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "nope" }));
      expect(showPopover).not.toHaveBeenCalled();
      expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
    });

    it("open rejects, caught inside: resolves and commits (uncontrolled opens)", async () => {
      const user = setupUser();
      render(
        <Harness
          mode={mode}
          catchErrors
          action={async () => {
            throw new Error("handled");
          }}
        />,
      );
      await user.click(trigger());
      await flush();
      // A swallowed error is success: uncontrolled commits; the controlled harness returns early
      // (does not adopt) so it stays closed.
      expect(isOpen()).toBe(mode === "uncontrolled");
      if (mode === "uncontrolled") expect(trigger()).toHaveAttribute("data-open", "");
      else expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("part-initiated close rejects: the boundary gets it, the library never hid the popup", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} boundary={caught} />);
      await openThroughTrigger(user);
      const hidePopover = spyHide();
      const d = deferred();
      action.mockImplementation(() => d.promise);
      await user.click(trigger());
      expect(isOpen()).toBe(true);
      await act(async () => d.reject(new Error("save failed")));
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
      expect(hidePopover).not.toHaveBeenCalled();
      // The boundary replaced the component; removing the popover hid it.
      expect(screen.queryByTestId("popup")).toBeNull();
    });

    it("part-initiated close rejects, caught inside: uncontrolled closes, controlled stays", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} catchErrors />);
      await openThroughTrigger(user);
      action.mockImplementation(async () => {
        throw new Error("handled");
      });
      await user.click(trigger());
      await flush();
      expect(isOpen()).toBe(mode === "controlled");
    });

    it("dismissal notification rejects: the boundary gets it (the popup was already hidden)", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} boundary={caught} />);
      await openThroughTrigger(user);
      action.mockImplementation(async () => {
        throw new Error("save failed");
      });
      await act(async () => popup().hidePopover());
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
    });
  });

  describe("controlled refusal and veto", () => {
    it("a refused dismissal re-opens the popup once the notification settles; not a veto", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} refuseClose />);
      await openThroughTrigger(user);
      const showPopover = spyShow();
      action.mockImplementation(() => d.promise);
      await act(async () => popup().hidePopover());
      expect(isOpen()).toBe(false);
      await flush();
      expectPending(trigger());
      expect(showPopover).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
      expectNotPending(trigger());
    });

    it("a refused part-initiated close is a real veto: never hidden, data-open snaps back", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} refuseClose />);
      await openThroughTrigger(user);
      const hidePopover = spyHide();
      action.mockImplementation(() => d.promise);
      await user.click(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
      await act(async () => d.resolve());
      await flush();
      expect(hidePopover).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(content()).toBeInTheDocument();
    });

    it("a vetoed open snaps back and the popup never opens", async () => {
      const user = setupUser();
      const showPopover = spyShow();
      const d = deferred();
      render(<Harness mode="controlled" action={() => d.promise} refuseOpen />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      await act(async () => d.resolve());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(showPopover).not.toHaveBeenCalled();
    });
  });

  describe("overlap", () => {
    renderBoth("second click during a pending open (walkthrough 11.7)", (mode) => {
      it("both actions run, the popup never opens, the latest intent wins", async () => {
        const user = setupUser();
        const showPopover = spyShow();
        const opening = deferred();
        const closing = deferred();
        const action = vi.fn<ActionFn>();
        action.mockImplementationOnce(() => opening.promise);
        action.mockImplementationOnce(() => closing.promise);
        render(<Harness mode={mode} action={action} />);
        await user.click(trigger());
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expectPending(trigger());
        // Out of order: the close first, then the superseded open.
        await act(async () => closing.resolve());
        await act(async () => opening.resolve());
        await flush();
        expectNotPending(trigger());
        if (mode === "uncontrolled") {
          expect(trigger()).toHaveAttribute("aria-expanded", "false");
          expect(showPopover).not.toHaveBeenCalled();
          expect(isOpen()).toBe(false);
        } else {
          // A controlled parent that adopts every resolution in arrival order ends with the
          // slower one (conventions 2.5); the DOM follows the parent.
          expect(committedText()).toBe("true");
          expect(isOpen()).toBe(true);
        }
      });
    });

    renderBoth("dismissal during a pending part-initiated close (walkthrough 11.8)", (mode) => {
      it("dispatches nothing more; one openChangeAction(false)", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(2);
        await act(async () => popup().hidePopover());
        await flush();
        expect(action).toHaveBeenCalledTimes(2);
        const hidePopover = spyHide();
        await act(async () => d.resolve());
        await flush();
        expect(hidePopover).not.toHaveBeenCalled(); // already hidden
        expect(isOpen()).toBe(false);
        expect(content()).toBeNull();
      });
    });
  });

  renderBoth("superseded rejection", (mode) => {
    async function setup() {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const opening = deferred();
      const closing = deferred();
      const action = vi.fn<ActionFn>();
      action.mockImplementationOnce(() => opening.promise);
      action.mockImplementationOnce(() => closing.promise);
      render(<Harness mode={mode} action={action} boundary={caught} />);
      await user.click(trigger());
      await user.click(trigger());
      return { caught, opening, closing };
    }

    it("the older dispatch rejects after the newer resolved: the boundary gets it", async () => {
      const { caught, opening, closing } = await setup();
      await act(async () => closing.resolve());
      await act(async () => opening.reject(new Error("older")));
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
    });

    it("the older dispatch rejects while the newer is pending: the boundary gets it", async () => {
      const { caught, opening, closing } = await setup();
      await act(async () => opening.reject(new Error("older")));
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
      await act(async () => closing.resolve());
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps the popup hidden and the Trigger pending until the content is ready", async () => {
      const user = setupUser();
      const showPopover = spyShow();
      const suspender = createSuspender();
      render(<Harness mode={mode} suspense content={<suspender.Suspender value="filters" />} />);
      await user.click(trigger());
      await flush();
      expect(showPopover).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expectPending(trigger());
      expect(screen.queryByTestId("fallback")).toBeNull();
      await act(async () => suspender.resolve("filters", "Colour, size"));
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      expect(screen.getByTestId("suspender")).toHaveTextContent("Colour, size");
      expectNotPending(trigger());
    });

    it("keepMounted: content is pre-rendered hidden inside <Activity>", async () => {
      const user = setupUser();
      const suspender = createSuspender();
      suspender.resolve("filters", "Ready");
      render(
        <Harness
          mode={mode}
          popup={{ keepMounted: true }}
          content={<suspender.Suspender value="filters" />}
        />,
      );
      await flush();
      const hidden = screen.getByTestId("suspender");
      expect(hidden).not.toBeVisible();
      await openThroughTrigger(user);
      expect(screen.getByTestId("suspender")).toBe(hidden); // same DOM node: state preserved
      expect(hidden).toBeVisible();
    });
  });

  describe("function props", () => {
    it("Root, Trigger, Popup, Title and Description receive their state (library mode)", async () => {
      const user = setupUser();
      const rootStates: PopoverRootState[] = [];
      const triggerStates: PopoverTriggerState[] = [];
      const popupStates: PopoverPopupState[] = [];
      const titleStates: PopoverPopupState[] = [];
      const d = deferred();
      render(
        <Popover.Root defaultOpen={false} openChangeAction={() => d.promise}>
          {(state) => {
            rootStates.push(state);
            return (
              <>
                <Popover.Trigger
                  data-testid="trigger"
                  className={(s) => {
                    triggerStates.push(s);
                    return s.open ? "trigger-open" : "trigger-closed";
                  }}
                  style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
                >
                  {(s) => (s.pending ? "Loading" : "Filters")}
                </Popover.Trigger>
                <Popover.Popup
                  data-testid="popup"
                  side="top"
                  align="end"
                  className={(s) => {
                    popupStates.push(s);
                    return `popup-${s.side}-${s.align}`;
                  }}
                >
                  {(s) => (
                    <Popover.Title
                      className={(t) => {
                        titleStates.push(t);
                        return t.open ? "title-open" : "title-closed";
                      }}
                    >
                      {`Filters ${String(s.open)}`}
                    </Popover.Title>
                  )}
                </Popover.Popup>
              </>
            );
          }}
        </Popover.Root>,
      );
      expect(rootStates.at(-1)).toEqual({ open: false, pending: false });
      expect(trigger()).toHaveClass("trigger-closed");
      expect(popup()).toHaveClass("popup-top-end");
      await user.click(trigger());
      expect(rootStates.at(-1)).toEqual({ open: true, pending: true });
      expect(triggerStates.at(-1)).toEqual({ open: true, pending: true, disabled: false });
      expect(trigger()).toHaveTextContent("Loading");
      expect(trigger()).toHaveStyle({ opacity: "0.5" });
      expect(popupStates.at(-1)).toEqual({ open: false, side: "top", align: "end" });
      await act(async () => d.resolve());
      expect(rootStates.at(-1)).toEqual({ open: true, pending: false });
      expect(popupStates.at(-1)).toEqual({ open: true, side: "top", align: "end" });
      expect(titleStates.at(-1)).toEqual({ open: true, side: "top", align: "end" });
      expect(screen.getByRole("heading")).toHaveTextContent("Filters true");
      expect(screen.getByRole("heading")).toHaveClass("title-open");
      expect(popup().style.getPropertyValue("position-area")).toBe("top span-left");
    });

    it("JS-free mode passes open: false and pending: false", () => {
      const rootStates: PopoverRootState[] = [];
      const triggerStates: PopoverTriggerState[] = [];
      const popupStates: PopoverPopupState[] = [];
      render(
        <Popover.Root>
          {(state) => {
            rootStates.push(state);
            return (
              <>
                <Popover.Trigger
                  className={(s) => {
                    triggerStates.push(s);
                    return undefined;
                  }}
                >
                  Open
                </Popover.Trigger>
                <Popover.Popup
                  aria-label="x"
                  className={(s) => {
                    popupStates.push(s);
                    return undefined;
                  }}
                />
              </>
            );
          }}
        </Popover.Root>,
      );
      expect(rootStates.at(-1)).toEqual({ open: false, pending: false });
      expect(triggerStates.at(-1)).toEqual({ open: false, pending: false, disabled: false });
      expect(popupStates.at(-1)).toEqual({ open: false, side: "bottom", align: "center" });
    });

    it("Close receives its state; render functions get the merged props", async () => {
      const user = setupUser();
      const closeStates: PopoverCloseState[] = [];
      const d = deferred();
      render(
        <Harness
          mode="uncontrolled"
          close={{
            action: () => d.promise,
            className: (s) => {
              closeStates.push(s);
              return s.pending ? "closing" : "idle";
            },
            render: (props, state) => (
              <button {...props} data-state={state.pending ? "pending" : "idle"} />
            ),
          }}
        />,
      );
      await openThroughTrigger(user);
      const close = screen.getByTestId("close");
      expect(close).toHaveAttribute("command", "hide-popover");
      expect(close).toHaveAttribute("data-state", "idle");
      await user.click(close);
      expect(closeStates.at(-1)).toEqual({ pending: true, disabled: false });
      expect(close).toHaveClass("closing");
      expect(close).toHaveAttribute("data-state", "pending");
      await act(async () => d.resolve());
      await flush();
      expect(isOpen()).toBe(false);
    });
  });

  describe("render element", () => {
    it("render={<div className />} keeps the library attributes and listeners", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          popup={{ render: <div className="card" />, className: "popover" }}
        />,
      );
      expect(popup().tagName).toBe("DIV");
      expect(popup()).toHaveClass("card", "popover");
      await openThroughTrigger(user);
      await act(async () => popup().hidePopover());
      await flush();
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });

    it("a link Trigger in library mode dispatches through the click and gets no type", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} trigger={{ render: <a href="#x" /> }} />);
      expect(trigger().tagName).toBe("A");
      expect(trigger()).not.toHaveAttribute("type");
      await user.click(trigger());
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      // A non-button is still passed as the source (anchoring and focus order).
      expect(popoverSource(popup())).toBe(trigger());
    });

    it("forwards refs", () => {
      let triggerElement: HTMLElement | null = null;
      let popupElement: HTMLElement | null = null;
      function App() {
        const triggerRef = useRef<HTMLButtonElement>(null);
        const popupRef = useRef<HTMLDialogElement>(null);
        return (
          <Popover.Root>
            <Popover.Trigger
              ref={(element) => {
                triggerRef.current = element;
                triggerElement = element;
              }}
            >
              Open
            </Popover.Trigger>
            <Popover.Popup
              aria-label="x"
              ref={(element) => {
                popupRef.current = element;
                popupElement = element;
              }}
            />
          </Popover.Root>
        );
      }
      render(<App />);
      expect(triggerElement).toBeInstanceOf(HTMLButtonElement);
      expect(popupElement).toBeInstanceOf(HTMLDialogElement);
    });

    it("warns for a non-button Trigger or Close without action in JS-free mode", () => {
      const error = silenceErrors();
      render(<Harness mode="static" trigger={{ render: <span /> }} close={{ render: <span /> }} />);
      const messages = error.mock.calls.map(([message]) => String(message));
      expect(messages.some((m) => m.includes("Popover.Trigger: rendered a <span>"))).toBe(true);
      expect(messages.some((m) => m.includes("Popover.Close: rendered a <span>"))).toBe(true);
    });

    it("warns when the Popup renders something other than a <dialog> or a <div>", () => {
      const error = silenceErrors();
      render(<Harness mode="static" popup={{ render: <section /> }} />);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Popover.Popup: expected to render a <dialog> or a <div>"),
      );
    });
  });

  describe("post-await rule", () => {
    it("a controlled parent that adopts after its own await works for an open and a close", async () => {
      const user = setupUser();
      const saved = vi.fn();
      function App() {
        const [open, setOpen] = useState(false);
        return (
          <Popover.Root
            open={open}
            openChangeAction={async (next) => {
              await Promise.resolve();
              saved(next);
              startTransition(() => setOpen(next));
            }}
          >
            <Popover.Trigger data-testid="trigger">Rename</Popover.Trigger>
            <Popover.Popup data-testid="popup" aria-label="Rename">
              <span data-testid="content">content</span>
            </Popover.Popup>
          </Popover.Root>
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      expect(content()).toBeInTheDocument();
      await user.click(trigger());
      await flush();
      expect(saved.mock.calls).toEqual([[true], [false]]);
      expect(isOpen()).toBe(false);
      expect(content()).toBeNull();
    });
  });

  describe("platform path", () => {
    async function hydrate(ui: ReactNode) {
      const container = document.createElement("div");
      container.innerHTML = renderToString(ui);
      document.body.append(container);
      // A click before hydration ran `toggle-popover` natively; its `toggle` task ran too.
      container.querySelector<HTMLElement>("[popover]")!.showPopover();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return render(ui, { container, hydrate: true });
    }

    renderBoth("pre-hydration open", (mode) => {
      it("one dispatch with reason 'platform' and no event; accepted: content mounts", async () => {
        const action = vi.fn<ActionFn>();
        const showPopover = spyShow();
        await act(async () => {
          await hydrate(<Harness mode={mode} action={action} />);
        });
        // The spy saw the native open of the setup; nothing after it.
        showPopover.mockClear();
        await flush();
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(content()).toBeInTheDocument();
        expect(isOpen()).toBe(true);
        expect(showPopover).not.toHaveBeenCalled();
        expect(trigger()).toHaveAttribute("aria-expanded", "true");
      });

      it("StrictMode still dispatches once", async () => {
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(
            <StrictMode>
              <Harness mode={mode} action={action} />
            </StrictMode>,
          );
        });
        await flush();
        expect(action).toHaveBeenCalledTimes(1);
      });
    });

    it("a controlled parent refusing the pre-hydration open hides it, with no notification", async () => {
      const hidePopover = spyHide();
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(<Harness mode="controlled" action={action} refuseOpen />);
      });
      await flush();
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("JS-free mode syncs aria-expanded for a pre-hydration open", async () => {
      await act(async () => {
        await hydrate(<Harness mode="static" />);
      });
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
    });

    it("a controlled `open` flipped programmatically calls showPopover / hidePopover, no echo dispatch", async () => {
      const showPopover = spyShow();
      const hidePopover = spyHide();
      const action = vi.fn<ActionFn>();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          action={action}
          trigger={false}
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await act(async () => setOpen(true));
      expect(showPopover).toHaveBeenCalledTimes(1);
      // No Trigger: no source, no implicit anchor (design 2.7).
      expect(showPopover).toHaveBeenCalledWith(undefined);
      expect(isOpen()).toBe(true);
      await act(async () => setOpen(false));
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      await flush();
      expect(action).not.toHaveBeenCalled();
      expect(content()).toBeNull();
    });

    it("defaultOpen opens after mount", async () => {
      const showPopover = spyShow();
      render(<Harness mode="uncontrolled" initialOpen />);
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      expect(content()).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Close part", () => {
    it("JS-free mode without action: a native hide-popover invoker, no handler", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      const close = screen.getByTestId("close");
      let event!: MouseEvent;
      close.addEventListener("click", (e) => (event = e));
      await user.click(close);
      expect(event.defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });

    it("library mode: the click is cancelled and dispatched as (false, 'activate')", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close"));
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("click");
      expect(details.event!.defaultPrevented).toBe(true);
      await flush();
      expect(isOpen()).toBe(false);
    });

    renderBoth("with action", (mode) => {
      it("data-pending while it runs, then the close is dispatched", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(<Harness mode={mode} action={action} close={{ action: closeAction }} />);
        await openThroughTrigger(user);
        const close = screen.getByTestId("close");
        await user.click(close);
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(closeAction.mock.calls[0]).toEqual([expect.anything()]);
        expectPending(close);
        expect(isOpen()).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        await act(async () => work.resolve());
        await flush();
        expectNotPending(close);
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![0]).toBe(false);
        expect(action.mock.calls[1]![1].reason).toBe("activate");
        expect(isOpen()).toBe(false);
      });

      it("dismissed and re-opened while the action runs: the stale close is dropped", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        render(<Harness mode={mode} action={action} close={{ action: () => work.promise }} />);
        await openThroughTrigger(user);
        await user.click(screen.getByTestId("close"));
        expectPending(screen.getByTestId("close"));
        // A dismissal, then the user opens the popover again.
        await act(async () => popup().hidePopover());
        await flush();
        expect(isOpen()).toBe(false);
        // The re-open is entangled with the Close's pending async transition (React batches
        // them), so it commits together with the action's end.
        await user.click(trigger());
        await act(async () => work.resolve());
        await flush();
        expect(isOpen()).toBe(true);
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
      });

      it("a rejection reaches the boundary inside the popup; the popup stays open", async () => {
        const user = setupUser();
        silenceErrors();
        const action = vi.fn<ActionFn>();
        const caught = vi.fn();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <ErrorCatcher onError={caught}>
                <Popover.Close
                  data-testid="close"
                  action={async () => {
                    throw new Error("archive failed");
                  }}
                >
                  Archive
                </Popover.Close>
              </ErrorCatcher>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByTestId("close"));
        await flush();
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "archive failed" }));
        expect(action).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
      });

      it("P3: a rejection reaches the boundary; after a reset the Close runs again", async () => {
        const user = setupUser();
        silenceErrors();
        const action = vi.fn<ActionFn>();
        const caught = vi.fn();
        const runs = [deferred(), deferred()];
        let call = 0;
        function Resettable() {
          const [key, setKey] = useState(0);
          return (
            <>
              <button type="button" data-testid="reset" onClick={() => setKey((k) => k + 1)} />
              <ErrorCatcher key={key} onError={caught}>
                <Popover.Close data-testid="close" action={() => runs[call++]!.promise}>
                  Archive
                </Popover.Close>
              </ErrorCatcher>
            </>
          );
        }
        render(<Harness mode={mode} action={action} content={<Resettable />} />);
        await openThroughTrigger(user);
        await user.click(screen.getByTestId("close"));
        await act(async () => runs[0]!.reject(new Error("first failed")));
        await flush();
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "first failed" }));
        expect(isOpen()).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("reset"));
        await user.click(screen.getByTestId("close"));
        expect(call).toBe(2);
        await act(async () => runs[1]!.resolve());
        await flush();
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
        expect(isOpen()).toBe(false);
      });

      it("P1: a second click, Enter and Space while pending are ignored and cancelled", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(<Harness mode={mode} action={action} close={{ action: closeAction }} />);
        await openThroughTrigger(user);
        const close = screen.getByTestId("close");
        expect(close).not.toHaveAttribute("aria-disabled");
        const clicks = recordClicks();
        try {
          await user.click(close);
          await user.click(close);
          close.focus();
          await user.keyboard("{Enter}");
          await user.keyboard(" ");
        } finally {
          clicks.stop();
        }
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(clicks.seen).toEqual([true, true, true, true]);
        expect(close).toHaveAttribute("aria-disabled", "true");
        expectPending(close);
        expect(close).not.toHaveAttribute("data-disabled");
        expect(close).not.toBeDisabled();
        expect(document.activeElement).toBe(close);
        await act(async () => work.resolve());
        await flush();
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
        expect(isOpen()).toBe(false);
        expect(close).not.toHaveAttribute("aria-disabled");
        expectNotPending(close);
      });

      it("P2: two clicks in one task call the action once", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(<Harness mode={mode} action={action} close={{ action: closeAction }} />);
        await openThroughTrigger(user);
        act(() => {
          fireEvent.click(screen.getByTestId("close"));
          fireEvent.click(screen.getByTestId("close"));
        });
        expect(closeAction).toHaveBeenCalledTimes(1);
        await act(async () => work.resolve());
        await flush();
        expect(action).toHaveBeenCalledTimes(2);
        expect(isOpen()).toBe(false);
      });
    });

    it("P1: JS-free mode with action, a second click while pending is ignored; one hidePopover()", async () => {
      const user = setupUser();
      const work = deferred();
      const closeAction = vi.fn(() => work.promise);
      render(<Harness mode="static" close={{ action: closeAction }} />);
      await user.click(trigger());
      const hidePopover = spyHide();
      const close = screen.getByTestId("close");
      const clicks = recordClicks();
      try {
        await user.click(close);
        await user.click(close);
        close.focus();
        await user.keyboard("{Enter}");
      } finally {
        clicks.stop();
      }
      expect(closeAction).toHaveBeenCalledTimes(1);
      expect(clicks.seen).toEqual([true, true, true]);
      expect(close).toHaveAttribute("aria-disabled", "true");
      expectPending(close);
      await act(async () => work.resolve());
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      expect(close).not.toHaveAttribute("aria-disabled");
    });

    it("P4: a render element's aria-disabled is removed while the Close is idle (owned)", () => {
      render(
        <Harness
          mode="static"
          close={{ action: () => {}, render: <button type="button" aria-disabled="true" /> }}
        />,
      );
      expect(screen.getByTestId("close")).not.toHaveAttribute("aria-disabled");
    });

    it("JS-free mode with action: hidePopover() after the action resolves", async () => {
      const user = setupUser();
      const work = deferred();
      render(<Harness mode="static" close={{ action: () => work.promise }} />);
      await user.click(trigger());
      const hidePopover = spyHide();
      await user.click(screen.getByTestId("close"));
      expect(isOpen()).toBe(true);
      expectPending(screen.getByTestId("close"));
      await act(async () => work.resolve());
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    });

    it("a disabled Close never runs its action or closes", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const closeAction = vi.fn();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          close={{ action: closeAction, disabled: true }}
        />,
      );
      await openThroughTrigger(user);
      fireEvent.click(screen.getByTestId("close"));
      await flush();
      expect(closeAction).not.toHaveBeenCalled();
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      expect(screen.getByTestId("close")).toHaveAttribute("data-disabled", "");
    });

    it("disabled is owned: a render element cannot re-enable Trigger or Close", () => {
      render(
        <Harness
          mode="static"
          trigger={{ disabled: true, render: <button disabled={false} /> }}
          close={{ disabled: true, render: <button disabled={false} /> }}
        />,
      );
      expect(trigger()).toBeDisabled();
      expect(screen.getByTestId("close")).toBeDisabled();
    });
  });

  describe("disabled on link and component renders (#83, design/components/button.md 17.3)", () => {
    function MyButton(props: ComponentPropsWithRef<"button">) {
      return <button {...props} />;
    }
    const renders = [
      ["a link", <a key="link" href="#x" />],
      ["a component", <MyButton key="component" />],
    ] as const;
    const cancelled = (el: Element) => !fireEvent.click(el);

    describe.each(renders)("%s render", (_, element) => {
      it("Close, library mode: aria-disabled, the click is cancelled, nothing closes", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            close={{ disabled: true, action: closeAction, render: element }}
          />,
        );
        await openThroughTrigger(user);
        const hide = spyHide();
        const close = screen.getByTestId("close");
        expect(close).toHaveAttribute("aria-disabled", "true");
        expect(close).not.toHaveAttribute("disabled");
        expect(close).toHaveAttribute("data-disabled", "");
        expect(cancelled(close)).toBe(true);
        await flush();
        expect(closeAction).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(1); // the open only
        expect(hide).not.toHaveBeenCalled();
        expect(isOpen()).toBe(true);
      });

      it("Close, JS-free mode with action: aria-disabled, cancelled, nothing hides", async () => {
        const user = setupUser();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="static"
            close={{ disabled: true, action: closeAction, render: element }}
          />,
        );
        await user.click(trigger());
        const hide = spyHide();
        expect(screen.getByTestId("close")).toHaveAttribute("aria-disabled", "true");
        expect(cancelled(screen.getByTestId("close"))).toBe(true);
        expect(closeAction).not.toHaveBeenCalled();
        expect(hide).not.toHaveBeenCalled();
      });

      it("Trigger, library mode: aria-disabled, the click is cancelled, no dispatch", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            trigger={{ disabled: true, render: element }}
          />,
        );
        expect(trigger()).toHaveAttribute("aria-disabled", "true");
        expect(trigger()).not.toHaveAttribute("disabled");
        expect(trigger()).toHaveAttribute("data-disabled", "");
        expect(cancelled(trigger())).toBe(true);
        await flush();
        expect(action).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
      });
    });

    it("JS-free mode with a component render: native disabled on Trigger and action-less Close", () => {
      render(
        <Harness
          mode="static"
          trigger={{ disabled: true, render: <MyButton /> }}
          close={{ disabled: true, render: <MyButton /> }}
        />,
      );
      for (const el of [trigger(), screen.getByTestId("close")]) {
        expect(el).toBeDisabled();
        expect(el).not.toHaveAttribute("aria-disabled");
      }
    });

    it("library mode, a host <button> render and no render: native disabled, no aria-disabled", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          trigger={{ disabled: true, render: <button type="button" /> }}
          close={{ disabled: true }}
        />,
      );
      await flush();
      for (const el of [trigger(), screen.getByTestId("close")]) {
        expect(el).toBeDisabled();
        expect(el).not.toHaveAttribute("aria-disabled");
      }
    });
  });

  describe("focus", () => {
    it("initialFocus (ref): autofocus is on the target while showPopover runs, removed after", async () => {
      const user = setupUser();
      let autofocusDuringShow: boolean | undefined;
      const show = HTMLElement.prototype.showPopover;
      vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
        this: HTMLElement,
        options,
      ) {
        autofocusDuringShow = screen.getByTestId("target").hasAttribute("autofocus");
        show.call(this, options);
      });
      function App() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <Harness
            mode="uncontrolled"
            popup={{ initialFocus: ref }}
            content={
              <>
                <button type="button">First</button>
                <input ref={ref} data-testid="target" />
              </>
            }
          />
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      expect(autofocusDuringShow).toBe(true);
      expect(screen.getByTestId("target")).not.toHaveAttribute("autofocus");
    });

    it("initialFocus (selector) resolves inside the popup", async () => {
      const user = setupUser();
      let target: Element | null = null;
      const show = HTMLElement.prototype.showPopover;
      vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
        this: HTMLElement,
        options,
      ) {
        target = this.querySelector("[autofocus]");
        show.call(this, options);
      });
      render(
        <Harness
          mode="uncontrolled"
          popup={{ initialFocus: "[name=query]" }}
          content={
            <>
              <button type="button">First</button>
              <input name="query" />
            </>
          }
        />,
      );
      await openThroughTrigger(user);
      expect(target).toHaveAttribute("name", "query");
    });

    it("initialFocus in JS-free mode: autofocus is written after mount for the native open", async () => {
      render(
        <Harness
          mode="static"
          popup={{ initialFocus: "[name=query]" }}
          content={<input name="query" />}
        />,
      );
      await flush();
      expect(screen.getByRole("textbox", { hidden: true })).toHaveAttribute("autofocus");
    });

    describe("focus on open (the platform's focusing steps, emulated by the shim)", () => {
      it("a <dialog> popup: the first sequentially focusable descendant", async () => {
        const user = setupUser();
        render(
          <Harness
            mode="uncontrolled"
            content={
              <>
                <h3 tabIndex={-1}>Heading</h3>
                <button type="button" disabled>
                  Disabled
                </button>
                <input data-testid="first" />
              </>
            }
          />,
        );
        await openThroughTrigger(user);
        expect(screen.getByTestId("first")).toHaveFocus();
      });

      it("the initialFocus target", async () => {
        const user = setupUser();
        render(
          <Harness
            mode="uncontrolled"
            popup={{ initialFocus: "[data-initial]" }}
            content={
              <>
                <button type="button">First</button>
                <h3 tabIndex={-1} data-initial="">
                  Heading
                </h3>
              </>
            }
          />,
        );
        await openThroughTrigger(user);
        expect(screen.getByRole("heading", { level: 3 })).toHaveFocus();
      });

      it("the popup itself when nothing inside is focusable", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" content={<p>Read only</p>} />);
        await openThroughTrigger(user);
        expect(popup()).toHaveFocus();
        // Nothing written by the library (the old 6.1 fallback left `tabindex="-1"` behind).
        expect(popup()).not.toHaveAttribute("tabindex");
      });

      it("a <div> popup leaves focus on the Trigger", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ render: <div /> }} />);
        await openThroughTrigger(user);
        expect(trigger()).toHaveFocus();
      });
    });

    it("initialFocus that resolves to nothing warns", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(<Harness mode="uncontrolled" popup={{ initialFocus: "[name=missing]" }} />);
      await openThroughTrigger(user);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Popover.Popup: `initialFocus` resolved to no element"),
      );
    });

    renderBoth("focus return (design 6.2)", (mode) => {
      it("focus inside the hidden popup goes back to the Trigger (nested: the platform does not)", async () => {
        const user = setupUser();
        render(<Harness mode={mode} />);
        await openThroughTrigger(user);
        screen.getByTestId("close").focus();
        // The shim leaves focus where it is, like the platform for a nested popover.
        await act(async () => popup().hidePopover());
        await flush();
        expect(trigger()).toHaveFocus();
      });

      it("focus outside the popup before the hide is left alone", async () => {
        const user = setupUser();
        render(<Harness mode={mode} />);
        await openThroughTrigger(user);
        screen.getByTestId("elsewhere").focus();
        await act(async () => popup().hidePopover());
        await flush();
        expect(screen.getByTestId("elsewhere")).toHaveFocus();
      });
    });

    describe("a library-driven close from inside the popup with transition (H1)", () => {
      // With `transition` the close commit unmounts the content (no hold), which drops focus on
      // <body> before `hidePopover()` runs; the platform then restores nothing.
      renderBoth("Close part", (mode) => {
        it.each([["pop"], ["none"]] as const)(
          'transition="%s": focus returns to the Trigger',
          async (transition) => {
            const user = setupUser();
            render(<Harness mode={mode} popup={{ transition }} />);
            await openThroughTrigger(user);
            screen.getByTestId("close").focus();
            await user.keyboard("{Enter}");
            await flush();
            expect(isOpen()).toBe(false);
            expect(content()).toBeNull();
            expect(trigger()).toHaveFocus();
          },
        );
      });

      it("a controlled open={false} from a submit inside the popup", async () => {
        const user = setupUser();
        let setOpen!: (open: boolean) => void;
        render(
          <Harness
            mode="controlled"
            popup={{ transition: "pop" }}
            content={<input data-testid="field" />}
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await openThroughTrigger(user);
        screen.getByTestId("field").focus();
        await act(async () => setOpen(false));
        await flush();
        expect(isOpen()).toBe(false);
        expect(trigger()).toHaveFocus();
      });

      it("focus outside the popup at close time is left alone", async () => {
        const user = setupUser();
        let setOpen!: (open: boolean) => void;
        render(
          <Harness
            mode="controlled"
            popup={{ transition: "pop" }}
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await openThroughTrigger(user);
        screen.getByTestId("elsewhere").focus();
        await act(async () => setOpen(false));
        await flush();
        expect(isOpen()).toBe(false);
        expect(screen.getByTestId("elsewhere")).toHaveFocus();
      });

      it("keepMounted: focus returns to the Trigger as well", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ transition: "pop", keepMounted: true }} />);
        await openThroughTrigger(user);
        screen.getByTestId("close").focus();
        await user.keyboard("{Enter}");
        await flush();
        expect(isOpen()).toBe(false);
        expect(trigger()).toHaveFocus();
      });
    });

    it("JS-free mode: the same fallback applies", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      screen.getByTestId("close").focus();
      await act(async () => popup().hidePopover());
      await flush();
      expect(trigger()).toHaveFocus();
    });

    it("without a Trigger the focused element inside is blurred", async () => {
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          trigger={false}
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await act(async () => setOpen(true));
      screen.getByTestId("close").focus();
      expect(screen.getByTestId("close")).toHaveFocus();
      await act(async () => popup().hidePopover());
      await flush();
      expect(document.activeElement).toBe(document.body);
    });

    it("a Trigger inside a hidden popover is not focused (the outer stack closed)", async () => {
      const user = setupUser();
      render(
        <div popover="manual" data-testid="outer">
          <Harness mode="static" />
        </div>,
      );
      const outer = screen.getByTestId("outer");
      act(() => outer.showPopover());
      await user.click(trigger());
      const close = screen.getByTestId("close");
      close.focus();
      expect(close).toHaveFocus();
      const blur = vi.spyOn(HTMLElement.prototype, "blur");
      await act(async () => {
        outer.hidePopover();
        popup().hidePopover();
      });
      await flush();
      expect(trigger()).not.toHaveFocus();
      // The library blurs the focused element instead (jsdom ignores `blur()` on an element
      // under `display: none`, so the result is not observable here; browsers move it to body).
      expect(blur.mock.contexts).toContain(close);
    });
  });

  describe("positioning", () => {
    const matrix = [
      ["bottom", "center", "bottom"],
      ["bottom", "start", "bottom span-right"],
      ["bottom", "end", "bottom span-left"],
      ["top", "start", "top span-right"],
      ["left", "center", "left"],
      ["right", "start", "right span-bottom"],
      ["right", "end", "right span-top"],
    ] as const;

    it.each(matrix)("side=%s align=%s sets position-area: %s", (side, align, area) => {
      render(<Harness mode="static" popup={{ side, align }} />);
      expect(popup().style.getPropertyValue("position-area")).toBe(area);
      expect(popup()).toHaveAttribute("data-side", side);
      expect(popup()).toHaveAttribute("data-align", align);
    });

    it("side={null} emits no inline placement and no data-side / data-align", () => {
      render(<Harness mode="static" popup={{ side: null, style: { top: 10 } }} />);
      expect(popup().style.getPropertyValue("position-area")).toBe("");
      expect(popup().style.getPropertyValue("position-try-fallbacks")).toBe("");
      expect(popup().style.top).toBe("10px");
      expect(popup()).not.toHaveAttribute("data-side");
      expect(popup()).not.toHaveAttribute("data-align");
    });

    it("the consumer's style wins over the inline placement", () => {
      render(<Harness mode="static" popup={{ style: { positionArea: "block-end" } }} />);
      expect(popup().style.getPropertyValue("position-area")).toBe("block-end");
    });
  });

  describe("mode guard and dev warnings", () => {
    it("warns when the Root switches from JS-free to library mode", () => {
      const error = silenceErrors();
      const { rerender } = render(<Harness mode="static" />);
      rerender(<Harness mode="uncontrolled" />);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Popover.Root: the mode changed after mount"),
      );
    });

    it("warns for transition and keepMounted={false} in JS-free mode", () => {
      const error = silenceErrors();
      render(<Harness mode="static" popup={{ transition: "pop", keepMounted: false }} />);
      const messages = error.mock.calls.map(([message]) => String(message));
      expect(messages.some((m) => m.includes("`transition` has no effect in JS-free mode"))).toBe(
        true,
      );
      expect(messages.some((m) => m.includes("`keepMounted={false}` cannot be honoured"))).toBe(
        true,
      );
    });

    it("warns once shown when the popup has no accessible name", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(
        <Popover.Root defaultOpen={false}>
          <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
          <Popover.Popup data-testid="popup">nameless</Popover.Popup>
        </Popover.Root>,
      );
      expect(error).not.toHaveBeenCalled();
      await openThroughTrigger(user);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Popover.Popup: the popup has no accessible name"),
      );
    });

    it("does not warn for a nameless popup with a non-dialog role", () => {
      const error = silenceErrors();
      render(
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Popup role="group">card</Popover.Popup>
        </Popover.Root>,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("throws for a part outside a Root", () => {
      silenceErrors();
      expect(() => render(<Popover.Trigger>x</Popover.Trigger>)).toThrow(
        "Popover.Trigger must be rendered inside a Popover.Root.",
      );
    });
  });

  describe("held content and transition smoke (design 4.4)", () => {
    /** Records what the DOM looks like when the library calls `hidePopover()` in the close commit. */
    function atHide<T>(read: () => T): { readonly value: () => T | undefined } {
      let value: T | undefined;
      const hide = HTMLElement.prototype.hidePopover;
      vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(function (
        this: HTMLElement,
      ) {
        value = read();
        hide.call(this);
      });
      return { value: () => value };
    }

    it("without transition a part-initiated close keeps the children through the close commit", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      const seen = atHide(() => [committedText(), content() !== null] as const);
      await user.click(trigger());
      await flush();
      // The close commit (committed `false`) still had the children when the popup was hidden.
      expect(seen.value()).toEqual(["false", true]);
      expect(isOpen()).toBe(false);
      // Released after the `toggle` found no exit animation.
      expect(content()).toBeNull();
    });

    it("keepMounted: the Activity stays visible through the close commit, hidden after", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" popup={{ keepMounted: true }} />);
      await openThroughTrigger(user);
      const seen = atHide(() => content()!.style.display);
      await user.click(trigger());
      await flush();
      expect(seen.value()).not.toBe("none");
      expect(content()!.style.display).toBe("none");
    });

    it("with transition the children are gone in the close commit", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" popup={{ transition: "pop" }} />);
      await openThroughTrigger(user);
      expect(content()).toBeInTheDocument();
      const seen = atHide(() => [committedText(), content() !== null] as const);
      await user.click(trigger());
      await flush();
      expect(seen.value()).toEqual(["false", false]);
      expect(isOpen()).toBe(false);
    });

    it("a dismissal's notification commit unmounts the children (no exit animation)", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      await act(async () => popup().hidePopover());
      await flush();
      await flush();
      expect(content()).toBeNull();
      // And it opens again with fresh content.
      await openThroughTrigger(user);
      expect(content()).toBeInTheDocument();
    });

    it("renders with and without `transition` (type map)", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="uncontrolled"
          popup={{ transition: { "fsui-popover-open": "pop-in", default: "none" } }}
        />,
      );
      await openThroughTrigger(user);
      expect(content()).toBeInTheDocument();
      await user.click(trigger());
      await flush();
      expect(isOpen()).toBe(false);
    });
  });

  describe("invoker shim", () => {
    it("dispatchCommand drives a foreign command event", async () => {
      const action = vi.fn<ActionFn>();
      const user = setupUser();
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await act(async () => {
        const event = dispatchCommand(popup(), "hide-popover", screen.getByTestId("elsewhere"));
        expect(event.defaultPrevented).toBe(false);
        popup().hidePopover();
      });
      await flush();
      expect(action.mock.calls[1]![1].reason).toBe("activate");
    });
  });
});
