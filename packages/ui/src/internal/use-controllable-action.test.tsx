// Unit rows for `useControllableAction` that no component suite isolates. The state model itself
// (optimistic, transitions) is covered through every component's suite; the superseded-rejection
// rules (reportError, not the boundary; every one of a burst; unmount; the console fallback) and
// the uncontrolled reducer commit (#150) also have direct rows here.
import { act, render } from "@testing-library/react";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, ErrorCatcher, silenceErrors } from "../__tests__/helpers.js";
import type { ActionDetails } from "./types.js";
import { useControllableAction } from "./use-controllable-action.js";
import type { ControllableAction } from "./use-controllable-action.js";

type Hook = ControllableAction<string, ActionDetails>;

function Probe({
  controlled,
  action,
  onHook,
}: {
  controlled?: string;
  action: (next: string) => unknown;
  onHook: (hook: Hook) => void;
}) {
  const hook = useControllableAction<string, ActionDetails>({
    controlled,
    defaultValue: undefined,
    initialValue: "",
    action,
  });
  onHook(hook);
  return (
    <output data-testid="value">
      {hook.committed}|{hook.optimistic}|{String(hook.pending)}
    </output>
  );
}

function setup(controlled?: string) {
  const action = vi.fn<(next: string) => unknown>();
  let hook!: Hook;
  const view = render(<Probe controlled={controlled} action={action} onHook={(h) => (hook = h)} />);
  return { action, hook: () => hook, value: () => view.getByTestId("value").textContent };
}

