// MultiSelect rows that need a real engine (design/components/multi-select.md), on Chromium,
// Firefox and WebKit, including the checks B.16 leaves to the implementation:
//
// - The top layer: the listbox is `:popover-open`, anchored under the Trigger and at least as wide.
// - A mouse press on the Trigger focuses it in every engine (WebKit does not focus a button on a
//   press; the click handler does), and a press while the listbox is shown is no light dismiss
//   (the `popovertarget` exemption): the click closes it as `"activate"`.
// - Light dismiss, Escape (focus stays) and Escape inside a modal Dialog (the listbox first).
// - A foreign `popovertarget` invoker's close is an `"activate"` fact (the shared popup hook).
// - The real keyboard on a `<button>`: Space opens and toggles exactly once (no second toggle from
//   the button's own `keyup` activation), Enter toggles, Tab closes without toggling.
// - A `<label for>` press on the Trigger with the listbox open: light dismiss, then focus.
// - The validity element: a submit with nothing selected is blocked, `invalid` fires on the
//   hidden `<select>` and is cancelled (no browser bubble: Firefox kept the bubble of the hidden
//   element after the focus hand-over, over the listbox, where it swallowed the clicks on the
//   options; memo/developer/issue-165.md), focus arrives on the Trigger, and the options can be
//   clicked right after; a selection lets the form submit.
// - Chromium's accessibility tree (CDP): a combobox whose expanded state follows the shown listbox
//   with `popovertarget` and an explicit `aria-expanded`, a multiselectable listbox, `selected`.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axNodeOf, axProperty } from "../__tests__/ax-tree.js";
import { mouse } from "../__tests__/browser-commands.js";
import { flushFor, quietPeriod, settle } from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { onCleanup } from "../__tests__/browser-helpers.js";
import { browserName, supportsAriaNotify } from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { MultiSelect } from "./index.js";
import type {
  MultiSelectOpenChangeDetails,
  MultiSelectRootProps,
  MultiSelectValueChangeDetails,
} from "./index.js";

type Action = (next: string[], details: MultiSelectValueChangeDetails) => unknown;
type OpenHandler = (next: boolean, details: MultiSelectOpenChangeDetails) => void;

const TOPPINGS = [
  ["ham", "Ham"],
  ["olive", "Olive"],
  ["corn", "Corn"],
] as const;

const popupStyle = { margin: 0, inset: "auto", padding: 0, border: "1px solid" } as const;

function Box({ root }: { root?: Partial<MultiSelectRootProps> }) {
  return (
    <MultiSelect.Root name="toppings" {...root}>
      <MultiSelect.Label data-testid="label">Toppings</MultiSelect.Label>{" "}
      <MultiSelect.Trigger data-testid="trigger" style={{ width: 200, height: 30 }}>
        <MultiSelect.Value data-testid="value" placeholder="Choose" />
      </MultiSelect.Trigger>
      <MultiSelect.Popup data-testid="popup" style={popupStyle}>
        <MultiSelect.List data-testid="list">
          {TOPPINGS.map(([v, name]) => (
            <MultiSelect.Option key={v} value={v} data-testid={`opt-${v}`}>
              {name}
            </MultiSelect.Option>
          ))}
        </MultiSelect.List>
      </MultiSelect.Popup>
    </MultiSelect.Root>
  );
}

