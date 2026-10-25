// Shared conformance suite for the two-channel components (Slider, NumberField): a step channel
// (`valueChangeAction`, every tick) and a commit channel (`valueCommitAction`, once per gesture),
// each run in its own transition (conventions 10). The rows run over three wrappers: uncontrolled;
// a controlled parent that adopts every step; a controlled "update on commit success" parent.
// They cover the step transitions, the async commit, rejection, rollback with the control
// mounted, no snap while an adopting parent's content suspends, overlap, superseded rejections
// across the channels, suspending content, mount reconciliation, form reset and the post-await
// rule (audit T2 in memo/reviewer/wave18-audit-tests.md). Each component test file describes its
// component with a driver (src/__tests__/drivers/) and calls `describeCommitAction`; its local
// rows use `CommitFixture`. Component-specific rows (Slider pointer and geometry, NumberField
// typing drafts, hold and wheel) stay in the component files.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Component, StrictMode, Suspense, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushMicrotasks,
  hydrateFromServer,
  silenceErrors,
} from "./helpers.js";

/** The details fields the suite reads from both channels. */
export interface ChannelDetails {
  readonly reason: string;
  readonly event: Event | undefined;
}

/** The Root props the suite and the fixture set; a driver maps them onto its Root. */
export interface CommitRootProps<V, C, M> {
  readonly value?: V;
  readonly defaultValue?: V;
  readonly valueChangeAction?: (next: V, details: C) => unknown;
  readonly valueCommitAction?: (next: V, details: M) => unknown;
  readonly name?: string;
  readonly disabled?: boolean;
}

/**
 * Describes one two-channel component to the suite. Gesture `i` (0-3) is a user interaction
 * that, with `values[i]` shown, dispatches one step (when the gesture steps) and one commit of
 * `values[i + 1]`. A row that starts with gesture `i` renders `values[i]` as the initial value.
 */
export interface CommitActionDriver<
  V,
  C extends ChannelDetails,
  M extends ChannelDetails,
  P = object,
> {
  /** The component name, the title of the suite's describe block. */
  readonly name: string;
  /**
   * Renders the Root with `data-testid="root"` and its parts; `props` are the suite's, `rootProps`
   * a component file's own (passed last).
   */
  render(props: CommitRootProps<V, C, M>, rootProps: Partial<P> | undefined): ReactNode;
  readonly values: readonly [V, V, V, V, V];
  /** Performs gesture `i`. */
  gesture(i: number): void | Promise<void>;
  /**
   * Gesture 0 as a pointer press and release, each dispatched inside an awaited `act` (an update
   * that suspends must not run in a sync `act`).
   */
  readonly pointerGesture: { down(): Promise<void>; up(): Promise<void> };
  /** Asserts every DOM that shows the value (input values, custom properties, mirrors). */
  expectShown(v: V): void;
  /** The shown value as one string, recorded by a MutationObserver (no snap rows). */
  readShown(): string;
  /** `readShown()` of a value, and the text of the control's `defaultValue` at a form reset. */
  format(v: V): string;
  /** The `defaultValue` of the visible control, which a form reset restores. */
  readDefault(): string;
  /** Elements that carry `data-pending` while gesture `i`'s commit is in flight. */
  pendingOn(i: number): readonly Element[];
  /** The details field naming the part a gesture came from (`null` for platform dispatches). */
  readonly sourceKey: keyof C & keyof M;
  /** Before hydration: makes the server HTML's control hold `v`, as a user would. */
  setPlatformValue(container: HTMLElement, v: V): void;
  /** Leaves an uncommitted edit that a form reset discards (NumberField: a typed draft). */
  openDraft?(): void;
}

export type CommitMode = "uncontrolled" | "adopt" | "commit";
const modes: readonly CommitMode[] = ["uncontrolled", "adopt", "commit"];

/** One describe block per wrapper: `name (uncontrolled)`, `name (adopt)`, `name (commit)`. */
export function eachCommitMode(name: string, body: (mode: CommitMode) => void): void {
  describe.each(modes)(`${name} (%s)`, (mode) => body(mode));
}

