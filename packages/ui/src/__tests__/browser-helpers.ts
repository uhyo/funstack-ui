// Helpers shared by the `*.browser.test.tsx` files (vitest browser mode, Chromium / Firefox /
// WebKit). The jsdom-compatible ones (`flushMicrotasks`, `flushTasks`, `silenceErrors`) live in
// helpers.tsx; these wait on real time or touch real-browser state.
import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { MockInstance } from "vitest";

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

const cleanups: (() => void)[] = [];

/** Registers `cleanup` to run at `runCleanups()` (the file's `afterEach`, or the setup file's). */
export function onCleanup(cleanup: () => void): void {
  cleanups.push(cleanup);
}

/**
 * Runs the registered cleanups in order and forgets them. Files call it in their `afterEach`
 * where the order against their other teardown matters; vitest.setup.ts calls it after the
 * unmount for everything left.
 */
export function runCleanups(): void {
  for (const cleanup of cleanups.splice(0)) cleanup();
}

/** Appends a `<style>` to <head>, removed at the next `runCleanups()`; returns the remover. */
export function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const remove = () => style.remove();
  onCleanup(remove);
  return remove;
}

/**
 * Closes every open `<dialog>` and hides every open popover, so that the next test starts with an
 * interactive page (a modal dialog left open makes the rest of the document inert).
 */
export function closeOpenTopLayer(): void {
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const element of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (element.matches(":popover-open")) element.hidePopover();
  }
}

type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

/**
 * Switches React's act environment off (for rows whose updates land outside any `act` scope:
 * a view transition commits in its callback, a hover timer fires on its own) and returns the
 * function that restores the previous value.
 */
export function leaveActEnvironment(): () => void {
  const previous = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
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
  /** The argument of every call, in order. */
  readonly args: StartArg[];
  /** The transitions the real method returned. */
  readonly transitions: ViewTransition[];
  /** How many view transitions were started. */
  readonly calls: () => number;
  readonly spy: MockInstance<Document["startViewTransition"]> | undefined;
}

/**
 * Counts and records `document.startViewTransition` calls and lets each one run. `onCall` runs
 * at the call, before the real method (to snapshot the DOM then). Where the engine has no
 * `startViewTransition`, nothing is spied and nothing is ever recorded.
 */
export function spyViewTransitions(onCall?: (arg: StartArg) => void): ViewTransitionSpy {
  const args: StartArg[] = [];
  const transitions: ViewTransition[] = [];
  let spy: MockInstance<Document["startViewTransition"]> | undefined;
  if (typeof document.startViewTransition === "function") {
    const original = document.startViewTransition.bind(document);
    spy = vi.spyOn(document, "startViewTransition").mockImplementation(((arg?: StartArg) => {
      args.push(arg);
      onCall?.(arg);
      const transition = original(arg);
      transitions.push(transition);
      return transition;
    }) as typeof document.startViewTransition);
  }
  return { args, transitions, calls: () => args.length, spy };
}
