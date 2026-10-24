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
import { startTransition, use, useRef, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../__tests__/invoker-shim.js";
import { stubComputedPlacement } from "../__tests__/placement-stub.js";
import { popoverSource } from "../__tests__/popover-shim.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushTasks,
  hydrateFromServer,
  silenceErrors,
} from "../__tests__/helpers.js";
import { PopoverContext } from "./popover-context.js";
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
import { recordClicks, spyHide, spyShow } from "../__tests__/overlay-helpers.js";
import { describeOverlayDisabledRenders } from "../__tests__/overlay-disabled-render-suite.js";
import type { DisabledPartProps } from "../__tests__/overlay-disabled-render-suite.js";
import {
  createOverlayHarness,
  describeOverlayOpenState,
  popoverLikeDriver,
} from "../__tests__/overlay-open-state-suite.js";
import type { OverlayHarnessMode } from "../__tests__/overlay-open-state-suite.js";

type ActionFn = (next: boolean, details: PopoverOpenChangeDetails) => unknown;
const controlModesWithStatic: readonly OverlayHarnessMode[] = [
  "uncontrolled",
  "controlled",
  "static",
];

interface PopoverHarnessProps {
  trigger?: Partial<PopoverTriggerProps> | false;
  popup?: Partial<PopoverPopupProps>;
  close?: Partial<PopoverCloseProps>;
  /** Popup content; default: a span and a Close button. */
  content?: ReactNode;
}

/** Controlled/uncontrolled parity harness (`createOverlayHarness`). */
const Harness = createOverlayHarness<PopoverOpenChangeDetails, PopoverHarnessProps>(
  (rootProps, { trigger, popup, close, content }) => (
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
  ),
);

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const content = () => screen.queryByTestId("content");
const committedText = () => screen.getByTestId("committed").textContent;
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

/** Opens a library-mode popover through the Trigger and waits for it to be shown. */
async function openThroughTrigger(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flushTasks(2);
  expect(isOpen()).toBe(true);
}

