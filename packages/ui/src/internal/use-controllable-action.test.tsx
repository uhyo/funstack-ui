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
