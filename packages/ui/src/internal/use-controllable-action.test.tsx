// Unit rows for `useControllableAction` that no component suite isolates. The state model itself
// (optimistic, transitions, superseded rejections) is covered through every component's suite.
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
