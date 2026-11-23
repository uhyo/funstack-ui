// Shared open-state suite for the overlays built on `useOverlayRoot` (src/internal/use-overlay-root.ts):
// Dialog, Popover and Menu (#106, audit T8). It pins the Root's contract through the public
// components: `openChangeAction` plumbing and `details`, optimistic open and pending, part-initiated
// closes (requests, library-owned: awaited, then the library closes) against dismissals (facts:
// the platform closed; `onOpenChange(false)` synchronously, committed `false` urgently, nothing
// pending; #148, design/components/overlay-open-change.md), rejection and revert, controlled
// refusal (an immediate re-open) and veto, overlapping and superseded dispatches (a fact supersedes
// every request), suspending content, the platform path (an open found on hydration, a controlled
// flip), the controlled-without-`onOpenChange` warning and the stale close-intent clear
// (design/components/popover.md 2.3).
//
// Each component's test file builds its harness with `createOverlayHarness` and calls
// `describeOverlayOpenState` with a driver; component-specific rows (Dialog's forms and
// `returnValue` leaks, Popover's foreign invokers, Menu's items) stay in those files. The jsdom
// shims stand in for the platform: a dismissal is driven with `requestClose()` / `hidePopover()`,
// which is what Escape or a light dismiss does.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useEffect, useState, useTransition } from "react";
import type {
  ComponentPropsWithRef,
  ComponentType,
  ReactElement,
  ReactNode,
  ViewTransitionClass,
} from "react";
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
  hydrateFromServer,
  renderBoth,
  setupUser,
  silenceErrors,
} from "./helpers.js";
import type { ControlMode, Deferred } from "./helpers.js";
import { spyHide, spyShow } from "./overlay-helpers.js";

/** `"static"`: no open-state props, JS-free mode (Dialog, Popover). */
export type OverlayHarnessMode = ControlMode | "static";

/** What every overlay's `openChangeAction` details have (Dialog's add `returnValue`). */
export interface OverlayDetailsLike {
  readonly reason: string;
  readonly event: Event | undefined;
}

export type OpenChangeFn<D> = (next: boolean, details: D) => unknown;

/** The open-state props the harness passes to the component's Root. */
export interface OverlayRootProps<D> {
  open?: boolean;
  defaultOpen?: boolean;
  openChangeAction?: (next: boolean, details: D) => Promise<void>;
  onOpenChange?: (next: boolean, details: D) => void;
}

export interface OverlayHarnessProps<D> {
  mode: OverlayHarnessMode;
  /** Initial committed open state. */
  initialOpen?: boolean;
  /** The consumer's work, awaited by the harness's `openChangeAction`. */
  action?: OpenChangeFn<D>;
  /**
   * The consumer's `onOpenChange` body (a fact, #148): called by the harness's handler before it
   * adopts the value; what it returns is returned to the library (a promise's rejection goes to
   * `reportError`).
   */
  fact?: OpenChangeFn<D>;
  /**
   * How the harness's `onOpenChange` adopts a fact: `"urgent"` (default: `setOpen(next)` in the
   * handler, as the docs say), `"transition"` (the late-adoption mistake: inside
   * `startTransition`), or `"omit"` (no `onOpenChange` at all: the W1 warning's case).
   */
  factAdoption?: "urgent" | "transition" | "omit";
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /**
   * Controlled mode: never adopt `false` (a parent that refuses to close), from the action or
   * from `onOpenChange`.
   */
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
 * (`startTransition` after the await, design 2.2) for requests and adopts facts in `onOpenChange`
 * directly (urgent, overlay-open-change.md 2.4); both modes mirror what the consumer was told in
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
    fact,
    factAdoption = "urgent",
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

    // `void` to the library, but the body's result is passed on: a returned promise is the
    // consumer's (its rejection goes to `reportError`).
    const onOpenChange = (next: boolean, details: D): void => {
      const result = fact?.(next, details);
      if (!(next && refuseOpen) && !(!next && refuseClose)) {
        if (factAdoption === "transition") startTransition(() => setOpen(next));
        else setOpen(next);
      }
      return result as void;
    };
    const handler = factAdoption === "omit" ? {} : { onOpenChange };

    const rootProps: OverlayRootProps<D> =
      mode === "static"
        ? {}
        : mode === "controlled"
          ? { open, openChangeAction, ...handler }
          : { defaultOpen: initialOpen, openChangeAction, ...handler };

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
  trigger?:
    | { disabled?: boolean; render?: ReactElement<Partial<ComponentPropsWithRef<"button">>> }
    | false;
  popup?: { className?: string; keepMounted?: boolean; transition?: ViewTransitionClass };
  /** Popup content; the default renders `data-testid="content"` (and Dialog's Close, value "x"). */
  content?: ReactNode;
}

type User = ReturnType<typeof setupUser>;

/**
 * A component with an async action of its own that waits for `until` once clicked: a transition
 * pending elsewhere in the app, which every other transition is entangled with (conventions 2.3
 * item 5). The row must settle `until` before it ends: React's entangled action lane is
 * module-wide, so a pending one would hold every later file's transitions.
 */
function Unrelated({ until }: { until: Promise<void> }) {
  const [busy, startBusy] = useTransition();
  return (
    <button
      type="button"
      data-testid="unrelated"
      data-busy={busy ? "" : undefined}
      onClick={() => startBusy(() => until)}
    >
      Unrelated
    </button>
  );
}

