// `readOnly` on Combobox.Root (conventions 3.6.1 rules 6 to 10, design/components/combobox.md
// 11.1): the Input renders native `readonly`, the popup never opens, the Trigger, Clear and
// every ChipRemove are disabled, nothing dispatches, and the hidden inputs still post.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, flushTasks, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Combobox } from "./index.js";
import type { ComboboxRootMultipleProps, ComboboxRootSingleProps } from "./index.js";

type Fn = (next: unknown, details: { reason: string }) => unknown;

function Single(props: Partial<ComboboxRootSingleProps>) {
  return (
    <>
      <button type="button">before</button>
      <Combobox.Root name="country" defaultValue="jp" defaultInputValue="Japan" {...props}>
        <Combobox.Label data-testid="label">Country</Combobox.Label>
        <Combobox.Input data-testid="input" />
        <Combobox.Trigger data-testid="trigger" aria-label="Show all" />
        <Combobox.Clear data-testid="clear" aria-label="Clear" />
        <Combobox.Popup data-testid="popup">
          <Combobox.List>
            <Combobox.Option value="jp">Japan</Combobox.Option>
            <Combobox.Option value="fr">France</Combobox.Option>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    </>
  );
}

function Multiple(props: Partial<ComboboxRootMultipleProps>) {
  return (
    <Combobox.Root multiple name="langs" defaultValue={["ts", "rs"]} {...props}>
      <Combobox.Label>Languages</Combobox.Label>
      <Combobox.Chips data-testid="chips">
        {(state) =>
          state.value.map((v) => (
            <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`}>
              {v}
              <Combobox.ChipRemove data-testid={`remove-${v}`} aria-label={`Remove ${v}`} />
            </Combobox.Chip>
          ))
        }
      </Combobox.Chips>
      <Combobox.Input data-testid="input" />
      <Combobox.Popup data-testid="popup">
        <Combobox.List>
          <Combobox.Option value="ts">TypeScript</Combobox.Option>
          <Combobox.Option value="rs">Rust</Combobox.Option>
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");
const isOpen = () => popup().matches(":popover-open");

describe("Combobox readOnly (conventions 3.6.1)", () => {
  it("native readonly on the Input, no aria-readonly; the buttons disabled; data-readonly and state", () => {
    const rootState = vi.fn((_state: unknown) => null);
    render(
      <Combobox.Root readOnly>
        {(state) => {
          rootState(state);
          return (
            <>
              <Combobox.Label data-testid="label">Country</Combobox.Label>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" aria-label="Show all" />
              <Combobox.Clear data-testid="clear" aria-label="Clear" />
            </>
          );
        }}
      </Combobox.Root>,
    );
    expect(input()).toHaveAttribute("readonly");
    expect(input()).not.toHaveAttribute("aria-readonly");
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveAttribute("data-readonly", "");
    for (const id of ["trigger", "clear"]) {
      expect(screen.getByTestId(id)).toBeDisabled();
      expect(screen.getByTestId(id)).toHaveAttribute("data-disabled", "");
      expect(screen.getByTestId(id)).toHaveAttribute("data-readonly", "");
    }
    expect(screen.getByTestId("label")).toHaveAttribute("data-readonly", "");
    expect(rootState).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("not read-only: no readonly, buttons enabled", () => {
    render(<Single />);
    expect(input()).not.toHaveAttribute("readonly");
    expect(screen.getByTestId("trigger")).not.toBeDisabled();
    expect(input()).not.toHaveAttribute("data-readonly");
  });

  it("the popup never opens: arrows, Alt+ArrowDown, a click, the Trigger; aria-expanded stays false", async () => {
    const openAction = vi.fn<Fn>();
    const valueAction = vi.fn<Fn>();
    render(
      <Single readOnly openOnClick openChangeAction={openAction} valueChangeAction={valueAction} />,
    );
    const user = setupUser();
    await user.click(input());
    expect(input()).toHaveFocus();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowDown", altKey: true });
    await user.click(screen.getByTestId("trigger"));
    await flushTasks(2);
    expect(isOpen()).toBe(false);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(openAction).not.toHaveBeenCalled();
    expect(valueAction).not.toHaveBeenCalled();
  });

  it("typing changes nothing (native readonly); Enter and Escape dispatch nothing", async () => {
    const valueAction = vi.fn<Fn>();
    const onText = vi.fn();
    render(
      <Single
        readOnly
        allowCustomValue
        valueChangeAction={valueAction}
        onInputValueChange={onText}
      />,
    );
    const user = setupUser();
    await user.click(input());
    await user.keyboard("xyz{Enter}{Escape}");
    await flushTasks(2);
    expect(input().value).toBe("Japan");
    expect(valueAction).not.toHaveBeenCalled();
    expect(onText).not.toHaveBeenCalled();
  });

  it("a stray input event (autofill) is not adopted", async () => {
    const onText = vi.fn();
    render(<Single readOnly onInputValueChange={onText} />);
    fireEvent.change(input(), { target: { value: "France" } });
    await flushTasks(1);
    expect(onText).not.toHaveBeenCalled();
    expect(input().value).toBe("Japan");
  });

  it("the hidden input is not disabled: the selection is submitted", () => {
    render(
      <form data-testid="form">
        <Single readOnly />
      </form>,
    );
    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden).not.toBeDisabled();
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("country")).toBe("jp");
  });

  it("focusable and in the Tab order", async () => {
    render(<Single readOnly />);
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "before" }));
    await user.tab();
    expect(input()).toHaveFocus();
  });

  it("a popup open when readOnly turns on closes", async () => {
    function App() {
      const [readOnly, setReadOnly] = useState(false);
      return (
        <>
          <button type="button" data-testid="lock" onClick={() => setReadOnly(true)}>
            Lock
          </button>
          <Single readOnly={readOnly} />
        </>
      );
    }
    render(<App />);
    const user = setupUser();
    await user.click(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    await act(async () => screen.getByTestId("lock").click());
    await flushTasks(2);
    expect(isOpen()).toBe(false);
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("Field.Root readOnly reaches the Input and the Field parts", () => {
    render(
      <Field.Root name="country" readOnly data-testid="field">
        <Field.Label>Country</Field.Label>
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger" aria-label="Show all" />
        </Combobox.Root>
      </Field.Root>,
    );
    expect(input()).toHaveAttribute("readonly");
    expect(screen.getByTestId("trigger")).toBeDisabled();
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("disabled wins: the Input is disabled; state.readOnly stays the prop", () => {
    render(<Single readOnly disabled />);
    expect(input()).toBeDisabled();
    expect(input()).toHaveAttribute("data-readonly", "");
  });

  it("text edited before readOnly turns on goes back to the selection's label (dismiss)", async () => {
    const onText = vi.fn<Fn>();
    const { rerender } = render(<Single onInputValueChange={onText} />);
    const user = setupUser();
    await user.click(input());
    await user.clear(input());
    await user.keyboard("Fra");
    await flushTasks(2);
    expect(input().value).toBe("Fra");
    onText.mockClear();
    expect(isOpen()).toBe(true);
    // Async: the close request's transition renders the List, which suspends on its deferred
    // query; a sync `act` would never retry it in jsdom.
    await act(async () => rerender(<Single readOnly onInputValueChange={onText} />));
    await flushTasks(2);
    expect(input().value).toBe("Japan");
    expect(onText.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["Japan", "dismiss"]]);
    expect(isOpen()).toBe(false);
  });

  it("allowCustomValue: the committed custom value is the text readOnly goes back to", async () => {
    const { rerender } = render(
      <Single allowCustomValue defaultValue={null} defaultInputValue="" />,
    );
    const user = setupUser();
    await user.click(input());
    await user.keyboard("Atlantis{Enter}");
    await flushTasks(2);
    await user.keyboard("{Backspace}{Backspace}");
    await flushTasks(2);
    expect(input().value).toBe("Atlanti".slice(0, 6));
    await act(async () =>
      rerender(<Single allowCustomValue readOnly defaultValue={null} defaultInputValue="" />),
    );
    await flushTasks(2);
    expect(input().value).toBe("Atlantis");
  });

  it("on leave while read-only, text a controlled parent kept is reverted again", async () => {
    const onText = vi.fn<Fn>();
    function App({ readOnly }: { readOnly: boolean }) {
      const [text, setText] = useState("Japan");
      return (
        <Single
          readOnly={readOnly}
          inputValue={text}
          onInputValueChange={(next, details) => {
            onText(next, details);
            // The parent adopts typing only: the lock's revert is refused.
            if (details.reason === "activate") setText(next);
          }}
        />
      );
    }
    const { rerender } = render(<App readOnly={false} />);
    const user = setupUser();
    await user.click(input());
    await user.clear(input());
    await user.keyboard("Fr");
    await flushTasks(2);
    await act(async () => rerender(<App readOnly />));
    await flushTasks(2);
    expect(input().value).toBe("Fr");
    onText.mockClear();
    await user.click(screen.getByRole("button", { name: "before" }));
    await flushTasks(2);
    expect(onText.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["Japan", "dismiss"]]);
  });

  // Escape on the shown listbox is the platform's close watcher, which jsdom does not run: the
  // browser row in combobox.browser.test.tsx covers it.
  it("a popup a controlled parent keeps open: Alt+ArrowUp requests the close again; Escape is not consumed", async () => {
    const openAction = vi.fn<Fn>();
    const onOpenChange = vi.fn<Fn>();
    await act(async () => {
      render(<Single readOnly open openChangeAction={openAction} onOpenChange={onOpenChange} />);
    });
    await flushTasks(2);
    // Mounted read-only and open: one close request already, which the parent refused.
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    expect(isOpen()).toBe(true);
    openAction.mockClear();
    input().focus();
    expect(fireEvent.keyDown(input(), { key: "ArrowUp", altKey: true })).toBe(false);
    await flushTasks(2);
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    // The parent refuses: still shown. Escape reaches the platform (not prevented).
    expect(isOpen()).toBe(true);
    expect(fireEvent.keyDown(input(), { key: "Escape" })).toBe(true);
    // Other keys stay inert and unprevented.
    expect(fireEvent.keyDown(input(), { key: "ArrowDown" })).toBe(true);
    await flushTasks(2);
    expect(openAction).toHaveBeenCalledTimes(1);
  });

  it("readOnly turned on while a value action is pending cancels nothing (rule 12)", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Single valueChangeAction={action} />);
    const user = setupUser();
    await user.click(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    await flushTasks(2);
    await user.click(screen.getByRole("option", { name: "France" }));
    await flushTasks(2);
    expect(input()).toHaveAttribute("data-pending", "");
    await act(async () => rerender(<Single readOnly valueChangeAction={action} />));
    await flushTasks(2);
    expect(input()).toHaveAttribute("data-pending", "");
    expect(input().value).toBe("France");
    await act(async () => d.resolve());
    await flushTasks(2);
    expect(input()).not.toHaveAttribute("data-pending");
    expect(input().value).toBe("France");
    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe("fr");
    expect(action).toHaveBeenCalledTimes(1);
  });

  describe("multiple", () => {
    it("ChipRemove is disabled; Backspace on the Input and on a chip removes nothing", async () => {
      const valueAction = vi.fn<Fn>();
      render(<Multiple readOnly valueChangeAction={valueAction} />);
      expect(screen.getByTestId("remove-ts")).toBeDisabled();
      expect(screen.getByTestId("remove-ts")).toHaveAttribute("data-readonly", "");
      expect(screen.getByTestId("chip-ts")).toHaveAttribute("data-readonly", "");
      expect(screen.getByTestId("chips")).toHaveAttribute("data-readonly", "");
      const user = setupUser();
      await user.click(input());
      await user.keyboard("{Backspace}");
      screen.getByTestId("chip-rs").focus();
      await user.keyboard("{Backspace}{Delete}");
      await flushTasks(2);
      expect(valueAction).not.toHaveBeenCalled();
      expect(screen.getByTestId("chip-ts")).toBeInTheDocument();
      expect(screen.getByTestId("chip-rs")).toBeInTheDocument();
    });

    it("the chip keys still move focus: the inline-start arrow from the Input, then between chips", async () => {
      render(<Multiple readOnly />);
      const user = setupUser();
      await user.click(input());
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByTestId("chip-rs")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByTestId("chip-ts")).toHaveFocus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(input()).toHaveFocus();
    });

    it("a search typed before readOnly turns on is cleared (dismiss)", async () => {
      const onText = vi.fn<Fn>();
      const { rerender } = render(<Multiple onInputValueChange={onText} />);
      const user = setupUser();
      await user.click(input());
      await user.keyboard("Go");
      await flushTasks(2);
      onText.mockClear();
      await act(async () => rerender(<Multiple readOnly onInputValueChange={onText} />));
      await flushTasks(2);
      expect(input().value).toBe("");
      expect(onText.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["", "dismiss"]]);
    });

    it("readOnly turned on while a removal is pending cancels nothing (rule 12)", async () => {
      const d = deferred();
      const action = vi.fn<Fn>(() => d.promise);
      const { rerender } = render(<Multiple valueChangeAction={action} />);
      await setupUser().click(screen.getByTestId("remove-ts"));
      await flushTasks(2);
      expect(screen.queryByTestId("chip-ts")).toBeNull();
      expect(screen.getByTestId("chips")).toHaveAttribute("data-pending", "");
      await act(async () => rerender(<Multiple readOnly valueChangeAction={action} />));
      expect(screen.getByTestId("chips")).toHaveAttribute("data-pending", "");
      await act(async () => d.resolve());
      await flushTasks(2);
      expect(screen.getByTestId("chips")).not.toHaveAttribute("data-pending");
      expect(screen.queryByTestId("chip-ts")).toBeNull();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("every value is submitted", () => {
      render(
        <form data-testid="form">
          <Multiple readOnly />
        </form>,
      );
      expect(new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("langs")).toEqual([
        "ts",
        "rs",
      ]);
    });
  });
});
