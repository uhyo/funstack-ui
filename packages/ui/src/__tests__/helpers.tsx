import { Component, use } from "react";
import type { ReactNode } from "react";
import { expect, describe } from "vitest";
import { userEvent } from "@testing-library/user-event";

/** A promise whose settlement the test controls. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

/** A `user-event` instance. Call it in each test, after `render`. */
export function setupUser() {
  return userEvent.setup();
}
