// Unit rows for `useActionTrigger` (design/components/button.md 16.4 H1). The parts that use it
// (Button, Dialog.Close, Popover.Close, Menu.Item, Toast.Action, the Slider and NumberField steps)
// cover it through their own suites; these rows pin the default and the opt-out.
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, ErrorCatcher, silenceErrors } from "../__tests__/helpers.js";
import { useActionTrigger } from "./use-action-trigger.js";
import type { ActionTrigger, ActionTriggerOptions } from "./use-action-trigger.js";

function Probe({
  options,
  onHook,
}: {
  options?: ActionTriggerOptions;
  onHook: (hook: ActionTrigger) => void;
}) {
  const hook = useActionTrigger(options);
  onHook(hook);
  return <output data-testid="pending">{String(hook.pending)}</output>;
}

function setup(options?: ActionTriggerOptions, onError?: (error: unknown) => void) {
  let hook!: ActionTrigger;
  const probe = <Probe options={options} onHook={(h) => (hook = h)} />;
  const view = render(onError ? <ErrorCatcher onError={onError}>{probe}</ErrorCatcher> : probe);
  return {
    hook: () => hook,
    pending: () => view.queryByTestId("pending")?.textContent,
    caught: () => view.queryByTestId("error-catcher"),
  };
}

describe("useActionTrigger: re-entry (default)", () => {
  it("a second run while the first is in flight is ignored; after settle it runs", async () => {
    const { hook, pending } = setup();
    const first = deferred();
    const work = vi.fn(() => first.promise);
    const then = vi.fn();
    let started!: boolean;
    let again!: boolean;
    act(() => {
      started = hook().run(work, then);
      // Same task: React's `pending` is still the stale `false`, the in-flight counter is not.
      again = hook().run(work, then);
    });
    expect(started).toBe(true);
    expect(again).toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
    expect(pending()).toBe("true");
    act(() => {
      again = hook().run(work, then);
    });
    expect(again).toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    expect(then).toHaveBeenCalledTimes(1);
    expect(pending()).toBe("false");
    await act(async () => {
      again = hook().run(() => undefined, then);
    });
    expect(again).toBe(true);
    expect(then).toHaveBeenCalledTimes(2);
  });

  it("the run's rejection reaches the boundary above the part", async () => {
    silenceErrors();
    const caught = vi.fn();
    const { hook, caught: catcher } = setup(undefined, caught);
    const first = deferred();
    act(() => {
      hook().run(() => first.promise);
    });
    await act(async () => first.reject(new Error("failed")));
    expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "failed" }));
    expect(catcher()).not.toBeNull();
  });
});

describe("useActionTrigger: ignoreWhilePending: false (the continuous controls)", () => {
  it("runs both; pending stays until both settle", async () => {
    const { hook, pending } = setup({ ignoreWhilePending: false });
    const runs = [deferred(), deferred()];
    const work = vi.fn((i: number) => runs[i]!.promise);
    const then = vi.fn();
    let results: boolean[] = [];
    act(() => {
      results = [hook().run(() => work(0), then), hook().run(() => work(1), then)];
    });
    expect(results).toEqual([true, true]);
    expect(work).toHaveBeenCalledTimes(2);
    await act(async () => runs[1]!.resolve());
    await act(async () => runs[0]!.resolve());
    expect(then).toHaveBeenCalledTimes(2);
    expect(pending()).toBe("false");
  });

  // moved from the Close / Item rows, #81
  it.each([
    ["while the newer run is pending", false],
    ["after the newer run resolved", true],
  ] as const)("a superseded rejection %s is reported, not thrown", async (_label, newerFirst) => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const caught = vi.fn();
    const then = vi.fn();
    const { hook, pending } = setup({ ignoreWhilePending: false }, caught);
    const runs = [deferred(), deferred()];
    act(() => {
      hook().run(() => runs[0]!.promise, then);
      hook().run(() => runs[1]!.promise, then);
    });
    if (newerFirst) await act(async () => runs[1]!.resolve());
    const older = new Error("older failed");
    await act(async () => runs[0]!.reject(older));
    if (!newerFirst) await act(async () => runs[1]!.resolve());
    expect(reportError).toHaveBeenCalledExactlyOnceWith(older);
    expect(caught).not.toHaveBeenCalled();
    // The rejected run skips its `then`; the newer one ran its own.
    expect(then).toHaveBeenCalledTimes(1);
    expect(pending()).toBe("false");
  });
});

describe("useActionTrigger: openGeneration", () => {
  it("skips `then` when the generation changed after the run began", async () => {
    let generation = 1;
    const { hook } = setup({ openGeneration: () => generation });
    const work = deferred();
    const then = vi.fn();
    act(() => {
      hook().run(() => work.promise, then);
    });
    generation = 2;
    await act(async () => work.resolve());
    expect(then).not.toHaveBeenCalled();
  });
});
describe("useActionTrigger: superseded rejections, burst and unmount", () => {
  function runThree(hook: () => ActionTrigger) {
    const runs = [deferred(), deferred(), deferred()];
    act(() => {
      for (const run of runs) hook().run(() => run.promise);
    });
    return runs;
  }

  it("reports every superseded rejection; the latest one reaches the boundary", async () => {
    silenceErrors();
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const caught = vi.fn();
    const { hook } = setup({ ignoreWhilePending: false }, caught);
    const runs = runThree(hook);
    const first = new Error("first");
    const second = new Error("second");
    await act(async () => {
      runs[0]!.reject(first);
      runs[1]!.reject(second);
    });
    expect(reportError.mock.calls).toEqual([[first], [second]]);
    expect(caught).not.toHaveBeenCalled();
    const latest = new Error("latest");
    await act(async () => runs[2]!.reject(latest));
    expect(caught).toHaveBeenCalledExactlyOnceWith(latest);
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("still reports superseded rejections once unmounted; nothing is thrown", async () => {
    const consoleError = silenceErrors();
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    let hook!: ActionTrigger;
    const caught = vi.fn();
    const view = render(
      <ErrorCatcher onError={caught}>
        <Probe options={{ ignoreWhilePending: false }} onHook={(h) => (hook = h)} />
      </ErrorCatcher>,
    );
    const runs = runThree(() => hook);
    view.unmount();
    const first = new Error("first");
    const second = new Error("second");
    await act(async () => {
      runs[0]!.reject(first);
      runs[1]!.reject(second);
      runs[2]!.resolve();
    });
    expect(caught).not.toHaveBeenCalled();
    expect(reportError.mock.calls).toEqual([[first], [second]]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
