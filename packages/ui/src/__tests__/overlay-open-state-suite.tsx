// Shared open-state suite for the overlays built on `useOverlayRoot` (src/internal/use-overlay-root.ts):
// Dialog, Popover and Menu (#106, audit T8). It pins the Root's contract through the public
// components: `openChangeAction` plumbing and `details`, optimistic open and pending, part-initiated
// closes (library-owned: awaited, then the library closes) against dismissals (the platform closed;
// notified afterwards), rejection and revert, controlled refusal and veto, overlapping and
// superseded dispatches, suspending content, the platform path (an open found on hydration, a
// controlled flip) and the stale close-intent clear (design/components/popover.md 2.3).
//
// Each component's test file builds its harness with `createOverlayHarness` and calls
// `describeOverlayOpenState` with a driver; component-specific rows (Dialog's forms and
// `returnValue` leaks, Popover's foreign invokers, Menu's items) stay in those files. The jsdom
// shims stand in for the platform: a dismissal is driven with `requestClose()` / `hidePopover()`,
// which is what Escape or a light dismiss does.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Mock, MockInstance } from "vitest";
import type { OverlayCloseIntent } from "../internal/use-overlay-root.js";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushTasks,
  renderBoth,
  setupUser,
  silenceErrors,
} from "./helpers.js";
import type { ControlMode, Deferred } from "./helpers.js";
import { spyHide, spyShow } from "./overlay-helpers.js";

/** `"static"`: no open-state props, JS-free mode (Dialog, Popover). */
export type OverlayHarnessMode = ControlMode | "static";

/** What every overlay's `openChangeAction` details have (Dialog's add `returnValue`). */
interface OverlayDetailsLike {
  readonly reason: string;
  readonly event: Event | undefined;
}

export type OpenChangeFn<D> = (next: boolean, details: D) => unknown;

/** The open-state props the harness passes to the component's Root. */
export interface OverlayRootProps<D> {
  open?: boolean;
  defaultOpen?: boolean;
  openChangeAction?: (next: boolean, details: D) => Promise<void>;
}

export interface OverlayHarnessProps<D> {
  mode: OverlayHarnessMode;
  /** Initial committed open state. */
  initialOpen?: boolean;
  /** The consumer's work, awaited by the harness's `openChangeAction`. */
  action?: OpenChangeFn<D>;
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
  /** Rendered next to the Root (for controlled tests that flip `open` from outside). */
  outside?: (setOpen: (open: boolean) => void) => ReactNode;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows "update on success"
 * (`startTransition` after the await, design 2.2); both modes mirror the committed value in
 * `data-testid="committed"`. `renderRoot` renders the component's Root with `rootProps` and the
 * component's own harness props; the parts must carry the test ids `trigger`, `popup` and (in the
 * default content) `content`.
 */
export function createOverlayHarness<D, P extends object>(
  renderRoot: (rootProps: OverlayRootProps<D>, props: P) => ReactNode,
): (props: OverlayHarnessProps<D> & P) => ReactNode {
  return function Harness({
    mode,
    initialOpen = false,
    action,
    catchErrors = false,
    refuseClose = false,
    refuseOpen = false,
    boundary,
    suspense = false,
    outside,
    ...rest
  }: OverlayHarnessProps<D> & P) {
    const [open, setOpen] = useState(initialOpen);

    const openChangeAction = async (next: boolean, details: D) => {
      try {
        await action?.(next, details);
      } catch (error) {
        if (!catchErrors) throw error;
        return;
      }
      if ((next && refuseOpen) || (!next && refuseClose)) return;
      startTransition(() => setOpen(next));
    };

    const rootProps: OverlayRootProps<D> =
      mode === "static"
        ? {}
        : mode === "controlled"
          ? { open, openChangeAction }
          : { defaultOpen: initialOpen, openChangeAction };

    let overlay = renderRoot(rootProps, rest as unknown as P);
    if (boundary) overlay = <ErrorCatcher onError={boundary}>{overlay}</ErrorCatcher>;

    const body = (
      <>
        <button type="button" data-testid="elsewhere">
          Elsewhere
        </button>
        {overlay}
        {outside?.((next) => startTransition(() => setOpen(next)))}
        <output data-testid="committed">{String(open)}</output>
      </>
    );
    return suspense ? (
      <Suspense fallback={<span data-testid="fallback">loading</span>}>{body}</Suspense>
    ) : (
      body
    );
  };
}

