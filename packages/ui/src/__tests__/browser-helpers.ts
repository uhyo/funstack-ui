// Helpers shared by the `*.browser.test.tsx` files (vitest browser mode, Chromium / Firefox /
// WebKit). The jsdom-compatible ones (`flushMicrotasks`, `flushTasks`, `silenceErrors`) live in
// helpers.tsx; these wait on real time or touch real-browser state.
import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { MockInstance } from "vitest";
import { onCleanup } from "./cleanups.js";

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Waits `ms` of real time inside one async `act()`: queued `toggle` / `close` tasks and React's
 * follow-up work run. Prefer `settle(check)` when a condition follows.
 */
export function flushFor(ms = 20): Promise<void> {
  return act(async () => {
    await sleep(ms);
  });
}

/**
 * Runs `step` (by default one `flushFor()`) until `check` passes, rethrowing its last failure
 * after `timeout` ms. The first round is one step; more rounds only absorb a slow task under load
 * (issue #49). Unlike `expect.poll`, every round runs inside `act`, so an update landing late does
 * not log React's act() warning.
 */
export async function settle(
  check: () => void,
  timeout = 2000,
  step: () => Promise<void> = () => flushFor(),
): Promise<void> {
  const start = performance.now();
  for (;;) {
    await step();
    try {
      check();
      return;
    } catch (error) {
      if (performance.now() - start > timeout) throw error;
    }
  }
}

/**
 * Resolves once the animations and transitions running now on `element`, its descendants and
 * their pseudo-elements (`::backdrop` included) have finished or were cancelled, ignoring the
 * ones in `except` (an infinite or long animation the row keeps running). Reading
 * `getAnimations()` flushes style, so a transition the last change starts is included.
 */
export async function animationsFinished(
  element: Element,
  except: readonly (Animation | undefined)[] = [],
): Promise<void> {
  const running = element
    .getAnimations({ subtree: true })
    .filter((animation) => !except.includes(animation));
  await Promise.allSettled(running.map((animation) => animation.finished));
}

/**
 * A deliberate wait during which nothing may happen: the row asserts afterwards that a close, an
 * open or a view transition did not come. A negative check has no event to wait for, so these
 * waits stay, but under a name that is greppable and says what the engine gets a chance to do.
 * Never use it where a condition can be awaited instead (`settle`, `expect.poll`).
 */
export function quietPeriod(ms: number, _whatMustNotHappen: string): Promise<void> {
  return sleep(ms);
}

export { onCleanup } from "./cleanups.js";

/** Appends a `<style>` to <head>, removed after the test (`onCleanup`); returns the remover. */
export function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const remove = () => style.remove();
  onCleanup(remove);
  return remove;
}

type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

/** The act environment before the current test's first `leaveActEnvironment()`, if it left. */
let actEnvironmentBeforeTest: { readonly value: boolean | undefined } | undefined;

/**
 * Switches React's act environment off (for rows whose updates land outside any `act` scope:
 * a view transition commits in its callback, a hover timer fires on its own) and returns the
 * function that restores the previous value, for a row that re-enters it mid-test. The value the
 * test started with is restored after the test in any case (`onCleanup`), so a caller needs no
 * `afterEach` of its own.
 */
export function leaveActEnvironment(): () => void {
  const previous = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
  if (actEnvironmentBeforeTest === undefined) {
    actEnvironmentBeforeTest = { value: previous };
    onCleanup(() => {
      (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironmentBeforeTest!.value;
      actEnvironmentBeforeTest = undefined;
    });
  }
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
  return () => {
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = previous;
  };
}

/** Resolves once React's running view transition, if any, has finished (or was skipped). */
export async function viewTransitionFinished(): Promise<void> {
  await (
    document as Document & { __reactViewTransition?: ViewTransition | null }
  ).__reactViewTransition?.finished.catch(() => {});
}

/**
 * Runs `body` outside React's act environment, then waits for the view transition it started: a
 * view transition commits in its callback, after any `act` scope (issue #49).
 */
export async function outsideAct(body: () => Promise<void>): Promise<void> {
  const restore = leaveActEnvironment();
  try {
    await body();
    await viewTransitionFinished();
  } finally {
    restore();
  }
}

type StartArg = StartViewTransitionOptions | ViewTransitionUpdateCallback | undefined;

/** What `spyViewTransitions` recorded; the real `startViewTransition` still runs. */
export interface ViewTransitionSpy {
  /** The transitions the real method returned. */
  readonly transitions: ViewTransition[];
  /** How many view transitions were started. */
  readonly calls: () => number;
  /** Restores the real method now (rows that spy twice in one test). */
  readonly restore: () => void;
}

/**
 * Counts and records `document.startViewTransition` calls and lets each one run. `onCall` runs
 * at the call, before the real method (to snapshot the DOM then). Throws where the engine has
 * no `startViewTransition`, so a "no view transition" row cannot pass vacuously; a row whose
 * claim also holds without the API opts in with `allowMissing` (then nothing is recorded).
 */
export function spyViewTransitions(
  onCall?: (arg: StartArg) => void,
  { allowMissing = false }: { allowMissing?: boolean } = {},
): ViewTransitionSpy {
  const transitions: ViewTransition[] = [];
  let calls = 0;
  if (typeof document.startViewTransition !== "function") {
    if (!allowMissing) {
      throw new Error("spyViewTransitions: this engine has no document.startViewTransition");
    }
    return { transitions, calls: () => calls, restore: () => {} };
  }
  const original = document.startViewTransition.bind(document);
  const spy: MockInstance<Document["startViewTransition"]> = vi
    .spyOn(document, "startViewTransition")
    .mockImplementation(((arg?: StartArg) => {
      calls++;
      onCall?.(arg);
      const transition = original(arg);
      transitions.push(transition);
      return transition;
    }) as typeof document.startViewTransition);
  return { transitions, calls: () => calls, restore: () => spy.mockRestore() };
}
