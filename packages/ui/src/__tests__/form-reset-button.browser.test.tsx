// A real `<button type="reset">` click on every form control (#185). Unlike a script
// `form.reset()`, a click dispatches the `reset` event from a task, so a microtask checkpoint
// runs after each listener, *before* the reset algorithm: `useFormReset`'s microtask callback
// (and the synchronous React commit it may cause) runs while the inputs still hold the user's
// values. jsdom cannot show this (its reset is synchronous from any caller). The click is made
// outside React's act environment, as in a page: inside `act`, React would hold the commit until
// the click is over and hide the ordering. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { leaveActEnvironment, onCleanup, quietPeriod, settle } from "./browser-helpers.js";
import { user } from "./browser-user.js";
import { checkableResetRows } from "./checkable-reset-rows.js";
import { afterDispatch } from "../internal/after-dispatch.js";
import { Checkbox } from "../checkbox/index.js";
import { CheckboxGroup } from "../checkbox-group/index.js";
import { Combobox } from "../combobox/index.js";
import { Field } from "../field/index.js";
import { MultiSelect } from "../multi-select/index.js";
import { NumberField } from "../number-field/index.js";
import { Select } from "../select/index.js";
import { Slider } from "../slider/index.js";
import { Switch } from "../switch/index.js";

const form = () => screen.getByTestId("form") as HTMLFormElement;
const named = (name: string) => form().elements.namedItem(name) as HTMLInputElement;

/** Clicks the form's reset button the way a user does, outside `act`. */
async function clickReset(): Promise<void> {
  const restore = leaveActEnvironment();
  try {
    await userEvent.click(screen.getByTestId("reset"));
  } finally {
    restore();
  }
}

function Form({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form data-testid="form" onSubmit={(e) => e.preventDefault()} onReset={onReset}>
      {children}
      <button type="reset" data-testid="reset">
        Reset
      </button>
    </form>
  );
}

const COUNTRIES = [
  ["jp", "Japan"],
  ["fr", "France"],
] as const;

function Countries() {
  return (
    <Combobox.Popup style={{ margin: 0, inset: "auto" }}>
      <Combobox.List>
        {({ query }) =>
          COUNTRIES.filter(([, n]) => n.toLowerCase().includes(query.toLowerCase())).map(
            ([v, n]) => (
              <Combobox.Option key={v} value={v} data-testid={`opt-${v}`}>
                {n}
              </Combobox.Option>
            ),
          )
        }
      </Combobox.List>
    </Combobox.Popup>
  );
}

/** A Combobox listbox is in the top layer. */
const listboxShown = () =>
  [...document.querySelectorAll("[popover]")].some((p) => p.matches(":popover-open"));