/** The harness props the suite uses; a component harness accepts at least these. */
export interface OverlaySuiteHarnessProps<D> extends OverlayHarnessProps<D> {
  trigger?: { disabled?: boolean } | false;
  popup?: { className?: string; keepMounted?: boolean };
  /** Popup content; the default renders `data-testid="content"` (and Dialog's Close, value "x"). */
  content?: ReactNode;
}

type User = ReturnType<typeof setupUser>;

/** The Root's close-intent record, read through the component's context. */
interface CloseIntents {
  readonly recordCloseIntent: (intent: OverlayCloseIntent | undefined) => void;
  readonly takeCloseIntent: () => OverlayCloseIntent | undefined;
}

export interface OverlayOpenStateConfig<D extends OverlayDetailsLike> {
  /** The describe block's name (`"Dialog"`). */
  readonly name: string;
  readonly Harness: ComponentType<OverlaySuiteHarnessProps<D>>;
  /** Whether the popup is shown (`dialog.open`, `:popover-open`). */
  readonly isOpen: () => boolean;
  /** Spies on the method the library opens the popup with (`showModal`, `showPopover`). */
  readonly spyOpen: () => MockInstance;
  /** Spies on the method the library closes the popup with (`close`, `hidePopover`). */
  readonly spyClose: () => MockInstance;
  /** The arguments of the library's open call through the Trigger (Popover: `{ source }`). */
  readonly openArgs: () => readonly unknown[];
  /**
   * The platform closes the popup, as Escape or a light dismiss does (`requestClose(value)`,
   * `hidePopover()`). Called inside `act`.
   */
  readonly dismiss: (value?: string) => void;
  /** The `type` of the event a dismissal's notification carries (`"close"`, `"toggle"`). */
  readonly dismissEvent: string;
  /**
   * A library-owned close through a part, by a click (Dialog: the default content's Close part;
   * Popover: the Trigger; Menu: an action-less item).
   */
  readonly partClose: (user: User) => Promise<void>;
  /**
   * `partClose`'s click is cancelled: the part is an invoker whose native close command the
   * library replaces (Dialog's Close, Popover's Trigger); `false` for Menu's item, which has none.
   */
  readonly partCloseCancelsClick: boolean;
  /** The arguments of the library's close call after `partClose` (Dialog: the Close's `"x"`). */
  readonly partCloseArgs: readonly unknown[];
  /**
   * `partClose`'s part is inside the popup, so the close moves focus back to the Trigger (Dialog:
   * the platform's dialog close; Menu: the library). `false` for Popover, whose part is the
   * Trigger itself.
   */
  readonly partCloseReturnsFocus: boolean;
  /**
   * The sorted keys of a Trigger click's `details` (`event` is virtual, conventions 2.2). With
   * `"returnValue"` (Dialog), `details.returnValue` is asserted (undefined for an open, the part's
   * or the dismissal's value for a close) and so is the dialog's `returnValue` after a part close.
   */
  readonly detailsKeys: readonly string[];
  /**
   * A Trigger click while open closes (Popover, Menu: library-owned, `"activate"`); `false`: the
   * Trigger only opens (Dialog), so a second click while optimistically open does nothing. For
   * Menu the Trigger's mousedown moves focus out of the popup and its `focusout` close hides the
   * menu before the click, which then dispatches the same library-owned close.
   */
  readonly triggerToggles: boolean;
  /** The Trigger carries `aria-expanded` (Popover, Menu; not Dialog). */
  readonly ariaExpanded: boolean;
  /**
   * An open the library did not start (Dialog: a `show-modal` command; Popover: a script's
   * `showPopover()`), run inside `act`. Returns the event the library cancels and passes as
   * `details.event`.
   */
  readonly foreignOpen: () => Event;
  /** `foreignOpen` itself calls the spied open method (Popover's `showPopover()`). */
  readonly foreignOpenCallsOpen: boolean;
  /** Opens the server-rendered popup the way a click before hydration did. */
  readonly openBeforeHydration: (popup: HTMLElement) => void | Promise<void>;
  /** The open call's arguments for a controlled `open={true}` without a Trigger. */
  readonly controlledOpenArgs: readonly unknown[];
  /** The close call's arguments for a controlled `open={false}` (Dialog: `""`, no part's value). */
  readonly controlledCloseArgs: readonly unknown[];
  /**
   * The stale-intent row: renders a Root (no open-state props: JS-free mode where there is one)
   * with a Popup (`data-testid="popup"`) and `probe` where it renders at once, reads the Root's
   * context (`useIntents`) and opens the popup (`open`: natively; omit when `render` already opens
   * it, as Menu's `defaultOpen`, whose library mode would cancel a native open).
   */
  readonly closeIntents?: {
    readonly render: (probe: ReactNode) => ReactNode;
    readonly useIntents: () => CloseIntents;
    readonly open?: (popup: HTMLElement) => void;
  };
}