function Harness(props: { root?: Partial<MultiSelectRootProps> }) {
  return (
    <div style={{ padding: 20 }}>
      <button type="button" data-testid="before">
        Before
      </button>
      <div style={{ margin: "10px 0" }}>
        <Box {...props} />
      </div>
      <button type="button" data-testid="after">
        After
      </button>
      <div data-testid="outside" style={{ height: 200 }}>
        Outside
      </div>
    </div>
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const option = (v: string) => screen.getByTestId(`opt-${v}`);
const isOpen = () => popup().matches(":popover-open");
const shown = () => screen.getByTestId("value").textContent;
const activeOption = () => {
  const id = trigger().getAttribute("aria-activedescendant");
  return id === null ? null : document.getElementById(id);
};

describe("MultiSelect (browser)", () => {
  // #184: the ancestor <fieldset> becomes disabled while the listbox is shown. The options are
  // divs, so a click still reaches them; it must not dispatch on a Trigger that is now disabled.
  it("an option click after the ancestor fieldset is disabled dispatches nothing (#184)", async () => {
    const valueChangeAction = vi.fn<Action>();
    render(
      <fieldset data-testid="fieldset">
        <Box root={{ valueChangeAction }} />
      </fieldset>,
    );
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await act(async () => {
      (screen.getByTestId("fieldset") as HTMLFieldSetElement).disabled = true;
    });
    await flushFor();
    expect(trigger().matches(":disabled")).toBe(true);
    // The premise: Chromium, Firefox and WebKit all blur the disabled Trigger (focus goes to
    // <body>) and the listbox closes, so no option can be clicked. An engine that kept focus
    // on it (the HTML focus-fixup rule fires no blur) fails here: then #184's `:disabled` bail
    // in `toggle` is owed, with a row that clicks the option.
    await settle(() => {
      expect(document.activeElement).toBe(document.body);
      expect(isOpen()).toBe(false);
    });
    expect(valueChangeAction).not.toHaveBeenCalled();
    expect(shown()).toBe("Choose");
  });

  it("a click opens the listbox in the top layer under the Trigger, and focuses the Trigger", async () => {
    render(<Harness />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    // WebKit does not focus a button on a press; the click handler does (B.4).
    expect(document.activeElement).toBe(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(Math.abs(p.top - t.bottom)).toBeLessThan(2);
    expect(Math.abs(p.left - t.left)).toBeLessThan(2);
    expect(p.width).toBeGreaterThanOrEqual(t.width - 1);
    expect(activeOption()).toBe(option("ham"));
  });

  it("a press on the Trigger while open is no light dismiss: the click closes it as 'activate'", async () => {
    const openChangeAction = vi.fn<OpenHandler>();
    const onOpenChange = vi.fn<OpenHandler>();
    render(<Harness root={{ openChangeAction, onOpenChange }} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(false));
    expect(openChangeAction.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
      [true, "activate"],
      [false, "activate"],
    ]);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
    await quietPeriod(80, "the listbox must not re-open");
    expect(isOpen()).toBe(false);
  });

  it("a click on an option toggles it and keeps the listbox open and the focus on the Trigger", async () => {
    const action = vi.fn<Action>();
    render(<Harness root={{ valueChangeAction: action }} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(option("olive"));
    await settle(() => expect(shown()).toBe("Olive"));
    await user.click(option("ham"));
    await settle(() => expect(shown()).toBe("Olive, Ham"));
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(trigger());
    expect(action.mock.calls.map(([n]) => n)).toEqual([["olive"], ["olive", "ham"]]);
  });

  it("light dismiss and Escape close as 'dismiss' facts; focus stays on the Trigger after Escape", async () => {
    const onOpenChange = vi.fn<OpenHandler>();
    render(<Harness root={{ onOpenChange }} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(screen.getByTestId("outside"));
    await settle(() => expect(isOpen()).toBe(false));
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(document.activeElement).toBe(trigger());
    expect(onOpenChange.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
      [false, "dismiss"],
      [false, "dismiss"],
    ]);
  });

  it("a foreign popovertarget invoker's close is an 'activate' fact with the toggle event", async () => {
    const onOpenChange = vi.fn<OpenHandler>();
    const openChangeAction = vi.fn();
    render(<Harness root={{ onOpenChange, openChangeAction }} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    openChangeAction.mockClear();
    const foreign = screen.getByTestId("after");
    foreign.setAttribute("popovertarget", popup().id);
    onCleanup(() => foreign.removeAttribute("popovertarget"));
    // The click alone (no press): focus stays on the Trigger, so only the invoker closes it.
    await act(async () => foreign.click());
    await settle(() => expect(isOpen()).toBe(false));
    expect(openChangeAction).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    const [next, details] = onOpenChange.mock.calls[0]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event?.type).toBe("beforetoggle");
  });

  it("Space opens and toggles exactly once per press; Enter toggles; nothing closes", async () => {
    const action = vi.fn<Action>();
    render(<Harness root={{ valueChangeAction: action }} />);
    trigger().focus();
    await user.keyboard(" ");
    await settle(() => expect(isOpen()).toBe(true));
    expect(activeOption()).toBe(option("ham"));
    await quietPeriod(50, "the keyup must not activate the button");
    expect(action).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    await user.keyboard(" ");
    await settle(() => expect(shown()).toBe("Ham"));
    await user.keyboard("{ArrowDown}{Enter}");
    await settle(() => expect(shown()).toBe("Ham, Olive"));
    await quietPeriod(50, "no extra activation");
    expect(action).toHaveBeenCalledTimes(2);
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it("Space toggles the active option exactly once per press, also across key repeats of the release", async () => {
    const action = vi.fn<Action>();
    const clicks = vi.fn();
    render(<Harness root={{ valueChangeAction: action }} />);
    trigger().addEventListener("click", clicks);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await settle(() => expect(activeOption()).toBe(option("ham")));
    for (let i = 1; i <= 3; i++) {
      await user.keyboard(" ");
      await settle(() => expect(action).toHaveBeenCalledTimes(i));
    }
    await quietPeriod(80, "no click from the button's own Space activation");
    expect(action).toHaveBeenCalledTimes(3);
    expect(action.mock.calls.map(([, d]) => [d.added, d.removed])).toEqual([
      [["ham"], []],
      [[], ["ham"]],
      [["ham"], []],
    ]);
    // Space never reached the button's activation behaviour: no click, the listbox stayed open.
    expect(clicks).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  it("Tab closes the listbox and toggles nothing", async () => {
    const action = vi.fn<Action>();
    render(<Harness root={{ valueChangeAction: action }} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await settle(() => expect(activeOption()).toBe(option("ham")));
    await user.tab();
    await settle(() => expect(document.activeElement).toBe(screen.getByTestId("after")));
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).not.toHaveBeenCalled();
  });

  it("a Label press with the listbox open: light dismiss, then focus on the Trigger", async () => {
    const openChangeAction = vi.fn<OpenHandler>();
    const onOpenChange = vi.fn<OpenHandler>();
    render(<Harness root={{ openChangeAction, onOpenChange }} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    const label = screen.getByTestId("label");
    const { left, top, height } = label.getBoundingClientRect();
    // A long press: down, wait, up.
    await mouse.down(left + 4, top + height / 2);
    await flushFor(150);
    await mouse.up(left + 4, top + height / 2);
    await settle(() => expect(isOpen()).toBe(false));
    await settle(() => expect(document.activeElement).toBe(trigger()));
    await quietPeriod(80, "the forwarded click must not re-open the listbox");
    expect(isOpen()).toBe(false);
    expect(onOpenChange.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[false, "dismiss"]]);
    expect(openChangeAction.mock.calls.map(([n]) => n)).toEqual([true]);
  });

  it("Escape inside a modal Dialog closes the listbox first, then the Dialog", async () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger data-testid="dialog-trigger">Edit</Dialog.Trigger>
        <Dialog.Popup data-testid="dialog">
          <Dialog.Title>Edit</Dialog.Title>
          <Box />
        </Dialog.Popup>
      </Dialog.Root>,
    );
    await user.click(screen.getByTestId("dialog-trigger"));
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    await settle(() => expect(dialog.open).toBe(true));
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    await quietPeriod(80, "the Dialog must not close");
    expect(dialog.open).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
  });

  describe("the validity element (B.10, B.16)", () => {
    function RequiredForm({
      root,
      onSubmit,
    }: {
      root?: Partial<MultiSelectRootProps>;
      onSubmit: (data: FormData) => void;
    }) {
      const [invalid, setInvalid] = useState(0);
      return (
        <form
          data-testid="form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
          onInvalidCapture={() => setInvalid((n) => n + 1)}
        >
          <output data-testid="invalid">{invalid}</output>
          <Box root={{ required: true, ...root }} />
          <button type="submit" data-testid="submit">
            Save
          </button>
        </form>
      );
    }

    it("blocks a submit with nothing selected and hands focus to the Trigger", async () => {
      const onSubmit = vi.fn();
      render(<RequiredForm onSubmit={onSubmit} />);
      const select = trigger().nextElementSibling as HTMLSelectElement;
      expect(select.tagName).toBe("SELECT");
      expect(select.required).toBe(true);
      expect(select.willValidate).toBe(true);
      // Visually hidden: a 1px box, clipped, no pointer input (B.10).
      const s = select.getBoundingClientRect();
      expect(s.width).toBeLessThanOrEqual(1);
      expect(getComputedStyle(select).pointerEvents).toBe("none");
      const invalid: Event[] = [];
      select.addEventListener("invalid", (event) => invalid.push(event));
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(screen.getByTestId("invalid")).toHaveTextContent("1"));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(invalid).toHaveLength(1);
      expect(invalid[0]!.defaultPrevented).toBe(true);
      await settle(() => expect(document.activeElement).toBe(trigger()));
      expect(select.matches(":user-invalid")).toBe(true);
      // No bubble is in the way: the listbox opens under the Trigger and its options take clicks.
      await user.click(trigger());
      await settle(() => expect(isOpen()).toBe(true));
      await user.click(option("ham"));
      await settle(() => expect(shown()).toBe("Ham"));
      expect(select.required).toBe(false);
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0].getAll("toppings")).toEqual(["ham"]);
    });

    it("checkValidity() and reportValidity() report invalid without moving focus", async () => {
      render(<RequiredForm onSubmit={() => {}} />);
      const select = trigger().nextElementSibling as HTMLSelectElement;
      const submit = screen.getByTestId("submit");
      submit.focus();
      let result = true;
      act(() => {
        result = select.reportValidity();
      });
      expect(result).toBe(false);
      expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false);
      await quietPeriod(50, "focus must not move outside a submission attempt");
      expect(document.activeElement).toBe(submit);
    });

    it("a selection lets the form submit; the removal of the last value blocks it while pending", async () => {
      const save = deferred();
      const onSubmit = vi.fn();
      render(<RequiredForm root={{ valueChangeAction: () => save.promise }} onSubmit={onSubmit} />);
      await user.click(trigger());
      await settle(() => expect(isOpen()).toBe(true));
      await user.click(option("corn"));
      await settle(() => expect(shown()).toBe("Corn"));
      await act(async () => save.resolve());
      const form = screen.getByTestId("form") as HTMLFormElement;
      await act(async () => form.requestSubmit());
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0]![0].getAll("toppings")).toEqual(["corn"]);
    });
  });

  describe("inside Fields with Field.Error (B.10)", () => {
    it("a real submit focuses the first invalid control in document order", async () => {
      render(
        <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
          <Field.Root name="email">
            <Field.Label>Email</Field.Label>
            <Field.Control data-testid="email" required />
            <Field.Error />
          </Field.Root>
          <Field.Root name="toppings">
            <Field.Label>Toppings</Field.Label>
            <MultiSelect.Root required>
              <MultiSelect.Trigger data-testid="trigger">
                <MultiSelect.Value placeholder="Choose" />
              </MultiSelect.Trigger>
              <MultiSelect.Popup data-testid="popup" style={popupStyle}>
                <MultiSelect.List>
                  <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
                </MultiSelect.List>
              </MultiSelect.Popup>
            </MultiSelect.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit" data-testid="submit">
            Save
          </button>
        </form>,
      );
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(screen.getByTestId("error")).toBeInTheDocument());
      await settle(() => expect(document.activeElement).toBe(screen.getByTestId("email")));
      await quietPeriod(80, "focus must stay on the first invalid control");
      expect(document.activeElement).toBe(screen.getByTestId("email"));
    });

    it("one Field: focus moves to the Trigger and nothing is announced on top", async () => {
      const calls: string[] = [];
      type Notifying = { ariaNotify(message: string, options?: object): void };
      const proto = Element.prototype as unknown as Notifying;
      if (supportsAriaNotify) {
        vi.spyOn(proto, "ariaNotify").mockImplementation((message: string) => {
          calls.push(message);
        });
      } else {
        Object.defineProperty(Element.prototype, "ariaNotify", {
          configurable: true,
          value: (message: string) => calls.push(message),
        });
        onCleanup(() => {
          delete (Element.prototype as { ariaNotify?: unknown }).ariaNotify;
        });
      }
      render(
        <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
          <Field.Root name="toppings">
            <Field.Label>Toppings</Field.Label>
            <MultiSelect.Root required>
              <MultiSelect.Trigger data-testid="trigger">
                <MultiSelect.Value placeholder="Choose" />
              </MultiSelect.Trigger>
              <MultiSelect.Popup data-testid="popup" style={popupStyle}>
                <MultiSelect.List>
                  <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
                </MultiSelect.List>
              </MultiSelect.Popup>
            </MultiSelect.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit" data-testid="submit">
            Save
          </button>
        </form>,
      );
      await user.click(screen.getByTestId("submit"));
      await settle(() => expect(document.activeElement).toBe(trigger()));
      expect(screen.getByTestId("error")).toBeInTheDocument();
      await quietPeriod(80, "no second batch announces the browser message");
      expect(calls).toEqual([]);
    });
  });

  it.runIf(browserName === "chromium")(
    "accessibility tree: a combobox whose expanded state follows the listbox, a multiselectable listbox",
    async () => {
      render(<Harness root={{ defaultValue: ["olive"] }} />);
      const closed = await axNodeOf(trigger());
      expect(closed.role?.value).toBe("combobox");
      expect(closed.name?.value).toBe("Toppings");
      expect(axProperty(closed, "expanded")).toBe(false);
      await user.click(trigger());
      await settle(() => expect(isOpen()).toBe(true));
      const open = await axNodeOf(trigger());
      expect(axProperty(open, "expanded")).toBe(true);
      const listbox = await axNodeOf(screen.getByTestId("list"));
      expect(listbox.role?.value).toBe("listbox");
      expect(axProperty(listbox, "multiselectable")).toBe(true);
      expect(axProperty(await axNodeOf(option("olive")), "selected")).toBe(true);
      expect(axProperty(await axNodeOf(option("ham")), "selected")).toBe(false);
      // The validity element is out of the tree (aria-hidden): no node for it is exposed.
      await user.keyboard("{Escape}");
      await settle(() => expect(isOpen()).toBe(false));
      const again = await axNodeOf(trigger());
      expect(axProperty(again, "expanded")).toBe(false);
    },
  );
});
