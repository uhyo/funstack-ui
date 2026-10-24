// The group adapter, exercised through a minimal radio group built from the three shared hooks the
// way design/components/radio-group.md 13.3 / 13.5 wires them: a fieldset Root owning the state
// (`useControllableAction` + `useNativeGroupReconciliation`) and Items calling
// `useNativeChecked({ group: true })`. Guards what the components cannot show: two groups in one
// form, members that mount (or hydrate) after the Root through `onItemMounted`, and the `equals`
// option. The user-visible platform rows (mount reconciliation, form reset, reset target, React's
// automatic reset) are the native platform suite's (src/__tests__/native-group-platform-suite.tsx,
// run by RadioGroup, CheckboxGroup and Select; audit T13).
import { act, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, createContext, startTransition, use, useRef, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  deferred,
  renderBoth,
  setupUser,
  flushMicrotasks,
  hydrateFromServer,
  silenceErrors,
  fulfilledPromise,
  Gate,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { createActionDetails } from "./action-details.js";
import type { ChangeReason } from "./types.js";
import { useControllableAction } from "./use-controllable-action.js";
import { useNativeChecked } from "./use-native-checked.js";
import { useNativeGroupReconciliation } from "./use-native-group-reconciliation.js";

interface Details {
  readonly event: Event | undefined;
  readonly reason: ChangeReason;
}
type ActionFn = (next: string | null, details: Details) => unknown;

interface GroupContextValue {
  readonly name: string;
  readonly optimistic: string | null;
  readonly defaultValue: string | null | undefined;
  readonly select: (value: string, event: Event) => void;
  readonly onItemMounted: () => void;
}
const GroupContext = createContext<GroupContextValue | null>(null);

function Group({
  name = "size",
  value,
  defaultValue,
  action,
  children,
}: {
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  action?: ActionFn;
  children: ReactNode;
}) {
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const { optimistic, dispatch, latestInFlight } = useControllableAction<string | null, Details>({
    controlled: value,
    defaultValue,
    initialValue: null,
    action,
  });
  const read = (prop: "checked" | "defaultChecked") => {
    const radios = fieldset.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    for (const radio of radios ?? []) if (radio.name === name && radio[prop]) return radio.value;
    return null;
  };
  const { onItemMounted } = useNativeGroupReconciliation<string | null>({
    element: fieldset,
    readCurrent: () => read("checked"),
    readDefault: () => read("defaultChecked"),
    base: () => {
      const inFlight = latestInFlight();
      return inFlight === null ? optimistic : inFlight.next;
    },
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" as const })),
  });
  const context: GroupContextValue = {
    name,
    optimistic,
    defaultValue: value === undefined ? (defaultValue ?? null) : undefined,
    select: (next, event) => {
      if (next !== optimistic) dispatch(next, createActionDetails(event, { reason: "activate" }));
    },
    onItemMounted,
  };
  return (
    <fieldset ref={fieldset} role="radiogroup" aria-label={name}>
      <GroupContext value={context}>{children}</GroupContext>
    </fieldset>
  );
}

function Item({ value }: { value: string }) {
  const ctx = use(GroupContext)!;
  const checked = ctx.optimistic === value;
  const ref = useNativeChecked({
    type: "radio",
    component: "Item",
    checked,
    group: true,
    defaultChecked: ctx.defaultValue === undefined ? undefined : ctx.defaultValue === value,
    onItemMounted: ctx.onItemMounted,
  });
  return (
    <input
      ref={ref}
      type="radio"
      name={ctx.name}
      value={value}
      aria-label={`${ctx.name} ${value}`}
      checked={checked}
      onChange={(e) => ctx.select(value, e.nativeEvent)}
    />
  );
}

/**
 * Uncontrolled, or controlled with "update on success" (the parent adopts the value after the
 * action's work, in a transition). `late`: "m" and "l" sit behind a Suspense boundary gated on it.
 */
function Harness({
  mode,
  initial,
  action,
  late,
}: {
  mode: ControlMode;
  initial: string | null;
  action: ActionFn;
  late?: Promise<void>;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const groupAction: ActionFn = async (next, details) => {
    await action(next, details);
    startTransition(() => setValue(next));
  };
  const lateItems = (
    <>
      <Item value="m" />
      <Item value="l" />
    </>
  );
  return (
    <form data-testid="form">
      <Group
        {...(mode === "controlled" ? { value } : { defaultValue: initial })}
        action={groupAction}
      >
        <Item value="s" />
        {late === undefined ? (
          lateItems
        ) : (
          <Suspense fallback={null}>
            <Gate promise={late}>{lateItems}</Gate>
          </Suspense>
        )}
      </Group>
      <output data-testid="value">{String(value)}</output>
    </form>
  );
}

const radio = (v: string, name = "size") =>
  screen.getByLabelText(`${name} ${v}`) as HTMLInputElement;

describe("useNativeGroupReconciliation", () => {
  it("two groups in one form: one reset dispatches once per group, each to its own default", async () => {
    const size = vi.fn<ActionFn>();
    const color = vi.fn<ActionFn>();
    render(
      <form data-testid="form">
        <Group name="size" defaultValue="s" action={size}>
          <Item value="s" />
          <Item value="m" />
        </Group>
        <Group name="color" defaultValue={null} action={color}>
          <Item value="red" />
          <Item value="blue" />
        </Group>
      </form>,
    );
    const user = setupUser();
    await user.click(radio("m"));
    await user.click(radio("blue", "color"));
    expect(radio("m").checked).toBe(true);
    expect(radio("blue", "color").checked).toBe(true);
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await flushMicrotasks();
    expect(size.mock.calls.map(([v, d]) => [v, d.reason])).toEqual([
      ["m", "activate"],
      ["s", "platform"],
    ]);
    expect(color.mock.calls.map(([v, d]) => [v, d.reason])).toEqual([
      ["blue", "activate"],
      [null, "platform"],
    ]);
    expect(radio("s").checked).toBe(true);
    expect(radio("blue", "color").checked).toBe(false);
  });

  renderBoth("members mounting after the Root", (mode) => {
    /**
     * Server-renders the group with every member, hydrates it with "m" and "l" behind a Suspense
     * boundary that stays dehydrated until the returned `release()`, and runs `beforeRelease`
     * while the Root is hydrated but those members are not.
     */
    async function hydrateLate(
      action: ActionFn,
      beforeRelease: (container: HTMLElement) => void,
      wrap: (ui: ReactNode) => ReactNode = (ui) => ui,
    ) {
      const gate = deferred();
      const { container } = await hydrateFromServer(
        wrap(<Harness mode={mode} initial="s" action={action} late={fulfilledPromise()} />),
        { client: wrap(<Harness mode={mode} initial="s" action={action} late={gate.promise} />) },
      );
      // The Root and "s" are hydrated; "m" and "l" are still server HTML.
      expect(action).not.toHaveBeenCalled();
      await act(async () => {
        beforeRelease(container);
      });
      return async () => {
        await act(async () => {
          gate.resolve();
        });
        await flushMicrotasks();
      };
    }
    const serverRadio = (c: HTMLElement, v: string) =>
      c.querySelector(`input[value="${v}"]`) as HTMLInputElement;

    it("a click on a member before it hydrates is reconciled with one platform dispatch", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      const release = await hydrateLate(action, (c) => {
        serverRadio(c, "m").click();
      });
      expect(serverRadio(document.body, "m").checked).toBe(true);
      expect(action).not.toHaveBeenCalled();

      await release();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("m");
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expect(action.mock.calls[0]?.[1].event).toBeUndefined();
      expect(radio("m").checked).toBe(true);
      expect(radio("s").checked).toBe(false);
      expect(screen.getByTestId("value")).toHaveTextContent("m");
      // In sync afterwards: a click on "l" is an ordinary activation.
      await setupUser().click(radio("l"));
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[1].reason).toBe("activate");
      expect(radio("l").checked).toBe(true);
      // No hydration mismatch. (RTL hydrates inside a sync `act`, which warns about the suspended
      // boundary; that warning is the harness's, not the library's.)
      const errors = consoleError.mock.calls.map(([m]) => String(m));
      expect(errors.filter((m) => /hydrat|match/i.test(m))).toEqual([]);
    });

    it("dispatches once under StrictMode", async () => {
      const action = vi.fn<ActionFn>();
      const release = await hydrateLate(
        action,
        (c) => {
          serverRadio(c, "l").click();
        },
        (ui) => <StrictMode>{ui}</StrictMode>,
      );
      await release();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("l");
      expect(radio("l").checked).toBe(true);
    });

    it("does not dispatch when the late members hydrate unchanged", async () => {
      const action = vi.fn<ActionFn>();
      const release = await hydrateLate(action, () => {});
      await release();
      expect(action).not.toHaveBeenCalled();
      expect(radio("s").checked).toBe(true);
    });
  });

  it("a member added on the client after mount does not dispatch", async () => {
    const action = vi.fn<ActionFn>();
    function Growing({ more }: { more: boolean }) {
      return (
        <Group defaultValue="s" action={action}>
          <Item value="s" />
          {more && <Item value="m" />}
        </Group>
      );
    }
    const { rerender } = render(<Growing more={false} />);
    rerender(<Growing more />);
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expect(radio("s").checked).toBe(true);
    expect(radio("m").checked).toBe(false);
  });
});