/** The driver fields Popover and Menu share: a `popover` popup opened by a toggling Trigger. */
export function popoverLikeDriver<D extends OverlayDetailsLike>(): Omit<
  OverlayOpenStateConfig<D>,
  | "name"
  | "Harness"
  | "partClose"
  | "partCloseCancelsClick"
  | "partCloseArgs"
  | "partCloseReturnsFocus"
  | "closeIntents"
> {
  const popup = () => screen.getByTestId("popup");
  return {
    isOpen: () => popup().matches(":popover-open"),
    spyOpen: spyShow,
    spyClose: spyHide,
    openArgs: () => [{ source: screen.getByTestId("trigger") }],
    dismiss: () => popup().hidePopover(),
    dismissEvent: "toggle",
    detailsKeys: ["reason"],
    triggerToggles: true,
    ariaExpanded: true,
    // A script's showPopover(): cancelled at `beforetoggle`, which is the dispatched event.
    foreignOpen: () => {
      let before!: Event;
      popup().addEventListener("beforetoggle", (event) => (before = event), { once: true });
      popup().showPopover();
      return before;
    },
    foreignOpenCallsOpen: true,
    // A click before hydration ran `toggle-popover` natively; its `toggle` task ran too.
    openBeforeHydration: async (element) => {
      element.showPopover();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    controlledOpenArgs: [undefined],
    controlledCloseArgs: [],
  };
}

export function describeOverlayOpenState<D extends OverlayDetailsLike>(
  config: OverlayOpenStateConfig<D>,
): void {
  const { Harness, isOpen, spyOpen, spyClose, dismiss, partClose } = config;
  const hasReturnValue = config.detailsKeys.includes("returnValue");
  type Action = OpenChangeFn<D>;

  const trigger = () => screen.getByTestId("trigger");
  const popup = () => screen.getByTestId("popup");
  const content = () => screen.queryByTestId("content");
  const committedText = () => screen.getByTestId("committed").textContent;
  const returnValueOf = (details: D) =>
    (details as unknown as { returnValue?: unknown }).returnValue;
  const expectExpanded = (expanded: boolean) => {
    if (config.ariaExpanded) expect(trigger()).toHaveAttribute("aria-expanded", String(expanded));
  };

  /** Opens through the Trigger and waits for the popup to be shown. */
  async function openThroughTrigger(user: User) {
    await user.click(trigger());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
  }

  describe(`${config.name} open state (shared overlay suite)`, () => {
    renderBoth("sync action", (mode) => {
      it("a Trigger click dispatches (true, details) with the native click, cancelled", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} />);
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.reason).toBe("activate");
        if (hasReturnValue) expect(returnValueOf(details)).toBeUndefined();
        expect(details.event).toBeInstanceOf(MouseEvent);
        expect(details.event!.type).toBe("click");
        // The command was cancelled: the library opens the popup, not the browser.
        expect(details.event!.defaultPrevented).toBe(true);
        // `details` is serialisable; `event` is virtual (conventions 2.2).
        expect(Object.keys(details).sort()).toEqual(config.detailsKeys);
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        expect(committedText()).toBe("true");
      });

      it("a disabled Trigger never dispatches", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} trigger={{ disabled: true }} />);
        await user.click(trigger());
        fireEvent.click(trigger());
        await flushTasks(2);
        expect(action).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expect(trigger()).toHaveAttribute("data-disabled", "");
      });

      if (config.triggerToggles) {
        it("a click while open dispatches (false, 'activate'): a library-owned close", async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} />);
          await openThroughTrigger(user);
          await user.click(trigger());
          expect(action).toHaveBeenCalledTimes(2);
          const [next, details] = action.mock.calls[1]!;
          expect(next).toBe(false);
          expect(details.reason).toBe("activate");
          expect(details.event!.type).toBe("click");
          expect(details.event!.defaultPrevented).toBe(true);
          await flushTasks(2);
          expect(isOpen()).toBe(false);
          expect(committedText()).toBe("false");
          // The library's own close echoes back without a second dispatch.
          expect(action).toHaveBeenCalledTimes(2);
        });
      } else {
        it("a click while optimistically open never dispatches", async () => {
          const user = setupUser();
          const d = deferred();
          const action = vi.fn<Action>(() => d.promise);
          render(<Harness mode={mode} action={action} />);
          await user.click(trigger());
          await user.click(trigger());
          expect(action).toHaveBeenCalledTimes(1);
          await act(async () => d.resolve());
          await flushTasks(2);
        });
      }

      it("a foreign open is cancelled and dispatched with its event", async () => {
        const action = vi.fn<Action>();
        const open = spyOpen();
        render(<Harness mode={mode} action={action} />);
        let event!: Event;
        await act(async () => {
          event = config.foreignOpen();
        });
        expect(event.defaultPrevented).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.reason).toBe("activate");
        expect(details.event).toBe(event);
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        // The library's own open (after the foreign call itself, where that is one).
        expect(open).toHaveBeenCalledTimes(config.foreignOpenCallsOpen ? 2 : 1);
        expect(open).toHaveBeenLastCalledWith(...config.openArgs());
      });
    });

    renderBoth("async action", (mode) => {
      it("open: pending Trigger, popup closed and content unmounted until it resolves", async () => {
        const user = setupUser();
        const open = spyOpen();
        const d = deferred();
        render(<Harness mode={mode} action={() => d.promise} />);
        await user.click(trigger());
        expectExpanded(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expectPending(trigger());
        expect(open).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expect(content()).toBeNull();
        await act(async () => d.resolve());
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith(...config.openArgs());
        expect(isOpen()).toBe(true);
        expect(content()).toBeInTheDocument();
        expectExpanded(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expectNotPending(trigger());
      });

      it("part-initiated close: library-owned, open while openChangeAction(false) runs, closed on resolve", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        const close = spyClose();
        await partClose(user);
        // The Root dispatched (a part with a native close command: its click was cancelled).
        expect(action).toHaveBeenCalledTimes(2);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        if (hasReturnValue) expect(returnValueOf(details)).toBe("x");
        expect(details.event!.type).toBe("click");
        expect(details.event!.defaultPrevented).toBe(config.partCloseCancelsClick);
        // Still open while the action runs; the Trigger shows the Root's pending.
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(content()).toBeInTheDocument();
        expectPending(trigger());
        expect(trigger()).not.toHaveAttribute("data-open");
        expectExpanded(false);
        if (config.partCloseReturnsFocus) expect(trigger()).not.toHaveFocus();
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(content()).toBeInTheDocument();
        expectPending(trigger());
        await act(async () => d.resolve());
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith(...config.partCloseArgs);
        expect(isOpen()).toBe(false);
        if (hasReturnValue) expect((popup() as HTMLDialogElement).returnValue).toBe("x");
        expect(committedText()).toBe("false");
        expectNotPending(trigger());
        await flushTasks(2);
        expect(content()).toBeNull();
        // The close event is an echo: no second notification.
        expect(action).toHaveBeenCalledTimes(2);
        // Focus moved back from the part to the Trigger.
        if (config.partCloseReturnsFocus) expect(trigger()).toHaveFocus();
      });

      it("dismissal: notified as (false, 'dismiss') with the platform's event; pending meanwhile", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        // What Escape or a click outside does: the platform closes at once.
        await act(async () => dismiss("x"));
        expect(isOpen()).toBe(false);
        // The notification follows the platform's event.
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("dismiss");
        if (hasReturnValue) expect(returnValueOf(details)).toBe("x");
        expect(details.event!.type).toBe(config.dismissEvent);
        expectPending(trigger());
        expect(trigger()).not.toHaveAttribute("data-open");
        expect(content()).toBeInTheDocument(); // committed is still true
        await act(async () => d.resolve());
        expectNotPending(trigger());
        expect(content()).toBeNull();
        expect(committedText()).toBe("false");
        expect(isOpen()).toBe(false);
      });

      it("a commit between the platform's close and its event does not re-open", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const { rerender } = render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const open = spyOpen();
        await act(async () => {
          dismiss();
          // A re-render of the Root lands before the queued close event.
          rerender(<Harness mode={mode} action={action} popup={{ className: "re-rendered" }} />);
        });
        expect(popup()).toHaveClass("re-rendered");
        expect(isOpen()).toBe(false);
        await flushTasks(2);
        expect(open).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expect(action).toHaveBeenLastCalledWith(false, expect.anything());
      });

      it("a dismissal during a pending part-initiated close notifies nothing more (walkthrough 11.13)", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await partClose(user);
        expect(action).toHaveBeenCalledTimes(2);
        expect(isOpen()).toBe(true);
        // Escape while openChangeAction(false) runs: the platform closes at once.
        await act(async () => dismiss());
        await flushTasks(2);
        expect(isOpen()).toBe(false);
        close.mockClear();
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
        // The apply effect found the popup closed: no second close.
        expect(close).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expect(content()).toBeNull();
      });
    });

    renderBoth("rejection", (mode) => {
      it("open rejects: the boundary gets it, the popup never opened, no data-open", async () => {
        const user = setupUser();
        silenceErrors();
        const open = spyOpen();
        const d = deferred();
        const caught = vi.fn();
        render(<Harness mode={mode} action={() => d.promise} boundary={caught} />);
        await user.click(trigger());
        expect(trigger()).toHaveAttribute("data-open", "");
        await act(async () => d.reject(new Error("nope")));
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "nope" }));
        expect(open).not.toHaveBeenCalled();
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
        await flushTasks(2);
        // A swallowed error is success: uncontrolled commits; the controlled harness returns
        // early (does not adopt) so it stays closed.
        expect(isOpen()).toBe(mode === "uncontrolled");
        if (mode === "uncontrolled") expect(trigger()).toHaveAttribute("data-open", "");
        else expect(trigger()).not.toHaveAttribute("data-open");
      });

      it("part-initiated close rejects: the boundary gets it, the library never closed the popup", async () => {
        const user = setupUser();
        silenceErrors();
        const caught = vi.fn();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} boundary={caught} />);
        await openThroughTrigger(user);
        const close = spyClose();
        const d = deferred();
        action.mockImplementation(() => d.promise);
        await partClose(user);
        expect(isOpen()).toBe(true);
        await act(async () => d.reject(new Error("save failed")));
        await flushTasks(2);
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
        expect(close).not.toHaveBeenCalled();
        // The boundary replaced the whole component (removing the popup closed it).
        expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
        expect(screen.queryByTestId("popup")).toBeNull();
      });

      it("part-initiated close rejects, caught inside: uncontrolled closes, controlled stays", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} catchErrors />);
        await openThroughTrigger(user);
        action.mockImplementation(async () => {
          throw new Error("handled");
        });
        await partClose(user);
        await flushTasks(2);
        expect(isOpen()).toBe(mode === "controlled");
      });

      it("dismissal notification rejects: the boundary gets it (the popup was already closed)", async () => {
        const user = setupUser();
        silenceErrors();
        const caught = vi.fn();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} boundary={caught} />);
        await openThroughTrigger(user);
        action.mockImplementation(async () => {
          throw new Error("save failed");
        });
        await act(async () => dismiss());
        await flushTasks(2);
        expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
      });

      it("dismissal notification rejects, caught inside: uncontrolled stays closed, controlled re-opens", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode={mode} action={action} catchErrors />);
        await openThroughTrigger(user);
        action.mockImplementation(async () => {
          throw new Error("handled");
        });
        const open = spyOpen();
        await act(async () => dismiss());
        await flushTasks(2);
        if (mode === "uncontrolled") {
          expect(isOpen()).toBe(false);
          expect(open).not.toHaveBeenCalled();
        } else {
          // The controlled harness does not adopt `false` on failure: the popup re-opens.
          expect(isOpen()).toBe(true);
          expect(open).toHaveBeenCalledTimes(1);
        }
      });
    });

    describe("controlled refusal and veto", () => {
      it("a refused dismissal re-opens the popup once the notification settles; not a veto", async () => {
        const user = setupUser();
        const d = deferred();
        const action = vi.fn<Action>();
        render(<Harness mode="controlled" action={action} refuseClose />);
        await openThroughTrigger(user);
        const open = spyOpen();
        action.mockImplementation(() => d.promise);
        await act(async () => dismiss());
        expect(isOpen()).toBe(false);
        await flushTasks(2);
        expectPending(trigger());
        expect(open).not.toHaveBeenCalled();
        await act(async () => d.resolve());
        expect(open).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expectNotPending(trigger());
      });

      it("a refused part-initiated close is a real veto: never closed, data-open snaps back (11.14)", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const open = spyOpen();
        render(<Harness mode="controlled" action={action} refuseClose />);
        await openThroughTrigger(user);
        open.mockClear();
        const close = spyClose();
        const d = deferred();
        action.mockImplementation(() => d.promise);
        await partClose(user);
        expect(trigger()).not.toHaveAttribute("data-open");
        await act(async () => d.resolve());
        await flushTasks(2);
        expect(close).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled(); // never blinked
        expect(isOpen()).toBe(true);
        expect(content()).toBeInTheDocument();
        expect(trigger()).toHaveAttribute("data-open", "");
        expectExpanded(true);
        expectNotPending(trigger());
      });

      it("a vetoed open snaps back and the popup never opens", async () => {
        const user = setupUser();
        const open = spyOpen();
        const d = deferred();
        render(<Harness mode="controlled" action={() => d.promise} refuseOpen />);
        await user.click(trigger());
        expect(trigger()).toHaveAttribute("data-open", "");
        await act(async () => d.resolve());
        expect(trigger()).not.toHaveAttribute("data-open");
        expect(open).not.toHaveBeenCalled();
      });
    });

    describe("overlap", () => {
      renderBoth("dismissal notification pending, the user re-opens (walkthrough 11.8)", (mode) => {
        it("both actions run; the latest intent wins", async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} />);
          await openThroughTrigger(user);
          const closing = deferred();
          const opening = deferred();
          action.mockImplementationOnce(() => closing.promise);
          action.mockImplementationOnce(() => opening.promise);
          const open = spyOpen();
          await act(async () => dismiss());
          await flushTasks(2);
          expect(trigger()).not.toHaveAttribute("data-open");
          await user.click(trigger());
          expect(action).toHaveBeenCalledTimes(3);
          expect(action.mock.calls[2]![0]).toBe(true);
          expect(trigger()).toHaveAttribute("data-open", "");
          // Optimistic and committed are both `true` (the close never committed), yet the Root
          // is pending and the popup is closed: the Trigger shows it.
          expectPending(trigger());
          expect(isOpen()).toBe(false);
          // Resolve out of order: the open first, then the superseded close.
          await act(async () => opening.resolve());
          await act(async () => closing.resolve());
          await flushTasks(2);
          expectNotPending(trigger());
          if (mode === "uncontrolled") {
            // The latest-dispatch guard ignores the superseded close.
            expect(trigger()).toHaveAttribute("data-open", "");
            expect(isOpen()).toBe(true);
            expect(open).toHaveBeenCalledTimes(1);
            expect(content()).toBeInTheDocument();
          } else {
            // A controlled parent that adopts every resolution in arrival order ends with the
            // slower one (conventions 2.5: the guard is the parent's job in controlled mode);
            // the DOM follows the parent.
            expect(committedText()).toBe("false");
            expect(trigger()).not.toHaveAttribute("data-open");
            expect(isOpen()).toBe(false);
          }
        });
      });

      if (config.triggerToggles) {
        renderBoth("second click during a pending open (walkthrough 11.7)", (mode) => {
          it("both actions run, the popup never opens, the latest intent wins", async () => {
            const user = setupUser();
            const open = spyOpen();
            const opening = deferred();
            const closing = deferred();
            const action = vi.fn<Action>();
            action.mockImplementationOnce(() => opening.promise);
            action.mockImplementationOnce(() => closing.promise);
            render(<Harness mode={mode} action={action} />);
            await user.click(trigger());
            await user.click(trigger());
            expect(action).toHaveBeenCalledTimes(2);
            expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
            expectExpanded(false);
            expect(trigger()).not.toHaveAttribute("data-open");
            expectPending(trigger());
            // Out of order: the close first, then the superseded open.
            await act(async () => closing.resolve());
            await act(async () => opening.resolve());
            await flushTasks(2);
            expectNotPending(trigger());
            if (mode === "uncontrolled") {
              expectExpanded(false);
              expect(trigger()).not.toHaveAttribute("data-open");
              expect(open).not.toHaveBeenCalled();
              expect(isOpen()).toBe(false);
            } else {
              // A controlled parent that adopts every resolution in arrival order ends with the
              // slower one (conventions 2.5); the DOM follows the parent.
              expect(committedText()).toBe("true");
              expect(isOpen()).toBe(true);
            }
          });
        });
      }
    });

    describe("superseded rejection", () => {
      /** The older dispatch's settle after the newer one's, in both orders. */
      function rows(
        setup: () => Promise<{ caught: Mock; older: Deferred<void>; newer: Deferred<void> }>,
      ) {
        it("the older dispatch rejects after the newer resolved: the boundary gets it", async () => {
          const { caught, older, newer } = await setup();
          await act(async () => newer.resolve());
          await act(async () => older.reject(new Error("older")));
          await flushTasks(2);
          expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
        });

        it("the older dispatch rejects while the newer is pending: the boundary gets it", async () => {
          const { caught, older, newer } = await setup();
          await act(async () => older.reject(new Error("older")));
          await flushTasks(2);
          expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
          await act(async () => newer.resolve());
        });
      }

      renderBoth("a dismissal, then a re-open", (mode) => {
        rows(async () => {
          const user = setupUser();
          silenceErrors();
          const caught = vi.fn();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} boundary={caught} />);
          await openThroughTrigger(user);
          const older = deferred();
          const newer = deferred();
          action.mockImplementationOnce(() => older.promise);
          action.mockImplementationOnce(() => newer.promise);
          await act(async () => dismiss());
          await flushTasks(2);
          await user.click(trigger());
          return { caught, older, newer };
        });
      });

      if (config.triggerToggles) {
        renderBoth("an open, then a close click", (mode) => {
          rows(async () => {
            const user = setupUser();
            silenceErrors();
            const caught = vi.fn();
            const older = deferred();
            const newer = deferred();
            const action = vi.fn<Action>();
            action.mockImplementationOnce(() => older.promise);
            action.mockImplementationOnce(() => newer.promise);
            render(<Harness mode={mode} action={action} boundary={caught} />);
            await user.click(trigger());
            await user.click(trigger());
            return { caught, older, newer };
          });
        });
      }
    });

    renderBoth("suspending content", (mode) => {
      it("keeps the popup closed and the Trigger pending until the content is ready", async () => {
        const user = setupUser();
        const open = spyOpen();
        const suspender = createSuspender();
        render(<Harness mode={mode} suspense content={<suspender.Suspender value="details" />} />);
        await user.click(trigger());
        await flushTasks(2);
        expect(open).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expectPending(trigger());
        expect(screen.queryByTestId("fallback")).toBeNull();
        await act(async () => suspender.resolve("details", "Order details"));
        expect(open).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expect(screen.getByTestId("suspender")).toHaveTextContent("Order details");
        expectNotPending(trigger());
      });

      it("keepMounted: content is pre-rendered hidden inside <Activity>", async () => {
        const user = setupUser();
        const suspender = createSuspender();
        suspender.resolve("details", "Ready");
        render(
          <Harness
            mode={mode}
            popup={{ keepMounted: true }}
            content={<suspender.Suspender value="details" />}
          />,
        );
        await flushTasks(2);
        const hidden = screen.getByTestId("suspender");
        expect(hidden).not.toBeVisible();
        await openThroughTrigger(user);
        expect(screen.getByTestId("suspender")).toBe(hidden); // same DOM node: state preserved
        expect(hidden).toBeVisible();
      });
    });

    describe("platform path", () => {
      /**
       * Server-renders `ui`, opens the popup the way a click before hydration did, then hydrates
       * it inside `act`. `beforeHydrate` runs between the two (the spies of a row).
       */
      async function hydrate(ui: ReactNode, beforeHydrate?: () => void) {
        const container = document.createElement("div");
        container.innerHTML = renderToString(ui);
        document.body.append(container);
        await config.openBeforeHydration(
          container.querySelector<HTMLElement>("[data-testid=popup]")!,
        );
        beforeHydrate?.();
        await act(async () => {
          render(ui, { container, hydrate: true });
        });
      }

      renderBoth("pre-hydration open", (mode) => {
        it("one dispatch with reason 'platform' and no event; accepted: content mounts", async () => {
          silenceErrors();
          let open!: MockInstance;
          const action = vi.fn<Action>();
          await hydrate(<Harness mode={mode} action={action} />, () => {
            open = spyOpen();
          });
          await flushTasks(2);
          expect(action).toHaveBeenCalledTimes(1);
          const [next, details] = action.mock.calls[0]!;
          expect(next).toBe(true);
          expect(details.reason).toBe("platform");
          expect(details.event).toBeUndefined();
          if (hasReturnValue) expect(returnValueOf(details)).toBeUndefined();
          expect(content()).toBeInTheDocument();
          expect(isOpen()).toBe(true);
          expect(open).not.toHaveBeenCalled();
          expectExpanded(true);
        });

        it("StrictMode still dispatches once", async () => {
          silenceErrors();
          const action = vi.fn<Action>();
          await hydrate(
            <StrictMode>
              <Harness mode={mode} action={action} />
            </StrictMode>,
          );
          await flushTasks(2);
          expect(action).toHaveBeenCalledTimes(1);
        });

        it("rejected: the popup is closed again and no close notification follows", async () => {
          silenceErrors();
          let close!: MockInstance;
          const action = vi.fn<Action>(async (next) => {
            if (next) throw new Error("not now");
          });
          await hydrate(<Harness mode={mode} action={action} catchErrors />, () => {
            close = spyClose();
          });
          await flushTasks(2);
          if (mode === "controlled") {
            expect(close).toHaveBeenCalledTimes(1);
            expect(isOpen()).toBe(false);
            expect(action).toHaveBeenCalledTimes(1); // the echo did not dispatch
          } else {
            // Uncontrolled: a caught error is success, so it commits `true` and stays open.
            expect(isOpen()).toBe(true);
          }
        });
      });

      it("a controlled parent refusing the pre-hydration open closes it, with no notification", async () => {
        silenceErrors();
        let close!: MockInstance;
        const action = vi.fn<Action>();
        await hydrate(<Harness mode="controlled" action={action} refuseOpen />, () => {
          close = spyClose();
        });
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(false);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it("a controlled `open` flipped programmatically opens and closes, no echo dispatch", async () => {
        const open = spyOpen();
        const close = spyClose();
        const action = vi.fn<Action>();
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
        expect(open).toHaveBeenCalledTimes(1);
        // No Trigger: no source (Popover's implicit anchor, design 2.7).
        expect(open).toHaveBeenCalledWith(...config.controlledOpenArgs);
        expect(isOpen()).toBe(true);
        await act(async () => setOpen(false));
        expect(close).toHaveBeenCalledTimes(1);
        // No part's value: a controlled close.
        expect(close).toHaveBeenCalledWith(...config.controlledCloseArgs);
        expect(isOpen()).toBe(false);
        await flushTasks(2);
        expect(action).not.toHaveBeenCalled();
        expect(content()).toBeNull();
      });

      it("defaultOpen opens after mount", async () => {
        const open = spyOpen();
        render(<Harness mode="uncontrolled" initialOpen />);
        expect(open).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expect(content()).toBeInTheDocument();
        expectExpanded(true);
      });
    });

    describe("close intents", () => {
      renderBoth("a part-initiated close, then a dismissal", (mode) => {
        it("the dismissal is reported as 'dismiss' (no stale intent from the part's close)", async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} />);
          await openThroughTrigger(user);
          await partClose(user);
          await flushTasks(2);
          expect(isOpen()).toBe(false);
          await openThroughTrigger(user);
          await act(async () => dismiss());
          await flushTasks(2);
          expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [true, "activate"],
            [false, "activate"],
            [true, "activate"],
            [false, "dismiss"],
          ]);
        });
      });

      const intents = config.closeIntents;
      if (intents) {
        // Close intents are recorded where nothing else reports the cause of a close (a native
        // close command, a Close with `action`): the clear (design/components/popover.md 2.3,
        // through the Root's `isShown`) is pinned on the context itself.
        it("an intent is dropped a task later while the popup stays open, kept once closed", async () => {
          let root: CloseIntents | null = null;
          function Probe() {
            root = intents!.useIntents();
            return null;
          }
          render(intents.render(<Probe />));
          const ctx = root! as CloseIntents;
          if (intents.open) act(() => intents.open!(popup()));
          expect(isOpen()).toBe(true);
          // A close that did not happen (a cancelled command): the popup is still open.
          ctx.recordCloseIntent({ reason: "activate", event: undefined });
          await flushTasks(1);
          expect(ctx.takeCloseIntent()).toBeUndefined();
          // A closed popup: the intent is not stale (it waits for the close event).
          act(() => dismiss());
          await flushTasks(1);
          expect(isOpen()).toBe(false);
          const intent = { reason: "activate", event: undefined } as const;
          ctx.recordCloseIntent(intent);
          await flushTasks(1);
          expect(ctx.takeCloseIntent()).toBe(intent);
        });
      }
    });
  });
}
