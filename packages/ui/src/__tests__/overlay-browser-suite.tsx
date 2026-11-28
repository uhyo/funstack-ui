// Shared browser rows for the overlays built on `useOverlayRoot` and `usePopoverPopup`: Dialog,
// Popover and Menu (#109, audit T8). They need a real engine: Escape as a close request and the
// platform's focus return, CSS exit animations and the deferred unmount (design 4.4), and
// `<ViewTransition>` around the top-layer element (the library-owned closes run inside the update
// callback; a dismissal is a fact, an urgent commit that starts none: #148,
// conventions 3.9.8). The jsdom half is overlay-open-state-suite.tsx.
//
// Each component's `.browser.test.tsx` calls `describeOverlayInBrowser` with a driver; the rows
// that differ per component (Dialog's 10.3 capture, the focus return of a keyboard-activated Close,
// Popover's shielded `transition="none"`, Menu's submenus) stay in those files.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - Firefox animates no CSS exit of a popover or a dialog (bug 1834877): the exit rows branch on
//   what `getAnimations()` found when the popup closed; Chromium must find something.
// - WebKit (CI, Playwright's WebKit build, 2026-10): a closing box is already `display: none` at
//   `ready` with or without the library's CSS transition cut (#147), yet WebKit lists the animation of its group under
//   `::view-transition-new(<name>)` and none under `old`. The names are not reliable there, so the
//   WebKit rows assert the box's `display` only.
import { act, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addStyle,
  animationsFinished,
  flushFor,
  leaveActEnvironment,
  onCleanup,
  quietPeriod,
  settle,
  sleep,
  spyViewTransitions,
} from "./browser-helpers.js";
import { expectInvokerExpanded } from "./ax-tree.js";
import { mouse } from "./browser-commands.js";
import { user } from "./browser-user.js";
import { browserName, pressFocusesButtons } from "./engine.js";
import { deferred } from "./helpers.js";

/** What every overlay's `openChangeAction` details have. */
interface OverlayDetailsLike {
  readonly reason: string;
  readonly event: Event | undefined;
}

type OpenChangeFn<D> = (next: boolean, details: D) => unknown;

/**
 * The library-mode harness of the exit and Escape rows. Parts carry the test ids `trigger` and
 * `popup`; the popup's first content is `data-testid="content"` (Menu: an item), followed by the
 * driver's part close and `inside`.
 */
export interface OverlayBrowserHarnessProps<D> {
  action?: OpenChangeFn<D>;
  /** The Root's `onOpenChange` (facts: dismissals). */
  fact?: OpenChangeFn<D>;
  /** The Popup's class (the exit CSS). */
  className?: string;
  /** Rendered inside the popup after the default content (a running progress bar). */
  inside?: ReactNode;
}

/**
 * The ViewTransition rows' harness: no wrapper element above the Root, so a Root inserted by a
 * transition has the Popup's boundary at the top of the subtree. The popup holds
 * `data-testid="content"`. `controlled` (a controlled Root) is passed only by a `partCloses` entry
 * that sets it (Dialog); a harness without a controlled variant throws on it.
 */
export interface OverlayViewTransitionProps {
  transition?: ViewTransitionClass;
  className?: string;
  controlled?: boolean;
}

/** A library-owned close the ViewTransition rows run, by an in-page click outside `act`. */
export interface OverlayViewTransitionClose {
  /** Completes the titles: `the open and ${name} each run one view transition`. */
  readonly name: string;
  /** Render `Plain` controlled (Dialog: a parent's `open={false}`). */
  readonly controlled?: boolean;
  readonly close: () => void;
  /** Extra checks once the close's view transition finished (Dialog's `returnValue`). */
  readonly afterClose?: () => void | Promise<void>;
}