export interface CommitFixtureProps<V, C, M, P> {
  readonly mode: CommitMode;
  readonly initial: V;
  readonly onChange?: (next: V, details: C) => unknown;
  readonly onCommit?: (next: V, details: M) => unknown;
  readonly rootProps?: Partial<P>;
  /** Content under the Root, rendered from the parent's committed value. */
  readonly below?: (value: V) => ReactNode;
  readonly boundary?: (error: unknown) => void;
  /** Wrap the Root in a boundary whose fallback has a "retry" button (a remount). */
  readonly retry?: boolean;
  /** Suite props for the Root (a form `name`, `disabled`). */
  readonly props?: CommitRootProps<V, C, M>;
}

/** An error boundary with a retry button: the control remounts from what its parent holds. */
class RetryBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error !== null) {
      return (
        <button type="button" onClick={() => this.setState({ error: null })}>
          retry
        </button>
      );
    }
    return this.props.children;
  }
}

/**
 * The three wrappers: uncontrolled; a controlled parent that adopts every step (`setValue` in the
 * step action's sync prefix); a controlled "update on success" parent
 * (`startTransition(() => setValue(next))` after the commit action's own `await`). The parent's
 * value is mirrored in `<output data-testid="parent">`.
 */
export function CommitFixture<V, C extends ChannelDetails, M extends ChannelDetails, P>({
  driver,
  mode,
  initial,
  onChange,
  onCommit,
  rootProps,
  below,
  boundary,
  retry,
  props: suiteProps,
}: CommitFixtureProps<V, C, M, P> & {
  readonly driver: CommitActionDriver<V, C, M, P>;
}): ReactNode {
  const [value, setValue] = useState<V>(initial);
  let props: CommitRootProps<V, C, M>;
  if (mode === "uncontrolled") {
    props = { defaultValue: initial, valueChangeAction: onChange, valueCommitAction: onCommit };
  } else if (mode === "adopt") {
    props = {
      value,
      valueChangeAction: (next, details) => {
        setValue(next);
        return onChange?.(next, details);
      },
      valueCommitAction: onCommit,
    };
  } else {
    props = {
      value,
      valueChangeAction: onChange,
      valueCommitAction: async (next, details) => {
        await onCommit?.(next, details);
        startTransition(() => setValue(next));
      },
    };
  }
  let control = driver.render({ ...props, ...suiteProps }, rootProps);
  if (boundary) control = <ErrorCatcher onError={boundary}>{control}</ErrorCatcher>;
  if (retry) control = <RetryBoundary>{control}</RetryBoundary>;
  return (
    <>
      {control}
      <output data-testid="parent">{String(value)}</output>
      {below?.(value)}
    </>
  );
}