/** A library-owned close through a part of the overlay, by a click. */
export interface PartClose {
  /** Names the rows where a component has more than one (`"an item"`, `"the Trigger"`). */
  readonly name: string;
  readonly close: (user: User) => Promise<void>;
  /**
   * The click is cancelled: the part is an invoker whose native close command the library
   * replaces (Dialog's Close, a `popovertarget` Trigger); `false` for Menu's item, which has none.
   */
  readonly cancelsClick: boolean;
  /** The arguments of the library's close call (Dialog: the Close's `"x"`). */
  readonly closeArgs: readonly unknown[];
  /**
   * The close moves focus back to the Trigger from where the click left it inside the popup
   * (Dialog: the platform's dialog close; Menu: the library, also after a Trigger click, which
   * moves no focus). `false` for Popover's Trigger, which takes focus itself.
   */
  readonly returnsFocus: boolean;
}

/** How a row renders the Trigger: the default `<button>`, or a link `render` (no invoker). */
type TriggerKind = "button" | "link";

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
  /** The `type` of the event a dismissal's `onOpenChange` carries (`"close"`, `"toggle"`). */
  readonly dismissEvent: string;
  /**
   * The library-owned closes through a part, by a click (Dialog: the default content's Close part;
   * Popover: the Trigger; Menu: an action-less item and the Trigger). Every part-initiated close
   * row runs once per entry.
   */
  readonly partCloses: readonly [PartClose, ...PartClose[]];
  /**
   * The sorted keys of a Trigger click's `details` (`event` is virtual, conventions 2.2). With
   * `"returnValue"` (Dialog), `details.returnValue` is asserted (undefined for an open, the part's
   * or the dismissal's value for a close) and so is the dialog's `returnValue` after a part close.
   */
  readonly detailsKeys: readonly string[];
  /**
   * A Trigger click while open closes (Popover, Menu: library-owned, `"activate"`); `false`: the
   * Trigger only opens (Dialog), so a second click while optimistically open does nothing. Menu's
   * Trigger prevents its mousedown while open, so the press moves no focus out of the popup and
   * the click is the only close (design/components/menu.md 2.2, #110).
   */
  readonly triggerToggles: boolean;
  /**
   * The Trigger is a `popovertarget` invoker with no `aria-expanded`, and a non-button `render`
   * renders the `shown` mirror instead (Popover, Menu, #121; not Dialog).
   */
  readonly popoverTarget: boolean;
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
  "name" | "Harness" | "partCloses" | "closeIntents"
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
    popoverTarget: true,
    // A script's showPopover(): cancelled at `beforetoggle`, which is the dispatched event.
    foreignOpen: () => {
      let before!: Event;
      popup().addEventListener("beforetoggle", (event) => (before = event), { once: true });
      popup().showPopover();
      return before;
    },
    foreignOpenCallsOpen: true,
    // A click before hydration ran the `popovertarget` toggle natively; its `toggle` task ran too.
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
  const { Harness, isOpen, spyOpen, spyClose, dismiss, partCloses } = config;
  /** The row-name suffix of a part close, where the component has more than one. */
  const partName = (part: PartClose) => (partCloses.length > 1 ? ` [${part.name}]` : "");
  const hasReturnValue = config.detailsKeys.includes("returnValue");
  /** The transition type of the component's open (`fsui-popover-open`). */
  const openType = `fsui-${config.name.toLowerCase()}-open`;
  type Action = OpenChangeFn<D>;

  const trigger = () => screen.getByTestId("trigger");
  const popup = () => screen.getByTestId("popup");
  const content = () => screen.queryByTestId("content");
  const committedText = () => screen.getByTestId("committed").textContent;
  const returnValueOf = (details: D) =>
    (details as unknown as { returnValue?: unknown }).returnValue;
  /**
   * The Trigger kinds a row that reads the exposed open state runs with. A `<button>` Trigger is a
   * `popovertarget` invoker with no `aria-expanded`: the browser exposes the popup's state (#121),
   * which jsdom has no accessibility tree to show. A link `render` is no invoker and renders the
   * `shown` mirror as `aria-expanded` (#118), so the mirror's phases stay observable here. Dialog:
   * the button only.
   */
  const triggerKinds: readonly TriggerKind[] = config.popoverTarget
    ? ["button", "link"]
    : ["button"];
  const kindName = (kind: TriggerKind) => (kind === "link" ? " [link Trigger]" : "");
  const triggerProps = (kind: TriggerKind): Pick<OverlaySuiteHarnessProps<D>, "trigger"> => {
    if (kind === "button") return {};
    // The non-button Trigger's development warning (#115) is expected.
    silenceErrors();
    return { trigger: { render: <a href="#" /> } };
  };
  /**
   * Whether the popup is exposed as shown: a button Trigger names the popup in every phase and
   * renders no `aria-expanded`; a link Trigger renders the mirror's value.
   */
  const expectShown = (kind: TriggerKind, shown: boolean) => {
    if (!config.popoverTarget) return;
    if (kind === "button") {
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
    } else {
      expect(trigger()).not.toHaveAttribute("popovertarget");
      expect(trigger()).toHaveAttribute("aria-expanded", String(shown));
    }
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

        it("the library's own close is no fact: onOpenChange is not called", async () => {
          const user = setupUser();
          const fact = vi.fn<Action>();
          render(<Harness mode={mode} fact={fact} />);
          await openThroughTrigger(user);
          await user.click(trigger());
          await flushTasks(2);
          expect(isOpen()).toBe(false);
          expect(fact).not.toHaveBeenCalled();
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
      for (const kind of triggerKinds)
        it(`open: pending Trigger, popup closed and content unmounted until it resolves${kindName(kind)}`, async () => {
          const user = setupUser();
          const open = spyOpen();
          const d = deferred();
          render(<Harness mode={mode} {...triggerProps(kind)} action={() => d.promise} />);
          await user.click(trigger());
          // `aria-expanded` is the shown popup (committed); `data-open` the optimistic intent (#118).
          expectShown(kind, false);
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
          // `aria-expanded` mirrors the popup's `toggle`, a task after `showPopover()` (#118).
          await flushTasks(2);
          expectShown(kind, true);
          expect(trigger()).toHaveAttribute("data-open", "");
          expectNotPending(trigger());
        });

      for (const part of partCloses)
        for (const kind of triggerKinds)
          it(`part-initiated close: library-owned, open while openChangeAction(false) runs, closed on resolve${kindName(kind)}${partName(part)}`, async () => {
            const user = setupUser();
            const action = vi.fn<Action>();
            render(<Harness mode={mode} {...triggerProps(kind)} action={action} />);
            await openThroughTrigger(user);
            const d = deferred();
            action.mockImplementation(() => d.promise);
            const close = spyClose();
            await part.close(user);
            // The Root dispatched (a part with a native close command: its click was cancelled).
            expect(action).toHaveBeenCalledTimes(2);
            const [next, details] = action.mock.calls[1]!;
            expect(next).toBe(false);
            expect(details.reason).toBe("activate");
            if (hasReturnValue) expect(returnValueOf(details)).toBe("x");
            expect(details.event!.type).toBe("click");
            expect(details.event!.defaultPrevented).toBe(part.cancelsClick);
            // Still open while the action runs; the Trigger shows the Root's pending.
            expect(isOpen()).toBe(true);
            expect(close).not.toHaveBeenCalled();
            expect(content()).toBeInTheDocument();
            expectPending(trigger());
            expect(trigger()).not.toHaveAttribute("data-open");
            // Still shown, so still expanded until the close commits (#118).
            expectShown(kind, true);
            if (part.returnsFocus) expect(trigger()).not.toHaveFocus();
            await flushTasks(2);
            expect(isOpen()).toBe(true);
            expect(close).not.toHaveBeenCalled();
            expect(content()).toBeInTheDocument();
            expectPending(trigger());
            await act(async () => d.resolve());
            expect(close).toHaveBeenCalledTimes(1);
            expect(close).toHaveBeenCalledWith(...part.closeArgs);
            expect(isOpen()).toBe(false);
            if (hasReturnValue) expect((popup() as HTMLDialogElement).returnValue).toBe("x");
            expect(committedText()).toBe("false");
            expectNotPending(trigger());
            await flushTasks(2);
            expect(content()).toBeNull();
            // The close event is an echo: no second dispatch, and no fact.
            expect(action).toHaveBeenCalledTimes(2);
            // Focus moved back from the part to the Trigger.
            if (part.returnsFocus) expect(trigger()).toHaveFocus();
          });

      for (const kind of triggerKinds)
        it(`dismissal: a fact, onOpenChange(false, 'dismiss') in the platform's event; committed false at once, nothing pending${kindName(kind)}`, async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          // The fact handler returns a promise that never settles (a Server Function): not awaited.
          const fact = vi.fn<Action>(() => new Promise(() => {}));
          render(<Harness mode={mode} {...triggerProps(kind)} action={action} fact={fact} />);
          await openThroughTrigger(user);
          // A listener added after the library's runs after it in the same event: the handler
          // has been called by then (synchronously, in the platform's event).
          const calledInEvent = vi.fn();
          popup().addEventListener(config.dismissEvent, () =>
            calledInEvent(fact.mock.calls.length),
          );
          // What Escape or a click outside does: the platform closes at once.
          await act(async () => dismiss("x"));
          expect(isOpen()).toBe(false);
          await flushTasks(2);
          expect(calledInEvent).toHaveBeenCalledExactlyOnceWith(1);
          expect(fact).toHaveBeenCalledTimes(1);
          const [next, details] = fact.mock.calls[0]!;
          expect(next).toBe(false);
          expect(details.reason).toBe("dismiss");
          if (hasReturnValue) expect(returnValueOf(details)).toBe("x");
          expect(details.event!.type).toBe(config.dismissEvent);
          expect(Object.keys(details).sort()).toEqual(config.detailsKeys);
          // A request channel only: openChangeAction heard the open, nothing else.
          expect(action).toHaveBeenCalledTimes(1);
          // No pending state for a fact; committed (content) and optimistic (data-open) agree.
          expectNotPending(trigger());
          expect(trigger()).not.toHaveAttribute("data-open");
          expectShown(kind, false);
          expect(content()).toBeNull();
          expect(committedText()).toBe("false");
          expect(isOpen()).toBe(false);
        });

      it("a fact while an unrelated async action is pending elsewhere commits at once", async () => {
        const user = setupUser();
        const unrelated = deferred();
        render(
          <Harness
            mode={mode}
            outside={() => <Unrelated until={unrelated.promise} />}
            fact={() => {}}
          />,
        );
        await openThroughTrigger(user);
        // An async action in another component's transition, pending for the rest of the row: a
        // transition commit would be entangled with it (conventions 2.3 item 5), an urgent one is not.
        await user.click(screen.getByTestId("unrelated"));
        await act(async () => dismiss());
        await flushTasks(2);
        expect(screen.getByTestId("unrelated")).toHaveAttribute("data-busy", "");
        expect(content()).toBeNull();
        expect(committedText()).toBe("false");
        expect(trigger()).not.toHaveAttribute("data-open");
        expectNotPending(trigger());
        await act(async () => unrelated.resolve());
        expect(screen.getByTestId("unrelated")).not.toHaveAttribute("data-busy");
      });

      it("a commit between the platform's close and its event does not re-open", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        const fact = vi.fn<Action>();
        const { rerender } = render(<Harness mode={mode} action={action} fact={fact} />);
        await openThroughTrigger(user);
        const open = spyOpen();
        await act(async () => {
          dismiss();
          // A re-render of the Root lands before the queued close event.
          rerender(
            <Harness
              mode={mode}
              action={action}
              fact={fact}
              popup={{ className: "re-rendered" }}
            />,
          );
        });
        expect(popup()).toHaveClass("re-rendered");
        expect(isOpen()).toBe(false);
        await flushTasks(2);
        expect(open).not.toHaveBeenCalled();
        expect(isOpen()).toBe(false);
        expect(fact).toHaveBeenLastCalledWith(false, expect.anything());
      });

      for (const part of partCloses)
        it(`a dismissal during a pending part-initiated close is reported at once and supersedes it (overlay-open-change.md 2.5)${partName(part)}`, async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          const fact = vi.fn<Action>();
          render(<Harness mode={mode} action={action} fact={fact} />);
          await openThroughTrigger(user);
          const closing = deferred();
          action.mockImplementation(() => closing.promise);
          const close = spyClose();
          await part.close(user);
          expect(action).toHaveBeenCalledTimes(2);
          expect(isOpen()).toBe(true);
          // Escape while openChangeAction(false) runs: the platform closes at once.
          await act(async () => dismiss());
          await flushTasks(2);
          expect(isOpen()).toBe(false);
          // Asked, then told: both callbacks were called.
          expect(fact.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [false, "dismiss"],
          ]);
          expect(committedText()).toBe("false");
          expect(content()).toBeNull();
          expect(trigger()).not.toHaveAttribute("data-open");
          // The superseded request is still running: React's pending reports it (2.5, the one
          // honest leftover), without `data-open`.
          expectPending(trigger());
          close.mockClear();
          await act(async () => closing.resolve());
          await flushTasks(2);
          expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [true, "activate"],
            [false, "activate"],
          ]);
          expect(fact).toHaveBeenCalledTimes(1);
          // The apply effect found the popup closed: no second close.
          expect(close).not.toHaveBeenCalled();
          expect(isOpen()).toBe(false);
          expect(content()).toBeNull();
          expectNotPending(trigger());
        });

      for (const part of partCloses)
        it(`a superseded part close that rejects after the fact goes to reportError, not the boundary${partName(part)}`, async () => {
          const user = setupUser();
          silenceErrors();
          const reportError = vi.fn();
          vi.stubGlobal("reportError", reportError);
          const caught = vi.fn();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} fact={() => {}} boundary={caught} />);
          await openThroughTrigger(user);
          const closing = deferred();
          action.mockImplementation(() => closing.promise);
          await part.close(user);
          await act(async () => dismiss());
          await flushTasks(2);
          const err = new Error("superseded");
          await act(async () => closing.reject(err));
          await flushTasks(2);
          expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
          expect(caught).not.toHaveBeenCalled();
          expect(screen.getByTestId("popup")).toBeInTheDocument();
          expect(isOpen()).toBe(false);
          expectNotPending(trigger());
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

      for (const part of partCloses)
        it(`part-initiated close rejects: the boundary gets it, the library never closed the popup${partName(part)}`, async () => {
          const user = setupUser();
          silenceErrors();
          const caught = vi.fn();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} boundary={caught} />);
          await openThroughTrigger(user);
          const close = spyClose();
          const d = deferred();
          action.mockImplementation(() => d.promise);
          await part.close(user);
          expect(isOpen()).toBe(true);
          await act(async () => d.reject(new Error("save failed")));
          await flushTasks(2);
          expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
          expect(close).not.toHaveBeenCalled();
          // The boundary replaced the whole component (removing the popup closed it).
          expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
          expect(screen.queryByTestId("popup")).toBeNull();
        });

      for (const part of partCloses)
        it(`part-initiated close rejects, caught inside: uncontrolled closes, controlled stays${partName(part)}`, async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} catchErrors />);
          await openThroughTrigger(user);
          action.mockImplementation(async () => {
            throw new Error("handled");
          });
          await part.close(user);
          await flushTasks(2);
          expect(isOpen()).toBe(mode === "controlled");
        });

      it("a promise onOpenChange returns rejects: reportError, no boundary, the UI untouched", async () => {
        const user = setupUser();
        silenceErrors();
        const reportError = vi.fn();
        vi.stubGlobal("reportError", reportError);
        const caught = vi.fn();
        const err = new Error("save failed");
        render(<Harness mode={mode} fact={() => Promise.reject(err)} boundary={caught} />);
        await openThroughTrigger(user);
        await act(async () => dismiss());
        await flushTasks(2);
        expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
        expect(caught).not.toHaveBeenCalled();
        expect(screen.getByTestId("popup")).toBeInTheDocument();
        expect(isOpen()).toBe(false);
        expect(committedText()).toBe("false");
      });

      it("onOpenChange throws: reportError, and the fact still stands (committed false)", async () => {
        const user = setupUser();
        silenceErrors();
        const reportError = vi.fn();
        vi.stubGlobal("reportError", reportError);
        const caught = vi.fn();
        const err = new Error("handler bug");
        render(
          <Harness
            mode={mode}
            fact={() => {
              throw err;
            }}
            boundary={caught}
          />,
        );
        await openThroughTrigger(user);
        await act(async () => dismiss());
        await flushTasks(2);
        expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
        expect(caught).not.toHaveBeenCalled();
        // The library's bookkeeping ran before the call: committed `false`. The controlled
        // harness adopts after the body, so it never adopted: the popup re-opened.
        expect(isOpen()).toBe(mode === "controlled");
        if (mode === "uncontrolled") {
          expect(content()).toBeNull();
          expect(trigger()).not.toHaveAttribute("data-open");
        }
      });
    });

    describe("controlled refusal and veto", () => {
      for (const kind of triggerKinds)
        it(`a refused dismissal re-opens the popup at once, in the fact's commit; not a veto, nothing pending${kindName(kind)}`, async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          const fact = vi.fn<Action>();
          render(
            <Harness
              mode="controlled"
              {...triggerProps(kind)}
              action={action}
              fact={fact}
              refuseClose
            />,
          );
          await openThroughTrigger(user);
          const open = spyOpen();
          let hiddenByDismissal = true;
          await act(async () => {
            dismiss();
            hiddenByDismissal = !isOpen();
          });
          expect(hiddenByDismissal).toBe(true);
          // The fact's event: the parent was told `false`, kept `open={true}`; the commit that
          // follows re-applies it (no request, nothing to wait for).
          await flushTasks(1);
          expect(fact).toHaveBeenCalledTimes(1);
          expect(open).toHaveBeenCalledTimes(1);
          expect(isOpen()).toBe(true);
          expect(trigger()).toHaveAttribute("data-open", "");
          expectNotPending(trigger());
          expect(content()).toBeInTheDocument();
          // Expanded again with the re-show's `toggle`; no callback for the re-open.
          await flushTasks(2);
          expectShown(kind, true);
          expect(action).toHaveBeenCalledTimes(1);
          expect(fact).toHaveBeenCalledTimes(1);
        });

      it("a refused dismissal during a pending request re-opens once the request settled", async () => {
        const user = setupUser();
        const action = vi.fn<Action>();
        render(<Harness mode="controlled" action={action} fact={() => {}} refuseClose />);
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        await partCloses[0].close(user);
        const open = spyOpen();
        await act(async () => dismiss());
        await flushTasks(2);
        // The apply effect waits for the superseded request, as for every re-application.
        expect(isOpen()).toBe(false);
        expect(open).not.toHaveBeenCalled();
        await act(async () => d.resolve());
        await flushTasks(2);
        expect(open).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expectNotPending(trigger());
      });

      it("a controlled Root without onOpenChange warns once and re-opens after a dismissal", async () => {
        const user = setupUser();
        const errors = silenceErrors();
        render(<Harness mode="controlled" factAdoption="omit" />);
        await flushTasks(1);
        const warnings = () =>
          errors.mock.calls.filter(([m]) => String(m).includes("without `onOpenChange`"));
        expect(warnings()).toHaveLength(1);
        expect(String(warnings()[0]![0])).toContain("onOpenChange={setOpen}");
        await openThroughTrigger(user);
        const open = spyOpen();
        await act(async () => dismiss());
        await flushTasks(2);
        expect(open).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(true);
        expect(warnings()).toHaveLength(1);
      });

      it("no warning with onOpenChange, nor in uncontrolled mode without it", async () => {
        const errors = silenceErrors();
        const { unmount } = render(<Harness mode="controlled" />);
        await flushTasks(1);
        unmount();
        render(<Harness mode="uncontrolled" factAdoption="omit" />);
        await flushTasks(1);
        expect(
          errors.mock.calls.filter(([m]) => String(m).includes("without `onOpenChange`")),
        ).toHaveLength(0);
      });

      it("a parent that adopts the fact late (in startTransition) re-opens, then closes", async () => {
        const user = setupUser();
        render(<Harness mode="controlled" factAdoption="transition" />);
        await openThroughTrigger(user);
        const open = spyOpen();
        let close!: MockInstance;
        await act(async () => {
          dismiss();
          close = spyClose();
        });
        await flushTasks(2);
        // The documented mistake (overlay-open-change.md 2.4): `open={true}` in the event's own
        // commit re-opens the popup; the late `false` then closes it as a controlled close.
        expect(open).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(false);
        expect(committedText()).toBe("false");
      });

      for (const part of partCloses)
        for (const kind of triggerKinds)
          it(`a refused part-initiated close is a real veto: never closed, data-open snaps back (11.14)${kindName(kind)}${partName(part)}`, async () => {
            const user = setupUser();
            const action = vi.fn<Action>();
            const open = spyOpen();
            render(
              <Harness mode="controlled" {...triggerProps(kind)} action={action} refuseClose />,
            );
            await openThroughTrigger(user);
            open.mockClear();
            const close = spyClose();
            const d = deferred();
            action.mockImplementation(() => d.promise);
            await part.close(user);
            expect(trigger()).not.toHaveAttribute("data-open");
            expectShown(kind, true);
            await act(async () => d.resolve());
            await flushTasks(2);
            expect(close).not.toHaveBeenCalled();
            expect(open).not.toHaveBeenCalled(); // never blinked
            expect(isOpen()).toBe(true);
            expect(content()).toBeInTheDocument();
            expect(trigger()).toHaveAttribute("data-open", "");
            expectShown(kind, true);
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
      renderBoth("a dismissal, then the user re-opens", (mode) => {
        it("the fact pends nothing; the re-open is a plain request", async () => {
          const user = setupUser();
          const action = vi.fn<Action>();
          const fact = vi.fn<Action>();
          render(<Harness mode={mode} action={action} fact={fact} />);
          await openThroughTrigger(user);
          const opening = deferred();
          action.mockImplementationOnce(() => opening.promise);
          const open = spyOpen();
          await act(async () => dismiss());
          await flushTasks(2);
          expect(trigger()).not.toHaveAttribute("data-open");
          expectNotPending(trigger());
          await user.click(trigger());
          expect(action.mock.calls.map(([next]) => next)).toEqual([true, true]);
          expect(fact).toHaveBeenCalledTimes(1);
          expect(trigger()).toHaveAttribute("data-open", "");
          expectPending(trigger());
          expect(isOpen()).toBe(false);
          await act(async () => opening.resolve());
          await flushTasks(2);
          expectNotPending(trigger());
          expect(trigger()).toHaveAttribute("data-open", "");
          expect(isOpen()).toBe(true);
          expect(open).toHaveBeenCalledTimes(1);
          expect(content()).toBeInTheDocument();
        });
      });

      if (config.triggerToggles) {
        renderBoth(
          "close then open requested while shown, then a dismissal (2.5 row 3)",
          (mode) => {
            it("the fact wins: the pending open does not show the popup when it resolves (uncontrolled)", async () => {
              const user = setupUser();
              const action = vi.fn<Action>();
              const fact = vi.fn<Action>();
              render(<Harness mode={mode} action={action} fact={fact} />);
              await openThroughTrigger(user);
              const closing = deferred();
              const opening = deferred();
              action.mockImplementationOnce(() => closing.promise);
              action.mockImplementationOnce(() => opening.promise);
              // Two clicks while shown: a close requested, then an open requested again; the popup
              // never hid.
              await user.click(trigger());
              await user.click(trigger());
              expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
              expect(isOpen()).toBe(true);
              expect(trigger()).toHaveAttribute("data-open", "");
              const open = spyOpen();
              await act(async () => dismiss());
              await flushTasks(2);
              expect(fact).toHaveBeenCalledTimes(1);
              // The stale optimistic `true` was dropped in the fact's commit.
              expect(trigger()).not.toHaveAttribute("data-open");
              expect(content()).toBeNull();
              await act(async () => opening.resolve());
              await act(async () => closing.resolve());
              await flushTasks(2);
              expectNotPending(trigger());
              if (mode === "uncontrolled") {
                expect(isOpen()).toBe(false);
                expect(open).not.toHaveBeenCalled();
                expect(trigger()).not.toHaveAttribute("data-open");
              } else {
                // A controlled parent's own later updates are its own (2.4): the harness adopts each
                // resolution in arrival order, the close last.
                expect(committedText()).toBe("false");
                expect(isOpen()).toBe(false);
              }
            });
          },
        );
      }

      if (config.triggerToggles) {
        renderBoth("second click during a pending open (walkthrough 11.7)", (mode) => {
          for (const kind of triggerKinds)
            it(`both actions run, the popup never opens, the latest intent wins${kindName(kind)}`, async () => {
              const user = setupUser();
              const open = spyOpen();
              const opening = deferred();
              const closing = deferred();
              const action = vi.fn<Action>();
              action.mockImplementationOnce(() => opening.promise);
              action.mockImplementationOnce(() => closing.promise);
              render(<Harness mode={mode} {...triggerProps(kind)} action={action} />);
              await user.click(trigger());
              await user.click(trigger());
              expect(action).toHaveBeenCalledTimes(2);
              expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
              expectShown(kind, false);
              expect(trigger()).not.toHaveAttribute("data-open");
              expectPending(trigger());
              // Out of order: the close first, then the superseded open.
              await act(async () => closing.resolve());
              await act(async () => opening.resolve());
              await flushTasks(2);
              expectNotPending(trigger());
              if (mode === "uncontrolled") {
                expectShown(kind, false);
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
      /**
       * The older dispatch's settle after the newer one's, in both orders: the rejection goes to
       * `reportError`, not the boundary, and the overlay ends as the newer dispatch left it.
       */
      function rows(
        newerOpen: boolean,
        setup: () => Promise<{ caught: Mock; older: Deferred<void>; newer: Deferred<void> }>,
      ) {
        it.each([
          ["after the newer resolved", true],
          ["while the newer is pending", false],
        ] as const)(
          "the older dispatch rejects %s: reported, not thrown",
          async (_label, newerFirst) => {
            const reportError = vi.fn();
            vi.stubGlobal("reportError", reportError);
            const { caught, older, newer } = await setup();
            if (newerFirst) await act(async () => newer.resolve());
            const err = new Error("older");
            await act(async () => older.reject(err));
            await flushTasks(2);
            expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
            if (!newerFirst) await act(async () => newer.resolve());
            await flushTasks(2);
            expect(caught).not.toHaveBeenCalled();
            expect(reportError).toHaveBeenCalledTimes(1);
            expect(isOpen()).toBe(newerOpen);
            expectNotPending(trigger());
          },
        );
      }

      renderBoth("a part close, a dismissal, then a re-open", (mode) => {
        rows(true, async () => {
          const user = setupUser();
          silenceErrors();
          const caught = vi.fn();
          const action = vi.fn<Action>();
          render(<Harness mode={mode} action={action} fact={() => {}} boundary={caught} />);
          await openThroughTrigger(user);
          const older = deferred();
          const newer = deferred();
          action.mockImplementationOnce(() => older.promise);
          action.mockImplementationOnce(() => newer.promise);
          await partCloses[0].close(user);
          await act(async () => dismiss());
          await flushTasks(2);
          await user.click(trigger());
          return { caught, older, newer };
        });
      });

      if (config.triggerToggles) {
        renderBoth("an open, then a close click", (mode) => {
          rows(false, async () => {
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
      for (const kind of triggerKinds)
        it(`keeps the popup closed and the Trigger pending until the content is ready${kindName(kind)}`, async () => {
          const user = setupUser();
          const open = spyOpen();
          const suspender = createSuspender();
          render(
            <Harness
              mode={mode}
              {...triggerProps(kind)}
              suspense
              content={<suspender.Suspender value="details" />}
            />,
          );
          await user.click(trigger());
          await flushTasks(2);
          expect(open).not.toHaveBeenCalled();
          expect(isOpen()).toBe(false);
          expectPending(trigger());
          expectShown(kind, false);
          expect(screen.queryByTestId("fallback")).toBeNull();
          await act(async () => suspender.resolve("details", "Order details"));
          expect(open).toHaveBeenCalledTimes(1);
          expect(isOpen()).toBe(true);
          expect(screen.getByTestId("suspender")).toHaveTextContent("Order details");
          await flushTasks(2);
          expectShown(kind, true);
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
        await hydrateFromServer(ui, {
          mutate: async (container) => {
            await config.openBeforeHydration(
              container.querySelector<HTMLElement>("[data-testid=popup]")!,
            );
            beforeHydrate?.();
          },
          inAct: true,
          flush: null,
        });
      }

      renderBoth("pre-hydration open", (mode) => {
        for (const kind of triggerKinds)
          it(`one dispatch with reason 'platform' and no event; accepted: content mounts${kindName(kind)}`, async () => {
            silenceErrors();
            let open!: MockInstance;
            const action = vi.fn<Action>();
            await hydrate(<Harness mode={mode} {...triggerProps(kind)} action={action} />, () => {
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
            expectShown(kind, true);
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

        it("rejected: the popup is closed again, no close dispatch and no fact follows", async () => {
          silenceErrors();
          let close!: MockInstance;
          const fact = vi.fn<Action>();
          const action = vi.fn<Action>(async (next) => {
            if (next) throw new Error("not now");
          });
          await hydrate(<Harness mode={mode} action={action} fact={fact} catchErrors />, () => {
            close = spyClose();
          });
          await flushTasks(2);
          if (mode === "controlled") {
            expect(close).toHaveBeenCalledTimes(1);
            expect(isOpen()).toBe(false);
            expect(action).toHaveBeenCalledTimes(1); // the echo did not dispatch
            expect(fact).not.toHaveBeenCalled(); // nor was it a fact
          } else {
            // Uncontrolled: a caught error is success, so it commits `true` and stays open.
            expect(isOpen()).toBe(true);
          }
        });
      });

      it("a controlled parent refusing the pre-hydration open closes it, with no dispatch or fact", async () => {
        silenceErrors();
        let close!: MockInstance;
        const action = vi.fn<Action>();
        const fact = vi.fn<Action>();
        await hydrate(<Harness mode="controlled" action={action} fact={fact} refuseOpen />, () => {
          close = spyClose();
        });
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(false);
        expect(action).toHaveBeenCalledTimes(1);
        expect(fact).not.toHaveBeenCalled();
      });

      it("a controlled `open` flipped programmatically opens and closes, no echo dispatch or fact", async () => {
        const open = spyOpen();
        const close = spyClose();
        const action = vi.fn<Action>();
        const fact = vi.fn<Action>();
        let setOpen!: (open: boolean) => void;
        render(
          <Harness
            mode="controlled"
            action={action}
            fact={fact}
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
        expect(fact).not.toHaveBeenCalled();
        expect(content()).toBeNull();
      });

      for (const kind of triggerKinds)
        it(`defaultOpen opens after mount${kindName(kind)}`, async () => {
          const open = spyOpen();
          render(<Harness mode="uncontrolled" {...triggerProps(kind)} initialOpen />);
          expect(open).toHaveBeenCalledTimes(1);
          expect(isOpen()).toBe(true);
          expect(content()).toBeInTheDocument();
          // Not expanded until the popup's `toggle` reports it shown (#118).
          expectShown(kind, false);
          await flushTasks(2);
          expectShown(kind, true);
        });
    });

    // The popup's children stay mounted through the close commit unless a `transition` animates
    // them out (design/components/popover.md 4.4): without one the content is released once the
    // close event found no exit animation; with one, the old snapshot carries it out.
    describe("held content (design 4.4)", () => {
      /**
       * Reads the DOM when the popup starts to close: its closing `beforetoggle`, which the shims
       * dispatch synchronously inside the library's close call in the close commit.
       */
      function atClose<T>(read: () => T): { readonly value: () => T | undefined } {
        let value: T | undefined;
        let seen = false;
        popup().addEventListener("beforetoggle", (event) => {
          if (seen || (event as ToggleEvent).newState !== "closed") return;
          seen = true;
          value = read();
        });
        return { value: () => value };
      }
      const committedAndContent = () => [committedText(), content() !== null] as const;

      for (const part of partCloses) {
        it(`without transition a part-initiated close keeps the children through the close commit${partName(part)}`, async () => {
          const user = setupUser();
          render(<Harness mode="uncontrolled" />);
          await openThroughTrigger(user);
          const seen = atClose(committedAndContent);
          await part.close(user);
          await flushTasks(2);
          expect(seen.value()).toEqual(["false", true]);
          expect(isOpen()).toBe(false);
          // Released after the close event found no exit animation.
          expect(content()).toBeNull();
        });

        it(`with transition the children are gone in the close commit${partName(part)}`, async () => {
          const user = setupUser();
          render(<Harness mode="uncontrolled" popup={{ transition: "pop" }} />);
          await openThroughTrigger(user);
          expect(content()).toBeInTheDocument();
          const seen = atClose(committedAndContent);
          await part.close(user);
          await flushTasks(2);
          expect(seen.value()).toEqual(["false", false]);
          expect(isOpen()).toBe(false);
        });

        it(`keepMounted: the Activity stays visible through the close commit, hidden after${partName(part)}`, async () => {
          const user = setupUser();
          render(<Harness mode="uncontrolled" popup={{ keepMounted: true }} />);
          await openThroughTrigger(user);
          const seen = atClose(() => content()!.style.display);
          await part.close(user);
          await flushTasks(2);
          expect(seen.value()).not.toBe("none");
          expect(content()!.style.display).toBe("none");
        });
      }

      it("without transition a controlled close keeps the children through the close commit, mounted once", async () => {
        let setOpen!: (open: boolean) => void;
        const mounts = vi.fn();
        function Content() {
          useEffect(() => mounts(), []);
          return <span data-testid="content" />;
        }
        render(
          <Harness
            mode="controlled"
            initialOpen
            content={<Content />}
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        const seen = atClose(committedAndContent);
        await act(async () => setOpen(false));
        expect(seen.value()).toEqual(["false", true]);
        await flushTasks(2);
        expect(content()).toBeNull();
        expect(mounts).toHaveBeenCalledTimes(1);
      });

      it("a dismissal's fact commit unmounts the children (no exit animation); a re-open mounts them again", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" />);
        await openThroughTrigger(user);
        await act(async () => dismiss());
        await flushTasks(2);
        await flushTasks(2);
        expect(content()).toBeNull();
        await openThroughTrigger(user);
        expect(content()).toBeInTheDocument();
      });

      // Keyed by the type the component's open carries (conventions 5.3: `fsui-<component>-open`).
      it("renders with a `transition` type map", async () => {
        const user = setupUser();
        render(
          <Harness
            mode="uncontrolled"
            popup={{ transition: { [openType]: "pop-in", default: "none" } }}
          />,
        );
        await openThroughTrigger(user);
        expect(content()).toBeInTheDocument();
        await partCloses[0].close(user);
        await flushTasks(2);
        expect(isOpen()).toBe(false);
      });
    });

    describe("close intents", () => {
      renderBoth("a part-initiated close, then a dismissal", (mode) => {
        for (const part of partCloses)
          it(`the dismissal is reported as 'dismiss' (no stale intent from the part's close)${partName(part)}`, async () => {
            const user = setupUser();
            const action = vi.fn<Action>();
            const fact = vi.fn<Action>();
            render(<Harness mode={mode} action={action} fact={fact} />);
            await openThroughTrigger(user);
            await part.close(user);
            await flushTasks(2);
            expect(isOpen()).toBe(false);
            await openThroughTrigger(user);
            await act(async () => dismiss());
            await flushTasks(2);
            expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
              [true, "activate"],
              [false, "activate"],
              [true, "activate"],
            ]);
            expect(fact.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
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
