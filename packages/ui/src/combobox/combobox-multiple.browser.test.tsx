// Combobox `multiple` rows that need a real engine (design/components/combobox.md 15), on Chromium,
// Firefox and WebKit:
//
// - A printable key on a focused chip: the Input is focused in the chip's `keydown`, and the
//   character must land in the Input (real keyboard, every engine; the first point the design's
//   CHANGELOG entry left to verify at implementation).
// - Tab out of a chip (tabindex=-1) goes on from the chip's place in the document.
// - A press on `ChipRemove` while the listbox is open is a light dismiss (`"dismiss"`), the chip
//   is removed by the click, focus stays in the Input, nothing re-opens.
// - `valueMissing` on the visible Input while the removal of the last chip is pending blocks a
//   submit (the browser's own constraint validation).
// - Escape on a chip inside a modal Dialog moves focus to the Input and does not close the
//   Dialog (the key is prevented, so no close request).
// - The removal announcement goes through the real `ariaNotify` on the Input.
// - Chromium's accessibility tree (CDP): `aria-multiselectable` on the listbox, `selected` on the
//   options, the chips as a named list of focusable items. What a screen reader speaks (the
//   toggle under `aria-activedescendant`, a chip's position) is a manual NVDA / JAWS / VoiceOver
//   pass, not automated (memo/developer/issue-164.md).
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsAriaNotify } from "../__tests__/engine.js";
import { axProperty, axNodeOf } from "../__tests__/ax-tree.js";
import { deferred } from "../__tests__/helpers.js";
import { mouse } from "../__tests__/browser-commands.js";
import {
  flushFor,
  leaveActEnvironment,
  quietPeriod,
  settle,
} from "../__tests__/browser-helpers.js";
import { Dialog } from "../dialog/index.js";
import { Combobox } from "./index.js";
import type {
  ComboboxMultipleProps,
  ComboboxMultipleValueChangeDetails,
  ComboboxOpenChangeDetails,
} from "./index.js";

type Action = (next: string[], details: ComboboxMultipleValueChangeDetails) => unknown;

const COUNTRIES = [
  { code: "jp", name: "Japan" },
  { code: "jm", name: "Jamaica" },
  { code: "fr", name: "France" },
];

function Options({ query }: { query: string }) {
  const q = query.toLowerCase();
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).map((c) => (
    <Combobox.Option key={c.code} value={c.code} data-testid={`opt-${c.code}`}>
      {c.name}
    </Combobox.Option>
  ));
}

const popupStyle = { margin: 0, inset: "auto", padding: 0, border: "1px solid" } as const;
const chipStyle = { display: "inline-flex", gap: 4, padding: "2px 6px", margin: 2 } as const;

