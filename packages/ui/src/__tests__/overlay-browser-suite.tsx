// Shared browser rows for the overlays built on `useOverlayRoot` and `usePopoverPopup`: Dialog,
// Popover and Menu (#109, audit T8). They need a real engine: Escape as a close request and the
// platform's focus return, CSS exit animations and the deferred unmount (design 4.4), and
// `<ViewTransition>` around the top-layer element (the library-owned closes run inside the update
// callback; a dismissal only notifies). The jsdom half is overlay-open-state-suite.tsx.
//
// Each component's `.browser.test.tsx` calls `describeOverlayInBrowser` with a driver; the rows
// that differ per component (Dialog's 10.3 capture, the focus return of a keyboard-activated Close,
// Popover's shielded `transition="none"`, Menu's submenus) stay in those files.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - Firefox animates no CSS exit of a popover or a dialog (bug 1834877): the exit rows branch on
//   what `getAnimations()` found when the popup closed; Chromium must find something.
// - WebKit (CI, Playwright's WebKit build, 2026-10): a closing box is already `display: none` at
//   `ready` with or without the recipe, yet WebKit lists the animation of its group under
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
  quietPeriod,
  settle,
  sleep,
  spyViewTransitions,
} from "./browser-helpers.js";
import { user } from "./browser-user.js";
import { browserName } from "./engine.js";

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
  /** The event the platform's close fires and a dismissal's notification carries. */
  readonly dismissEvent: "close" | "toggle";
  /** The Trigger carries `aria-expanded` (Popover, Menu; not Dialog). */
  readonly ariaExpanded: boolean;
  /** Extra checks on an Escape's `details` (Dialog: `returnValue` is `""`). */
  readonly dismissDetails?: (details: D) => void;
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
}

/**
 * A CSS exit on a popup (design 10.1): `opacity` with `display` and `overlay` held for
 * `duration`. `openPseudo` `":open"` (a modal dialog) also fades the `::backdrop`.
 * `instantEnter`: no enter fade. `recipe`: the docs' rule that cuts the fade while a view
 * transition runs (review M2 of Dialog #46).
 */
export function addExitStyle(
  className: string,
  duration: string,
  {
    openPseudo,
    instantEnter = false,
    recipe = false,
  }: { openPseudo: ":open" | ":popover-open"; instantEnter?: boolean; recipe?: boolean },
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
    ${recipe ? `html:active-view-transition .${className} { transition: none; }` : ""}
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
  let restoreAct: () => void;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    ({ transitions } = spyViewTransitions(() => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element ? isOpen(element) : false });
    }));
    restoreAct = leaveActEnvironment();
    addStyle(`
      ::view-transition-old(.pop) { animation: 200ms ease-in both vt-pop-out; }
      ::view-transition-new(.pop) { animation: 200ms ease-out both vt-pop-in; }
      @keyframes vt-pop-out { to { opacity: 0; } }
      @keyframes vt-pop-in { from { opacity: 0; } }
    `);
  });

  afterEach(async () => {
    restoreAct();
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

  describe(`${config.name} (shared overlay browser suite)`, () => {
    it("Escape closes with reason 'dismiss'; focus returns to the Trigger", async () => {
      const action = vi.fn<Action>();
      render(<Harness action={action} />);
      await config.open();
      await user.keyboard("{Escape}");
      expect(isOpen()).toBe(false);
      expect(trigger()).toHaveFocus();
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      config.dismissDetails?.(details);
      expect(details.event?.type).toBe(config.dismissEvent);
      if (config.ariaExpanded) expect(trigger()).toHaveAttribute("aria-expanded", "false");
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
        "%s ignores a finite animation that was already running inside (#64)",
        async (_, close) => {
          addExitStyle("fade", "300ms", { openPseudo });
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

    // The library-owned closes run inside the view transition's update callback; a dismissal
    // (the platform already closed the popup) runs one only for its notification commit. The
    // rows click in-page outside `act`, because `act` would flush React's queue itself.
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

      it('transition="pop": a dismissal runs one only for the notification commit, popup already closed', async () => {
        render(<Plain transition="pop" />);
        await vt.open();
        expect(vt.calls).toHaveLength(1);
        await dismiss();
        expect(isOpen()).toBe(false);
        await expect.poll(() => vt.calls.length).toBe(2);
        expect(vt.calls[1]!.openAtStart).toBe(false);
        await vt.transitions[1]!.finished;
        await expect.poll(() => content()).toBeNull();
        await quietPeriod(50, "the release of the held content must not start a view transition");
        expect(vt.calls).toHaveLength(2);
      });

      it.each([false, true])(
        'transition="pop" plus a CSS exit (recipe=%s): a dismissal runs one view transition, not two',
        async (recipe) => {
          addExitStyle("fade", "200ms", { openPseudo, recipe });
          render(<Plain transition="pop" className="fade" />);
          await vt.open();
          expect(vt.calls).toHaveLength(1);
          await animationsFinished(popup()); // the enter fade
          await dismiss();
          // The notification commit (design 4.4); the content may be held for the CSS fade.
          await expect.poll(() => vt.calls.length).toBe(2);
          await vt.transitions[1]!.ready;
          // With the recipe, no live new image of the fading popup next to the old one.
          if (recipe && namesReliable) {
            expect(popupImages("new"), JSON.stringify(pseudoNames())).toEqual([]);
          }
          await vt.transitions[1]!.finished;
          await expect.poll(() => content()).toBeNull();
          // Releasing the hold is a normal update: no second document view transition.
          await quietPeriod(100, "the release of the hold must not start a view transition");
          expect(vt.calls).toHaveLength(2);
        },
      );

      // Chromium keeps a closed popup rendered through its CSS fade, so a library-driven close's
      // new snapshot captures it as a live `::view-transition-new` next to the old image (a
      // double image); the recipe cuts the fade while a view transition runs. Firefox closes at
      // once: the old image only either way. If the recipe=false row starts failing, an engine
      // changed; re-check the docs' recipe.
      describe.each([false, true])("a CSS exit (recipe=%s)", (recipe) => {
        it.each(partCloses.map((close) => [close.name, close] as const))(
          'transition="pop": %s has the old image, a live new image only where the box still fades (Chromium, recipe=false); the content is not re-mounted',
          async (_, partClose) => {
            addExitStyle("fade", "200ms", { openPseudo, recipe });
            render(<Plain transition="pop" className="fade" controlled={partClose.controlled} />);
            await vt.open();
            await animationsFinished(popup()); // the enter fade
            // The close commit unmounted the content inside the view transition: no hold may
            // bring it back for the CSS exit (the old snapshot already carried it out).
            const remounts = countMounts(popup(), "content");
            partClose.close();
            await expect.poll(() => vt.calls.length).toBe(2);
            await vt.transitions[1]!.ready;
            const fading = getComputedStyle(popup()).display !== "none";
            const seen = JSON.stringify({ names: pseudoNames(), fading });
            expect(fading, seen).toBe(!recipe && browserName === "chromium");
            if (namesReliable) {
              expect(popupImages("old").length, seen).toBeGreaterThan(0);
              expect(popupImages("new").length > 0, seen).toBe(fading);
            }
            await vt.transitions[1]!.finished;
            expect(isOpen()).toBe(false);
            await quietPeriod(100, "the release of the hold must not start a view transition");
            expect(vt.calls).toHaveLength(2);
            expect(remounts.stop()).toBe(0);
          },
        );
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
