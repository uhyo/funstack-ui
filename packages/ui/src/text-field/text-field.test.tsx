// TextField tests (jsdom), mapped to design/components/text-field.md section 14. The rows of the
// value-action suite (sync and async commits, pending, rejection, overlap, superseded rejections,
// suspending content, the post-await rule, a controlled veto, details, dev warnings) and of the
// native platform suite (mount reconciliation, form reset, React's reset after a form action)
// come from the shared suites with the driver __tests__/drivers/text-field.tsx; the rows here are
// the component's own: the draft, the commit keys (the textarea's Ctrl+Enter / Cmd+Enter too),
// Escape, Field and Form.
//
// Covered by text-field.browser.test.tsx instead: real keys outside `act` inside a Field (#193),
// a real reset click (#185), Escape in a modal Dialog and an `auto` Popover, real blurs, the IME
// rows (Chromium, CDP), `startViewTransition` never called.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { field, textFieldDriver } from "../__tests__/drivers/text-field.js";
import {
  deferred,
  expectNotPending,
  expectPending,
  flushMicrotasks,
  flushTasks,
  hydrateFromServer,
  renderBoth,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { describeNativeGroupPlatform } from "../__tests__/native-group-platform-suite.js";
import { describeValueAction } from "../__tests__/value-action-suite.js";
import { Dialog } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { isEscapeRequest } from "../internal/escape-key.js";
import { TextField } from "./index.js";
import type { TextFieldProps, TextFieldState, TextFieldValueCommitDetails } from "./index.js";

type Fn = (next: string, details: TextFieldValueCommitDetails) => unknown;

describeValueAction(textFieldDriver);
describeNativeGroupPlatform(textFieldDriver);

// --- Helpers -------------------------------------------------------------------------------------

/** Types `text` as the browser would: one `input` event with the new DOM value. */
function typeText(text: string, target: Element = field()): void {
  act(() => {
    fireEvent.change(target, { target: { value: text } });
  });
}

function blur(target: Element = field()): void {
  act(() => {
    fireEvent.blur(target);
  });
}

/** A cancelable, bubbling `keydown` at `target`; returns the event. */
function key(k: string, init: KeyboardEventInit = {}, target: Element = field()): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/**
 * Uncontrolled from `initial`, or a controlled parent that adopts after the action (the update on
 * success pattern); `<output data-testid="committed">` mirrors the parent's value.
 */
function Harness({
  mode,
  initial = "Draft",
  action,
  veto = false,
  ...props
}: Omit<TextFieldProps, "value" | "defaultValue" | "valueCommitAction"> & {
  mode: ControlMode;
  initial?: string;
  action?: Fn;
  veto?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TextField
        aria-label="Title"
        {...(mode === "controlled" ? { value } : { defaultValue: initial })}
        valueCommitAction={async (next, details) => {
          await action?.(next, details);
          if (!veto) startTransition(() => setValue(next));
        }}
        {...props}
      />
      <output data-testid="committed">{value}</output>
    </>
  );
}

const committed = () => screen.getByTestId("committed").textContent;

// --- Roles and ARIA ------------------------------------------------------------------------------

describe("TextField", () => {
  describe("roles and ARIA", () => {
    it("renders one input[type=text] with the value and nothing the consumer did not pass", () => {
      const { container } = render(<TextField aria-label="Title" defaultValue="Draft" />);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      expect(container.children).toHaveLength(1);
      expect(input).toBe(screen.getByRole("textbox", { name: "Title" }));
      expect(input.value).toBe("Draft");
      expect([...input.attributes].map((a) => a.name).sort()).toEqual([
        "aria-label",
        "type",
        "value",
      ]);
    });

    it("render={<textarea />} renders a textarea, with no type", () => {
      const { container } = render(
        <TextField aria-label="Notes" defaultValue="Line" render={<textarea rows={4} />} />,
      );
      const area = container.querySelector("textarea")!;
      expect(area).toBe(screen.getByRole("textbox", { name: "Notes" }));
      expect(area.value).toBe("Line");
      expect(area).toHaveAttribute("rows", "4");
      expect(area).not.toHaveAttribute("type");
    });

    it.each([
      ["search", "prop"],
      ["search", "render"],
      ["number", "prop"],
      ["number", "render"],
    ] as const)("type=%s as a %s warns once and renders as given", (type, how) => {
      const consoleError = silenceErrors();
      const ui = () =>
        how === "prop" ? (
          <TextField aria-label="Q" type={type} defaultValue="" />
        ) : (
          <TextField aria-label="Q" render={<input type={type} />} defaultValue="" />
        );
      const { container, rerender } = render(ui());
      rerender(ui());
      expect(container.querySelector("input")).toHaveAttribute("type", type);
      expect(consoleError).toHaveBeenCalledTimes(1);
      const message = String(consoleError.mock.calls[0]?.[0]);
      expect(message).toMatch(new RegExp(`^TextField: .*type="${type}"`));
      if (type === "search") {
        expect(message).toMatch(/Escape/);
        expect(message).toMatch(/type="text"/);
        expect(message).toMatch(/role="searchbox"/);
        expect(message).toMatch(/enterKeyHint="search"/);
      }
    });

    it.each(["text", "tel", "url", "email", "password"])("type=%s does not warn", (type) => {
      const consoleError = silenceErrors();
      render(
        <>
          <TextField aria-label="a" type={type} />
          <TextField aria-label="b" render={<input type={type} />} />
        </>,
      );
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("a non-text element warns", () => {
      const consoleError = silenceErrors();
      render(<TextField aria-label="a" render={<select />} />);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0]?.[0])).toMatch(/^TextField: rendered <select>/);
    });

    it("pass-through attributes, no autocomplete default", () => {
      render(
        <TextField
          aria-label="Title"
          placeholder="Untitled"
          maxLength={40}
          enterKeyHint="done"
          spellCheck={false}
          id="title"
        />,
      );
      const input = field();
      expect(input).toHaveAttribute("placeholder", "Untitled");
      expect(input).toHaveAttribute("maxlength", "40");
      expect(input).toHaveAttribute("enterkeyhint", "done");
      expect(input).toHaveAttribute("spellcheck", "false");
      expect(input).toHaveAttribute("id", "title");
      expect(input).not.toHaveAttribute("autocomplete");
    });
  });

  // --- Draft -------------------------------------------------------------------------------------

  describe("draft", () => {
    it("typing shows at once and dispatches nothing; state.text follows, state.value does not", () => {
      const action = vi.fn<Fn>();
      const seen: TextFieldState[] = [];
      render(
        <TextField
          aria-label="Title"
          defaultValue="Draft"
          valueCommitAction={action}
          className={(state) => {
            seen.push(state);
            return undefined;
          }}
        />,
      );
      typeText("Dra");
      expect(field().value).toBe("Dra");
      expect(action).not.toHaveBeenCalled();
      expect(seen.at(-1)).toMatchObject({ value: "Draft", text: "Dra", pending: false });
    });

    it("a controlled value changed from outside shows with no draft and waits behind an open one", () => {
      function Parent() {
        const [value, setValue] = useState("Draft");
        return (
          <>
            <TextField aria-label="Title" value={value} />
            <button type="button" onClick={() => setValue((v) => (v === "Plan" ? "Q3" : "Plan"))}>
              rename
            </button>
          </>
        );
      }
      render(<Parent />);
      const rename = screen.getByRole("button", { name: "rename" });
      fireEvent.click(rename);
      expect(field().value).toBe("Plan");
      typeText("Repor");
      fireEvent.click(rename);
      expect(field().value).toBe("Repor");
      // Escape shows the other user's title.
      key("Escape");
      expect(field().value).toBe("Q3");
    });
  });

  // --- Commit ------------------------------------------------------------------------------------

  renderBoth("commit", (mode) => {
    it("a blur dispatches once with (next, activate) and the focusout", async () => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      typeText("Report");
      blur();
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("Report");
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("focusout");
      expect(JSON.stringify(details)).toBe('{"reason":"activate"}');
      expect(field().value).toBe("Report");
      expect(committed()).toBe("Report");
    });

    it("Enter dispatches once with the keydown, not prevented, focus stays", async () => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      field().focus();
      typeText("Report");
      const event = key("Enter");
      await flushMicrotasks();
      expect(event.defaultPrevented).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBe("Report");
      expect(action.mock.calls[0]![1].event).toBe(event);
      expect(document.activeElement).toBe(field());
      // The draft is gone: a later blur commits nothing more.
      blur();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("Enter with modifiers commits too", async () => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      typeText("Report");
      key("Enter", { shiftKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a draft equal to the shown value dispatches nothing and is cleared", async () => {
      const action = vi.fn<Fn>();
      const seen: string[] = [];
      render(
        <Harness
          mode={mode}
          action={action}
          className={(state) => {
            seen.push(state.text === state.value ? "same" : "draft");
            return undefined;
          }}
        />,
      );
      typeText("Drafts");
      typeText("Draft");
      blur();
      key("Enter");
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Draft");
    });

    it("no draft: blur and Enter dispatch nothing", () => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      key("Enter");
      blur();
      expect(action).not.toHaveBeenCalled();
    });

    it.each([["disabled"], ["readOnly"]] as const)(
      "%s: the draft is cleared, nothing is dispatched",
      (prop) => {
        const action = vi.fn<Fn>();
        function Toggle() {
          const [off, setOff] = useState(false);
          return (
            <>
              <Harness mode={mode} action={action} {...{ [prop]: off }} />
              <button type="button" onClick={() => setOff(true)}>
                off
              </button>
            </>
          );
        }
        render(<Toggle />);
        typeText("Report");
        fireEvent.click(screen.getByRole("button", { name: "off" }));
        blur();
        expect(action).not.toHaveBeenCalled();
        expect(field().value).toBe("Draft");
      },
    );

    it.each([
      ["isComposing", { isComposing: true }],
      ["keyCode 229", { keyCode: 229 }],
    ] as const)("an Enter with %s is the IME's and commits nothing", (_label, init) => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      typeText("Report");
      key("Enter", init);
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Report");
    });

    it("the text does not change during a pending save; the field stays editable", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} />);
      typeText("Report");
      blur();
      expectPending(field());
      expect(field().value).toBe("Report");
      expect(field()).not.toBeDisabled();
      expect(field()).not.toHaveAttribute("aria-busy");
      typeText("Report 2");
      expect(field().value).toBe("Report 2");
      await act(async () => d.resolve());
      expectNotPending(field());
      expect(field().value).toBe("Report 2");
      expect(committed()).toBe("Report");
    });
  });

  // --- Commit key, textarea (design 4.2) ---------------------------------------------------------

  renderBoth("commit key, textarea", (mode) => {
    const area = (props: Omit<TextFieldProps, "value" | "defaultValue"> = {}, action?: Fn) =>
      render(<Harness mode={mode} action={action} render={<textarea />} {...props} />);

    it.each([
      ["alone", {}],
      ["with Shift", { shiftKey: true }],
      ["with Alt", { altKey: true }],
    ] as const)(
      "Enter %s is not the field's key: nothing dispatched, not prevented",
      (_label, init) => {
        const action = vi.fn<Fn>();
        area({}, action);
        typeText("Line one");
        const event = key("Enter", init);
        expect(event.defaultPrevented).toBe(false);
        expect(action).not.toHaveBeenCalled();
        expect(field().value).toBe("Line one");
      },
    );

    it.each([
      ["Ctrl", { ctrlKey: true }],
      ["Cmd", { metaKey: true }],
      ["Ctrl+Shift", { ctrlKey: true, shiftKey: true }],
      ["Cmd+Shift", { metaKey: true, shiftKey: true }],
      ["Ctrl+Alt", { ctrlKey: true, altKey: true }],
    ] as const)("%s+Enter commits once with the keydown, prevented", async (_label, init) => {
      const action = vi.fn<Fn>();
      const seen: TextFieldState[] = [];
      area(
        {
          className: (state) => {
            seen.push(state);
            return undefined;
          },
        },
        action,
      );
      field().focus();
      typeText("Line one\nLine two");
      const event = key("Enter", init);
      await flushMicrotasks();
      expect(event.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("Line one\nLine two");
      expect(details.reason).toBe("activate");
      expect(details.event).toBe(event);
      expect(document.activeElement).toBe(field());
      expect(field().value).toBe("Line one\nLine two");
      expect(committed()).toBe("Line one\nLine two");
      // The draft is cleared: the shown text is the value.
      expect(seen.at(-1)).toMatchObject({
        value: "Line one\nLine two",
        text: "Line one\nLine two",
      });
      // A blur after the key dispatches nothing more.
      blur();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("no draft, or an equal draft: nothing dispatched, still prevented", () => {
      const action = vi.fn<Fn>();
      area({}, action);
      expect(key("Enter", { ctrlKey: true }).defaultPrevented).toBe(true);
      typeText("Drafts");
      typeText("Draft");
      expect(key("Enter", { metaKey: true }).defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Draft");
    });

    it.each([["disabled"], ["readOnly"]] as const)(
      "%s: nothing dispatched, still prevented",
      (prop) => {
        const action = vi.fn<Fn>();
        function Toggle() {
          const [off, setOff] = useState(false);
          return (
            <>
              <Harness mode={mode} action={action} render={<textarea />} {...{ [prop]: off }} />
              <button type="button" onClick={() => setOff(true)}>
                off
              </button>
            </>
          );
        }
        render(<Toggle />);
        typeText("Report");
        fireEvent.click(screen.getByRole("button", { name: "off" }));
        expect(key("Enter", { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(action).not.toHaveBeenCalled();
        expect(field().value).toBe("Draft");
      },
    );

    it.each([
      ["isComposing", { ctrlKey: true, isComposing: true }],
      ["keyCode 229", { metaKey: true, keyCode: 229 }],
    ] as const)("a modified Enter with %s is the IME's: nothing, not prevented", (_l, init) => {
      const action = vi.fn<Fn>();
      area({}, action);
      typeText("Report");
      const event = key("Enter", init);
      expect(event.defaultPrevented).toBe(false);
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Report");
    });

    it("a blur with a draft open commits", async () => {
      const action = vi.fn<Fn>();
      area({}, action);
      typeText("Line one");
      blur();
      await flushMicrotasks();
      expect(action).toHaveBeenCalledExactlyOnceWith("Line one", expect.anything());
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
    });

    it("typing after the key opens a new draft; a second key press commits it", async () => {
      const action = vi.fn<Fn>();
      area({}, action);
      typeText("a");
      key("Enter", { ctrlKey: true });
      await flushMicrotasks();
      typeText("ab");
      expect(field().value).toBe("ab");
      key("Enter", { metaKey: true });
      await flushMicrotasks();
      expect(action.mock.calls.map(([next]) => next)).toEqual(["a", "ab"]);
    });

    it("an <input> with Ctrl+Enter commits and is not prevented (unchanged)", async () => {
      const action = vi.fn<Fn>();
      render(<Harness mode={mode} action={action} />);
      typeText("Report");
      const event = key("Enter", { ctrlKey: true });
      await flushMicrotasks();
      expect(event.defaultPrevented).toBe(false);
      expect(action).toHaveBeenCalledExactlyOnceWith("Report", expect.anything());
    });
  });

  // --- Escape ------------------------------------------------------------------------------------

  describe("Escape (draft revert)", () => {
    it("with an edited draft: the text returns, nothing dispatched, prevented and consumed", () => {
      const action = vi.fn<Fn>();
      render(<Harness mode="uncontrolled" action={action} />);
      typeText("Repor");
      const event = key("Escape");
      expect(field().value).toBe("Draft");
      expect(action).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
      expect(isEscapeRequest(event)).toBe(false);
      // The draft is gone: the blur commits nothing.
      blur();
      expect(action).not.toHaveBeenCalled();
    });

    it("with no draft, or a draft equal to the value: untouched", () => {
      render(<Harness mode="uncontrolled" />);
      const first = key("Escape");
      expect(first.defaultPrevented).toBe(false);
      expect(isEscapeRequest(first)).toBe(true);
      // A draft that ends on the value's text (React drops a change to the same text, so the
      // draft is opened with other text first).
      typeText("Dra");
      typeText("Draft");
      const second = key("Escape");
      expect(second.defaultPrevented).toBe(false);
      expect(isEscapeRequest(second)).toBe(true);
    });

    it("already prevented: untouched", () => {
      render(<Harness mode="uncontrolled" />);
      typeText("Repor");
      const input = field();
      const prevent = (e: Event) => e.preventDefault();
      input.addEventListener("keydown", prevent);
      key("Escape");
      input.removeEventListener("keydown", prevent);
      expect(input.value).toBe("Repor");
    });

    it.each([
      ["isComposing", { isComposing: true }],
      ["keyCode 229", { keyCode: 229 }],
    ] as const)("while composing (%s): untouched", (_label, init) => {
      render(<Harness mode="uncontrolled" />);
      typeText("Repor");
      const event = key("Escape", init);
      expect(event.defaultPrevented).toBe(false);
      expect(field().value).toBe("Repor");
    });

    it("does not cancel a save in flight; shows the pending text", async () => {
      const d = deferred();
      render(<Harness mode="uncontrolled" action={() => d.promise} />);
      typeText("Report");
      blur();
      typeText("Report 2");
      key("Escape");
      expect(field().value).toBe("Report");
      expectPending(field());
      await act(async () => d.resolve());
      expect(field().value).toBe("Report");
    });

    it("inside a non-modal Dialog: the first Escape reverts and the dialog stays, the second closes", async () => {
      render(
        <Dialog.Root defaultOpen modal={false}>
          <Dialog.Popup data-testid="popup" aria-label="Rename">
            <TextField aria-label="Title" defaultValue="Draft" />
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await flushTasks(2);
      const dialog = screen.getByTestId("popup") as HTMLDialogElement;
      expect(dialog.open).toBe(true);
      typeText("Repor");
      key("Escape");
      await flushTasks(1);
      expect(field().value).toBe("Draft");
      expect(dialog.open).toBe(true);
      key("Escape");
      await flushTasks(1);
      expect(dialog.open).toBe(false);
    });
  });

  // --- Rejection with a draft open ---------------------------------------------------------------

  describe("a save that fails while a draft is open", () => {
    it("controlled, not adopted: the value returns and the open draft stays", async () => {
      const d = deferred();
      render(<Harness mode="controlled" veto action={() => d.promise} />);
      typeText("Report");
      blur();
      typeText("Report 2");
      await act(async () => d.resolve());
      expect(field().value).toBe("Report 2");
      key("Escape");
      expect(field().value).toBe("Draft");
    });

    renderBoth("caught inside", (mode) => {
      it("the draft opened before the settle is kept", async () => {
        const d = deferred();
        render(
          <Harness
            mode={mode}
            action={async () => {
              try {
                await d.promise;
              } catch {
                // handled
              }
            }}
          />,
        );
        typeText("Report");
        blur();
        typeText("Report 2");
        await act(async () => d.reject(new Error("refused")));
        expect(field().value).toBe("Report 2");
        key("Escape");
        expect(field().value).toBe("Report");
      });
    });
  });

  // --- Platform paths ----------------------------------------------------------------------------

  renderBoth("platform paths", (mode) => {
    it("text hydrated into a focused input is the draft: no dispatch, the blur commits", async () => {
      const action = vi.fn<Fn>();
      await hydrateFromServer(<Harness mode={mode} action={action} />, {
        mutate: (c) => {
          const input = c.querySelector("input")!;
          input.value = "Report";
          input.focus();
        },
      });
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Report");
      expect(document.activeElement).toBe(field());
      blur();
      await flushMicrotasks();
      expect(action).toHaveBeenCalledExactlyOnceWith("Report", expect.anything());
      expect(action.mock.calls[0]![1].reason).toBe("activate");
    });

    it("unfocused hydrated text: one platform dispatch with no event, once under StrictMode", async () => {
      const action = vi.fn<Fn>();
      await hydrateFromServer(
        <StrictMode>
          <Harness mode={mode} action={action} />
        </StrictMode>,
        {
          mutate: (c) => {
            c.querySelector("input")!.value = "Report";
          },
        },
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0]).toBe("Report");
      expect(action.mock.calls[0]![1].reason).toBe("platform");
      expect(action.mock.calls[0]![1].event).toBeUndefined();
    });

    it("a reset clears an open draft and dispatches the target", async () => {
      const action = vi.fn<Fn>();
      render(
        <form data-testid="form">
          <Harness mode={mode} action={action} />
        </form>,
      );
      typeText("Report");
      blur();
      await flushMicrotasks();
      typeText("Report 2");
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
        ["Report", "activate", "focusout"],
        ["Draft", "platform", "reset"],
      ]);
      expect(field().value).toBe("Draft");
      // No draft is left: a blur commits nothing.
      blur();
      expect(action).toHaveBeenCalledTimes(2);
    });

    // The `defaultValue` mirror (design 4.4, conventions 3.8 rule 6): react-dom keeps a
    // controlled input's `defaultValue` equal to its last committed value, so without the write
    // in the `reset` event the algorithm would restore "Report", shown until the dispatch.
    // `form.reset()` runs the algorithm synchronously, before `onReset`'s microtask.
    it("the reset algorithm itself restores the target, before the dispatch", async () => {
      render(
        <form data-testid="form">
          <Harness mode={mode} />
        </form>,
      );
      typeText("Report");
      blur();
      await flushMicrotasks();
      expect(field().value).toBe("Report");
      let synchronously = "";
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).reset();
        synchronously = field().value;
      });
      expect(synchronously).toBe("Draft");
      expect(field().value).toBe("Draft");
    });

    it("an edit after a reset back to the old text opens a draft (react-dom's value tracker)", async () => {
      const action = vi.fn<Fn>();
      render(
        <form data-testid="form">
          <Harness mode={mode} action={action} />
        </form>,
      );
      typeText("Report");
      blur();
      await flushMicrotasks();
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushMicrotasks();
      expect(field().value).toBe("Draft");
      typeText("Report");
      expect(field().value).toBe("Report");
      blur();
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["Report", "activate"],
        ["Draft", "platform"],
        ["Report", "activate"],
      ]);
    });

    it("a reset to the intended value with a draft open clears the draft, no dispatch", async () => {
      const action = vi.fn<Fn>();
      render(
        <form data-testid="form">
          <Harness mode={mode} action={action} />
        </form>,
      );
      typeText("Report");
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(field().value).toBe("Draft");
      blur();
      expect(action).not.toHaveBeenCalled();
    });
  });

  // --- Inside a Field ----------------------------------------------------------------------------

  describe("inside a Field.Root", () => {
    it("wiring: id, name, aria-describedby, aria-invalid, disabled / required, Label for", async () => {
      render(
        <Field.Root name="displayName" disabled required>
          <Field.Label data-testid="label">Display name</Field.Label>
          <TextField defaultValue="Ada" aria-describedby="own" />
          <Field.Description data-testid="desc">Shown to others.</Field.Description>
        </Field.Root>,
      );
      await flushMicrotasks();
      const input = field();
      expect(screen.getByTestId("label")).toHaveAttribute("for", input.id);
      expect(input).toBe(screen.getByRole("textbox", { name: "Display name" }));
      expect(input.name).toBe("displayName");
      expect(input).toBeDisabled();
      expect(input).toBeRequired();
      expect(input).toHaveAttribute("data-disabled", "");
      expect(input).toHaveAttribute("aria-describedby", `own ${screen.getByTestId("desc").id}`);
      expect(input).toHaveAttribute("aria-invalid", "false");
      expect(input).not.toHaveAttribute("data-invalid");
    });

    it("own props win where they may: name; disabled / required are either's", () => {
      render(
        <Field.Root name="displayName">
          <TextField name="displayName" required />
        </Field.Root>,
      );
      expect(field().name).toBe("displayName");
      expect(field()).toBeRequired();
    });

    it("data-invalid and aria-invalid follow a server error, dismissed by the first keystroke", async () => {
      render(
        <Form.Root errors={{ displayName: "Taken." }}>
          <Field.Root name="displayName">
            <Field.Label>Display name</Field.Label>
            <TextField defaultValue="Ada" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form.Root>,
      );
      await flushMicrotasks();
      expect(screen.getByTestId("error")).toHaveTextContent("Taken.");
      expect(field()).toHaveAttribute("data-invalid", "");
      expect(field()).toHaveAttribute("aria-invalid", "true");
      typeText("Ada2");
      await flushMicrotasks();
      expect(screen.queryByTestId("error")).toBeNull();
      expect(field()).not.toHaveAttribute("data-invalid");
    });

    it("its data-pending is its own; the Field's follows the form", async () => {
      const d = deferred();
      render(
        <Field.Root name="displayName" data-testid="field">
          <TextField defaultValue="Ada" valueCommitAction={() => d.promise} />
        </Field.Root>,
      );
      typeText("Grace");
      blur();
      expectPending(field());
      expectNotPending(screen.getByTestId("field"));
      await act(async () => d.resolve());
      expectNotPending(field());
    });

    it("an Escape revert and a rollback re-run validate with no event", async () => {
      const validate = vi.fn((v: string) => (v.includes(" ") ? "No spaces." : null));
      function Parent({ d }: { d: Promise<void> }) {
        return (
          <form>
            <Field.Root name="handle" validate={validate}>
              <TextField
                aria-label="Handle"
                value="ada"
                valueCommitAction={async () => {
                  await d;
                }}
              />
            </Field.Root>
          </form>
        );
      }
      const d = deferred();
      render(<Parent d={d.promise} />);
      await flushMicrotasks();
      typeText("a b");
      await flushMicrotasks();
      expect(validate).toHaveBeenLastCalledWith("a b", expect.any(FormData));
      expect(field().validity.customError).toBe(true);
      key("Escape");
      await flushMicrotasks();
      expect(validate).toHaveBeenLastCalledWith("ada", expect.any(FormData));
      expect(field().validity.customError).toBe(false);
      // A rollback (the parent does not adopt).
      typeText("x y");
      blur();
      await flushMicrotasks();
      expect(field().validity.customError).toBe(true);
      await act(async () => d.resolve());
      await flushMicrotasks();
      expect(field().value).toBe("ada");
      expect(validate).toHaveBeenLastCalledWith("ada", expect.any(FormData));
      expect(field().validity.customError).toBe(false);
    });
  });

  // --- Form --------------------------------------------------------------------------------------

  describe("forms", () => {
    it("FormData holds the text shown, the draft included", () => {
      render(
        <form data-testid="form">
          <TextField aria-label="Title" name="title" defaultValue="Draft" />
        </form>,
      );
      const data = () => new FormData(screen.getByTestId("form") as HTMLFormElement).get("title");
      expect(data()).toBe("Draft");
      typeText("Repor");
      expect(data()).toBe("Repor");
    });

    it("Enter in a Form.Root dispatches the commit, then submits the same text", async () => {
      const order: string[] = [];
      render(
        <Form.Root
          autoReset={false}
          action={(formData) => {
            order.push(`submit ${String(formData.get("title"))}`);
          }}
        >
          <TextField
            aria-label="Title"
            name="title"
            defaultValue="Draft"
            valueCommitAction={(next) => {
              order.push(`commit ${next}`);
            }}
          />
          <button type="submit">Save</button>
        </Form.Root>,
      );
      const user = setupUser();
      await user.clear(field());
      await user.type(field(), "Report{Enter}");
      await flushMicrotasks();
      expect(order).toEqual(["commit Report", "submit Report"]);
    });

    it("a textarea's Ctrl+Enter in a Form.Root commits and does not submit", async () => {
      const order: string[] = [];
      render(
        <Form.Root
          autoReset={false}
          action={(formData) => {
            order.push(`submit ${String(formData.get("notes"))}`);
          }}
        >
          <TextField
            aria-label="Notes"
            name="notes"
            defaultValue="a"
            render={<textarea />}
            valueCommitAction={(next) => {
              order.push(`commit ${next}`);
            }}
          />
          <button type="submit">Save</button>
        </Form.Root>,
      );
      typeText("a\nb");
      key("Enter", { ctrlKey: true });
      await flushMicrotasks();
      await flushTasks(1);
      expect(order).toEqual(["commit a\nb"]);
    });

    it("with the form-level handler of design 7: the commit, then the submission, once each", async () => {
      const order: string[] = [];
      render(
        <Form.Root
          autoReset={false}
          action={(formData) => {
            order.push(`submit ${String(formData.get("notes"))}`);
          }}
          onKeyDown={(event) => {
            const { isComposing, keyCode } = event.nativeEvent;
            if (!(event.target instanceof HTMLTextAreaElement) || isComposing || keyCode === 229)
              return;
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey))
              event.currentTarget.requestSubmit();
          }}
        >
          <TextField
            aria-label="Notes"
            name="notes"
            defaultValue="a"
            render={<textarea />}
            valueCommitAction={(next) => {
              order.push(`commit ${next}`);
            }}
          />
          <button type="submit">Save</button>
        </Form.Root>,
      );
      typeText("a\nb");
      key("Enter", { metaKey: true });
      await flushMicrotasks();
      await flushTasks(1);
      expect(order).toEqual(["commit a\nb", "submit a\nb"]);
    });

    it("autoReset after a successful submission dispatches a platform commit", async () => {
      const action = vi.fn<Fn>();
      render(
        <Form.Root autoReset action={() => {}}>
          <TextField
            aria-label="Title"
            name="title"
            defaultValue="Draft"
            valueCommitAction={action}
          />
          <button type="submit">Save</button>
        </Form.Root>,
      );
      const user = setupUser();
      await user.clear(field());
      await user.type(field(), "Report");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushMicrotasks();
      await flushTasks(1);
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["Report", "activate"],
        ["Draft", "platform"],
      ]);
      expect(field().value).toBe("Draft");
    });
  });

  // --- Function props and render -----------------------------------------------------------------

  describe("function props and render", () => {
    it("className and style receive the state; data-pending and data-disabled", async () => {
      const d = deferred();
      render(
        <TextField
          aria-label="Title"
          defaultValue="Draft"
          valueCommitAction={() => d.promise}
          className={(s) => (s.pending ? "saving" : "idle")}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
        />,
      );
      expect(field()).toHaveClass("idle");
      typeText("Report");
      blur();
      expect(field()).toHaveClass("saving");
      expect(field().style.opacity).toBe("0.5");
      await act(async () => d.resolve());
      expect(field()).toHaveClass("idle");
    });

    it("the render element keeps the library's handlers and forwards the ref", async () => {
      const action = vi.fn<Fn>();
      let element: HTMLTextAreaElement | null = null;
      render(
        <TextField
          aria-label="Notes"
          className="a"
          valueCommitAction={action}
          render={
            <textarea
              className="b"
              ref={(el) => {
                element = el;
              }}
            />
          }
        />,
      );
      expect(element).toBe(field());
      expect(field()).toHaveClass("a");
      expect(field()).toHaveClass("b");
      typeText("Notes");
      blur();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("render function form receives the props and the state", () => {
      const seen: TextFieldState[] = [];
      render(
        <TextField
          aria-label="Title"
          defaultValue="Draft"
          render={(props, state) => {
            seen.push(state);
            return <input {...props} data-testid="custom" />;
          }}
        />,
      );
      expect(screen.getByTestId("custom")).toBe(field());
      expect(seen.at(-1)).toMatchObject({ value: "Draft", text: "Draft" });
    });
  });
});