afterEach(() => {
  // Restored here as well as in the setup file (which runs after this hook): the loop below
  // must reach the real `hidePopover`, not a test's spy.
  vi.restoreAllMocks();
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

describeOverlayOpenState<PopoverOpenChangeDetails>({
  ...popoverLikeDriver(),
  name: "Popover",
  Harness,
  partClose: (user) => user.click(trigger()),
  partCloseCancelsClick: true,
  partCloseArgs: [],
  partCloseReturnsFocus: false,
  closeIntents: {
    render: (probe) => (
      <Popover.Root>
        <Popover.Popup data-testid="popup" aria-label="Probe">
          {probe}
        </Popover.Popup>
      </Popover.Root>
    ),
    useIntents: () => use(PopoverContext)!,
    open: (element) => element.showPopover(),
  },
});

describeOverlayDisabledRenders<PopoverOpenChangeDetails, { close?: DisabledPartProps }>({
  name: "Popover",
  Harness,
  isOpen: () => isOpen(),
  spyOpen: spyShow,
  close: {
    props: (props) => ({ close: props }),
    spyClose: spyHide,
    // JS-free: the Trigger's `toggle-popover` command opens it.
    openStatic: (user) => user.click(trigger()),
  },
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
      // Every mode: the styling hook agrees with native `disabled` (fold W8).
      expect(trigger()).toHaveAttribute("data-disabled", "");
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
      await flushTasks(2);
      const before = renders;
      await user.click(trigger());
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      // A foreign open (script) is followed too.
      await act(async () => popup().showPopover());
      await flushTasks(2);
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
      await flushTasks(2);
      expect(action).toHaveBeenLastCalledWith(true, expect.anything());
      expect(isOpen()).toBe(true);
      // Focus moved into the popup on open; back to the Trigger for the next key.
      trigger().focus();
      await user.keyboard(" ");
      await flushTasks(2);
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("command");
    });

    it("a hide-popover command that does not close leaves no intent: a later dismissal is 'dismiss'", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      // A foreign close command whose hide never happens (a later listener cancelled it): the
      // recorded intent is stale and is dropped a task later (design 2.3).
      act(() => {
        dispatchCommand(popup(), "hide-popover", screen.getByTestId("elsewhere"));
      });
      await flushTasks(1);
      expect(isOpen()).toBe(true);
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event!.type).toBe("toggle");
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
      expect(popup().style.getPropertyValue("position-area")).toBe("top span-self-x-start");
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });

    it("a link Trigger in library mode dispatches through the click and gets no type", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} trigger={{ render: <a href="#x" /> }} />);
      expect(trigger().tagName).toBe("A");
      expect(trigger()).not.toHaveAttribute("type");
      await user.click(trigger());
      await flushTasks(2);
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
      await flushTasks(2);
      expect(saved.mock.calls).toEqual([[true], [false]]);
      expect(isOpen()).toBe(false);
      expect(content()).toBeNull();
    });
  });

  describe("platform path", () => {
    const hydrate = (ui: ReactNode) =>
      hydrateFromServer(ui, {
        mutate: async (container) => {
          // A click before hydration ran `toggle-popover` natively; its `toggle` task ran too.
          container.querySelector<HTMLElement>("[popover]")!.showPopover();
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
        flush: null,
      });

    it("JS-free mode syncs aria-expanded for a pre-hydration open", async () => {
      await act(async () => {
        await hydrate(<Harness mode="static" />);
      });
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
      await flushTasks(2);
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
        await flushTasks(2);
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
        await flushTasks(2);
        expect(isOpen()).toBe(false);
        // The re-open is entangled with the Close's pending async transition (React batches
        // them), so it commits together with the action's end.
        await user.click(trigger());
        await act(async () => work.resolve());
        await flushTasks(2);
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
        await flushTasks(2);
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
        await flushTasks(2);
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "first failed" }));
        expect(isOpen()).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("reset"));
        await user.click(screen.getByTestId("close"));
        expect(call).toBe(2);
        await act(async () => runs[1]!.resolve());
        await flushTasks(2);
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
        await flushTasks(2);
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
        await flushTasks(2);
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
      await flushTasks(2);
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

  describe("disabled on link and component renders (design/components/button.md 17.3)", () => {
    it("Trigger: a host <button> render keeps its own aria-disabled (not owned there)", () => {
      render(<Harness mode="uncontrolled" trigger={{ render: <button aria-disabled="true" /> }} />);
      expect(trigger()).toHaveAttribute("aria-disabled", "true");
    });

    it("Trigger, library mode: a component render gets `disabled` as an own undefined key", () => {
      const received: ComponentPropsWithRef<"button">[] = [];
      function Spy(props: ComponentPropsWithRef<"button">) {
        received.push(props);
        return <button {...props} />;
      }
      render(
        <Harness mode="uncontrolled" trigger={{ disabled: true, render: <Spy disabled /> }} />,
      );
      const props = received.at(-1)!;
      expect(Object.hasOwn(props, "disabled")).toBe(true);
      expect(props.disabled).toBeUndefined();
      expect(props["aria-disabled"]).toBe(true);
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
      await flushTasks(2);
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

    it("initialFocus outside the popup warns once and is not autofocused", async () => {
      const user = setupUser();
      const error = silenceErrors();
      let autofocused = false;
      const show = HTMLElement.prototype.showPopover;
      vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
        this: HTMLElement,
        options,
      ) {
        autofocused = screen.getByTestId("outside").hasAttribute("autofocus");
        show.call(this, options);
      });
      function App() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <>
            <input ref={ref} data-testid="outside" />
            <Harness mode="uncontrolled" popup={{ initialFocus: ref }} />
          </>
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      expect(autofocused).toBe(false);
      await user.click(trigger());
      await flushTasks(2);
      await openThroughTrigger(user);
      const outside = error.mock.calls.filter(([message]) =>
        String(message).includes("Popover.Popup: `initialFocus` is outside the popup"),
      );
      expect(outside).toHaveLength(1);
    });

    renderBoth("focus return (design 6.2)", (mode) => {
      it("focus inside the hidden popup goes back to the Trigger (nested: the platform does not)", async () => {
        const user = setupUser();
        render(<Harness mode={mode} />);
        await openThroughTrigger(user);
        screen.getByTestId("close").focus();
        // The shim leaves focus where it is, like the platform for a nested popover.
        await act(async () => popup().hidePopover());
        await flushTasks(2);
        expect(trigger()).toHaveFocus();
      });

      it("focus outside the popup before the hide is left alone", async () => {
        const user = setupUser();
        render(<Harness mode={mode} />);
        await openThroughTrigger(user);
        screen.getByTestId("elsewhere").focus();
        await act(async () => popup().hidePopover());
        await flushTasks(2);
        expect(screen.getByTestId("elsewhere")).toHaveFocus();
      });
    });

    describe("a library-driven close from inside the popup with transition", () => {
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
            await flushTasks(2);
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
        await flushTasks(2);
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
        await flushTasks(2);
        expect(isOpen()).toBe(false);
        expect(screen.getByTestId("elsewhere")).toHaveFocus();
      });

      it("keepMounted: focus returns to the Trigger as well", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ transition: "pop", keepMounted: true }} />);
        await openThroughTrigger(user);
        screen.getByTestId("close").focus();
        await user.keyboard("{Enter}");
        await flushTasks(2);
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
      await flushTasks(2);
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(trigger()).not.toHaveFocus();
      // The library blurs the focused element instead (jsdom ignores `blur()` on an element
      // under `display: none`, so the result is not observable here; browsers move it to body).
      expect(blur.mock.contexts).toContain(close);
    });
  });

  describe("positioning", () => {
    // The shared matrix of conventions 13.1 (wave 11): inline-relative `align`, `self-x-*` sides.
    const matrix = [
      ["bottom", "center", "bottom"],
      ["bottom", "start", "bottom span-self-x-end"],
      ["bottom", "end", "bottom span-self-x-start"],
      ["top", "start", "top span-self-x-end"],
      ["left", "center", "left"],
      ["right", "start", "right span-bottom"],
      ["right", "end", "right span-top"],
      ["inline-start", "center", "self-x-start"],
      ["inline-end", "start", "self-x-end span-bottom"],
      ["inline-end", "end", "self-x-end span-top"],
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

  describe("resolved placement (wave 11)", () => {
    // Conventions 13.2: `getComputedStyle` is stubbed for the popup (jsdom has no layout); the
    // shim's `toggle` drives the hook (no ResizeObserver in jsdom).
    const stub = (positionArea: string, direction = "ltr") =>
      stubComputedPlacement(() => screen.queryByTestId("popup"), { positionArea, direction });

    it("jsdom (no computed position-area): the requested values while open", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" popup={{ side: "top", align: "end" }} />);
      await openThroughTrigger(user);
      expect(popup()).toHaveAttribute("data-side", "top");
      expect(popup()).toHaveAttribute("data-align", "end");
    });

    it.each(controlModesWithStatic)(
      "%s mode: a flipped position-area is the data-side and the state while shown",
      async (mode) => {
        const user = setupUser();
        stub("span-self-x-end top");
        const states: PopoverPopupState[] = [];
        render(
          <Harness
            mode={mode}
            popup={{
              align: "start",
              className: (s) => {
                states.push(s);
                return `pop-${s.side}`;
              },
            }}
          />,
        );
        expect(popup()).toHaveAttribute("data-side", "bottom");
        if (mode === "static") {
          await user.click(trigger());
          await flushTasks(2);
        } else {
          await openThroughTrigger(user);
        }
        expect(isOpen()).toBe(true);
        expect(popup()).toHaveAttribute("data-side", "top");
        expect(popup()).toHaveAttribute("data-align", "start");
        expect(popup()).toHaveClass("pop-top");
        expect(states.at(-1)).toMatchObject({ side: "top", align: "start" });
        // The inline style keeps the requested keywords.
        expect(popup().style.getPropertyValue("position-area")).toBe("bottom span-self-x-end");

        await act(async () => popup().hidePopover());
        await flushTasks(2);
        expect(popup()).toHaveAttribute("data-side", "bottom");
        expect(states.at(-1)).toMatchObject({ side: "bottom", align: "start" });
      },
    );

    it("an open where it was asked costs no Popup render beyond the open itself", async () => {
      const user = setupUser();
      stub("bottom");
      let renders = 0;
      render(
        <Harness
          mode="static"
          popup={{
            className: () => {
              renders++;
              return undefined;
            },
          }}
        />,
      );
      const before = renders;
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(renders).toBe(before);
    });

    it('side="inline-end" renders self-x-end inline and data-side="inline-end" while closed', async () => {
      const user = setupUser();
      stub("self-x-end span-bottom", "rtl");
      render(<Harness mode="uncontrolled" popup={{ side: "inline-end", align: "start" }} />);
      expect(popup().style.getPropertyValue("position-area")).toBe("self-x-end span-bottom");
      expect(popup()).toHaveAttribute("data-side", "inline-end");
      await openThroughTrigger(user);
      expect(popup()).toHaveAttribute("data-side", "left");
      expect(popup()).toHaveAttribute("data-align", "start");
    });

    it("side={null} never reads the computed style", async () => {
      const user = setupUser();
      const s = stub("bottom");
      render(<Harness mode="uncontrolled" popup={{ side: null }} />);
      await openThroughTrigger(user);
      expect(s.calls()).toBe(0);
      expect(popup()).not.toHaveAttribute("data-side");
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
      await flushTasks(2);
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(seen.value()).toEqual(["false", false]);
      expect(isOpen()).toBe(false);
    });

    it("a dismissal's notification commit unmounts the children (no exit animation)", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      await flushTasks(2);
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
      await flushTasks(2);
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
      await flushTasks(2);
      expect(action.mock.calls[1]![1].reason).toBe("activate");
    });

    it("the command name is matched case-insensitively (as the platform's)", async () => {
      const action = vi.fn<ActionFn>();
      const user = setupUser();
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await act(async () => {
        dispatchCommand(popup(), "Hide-Popover", screen.getByTestId("elsewhere"));
        popup().hidePopover();
      });
      await flushTasks(2);
      expect(action.mock.calls[1]![1].reason).toBe("activate");
    });
  });
});