/** What every `OverlayPressWhileOpen` has. */
interface PressBase<D> {
  /** Completes the title: `a real press on ${name} …`. */
  readonly name: string;
  /** The pressed element. */
  readonly target: () => Element;
  /**
   * The pressed point, relative to the target's top-left corner; the centre without it. A
   * negative offset presses outside the target (a modal dialog's `::backdrop`).
   */
  readonly at?: { readonly x: number; readonly y: number };
  /**
   * Where focus is right after the press: `"target"` (a button the engine focuses on press,
   * where `pressFocusesButtons()`), `"unchanged"` (what had focus before: the press is
   * prevented), or the element the engine focuses instead. Where `pressFocusesButtons()` is
   * `false` (Safari on macOS; no engine in CI), `"target"` expects what had focus before: that
   * branch is unverified, and macOS WebKit may instead clear focus or focus the nearest
   * mouse-focusable ancestor (the `<dialog>`).
   */
  readonly focusAtPress: "target" | "unchanged" | (() => Element);
  /** Renders this harness instead of the config's (Dialog with `lightDismiss`, a form). */
  readonly Harness?: ComponentType<OverlayBrowserHarnessProps<D>>;
}

/** Focus once the popup closed; `pressFocused`: the press focused the target. */
type FocusAfter = (ctx: { readonly pressFocused: boolean }) => Element;

/**
 * A library-owned close: the popup stays shown through the pending `openChangeAction(false)` and
 * hides when it settles (conventions 3.5, the single source of the close).
 */
interface AwaitedPress<D> extends PressBase<D> {
  readonly outcome: "awaited";
  /** `details.event.type` of the close (default `"click"`; a dialog form: `"submit"`). */
  readonly eventType?: string;
  readonly focusAfter: FocusAfter;
}

/**
 * A browser-owned close (light dismiss, or a library hide shaped like one), hidden at once and
 * reported to `onOpenChange` with `"dismiss"` (a fact). A browser-owned close with another reason (Popover's foreign
 * invoker, `"activate"`) is a bespoke row.
 */
interface DismissedPress<D> extends PressBase<D> {
  readonly outcome: "dismissed";
  /**
   * The popup closes on focus leaving (Menu 2.2), so it is hidden at the press rather than the
   * release, but only where the press focused the target (`focusAtPress: "target"` and
   * `pressFocusesButtons()`); elsewhere it is the release's light dismiss.
   */
  readonly hiddenAtPressIfFocused?: boolean;
  readonly focusAfter: FocusAfter;
}

/** Nothing closes and nothing is dispatched. */
interface StaysOpenPress<D> extends PressBase<D> {
  readonly outcome: "stays-open";
}

/**
 * A real mouse press on something while the popup is open (#117): one entry per "click X while
 * open" row of the component's closing table. jsdom fires mousedown, mouseup and click in one
 * task; a real engine runs focus, light dismiss and `toggle` tasks between them, which is where
 * #110, #112, #115 and #116 hid.
 */
export type OverlayPressWhileOpen<D> = AwaitedPress<D> | DismissedPress<D> | StaysOpenPress<D>;

