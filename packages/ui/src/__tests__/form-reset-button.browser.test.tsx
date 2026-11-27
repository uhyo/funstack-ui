// A real `<button type="reset">` click on every form control (#185). Unlike a script
// `form.reset()`, a click dispatches the `reset` event from a task, so a microtask checkpoint
// runs after each listener, *before* the reset algorithm: `useFormReset`'s microtask callback
// (and the synchronous React commit it may cause) runs while the inputs still hold the user's
// values. jsdom cannot show this (its reset is synchronous from any caller). The click is made
// outside React's act environment, as in a page: inside `act`, React would hold the commit until
// the click is over and hide the ordering. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { leaveActEnvironment, settle } from "./browser-helpers.js";
import { user } from "./browser-user.js";
import { Checkbox } from "../checkbox/index.js";
import { CheckboxGroup } from "../checkbox-group/index.js";
import { Combobox } from "../combobox/index.js";
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

function Form({ children }: { children: ReactNode }) {
  return (
    <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
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
      expect(text().defaultValue).toBe("Jap");
      expect(onInputValueChange.mock.calls.map(([v, d]) => [v, d.reason, d.event?.type])).toEqual([
        ["Jap", "platform", "reset"],
      ]);
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
      expect(text().value).toBe("Japan");
      expect(valueChangeAction.mock.calls.at(-1)?.[1].reason).toBe("platform");
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
      // Give the reset algorithm and any follow-up commit their turn.
      await act(async () => new Promise((r) => setTimeout(r, 50)));
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
      expect(text().value).toBe("");
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
    expect(visible.value).toBe("1,500");
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
    expect(visible.value).toBe("5");
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
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("40");
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
    expect(screen.getByTestId("c")).not.toBeChecked();
    expect(screen.getByTestId("s")).toBeChecked();
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
      expect(parent().indeterminate).toBe(false);
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
      await act(async () => new Promise((r) => setTimeout(r, 50)));
      expect(parent().checked).toBe(true);
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
});
