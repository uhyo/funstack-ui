// Shared conformance suite for the action-prop plumbing of the "value" components (Toggle, Tabs,
// ToggleGroup, Accordion, RadioGroup, CheckboxGroup, Select): sync and async actions with their
// pending and optimistic state, rejection, overlapping and superseded actions, suspending content,
// the post-await rule, a controlled veto, the `transition` prop, the details shape and the dev
// warnings of `useControllableAction` (conventions 2-4, audit T2 in
// memo/reviewer/refactor-audit-tests.md). Each component test file describes its component with a
// driver (src/__tests__/drivers/) and calls `describeValueAction`; its `*-transition-types.test.tsx`
// calls `describeValueTransitionTypes`. Component-specific rows stay in the component files.
import { act, render, screen } from "@testing-library/react";
import { Profiler, Suspense, startTransition, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  sequencedDeferreds,
  setupUser,
  silenceErrors,
} from "./helpers.js";
import type { ControlMode } from "./helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "./transition-type-spy.js";

type UserEvent = ReturnType<typeof setupUser>;

/** A `transition` prop value: a class name or a map from transition type to class. */
export type TransitionProp = ViewTransitionClass;

/** The props a driver's `render` maps onto the component (only the defined ones are passed). */
export interface ControlProps<V, D> {
  readonly value?: V;
  readonly defaultValue?: V;
  readonly changeAction?: (next: V, details: D) => unknown;
  readonly transition?: TransitionProp;
  /** Pass-through props for the part that owns the value (a ref, `disabled`, …). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Describes one value component to the suite. Gesture `i` (0, 1, 2) is a user interaction that,
 * starting from `values[i]` as the shown value, dispatches `values[i + 1]`.
 */
export interface ValueActionDriver<V, D extends { readonly event: Event | undefined }> {
  /** The component name used in dev warnings and suite titles (`Toggle`, `Tabs.Root`). */
  readonly name: string;
  /** The suite title when one component has several drivers (`Accordion.Root exclusive`). */
  readonly label?: string;
  /** Renders the component with the given props; pass only the props that are defined. */
  render(props: ControlProps<V, D>): ReactNode;
  /** `values[0]` is the initial value, `values[i + 1]` the value gesture `i` dispatches. */
  readonly values: readonly [V, V, V, V];
  /** Performs gesture `i` (0-based). */
  gesture(user: UserEvent, i: number): Promise<void>;
  /** The DOM event type of gesture `i`'s dispatch (`"click"`, `"change"`, …). */
  eventType(i: number): string;
  /** The serialisable fields of the details of gesture `i` (`Object.keys` and `JSON` agree). */
  detailsFields(i: number): Readonly<Record<string, unknown>>;
  /** Asserts the optimistic value as shown in the DOM (aria-pressed, aria-selected, data-open…). */
  expectShown(v: V): void;
  /**
   * Asserts the DOM that follows the committed value only (a Tabs panel, a `<details open>`).
   * Defaults to nothing for components whose whole DOM is optimistic.
   */
  expectCommitted?(v: V): void;
  /** A string of the shown value, read from the DOM; recorded at every commit (post-await rule). */
  readShown(): string;
  /** `readShown()` of a value. */
  shown(v: V): string;
  /**
   * A string of the committed DOM (`<details open>`), also recorded at every commit: the
   * post-await row then asserts it never shows the new value while still pending.
   */
  readCommitted?(): string;
  /** `readCommitted()` of a value; required with `readCommitted`. */
  committedShown?(v: V): string;
  /** Elements that carry `data-pending` while gesture `i` is in flight. */
  pendingOn(i: number): readonly Element[];
  /** Elements that must not carry `data-pending` while gesture `i` is in flight. */
  pendingOff?(i: number): readonly Element[];
  /** The value-owning element, or null once the Error Boundary replaced the component. */
  queryControl(): Element | null;
  /**
   * Whether the component may be rendered uncontrolled with neither `value` nor `defaultValue`
   * without a dev warning (default true; Tabs warns).
   */
  readonly implicitDefault?: boolean;
  /**
   * Whether the component takes a `transition` prop (default true). Select has none (design
   * decision 13): its "transition prop" rows would only render the same tree twice.
   */
  readonly transitionProp?: boolean;
  /** The component's prop names, for the dev warnings (`pressed` / `defaultPressed`). */
  readonly props: { readonly value: string; readonly defaultValue: string };
  /**
   * How a parent following "update on success" commits a dispatch (default: `next`). ToggleGroup
   * patches its previous value with `details.added` / `removed` (design 2.3).
   */
  commit?(prev: V, next: V, details: D): V;
  /** `commit` gives the same result whatever order two overlapping dispatches resolve in. */
  readonly orderIndependentCommit?: boolean;
  /** The text the harness writes for a committed value (default `JSON.stringify`). */
  format?(v: V): string;
  /**
   * `fsui-*` types each gesture adds, starting from `values[0]` with every earlier gesture
   * resolved (asserted by `describeValueTransitionTypes`).
   */
  readonly transitionTypes: readonly (readonly string[])[];
}

type AnyDriver<V, D extends { readonly event: Event | undefined }> = ValueActionDriver<V, D>;

/** Keeps only the defined entries, so `{ pressed: undefined }` never reaches a component. */
export function definedProps<T extends Record<string, unknown>>(props: T): Partial<T> {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export interface ValueHarnessProps<V, D extends { readonly event: Event | undefined }> {
  readonly driver: AnyDriver<V, D>;
  readonly mode: ControlMode;
  /** Initial committed value; defaults to `driver.values[0]`. */
  readonly initial?: V;
  /** The consumer's work; awaited by the harness's change action. */
  readonly action?: (next: V, details: D) => unknown;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  readonly catchErrors?: boolean;
  /** Controlled only: the parent never adopts a value. */
  readonly veto?: boolean;
  /** Commit with a plain `setState` after the await instead of `startTransition` (row 17). */
  readonly commitOutsideTransition?: boolean;
  /** Wrap only the component in an `ErrorCatcher` that reports to this callback. */
  readonly boundary?: (error: unknown) => void;
  /** Render the committed value through a suspender, everything inside one Suspense boundary. */
  readonly suspender?: ReturnType<typeof createSuspender>;
  /** Called after every commit inside the component's subtree (React `Profiler`). */
  readonly onCommit?: () => void;
  readonly transition?: TransitionProp;
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows the "update on success"
 * pattern (conventions 3.1); both variants mirror the committed value in
 * `<output data-testid="committed">`.
 */
export function ValueHarness<V, D extends { readonly event: Event | undefined }>({
  driver,
  mode,
  initial = driver.values[0],
  action,
  catchErrors = false,
  veto = false,
  commitOutsideTransition = false,
  boundary,
  suspender,
  onCommit,
  transition,
  extra,
}: ValueHarnessProps<V, D>): ReactNode {
  const [committed, setCommitted] = useState<V>(initial);
  const [error, setError] = useState<unknown>(null);
  const format = driver.format ?? JSON.stringify;

  const changeAction = async (next: V, details: D) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    if (veto) return;
    const update = (prev: V) => (driver.commit ? driver.commit(prev, next, details) : next);
    if (commitOutsideTransition) setCommitted(update);
    else startTransition(() => setCommitted(update));
  };

  let control: ReactNode = driver.render({
    ...(mode === "controlled" ? { value: committed } : { defaultValue: initial }),
    changeAction,
    transition,
    extra,
  });
  if (onCommit) {
    control = (
      <Profiler id="value-harness" onRender={onCommit}>
        {control}
      </Profiler>
    );
  }
  if (boundary) control = <ErrorCatcher onError={boundary}>{control}</ErrorCatcher>;

  const content = (
    <>
      {control}
      <output data-testid="committed">{format(committed)}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
      {suspender && <suspender.Suspender value={format(committed)} />}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

export function describeValueAction<V, D extends { readonly event: Event | undefined }>(
  driver: AnyDriver<V, D>,
): void {
  const { values } = driver;
  const format = driver.format ?? JSON.stringify;
  const committed = () => screen.getByTestId("committed");
  const expectCommittedValue = (v: V) => {
    expect(committed().textContent).toBe(format(v));
    driver.expectCommitted?.(v);
  };
  const expectAllPending = (i: number) => {
    for (const el of driver.pendingOn(i)) expectPending(el);
    for (const el of driver.pendingOff?.(i) ?? []) expectNotPending(el);
  };
  const expectNonePending = (i: number) => {
    for (const el of driver.pendingOn(i)) expectNotPending(el);
  };
  /** What the harness commits for the dispatch recorded as `call` on top of `prev`. */
  const commitOf = (prev: V, call: readonly [V, D]) =>
    driver.commit ? driver.commit(prev, call[0], call[1]) : call[0];
  type ActionFn = (next: V, details: D) => unknown;
  const Harness = (props: Omit<ValueHarnessProps<V, D>, "driver">) => (
    <ValueHarness driver={driver} {...props} />
  );

  describe(`${driver.label ?? driver.name}: value action conformance`, () => {
    renderBoth("sync action", (mode) => {
      it("dispatches (next, details) with the event and commits each gesture", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        for (const i of [0, 1, 2]) {
          await driver.gesture(user, i);
          expect(action).toHaveBeenCalledTimes(i + 1);
          const [next, details] = action.mock.calls[i]!;
          expect(next).toEqual(values[i + 1]);
          expect(details.event).toBeInstanceOf(window.Event);
          expect(details.event?.type).toBe(driver.eventType(i));
          expect(JSON.parse(JSON.stringify(details))).toEqual(driver.detailsFields(i));
          expect(Object.keys(details)).toEqual(Object.keys(driver.detailsFields(i)));
          driver.expectShown(values[i + 1]!);
          expectNonePending(i);
          expectCommittedValue(values[i + 1]!);
        }
      });
    });

    renderBoth("async action", (mode) => {
      it("shows the optimistic value and data-pending until the action resolves", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        await driver.gesture(user, 0);
        driver.expectShown(values[1]);
        expectAllPending(0);
        expectCommittedValue(values[0]);

        await act(async () => {
          d.resolve();
        });
        expectNonePending(0);
        driver.expectShown(values[1]);
        expectCommittedValue(values[1]);
      });

      it("awaits an action that resolves with data (non-void return)", async () => {
        const d = deferred<{ ok: boolean }>();
        const save = (_next: V): Promise<{ ok: boolean }> => d.promise;
        // Type-level: `(next) => save(next)` returns `Promise<{ ok }>`, which `Action` accepts.
        render(<Harness mode={mode} action={(next) => save(next)} />);
        const user = setupUser();

        await driver.gesture(user, 0);
        expectAllPending(0);
        await act(async () => {
          d.resolve({ ok: true });
        });
        expectNonePending(0);
        driver.expectShown(values[1]);
        expectCommittedValue(values[1]);
      });

      it("ignores a non-thenable return value (sync data)", async () => {
        render(<Harness mode={mode} action={() => 42} />);
        await driver.gesture(setupUser(), 0);
        expectNonePending(0);
        driver.expectShown(values[1]);
        expectCommittedValue(values[1]);
      });

      it("settles quietly when unmounted while pending", async () => {
        const consoleError = silenceErrors();
        const d = deferred();
        const { unmount } = render(<Harness mode={mode} action={() => d.promise} />);
        await driver.gesture(setupUser(), 0);
        expectAllPending(0);
        unmount();
        await act(async () => {
          d.resolve();
        });
        expect(consoleError).not.toHaveBeenCalled();
      });
    });

    renderBoth("rejection", (mode) => {
      it("reaches the Error Boundary and leaves the committed value", async () => {
        silenceErrors();
        const d = deferred();
        const onError = vi.fn();
        render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
        await driver.gesture(setupUser(), 0);
        driver.expectShown(values[1]);
        expectAllPending(0);
        driver.expectCommitted?.(values[0]);

        const err = new Error("save failed");
        await act(async () => {
          d.reject(err);
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(driver.queryControl()).toBeNull();
        expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
        expect(committed().textContent).toBe(format(values[0]));
      });

      it("treats a synchronous throw like a rejection", async () => {
        silenceErrors();
        const onError = vi.fn();
        const err = new Error("sync boom");
        render(
          <Harness
            mode={mode}
            action={() => {
              throw err;
            }}
            boundary={onError}
          />,
        );
        await driver.gesture(setupUser(), 0);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(driver.queryControl()).toBeNull();
        expect(committed().textContent).toBe(format(values[0]));
      });

      it("caught inside the action counts as success; only a controlled parent reverts", async () => {
        const d = deferred();
        render(<Harness mode={mode} action={() => d.promise} catchErrors />);
        await driver.gesture(setupUser(), 0);
        expectAllPending(0);
        await act(async () => {
          d.reject(new Error("vetoed"));
        });

        expectNonePending(0);
        expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
        // The harness never adopted the value in either mode...
        expect(committed().textContent).toBe(format(values[0]));
        // ...but only a controlled parent can veto: uncontrolled commits the value.
        const settled = mode === "controlled" ? values[0] : values[1];
        driver.expectShown(settled);
        driver.expectCommitted?.(settled);
      });
    });

    describe("overlapping actions (uncontrolled)", () => {
      it.each([
        ["second then first", [1, 0]],
        ["first then second", [0, 1]],
      ] as const)("the latest dispatch wins when resolved %s", async (_label, order) => {
        const ds = sequencedDeferreds(2);
        const action = vi.fn<ActionFn>(() => ds.next());
        render(<Harness mode="uncontrolled" action={action} />);
        const user = setupUser();

        await driver.gesture(user, 0);
        driver.expectShown(values[1]);
        expectAllPending(0);
        await driver.gesture(user, 1);
        expect(action.mock.calls.map(([next]) => next)).toEqual([values[1], values[2]]);
        driver.expectShown(values[2]);
        expectAllPending(1);
        driver.expectCommitted?.(values[0]);

        for (const i of order) {
          await act(async () => {
            ds[i]!.resolve();
          });
        }
        driver.expectShown(values[2]);
        driver.expectCommitted?.(values[2]);
        expectNonePending(1);
        expect(action).toHaveBeenCalledTimes(2);
        // A parent committing whole values writes them in completion order (so in dispatch order
        // it ends on the newer one); one that patches (ToggleGroup, CheckboxGroup) ends with both
        // changes whatever the order.
        if (order[0] === 0 || driver.orderIndependentCommit) {
          expect(committed().textContent).toBe(format(values[2]));
        }
      });

      it("stays pending until every in-flight action settles", async () => {
        const ds = sequencedDeferreds(2);
        render(<Harness mode="uncontrolled" action={() => ds.next()} />);
        const user = setupUser();

        await driver.gesture(user, 0);
        await driver.gesture(user, 1);
        await act(async () => {
          ds[1]!.resolve();
        });
        expectAllPending(1);
        driver.expectShown(values[2]);
        // One async action scope: nothing commits before every action settled.
        driver.expectCommitted?.(values[0]);

        await act(async () => {
          ds[0]!.resolve();
        });
        expectNonePending(1);
        driver.expectShown(values[2]);
        driver.expectCommitted?.(values[2]);
      });
    });

    renderBoth("superseded rejection", (mode) => {
      function renderGestures(onError: (error: unknown) => void, count = 2) {
        const ds = sequencedDeferreds(count);
        const action = vi.fn<ActionFn>(() => ds.next());
        render(<Harness mode={mode} action={action} boundary={onError} />);
        return { ds, action };
      }

      it("reaches the boundary when the older action rejects after the newer resolved", async () => {
        silenceErrors();
        const onError = vi.fn();
        const { ds, action } = renderGestures(onError);
        const user = setupUser();

        await driver.gesture(user, 0);
        await driver.gesture(user, 1);
        expect(action.mock.calls.map(([next]) => next)).toEqual([values[1], values[2]]);

        await act(async () => {
          ds[1]!.resolve();
        });
        expect(onError).not.toHaveBeenCalled();
        driver.expectShown(values[2]);

        const err = new Error("older save failed");
        await act(async () => {
          ds[0]!.reject(err);
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(driver.queryControl()).toBeNull();
        expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
        // The newer action's outcome is unaffected.
        const newer = commitOf(values[0], action.mock.calls[1]! as [V, D]);
        expect(committed().textContent).toBe(format(newer));
      });

      it("reaches the boundary when the older action rejects while the newer is pending", async () => {
        silenceErrors();
        const onError = vi.fn();
        const { ds, action } = renderGestures(onError);
        const user = setupUser();

        await driver.gesture(user, 0);
        await driver.gesture(user, 1);
        expectAllPending(1);

        const err = new Error("older save failed");
        await act(async () => {
          ds[0]!.reject(err);
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(driver.queryControl()).toBeNull();
        expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");

        // The newer action's outcome is unaffected and nothing is thrown a second time.
        await act(async () => {
          ds[1]!.resolve();
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
        const newer = commitOf(values[0], action.mock.calls[1]! as [V, D]);
        expect(committed().textContent).toBe(format(newer));
      });

      it("keeps the first superseded error and reports later ones through reportError", async () => {
        silenceErrors();
        const reportError = vi.fn();
        vi.stubGlobal("reportError", reportError);
        try {
          const onError = vi.fn();
          const { ds } = renderGestures(onError, 3);
          const user = setupUser();

          await driver.gesture(user, 0);
          await driver.gesture(user, 1);
          await driver.gesture(user, 2);

          const first = new Error("first");
          const second = new Error("second");
          await act(async () => {
            ds[0]!.reject(first);
            ds[1]!.reject(second);
          });
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(first);
          expect(reportError).toHaveBeenCalledTimes(1);
          expect(reportError).toHaveBeenCalledWith(second);

          await act(async () => {
            ds[2]!.resolve();
          });
          expect(onError).toHaveBeenCalledTimes(1);
          expect(reportError).toHaveBeenCalledTimes(1);
        } finally {
          vi.unstubAllGlobals();
        }
      });

      it("ignores a superseded rejection after unmount", async () => {
        const consoleError = silenceErrors();
        const reportError = vi.fn();
        vi.stubGlobal("reportError", reportError);
        try {
          const onError = vi.fn();
          const ds = sequencedDeferreds(2);
          const { unmount } = render(
            <Harness mode={mode} action={() => ds.next()} boundary={onError} />,
          );
          const user = setupUser();

          await driver.gesture(user, 0);
          await driver.gesture(user, 1);
          unmount();
          await act(async () => {
            ds[0]!.reject(new Error("too late"));
            ds[1]!.resolve();
          });
          expect(onError).not.toHaveBeenCalled();
          expect(reportError).not.toHaveBeenCalled();
          expect(consoleError).not.toHaveBeenCalled();
        } finally {
          vi.unstubAllGlobals();
        }
      });
    });

    renderBoth("suspending content", (mode) => {
      it("keeps the old content, no fallback, pending while the new content loads", async () => {
        const suspender = createSuspender();
        suspender.resolve(format(values[0]));
        render(<Harness mode={mode} suspender={suspender} />);
        expect(screen.getByTestId("suspender").textContent).toBe(format(values[0]));

        await driver.gesture(setupUser(), 0);
        driver.expectShown(values[1]);
        expectAllPending(0);
        expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
        expect(screen.getByTestId("suspender").textContent).toBe(format(values[0]));
        expectCommittedValue(values[0]);

        await act(async () => {
          suspender.resolve(format(values[1]));
        });
        expect(screen.getByTestId("suspender").textContent).toBe(format(values[1]));
        expectCommittedValue(values[1]);
        expectNonePending(0);
        expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      });
    });

    describe("post-await rule (controlled parent)", () => {
      it("the shown value and data-pending converge with startTransition after the await", async () => {
        const d = deferred();
        // Every commit of the component's subtree, read from the DOM in the Profiler callback (a
        // MutationObserver would coalesce commits made in the same task).
        const snapshots: { shown: string; pending: boolean; committed: string | null }[] = [];
        const record = () => {
          if (driver.queryControl() === null) return;
          snapshots.push({
            shown: driver.readShown(),
            pending: driver.pendingOn(0).some((el) => el.hasAttribute("data-pending")),
            committed: driver.readCommitted?.() ?? null,
          });
        };
        const snapshot = (shown: V, pending: boolean, committedValue: V) => ({
          shown: driver.shown(shown),
          pending,
          committed: driver.readCommitted ? driver.committedShown!(committedValue) : null,
        });
        render(<Harness mode="controlled" action={() => d.promise} onCommit={record} />);
        const initial = snapshot(values[0], false, values[0]);
        expect(snapshots.length).toBeGreaterThan(0);
        expect(snapshots.every((s) => JSON.stringify(s) === JSON.stringify(initial))).toBe(true);
        const beforeClick = snapshots.length;

        await driver.gesture(setupUser(), 0);
        expect(snapshots.at(-1)).toEqual(snapshot(values[1], true, values[0]));
        expectCommittedValue(values[0]);
        const afterClick = snapshots.length;
        await act(async () => {
          d.resolve();
        });

        expect(snapshots.length).toBeGreaterThan(afterClick);
        expect(snapshots.at(-1)).toEqual(snapshot(values[1], false, values[1]));
        // No commit after the gesture ever showed the old value again, and the committed DOM
        // never showed the new value while still pending (one commit converges both).
        expect(snapshots.slice(beforeClick).every((s) => s.shown === driver.shown(values[1]))).toBe(
          true,
        );
        if (driver.readCommitted) {
          const settled = driver.committedShown!(values[1]);
          expect(snapshots.every((s) => !(s.pending && s.committed === settled))).toBe(true);
        }
        expectCommittedValue(values[1]);
      });

      it("still ends in the right state without startTransition (documented limitation)", async () => {
        const d = deferred();
        render(<Harness mode="controlled" action={() => d.promise} commitOutsideTransition />);
        await driver.gesture(setupUser(), 0);
        await act(async () => {
          d.resolve();
        });
        driver.expectShown(values[1]);
        expectNonePending(0);
        expectCommittedValue(values[1]);
      });
    });

    describe("controlled veto", () => {
      it("snaps back when the parent never adopts the value", async () => {
        const d = deferred();
        render(<Harness mode="controlled" veto action={() => d.promise} />);
        await driver.gesture(setupUser(), 0);
        driver.expectShown(values[1]);
        expectAllPending(0);
        await act(async () => {
          d.resolve();
        });
        driver.expectShown(values[0]);
        expectNonePending(0);
        expectCommittedValue(values[0]);
      });
    });

    if (driver.transitionProp !== false) {
      describe("transition prop", () => {
        const typeMap: TransitionProp = Object.fromEntries([
          ...[...new Set(driver.transitionTypes.flat())].map((t) => [t, "fsui-fade"]),
          ["default", "none"],
        ]);

        it("renders the same markup with and without `transition` (class or type map)", () => {
          const consoleError = silenceErrors();
          const markup = (transition?: TransitionProp) => {
            const { container, unmount } = render(
              <>{driver.render(definedProps({ defaultValue: values[1], transition }))}</>,
            );
            // `useId` values differ from root to root; everything else must be identical.
            const html = container.innerHTML.replace(/_r_[0-9a-z]+_/g, "_r_id_");
            unmount();
            return html;
          };
          const plain = markup();
          expect(markup("fsui-fade")).toBe(plain);
          expect(markup(typeMap)).toBe(plain);
          expect(consoleError).not.toHaveBeenCalled();
        });

        it.each([
          ["a class", "fsui-fade"],
          ["a type map", typeMap],
        ] as const)("still dispatches with %s as `transition`", async (_label, transition) => {
          const action = vi.fn<ActionFn>();
          render(<Harness mode="uncontrolled" action={action} transition={transition} />);
          await driver.gesture(setupUser(), 0);
          expect(action).toHaveBeenCalledTimes(1);
          expect(action.mock.calls[0]?.[0]).toEqual(values[1]);
          driver.expectShown(values[1]);
          expectCommittedValue(values[1]);
        });
      });
    }

    describe("details", () => {
      it("exposes `event` as a virtual, non-own property", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode="uncontrolled" action={action} />);
        await driver.gesture(setupUser(), 0);
        const details = action.mock.calls[0]![1];
        expect(details.event).toBeInstanceOf(window.Event);
        expect(details.event?.type).toBe(driver.eventType(0));
        expect("event" in details).toBe(true);
        expect(Object.keys(details)).toEqual(Object.keys(driver.detailsFields(0)));
        expect({ ...details }).not.toHaveProperty("event");
        expect(JSON.stringify(details)).toBe(JSON.stringify(driver.detailsFields(0)));
        expect(Object.isExtensible(details)).toBe(true);
      });

      it("can be passed straight to a Server-Function-shaped action", async () => {
        // A Server Function is just an async function to the library; it receives
        // `(next, details)` and the serialiser only ever sees the real fields.
        const serverFn = vi.fn(async (_next: V, _details: D) => {});
        render(<>{driver.render({ defaultValue: values[0], changeAction: serverFn })}</>);
        await driver.gesture(setupUser(), 0);
        expect(serverFn).toHaveBeenCalledTimes(1);
        const [next, details] = serverFn.mock.calls[0]!;
        expect(details.event).toBeInstanceOf(window.Event);
        expect(JSON.parse(JSON.stringify([next, details]))).toEqual(
          JSON.parse(JSON.stringify([values[1], driver.detailsFields(0)])),
        );
        driver.expectShown(values[1]);
      });
    });

    describe("dev warnings", () => {
      const { value: valueProp, defaultValue: defaultProp } = driver.props;
      const warnings = (spy: ReturnType<typeof silenceErrors>) =>
        spy.mock.calls.filter(([m]) => String(m).startsWith(driver.name));

      it(`warns once when \`${valueProp}\` and \`${defaultProp}\` are both set`, () => {
        const consoleError = silenceErrors();
        const ui = () => <>{driver.render({ value: values[1], defaultValue: values[1] })}</>;
        const { rerender } = render(ui());
        rerender(ui());
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toMatch(
          new RegExp(`both \`${valueProp}\` and \`${defaultProp}\``),
        );
        expect(warnings(consoleError)).toHaveLength(1);
      });

      it("warns once when switching from uncontrolled to controlled", () => {
        const consoleError = silenceErrors();
        // Uncontrolled with neither prop where the component allows it (Tabs warns about that).
        const first = driver.implicitDefault === false ? { defaultValue: values[0] } : {};
        const { rerender } = render(<>{driver.render(first)}</>);
        expect(consoleError).not.toHaveBeenCalled();
        rerender(<>{driver.render({ value: values[1] })}</>);
        rerender(<>{driver.render({ value: values[0] })}</>);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toMatch(/uncontrolled to controlled/);
        expect(warnings(consoleError)).toHaveLength(1);
      });

      it("does not warn in normal use", async () => {
        const consoleError = silenceErrors();
        const { rerender } = render(<>{driver.render({ defaultValue: values[0] })}</>);
        await driver.gesture(setupUser(), 0);
        rerender(<>{driver.render({ defaultValue: values[1] })}</>);
        expect(consoleError).not.toHaveBeenCalled();
      });
    });
  });
}

/**
 * The `fsui-*` View Transition types each gesture adds (conventions 5.3). jsdom has no
 * `startViewTransition`, so the caller's test file wraps React's `addTransitionType` with
 * `vi.mock("react", …)` with `withTransitionTypeSpy` (transition-type-spy.ts); without the mock
 * nothing is recorded and every row fails.
 */
export function describeValueTransitionTypes<V, D extends { readonly event: Event | undefined }>(
  driver: AnyDriver<V, D>,
): void {
  describe(`${driver.label ?? driver.name}: transition types`, () => {
    it.each(driver.transitionTypes.map((types, i) => [i, types] as const))(
      "gesture %i adds %j",
      async (i, types) => {
        render(<ValueHarness driver={driver} mode="uncontrolled" />);
        const user = setupUser();
        for (let step = 0; step < i; step++) await driver.gesture(user, step);
        addTransitionTypeSpy.mockClear();
        await driver.gesture(user, i);
        expect(recordedTransitionTypes()).toEqual(types);
      },
    );
  });
}
