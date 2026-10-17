import { Component, use } from "react";
import type { ReactNode } from "react";
import { expect, describe } from "vitest";
import { userEvent } from "@testing-library/user-event";
import { act, configure, getConfig } from "@testing-library/react";

/** A promise whose settlement the test controls. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

/**
 * Every deferred created by the current test that has not settled yet. A test that fails (or
 * forgets) before settling its deferred would leave an async action pending, and React entangles
 * every later transition in the same file with it: later tests' actions would stay pending. The
 * `afterEach` in vitest.setup.ts settles the leftovers with `settleOpenDeferreds()`.
 */
const openDeferreds = new Set<() => void>();

export function deferred<T = void>(): Deferred<T> {
  let res!: Deferred<T>["resolve"];
  let rej!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  const settleLeftover = () => res(undefined as T);
  openDeferreds.add(settleLeftover);
  return {
    promise,
    resolve: (value) => {
      openDeferreds.delete(settleLeftover);
      res(value);
    },
    reject: (reason) => {
      openDeferreds.delete(settleLeftover);
      rej(reason);
    },
  };
}

/**
 * Resolves every deferred (and `createSuspender` entry) still open, with `undefined`, inside
 * `act()` so that the async actions waiting on them finish and leave no entangled transition
 * behind. Called by vitest.setup.ts after each test, after `cleanup()`.
 */
export async function settleOpenDeferreds(): Promise<void> {
  if (openDeferreds.size === 0) return;
  const open = [...openDeferreds];
  openDeferreds.clear();
  await act(async () => {
    for (const settle of open) settle();
  });
}

interface TrackedPromise<T> extends Promise<T> {
  status?: "pending" | "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
}

/**
 * A cached promise resource keyed by value. `<Suspender value="x" />` renders `x` through `use()`
 * and suspends until `resolve("x")` is called. Resolve a value before rendering it to make it
 * render synchronously (the promise is marked fulfilled the way React's `use` expects).
 */
export function createSuspender() {
  const cache = new Map<string, Deferred<string>>();

  function entry(key: string): Deferred<string> {
    let d = cache.get(key);
    if (d === undefined) {
      d = deferred<string>();
      (d.promise as TrackedPromise<string>).status = "pending";
      cache.set(key, d);
    }
    return d;
  }

  function Suspender({ value }: { value: string }) {
    const text = use(entry(value).promise);
    return <span data-testid="suspender">{text}</span>;
  }

  return {
    Suspender,
    resolve(key: string, text: string = key): void {
      const d = entry(key);
      const p = d.promise as TrackedPromise<string>;
      p.status = "fulfilled";
      p.value = text;
      d.resolve(text);
    },
    isResolved(key: string): boolean {
      return (entry(key).promise as TrackedPromise<string>).status === "fulfilled";
    },
  };
}

interface ErrorCatcherProps {
  children: ReactNode;
  /** Called with every error the boundary catches. */
  onError?: (error: unknown) => void;
}

/** Error Boundary that records the error and renders a marker element in place of its children. */
export class ErrorCatcher extends Component<
  ErrorCatcherProps,
  { error: unknown; caught: boolean }
> {
  state = { error: undefined as unknown, caught: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, caught: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.caught) {
      return (
        <div role="alert" data-testid="error-catcher">
          {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

export type ControlMode = "uncontrolled" | "controlled";

export const controlModes: readonly ControlMode[] = ["uncontrolled", "controlled"];

/**
 * Runs a block of tests against both control modes (`describe.each`). The component test file
 * supplies a harness whose controlled variant follows the "update on success" pattern.
 */
export function renderBoth(name: string, body: (mode: ControlMode) => void): void {
  describe.each(controlModes)(`${name} (%s)`, (mode) => {
    body(mode);
  });
}

/** Asserts the presence form of `data-pending` (conventions 4.1). */
export function expectPending(el: Element): void {
  expect(el).toHaveAttribute("data-pending", "");
}

export function expectNotPending(el: Element): void {
  expect(el).not.toHaveAttribute("data-pending");
}

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Runs one user-event interaction inside a single async `act()`.
 *
 * Testing Library's `asyncWrapper` runs user-event with the act environment switched off, so
 * React renders the transition a click or key press starts on the real (time-sliced) Scheduler
 * while the wrapper only waits one `setTimeout(0)`. On a cold start the commit can land after the
 * interaction has returned, and the next assertion sees the optimistic state (the Accordion and
 * Tabs flakes of issue #36). Inside `act` React queues that work and drains it before returning.
 * The asyncWrapper is bypassed meanwhile: its act-environment-off window would make React warn
 * about the outer `act`. A pending deferred stays pending, so mid-flight assertions still work.
 */
async function inAct<T>(interaction: () => Promise<T>): Promise<T> {
  const { asyncWrapper } = getConfig();
  configure({ asyncWrapper: (cb) => cb() });
  try {
    return await act(interaction);
  } finally {
    configure({ asyncWrapper });
  }
}

/**
 * A `user-event` instance whose every interaction (`click`, `keyboard`, `tab`, `hover`, `type`,
 * …) runs inside `act()`, so the transitions it starts have committed when the call resolves.
 * Call it in each test, after `render`.
 */
export function setupUser(options?: Parameters<typeof userEvent.setup>[0]): UserEvent {
  const user = userEvent.setup(options);
  return new Proxy(user, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      // `setup` derives another instance synchronously; leave it (and non-functions) alone.
      if (typeof value !== "function" || key === "setup") return value;
      return (...args: unknown[]) =>
        inAct(() => Promise.resolve((value as (...a: unknown[]) => unknown).apply(target, args)));
    },
  });
}