export interface OverlayBrowserConfig<D extends OverlayDetailsLike> {
  /** The describe block's name (`"Dialog"`). */
  readonly name: string;
  readonly Harness: ComponentType<OverlayBrowserHarnessProps<D>>;
  /** Whether `popup` is shown (`dialog.open`, `:popover-open`). */
  readonly isOpen: (popup: Element) => boolean;
  /**
   * The pseudo-class of the open popup in the exit CSS. `":open"` (a modal dialog) also fades the
   * `::backdrop`.
   */
  readonly openPseudo: ":open" | ":popover-open";
  /** Opens `Harness` through the Trigger (as a user does) and waits for the popup. */
  readonly open: () => Promise<void>;
  /**
   * A library-owned close of `Harness` through a part, by real input (Dialog: the Close part;
   * Popover: the Trigger; Menu: Enter on the focused item).
   */
  readonly partClose: () => Promise<void>;
  /** The event the platform's close fires and a dismissal's `onOpenChange` details carry. */
  readonly dismissEvent: "close" | "toggle";
  /**
   * The Trigger is a `popovertarget` invoker with no `aria-expanded`, whose exposed state the
   * browser computes from the popup (Popover, Menu, #121; not Dialog).
   */
  readonly popoverTarget: boolean;
  /** Extra checks on an Escape's `details` (Dialog: `returnValue` is `""`). */
  readonly dismissDetails?: (details: D) => void;
  /** The "click X while open" rows of the closing table (#117). */
  readonly pressesWhileOpen: readonly OverlayPressWhileOpen<D>[];
  readonly viewTransition: {
    readonly Plain: ComponentType<OverlayViewTransitionProps>;
    /** The library-owned closes; the first one is used by the rows that need just one. */
    readonly partCloses: readonly [OverlayViewTransitionClose, ...OverlayViewTransitionClose[]];
    /**
     * The platform closes the popup outside `act` (Dialog: a real Escape; Popover, Menu:
     * `hidePopover()`, which is what Escape or a light dismiss does).
     */
    readonly dismiss: () => void | Promise<void>;
    /** Extra checks once the open's view transition finished (Dialog: `:modal`; Menu: focus). */
    readonly afterOpen?: () => void;
  };
  /**
   * The JS-free mode, where the overlay has one (Dialog, Popover; not Menu): the "JS-free
   * `data-open`" rows (conventions 7.4, #201). `Harness` renders a Root without open props, the
   * Trigger (`trigger`, with `className={({ open }) => open ? "state-open" : "state-closed"}`),
   * the Popup (`popup`) and an action-less Close (`close`); `withTrigger={false}` leaves the
   * Trigger out.
   */
  readonly jsFree?: {
    readonly Harness: ComponentType<{ withTrigger?: boolean }>;
  };
}

/**
 * A CSS exit on a popup (design 10.1): `opacity` with `display` and `overlay` held for
 * `duration`. `openPseudo` `":open"` (a modal dialog) also fades the `::backdrop`.
 * `instantEnter`: no enter fade. No consumer rule for view transitions: the library cuts the fade
 * around its own show and hide while one runs (#147).
 */
export function addExitStyle(
  className: string,
  duration: string,
  {
    openPseudo,
    instantEnter = false,
  }: { openPseudo: ":open" | ":popover-open"; instantEnter?: boolean },
): void {
  const boxes = (state = "") =>
    openPseudo === ":open"
      ? `.${className}${state}, .${className}${state}::backdrop`
      : `.${className}${state}`;
  addStyle(`
    ${boxes()} {
      opacity: 0;
      transition: opacity ${duration}, display ${duration} allow-discrete, overlay ${duration} allow-discrete;
    }
    ${boxes(openPseudo)} { opacity: 1;${instantEnter ? " transition-duration: 0s;" : ""} }
    ${instantEnter ? "" : `@starting-style { ${boxes(openPseudo)} { opacity: 0; } }`}
  `);
}

/**
 * Resolves with the exit animations the engine runs when `popup` closes, read in its `close` /
 * closing `toggle` (a queued task, so a row awaits it rather than assuming one flush ran it).
 */
export function watchExit(popup: Element, type: "close" | "toggle"): Promise<Animation[]> {
  return new Promise((resolve) => {
    popup.addEventListener(type, function listener(event) {
      if (event instanceof ToggleEvent && event.newState !== "closed") return;
      popup.removeEventListener(type, listener);
      void getComputedStyle(popup).opacity;
      resolve(popup.getAnimations({ subtree: true }));
    });
  });
}

/**
 * Ends the exit; the unmount is an update the Popup makes when the animations finish, so this
 * runs inside `act`.
 */
export function finishExit(animations: readonly Animation[]): Promise<void> {
  return act(async () => {
    for (const animation of animations) animation.finish();
    await Promise.allSettled(animations.map((animation) => animation.finished));
    await sleep(20);
  });
}

/** Counts the elements with `data-testid={testId}` added under `root` until `stop()`. */
function countMounts(root: Element, testId: string): { stop: () => number } {
  let mounts = 0;
  const selector = `[data-testid="${testId}"]`;
  const count = (records: readonly MutationRecord[]) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) {
          mounts++;
        }
      }
    }
  };
  const observer = new MutationObserver(count);
  observer.observe(root, { childList: true, subtree: true });
  return {
    stop: () => {
      count(observer.takeRecords());
      observer.disconnect();
      return mounts;
    },
  };
}

