// One row per checkable control for "check, form reset, check again" (#198), shared by
// form-reset-tracker.test.tsx (a script `form.reset()`) and form-reset-button.browser.test.tsx
// (a real reset button click). Each control starts with nothing checked (RadioGroup on "a");
// checking `target()` dispatches `checkedValue`, the reset dispatches `resetValue`.
import { screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Checkbox } from "../checkbox/index.js";
import { CheckboxGroup } from "../checkbox-group/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Switch } from "../switch/index.js";

export type CheckableResetMode = "uncontrolled" | "controlled";

export interface CheckableResetRow {
  readonly name: string;
  /**
   * Renders the control, calling `record(next, reason)` from its action. Controlled: a parent that
   * adopts every offer, the reset's included.
   */
  readonly render: (
    mode: CheckableResetMode,
    record: (next: unknown, reason: string) => void,
  ) => ReactNode;
  /** The input the user checks. */
  readonly target: () => HTMLInputElement;
  readonly checkedValue: unknown;
  readonly resetValue: unknown;
}

function Controlled<T>({
  initial,
  children,
}: {
  initial: T;
  children: (value: T, set: (next: T) => void) => ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return children(value, setValue);
}

const byRole = (role: string, name: string) => screen.getByRole(role, { name }) as HTMLInputElement;

const radioItems = (
  <>
    <RadioGroup.Item value="a" aria-label="a" />
    <RadioGroup.Item value="b" aria-label="b" />
  </>
);

const groupItems = (
  <>
    <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
    <CheckboxGroup.Item value="a" aria-label="a" />
    <CheckboxGroup.Item value="b" aria-label="b" />
  </>
);

function renderCheckboxGroup(
  mode: CheckableResetMode,
  record: (next: unknown, reason: string) => void,
): ReactNode {
  return mode === "uncontrolled" ? (
    <CheckboxGroup.Root aria-label="G" name="g" valueChangeAction={(n, d) => record(n, d.reason)}>
      {groupItems}
    </CheckboxGroup.Root>
  ) : (
    <Controlled<string[]> initial={[]}>
      {(value, set) => (
        <CheckboxGroup.Root
          aria-label="G"
          name="g"
          value={value}
          valueChangeAction={(n, d) => {
            record(n, d.reason);
            set(n);
          }}
        >
          {groupItems}
        </CheckboxGroup.Root>
      )}
    </Controlled>
  );
}

export const checkableResetRows: readonly CheckableResetRow[] = [
  {
    name: "Checkbox",
    render: (mode, record) =>
      mode === "uncontrolled" ? (
        <Checkbox name="c" aria-label="c" checkedChangeAction={(n, d) => record(n, d.reason)} />
      ) : (
        <Controlled initial={false}>
          {(checked, set) => (
            <Checkbox
              name="c"
              aria-label="c"
              checked={checked}
              checkedChangeAction={(n, d) => {
                record(n, d.reason);
                set(n);
              }}
            />
          )}
        </Controlled>
      ),
    target: () => byRole("checkbox", "c"),
    checkedValue: true,
    resetValue: false,
  },
  {
    name: "Switch",
    render: (mode, record) =>
      mode === "uncontrolled" ? (
        <Switch name="s" aria-label="s" checkedChangeAction={(n, d) => record(n, d.reason)} />
      ) : (
        <Controlled initial={false}>
          {(checked, set) => (
            <Switch
              name="s"
              aria-label="s"
              checked={checked}
              checkedChangeAction={(n, d) => {
                record(n, d.reason);
                set(n);
              }}
            />
          )}
        </Controlled>
      ),
    target: () => byRole("switch", "s"),
    checkedValue: true,
    resetValue: false,
  },
  {
    name: "RadioGroup.Item",
    render: (mode, record) =>
      mode === "uncontrolled" ? (
        <RadioGroup.Root
          aria-label="R"
          name="r"
          defaultValue="a"
          valueChangeAction={(n, d) => record(n, d.reason)}
        >
          {radioItems}
        </RadioGroup.Root>
      ) : (
        <Controlled<string | null> initial="a">
          {(value, set) => (
            <RadioGroup.Root
              aria-label="R"
              name="r"
              value={value}
              valueChangeAction={(n, d) => {
                record(n, d.reason);
                set(n);
              }}
            >
              {radioItems}
            </RadioGroup.Root>
          )}
        </Controlled>
      ),
    target: () => byRole("radio", "b"),
    checkedValue: "b",
    resetValue: "a",
  },
  {
    name: "CheckboxGroup.Item",
    render: renderCheckboxGroup,
    target: () => byRole("checkbox", "b"),
    checkedValue: ["b"],
    resetValue: [],
  },
  {
    name: "CheckboxGroup.Parent",
    render: renderCheckboxGroup,
    target: () => byRole("checkbox", "all"),
    checkedValue: ["a", "b"],
    resetValue: [],
  },
];
