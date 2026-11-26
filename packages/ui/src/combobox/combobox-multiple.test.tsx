// Combobox `multiple` (design/components/combobox.md 15), jsdom. The value contract (pending,
// optimistic, rejections, overlap and the replay of resolved changes, controlled veto, details)
// runs through the shared value-action suite with the driver in
// __tests__/drivers/combobox-multiple.tsx; this file covers what is Combobox's own: a pick
// toggles, clears the text and leaves the listbox open; the chips and their keys; Backspace; the
// removal announcement; free text; the hidden inputs, `required` and form reset.
//
// In combobox-multiple.browser.test.tsx instead: the keydown hand-over of a printable key from a
// chip to the Input with the real keyboard, light dismiss on `ChipRemove`, `valueMissing` while
// the removal of the last chip is pending, Tab out of a chip.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState, startTransition } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { comboboxMultipleDriver } from "../__tests__/drivers/combobox-multiple.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushTasks,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { describeValueAction } from "../__tests__/value-action-suite.js";
import { Field } from "../field/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxChipState,
  ComboboxMultipleProps,
  ComboboxMultipleRootState,
  ComboboxMultipleValueChangeDetails,
} from "./index.js";

describeValueAction(comboboxMultipleDriver);

type Action = (next: string[], details: ComboboxMultipleValueChangeDetails) => unknown;

const COUNTRIES = [
  { code: "jp", name: "Japan" },
  { code: "jm", name: "Jamaica" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
] as const;

function Options({ query }: { query: string }) {
  const q = query.toLowerCase();
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).map((c) => (
    <Combobox.Option key={c.code} value={c.code} data-testid={`opt-${c.code}`}>
      {c.name}
    </Combobox.Option>
  ));
}

interface HarnessProps {
  root?: Partial<ComboboxMultipleProps>;
  required?: boolean;
  boundary?: (error: unknown) => void;
  /** Render the chips (default true). */
  chips?: boolean;
  chip?: (value: string) => ReactNode;
}