function Box({ root, required }: { root?: Partial<ComboboxMultipleProps>; required?: boolean }) {
  return (
    <Combobox.Root multiple name="countries" {...root}>
      <Combobox.Label>Countries</Combobox.Label>
      <div>
        <Combobox.Chips data-testid="chips" style={{ display: "inline" }}>
          {({ value }) =>
            value.map((v) => (
              <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`} style={chipStyle}>
                {({ label }) => (
                  <>
                    <span>{label ?? v}</span>
                    <Combobox.ChipRemove
                      aria-label={`Remove ${label ?? v}`}
                      data-testid={`remove-${v}`}
                      style={{ width: 16, height: 16 }}
                    />
                  </>
                )}
              </Combobox.Chip>
            ))
          }
        </Combobox.Chips>
        <Combobox.Input data-testid="input" required={required} style={{ width: 160 }} />
      </div>
      <Combobox.Popup data-testid="popup" style={popupStyle}>
        <Combobox.List data-testid="list">{({ query }) => <Options query={query} />}</Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>
  );
}

function Harness(props: { root?: Partial<ComboboxMultipleProps>; required?: boolean }) {
  return (
    <>
      <input data-testid="before" aria-label="Before" />
      <Box {...props} />
      <input data-testid="after" aria-label="After" />
    </>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");
const chip = (code: string) => screen.getByTestId(`chip-${code}`);
const isOpen = () => popup().matches(":popover-open");
const chipTexts = () =>
  screen.queryAllByRole("listitem").map((el) => el.querySelector("span")?.textContent);

async function focusInput() {
  if (document.activeElement !== input()) await user.click(input());
  await flushFor();
}

describe("Combobox multiple (browser)", () => {
  it("a pick with the real keyboard toggles, clears the text and keeps the listbox open", async () => {
    const action = vi.fn<Action>();
    render(<Harness root={{ valueChangeAction: action }} />);
    await focusInput();
    await user.keyboard("ja");
    await settle(() => expect(screen.getByTestId("opt-jp")).toBeInTheDocument());
    await user.keyboard("{ArrowDown}{Enter}");
    await settle(() => expect(chipTexts()).toEqual(["Japan"]));
    expect(input().value).toBe("");
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(action.mock.calls[0]![1]).toMatchObject({ added: ["jp"], removed: [] });
  });

  for (const [label, keys, typed] of [
    ["a letter", "g", "g"],
    ["a shifted letter", "{Shift>}G{/Shift}", "G"],
    ["a digit", "7", "7"],
  ] as const) {
    it(`${label} on a focused chip is typed into the Input (focused in the keydown)`, async () => {
      render(<Harness root={{ defaultValue: ["jp", "fr"] }} />);
      await focusInput();
      await user.keyboard("{ArrowLeft}");
      await settle(() => expect(document.activeElement).toBe(chip("fr")));
      await user.keyboard(keys);
      await settle(() => expect(input().value).toBe(typed));
      expect(document.activeElement).toBe(input());
      await settle(() => expect(isOpen()).toBe(true));
      // The character went to the Input once, and nowhere else.
      expect(chipTexts()).toEqual(["jp", "fr"]);
    });
  }

  it("the inline-start arrow moves to the last chip and closes the listbox; the text is kept", async () => {
    const onOpenChange = vi.fn<(next: boolean, details: ComboboxOpenChangeDetails) => void>();
    render(<Harness root={{ defaultValue: ["jp", "fr"], onOpenChange }} />);
    await focusInput();
    await user.keyboard("j{ArrowLeft}");
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{ArrowLeft}");
    await settle(() => expect(document.activeElement).toBe(chip("fr")));
    await settle(() => expect(isOpen()).toBe(false));
    expect(onOpenChange.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "dismiss"]]);
    expect(input().value).toBe("j");
    expect(chip("fr").matches(":focus-visible")).toBe(true);
  });

  it("Tab from a chip goes on in document order (the Input) and keeps the text; Tab again leaves", async () => {
    render(<Harness root={{ defaultValue: ["jp", "fr"] }} />);
    await focusInput();
    await user.keyboard("zz{Home}{ArrowLeft}");
    await settle(() => expect(document.activeElement).toBe(chip("fr")));
    await user.tab();
    await settle(() => expect(document.activeElement).toBe(input()));
    expect(input().value).toBe("zz");
    await user.tab();
    await settle(() => expect(document.activeElement).toBe(screen.getByTestId("after")));
    await settle(() => expect(input().value).toBe(""));
  });

  it("Backspace and Delete on a chip remove it after moving focus", async () => {
    const action = vi.fn<Action>();
    render(<Harness root={{ defaultValue: ["jp", "jm", "fr"], valueChangeAction: action }} />);
    await focusInput();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{Delete}");
    await settle(() => expect(chipTexts()).toEqual(["jp", "fr"]));
    expect(document.activeElement).toBe(chip("fr"));
    await user.keyboard("{Backspace}");
    await settle(() => expect(chipTexts()).toEqual(["jp"]));
    expect(document.activeElement).toBe(chip("jp"));
    expect(action.mock.calls.map(([, d]) => d.removed)).toEqual([["jm"], ["fr"]]);
  });

  it("Escape on a chip inside a modal Dialog returns to the Input; the Dialog stays open", async () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger data-testid="dialog-trigger">Edit</Dialog.Trigger>
        <Dialog.Popup data-testid="dialog">
          <Dialog.Title>Edit</Dialog.Title>
          <Box root={{ defaultValue: ["jp"] }} />
        </Dialog.Popup>
      </Dialog.Root>,
    );
    await user.click(screen.getByTestId("dialog-trigger"));
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    await settle(() => expect(dialog.open).toBe(true));
    await focusInput();
    await user.keyboard("{ArrowLeft}");
    await settle(() => expect(document.activeElement).toBe(chip("jp")));
    await user.keyboard("{Escape}");
    await settle(() => expect(document.activeElement).toBe(input()));
    await quietPeriod(80, "the Dialog must not close");
    expect(dialog.open).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
  });

  it("a press on ChipRemove while open: light-dismissed ('dismiss'), the chip removed, focus kept, no re-open", async () => {
    const action = vi.fn<Action>();
    const onOpenChange = vi.fn<(next: boolean, details: ComboboxOpenChangeDetails) => void>();
    render(
      <Harness root={{ defaultValue: ["jp", "fr"], valueChangeAction: action, onOpenChange }} />,
    );
    await focusInput();
    await user.keyboard("j");
    await settle(() => expect(isOpen()).toBe(true));
    leaveActEnvironment();
    const atPress = await mouse.pressOn(screen.getByTestId("remove-fr"), {
      atPress: () => ({ open: isOpen(), focus: document.activeElement }),
    });
    // The press is prevented: the Input keeps focus; light dismiss runs at the release.
    expect(atPress).toEqual({ open: true, focus: input() });
    await expect.poll(() => isOpen()).toBe(false);
    await expect.poll(() => action.mock.calls.length).toBe(1);
    expect(action.mock.calls[0]![1]).toMatchObject({ removed: ["fr"], reason: "activate" });
    expect(action.mock.calls[0]![1].event?.type).toBe("click");
    await expect.poll(() => chipTexts()).toEqual(["Japan"]);
    expect(document.activeElement).toBe(input());
    await quietPeriod(80, "ChipRemove must not re-open the listbox");
    expect(isOpen()).toBe(false);
    expect(onOpenChange.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "dismiss"]]);
  });

  it("required: a submit while the removal of the last chip is pending is blocked by valueMissing", async () => {
    const save = deferred();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    function Form() {
      const [invalid, setInvalid] = useState(0);
      return (
        <form
          data-testid="form"
          onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}
          onInvalidCapture={() => setInvalid((n) => n + 1)}
        >
          <output data-testid="invalid">{invalid}</output>
          <Box required root={{ defaultValue: ["jp"], valueChangeAction: () => save.promise }} />
        </form>
      );
    }
    render(<Form />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(input().required).toBe(false);
    await user.click(screen.getByTestId("remove-jp"));
    await settle(() => expect(chipTexts()).toEqual([]));
    expect(input()).toHaveAttribute("data-pending", "");
    expect(input().required).toBe(true);
    expect(input().validity.valueMissing).toBe(true);
    await act(async () => form.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("invalid")).toHaveTextContent("1");

    // The rollback un-marks it: covered in jsdom; here the save resolves and it stays.
    await act(async () => save.resolve());
    expect(input().required).toBe(true);
  });

  it("formData posts one entry per value, in pick order", async () => {
    render(
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <Box root={{ defaultValue: ["fr"] }} />
      </form>,
    );
    await focusInput();
    await user.keyboard("ja");
    await settle(() => expect(screen.getByTestId("opt-jp")).toBeInTheDocument());
    await user.keyboard("{ArrowDown}{Enter}");
    await settle(() => expect(chipTexts()).toEqual(["France", "Japan"]));
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.getAll("countries")).toEqual(["fr", "jp"]);
  });

  it("the removal is announced with ariaNotify on the Input", async () => {
    const calls: { element: Element; message: string }[] = [];
    type Notifying = { ariaNotify(message: string, options?: object): void };
    const proto = Element.prototype as unknown as Notifying;
    if (supportsAriaNotify) {
      const original = proto.ariaNotify;
      vi.spyOn(proto, "ariaNotify").mockImplementation(function (
        this: Element,
        message: string,
        options?: object,
      ) {
        calls.push({ element: this, message });
        return original.call(this, message, options);
      });
    }
    render(<Harness root={{ defaultValue: ["jp", "fr"] }} />);
    await focusInput();
    await user.keyboard("{Backspace}");
    await settle(() => expect(chipTexts()).toEqual(["jp"]));
    if (!supportsAriaNotify) return;
    expect(calls).toContainEqual({ element: input(), message: "fr removed" });
  });

  it.runIf(browserName === "chromium")(
    "accessibility tree: a multiselectable listbox; the chips are list items with their position",
    async () => {
      render(<Harness root={{ defaultValue: ["jp", "fr"] }} />);
      await focusInput();
      await user.keyboard("j");
      await settle(() => expect(isOpen()).toBe(true));
      const listbox = await axNodeOf(screen.getByTestId("list"));
      expect(listbox.role?.value).toBe("listbox");
      expect(axProperty(listbox, "multiselectable")).toBe(true);
      const japan = await axNodeOf(screen.getByTestId("opt-jp"));
      expect(axProperty(japan, "selected")).toBe(true);
      const jamaica = await axNodeOf(screen.getByTestId("opt-jm"));
      expect(axProperty(jamaica, "selected")).toBe(false);
      const list = await axNodeOf(screen.getByTestId("chips"));
      expect(list.role?.value).toBe("list");
      expect(list.name?.value).toBe("Countries");
      const item = await axNodeOf(chip("fr"));
      expect(item.role?.value).toBe("listitem");
      expect(axProperty(item, "focusable")).toBe(true);
      // CDP lists no `posinset` / `setsize` for a list item (Chromium computes them in the
      // platform layer): whether a screen reader reads "2 of 2" is the manual pass.
      expect(axProperty(item, "posinset")).toBeUndefined();
    },
  );
});