describe("a real reset button", () => {
  describe("Combobox", () => {
    const text = () => screen.getByTestId("input") as HTMLInputElement;

    it("restores defaultInputValue over typed text (the #185 probe)", async () => {
      const onInputValueChange = vi.fn();
      render(
        <Form>
          <Combobox.Root
            name="country"
            defaultInputValue="Jap"
            allowCustomValue
            onInputValueChange={onInputValueChange}
          >
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
        </Form>,
      );
      await user.click(text());
      await user.keyboard("{Control>}a{/Control}xyz");
      expect(text().value).toBe("xyz");
      onInputValueChange.mockClear();
      await clickReset();
      await settle(() => expect(text().value).toBe("Jap"));
      await settle(() => expect(text().defaultValue).toBe("Jap"));
      await settle(() =>
        expect(onInputValueChange.mock.calls.map(([v, d]) => [v, d.reason, d.event?.type])).toEqual(
          [["Jap", "platform", "reset"]],
        ),
      );
    });

    it("restores the default selection and its text after a pick", async () => {
      const valueChangeAction = vi.fn();
      render(
        <Form>
          <Combobox.Root
            name="country"
            defaultValue="jp"
            defaultInputValue="Japan"
            valueChangeAction={valueChangeAction}
          >
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
        </Form>,
      );
      await user.click(text());
      await user.keyboard("{Control>}a{/Control}fra");
      await user.click(screen.getByTestId("opt-fr"));
      await settle(() => expect(named("country").value).toBe("fr"));
      expect(text().value).toBe("France");
      await clickReset();
      await settle(() => expect(named("country").value).toBe("jp"));
      await settle(() => expect(text().value).toBe("Japan"));
      await settle(() => expect(valueChangeAction.mock.calls.at(-1)?.[1].reason).toBe("platform"));
    });

    it("controlled text: offered to the parent, which adopts it", async () => {
      function Controlled() {
        const [t, setT] = useState("Jap");
        return (
          <Combobox.Root
            name="country"
            inputValue={t}
            onInputValueChange={(next) => setT(next)}
            allowCustomValue
          >
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
        );
      }
      render(
        <Form>
          <Controlled />
        </Form>,
      );
      await user.click(text());
      await user.keyboard("{Control>}a{/Control}xyz");
      await clickReset();
      await settle(() => expect(text().value).toBe("Jap"));
    });

    it("controlled text: a parent that keeps its text keeps it in the DOM", async () => {
      function Keeper() {
        const [t, setT] = useState("Jap");
        return (
          <Combobox.Root
            name="country"
            inputValue={t}
            onInputValueChange={(next, d) => {
              if (d.reason !== "platform") setT(next);
            }}
            allowCustomValue
          >
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
        );
      }
      render(
        <Form>
          <Keeper />
        </Form>,
      );
      await user.click(text());
      await user.keyboard("{Control>}a{/Control}xyz");
      await clickReset();
      await act(() => quietPeriod(50, "the reset must not replace the parent's text"));
      expect(text().value).toBe("xyz");
    });

    it("multiple: restores the default values and empties the text", async () => {
      render(
        <Form>
          <Combobox.Root name="country" multiple defaultValue={["jp"]}>
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
        </Form>,
      );
      await user.click(text());
      await user.keyboard("fra");
      await user.click(screen.getByTestId("opt-fr"));
      await user.keyboard("zz");
      await settle(() =>
        expect(new FormData(form()).getAll("country").sort()).toEqual(["fr", "jp"]),
      );
      await clickReset();
      await settle(() => expect(new FormData(form()).getAll("country")).toEqual(["jp"]));
      await settle(() => expect(text().value).toBe(""));
    });
  });

  it("NumberField: restores the formatted default in the visible input and the hidden one", async () => {
    const valueChangeAction = vi.fn();
    render(
      <Form>
        <NumberField.Root
          name="qty"
          locale="en-US"
          defaultValue={1500}
          valueChangeAction={valueChangeAction}
        >
          <NumberField.Input data-testid="input" aria-label="Quantity" />
        </NumberField.Root>
      </Form>,
    );
    const visible = screen.getByTestId("input") as HTMLInputElement;
    await user.click(visible);
    await user.keyboard("{Control>}a{/Control}9");
    expect(visible.value).toBe("9");
    await clickReset();
    await settle(() => expect(named("qty").value).toBe("1500"));
    await settle(() => expect(visible.value).toBe("1,500"));
    // Typed again: the draft is the user's, no stale text from the reset.
    await user.click(visible);
    await user.keyboard("{Control>}a{/Control}7{Tab}");
    await settle(() => expect(named("qty").value).toBe("7"));
    expect(visible.value).toBe("7");
  });

  it("NumberField: after a committed value", async () => {
    render(
      <Form>
        <NumberField.Root name="qty" locale="en-US" defaultValue={5}>
          <NumberField.Input data-testid="input" aria-label="Quantity" />
        </NumberField.Root>
      </Form>,
    );
    const visible = screen.getByTestId("input") as HTMLInputElement;
    await user.click(visible);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    await settle(() => expect(named("qty").value).toBe("7"));
    await clickReset();
    await settle(() => expect(named("qty").value).toBe("5"));
    await settle(() => expect(visible.value).toBe("5"));
  });

  it("Slider: restores the default", async () => {
    render(
      <Form>
        <Slider.Root name="volume" defaultValue={40}>
          <Slider.Thumb aria-label="Volume" data-testid="thumb" />
        </Slider.Root>
      </Form>,
    );
    const thumb = screen.getByTestId("thumb").querySelector("input") ?? screen.getByRole("slider");
    await act(async () => (thumb as HTMLElement).focus());
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await settle(() => expect(new FormData(form()).get("volume")).toBe("42"));
    await clickReset();
    await settle(() => expect(new FormData(form()).get("volume")).toBe("40"));
    await settle(() => expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("40"));
  });

  it("Select: restores the default option and its content", async () => {
    render(
      <Form>
        <Select.Root aria-label="Fruit" name="fruit" defaultValue="a">
          <Select.Trigger>
            <Select.Value data-testid="content" />
          </Select.Trigger>
          <Select.Option value="a">Apple</Select.Option>
          <Select.Option value="c">Cherry</Select.Option>
        </Select.Root>
      </Form>,
    );
    const sel = form().querySelector("select")!;
    await act(async () => {
      sel.value = "c";
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle(() => expect(sel.value).toBe("c"));
    await clickReset();
    await settle(() => expect(sel.value).toBe("a"));
    if ("HTMLSelectedContentElement" in globalThis) {
      await settle(() => expect(screen.getByTestId("content").textContent).toBe("Apple"));
    }
  });

  it("Checkbox and Switch: restore their defaults", async () => {
    render(
      <Form>
        <Checkbox name="c" aria-label="c" data-testid="c" />
        <Switch name="s" aria-label="s" defaultChecked data-testid="s" />
      </Form>,
    );
    await user.click(screen.getByTestId("c"));
    await user.click(screen.getByTestId("s"));
    await settle(() => expect([...new FormData(form())]).toEqual([["c", "on"]]));
    await clickReset();
    await settle(() => expect([...new FormData(form())]).toEqual([["s", "on"]]));
    await settle(() => expect(screen.getByTestId("c")).not.toBeChecked());
    await settle(() => expect(screen.getByTestId("s")).toBeChecked());
  });

  it("Checkbox, controlled: a parent that refuses the reset keeps it checked", async () => {
    const offered = vi.fn();
    function Refuser() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          name="c"
          aria-label="c"
          data-testid="c"
          checked={checked}
          checkedChangeAction={(next, d) => {
            offered(next, d.reason, d.event?.type);
            if (d.reason !== "platform") setChecked(next);
          }}
        />
      );
    }
    render(
      <Form>
        <Refuser />
      </Form>,
    );
    await user.click(screen.getByTestId("c"));
    await settle(() => expect(screen.getByTestId("c")).toBeChecked());
    offered.mockClear();
    await clickReset();
    await settle(() => expect(offered.mock.calls).toEqual([[false, "platform", "reset"]]));
    await act(() => quietPeriod(50, "the refused reset must not stick"));
    expect(screen.getByTestId("c")).toBeChecked();
    expect([...new FormData(form())]).toEqual([["c", "on"]]);
  });

  // #198: react-dom's tracker on `checked` must not keep the pre-reset state, or the check after
  // the reset is dropped as "no change". Same rows as form-reset-tracker.test.tsx.
  describe("check, reset, check again: every step dispatches", () => {
    for (const row of checkableResetRows) {
      for (const mode of ["uncontrolled", "controlled"] as const) {
        it(`${row.name}, ${mode}`, async () => {
          const calls: Array<[unknown, string]> = [];
          render(<Form>{row.render(mode, (n, r) => calls.push([n, r]))}</Form>);
          await user.click(row.target());
          await settle(() => expect(calls).toEqual([[row.checkedValue, "activate"]]));
          expect(row.target().checked).toBe(true);
          await clickReset();
          await settle(() =>
            expect(calls).toEqual([
              [row.checkedValue, "activate"],
              [row.resetValue, "platform"],
            ]),
          );
          await settle(() => expect(row.target().checked).toBe(false));
          await user.click(row.target());
          await settle(() =>
            expect(calls).toEqual([
              [row.checkedValue, "activate"],
              [row.resetValue, "platform"],
              [row.checkedValue, "activate"],
            ]),
          );
          expect(row.target().checked).toBe(true);
        });
      }
    }
  });

  // The helper behind `useFormReset` (internal/after-dispatch.ts): after a real click the
  // microtask runs mid-dispatch, so the callback waits for a task, which runs after the reset
  // algorithm; a cancel from a later listener (between the microtask and the task) stops it.
  describe("afterDispatch on a real reset click", () => {
    function Plain() {
      return (
        <Form>
          <input name="t" defaultValue="default" data-testid="t" aria-label="t" />
        </Form>
      );
    }

    it("runs after every listener and the reset algorithm", async () => {
      render(<Plain />);
      await user.click(screen.getByTestId("t"));
      await user.keyboard("{Control>}a{/Control}typed");
      const seen: string[] = [];
      const onForm = (event: Event) => {
        seen.push("form listener");
        queueMicrotask(() => {
          seen.push(`microtask phase ${event.eventPhase !== Event.NONE ? "dispatching" : "done"}`);
        });
        afterDispatch(event, () => seen.push(`callback ${named("t").value}`));
      };
      const onDocument = () => seen.push("document listener");
      form().addEventListener("reset", onForm);
      document.addEventListener("reset", onDocument);
      onCleanup(() => document.removeEventListener("reset", onDocument));
      await clickReset();
      await settle(() => expect(seen).toContain("callback default"));
      expect(seen).toEqual([
        "form listener",
        "microtask phase dispatching",
        "document listener",
        "callback default",
      ]);
    });

    it("a cancel between the microtask and the task: never runs", async () => {
      render(<Plain />);
      const callback = vi.fn();
      let cancel = () => {};
      let microtaskRan = false;
      const onForm = (event: Event) => {
        cancel = afterDispatch(event, callback);
        queueMicrotask(() => (microtaskRan = true));
      };
      // Runs after the form's microtask checkpoint, before the task.
      const onDocument = () => {
        expect(microtaskRan).toBe(true);
        cancel();
      };
      form().addEventListener("reset", onForm);
      document.addEventListener("reset", onDocument);
      onCleanup(() => document.removeEventListener("reset", onDocument));
      await clickReset();
      await act(() => quietPeriod(50, "the cancelled callback must not run"));
      expect(microtaskRan).toBe(true);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("CheckboxGroup with a Parent", () => {
    const parent = () => screen.getByRole("checkbox", { name: "all" }) as HTMLInputElement;

    it("restores the Items and the Parent after a change", async () => {
      render(
        <Form>
          <CheckboxGroup.Root aria-label="T" name="t" defaultValue={["a", "b"]}>
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        </Form>,
      );
      await user.click(screen.getByRole("checkbox", { name: "a" }));
      await settle(() => expect(parent().indeterminate).toBe(true));
      await clickReset();
      await settle(() => expect(new FormData(form()).getAll("t")).toEqual(["a", "b"]));
      await settle(() => expect(parent().checked).toBe(true));
      await settle(() => expect(parent().indeterminate).toBe(false));
    });

    it("keeps the Parent checked when nothing changed", async () => {
      render(
        <Form>
          <CheckboxGroup.Root aria-label="T" name="t" defaultValue={["a", "b"]}>
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        </Form>,
      );
      expect(parent().checked).toBe(true);
      await clickReset();
      await act(() => quietPeriod(50, "the Parent must not uncheck"));
      expect(parent().checked).toBe(true);
    });

    it("controlled, a parent that refuses the reset keeps the Items and the Parent", async () => {
      const offered = vi.fn();
      function Refuser() {
        const [value, setValue] = useState<string[]>(["a"]);
        return (
          <CheckboxGroup.Root
            aria-label="T"
            name="t"
            value={value}
            valueChangeAction={(next, d) => {
              offered(next, d.reason, d.event?.type);
              if (d.reason !== "platform") setValue(next);
            }}
          >
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        );
      }
      render(
        <Form>
          <Refuser />
        </Form>,
      );
      await user.click(screen.getByRole("checkbox", { name: "b" }));
      await settle(() => expect(parent().checked).toBe(true));
      offered.mockClear();
      await clickReset();
      await settle(() => expect(offered.mock.calls).toEqual([[["a"], "platform", "reset"]]));
      await act(() => quietPeriod(50, "the refused reset must not stick"));
      expect(new FormData(form()).getAll("t")).toEqual(["a", "b"]);
      expect(parent().checked).toBe(true);
      expect(parent().indeterminate).toBe(false);
    });
  });

  it("MultiSelect: restores the default values", async () => {
    render(
      <Form>
        <MultiSelect.Root name="toppings" defaultValue={["ham"]}>
          <MultiSelect.Trigger data-testid="trigger">
            <MultiSelect.Value data-testid="value" placeholder="Choose" />
          </MultiSelect.Trigger>
          <MultiSelect.Popup style={{ margin: 0, inset: "auto" }}>
            <MultiSelect.List>
              <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
              <MultiSelect.Option value="corn" data-testid="corn">
                Corn
              </MultiSelect.Option>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
      </Form>,
    );
    await user.click(screen.getByTestId("trigger"));
    await user.click(screen.getByTestId("corn"));
    await user.keyboard("{Escape}");
    await settle(() => expect(new FormData(form()).getAll("toppings")).toEqual(["ham", "corn"]));
    await clickReset();
    await settle(() => expect(new FormData(form()).getAll("toppings")).toEqual(["ham"]));
    expect(screen.getByTestId("value").textContent).toBe("Ham");
  });

  // Rule 7 (design/internal-hooks.md 3.8): a reset cancelled by a listener that runs after the
  // library's own (React's delegated `onReset`, a `document` listener) is not performed by the
  // browser, so no control may dispatch a reset for it and the DOM keeps the user's state.
  describe("a reset prevented after the library's listener", () => {
    type Log = (what: string, reason: string) => void;

    function Controls({ log }: { log: Log }) {
      return (
        <>
          <Combobox.Root
            name="country"
            defaultInputValue="Jap"
            allowCustomValue
            onInputValueChange={(_, d) => log("combobox text", d.reason)}
            valueChangeAction={(_, d) => log("combobox", d.reason)}
          >
            <Combobox.Input data-testid="input" aria-label="Country" />
            <Countries />
          </Combobox.Root>
          <Checkbox
            name="c"
            aria-label="c"
            data-testid="c"
            checkedChangeAction={(_, d) => log("checkbox", d.reason)}
          />
          <Switch
            name="s"
            aria-label="s"
            defaultChecked
            data-testid="s"
            checkedChangeAction={(_, d) => log("switch", d.reason)}
          />
          <NumberField.Root
            name="qty"
            locale="en-US"
            defaultValue={5}
            valueChangeAction={(_, d) => log("number", d.reason)}
          >
            <NumberField.Input data-testid="number" aria-label="Quantity" />
          </NumberField.Root>
          <Slider.Root
            name="volume"
            defaultValue={40}
            valueChangeAction={(_, d) => log("slider", d.reason)}
          >
            <Slider.Thumb aria-label="Volume" />
          </Slider.Root>
          <Select.Root
            aria-label="Fruit"
            name="fruit"
            defaultValue="a"
            valueChangeAction={(_, d) => log("select", d.reason)}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Option value="a">Apple</Select.Option>
            <Select.Option value="c">Cherry</Select.Option>
          </Select.Root>
          <CheckboxGroup.Root
            aria-label="T"
            name="t"
            defaultValue={["a"]}
            valueChangeAction={(_, d) => log("group", d.reason)}
          >
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
          <MultiSelect.Root
            name="toppings"
            defaultValue={["ham"]}
            valueChangeAction={(_, d) => log("multi", d.reason)}
          >
            <MultiSelect.Trigger data-testid="trigger">
              <MultiSelect.Value placeholder="Choose" />
            </MultiSelect.Trigger>
            <MultiSelect.Popup style={{ margin: 0, inset: "auto" }}>
              <MultiSelect.List>
                <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
                <MultiSelect.Option value="corn" data-testid="corn">
                  Corn
                </MultiSelect.Option>
              </MultiSelect.List>
            </MultiSelect.Popup>
          </MultiSelect.Root>
        </>
      );
    }

    /** The user's state after `edit()`. */
    const EDITED: readonly (readonly [string, string | readonly string[]])[] = [
      ["country", "xyz"],
      ["c", "on"],
      ["qty", "9"],
      ["volume", "41"],
      ["fruit", "c"],
      ["t", ["a", "b"]],
      ["toppings", ["ham", "corn"]],
    ];

    function expectEdited(): void {
      const data = new FormData(form());
      for (const [name, value] of EDITED) {
        if (typeof value === "string") expect(data.get(name), name).toBe(value);
        else expect(data.getAll(name), name).toEqual(value);
      }
      expect(data.get("s")).toBeNull();
      expect((screen.getByTestId("input") as HTMLInputElement).value).toBe("xyz");
      expect((screen.getByTestId("number") as HTMLInputElement).value).toBe("9");
      expect(screen.getByTestId("c")).toBeChecked();
      expect(screen.getByTestId("s")).not.toBeChecked();
    }

    async function edit(): Promise<void> {
      await user.click(screen.getByTestId("input"));
      await user.keyboard("{Control>}a{/Control}xyz");
      // Escape closes the shown listbox and keeps the text; with the listbox not shown yet it
      // would revert the edited text (conventions 15).
      await settle(() => expect(listboxShown()).toBe(true));
      await user.keyboard("{Escape}");
      await user.click(screen.getByTestId("c"));
      await user.click(screen.getByTestId("s"));
      await user.click(screen.getByTestId("number"));
      await user.keyboard("{Control>}a{/Control}9{Tab}");
      await user.keyboard("{ArrowRight}");
      const sel = form().querySelector("select")!;
      await act(async () => {
        sel.value = "c";
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await user.click(screen.getByRole("checkbox", { name: "b" }));
      await user.click(screen.getByTestId("trigger"));
      await user.click(screen.getByTestId("corn"));
      await user.keyboard("{Escape}");
      await settle(expectEdited);
    }

    async function expectUntouched(log: ReturnType<typeof vi.fn<Log>>): Promise<void> {
      await act(() => quietPeriod(100, "a cancelled reset must neither dispatch nor reset"));
      expect(log.mock.calls).toEqual([]);
      expectEdited();
    }

    // The script order: the microtask runs after the dispatch, so it sees the late cancel.
    it("control: a script form.reset() cancelled in React's onReset", async () => {
      const log = vi.fn<Log>();
      render(
        <Form onReset={(e) => e.preventDefault()}>
          <Controls log={log} />
        </Form>,
      );
      await edit();
      log.mockClear();
      await act(async () => form().reset());
      await expectUntouched(log);
    });

    it("in React's onReset on the form", async () => {
      const log = vi.fn<Log>();
      const prevented = vi.fn();
      render(
        <Form
          onReset={(e) => {
            prevented();
            e.preventDefault();
          }}
        >
          <Controls log={log} />
        </Form>,
      );
      await edit();
      log.mockClear();
      await clickReset();
      expect(prevented).toHaveBeenCalledTimes(1);
      await expectUntouched(log);
    });

    it("in a document listener", async () => {
      const log = vi.fn<Log>();
      const prevent = (e: Event) => e.preventDefault();
      document.addEventListener("reset", prevent);
      onCleanup(() => document.removeEventListener("reset", prevent));
      render(
        <Form>
          <Controls log={log} />
        </Form>,
      );
      await edit();
      log.mockClear();
      await clickReset();
      await expectUntouched(log);
    });
  });

  // Field.Root refreshes its error, `aria-invalid` and the custom-validity slot from its own
  // `reset` listener in a microtask: after a button click that reads the user's values, before
  // the reset algorithm clears them (memo/reviewer/review-185.md finding 1).
  describe("inside a Field, a shown error", () => {
    const control = () => screen.getByTestId("control") as HTMLInputElement;
    const error = () => screen.queryByTestId("error");

    function Fields({ children }: { children?: ReactNode }) {
      return (
        <Form>
          <Field.Root name="handle" validate={(value) => (value === "bad" ? "No bad." : null)}>
            <Field.Label>Handle</Field.Label>
            <Field.Control data-testid="control" defaultValue="ok" />
            <Field.Error data-testid="error" />
          </Field.Root>
          {children}
          <button type="submit" data-testid="submit">
            Submit
          </button>
        </Form>
      );
    }

    async function showError(): Promise<void> {
      await user.click(control());
      await user.keyboard("{Control>}a{/Control}bad");
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(error()).toHaveTextContent("No bad."));
      expect(control()).toHaveAttribute("aria-invalid", "true");
    }

    async function expectCleared(): Promise<void> {
      await settle(() => expect(control().value).toBe("ok"));
      await settle(() => expect(error()).toBeNull());
      expect(control()).toHaveAttribute("aria-invalid", "false");
      expect(control().validationMessage).toBe("");
      const submitted = vi.fn((e: Event) => e.preventDefault());
      form().addEventListener("submit", submitted);
      await user.click(screen.getByTestId("submit"));
      expect(submitted).toHaveBeenCalledTimes(1);
    }

    it("control: a script form.reset() clears it and the custom validity", async () => {
      render(<Fields />);
      await showError();
      await act(async () => form().reset());
      await expectCleared();
    });

    it("a real reset clears it and the custom validity", async () => {
      render(<Fields />);
      await showError();
      await clickReset();
      await expectCleared();
    });

    it("a Combobox: a real reset restores its text and clears the Field's error", async () => {
      render(
        <Form>
          {/* Before the Field: the open listbox below the input would cover a later button. */}
          <button type="submit" data-testid="submit">
            Submit
          </button>
          {/* Cross-field: a keystroke that flips the Combobox's own validity is lost in
              Chromium (a separate bug, memo/developer/issue-185-184.md), so another input
              makes it invalid. */}
          <input name="other" aria-label="Other" data-testid="other" />
          <Field.Root validate={(_, data) => (data.get("other") === "bad" ? "No bad." : null)}>
            <Field.Label>Country</Field.Label>
            <Combobox.Root name="country" defaultInputValue="Jap" allowCustomValue>
              <Combobox.Input data-testid="control" />
              <Countries />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await user.click(control());
      await user.keyboard("{Control>}a{/Control}xyz");
      await settle(() => expect(listboxShown()).toBe(true));
      await user.keyboard("{Escape}");
      await settle(() => expect(control().value).toBe("xyz"));
      await user.click(screen.getByTestId("other"));
      await user.keyboard("bad");
      // A blocked submission shows the error without depending on :user-invalid.
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(error()).not.toBeNull());
      expect(control()).toHaveAttribute("aria-invalid", "true");
      await clickReset();
      await settle(() => expect(control().value).toBe("Jap"));
      await settle(() => expect(error()).toBeNull());
      expect(control()).toHaveAttribute("aria-invalid", "false");
    });
  });
});