function Box({ root, required, chips = true, chip }: HarnessProps) {
  return (
    <Combobox.Root multiple {...root}>
      <Combobox.Label>Countries</Combobox.Label>
      {chips && (
        <Combobox.Chips data-testid="chips">
          {({ value }) =>
            value.map(
              (v) =>
                chip?.(v) ?? (
                  <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`}>
                    {({ label }) => (
                      <>
                        <span>{label ?? v}</span>
                        <Combobox.ChipRemove
                          aria-label={`Remove ${label ?? v}`}
                          data-testid={`remove-${v}`}
                        />
                      </>
                    )}
                  </Combobox.Chip>
                ),
            )
          }
        </Combobox.Chips>
      )}
      <Combobox.Input data-testid="input" required={required} />
      <Combobox.Trigger aria-label="Show all" data-testid="trigger" />
      <Combobox.Clear aria-label="Clear" data-testid="clear" />
      <Combobox.Popup data-testid="popup">
        <Combobox.List data-testid="list">{({ query }) => <Options query={query} />}</Combobox.List>
        <Combobox.Empty>No country</Combobox.Empty>
      </Combobox.Popup>
    </Combobox.Root>
  );
}

function Harness(props: HarnessProps) {
  const box = props.boundary ? (
    <ErrorCatcher onError={props.boundary}>
      <Box {...props} />
    </ErrorCatcher>
  ) : (
    <Box {...props} />
  );
  return (
    <form data-testid="form">
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {box}
      <input data-testid="next" />
    </form>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");
const list = () => screen.getByTestId("list");
const option = (code: string) => screen.getByTestId(`opt-${code}`);
const chip = (code: string) => screen.getByTestId(`chip-${code}`);
const chipsEl = () => screen.getByTestId("chips");
const isOpen = () => popup().matches(":popover-open");
const chipTexts = () =>
  screen.queryAllByRole("listitem").map((el) => el.querySelector("span")?.textContent);
const hiddenValues = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((el) => [
    el.name,
    el.value,
  ]);
const formValues = () =>
  new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("countries");

async function typeText(user: ReturnType<typeof setupUser>, text: string) {
  if (document.activeElement !== input()) await user.click(input());
  await user.keyboard(text);
  await flushTasks(2);
}

function stubAriaNotify() {
  const notify = vi.fn();
  Object.defineProperty(Element.prototype, "ariaNotify", {
    configurable: true,
    value: function (this: Element, message: string) {
      notify(this, message);
    },
  });
  return notify;
}

afterEach(() => {
  delete (Element.prototype as { ariaNotify?: unknown }).ariaNotify;
});

describe("Combobox multiple (jsdom)", () => {
  describe("markup and ARIA (15.1, 15.7)", () => {
    it("renders a multiselectable listbox, a named list of focusable chips and one hidden input per value", async () => {
      const user = setupUser();
      render(<Harness root={{ name: "countries", defaultValue: ["jp", "fr"] }} />);
      expect(chipsEl()).toHaveAttribute("role", "list");
      expect(chipsEl()).toHaveAttribute(
        "aria-labelledby",
        screen.getByText("Countries").getAttribute("id"),
      );
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item).toHaveAttribute("tabindex", "-1");
        expect(item).not.toHaveAttribute("data-pending");
      }
      const remove = screen.getByTestId("remove-jp");
      expect(remove).toHaveAttribute("type", "button");
      expect(remove).toHaveAttribute("tabindex", "-1");
      expect(hiddenValues()).toEqual([
        ["countries", "jp"],
        ["countries", "fr"],
      ]);
      expect(formValues()).toEqual(["jp", "fr"]);
      expect(input()).toHaveAttribute("data-selected", "");
      expect(input()).toHaveAttribute("role", "combobox");
      await typeText(user, "a");
      expect(list()).toHaveAttribute("aria-multiselectable", "true");
      expect(option("jp")).toHaveAttribute("aria-selected", "true");
      expect(option("jm")).toHaveAttribute("aria-selected", "false");
    });

    it("drops the list role while empty and keeps one nameless hidden input", () => {
      render(<Harness root={{ name: "countries" }} />);
      expect(chipsEl()).not.toHaveAttribute("role");
      expect(chipsEl()).not.toHaveAttribute("aria-labelledby");
      expect(chipsEl()).toHaveAttribute("data-empty", "");
      expect(hiddenValues()).toEqual([["", ""]]);
      expect(formValues()).toEqual([]);
      expect(input()).not.toHaveAttribute("data-selected");
    });

    it("a single Combobox has no aria-multiselectable and its state gains `values`", async () => {
      const user = setupUser();
      render(
        <Combobox.Root defaultValue="jp" defaultInputValue="Japan">
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Input
            data-testid="input"
            className={(s) => `values-${s.values.join("+")}-${String(s.value)}`}
          />
          <Combobox.Popup>
            <Combobox.List data-testid="list">
              {({ query }) => <Options query={query} />}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
      expect(input()).toHaveClass("values-jp-jp");
      await user.click(input());
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(list()).not.toHaveAttribute("aria-multiselectable");
    });

    it("a Chip renders `label ?? value` by default; the label comes from the cache", async () => {
      const user = setupUser();
      render(
        <Harness
          root={{ defaultValue: ["jp"] }}
          chip={(v) => <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`} />}
        />,
      );
      // No Option for "jp" was ever mounted: the raw value.
      expect(chip("jp")).toHaveTextContent("jp");
      await typeText(user, "j");
      // The Option registered: the chip learns its text.
      expect(chip("jp")).toHaveTextContent("Japan");
      await user.click(option("jm"));
      expect(chip("jm")).toHaveTextContent("Jamaica");
    });
  });

  describe("a pick (15.3)", () => {
    it("toggles, clears the text and leaves the listbox open; the active option stays", async () => {
      const action = vi.fn<Action>();
      const text = vi.fn();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action, onInputValueChange: text }} />);
      await typeText(user, "ja");
      await user.keyboard("{ArrowDown}{Enter}");
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toEqual(["jp"]);
      expect(details).toMatchObject({
        reason: "activate",
        added: ["jp"],
        removed: [],
        custom: false,
      });
      expect(details.event?.type).toBe("keydown");
      expect(input().value).toBe("");
      expect(text).toHaveBeenLastCalledWith("", expect.objectContaining({ reason: "activate" }));
      expect(isOpen()).toBe(true);
      expect(input()).toHaveAttribute("aria-activedescendant", option("jp").id);
      expect(chipTexts()).toEqual(["Japan"]);
      // Enter again on the same option toggles it off.
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]![1]).toMatchObject({ added: [], removed: ["jp"] });
      expect(chipTexts()).toEqual([]);
      expect(isOpen()).toBe(true);
    });

    it("a click toggles too; the text is not written when it is already empty", async () => {
      const action = vi.fn<Action>();
      const text = vi.fn();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action, onInputValueChange: text }} />);
      await user.click(screen.getByTestId("trigger"));
      await flushTasks(2);
      text.mockClear();
      await user.click(option("fr"));
      expect(action).toHaveBeenLastCalledWith(
        ["fr"],
        expect.objectContaining({ added: ["fr"], removed: [] }),
      );
      expect(text).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
      await user.click(option("jp"));
      expect(chipTexts()).toEqual(["France", "Japan"]);
    });

    it("a pick shows data-pending on the chip, the option, the Input and Chips; the latest rejection reaches the boundary", async () => {
      silenceErrors();
      const onError = vi.fn();
      const save = deferred();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: () => save.promise }} boundary={onError} />);
      await typeText(user, "fr");
      await user.click(option("fr"));
      expectPending(chip("fr"));
      expectPending(option("fr"));
      expectPending(input());
      expectPending(chipsEl());
      expect(input().value).toBe("");
      await typeText(user, "ja");
      await act(async () => save.reject(new Error("nope")));
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("the text typed after a pick survives the pick's rejection (no error boundary in the way)", async () => {
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      const first = deferred();
      const second = deferred();
      const saves = [first, second];
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: () => saves.shift()!.promise }} />);
      await typeText(user, "fr");
      await user.click(option("fr"));
      await user.click(option("jp"));
      await typeText(user, "ge");
      await act(async () => first.reject(new Error("superseded")));
      await act(async () => second.resolve());
      expect(reportError).toHaveBeenCalledTimes(1);
      // Walkthrough 2: only the resolved change is kept.
      expect(chipTexts()).toEqual(["Japan"]);
      expect(input().value).toBe("ge");
      vi.unstubAllGlobals();
    });

    it("Alt+ArrowUp closes without picking", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeText(user, "j");
      await user.keyboard("{ArrowDown}{Alt>}{ArrowUp}{/Alt}");
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
    });

    it("Clear removes every value in one change and empties the text", async () => {
      const notify = stubAriaNotify();
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp", "fr"], valueChangeAction: action }} />);
      await typeText(user, "ge");
      await user.click(screen.getByTestId("clear"));
      expect(action).toHaveBeenCalledExactlyOnceWith(
        [],
        expect.objectContaining({ added: [], removed: ["jp", "fr"], reason: "activate" }),
      );
      expect(input().value).toBe("");
      expect(document.activeElement).toBe(input());
      expect(notify).toHaveBeenCalledWith(input(), "jp, fr removed");
      notify.mockClear();
      await user.click(screen.getByTestId("clear"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(notify).not.toHaveBeenCalledWith(input(), expect.anything());
    });
  });

  describe("Backspace and the removal announcement (15.6, 15.7)", () => {
    it("removes the last chip in the empty input and announces it; not while text is typed, not on repeat", async () => {
      const notify = stubAriaNotify();
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp"], valueChangeAction: action }} />);
      await user.click(screen.getByTestId("trigger"));
      await flushTasks(2);
      await user.click(option("fr"));
      expect(chipTexts()).toEqual(["Japan", "France"]);
      await user.keyboard("x{Backspace}");
      expect(action).toHaveBeenCalledTimes(1);
      await user.keyboard("{Backspace}");
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toEqual(["jp"]);
      expect(details).toMatchObject({ reason: "activate", added: [], removed: ["fr"] });
      expect(details.event?.type).toBe("keydown");
      expect(chipTexts()).toEqual(["Japan"]);
      expect(notify).toHaveBeenCalledWith(input(), "France removed");
      // A held key does not go on to eat chips.
      fireEvent.keyDown(input(), { key: "Backspace", repeat: true });
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("announceRemoved overrides the message; null announces nothing", async () => {
      const notify = stubAriaNotify();
      const announceRemoved = vi.fn(
        (labels: readonly string[], state: ComboboxMultipleRootState) =>
          `${labels.join("+")} gone of ${state.value.length}`,
      );
      const user = setupUser();
      const { unmount } = render(
        <Harness root={{ defaultValue: ["jp", "fr"], announceRemoved }} />,
      );
      await user.click(input());
      await user.keyboard("{Backspace}");
      expect(notify).toHaveBeenLastCalledWith(input(), "fr gone of 2");
      unmount();
      notify.mockClear();
      render(<Harness root={{ defaultValue: ["jp"], announceRemoved: () => null }} />);
      await user.click(input());
      await user.keyboard("{Backspace}");
      expect(notify).not.toHaveBeenCalled();
    });

    it("the label is the Chip's `label` prop, else the cache, else the chip's text", async () => {
      const notify = stubAriaNotify();
      const user = setupUser();
      render(
        <Harness
          root={{ defaultValue: ["jp", "fr", "xx"] }}
          chip={(v) => (
            <Combobox.Chip key={v} value={v} label={v === "jp" ? "Nippon" : undefined}>
              {v === "xx" ? "Atlantis" : `chip ${v}`}
            </Combobox.Chip>
          )}
        />,
      );
      await typeText(user, "fr");
      await user.keyboard("{Escape}");
      // France was learnt from its Option.
      await user.clear(input());
      notify.mockClear();
      await user.keyboard("{Backspace}");
      expect(notify).toHaveBeenLastCalledWith(input(), "Atlantis removed");
      await user.keyboard("{Backspace}");
      expect(notify).toHaveBeenLastCalledWith(input(), "France removed");
      await user.keyboard("{Backspace}");
      expect(notify).toHaveBeenLastCalledWith(input(), "Nippon removed");
    });

    it("a removed chip disappears at once and comes back on rejection, in its old place", async () => {
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      silenceErrors();
      const onError = vi.fn();
      const save = deferred();
      const user = setupUser();
      render(
        <Harness
          root={{ defaultValue: ["jp", "fr", "de"], valueChangeAction: () => save.promise }}
          boundary={onError}
        />,
      );
      await user.click(screen.getByTestId("remove-fr"));
      expect(chipTexts()).toEqual(["jp", "de"]);
      expectPending(input());
      expectPending(chipsEl());
      expectNotPending(chip("jp"));
      await act(async () => save.reject(new Error("no")));
      expect(onError).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it("a removal rolled back by a superseded rejection brings the chip back without focus", async () => {
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      const first = deferred();
      const second = deferred();
      const saves = [first, second];
      const user = setupUser();
      render(
        <Harness
          root={{
            defaultValue: ["jp", "fr", "de"],
            valueChangeAction: () => saves.shift()!.promise,
          }}
        />,
      );
      await user.click(screen.getByTestId("remove-fr"));
      await user.click(screen.getByTestId("remove-de"));
      expect(chipTexts()).toEqual(["jp"]);
      expect(document.activeElement).toBe(input());
      await act(async () => first.reject(new Error("superseded")));
      await act(async () => second.resolve());
      expect(chipTexts()).toEqual(["jp", "fr"]);
      expect(document.activeElement).toBe(input());
      vi.unstubAllGlobals();
    });

    it("the option of a value being removed shows data-pending", async () => {
      const save = deferred();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp"], valueChangeAction: () => save.promise }} />);
      await typeText(user, "j");
      await user.click(option("jp"));
      expect(option("jp")).toHaveAttribute("aria-selected", "false");
      expectPending(option("jp"));
      expectNotPending(option("jm"));
      await act(async () => save.resolve());
      expectNotPending(option("jp"));
    });
  });

  describe("chip focus and keys (15.6)", () => {
    it("the inline-start arrow at the caret's start moves focus to the last chip and closes the listbox; text is kept", async () => {
      const onOpenChange = vi.fn();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp", "fr"], onOpenChange }} />);
      await typeText(user, "j");
      expect(isOpen()).toBe(true);
      // The caret is after "j": the arrow moves it.
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(input());
      await user.keyboard("{ArrowLeft}");
      await flushTasks(2);
      expect(document.activeElement).toBe(chip("fr"));
      expect(isOpen()).toBe(false);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
      expect(input().value).toBe("j");
    });

    it("previous / next arrows, Home / End, Escape and the next arrow off the last chip", async () => {
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp", "fr", "de"] }} />);
      await user.click(input());
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(chip("de"));
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(chip("fr"));
      await user.keyboard("{Home}");
      expect(document.activeElement).toBe(chip("jp"));
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(chip("jp"));
      await user.keyboard("{End}");
      expect(document.activeElement).toBe(chip("de"));
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(input());
      await user.keyboard("{ArrowLeft}{Escape}");
      expect(document.activeElement).toBe(input());
    });

    it("follows the inline direction under dir=rtl", async () => {
      const user = setupUser();
      render(
        <div dir="rtl" style={{ direction: "rtl" }}>
          <Harness root={{ defaultValue: ["jp", "fr"] }} />
        </div>,
      );
      await user.click(input());
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(input());
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(chip("fr"));
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(chip("jp"));
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(chip("fr"));
    });

    it("Backspace and Delete remove the focused chip after moving focus: next, else previous, else the Input", async () => {
      const notify = stubAriaNotify();
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp", "fr", "de"], valueChangeAction: action }} />);
      await user.click(input());
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(document.activeElement).toBe(chip("fr"));
      await user.keyboard("{Delete}");
      expect(action).toHaveBeenLastCalledWith(
        ["jp", "de"],
        expect.objectContaining({ removed: ["fr"] }),
      );
      expect(action.mock.calls[0]![1].event?.type).toBe("keydown");
      expect(document.activeElement).toBe(chip("de"));
      expect(notify).toHaveBeenLastCalledWith(input(), "fr removed");
      await user.keyboard("{Backspace}");
      expect(document.activeElement).toBe(chip("jp"));
      await user.keyboard("{Backspace}");
      expect(document.activeElement).toBe(input());
      expect(chipTexts()).toEqual([]);
    });

    it("a printable key focuses the Input in the keydown; Enter and Space do nothing", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp"], valueChangeAction: action }} />);
      await user.click(input());
      await user.keyboard("{ArrowLeft}");
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(document.activeElement).toBe(chip("jp"));
      expect(action).not.toHaveBeenCalled();
      // user-event types into the element focused when the key goes down: the Input.
      await user.keyboard("g");
      await flushTasks(2);
      expect(document.activeElement).toBe(input());
      expect(input().value).toBe("g");
      expect(isOpen()).toBe(true);
    });

    it("focus leaving a chip for outside the combobox is focus leaving: the text is dropped", async () => {
      const text = vi.fn();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp"], onInputValueChange: text }} />);
      await typeText(user, "zz");
      await user.keyboard("{Home}{ArrowLeft}");
      expect(document.activeElement).toBe(chip("jp"));
      expect(input().value).toBe("zz");
      act(() => screen.getByTestId("next").focus());
      await flushTasks(2);
      expect(input().value).toBe("");
      expect(text).toHaveBeenLastCalledWith("", expect.objectContaining({ reason: "dismiss" }));
    });

    it("a press in Chips does not take focus; its click focuses the Input; ChipRemove removes and announces", async () => {
      const notify = stubAriaNotify();
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp", "fr"], valueChangeAction: action }} />);
      expect(fireEvent.pointerDown(chip("jp"))).toBe(false);
      expect(fireEvent.mouseDown(chip("jp"))).toBe(false);
      expect(fireEvent.mouseDown(screen.getByTestId("remove-jp"))).toBe(false);
      await user.click(chip("jp"));
      expect(document.activeElement).toBe(input());
      act(() => screen.getByTestId("elsewhere").focus());
      await user.click(screen.getByTestId("remove-jp"));
      expect(action).toHaveBeenCalledExactlyOnceWith(
        ["fr"],
        expect.objectContaining({ reason: "activate", added: [], removed: ["jp"] }),
      );
      expect(action.mock.calls[0]![1].event?.type).toBe("click");
      expect(document.activeElement).toBe(input());
      expect(notify).toHaveBeenLastCalledWith(input(), "jp removed");
    });

    it("chips do nothing while disabled; ChipRemove is natively disabled", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(
        <Harness root={{ defaultValue: ["jp"], valueChangeAction: action, disabled: true }} />,
      );
      expect(screen.getByTestId("remove-jp")).toBeDisabled();
      expect(chipsEl()).toHaveAttribute("data-disabled", "");
      expect(chip("jp")).toHaveAttribute("data-disabled", "");
      act(() => chip("jp").focus());
      await user.keyboard("{Delete}");
      expect(action).not.toHaveBeenCalled();
      expect(hiddenValues()).toEqual([]);
    });
  });

  describe("free text and focus leaving (15.9)", () => {
    it("without allowCustomValue: focus leaving clears the text; Enter while closed clears it and is not prevented", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ valueChangeAction: action }} />);
      await typeText(user, "zz");
      await user.keyboard("{Escape}");
      act(() => popup().hidePopover());
      const enter = fireEvent.keyDown(input(), { key: "Enter" });
      expect(enter).toBe(true);
      expect(input().value).toBe("");
      await typeText(user, "yy");
      act(() => screen.getByTestId("next").focus());
      await flushTasks(2);
      expect(input().value).toBe("");
      expect(action).not.toHaveBeenCalled();
    });

    it("with allowCustomValue: Enter adds the text (prevented, open or closed); a duplicate adds nothing; leaving adds it", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      await typeText(user, "Narnia");
      expect(isOpen()).toBe(true);
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(false);
      await flushTasks(2);
      expect(action).toHaveBeenLastCalledWith(
        ["Narnia"],
        expect.objectContaining({ added: ["Narnia"], removed: [], custom: true }),
      );
      expect(input().value).toBe("");
      expect(isOpen()).toBe(true);
      expect(chipTexts()).toEqual(["Narnia"]);
      act(() => popup().hidePopover());
      await flushTasks(2);
      await user.keyboard("Narnia");
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(false);
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(input().value).toBe("");
      await user.keyboard("Oz");
      act(() => screen.getByTestId("next").focus());
      await flushTasks(2);
      expect(action).toHaveBeenLastCalledWith(
        ["Narnia", "Oz"],
        expect.objectContaining({ added: ["Oz"], custom: true }),
      );
      expect(action.mock.calls.at(-1)![1].event?.type).toBe("focusout");
      expect(input().value).toBe("");
    });

    it("Enter with an empty text while closed is the form's (not prevented, nothing dispatched)", async () => {
      const action = vi.fn<Action>();
      render(<Harness root={{ allowCustomValue: true, valueChangeAction: action }} />);
      act(() => input().focus());
      expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe("form, required, reset (15.8)", () => {
    it("required renders native required only while the selection is empty, aria-required always", async () => {
      const save = deferred();
      const user = setupUser();
      render(
        <Harness
          required
          root={{ name: "countries", defaultValue: ["jp"], valueChangeAction: () => save.promise }}
        />,
      );
      expect(input().required).toBe(false);
      expect(input()).toHaveAttribute("aria-required", "true");
      expect(input().validity.valueMissing).toBe(false);
      await user.click(screen.getByTestId("remove-jp"));
      // Optimistic: required at once, while the removal is pending.
      expect(input().required).toBe(true);
      expect(input().validity.valueMissing).toBe(true);
      expect(formValues()).toEqual([]);
      await act(async () => save.resolve());
      expect(input().required).toBe(true);
    });

    it("form reset dispatches the reset target whole, with the diff", async () => {
      const action = vi.fn<Action>();
      const user = setupUser();
      render(
        <Harness root={{ name: "countries", defaultValue: ["jp"], valueChangeAction: action }} />,
      );
      await typeText(user, "fr");
      await user.click(option("fr"));
      await user.click(screen.getByTestId("remove-jp"));
      await typeText(user, "ge");
      expect(formValues()).toEqual(["fr"]);
      action.mockClear();
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushTasks(1);
      expect(action).toHaveBeenCalledExactlyOnceWith(
        ["jp"],
        expect.objectContaining({ reason: "platform", added: ["jp"], removed: ["fr"] }),
      );
      expect(action.mock.calls[0]![1].event?.type).toBe("reset");
      expect(formValues()).toEqual(["jp"]);
      expect(input().value).toBe("");
    });

    it("walkthrough 7: a reset during a save ends on the reset target", async () => {
      const save = deferred();
      const actions: [string[], ComboboxMultipleValueChangeDetails][] = [];
      const user = setupUser();
      render(
        <Harness
          root={{
            name: "countries",
            defaultValue: ["jp"],
            valueChangeAction: (next, details) => {
              actions.push([next, details]);
              return details.reason === "platform" ? undefined : save.promise;
            },
          }}
        />,
      );
      await typeText(user, "fr");
      await user.click(option("fr"));
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushTasks(1);
      expect(actions.at(-1)![1]).toMatchObject({ reason: "platform", removed: ["fr"] });
      await act(async () => save.resolve());
      expect(formValues()).toEqual(["jp"]);
      expect(chipTexts()).toEqual(["Japan"]);
    });

    it("inside a Field: validate reads the first value; required follows the selection", async () => {
      const validate = vi.fn(() => null);
      const user = setupUser();
      render(
        <form>
          <Field.Root name="countries" validate={validate} required>
            <Field.Label>Countries</Field.Label>
            <Combobox.Root multiple defaultValue={["fr", "jp"]}>
              <Combobox.Input data-testid="input" />
              <Combobox.Popup>
                <Combobox.List>{({ query }) => <Options query={query} />}</Combobox.List>
              </Combobox.Popup>
            </Combobox.Root>
          </Field.Root>
        </form>,
      );
      expect(input().required).toBe(false);
      expect(input()).toHaveAttribute("aria-required", "true");
      await typeText(user, "ger");
      await user.click(option("de"));
      await flushTasks(1);
      expect(validate).toHaveBeenLastCalledWith("fr", expect.any(FormData));
    });

    it("a removal the parent does not adopt rolls back: the chip returns and `required` leaves", async () => {
      const save = deferred();
      const user = setupUser();
      render(
        <Harness
          required
          root={{ name: "countries", value: ["jp"], valueChangeAction: () => save.promise }}
        />,
      );
      await user.click(screen.getByTestId("remove-jp"));
      expect(input().required).toBe(true);
      await act(async () => save.resolve());
      expect(chipTexts()).toEqual(["jp"]);
      expect(input().required).toBe(false);
      expect(formValues()).toEqual(["jp"]);
    });

    it("server HTML: the default chips and hidden inputs; `required` exactly when the default is empty", () => {
      const html = (defaultValue: string[]) =>
        renderToString(<Harness required root={{ name: "countries", defaultValue }} />);
      const full = html(["jp", "fr"]);
      expect(full).toContain('<input type="hidden" name="countries" value="jp"/>');
      expect(full).toContain('<input type="hidden" name="countries" value="fr"/>');
      expect(full).toContain('role="listitem"');
      expect(full).toContain('aria-required="true"');
      expect(full).not.toMatch(/<input[^>]*role="combobox"[^>]*required=""/);
      const empty = html([]);
      expect(empty).toMatch(
        /<input[^>]*required=""[^>]*role="combobox"|<input[^>]*role="combobox"[^>]*required=""/,
      );
      expect(empty).not.toContain('name="countries"');
    });
  });

  describe("controlled (15.4)", () => {
    it("an update-on-success parent applies the diff as a functional update", async () => {
      function Parent() {
        const [tags, setTags] = useState<string[]>(["jp"]);
        return (
          <>
            <output data-testid="tags">{tags.join(",")}</output>
            <Harness
              root={{
                value: tags,
                valueChangeAction: async (_next, { added, removed }) => {
                  await Promise.resolve();
                  startTransition(() =>
                    setTags((prev) => [
                      ...prev.filter((t) => !removed.includes(t)),
                      ...added.filter((t) => !prev.includes(t)),
                    ]),
                  );
                },
              }}
            />
          </>
        );
      }
      const user = setupUser();
      render(<Parent />);
      await typeText(user, "fr");
      await user.click(option("fr"));
      await flushTasks(2);
      expect(screen.getByTestId("tags")).toHaveTextContent("jp,fr");
      expect(chipTexts()).toEqual(["Japan", "France"]);
    });
  });

  describe("states", () => {
    it("Chip and ChipRemove state; the Root's state has the list", async () => {
      const save = deferred();
      const chipStates: ComboboxChipState[] = [];
      const rootStates: ComboboxMultipleRootState[] = [];
      const user = setupUser();
      render(
        <Combobox.Root multiple defaultValue={["jp"]} valueChangeAction={() => save.promise}>
          {(state) => {
            rootStates.push(state);
            return (
              <>
                <Combobox.Label>Countries</Combobox.Label>
                <Combobox.Chips>
                  {({ value }) =>
                    value.map((v) => (
                      <Combobox.Chip key={v} value={v}>
                        {(s) => {
                          chipStates.push(s);
                          return (
                            <Combobox.ChipRemove
                              aria-label="Remove"
                              data-testid={`remove-${v}`}
                              className={(r) => `r-${r.value}-${String(r.pending)}`}
                            />
                          );
                        }}
                      </Combobox.Chip>
                    ))
                  }
                </Combobox.Chips>
                <Combobox.Input data-testid="input" />
                <Combobox.Popup>
                  <Combobox.List>{({ query }) => <Options query={query} />}</Combobox.List>
                </Combobox.Popup>
              </>
            );
          }}
        </Combobox.Root>,
      );
      await typeText(user, "fr");
      await user.click(option("fr"));
      expect(rootStates.at(-1)!.value).toEqual(["jp", "fr"]);
      expect(rootStates.at(-1)!.pending).toBe(true);
      expect(chipStates.filter((s) => s.value === "fr").at(-1)).toEqual({
        value: "fr",
        label: "France",
        pending: true,
        disabled: false,
      });
      expect(screen.getByTestId("remove-fr")).toHaveClass("r-fr-true");
      expect(screen.getByTestId("remove-jp")).toHaveClass("r-jp-false");
      await act(async () => save.resolve());
      expect(screen.getByTestId("remove-fr")).toHaveClass("r-fr-false");
    });
  });

  describe("dev warnings (15.2)", () => {
    it("Chips, Chip and ChipRemove under a single Root warn; ChipRemove outside a Chip throws", () => {
      const error = silenceErrors();
      render(
        <Combobox.Root>
          <Combobox.Chips data-testid="chips">
            <Combobox.Chip value="jp">
              <Combobox.ChipRemove aria-label="Remove" />
            </Combobox.Chip>
          </Combobox.Chips>
          <Combobox.Input aria-label="x" />
        </Combobox.Root>,
      );
      const messages = error.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.startsWith("Combobox.Chips: rendered under"))).toBe(true);
      expect(messages.some((m) => m.startsWith("Combobox.Chip: rendered under"))).toBe(true);
      expect(messages.some((m) => m.startsWith("Combobox.ChipRemove: rendered under"))).toBe(true);
      expect(chipsEl()).not.toHaveAttribute("role");
      expect(() =>
        render(
          <Combobox.Root multiple>
            <Combobox.ChipRemove aria-label="Remove" />
          </Combobox.Root>,
        ),
      ).toThrow("Combobox.ChipRemove must be rendered inside a Combobox.Chip.");
    });

    it("a Chip whose value is not selected warns; switching `multiple` after mount warns and is ignored", () => {
      const error = silenceErrors();
      const ui = (multiple: boolean) => (
        <Combobox.Root multiple={multiple as true} defaultValue={["jp"]}>
          <Combobox.Chips data-testid="chips">
            <Combobox.Chip value="xx" />
          </Combobox.Chips>
          <Combobox.Input aria-label="x" data-testid="input" />
        </Combobox.Root>
      );
      const { rerender } = render(ui(true));
      expect(
        error.mock.calls.some((c) => String(c[0]).startsWith("Combobox.Chip: its value")),
      ).toBe(true);
      rerender(ui(false));
      expect(
        error.mock.calls.some((c) =>
          String(c[0]).startsWith("Combobox.Root: `multiple` changed after mount"),
        ),
      ).toBe(true);
      expect(input()).toHaveAttribute("data-selected", "");
    });

    it("does not warn in normal use, nor for a value without defaultInputValue", async () => {
      const error = silenceErrors();
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["jp"], name: "countries" }} />);
      await typeText(user, "fr");
      await user.click(option("fr"));
      expect(error).not.toHaveBeenCalled();
    });
  });
});