describe("useControllableAction: adopt", () => {
  it("uncontrolled: writes committed and optimistic without the action, a transition or pending", async () => {
    const { action, hook, value } = setup();
    expect(value()).toBe("||false");
    act(() => {
      hook().adopt("b");
    });
    // A plain (sync-lane) update: committed in the same act, never pending.
    expect(value()).toBe("b|b|false");
    expect(hook().latestInFlight()).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("uncontrolled: a later dispatch builds on the adopted value", async () => {
    const { action, hook, value } = setup();
    act(() => {
      hook().adopt("b");
    });
    await act(async () => {
      hook().dispatch("c", {} as ActionDetails);
    });
    expect(action).toHaveBeenCalledExactlyOnceWith("c", {});
    expect(value()).toBe("c|c|false");
  });

  it("controlled: a no-op", () => {
    const { action, hook, value } = setup("a");
    act(() => {
      hook().adopt("b");
    });
    expect(value()).toBe("a|a|false");
    expect(action).not.toHaveBeenCalled();
  });

  it("controlled: the parent's value still wins after an adopt attempt", () => {
    let hook!: Hook;
    const onHook = (h: Hook) => (hook = h);
    const view = render(<Probe controlled="a" action={() => {}} onHook={onHook} />);
    act(() => {
      hook.adopt("b");
    });
    view.rerender(<Probe controlled="c" action={() => {}} onHook={onHook} />);
    expect(view.getByTestId("value").textContent).toBe("c|c|false");
  });
});

// #148 (design/components/overlay-open-change.md 2.5): a fact supersedes every dispatch in flight.
describe("useControllableAction: adoptFact", () => {
  it("uncontrolled, nothing in flight: commits urgently, never calls the action, never pending", () => {
    const { action, hook, value } = setup();
    act(() => {
      hook().adoptFact("b");
    });
    expect(value()).toBe("b|b|false");
    expect(hook().latestInFlight()).toBeNull();
    expect(hook().epoch).toBe(1);
    expect(action).not.toHaveBeenCalled();
  });

  it("uncontrolled, a dispatch in flight: drops its optimistic patch, makes the fact the intent, and its resolution commits nothing", async () => {
    const { action, hook, value } = setup();
    const d = deferred();
    action.mockImplementation(() => d.promise);
    act(() => {
      hook().dispatch("x", {} as ActionDetails);
    });
    expect(value()).toBe("|x|true");
    act(() => {
      hook().adoptFact("b");
    });
    // The stale patch is gone in the fact's own commit; pending reports the running action.
    expect(value()).toBe("b|b|true");
    expect(hook().latestInFlight()).toEqual({ next: "b" });
    await act(async () => d.resolve());
    expect(value()).toBe("b|b|false");
    expect(hook().latestInFlight()).toBeNull();
  });

  it("a superseded dispatch that rejects after the fact is reported, not thrown", async () => {
    silenceErrors();
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const caught = vi.fn();
    const d = deferred();
    let hook!: Hook;
    const view = render(
      <ErrorCatcher onError={caught}>
        <Probe action={() => d.promise} onHook={(h) => (hook = h)} />
      </ErrorCatcher>,
    );
    act(() => {
      hook.dispatch("x", {} as ActionDetails);
    });
    act(() => {
      hook.adoptFact("b");
    });
    const err = new Error("superseded");
    await act(async () => d.reject(err));
    expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
    expect(caught).not.toHaveBeenCalled();
    expect(view.getByTestId("value").textContent).toBe("b|b|false");
  });

  it("a dispatch after the fact works as usual (its patch is not dropped)", async () => {
    const { action, hook, value } = setup();
    act(() => {
      hook().adoptFact("b");
    });
    const d = deferred();
    action.mockImplementation(() => d.promise);
    act(() => {
      hook().dispatch("c", {} as ActionDetails);
    });
    expect(value()).toBe("b|c|true");
    await act(async () => d.resolve());
    expect(value()).toBe("c|c|false");
  });

  it("controlled: never writes the value; the epoch still changes so consumers re-render", () => {
    const { action, hook, value } = setup("a");
    const before = hook();
    act(() => {
      hook().adoptFact("b");
    });
    expect(value()).toBe("a|a|false");
    expect(hook().epoch).toBe(1);
    // A new value object: a memoised context built on it re-renders its parts.
    expect(hook()).not.toBe(before);
    expect(action).not.toHaveBeenCalled();
  });
});

// #48: the hook's value only changes with its state, so the components' memoised context values
// built on it are reused when the owner re-renders for anything else.
describe("useControllableAction: referential stability", () => {
  function Stable({
    controlled,
    action,
    types,
    onHook,
  }: {
    controlled?: string;
    action: (next: string) => unknown;
    types?: (next: string, prev: string) => readonly string[];
    onHook: (hook: Hook) => void;
  }) {
    const hook = useControllableAction<string, ActionDetails>({
      controlled,
      defaultValue: undefined,
      initialValue: "",
      // Inline wrappers, new on every render, as the components pass them.
      action: (next) => action(next),
      transitionTypes: (next, prev) => types?.(next, prev) ?? [],
      reducer: (_prev, next) => next,
      warn: { component: "Stable", prop: "value" },
    });
    onHook(hook);
    return <output data-testid="value">{hook.optimistic}</output>;
  }

  it("returns the same value across re-renders with unchanged state", () => {
    const hooks: Hook[] = [];
    const onHook = (h: Hook) => hooks.push(h);
    const view = render(<Stable action={() => {}} onHook={onHook} />);
    view.rerender(<Stable action={() => {}} onHook={onHook} />);
    view.rerender(<Stable action={() => {}} types={() => []} onHook={onHook} />);
    expect(hooks.length).toBeGreaterThanOrEqual(3);
    for (const h of hooks) expect(h).toBe(hooks[0]);
  });

  it("keeps its functions when the state changes", async () => {
    const hooks: Hook[] = [];
    const onHook = (h: Hook) => hooks.push(h);
    const view = render(<Stable action={() => {}} onHook={onHook} />);
    const first = hooks[0]!;
    await act(async () => {
      first.dispatch("b", {} as ActionDetails);
    });
    expect(view.getByTestId("value").textContent).toBe("b");
    const last = hooks.at(-1)!;
    expect(last).not.toBe(first);
    expect(last.committed).toBe("b");
    expect(last.dispatch).toBe(first.dispatch);
    expect(last.latestInFlight).toBe(first.latestInFlight);
    expect(last.adopt).toBe(first.adopt);
  });

  it("a dispatch runs the action and transition types of the last committed render", async () => {
    const hooks: Hook[] = [];
    const onHook = (h: Hook) => hooks.push(h);
    const before = vi.fn<(next: string) => unknown>();
    const after = vi.fn<(next: string) => unknown>();
    const types = vi.fn<(next: string, prev: string) => readonly string[]>(() => []);
    const view = render(<Stable controlled="a" action={before} onHook={onHook} />);
    const dispatch = hooks[0]!.dispatch;
    // A new action and a new controlled value: the function obtained before sees both.
    view.rerender(<Stable controlled="b" action={after} types={types} onHook={onHook} />);
    await act(async () => {
      dispatch("c", {} as ActionDetails);
    });
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledExactlyOnceWith("c");
    expect(types).toHaveBeenCalledExactlyOnceWith("c", "b");
  });
});

describe("useControllableAction: superseded rejections", () => {
  /** Three dispatches whose actions settle when the test says; the Probe sits in a boundary. */
  function setupBurst() {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const runs = [deferred(), deferred(), deferred()];
    let call = 0;
    const caught = vi.fn();
    let hook!: Hook;
    function BurstProbe({ onHook }: { onHook: (h: Hook) => void }) {
      const h = useControllableAction<string, ActionDetails>({
        controlled: undefined,
        defaultValue: undefined,
        initialValue: "",
        action: () => runs[call++]!.promise,
      });
      onHook(h);
      return <output data-testid="value">{h.committed}</output>;
    }
    const view = render(
      <ErrorCatcher onError={caught}>
        <BurstProbe onHook={(h) => (hook = h)} />
      </ErrorCatcher>,
    );
    act(() => {
      hook.dispatch("a", {} as ActionDetails);
      hook.dispatch("b", {} as ActionDetails);
      hook.dispatch("c", {} as ActionDetails);
    });
    return { runs, caught, reportError, view };
  }

  it("reports a superseded dispatch's rejection instead of throwing it", async () => {
    const { runs, caught, reportError, view } = setupBurst();
    const older = new Error("older");
    await act(async () => runs[0]!.reject(older));
    expect(reportError).toHaveBeenCalledExactlyOnceWith(older);
    expect(caught).not.toHaveBeenCalled();
    await act(async () => {
      runs[1]!.resolve();
      runs[2]!.resolve();
    });
    expect(view.getByTestId("value").textContent).toBe("c");
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("reports every superseded rejection; the latest one reaches the boundary", async () => {
    silenceErrors();
    const { runs, caught, reportError } = setupBurst();
    const first = new Error("first");
    const second = new Error("second");
    const latest = new Error("latest");
    await act(async () => {
      runs[0]!.reject(first);
      runs[1]!.reject(second);
    });
    expect(reportError.mock.calls).toEqual([[first], [second]]);
    expect(caught).not.toHaveBeenCalled();
    await act(async () => runs[2]!.reject(latest));
    expect(caught).toHaveBeenCalledExactlyOnceWith(latest);
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("still reports superseded rejections once unmounted; nothing is thrown", async () => {
    const consoleError = silenceErrors();
    const { runs, caught, reportError, view } = setupBurst();
    view.unmount();
    const first = new Error("first");
    await act(async () => {
      runs[0]!.reject(first);
      runs[1]!.resolve();
      runs[2]!.resolve();
    });
    expect(caught).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(first);
    expect(consoleError).not.toHaveBeenCalled();
  });

  // #152: React routes the latest dispatch's rejection only through a render of the component
  // that owns it; once that component left, the hook reports it.
  it.each([
    ["unmounted", "gone"],
    ["hidden by <Activity>", "hidden"],
  ] as const)(
    "%s: the latest rejection is reported once, the boundary never reached",
    async (_label, away) => {
      const consoleError = silenceErrors();
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      const caught = vi.fn();
      const run = deferred();
      let hook!: Hook;
      type Mode = "shown" | "hidden" | "gone";
      function App({ mode }: { mode: Mode }) {
        return (
          <ErrorCatcher onError={caught}>
            {mode === "gone" ? null : (
              <Activity mode={mode === "hidden" ? "hidden" : "visible"}>
                <Probe action={() => run.promise} onHook={(h) => (hook = h)} />
              </Activity>
            )}
          </ErrorCatcher>
        );
      }
      const view = render(<App mode="shown" />);
      const setMode = (mode: Mode) => view.rerender(<App mode={mode} />);
      act(() => {
        hook.dispatch("a", {} as ActionDetails);
      });
      act(() => setMode(away));
      const failure = new Error("latest");
      await act(async () => run.reject(failure));
      expect(reportError).toHaveBeenCalledExactlyOnceWith(failure);
      act(() => setMode("shown"));
      await act(async () => {});
      expect(caught).not.toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("logs with console.error where there is no reportError", async () => {
    const consoleError = silenceErrors();
    const { runs, caught } = setupBurst();
    vi.stubGlobal("reportError", undefined);
    const older = new Error("older");
    await act(async () => runs[0]!.reject(older));
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(older);
    expect(caught).not.toHaveBeenCalled();
  });
});

// #150: a set-valued (reducer) state commits, uncontrolled, the dispatches that resolved, folded in
// dispatch order once all of them settled; a rejected dispatch leaves no trace.
describe("useControllableAction: uncontrolled reducer commits", () => {
  interface Toggle extends ActionDetails {
    readonly item: string;
    readonly on: boolean;
  }
  type SetHook = ControllableAction<readonly string[], Toggle>;
  const apply = (prev: readonly string[], details: Toggle): readonly string[] =>
    details.on
      ? [...prev.filter((v) => v !== details.item), details.item].sort()
      : prev.filter((v) => v !== details.item);

  function setupSet(controlled?: readonly string[]) {
    vi.stubGlobal("reportError", vi.fn());
    const runs = [deferred(), deferred(), deferred(), deferred()];
    let call = 0;
    let hook!: SetHook;
    function SetProbe({ onHook }: { onHook: (h: SetHook) => void }) {
      const h = useControllableAction<readonly string[], Toggle>({
        controlled,
        defaultValue: undefined,
        initialValue: [],
        action: () => runs[call++]!.promise,
        reducer: (prev, _next, details) => apply(prev, details),
      });
      onHook(h);
      return (
        <output data-testid="value">
          {h.committed.join(",")}|{h.optimistic.join(",")}
        </output>
      );
    }
    const view = render(<SetProbe onHook={(h) => (hook = h)} />);
    /** Dispatches a toggle on top of the shown (optimistic) set, as the components do. */
    const toggle = (item: string, on: boolean) => {
      const details = { event: undefined, item, on } as Toggle;
      hook.dispatch(apply(hook.optimistic, details), details);
    };
    return { runs, toggle, value: () => view.getByTestId("value").textContent, hook: () => hook };
  }

  it.each([
    ["the rejection first", [0, 1]],
    ["the resolution first", [1, 0]],
  ] as const)("drops a rejected item's change (%s)", async (_label, order) => {
    const { runs, toggle, value } = setupSet();
    act(() => toggle("a", true));
    act(() => toggle("b", true));
    expect(value()).toBe("|a,b");
    for (const i of order) {
      await act(async () => {
        if (i === 0) runs[0]!.reject(new Error("a failed"));
        else runs[1]!.resolve();
      });
    }
    expect(value()).toBe("b|b");
  });

  // Discriminating: dispatch order gives {c}; resolution order would give {a, c}; the old
  // latest-dispatch commit gave {b, c} (the latest `next` included the rejected b).
  it("applies the resolved changes in dispatch order, whatever order they resolve in", async () => {
    const { runs, toggle, value } = setupSet();
    act(() => toggle("a", true));
    act(() => toggle("a", false));
    act(() => toggle("b", true));
    act(() => toggle("c", true));
    expect(value()).toBe("|b,c");
    await act(async () => runs[1]!.resolve());
    await act(async () => runs[0]!.resolve());
    await act(async () => runs[2]!.reject(new Error("b failed")));
    // Still in flight: nothing is committed before every dispatch settled.
    expect(value()).toBe("|b,c");
    await act(async () => runs[3]!.resolve());
    expect(value()).toBe("c|c");
  });

  // #153: `{ whole: true }` bypasses the reducer, in the optimistic step and in the replay. A patch
  // replay of the whole dispatch below ("z" on) would keep the earlier resolved "a".
  it("a whole dispatch replaces the value in the optimistic step and in the replay", async () => {
    const { runs, toggle, value, hook } = setupSet();
    act(() => toggle("a", true));
    act(() =>
      hook().dispatch(["z"], { event: undefined, item: "z", on: true } as Toggle, { whole: true }),
    );
    expect(value()).toBe("|z");
    act(() => toggle("b", true));
    expect(value()).toBe("|b,z");
    await act(async () => runs[0]!.resolve());
    await act(async () => runs[1]!.resolve());
    await act(async () => runs[2]!.resolve());
    expect(value()).toBe("b,z|b,z");
  });

  it("a whole dispatch that rejects leaves no trace; the others still fold", async () => {
    const { runs, toggle, value, hook } = setupSet();
    act(() => toggle("a", true));
    act(() =>
      hook().dispatch(["z"], { event: undefined, item: "z", on: true } as Toggle, { whole: true }),
    );
    act(() => toggle("b", true));
    expect(value()).toBe("|b,z");
    // Superseded, so reported rather than thrown (conventions 2.4).
    await act(async () => runs[1]!.reject(new Error("z failed")));
    await act(async () => runs[0]!.resolve());
    await act(async () => runs[2]!.resolve());
    expect(value()).toBe("a,b|a,b");
  });

  it("controlled: never writes", async () => {
    const { runs, toggle, value } = setupSet(["x"]);
    act(() => toggle("a", true));
    await act(async () => runs[0]!.resolve());
    expect(value()).toBe("x|x");
  });
});
