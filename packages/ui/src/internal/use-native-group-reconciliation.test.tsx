// The group adapter, exercised through a minimal radio group built from the three shared hooks the
// way design/components/radio-group.md 13.3 / 13.5 wires them: a fieldset Root owning the state
// (`useControllableAction` + `useNativeGroupReconciliation`) and Items calling
// `useNativeChecked({ group: true })`. Guards the contract RadioGroup relies on: one dispatch per
// group for both residual paths.
import { act, render, screen } from "@testing-library/react";
import { StrictMode, createContext, use, useRef, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderBoth, setupUser } from "../__tests__/helpers.js";
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
  readonly optimistic: string | null;
  readonly defaultValue: string | null | undefined;
  readonly select: (value: string, event: Event) => void;
}
const GroupContext = createContext<GroupContextValue | null>(null);

function Group({
  value,
  defaultValue,
  action,
  children,
}: {
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
    for (const radio of radios ?? []) if (radio[prop]) return radio.value;
    return null;
  };
  useNativeGroupReconciliation<string | null>({
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
    optimistic,
    defaultValue: value === undefined ? (defaultValue ?? null) : undefined,
    select: (next, event) => {
      if (next !== optimistic) dispatch(next, createActionDetails(event, { reason: "activate" }));
    },
  };
  return (
    <fieldset ref={fieldset} role="radiogroup" aria-label="Size">
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
  });
  return (
    <input
      ref={ref}
      type="radio"
      name="size"
      value={value}
      aria-label={value}
      checked={checked}
      onChange={(e) => ctx.select(value, e.nativeEvent)}
    />
  );
}

/** Uncontrolled, or controlled with "update on success". */
function Harness({
  mode,
  initial,
  action,
}: {
  mode: ControlMode;
  initial: string | null;
  action: ActionFn;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const groupAction: ActionFn = async (next, details) => {
    await action(next, details);
    setValue(next);
  };
  return (
    <form data-testid="form">
      <Group
        {...(mode === "controlled" ? { value } : { defaultValue: initial })}
        action={groupAction}
      >
        <Item value="s" />
        <Item value="m" />
        <Item value="l" />
      </Group>
      <output data-testid="value">{String(value)}</output>
    </form>
  );
}

const radio = (v: string) => screen.getByLabelText(v) as HTMLInputElement;
const flush = () => act(async () => {});

async function hydrate(ui: ReactNode, mutate: (container: HTMLElement) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(ui);
  mutate(container);
  render(ui, { container, hydrate: true });
  await flush();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useNativeGroupReconciliation", () => {
  renderBoth("mount reconciliation", (mode) => {
    it("dispatches once for the group with the hydrated value and no event", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<ActionFn>();
      await hydrate(<Harness mode={mode} initial="s" action={action} />, (c) => {
        (c.querySelector('input[value="l"]') as HTMLInputElement).checked = true;
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("l");
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expect(action.mock.calls[0]?.[1].event).toBeUndefined();
      expect(radio("l").checked).toBe(true);
      expect(radio("s").checked).toBe(false);
      expect(screen.getByTestId("value")).toHaveTextContent("l");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("dispatches once under StrictMode", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <StrictMode>
          <Harness mode={mode} initial="s" action={action} />
        </StrictMode>,
        (c) => {
          (c.querySelector('input[value="m"]') as HTMLInputElement).checked = true;
        },
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("m");
      expect(radio("m").checked).toBe(true);
    });

    it("does not dispatch when the DOM matches, nor for createRoot", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(<Harness mode={mode} initial="s" action={action} />, () => {});
      render(<Harness mode={mode} initial="m" action={action} />);
      await flush();
      expect(action).not.toHaveBeenCalled();
    });
  });

  renderBoth("form reset", (mode) => {
    it("dispatches once for the group with the default value and the reset event", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial="s" action={action} />);
      const user = setupUser();
      await user.click(radio("l"));
      expect(action).toHaveBeenCalledTimes(1);
      (screen.getByTestId("form") as HTMLFormElement).reset();
      await flush();
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("s");
      expect(action.mock.calls[1]?.[1].reason).toBe("platform");
      expect(action.mock.calls[1]?.[1].event?.type).toBe("reset");
      expect(radio("s").checked).toBe(true);
      expect(radio("l").checked).toBe(false);
    });

    it("dispatches null when the group resets to no selection", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial={null} action={action} />);
      const user = setupUser();
      await user.click(radio("m"));
      (screen.getByTestId("form") as HTMLFormElement).reset();
      await flush();
      expect(action.mock.calls.map(([v]) => v)).toEqual(["m", null]);
      expect(radio("m").checked).toBe(false);
    });

    it("does nothing for a cancelled reset or a reset to the intended value", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial="s" action={action} />);
      const form = screen.getByTestId("form") as HTMLFormElement;
      form.reset();
      await flush();
      expect(action).not.toHaveBeenCalled();

      const user = setupUser();
      await user.click(radio("m"));
      form.addEventListener("reset", (e) => e.preventDefault());
      form.reset();
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(radio("m").checked).toBe(true);
    });
  });
});