describe("equals option", () => {
  /** A group whose value is a set: every read builds a new Set with the same members as `base`. */
  function SetGroup({
    equals,
    onPlatformChange,
  }: {
    equals?: (a: ReadonlySet<string>, b: ReadonlySet<string>) => boolean;
    onPlatformChange: (next: ReadonlySet<string>, event: Event | undefined) => void;
  }) {
    const fieldset = useRef<HTMLFieldSetElement>(null);
    const base: ReadonlySet<string> = new Set(["a", "b"]);
    useNativeGroupReconciliation<ReadonlySet<string>>({
      element: fieldset,
      readCurrent: () => new Set(["b", "a"]),
      readDefault: () => new Set(["a", "b"]),
      base: () => base,
      equals,
      onPlatformChange,
    });
    return (
      <form data-testid="set-form">
        <fieldset ref={fieldset} />
      </form>
    );
  }
  const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
    a.size === b.size && [...a].every((v) => b.has(v));

  it("a structural equals: a new set with the same members reports nothing (mount and reset)", async () => {
    const onPlatformChange = vi.fn();
    render(<SetGroup equals={setsEqual} onPlatformChange={onPlatformChange} />);
    await act(async () => {
      (screen.getByTestId("set-form") as HTMLFormElement).reset();
    });
    await flushMicrotasks();
    expect(onPlatformChange).not.toHaveBeenCalled();
  });

  it("the default Object.is reports a new set even with the same members", async () => {
    const onPlatformChange = vi.fn();
    render(<SetGroup onPlatformChange={onPlatformChange} />);
    expect(onPlatformChange).toHaveBeenCalledTimes(1);
    expect([...onPlatformChange.mock.calls[0]![0]]).toEqual(["b", "a"]);
    expect(onPlatformChange.mock.calls[0]![1]).toBeUndefined();
    await act(async () => {
      (screen.getByTestId("set-form") as HTMLFormElement).reset();
    });
    await flushMicrotasks();
    expect(onPlatformChange).toHaveBeenCalledTimes(2);
    expect(onPlatformChange.mock.calls[1]![1]).toBeInstanceOf(Event);
  });
});
