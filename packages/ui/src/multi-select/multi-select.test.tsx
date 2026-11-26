// MultiSelect (design/components/multi-select.md), jsdom. The value contract (pending,
// optimistic, rejections, overlap and the replay of resolved changes, controlled veto, details)
// runs through the shared value-action suite with the driver in __tests__/drivers/multi-select.tsx;
// this file covers what is MultiSelect's own: the markup and ARIA, open and close, a pick that
// toggles and keeps the listbox open, the keys and typeahead, the initial active option, options
// that suspend on open, the Value part, the Label, the hidden inputs, `required`, form reset,
// `disabled`, Field, and the Select `multiple` warning.
//
// In multi-select.browser.test.tsx instead: the top layer and light dismiss, the Trigger's press
// while open, the validity element in each engine (blocked submit, focus hand-over), the real
// keyboard (Space on a button), anchoring.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { multiSelectDriver } from "../__tests__/drivers/multi-select.js";
import {
  createSuspender,
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
import { Select } from "../select/index.js";
import { MultiSelect } from "./index.js";
import type {
  MultiSelectOpenChangeDetails,
  MultiSelectRootProps,
  MultiSelectRootState,
  MultiSelectValueChangeDetails,
} from "./index.js";

describeValueAction(multiSelectDriver);

type Action = (next: string[], details: MultiSelectValueChangeDetails) => unknown;

const TOPPINGS = [
  { value: "ham", name: "Ham" },
  { value: "olive", name: "Olive" },
  { value: "corn", name: "Corn" },
  { value: "onion", name: "Onion" },
] as const;

function Options({ disabled = [] }: { disabled?: readonly string[] }) {
  return TOPPINGS.map((t) => (
    <MultiSelect.Option
      key={t.value}
      value={t.value}
      disabled={disabled.includes(t.value)}
      data-testid={`opt-${t.value}`}
    >
      {t.name}
    </MultiSelect.Option>
  ));
}

interface HarnessProps {
  root?: Partial<MultiSelectRootProps>;
  value?: ReactNode;
  list?: ReactNode;
  boundary?: (error: unknown) => void;
  disabledOptions?: readonly string[];
}

function Box({ root, value, list, disabledOptions }: HarnessProps) {
  return (
    <MultiSelect.Root {...root}>
      <MultiSelect.Label data-testid="label">Toppings</MultiSelect.Label>
      <MultiSelect.Trigger data-testid="trigger">
        {value ?? <MultiSelect.Value data-testid="value" placeholder="Choose toppings" />}
      </MultiSelect.Trigger>
      <MultiSelect.Popup data-testid="popup">
        <MultiSelect.List data-testid="list">
          {list ?? <Options disabled={disabledOptions} />}
        </MultiSelect.List>
        <MultiSelect.Empty>No toppings</MultiSelect.Empty>
      </MultiSelect.Popup>
    </MultiSelect.Root>
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
      <input data-testid="next" aria-label="Next" />
    </form>
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const list = () => screen.getByTestId("list");
const option = (v: string) => screen.getByTestId(`opt-${v}`);
const isOpen = () => popup().matches(":popover-open");
const shown = () => screen.getByTestId("value").textContent;
const activeValue = () => {
  const id = trigger().getAttribute("aria-activedescendant");
  return id === null ? null : (document.getElementById(id)?.getAttribute("data-testid") ?? "?");
};
const formValues = () =>
  new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("toppings");
const validity = () => trigger().nextElementSibling as HTMLSelectElement;

async function openWithClick(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flushTasks(2);
}

describe("MultiSelect (jsdom)", () => {
  describe("markup and ARIA (B.1, B.9)", () => {
    it("renders a button combobox, a multiselectable listbox and one hidden input per value", async () => {
      const user = setupUser();
      render(<Harness root={{ name: "toppings", defaultValue: ["ham", "olive"] }} />);
      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("role", "combobox");
      expect(t).toHaveAttribute("aria-expanded", "false");
      expect(t).toHaveAttribute("aria-controls", expect.stringMatching(/-list$/));
      expect(t).not.toHaveAttribute("aria-activedescendant");
      expect(t).not.toHaveAttribute("aria-required");
      expect(t).not.toHaveAttribute("aria-haspopup");
      expect(t).toHaveAttribute("popovertarget", popup().id);
      expect(t).toHaveAccessibleName("Toppings");
      expect(screen.getByTestId("label")).toHaveAttribute("for", t.id);
      expect(popup()).toHaveAttribute("popover", "auto");
      // The values are shown raw until their options were seen (B.7).
      expect(shown()).toBe("ham, olive");
      expect(formValues()).toEqual(["ham", "olive"]);
      expect(t.nextElementSibling?.tagName).not.toBe("SELECT");

      await openWithClick(user);
      expect(isOpen()).toBe(true);
      expect(t).toHaveAttribute("aria-expanded", "true");
      expect(t).toHaveAttribute("data-open", "");
      expect(t).toHaveAttribute("aria-controls", list().id);
      expect(list()).toHaveAttribute("role", "listbox");
      expect(list()).toHaveAttribute("aria-multiselectable", "true");
      expect(list()).toHaveAttribute("aria-labelledby", screen.getByTestId("label").id);
      expect(list()).not.toHaveAttribute("aria-busy");
      for (const t of TOPPINGS) {
        expect(option(t.value)).toHaveAttribute("role", "option");
        expect(option(t.value)).toHaveAttribute(
          "aria-selected",
          String(["ham", "olive"].includes(t.value)),
        );
      }
      expect(option("ham")).toHaveAttribute("data-selected", "");
      expect(option("corn")).not.toHaveAttribute("data-selected");
      // The labels are learnt from the mounted options.
      expect(shown()).toBe("Ham, Olive");
      expect(screen.queryByText("No toppings")).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it("keeps one nameless hidden input while empty and shows the placeholder", () => {
      render(<Harness root={{ name: "toppings" }} />);
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
      expect(inputs).toHaveLength(1);
      expect(inputs[0]!.name).toBe("");
      expect(formValues()).toEqual([]);
      expect(shown()).toBe("Choose toppings");
      expect(screen.getByTestId("value")).toHaveAttribute("data-placeholder", "");
    });

    it("server-renders no popovertarget, the Value and the validity element", () => {
      const html = renderToString(
        <MultiSelect.Root name="toppings" defaultValue={["ham"]} required>
          <MultiSelect.Label>Toppings</MultiSelect.Label>
          <MultiSelect.Trigger>
            <MultiSelect.Value>
              {({ value }) => value.map((v) => v.toUpperCase())}
            </MultiSelect.Value>
          </MultiSelect.Trigger>
          <MultiSelect.Popup>
            <MultiSelect.List>
              <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>,
      );
      expect(html).not.toContain("popovertarget");
      expect(html).toContain('role="combobox"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-required="true"');
      expect(html).toContain("HAM");
      expect(html).toContain('<input type="hidden" name="toppings" value="ham"/>');
      expect(html).toMatch(/<select tabindex="-1" aria-hidden="true"[^>]*>/);
      // The default selection is not empty: the validity element is not required.
      expect(html).not.toMatch(/<select[^>]* required/);
      // The children render only while open.
      expect(html).not.toContain('role="option"');
    });

    it("warns in development when the Trigger has no name", async () => {
      const errors = silenceErrors();
      render(
        <MultiSelect.Root>
          <MultiSelect.Trigger />
          <MultiSelect.Popup>
            <MultiSelect.List aria-label="x" />
          </MultiSelect.Popup>
        </MultiSelect.Root>,
      );
      await flushTasks();
      expect(errors.mock.calls.map((c) => String(c[0]))).toContainEqual(
        expect.stringContaining("MultiSelect.Trigger: the combobox has no accessible name"),
      );
    });
  });

  describe("open and close (B.4)", () => {
    it("the Trigger toggles the listbox through openChangeAction; Escape is a fact", async () => {
      const user = setupUser();
      const openChangeAction = vi.fn<(next: boolean, d: MultiSelectOpenChangeDetails) => void>();
      const onOpenChange = vi.fn<(next: boolean, d: MultiSelectOpenChangeDetails) => void>();
      render(<Harness root={{ openChangeAction, onOpenChange }} />);
      await openWithClick(user);
      expect(isOpen()).toBe(true);
      expect(openChangeAction).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ reason: "activate" }),
      );
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(openChangeAction).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "activate" }),
      );
      expect(onOpenChange).not.toHaveBeenCalled();

      await openWithClick(user);
      // A dismissal (Escape, light dismiss: the platform's, see the browser tests).
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
      expect(document.activeElement).toBe(trigger());
    });

    it("Alt+ArrowUp closes without toggling; Tab closes without toggling", async () => {
      const user = setupUser();
      const action = vi.fn<Action>();
      const onOpenChange = vi.fn();
      render(<Harness root={{ valueChangeAction: action, onOpenChange }} />);
      trigger().focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(activeValue()).toBe("opt-ham");
      await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(action).not.toHaveBeenCalled();

      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-ham");
      await user.tab();
      await flushTasks(2);
      expect(document.activeElement).toBe(screen.getByTestId("next"));
      expect(isOpen()).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
      expect(action).not.toHaveBeenCalled();
    });

    it("the Label focuses the Trigger and does not open the listbox", async () => {
      const user = setupUser();
      const openChangeAction = vi.fn();
      render(<Harness root={{ openChangeAction }} />);
      await user.click(screen.getByTestId("label"));
      await flushTasks(2);
      expect(document.activeElement).toBe(trigger());
      expect(isOpen()).toBe(false);
      expect(openChangeAction).not.toHaveBeenCalled();
    });

    it("an open held by a slow openChangeAction shows data-pending on the Trigger", async () => {
      const user = setupUser();
      const gate = deferred();
      render(<Harness root={{ openChangeAction: () => gate.promise }} />);
      await user.click(trigger());
      expectPending(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(isOpen()).toBe(false);
      await act(async () => gate.resolve());
      await flushTasks(2);
      expectNotPending(trigger());
      expect(isOpen()).toBe(true);
    });
  });

  describe("a pick (B.5)", () => {
    it("toggles with a click and Enter / Space, keeps the listbox open and the focus", async () => {
      const user = setupUser();
      const action = vi.fn<Action>();
      render(<Harness root={{ name: "toppings", valueChangeAction: action }} />);
      await openWithClick(user);
      await user.click(option("olive"));
      expect(action).toHaveBeenLastCalledWith(
        ["olive"],
        expect.objectContaining({ reason: "activate", added: ["olive"], removed: [] }),
      );
      expect(action.mock.lastCall![1].event?.type).toBe("click");
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(trigger());
      expect(activeValue()).toBe("opt-olive");
      expect(shown()).toBe("Olive");

      await user.keyboard("{ArrowUp}");
      expect(activeValue()).toBe("opt-ham");
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenLastCalledWith(
        ["olive", "ham"],
        expect.objectContaining({ added: ["ham"], removed: [] }),
      );
      expect(action.mock.lastCall![1].event?.type).toBe("keydown");
      // Pick order (B.6).
      expect(shown()).toBe("Olive, Ham");
      expect(formValues()).toEqual(["olive", "ham"]);
      await user.keyboard(" ");
      expect(action).toHaveBeenLastCalledWith(
        ["olive"],
        expect.objectContaining({ added: [], removed: ["ham"] }),
      );
      expect(isOpen()).toBe(true);
      expect(option("ham")).toHaveAttribute("aria-selected", "false");
    });

    it("never toggles a disabled option; Enter with no active option does nothing", async () => {
      const user = setupUser();
      const action = vi.fn<Action>();
      render(<Harness root={{ valueChangeAction: action }} disabledOptions={["olive"]} />);
      trigger().focus();
      await user.keyboard("{Home}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-ham");
      await user.click(option("olive"));
      expect(action).not.toHaveBeenCalled();
      expect(option("olive")).toHaveAttribute("aria-disabled", "true");
      expect(document.activeElement).toBe(trigger());
      // The arrows skip it.
      await user.keyboard("{ArrowDown}");
      expect(activeValue()).toBe("opt-corn");
    });

    it("a rejection rolls back that pick only; the listbox, the active option and focus stay", async () => {
      const user = setupUser();
      const errors = silenceErrors();
      const first = deferred();
      const second = deferred();
      const calls = [first, second];
      const boundary = vi.fn();
      render(
        <Harness
          root={{ name: "toppings", valueChangeAction: () => calls.shift()!.promise }}
          boundary={boundary}
        />,
      );
      await openWithClick(user);
      await user.click(option("ham"));
      await user.click(option("olive"));
      expect(shown()).toBe("Ham, Olive");
      expectPending(option("ham"));
      expectPending(option("olive"));
      expectPending(trigger());
      await act(async () => second.resolve());
      expectPending(trigger());
      await act(async () => first.reject(new Error("ham failed")));
      await flushTasks(2);
      expect(shown()).toBe("Olive");
      expect(option("ham")).toHaveAttribute("aria-selected", "false");
      expectNotPending(trigger());
      expect(isOpen()).toBe(true);
      expect(activeValue()).toBe("opt-olive");
      expect(document.activeElement).toBe(trigger());
      // Superseded: reported, not thrown to the boundary.
      expect(boundary).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it("a dismissal while a pick is pending closes at once; the pick still commits", async () => {
      const user = setupUser();
      const gate = deferred();
      render(<Harness root={{ valueChangeAction: () => gate.promise }} />);
      await openWithClick(user);
      await user.click(option("corn"));
      act(() => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expectPending(trigger());
      await act(async () => gate.resolve());
      expect(shown()).toBe("Corn");
      expectNotPending(trigger());
    });
  });

  describe("keyboard (B.8)", () => {
    it("opens on Enter / Space / ArrowDown at the first selected option, else the first one", async () => {
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["corn", "olive"] }} />);
      trigger().focus();
      for (const key of ["{Enter}", " ", "{ArrowDown}", "{Alt>}{ArrowDown}{/Alt}"]) {
        await user.keyboard(key);
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        // Document order, not pick order.
        expect(activeValue()).toBe("opt-olive");
        act(() => popup().hidePopover());
        await flushTasks(2);
      }
    });

    it("opens on ArrowUp at the first selected option, else the last; Home / End at the edges", async () => {
      const user = setupUser();
      render(<Harness disabledOptions={["onion"]} />);
      trigger().focus();
      await user.keyboard("{ArrowUp}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-corn");
      act(() => popup().hidePopover());
      await flushTasks(2);
      await user.keyboard("{Home}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-ham");
      act(() => popup().hidePopover());
      await flushTasks(2);
      await user.keyboard("{End}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-corn");
    });

    it("moves with the arrows, Home / End and PageUp / PageDown; stays at the ends unless loop", async () => {
      const user = setupUser();
      const { unmount } = render(<Harness />);
      trigger().focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(activeValue()).toBe("opt-ham");
      await user.keyboard("{ArrowUp}");
      expect(activeValue()).toBe("opt-ham");
      await user.keyboard("{End}");
      expect(activeValue()).toBe("opt-onion");
      await user.keyboard("{ArrowDown}");
      expect(activeValue()).toBe("opt-onion");
      await user.keyboard("{PageUp}");
      expect(activeValue()).toBe("opt-ham");
      await user.keyboard("{PageDown}");
      expect(activeValue()).toBe("opt-onion");
      await user.keyboard("{Home}");
      expect(activeValue()).toBe("opt-ham");
      unmount();

      render(<Harness root={{ loop: true }} />);
      trigger().focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      await user.keyboard("{ArrowUp}");
      expect(activeValue()).toBe("opt-onion");
      await user.keyboard("{ArrowDown}");
      expect(activeValue()).toBe("opt-ham");
    });

    it("typeahead opens at the match, cycles on a repeated letter, and Space joins a live buffer", async () => {
      const user = setupUser();
      const action = vi.fn<Action>();
      render(
        <Harness
          root={{ valueChangeAction: action }}
          list={
            <>
              <MultiSelect.Option value="a" data-testid="opt-a">
                Green olive
              </MultiSelect.Option>
              <MultiSelect.Option value="b" data-testid="opt-b">
                Green pepper
              </MultiSelect.Option>
              <MultiSelect.Option value="c" data-testid="opt-c" label="Garlic">
                <span aria-hidden>🧄</span> Garlic
              </MultiSelect.Option>
              <MultiSelect.Option value="d" data-testid="opt-d">
                Ham
              </MultiSelect.Option>
            </>
          }
        />,
      );
      trigger().focus();
      await user.keyboard("h");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(activeValue()).toBe("opt-d");
      expect(action).not.toHaveBeenCalled();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.advanceTimersByTime(600);
        await user.keyboard("g");
        expect(activeValue()).toBe("opt-a");
        await user.keyboard("g");
        expect(activeValue()).toBe("opt-b");
        await user.keyboard("g");
        // The `label` prop is the typeahead text.
        expect(activeValue()).toBe("opt-c");
        vi.advanceTimersByTime(600);
        await user.keyboard("green p");
        expect(activeValue()).toBe("opt-b");
        // Space was part of the buffer: nothing toggled.
        expect(action).not.toHaveBeenCalled();
        vi.advanceTimersByTime(600);
        await user.keyboard(" ");
        expect(action).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("ignores Ctrl / Meta chords and does nothing while disabled", async () => {
      const user = setupUser();
      const { unmount } = render(<Harness />);
      trigger().focus();
      await user.keyboard("{Control>}{ArrowDown}{/Control}{Meta>}a{/Meta}");
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      unmount();
      render(<Harness root={{ disabled: true }} />);
      expect(trigger()).toBeDisabled();
      expect(trigger()).toHaveAttribute("data-disabled", "");
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
    });

    it("pointermove makes an enabled option active", async () => {
      const user = setupUser();
      render(<Harness disabledOptions={["corn"]} />);
      await openWithClick(user);
      fireEvent.pointerMove(option("olive"));
      expect(activeValue()).toBe("opt-olive");
      fireEvent.pointerMove(option("corn"));
      expect(activeValue()).toBe("opt-olive");
      await user.keyboard("{ArrowDown}");
      expect(activeValue()).toBe("opt-onion");
    });
  });

  describe("options that suspend on open (B.4, B.11 walkthrough 1)", () => {
    it("shows Status, marks the list busy, then activates the first selected option once loaded", async () => {
      const user = setupUser();
      const suspender = createSuspender();
      function Loaded() {
        return (
          <>
            <suspender.Suspender value="toppings" />
            <Options />
          </>
        );
      }
      render(
        <Harness
          root={{ defaultValue: ["corn"] }}
          list={
            <Suspense fallback={<MultiSelect.Status>Loading…</MultiSelect.Status>}>
              <Loaded />
            </Suspense>
          }
        />,
      );
      trigger().focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(list()).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Loading…")).toHaveAttribute("role", "none");
      expect(screen.queryByText("No toppings")).toBeNull();
      expect(activeValue()).toBeNull();
      await act(async () => suspender.resolve("toppings"));
      await flushTasks(2);
      expect(list()).not.toHaveAttribute("aria-busy");
      expect(activeValue()).toBe("opt-corn");
      expect(shown()).toBe("Corn");
    });

    it("shows Empty when the list has no option", async () => {
      const user = setupUser();
      render(<Harness list={<></>} />);
      await openWithClick(user);
      expect(screen.getByText("No toppings")).toBeInTheDocument();
      expect(list()).toHaveAttribute("data-empty", "");
    });
  });

  describe("Value (B.7)", () => {
    it("renders function children from the optimistic value with the labels it has seen", async () => {
      const user = setupUser();
      const seen: (readonly (string | undefined)[])[] = [];
      render(
        <Harness
          root={{ defaultValue: ["ham"] }}
          value={
            <MultiSelect.Value data-testid="value">
              {({ value, labels }) => {
                seen.push(labels);
                return value.length === 0 ? "Any" : `${value.length} toppings`;
              }}
            </MultiSelect.Value>
          }
        />,
      );
      expect(shown()).toBe("1 toppings");
      expect(seen.at(-1)).toEqual([undefined]);
      await openWithClick(user);
      expect(seen.at(-1)).toEqual(["Ham"]);
      await user.click(option("ham"));
      expect(shown()).toBe("Any");
      expect(screen.getByTestId("value")).toHaveAttribute("data-placeholder", "");
    });

    it("the Root's and the Trigger's function children receive the state", async () => {
      const user = setupUser();
      const states: MultiSelectRootState[] = [];
      render(
        <MultiSelect.Root defaultValue={["ham"]}>
          {(state) => {
            states.push(state);
            return (
              <>
                <MultiSelect.Trigger aria-label="Toppings" data-testid="trigger">
                  {({ value, open }) => `${value.join("+")}:${open ? "open" : "closed"}`}
                </MultiSelect.Trigger>
                <MultiSelect.Popup data-testid="popup">
                  <MultiSelect.List aria-label="Toppings">
                    <Options />
                  </MultiSelect.List>
                </MultiSelect.Popup>
              </>
            );
          }}
        </MultiSelect.Root>,
      );
      expect(trigger()).toHaveTextContent("ham:closed");
      await openWithClick(user);
      expect(trigger()).toHaveTextContent("ham:open");
      expect(states.at(-1)).toMatchObject({ value: ["ham"], open: true, disabled: false });
    });
  });

  describe("form (B.10)", () => {
    it("required: the validity element is required only while the optimistic value is empty", async () => {
      const user = setupUser();
      const gate = deferred();
      // A controlled parent that never adopts the removal: the optimistic value rolls back.
      render(
        <Harness
          root={{
            name: "toppings",
            required: true,
            value: ["ham"],
            valueChangeAction: () => gate.promise,
          }}
        />,
      );
      expect(trigger()).toHaveAttribute("aria-required", "true");
      const select = validity();
      expect(select.tagName).toBe("SELECT");
      expect(select).toHaveAttribute("tabindex", "-1");
      expect(select).toHaveAttribute("aria-hidden", "true");
      expect(select).not.toHaveAttribute("name");
      expect(select).not.toBeRequired();
      expect(select.options).toHaveLength(1);
      expect(trigger().style.getPropertyValue("anchor-name")).toMatch(/^--fsui-multi-select-/);
      expect(select.style.getPropertyValue("position-anchor")).toBe(
        trigger().style.getPropertyValue("anchor-name"),
      );
      await openWithClick(user);
      await user.click(option("ham"));
      // Optimistic: required at once, before the removal commits (B.11 walkthrough 5).
      expect(select).toBeRequired();
      expect(select.validity.valueMissing).toBe(true);
      expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false);
      await act(async () => gate.resolve());
      await flushTasks(2);
      expect(select).not.toBeRequired();
      expect(formValues()).toEqual(["ham"]);
    });

    it("the validity element passes focus to the Trigger", () => {
      render(<Harness root={{ required: true }} />);
      act(() => validity().focus());
      expect(document.activeElement).toBe(trigger());
    });

    it("a form reset dispatches the reset target whole with reason platform", async () => {
      const user = setupUser();
      const action = vi.fn<Action>();
      render(
        <Harness root={{ name: "toppings", defaultValue: ["ham"], valueChangeAction: action }} />,
      );
      await openWithClick(user);
      await user.click(option("olive"));
      await user.click(option("ham"));
      expect(formValues()).toEqual(["olive"]);
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).reset();
      });
      await flushTasks(2);
      expect(formValues()).toEqual(["ham"]);
      expect(action).toHaveBeenLastCalledWith(
        ["ham"],
        expect.objectContaining({ reason: "platform", added: ["ham"], removed: ["olive"] }),
      );
      expect(action.mock.lastCall![1].event?.type).toBe("reset");
    });

    it("a form reset during a save keeps the reset (B.11 walkthrough 6)", async () => {
      const user = setupUser();
      const gate = deferred();
      const calls: MultiSelectValueChangeDetails[] = [];
      render(
        <Harness
          root={{
            name: "toppings",
            defaultValue: ["ham"],
            valueChangeAction: (_n, d) => {
              calls.push(d);
              return calls.length === 1 ? gate.promise : undefined;
            },
          }}
        />,
      );
      await openWithClick(user);
      await user.click(option("olive"));
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).reset();
      });
      await flushTasks(2);
      expect(calls[1]).toMatchObject({ reason: "platform", removed: ["olive"] });
      await act(async () => gate.resolve());
      expect(formValues()).toEqual(["ham"]);
    });

    it("works without name: the reset listener follows the Trigger's form", async () => {
      const user = setupUser();
      render(<Harness root={{ defaultValue: ["corn"] }} />);
      await openWithClick(user);
      await user.click(option("ham"));
      expect(shown()).toBe("Corn, Ham");
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).reset();
      });
      await flushTasks(2);
      expect(shown()).toBe("Corn");
    });

    it("disabled: the Trigger is natively disabled and the hidden inputs still post", () => {
      render(<Harness root={{ name: "toppings", defaultValue: ["ham"], disabled: true }} />);
      expect(trigger()).toBeDisabled();
      expect(formValues()).toEqual(["ham"]);
    });

    it("controlled, update on success with a functional update of the diff", async () => {
      const user = setupUser();
      function Controlled() {
        const [toppings, setToppings] = useState<string[]>(["ham"]);
        return (
          <Harness
            root={{
              name: "toppings",
              value: toppings,
              valueChangeAction: async (_next, { added, removed }) => {
                await Promise.resolve();
                startTransition(() =>
                  setToppings((prev) => [
                    ...prev.filter((v) => !removed.includes(v)),
                    ...added.filter((v) => !prev.includes(v)),
                  ]),
                );
              },
            }}
          />
        );
      }
      render(<Controlled />);
      await openWithClick(user);
      await user.click(option("olive"));
      await user.click(option("ham"));
      await flushTasks(2);
      expect(formValues()).toEqual(["olive"]);
    });
  });

  describe("Field (B.10)", () => {
    it("the Trigger is the Field's control; Field.Label focuses it without opening", async () => {
      const user = setupUser();
      render(
        <form data-testid="form">
          <Field.Root name="toppings" required>
            <Field.Label data-testid="field-label">Toppings</Field.Label>
            <MultiSelect.Root>
              <MultiSelect.Trigger data-testid="trigger">
                <MultiSelect.Value />
              </MultiSelect.Trigger>
              <MultiSelect.Popup data-testid="popup">
                <MultiSelect.List data-testid="list">
                  <Options />
                </MultiSelect.List>
              </MultiSelect.Popup>
            </MultiSelect.Root>
            <Field.Description>Pick one or more.</Field.Description>
            <Field.Error data-testid="error" />
          </Field.Root>
        </form>,
      );
      const t = trigger();
      expect(screen.getByTestId("field-label")).toHaveAttribute("for", t.id);
      expect(t).toHaveAccessibleName("Toppings");
      expect(t).toHaveAccessibleDescription("Pick one or more.");
      expect(t).toHaveAttribute("aria-invalid", "false");
      expect(t).toHaveAttribute("aria-required", "true");
      expect(validity()).toBeRequired();
      await user.click(screen.getByTestId("field-label"));
      await flushTasks(2);
      expect(document.activeElement).toBe(t);
      expect(isOpen()).toBe(false);
      await openWithClick(user);
      expect(list()).toHaveAttribute("aria-labelledby", screen.getByTestId("field-label").id);
    });

    it("a submit with nothing selected shows Field.Error and focuses the Trigger", async () => {
      const onSubmit = vi.fn((e: Event) => e.preventDefault());
      render(
        <form data-testid="form" onSubmit={(e) => onSubmit(e.nativeEvent)}>
          <Field.Root name="toppings">
            <Field.Label>Toppings</Field.Label>
            <MultiSelect.Root required>
              <MultiSelect.Trigger data-testid="trigger">
                <MultiSelect.Value />
              </MultiSelect.Trigger>
              <MultiSelect.Popup data-testid="popup">
                <MultiSelect.List>
                  <Options />
                </MultiSelect.List>
              </MultiSelect.Popup>
            </MultiSelect.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Save</button>
        </form>,
      );
      const invalid = vi.fn();
      validity().addEventListener("invalid", invalid);
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
      });
      await flushTasks(2);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(invalid).toHaveBeenCalled();
      // The Field cancelled the bubble and shows the message itself.
      expect(invalid.mock.calls[0]![0].defaultPrevented).toBe(true);
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("aria-invalid", "true");
      expect(trigger()).toHaveAttribute("data-invalid", "");
      expect(document.activeElement).toBe(trigger());
    });
  });

  describe("Select.Root multiple", () => {
    it("warns in development, names MultiSelect and renders a single select", () => {
      const errors = silenceErrors();
      render(
        <Select.Root
          aria-label="Fruit"
          data-testid="select"
          // @ts-expect-error `multiple` is not part of Select (MultiSelect is)
          multiple
        >
          <Select.Option value="a">Apple</Select.Option>
        </Select.Root>,
      );
      expect(screen.getByTestId("select")).not.toHaveAttribute("multiple");
      const messages = errors.mock.calls.map((c) => String(c[0]));
      expect(messages.filter((m) => m.startsWith("Select.Root: `multiple`"))).toHaveLength(1);
      expect(messages.find((m) => m.startsWith("Select.Root: `multiple`"))).toContain(
        "@funstack/ui/multi-select",
      );
    });
  });
});