/** The ViewTransition rows' spy: what `setUpViewTransitionRows` gives a describe block. */
export interface ViewTransitionRows {
  /** One entry per `startViewTransition` call: whether the popup was open at the call. */
  readonly calls: readonly { readonly openAtStart: boolean }[];
  readonly transitions: readonly ViewTransition[];
  /** Opens through the Trigger and waits for the open's view transition (if any). */
  readonly open: () => Promise<void>;
}

/**
 * Registers, in the calling describe block, the setup of rows that click in-page outside `act`
 * and watch document view transitions: the `startViewTransition` spy, React's act environment
 * off, and the `.pop` keyframes. `isOpen` reads the popup (`data-testid="popup"`).
 */
export function setUpViewTransitionRows(isOpen: (popup: Element) => boolean): ViewTransitionRows {
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    ({ transitions } = spyViewTransitions(() => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element ? isOpen(element) : false });
    }));
    leaveActEnvironment();
    addStyle(`
      ::view-transition-old(.pop) { animation: 60ms ease-in both vt-pop-out; }
      ::view-transition-new(.pop) { animation: 60ms ease-out both vt-pop-in; }
      @keyframes vt-pop-out { to { opacity: 0; } }
      @keyframes vt-pop-in { from { opacity: 0; } }
    `);
  });

  afterEach(async () => {
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  return {
    get calls() {
      return calls;
    },
    get transitions() {
      return transitions;
    },
    open: async () => {
      screen.getByTestId("trigger").click();
      await expect.poll(() => isOpen(screen.getByTestId("popup"))).toBe(true);
      await Promise.allSettled(transitions.map((t) => t.finished));
    },
  };
}

export function describeOverlayInBrowser<D extends OverlayDetailsLike>(
  config: OverlayBrowserConfig<D>,
): void {
  const { Harness, openPseudo } = config;
  const { Plain, partCloses, dismiss } = config.viewTransition;
  type Action = OpenChangeFn<D>;

  const trigger = () => screen.getByTestId("trigger");
  const popup = () => screen.getByTestId("popup");
  const content = () => screen.queryByTestId("content");
  const isOpen = () => config.isOpen(popup());

  describe(`${config.name} (shared overlay suite)`, () => {
    if (config.jsFree !== undefined) {
      const { Harness: Static } = config.jsFree;
      describe("JS-free data-open on the Trigger (conventions 7.4)", () => {
        it("follows the popup: the Trigger's open, the Close, Escape; state.open stays false", async () => {
          render(<Static />);
          expect(trigger()).not.toHaveAttribute("data-open");
          await user.click(trigger());
          expect(isOpen()).toBe(true);
          await expect.poll(() => trigger().hasAttribute("data-open")).toBe(true);
          // React holds no value in this mode (conventions 4.1 rule 3).
          expect(trigger()).toHaveClass("state-closed");
          await user.click(screen.getByTestId("close"));
          expect(isOpen()).toBe(false);
          await expect.poll(() => trigger().hasAttribute("data-open")).toBe(false);
          await user.click(trigger());
          await expect.poll(() => trigger().hasAttribute("data-open")).toBe(true);
          await user.keyboard("{Escape}");
          expect(isOpen()).toBe(false);
          await expect.poll(() => trigger().hasAttribute("data-open")).toBe(false);
          expect(trigger()).toHaveClass("state-closed");
        });

        it("a Trigger mounted while the popup is open picks the state up", async () => {
          const { rerender } = render(<Static withTrigger={false} />);
          const element = popup();
          await act(async () => {
            if (element.hasAttribute("popover")) element.showPopover();
            else (element as HTMLDialogElement).showModal();
          });
          expect(isOpen()).toBe(true);
          rerender(<Static />);
          expect(trigger()).toHaveAttribute("data-open", "");
          await act(async () => {
            if (element.hasAttribute("popover")) element.hidePopover();
            else (element as HTMLDialogElement).close();
          });
          await expect.poll(() => trigger().hasAttribute("data-open")).toBe(false);
        });
      });
    }

    it("Escape closes: a 'dismiss' fact to onOpenChange, nothing pending; focus returns to the Trigger", async () => {
      const action = vi.fn<Action>();
      const fact = vi.fn<Action>();
      render(<Harness action={action} fact={fact} />);
      await config.open();
      await user.keyboard("{Escape}");
      expect(isOpen()).toBe(false);
      expect(trigger()).toHaveFocus();
      await settle(() => expect(fact).toHaveBeenCalledTimes(1));
      expect(action).toHaveBeenCalledTimes(1);
      expect(trigger()).not.toHaveAttribute("data-pending");
      expect(trigger()).not.toHaveAttribute("data-open");
      const [next, details] = fact.mock.calls[0]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      config.dismissDetails?.(details);
      expect(details.event?.type).toBe(config.dismissEvent);
      if (config.popoverTarget) await expectInvokerExpanded(trigger(), popup(), false);
    });

    describe("exit animation and the deferred unmount", () => {
      async function expectHeldThenReleased(exit: Promise<Animation[]>) {
        let animations: Animation[] = [];
        await act(async () => {
          animations = await exit;
        });
        // Chromium animates the exit: the held branch below must not pass vacuously there.
        if (browserName === "chromium") expect(animations.length).toBeGreaterThan(0);
        if (animations.length > 0) {
          // Chromium / WebKit: the popup is still fading out; the content stays.
          expect(content()).not.toBeNull();
          await finishExit(animations);
          expect(content()).toBeNull();
        } else {
          // Firefox: `display` flips at once (bug 1834877); nothing to wait for.
          expect(content()).toBeNull();
        }
      }

      const closes = [
        ["a part-initiated close", () => config.partClose()],
        ["an Escape dismissal", () => user.keyboard("{Escape}")],
      ] as const;

      // A fade whose exit outlasts any test (#71): the enter is instant and the exit takes 60 s,
      // so the "content still there" check cannot race a 300 ms fade against Playwright round
      // trips under load. The row ends the exit itself with `finish()` and expects the release.
      it.each(closes)(
        "%s keeps the content while the CSS exit runs; none in Firefox",
        async (_, close) => {
          addExitStyle("held-exit", "60s", { openPseudo, instantEnter: true });
          render(<Harness className="held-exit" />);
          await config.open();
          const exit = watchExit(popup(), config.dismissEvent);
          await close();
          await settle(() => expect(isOpen()).toBe(false));
          await expectHeldThenReleased(exit);
        },
      );

      // A finite animation already running inside (a progress bar) is not the exit: the release
      // waits for the CSS exit only, not for the bar (#64). A Web Animations API animation keeps
      // running on a hidden element in every engine, so without the baseline all three would
      // hold the content for the bar's 10 s.
      it.each(closes)(
        "%s ignores a finite animation that was already running inside",
        async (_, close) => {
          addExitStyle("fade", "100ms", { openPseudo });
          let bar: Animation | undefined;
          render(
            <Harness
              className="fade"
              inside={
                <div
                  ref={(element) => {
                    bar ??= element?.animate([{ width: "0px" }, { width: "100px" }], 10_000);
                  }}
                  style={{ height: 4, background: "currentColor" }}
                />
              }
            />,
          );
          await config.open();
          // The enter fade has run its course (the bar keeps running for 10 s).
          await animationsFinished(popup(), [bar]);
          expect(bar?.playState).toBe("running");
          await close();
          await settle(() => expect(isOpen()).toBe(false));
          await settle(
            () => expect(content()).toBeNull(),
            3000,
            () => flushFor(50),
          );
          expect(bar?.playState).toBe("running");
          bar?.cancel();
        },
      );
    });

    // #117: real presses with real timing. React's act environment is left for the press, so the
    // engine's focus, light dismiss and `toggle` tasks interleave with React's work as they do on
    // a page; the close action is held open so the pending window can be inspected.
    describe("a real press while open", () => {
      it.each(config.pressesWhileOpen.map((press) => [press.name, press] as const))(
        "a real press on %s",
        async (_, press) => {
          const focusesButtons = await pressFocusesButtons();
          const work = deferred();
          const action = vi.fn<Action>((next) => (next ? undefined : work.promise));
          const fact = vi.fn<Action>();
          const Rendered = press.Harness ?? Harness;
          render(<Rendered action={action} fact={fact} />);
          await config.open();
          await flushFor();
          leaveActEnvironment();

          const target = press.target();
          const before = document.activeElement;
          const pressFocused = press.focusAtPress === "target" && focusesButtons;
          const focusAtPress =
            typeof press.focusAtPress === "function"
              ? press.focusAtPress()
              : pressFocused
                ? target
                : before;
          const calls = action.mock.calls.length;

          await mouse.pressOn(target, {
            at: press.at,
            atPress: () => {
              expect(document.activeElement).toBe(focusAtPress);
              if (press.outcome === "dismissed" && press.hiddenAtPressIfFocused && pressFocused) {
                expect(isOpen()).toBe(false);
              } else {
                // Nothing closes at the press: light dismiss waits for the release, a part for its
                // click.
                expect(isOpen()).toBe(true);
                expect(action).toHaveBeenCalledTimes(calls);
                expect(fact).not.toHaveBeenCalled();
              }
            },
          });
          const last = () => action.mock.calls.at(-1)!;

          if (press.outcome === "stays-open") {
            await quietPeriod(80, "a press inside must neither close nor dispatch");
            expect(isOpen()).toBe(true);
            expect(action).toHaveBeenCalledTimes(calls);
            expect(fact).not.toHaveBeenCalled();
            expect(document.activeElement).toBe(focusAtPress);
            return;
          }

          if (press.outcome === "awaited") {
            // The pending window: shown, focus where the press left it, one dispatch.
            expect(isOpen()).toBe(true);
            expect(document.activeElement).toBe(focusAtPress);
            // The Trigger's optimistic feedback: pending, no longer `data-open`; still exposed
            // expanded, the popup is shown (#118, #121).
            expect(trigger()).toHaveAttribute("data-pending", "");
            expect(trigger()).not.toHaveAttribute("data-open");
            if (config.popoverTarget) await expectInvokerExpanded(trigger(), popup(), true);
            expect(action).toHaveBeenCalledTimes(calls + 1);
            expect(last()[0]).toBe(false);
            expect(last()[1].reason).toBe("activate");
            expect(last()[1].event?.type).toBe(press.eventType ?? "click");
            await quietPeriod(50, "the popup must stay shown until the action settles");
            expect(isOpen()).toBe(true);
            work.resolve();
            await expect.poll(() => isOpen()).toBe(false);
            await expect.poll(() => trigger().hasAttribute("data-pending")).toBe(false);
            // The library's own close: no fact.
            expect(fact).not.toHaveBeenCalled();
          } else {
            // Hidden by the platform (or the library's light dismiss) at once: a fact, reported
            // to onOpenChange; nothing pending and no request.
            await expect.poll(() => isOpen(), { timeout: 1000 }).toBe(false);
            await expect.poll(() => fact.mock.calls.length).toBe(1);
            const [next, details] = fact.mock.calls[0]!;
            expect(next).toBe(false);
            expect(details.reason).toBe("dismiss");
            expect(details.event?.type).toBe(config.dismissEvent);
            expect(action).toHaveBeenCalledTimes(calls);
            expect(trigger()).not.toHaveAttribute("data-pending");
            work.resolve();
          }

          await expect.poll(() => document.activeElement).toBe(press.focusAfter({ pressFocused }));
          if (config.popoverTarget) await expectInvokerExpanded(trigger(), popup(), false);
          await quietPeriod(50, "no re-open and no second dispatch");
          expect(isOpen()).toBe(false);
          expect(action).toHaveBeenCalledTimes(press.outcome === "awaited" ? calls + 1 : calls);
          expect(fact).toHaveBeenCalledTimes(press.outcome === "awaited" ? 0 : 1);
        },
      );
    });

    // The library-owned closes run inside the view transition's update callback; a dismissal
    // (the platform already closed the popup) is a fact whose commit is urgent and starts none
    // (#148). The rows click in-page outside `act`, because `act` would flush React's queue itself.
    describe("ViewTransition", () => {
      const vt = setUpViewTransitionRows(config.isOpen);

      /** The `::view-transition-*` pseudo-elements animating now, by name (read at `ready`). */
      function pseudoNames(): string[] {
        return [
          ...new Set(
            document
              .getAnimations()
              .map((animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "")
              .filter((name) => name.startsWith("::view-transition-")),
          ),
        ].sort();
      }

      /** The popup's images of `kind`: any `::view-transition-<kind>` other than the root's. */
      const popupImages = (kind: "old" | "new") =>
        pseudoNames().filter(
          (name) =>
            name.startsWith(`::view-transition-${kind}(`) &&
            name !== `::view-transition-${kind}(root)`,
        );

      const namesReliable = browserName !== "webkit";

      it.each(partCloses.map((close) => [close.name, close] as const))(
        'transition="pop": the open and %s each run one view transition',
        async (_, partClose) => {
          render(<Plain transition="pop" controlled={partClose.controlled} />);
          trigger().click();
          // Not waiting for the popup first: shown later than the update callback must fail.
          await expect.poll(() => vt.calls.length).toBe(1);
          // Started before the popup was shown; shown inside the update callback.
          expect(vt.calls[0]!.openAtStart).toBe(false);
          await vt.transitions[0]!.updateCallbackDone;
          expect(isOpen()).toBe(true);
          await vt.transitions[0]!.finished;
          config.viewTransition.afterOpen?.();

          partClose.close();
          await expect.poll(() => vt.calls.length).toBe(2);
          // The library closes inside the update callback, so the popup is open at the start.
          expect(vt.calls[1]!.openAtStart).toBe(true);
          await vt.transitions[1]!.updateCallbackDone;
          expect(isOpen()).toBe(false);
          await vt.transitions[1]!.ready;
          // The old snapshot carries the popup (with its content) out, in every engine.
          const oldImages = document
            .getAnimations()
            .filter((animation) =>
              ((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(
                "::view-transition-old",
              ),
            );
          expect(oldImages.length).toBeGreaterThan(0);
          await vt.transitions[1]!.finished;
          expect(isOpen()).toBe(false);
          expect(content()).toBeNull();
          await partClose.afterClose?.();
          await quietPeriod(50, "no third view transition");
          expect(vt.calls).toHaveLength(2);
        },
      );

      it('transition="pop": a dismissal runs no view transition (a fact: an urgent commit)', async () => {
        render(<Plain transition="pop" />);
        await vt.open();
        expect(vt.calls).toHaveLength(1);
        await dismiss();
        expect(isOpen()).toBe(false);
        await expect.poll(() => content()).toBeNull();
        await quietPeriod(100, "a dismissal must not start a view transition");
        expect(vt.calls).toHaveLength(1);
      });

      it('transition="pop" plus a CSS exit: a dismissal runs no view transition; the CSS exit alone animates it', async () => {
        addExitStyle("fade", "200ms", { openPseudo });
        render(<Plain transition="pop" className="fade" />);
        await vt.open();
        expect(vt.calls).toHaveLength(1);
        await animationsFinished(popup()); // the enter fade
        await dismiss();
        // The fact's commit is urgent (#148): the content is held for the CSS fade, released
        // by a normal update; neither starts a document view transition.
        await expect.poll(() => content(), { timeout: 2000 }).toBeNull();
        await quietPeriod(100, "neither the fact nor the release may start a view transition");
        expect(vt.calls).toHaveLength(1);
      });

      // The library cuts the popup's CSS transitions around its own show and hide while a view
      // transition runs (conventions 5.1, #147), so no consumer rule is needed. Without the cut,
      // Chromium keeps a closed popup rendered through its CSS fade and the close's new snapshot
      // captures it as a live `::view-transition-new` next to the old image (a double image);
      // Firefox and WebKit close at once either way. Inline `transition` is restored right after.
      it.each(partCloses.map((close) => [close.name, close] as const))(
        'transition="pop" plus a CSS exit: %s has the old image only, no live new image; the content is not re-mounted',
        async (_, partClose) => {
          addExitStyle("fade", "200ms", { openPseudo });
          render(<Plain transition="pop" className="fade" controlled={partClose.controlled} />);
          await vt.open();
          await animationsFinished(popup()); // the enter fade
          const style = popup().getAttribute("style");
          // The close commit unmounted the content inside the view transition: no hold may
          // bring it back for the CSS exit (the old snapshot already carried it out).
          const remounts = countMounts(popup(), "content");
          partClose.close();
          await expect.poll(() => vt.calls.length).toBe(2);
          await vt.transitions[1]!.ready;
          const fading = getComputedStyle(popup()).display !== "none";
          const seen = JSON.stringify({ names: pseudoNames(), fading });
          expect(fading, seen).toBe(false);
          expect(popup().style.getPropertyValue("transition")).toBe("");
          if (namesReliable) {
            expect(popupImages("old").length, seen).toBeGreaterThan(0);
            expect(popupImages("new"), seen).toEqual([]);
          }
          await vt.transitions[1]!.finished;
          expect(isOpen()).toBe(false);
          // React's own inline style is back as it was before the close.
          expect(popup().getAttribute("style")).toBe(style);
          await quietPeriod(100, "the release of the hold must not start a view transition");
          expect(vt.calls).toHaveLength(2);
          expect(remounts.stop()).toBe(0);
        },
      );

      // The open: the view transition animates it, the CSS enter (`@starting-style`) does not run
      // under it (#147). The dialog's `::backdrop` is not the popup: its enter fade still runs.
      it('transition="pop" plus a CSS enter: the open runs the view transition only, the popup is opaque at ready', async () => {
        addExitStyle("fade", "200ms", { openPseudo });
        render(<Plain transition="pop" className="fade" />);
        trigger().click();
        await expect.poll(() => vt.calls.length).toBe(1);
        await vt.transitions[0]!.ready;
        expect(isOpen()).toBe(true);
        expect(getComputedStyle(popup()).opacity).toBe("1");
        expect(popup().style.getPropertyValue("transition")).toBe("");
        await vt.transitions[0]!.finished;
      });

      // The cut is scoped to the library's own calls: an unrelated view transition of the page
      // during a dismissal's CSS fade leaves the fade alone (the old consumer rule
      // `html:active-view-transition .popup { transition: none }` cut it).
      it("a dismissal's CSS fade keeps running through an unrelated view transition", async () => {
        addExitStyle("fade", "400ms", { openPseudo, instantEnter: true });
        render(<Plain transition="pop" className="fade" />);
        await vt.open();
        const exit = watchExit(popup(), config.dismissEvent);
        await dismiss();
        const animations = await exit;
        // Chromium animates the exit; Firefox (bug 1834877) does not, so there is nothing to cut.
        if (browserName === "chromium") expect(animations.length).toBeGreaterThan(0);
        const fadingBefore = getComputedStyle(popup()).display !== "none";
        // Through the spy: the suite's afterEach waits for it to finish.
        const unrelated = document.startViewTransition(() => {
          document.body.dataset["unrelated"] = "1";
        });
        onCleanup(() => delete document.body.dataset["unrelated"]);
        await unrelated.ready;
        expect(getComputedStyle(popup()).display !== "none").toBe(fadingBefore);
        if (fadingBefore) {
          expect(Number(getComputedStyle(popup()).opacity)).toBeGreaterThan(0);
        }
        await unrelated.finished;
      });

      it("without transition: no view transition for an open, a part-initiated close or a dismissal", async () => {
        render(<Plain />);
        await vt.open();
        await quietPeriod(50, "the open must not start a view transition");
        partCloses[0].close();
        await expect.poll(() => isOpen()).toBe(false);
        await vt.open();
        await dismiss();
        await expect.poll(() => isOpen()).toBe(false);
        await quietPeriod(50, "no close may start a view transition");
        expect(vt.calls).toHaveLength(0);
      });
    });
  });
}