export function describeCommitAction<V, C extends ChannelDetails, M extends ChannelDetails, P>(
  driver: CommitActionDriver<V, C, M, P>,
): void {
  type ChangeFn = (next: V, details: C) => unknown;
  type CommitFn = (next: V, details: M) => unknown;
  const { values } = driver;
  const root = () => screen.getByTestId("root");
  const parent = () => screen.getByTestId("parent");
  const source = (details: C | M) => details[driver.sourceKey];

  function Fixture(props: CommitFixtureProps<V, C, M, P>) {
    return <CommitFixture driver={driver} {...props} />;
  }

  /** Gesture `i`, then the microtasks its dispatches queue. */
  async function gesture(i: number) {
    await driver.gesture(i);
    await flushMicrotasks();
  }

  /** Content under the Root that suspends on the parent's value. */
  function suspendingBelow() {
    const suspender = createSuspender();
    suspender.resolve(String(values[0]));
    const below = (v: V) => (
      <Suspense fallback={<span data-testid="fallback" />}>
        <suspender.Suspender value={String(v)} />
      </Suspense>
    );
    return { below, resolve: suspender.resolve };
  }

  /** Commits that resolve or reject in the order the test settles them. */
  function sequencedCommits() {
    const first = deferred();
    const second = deferred();
    const onCommit = vi
      .fn<CommitFn>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    return { first, second, onCommit };
  }

  describe(`${driver.name}: commit action conformance`, () => {
    eachCommitMode("steps run in transitions", (mode) => {
      it("an async valueChangeAction is awaited in the step transition: data-pending until it settles", async () => {
        const d = deferred();
        render(<Fixture mode={mode} initial={values[0]} onChange={() => d.promise} />);
        await driver.pointerGesture.down();
        await flushMicrotasks();
        expectPending(root());
        driver.expectShown(values[1]);
        await driver.pointerGesture.up();
        await act(async () => d.resolve());
        expectNotPending(root());
        driver.expectShown(values[1]);
      });
    });

    describe("steps run in transitions", () => {
      // #81 H2
      it("a second step while the first step's action pends is called (no re-entry guard)", async () => {
        const first = deferred();
        const second = deferred();
        const onChange = vi
          .fn<ChangeFn>()
          .mockImplementationOnce(() => first.promise)
          .mockImplementationOnce(() => second.promise);
        render(<Fixture mode="uncontrolled" initial={values[1]} onChange={onChange} />);
        await gesture(1);
        expectPending(root());
        await gesture(2);
        // A step is not a re-entry: both steps ran.
        expect(onChange.mock.calls.map(([next]) => next)).toEqual([values[2], values[3]]);
        await act(async () => first.resolve());
        await act(async () => second.resolve());
        expectNotPending(root());
      });
    });

    eachCommitMode("async commit", (mode) => {
      it("holds the gesture value with data-pending until the save resolves", async () => {
        const d = deferred();
        const onCommit = vi.fn<CommitFn>(() => d.promise);
        render(<Fixture mode={mode} initial={values[0]} onCommit={onCommit} />);
        await gesture(0);
        expect(onCommit).toHaveBeenCalledTimes(1);
        for (const el of driver.pendingOn(0)) expectPending(el);
        driver.expectShown(values[1]);
        if (mode !== "adopt") expect(parent()).toHaveTextContent(String(values[0]));
        await act(async () => d.resolve());
        for (const el of driver.pendingOn(0)) expectNotPending(el);
        driver.expectShown(values[1]);
        if (mode !== "uncontrolled") expect(parent()).toHaveTextContent(String(values[1]));
      });
    });

    eachCommitMode("rejection", (mode) => {
      it('reaches the boundary, which replaces the control; uncontrolled reports the revert as a "dismiss" step', async () => {
        silenceErrors();
        const d = deferred();
        const caught = vi.fn();
        const onChange = vi.fn<ChangeFn>();
        render(
          <Fixture
            mode={mode}
            initial={values[3]}
            onChange={onChange}
            onCommit={() => d.promise}
            boundary={caught}
          />,
        );
        await gesture(3);
        driver.expectShown(values[4]);
        onChange.mockClear();
        await act(async () => d.reject(new Error("save failed")));
        expect(caught).toHaveBeenCalledTimes(1);
        expect((caught.mock.calls[0]![0] as Error).message).toBe("save failed");
        // The boundary is above the Root: the rollback is not a slide-back but a remount.
        expect(screen.queryByTestId("root")).toBeNull();
        if (mode === "uncontrolled") {
          expect(onChange).toHaveBeenCalledTimes(1);
          const [next, details] = onChange.mock.calls[0]!;
          expect(next).toEqual(values[3]);
          expect(details.reason).toBe("dismiss");
          expect(source(details)).toBeNull();
          expect(details.event).toBeUndefined();
        } else {
          expect(onChange.mock.calls.filter((c) => c[1].reason === "dismiss")).toHaveLength(0);
        }
      });

      it("after a retry the remounted control shows the value its parent holds", async () => {
        silenceErrors();
        const d = deferred();
        render(<Fixture mode={mode} initial={values[0]} onCommit={() => d.promise} retry />);
        await gesture(0);
        await act(async () => d.reject(new Error("x")));
        expect(screen.queryByTestId("root")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "retry" }));
        await flushMicrotasks();
        // Uncontrolled: `defaultValue`; update on success: the parent never took the new value; an
        // adopting parent took it in the step and owns its own rollback.
        driver.expectShown(mode === "adopt" ? values[1] : values[0]);
      });

      it("commits when the action catches its own error", async () => {
        const onCommit = vi.fn<CommitFn>(async () => {
          try {
            throw new Error("handled");
          } catch {
            // handled inside
          }
        });
        render(<Fixture mode={mode} initial={values[0]} onCommit={onCommit} />);
        await gesture(0);
        driver.expectShown(values[1]);
        expectNotPending(root());
      });
    });

    describe("rollback with the control mounted", () => {
      it("an update-on-success parent whose save fails (handled in the action): the control returns to the parent's value", async () => {
        const d = deferred();
        const onChange = vi.fn<ChangeFn>();
        function Parent() {
          const [value, setValue] = useState<V>(values[3]);
          return (
            <>
              {driver.render(
                {
                  value,
                  valueChangeAction: onChange,
                  valueCommitAction: async (next) => {
                    try {
                      await d.promise;
                      startTransition(() => setValue(next));
                    } catch {
                      // Reported elsewhere; the parent keeps its value.
                    }
                  },
                },
                undefined,
              )}
              <output data-testid="parent">{String(value)}</output>
            </>
          );
        }
        render(<Parent />);
        await gesture(3);
        driver.expectShown(values[4]);
        expectPending(root());
        await act(async () => d.reject(new Error("save failed")));
        expectNotPending(root());
        expect(parent()).toHaveTextContent(String(values[3]));
        driver.expectShown(values[3]);
        // A controlled control reports no "dismiss" step: the parent owns the value.
        expect(onChange.mock.calls.filter((c) => c[1].reason === "dismiss")).toHaveLength(0);
      });
    });

    describe("no snap", () => {
      it("shows the gesture value until an adopting parent's suspended content resolves", async () => {
        const { below, resolve } = suspendingBelow();
        render(<Fixture mode="adopt" initial={values[0]} below={below} />);
        // Every value shown from here on, so a snap back to the old value in between is caught.
        const seen: string[] = [];
        const observer = new MutationObserver(() => seen.push(driver.readShown()));
        observer.observe(root(), { attributes: true, subtree: true, characterData: true });
        await driver.pointerGesture.down();
        expect(parent()).toHaveTextContent(String(values[0]));
        await driver.pointerGesture.up();
        driver.expectShown(values[1]);
        expectPending(root());
        expect(screen.getByTestId("suspender")).toHaveTextContent(String(values[0]));
        expect(screen.queryByTestId("fallback")).toBeNull();
        await act(async () => resolve(String(values[1])));
        expect(screen.getByTestId("suspender")).toHaveTextContent(String(values[1]));
        expectNotPending(root());
        driver.expectShown(values[1]);
        observer.disconnect();
        expect(seen).not.toContain(driver.format(values[0]));
      });
    });

    eachCommitMode("overlap", (mode) => {
      it("keeps data-pending across two gestures; the latest commit lands", async () => {
        const { first, second, onCommit } = sequencedCommits();
        render(<Fixture mode={mode} initial={values[2]} onCommit={onCommit} />);
        await gesture(2);
        await gesture(3);
        expect(onCommit).toHaveBeenCalledTimes(2);
        await act(async () => first.resolve());
        expectPending(root());
        driver.expectShown(values[4]);
        await act(async () => second.resolve());
        expectNotPending(root());
        driver.expectShown(values[4]);
        if (mode !== "uncontrolled") expect(parent()).toHaveTextContent(String(values[4]));
      });

      it("surfaces the superseded commit's rejection", async () => {
        silenceErrors();
        const { first, second, onCommit } = sequencedCommits();
        const caught = vi.fn();
        const onChange = vi.fn<ChangeFn>();
        render(
          <Fixture
            mode={mode}
            initial={values[1]}
            onChange={onChange}
            onCommit={onCommit}
            boundary={caught}
          />,
        );
        await gesture(1);
        await gesture(2);
        await act(async () => first.reject(new Error("older")));
        if (mode === "adopt") {
          // The adopting parent's step updates are entangled with the pending save (React holds a
          // transition update until every async action in its scope settles), so the boundary's
          // retry render waits for the newer commit too: the error arrives once it settles.
          expect(caught).not.toHaveBeenCalled();
        } else {
          expect(caught).toHaveBeenCalledTimes(1);
        }
        await act(async () => second.resolve());
        expect(caught).toHaveBeenCalledTimes(1);
        expect((caught.mock.calls[0]![0] as Error).message).toBe("older");
        // A superseded commit's rejection is no "dismiss" step: only the latest one reverts.
        expect(onChange.mock.calls.filter((c) => c[1].reason === "dismiss")).toHaveLength(0);
      });

      it("the older rejects after the newer resolved", async () => {
        silenceErrors();
        const { first, second, onCommit } = sequencedCommits();
        const caught = vi.fn();
        const onChange = vi.fn<ChangeFn>();
        render(
          <Fixture
            mode={mode}
            initial={values[1]}
            onChange={onChange}
            onCommit={onCommit}
            boundary={caught}
          />,
        );
        await gesture(1);
        await gesture(2);
        await act(async () => second.resolve());
        await act(async () => first.reject(new Error("older")));
        expect(caught).toHaveBeenCalledTimes(1);
        expect((caught.mock.calls[0]![0] as Error).message).toBe("older");
        // A superseded commit's rejection is no "dismiss" step: only the latest one reverts.
        expect(onChange.mock.calls.filter((c) => c[1].reason === "dismiss")).toHaveLength(0);
      });
    });

    describe("superseded rejection across channels", () => {
      // Each channel (steps, commits) surfaces the rejection of a superseded run by throwing it
      // from render. That must not wait for the other channel's pending action (#105).
      function setup() {
        silenceErrors();
        const steps = [deferred(), deferred()];
        const commits = [deferred(), deferred()];
        const caught = vi.fn();
        const onChange = vi
          .fn<ChangeFn>()
          .mockImplementationOnce(() => steps[0]!.promise)
          .mockImplementationOnce(() => steps[1]!.promise);
        const onCommit = vi
          .fn<CommitFn>()
          .mockImplementationOnce(() => commits[0]!.promise)
          .mockImplementationOnce(() => commits[1]!.promise);
        render(
          <Fixture
            mode="uncontrolled"
            initial={values[1]}
            onChange={onChange}
            onCommit={onCommit}
            boundary={caught}
          />,
        );
        return { steps, commits, caught, onChange, onCommit };
      }

      it("a superseded step's rejection reaches the boundary while commits are pending", async () => {
        const { steps, caught, onChange, onCommit } = setup();
        await gesture(1);
        await gesture(2);
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(onCommit).toHaveBeenCalledTimes(2);
        await act(async () => steps[0]!.reject(new Error("older step")));
        expect(caught).toHaveBeenCalledTimes(1);
        expect((caught.mock.calls[0]![0] as Error).message).toBe("older step");
      });

      it("a superseded commit's rejection reaches the boundary while a step is pending", async () => {
        const { commits, caught } = setup();
        await gesture(1);
        await gesture(2);
        await act(async () => commits[0]!.reject(new Error("older commit")));
        expect(caught).toHaveBeenCalledTimes(1);
        expect((caught.mock.calls[0]![0] as Error).message).toBe("older commit");
      });
    });

    describe("suspending content", () => {
      it("an adopting parent's content keyed on the value keeps the old content while it loads", async () => {
        const suspender = createSuspender();
        suspender.resolve(String(values[1]));
        render(
          <Fixture
            mode="adopt"
            initial={values[1]}
            below={(v) => (
              <Suspense fallback={<span data-testid="fallback" />}>
                <suspender.Suspender value={String(v)} />
              </Suspense>
            )}
          />,
        );
        await gesture(1);
        expect(screen.getByTestId("suspender")).toHaveTextContent(String(values[1]));
        expect(screen.queryByTestId("fallback")).toBeNull();
        for (const el of driver.pendingOn(1)) expectPending(el);
        driver.expectShown(values[2]);
        await act(async () => suspender.resolve(String(values[2])));
        expect(screen.getByTestId("suspender")).toHaveTextContent(String(values[2]));
        expectNotPending(root());
      });
    });

    const hydrate = (ui: ReactNode, mutate: (container: HTMLElement) => void) =>
      hydrateFromServer(ui, { mutate });

    eachCommitMode("mount reconciliation", (mode) => {
      it("adopts a value entered before hydration with one platform step + commit", async () => {
        const onChange = vi.fn<ChangeFn>();
        const onCommit = vi.fn<CommitFn>();
        await hydrate(
          <Fixture mode={mode} initial={values[0]} onChange={onChange} onCommit={onCommit} />,
          (c) => driver.setPlatformValue(c, values[1]),
        );
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0]).toEqual(values[1]);
        expect(onChange.mock.calls[0]![1].reason).toBe("platform");
        expect(source(onChange.mock.calls[0]![1])).toBeNull();
        expect(onChange.mock.calls[0]![1].event).toBeUndefined();
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit.mock.calls[0]![0]).toEqual(values[1]);
        expect(onCommit.mock.calls[0]![1].reason).toBe("platform");
        driver.expectShown(values[1]);
      });

      it("dispatches once under StrictMode and not at all when equal", async () => {
        const onCommit = vi.fn<CommitFn>();
        await hydrate(
          <StrictMode>
            <Fixture mode={mode} initial={values[0]} onCommit={onCommit} />
          </StrictMode>,
          (c) => driver.setPlatformValue(c, values[2]),
        );
        expect(onCommit).toHaveBeenCalledTimes(1);
        document.body.innerHTML = "";
        const quiet = vi.fn<CommitFn>();
        await hydrate(<Fixture mode={mode} initial={values[0]} onCommit={quiet} />, () => {});
        expect(quiet).not.toHaveBeenCalled();
      });
    });

    eachCommitMode("form reset", (mode) => {
      function InForm(props: Omit<CommitFixtureProps<V, C, M, P>, "mode" | "initial">) {
        return (
          <form data-testid="form">
            <Fixture
              mode={mode}
              initial={values[0]}
              {...props}
              props={{ name: "v", ...props.props }}
            />
            <button type="reset" data-testid="reset">
              reset
            </button>
          </form>
        );
      }
      const form = () => screen.getByTestId("form") as HTMLFormElement;

      it("form.reset() mirrors the target into defaultValue and dispatches step + commit", async () => {
        const onChange = vi.fn<ChangeFn>();
        const onCommit = vi.fn<CommitFn>();
        render(<InForm onChange={onChange} onCommit={onCommit} />);
        await gesture(0);
        driver.expectShown(values[1]);
        onChange.mockClear();
        onCommit.mockClear();
        let defaultAtEvent: string | undefined;
        form().addEventListener("reset", () => {
          queueMicrotask(() => {
            defaultAtEvent = driver.readDefault();
          });
        });
        await act(async () => form().reset());
        await flushMicrotasks();
        expect(defaultAtEvent).toBe(driver.format(values[0]));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0]).toEqual(values[0]);
        expect(onChange.mock.calls[0]![1].reason).toBe("platform");
        expect(onChange.mock.calls[0]![1].event?.type).toBe("reset");
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit.mock.calls[0]![0]).toEqual(values[0]);
        expect(onCommit.mock.calls[0]![1].reason).toBe("platform");
        expect(source(onCommit.mock.calls[0]![1])).toBeNull();
        expect(onCommit.mock.calls[0]![1].event?.type).toBe("reset");
        driver.expectShown(values[0]);
        if (mode !== "uncontrolled") expect(parent()).toHaveTextContent(String(values[0]));
      });

      it("a reset button works the same, a cancelled reset dispatches nothing, a draft is cleared", async () => {
        const onCommit = vi.fn<CommitFn>();
        render(<InForm onCommit={onCommit} />);
        await gesture(0);
        onCommit.mockClear();
        const cancel = (e: Event) => e.preventDefault();
        form().addEventListener("reset", cancel);
        await act(async () => fireEvent.click(screen.getByTestId("reset")));
        await flushMicrotasks();
        expect(onCommit).not.toHaveBeenCalled();
        form().removeEventListener("reset", cancel);
        driver.openDraft?.();
        await act(async () => fireEvent.click(screen.getByTestId("reset")));
        await flushMicrotasks();
        expect(onCommit).toHaveBeenCalledTimes(1);
        driver.expectShown(values[0]);
      });

      it("a disabled control still follows a reset", async () => {
        const onCommit = vi.fn<CommitFn>();
        function Toggle() {
          const [disabled, setDisabled] = useState(false);
          return (
            <>
              <InForm onCommit={onCommit} props={{ disabled }} />
              <button type="button" onClick={() => setDisabled(true)}>
                disable
              </button>
            </>
          );
        }
        render(<Toggle />);
        await gesture(0);
        fireEvent.click(screen.getByText("disable"));
        await act(async () => form().reset());
        await flushMicrotasks();
        driver.expectShown(values[0]);
      });

      it("follows React's automatic reset after a successful form action", async () => {
        const onCommit = vi.fn<CommitFn>();
        const submitted = vi.fn();
        render(
          <form
            data-testid="form"
            action={async (data) => {
              submitted(data.get("v"));
            }}
          >
            <Fixture mode={mode} initial={values[0]} onCommit={onCommit} props={{ name: "v" }} />
            <button type="submit" data-testid="submit">
              save
            </button>
          </form>,
        );
        await gesture(0);
        onCommit.mockClear();
        await act(async () => fireEvent.click(screen.getByTestId("submit")));
        await flushMicrotasks();
        await flushMicrotasks();
        expect(submitted).toHaveBeenCalledWith(String(values[1]));
        expect(onCommit).toHaveBeenCalledWith(
          values[0],
          expect.objectContaining({ reason: "platform" }),
        );
        driver.expectShown(values[0]);
      });
    });

    describe("form reset, controlled specifics", () => {
      it("resets to the mount-time value and re-syncs the DOM when the parent refuses", async () => {
        const onCommit = vi.fn<CommitFn>();
        function Refusing() {
          const [value, setValue] = useState<V>(values[0]);
          return (
            <form data-testid="form">
              {driver.render(
                {
                  value,
                  valueCommitAction: (next, details) => {
                    onCommit(next, details);
                    if (details.reason !== "platform") setValue(next);
                  },
                },
                undefined,
              )}
            </form>
          );
        }
        render(<Refusing />);
        await gesture(0);
        driver.expectShown(values[1]);
        await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
        await flushMicrotasks();
        expect(onCommit).toHaveBeenLastCalledWith(
          values[0],
          expect.objectContaining({ reason: "platform" }),
        );
        driver.expectShown(values[1]);
      });

      it("resets an uncontrolled control to the latest defaultValue", async () => {
        function Latest() {
          const [d, setD] = useState<V>(values[0]);
          return (
            <form data-testid="form">
              {driver.render({ defaultValue: d }, undefined)}
              <button type="button" onClick={() => setD(values[4])}>
                change default
              </button>
            </form>
          );
        }
        silenceErrors();
        render(<Latest />);
        await gesture(0);
        fireEvent.click(screen.getByText("change default"));
        await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
        await flushMicrotasks();
        driver.expectShown(values[4]);
      });
    });

    describe("post-await rule", () => {
      it("a controlled parent updating after its own await inside startTransition", async () => {
        const d = deferred();
        render(<Fixture mode="commit" initial={values[0]} onCommit={() => d.promise} />);
        await gesture(0);
        expect(parent()).toHaveTextContent(String(values[0]));
        driver.expectShown(values[1]);
        await act(async () => d.resolve());
        expect(parent()).toHaveTextContent(String(values[1]));
        driver.expectShown(values[1]);
        expectNotPending(root());
      });
    });
  });
}