// #200, the consistency alignment (conventions 3.6, 4.1 rule 5, 9.5).
describe("TextField alignment rows", () => {
  it("state.invalid equals data-invalid", async () => {
    const className = vi.fn((s: TextFieldState) => (s.invalid ? "bad" : "ok"));
    render(
      <form>
        <Field.Root name="title" required>
          <Field.Label>Title</Field.Label>
          <TextField className={className} />
          <Field.Error />
        </Field.Root>
        <button type="submit">Save</button>
      </form>,
    );
    await act(async () => {});
    expect(field()).toHaveClass("ok");
    await setupUser().click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(field()).toHaveAttribute("data-invalid", "");
    expect(field()).toHaveClass("bad");
  });

  it.each(["own", "field"] as const)(
    "disabled submission (%s): the text is not posted",
    async (source) => {
      const ui =
        source === "own" ? (
          <TextField aria-label="Title" name="title" defaultValue="Draft" disabled />
        ) : (
          <Field.Root name="title" disabled>
            <Field.Label>Title</Field.Label>
            <TextField defaultValue="Draft" />
          </Field.Root>
        );
      render(<form data-testid="form">{ui}</form>);
      await act(async () => {});
      expect(field()).toBeDisabled();
      expect([...new FormData(screen.getByTestId("form") as HTMLFormElement)]).toEqual([]);
    },
  );

  it("warns once when the field has no accessible name; a label names it", async () => {
    const error = silenceErrors();
    render(
      <>
        <TextField />
        <label>
          Named <TextField />
        </label>
        <TextField aria-label="Named too" />
        <Field.Root>
          <Field.Label>Named by the Field</Field.Label>
          <TextField />
        </Field.Root>
      </>,
    );
    await act(async () => {});
    const calls = error.mock.calls.filter(([m]) => String(m).includes("no accessible name"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toMatch(/^TextField: /);
  });
});
