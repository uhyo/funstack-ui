// OTPField tests (jsdom), mapped to the test plan of the #171 entries in design/CHANGELOG.md.
//
// jsdom: user-event fires `beforeinput` before each `input` and keeps the caret, jsdom fires no
// `selectionchange` on an input (the library also reads the selection on `keyup`, `select` and
// after its own writes), has no layout (Slot boxes are stubbed for the pointer rows) and no
// `:user-invalid`. The real caret, selection, paste, IME and pointer rows are in
// `otp-field.browser.test.tsx`; the transition types in `otp-field-transition-types.test.tsx`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onCleanup } from "../__tests__/cleanups.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushMicrotasks,
  hydrateFromServer,
  renderBoth,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { OTPField } from "./index.js";
import type {
  OTPFieldCompleteDetails,
  OTPFieldInputProps,
  OTPFieldRootProps,
  OTPFieldSlotState,
  OTPFieldState,
  OTPFieldValueChangeDetails,
} from "./index.js";

type Complete = (value: string, details: OTPFieldCompleteDetails) => unknown;
type Change = (value: string, details: OTPFieldValueChangeDetails) => void;

const input = () => screen.getByTestId("input") as HTMLInputElement;
const root = () => screen.getByTestId("root");
const slot = (i: number) => screen.getByTestId(`slot-${i}`);
const slotTexts = (length = 6) =>
  Array.from({ length }, (_, i) => slot(i).textContent ?? "").join("|");
const active = (length = 6) =>
  Array.from({ length }, (_, i) => (slot(i).hasAttribute("data-active") ? i : -1)).filter(
    (i) => i >= 0,
  );

interface CodeProps extends Partial<OTPFieldRootProps> {
  inputProps?: Partial<OTPFieldInputProps>;
}

function Code({ inputProps, length = 6, ...props }: CodeProps) {
  return (
    <OTPField.Root data-testid="root" length={length} {...props}>
      <OTPField.Input aria-label="Code" data-testid="input" {...inputProps} />
      {Array.from({ length }, (_, i) => (
        <OTPField.Slot key={i} index={i} data-testid={`slot-${i}`} />
      ))}
    </OTPField.Root>
  );
}

/** A controlled parent that adopts every change urgently. */
function Controlled({ onValueChange, defaultValue = "", ...props }: CodeProps) {
  const [code, setCode] = useState(defaultValue);
  return (
    <>
      <output data-testid="parent">{code}</output>
      <Code
        {...props}
        value={code}
        onValueChange={(next, details) => {
          onValueChange?.(next, details);
          setCode(next);
        }}
      />
    </>
  );
}

function Harness({ mode, ...props }: CodeProps & { mode: ControlMode }) {
  return mode === "controlled" ? <Controlled {...props} /> : <Code {...props} />;
}

/** Puts the caret (or a selection) in the focused input, as an arrow key or a drag would. */
function select(start: number, end = start) {
  act(() => {
    input().setSelectionRange(start, end);
    fireEvent.select(input());
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Rendering -----------------------------------------------------------------------------------

describe("rendering", () => {
  it("one text input with the one-time-code attributes, no maxlength, and aria-hidden Slots", () => {
    render(<Code />);
    const el = input();
    expect(el.tagName).toBe("INPUT");
    expect(el).toHaveAttribute("type", "text");
    expect(el).toHaveAttribute("autocomplete", "one-time-code");
    expect(el).toHaveAttribute("inputmode", "numeric");
    expect(el).toHaveAttribute("pattern", "[0-9]{6}");
    expect(el).toHaveAttribute("autocapitalize", "off");
    expect(el).toHaveAttribute("autocorrect", "off");
    expect(el).toHaveAttribute("spellcheck", "false");
    expect(el).not.toHaveAttribute("maxlength");
    expect(el).not.toHaveAttribute("minlength");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    for (let i = 0; i < 6; i++) {
      expect(slot(i)).toHaveAttribute("aria-hidden", "true");
      expect(slot(i)).toHaveAttribute("data-index", String(i));
      expect(slot(i)).not.toHaveAttribute("data-filled");
      expect(slot(i)).not.toHaveAttribute("data-active");
      expect(slot(i)).toBeEmptyDOMElement();
    }
  });

  it("the inline styles: the Root is the box, the Input covers it with transparent text", () => {
    render(<Code />);
    expect(root().style.position).toBe("relative");
    const style = input().style;
    expect(style.position).toBe("absolute");
    expect(style.color).toBe("transparent");
    expect(style.caretColor).toBe("transparent");
    expect(style.getPropertyValue("forced-color-adjust")).toBe("none");
    expect(style.outline).toBe("");
  });

  it("the consumer's Root position wins; the Input's inline style is owned", () => {
    render(
      <Code
        style={{ position: "absolute", gap: "4px" }}
        inputProps={{ style: { color: "red", outline: "2px solid blue" } }}
      />,
    );
    expect(root().style.position).toBe("absolute");
    expect(root().style.gap).toBe("4px");
    expect(input().style.color).toBe("transparent");
    expect(input().style.outline).toBe("2px solid blue");
  });

  it.each([
    ["numeric", "numeric", "[0-9]{4}"],
    ["alphanumeric", "text", "[A-Za-z0-9]{4}"],
    ["alphabetic", "text", "[A-Za-z]{4}"],
  ] as const)("charset %s: inputmode %s, pattern %s", (charset, mode, pattern) => {
    render(<Code length={4} charset={charset} />);
    expect(input()).toHaveAttribute("inputmode", mode);
    expect(input()).toHaveAttribute("pattern", pattern);
  });

  it("the consumer's inputMode, autoComplete, autoCapitalize and enterKeyHint replace the defaults", () => {
    render(
      <Code
        inputProps={{
          inputMode: "text",
          autoComplete: "off",
          autoCapitalize: "characters",
          enterKeyHint: "done",
        }}
      />,
    );
    expect(input()).toHaveAttribute("inputmode", "text");
    expect(input()).toHaveAttribute("autocomplete", "off");
    expect(input()).toHaveAttribute("autocapitalize", "characters");
    expect(input()).toHaveAttribute("enterkeyhint", "done");
    expect(input()).toHaveAttribute("type", "text");
  });

  it("defaultValue is filtered and drawn in the Slots; complete sets data-complete", () => {
    render(<Code length={4} defaultValue="12 34" />);
    expect(input().value).toBe("1234");
    expect(slotTexts(4)).toBe("1|2|3|4");
    expect(root()).toHaveAttribute("data-complete", "");
    expect(input()).toHaveAttribute("data-complete", "");
    for (let i = 0; i < 4; i++) expect(slot(i)).toHaveAttribute("data-filled", "");
  });

  it("function props receive the state; Slot children draw from the slot state", () => {
    const rootStates: OTPFieldState[] = [];
    const slotStates: OTPFieldSlotState[] = [];
    render(
      <OTPField.Root
        length={3}
        defaultValue="7"
        data-testid="root"
        className={(s) => {
          rootStates.push(s);
          return s.complete ? "done" : "open";
        }}
      >
        <OTPField.Input
          aria-label="Code"
          data-testid="input"
          className={(s) => `len-${s.length}`}
        />
        {[0, 1, 2].map((i) => (
          <OTPField.Slot
            key={i}
            index={i}
            data-testid={`slot-${i}`}
            className={({ filled }) => (filled ? "f" : "e")}
          >
            {(s) => {
              slotStates.push(s);
              return s.filled ? `[${s.char}]` : "·";
            }}
          </OTPField.Slot>
        ))}
      </OTPField.Root>,
    );
    expect(root()).toHaveClass("open");
    expect(input()).toHaveClass("len-3");
    expect(slotTexts(3)).toBe("[7]|·|·");
    expect(slot(0)).toHaveClass("f");
    expect(slot(1)).toHaveClass("e");
    expect(rootStates.at(-1)).toEqual({
      value: "7",
      length: 3,
      complete: false,
      pending: false,
      disabled: false,
      readOnly: false,
      invalid: false,
    });
    expect(slotStates.find((s) => s.index === 0)).toMatchObject({
      index: 0,
      char: "7",
      filled: true,
      active: false,
    });
  });

  it("render and ref reach every part", () => {
    const rootRef = { current: null as HTMLDivElement | null };
    const inputRef = { current: null as HTMLInputElement | null };
    const slotRef = { current: null as HTMLSpanElement | null };
    render(
      <OTPField.Root length={1} ref={rootRef} render={<section data-testid="root" />}>
        <OTPField.Input
          aria-label="Code"
          ref={inputRef}
          render={(props, state) => <input {...props} data-len={state.length} />}
        />
        <OTPField.Slot index={0} ref={slotRef} render={<b />} />
      </OTPField.Root>,
    );
    expect(rootRef.current?.tagName).toBe("SECTION");
    expect(inputRef.current?.getAttribute("data-len")).toBe("1");
    expect(slotRef.current?.tagName).toBe("B");
    expect(slotRef.current).toHaveAttribute("aria-hidden", "true");
  });

  it("server HTML: the input with the default value and the Slots with their characters", () => {
    const html = renderToString(<Code length={4} defaultValue="12" name="code" />);
    const container = document.createElement("div");
    container.innerHTML = html;
    const el = container.querySelector("input")!;
    expect(el.getAttribute("value")).toBe("12");
    expect(el.getAttribute("name")).toBe("code");
    expect(el.getAttribute("style")).toContain("color:transparent");
    const spans = container.querySelectorAll("span");
    expect([...spans].map((s) => s.textContent)).toEqual(["1", "2", "", ""]);
    expect(spans[0]).toHaveAttribute("data-filled", "");
  });
});

// --- Editing (design 4.1) ------------------------------------------------------------------------

renderBoth("editing", (mode) => {
  it("typing fills the Slots; characters outside the charset are dropped", async () => {
    const user = setupUser();
    render(<Harness mode={mode} />);
    await user.click(input());
    await user.keyboard("1a2-3");
    expect(input().value).toBe("123");
    expect(slotTexts()).toBe("1|2|3|||");
    expect(input().selectionStart).toBe(3);
    if (mode === "controlled") expect(screen.getByTestId("parent")).toHaveTextContent("123");
  });

  it("typing on a filled position replaces it and moves on (overtype)", async () => {
    const user = setupUser();
    render(<Harness mode={mode} defaultValue="1234" />);
    await user.click(input());
    select(1);
    await user.keyboard("98");
    expect(input().value).toBe("1984");
    expect(input().selectionStart).toBe(3);
  });

  it("typing at the end of a complete code replaces the last character", async () => {
    const user = setupUser();
    render(<Harness mode={mode} defaultValue="123456" />);
    await user.click(input());
    select(6);
    await user.keyboard("7");
    expect(input().value).toBe("123457");
    expect(input().selectionStart).toBe(6);
  });

  it("a dropped character over a selection keeps the text and the selection", async () => {
    const user = setupUser();
    render(<Harness mode={mode} defaultValue="1234" />);
    await user.click(input());
    select(1, 3);
    await user.keyboard("x");
    expect(input().value).toBe("1234");
    expect([input().selectionStart, input().selectionEnd]).toEqual([1, 3]);
  });

  it("Backspace deletes and the rest closes up", async () => {
    const user = setupUser();
    render(<Harness mode={mode} defaultValue="1234" />);
    await user.click(input());
    select(2);
    await user.keyboard("{Backspace}");
    expect(input().value).toBe("134");
    expect(slotTexts()).toBe("1|3|4|||");
  });

  it("a pasted full code replaces a half-typed one, spaces and hyphens dropped", async () => {
    const user = setupUser();
    render(<Harness mode={mode} />);
    await user.click(input());
    await user.keyboard("98");
    await user.paste("123 456");
    expect(input().value).toBe("123456");
    await user.paste("654-321");
    expect(input().value).toBe("654321");
    await user.paste("1234567890");
    expect(input().value).toBe("123456");
  });

  it("a selection replaced by typing", async () => {
    const user = setupUser();
    render(<Harness mode={mode} defaultValue="123456" />);
    await user.click(input());
    select(0, 6);
    await user.keyboard("9");
    expect(input().value).toBe("9");
  });
});

// --- data-active (design 4.3) --------------------------------------------------------------------

describe("data-active", () => {
  it("none while not focused; the caret's slot while focused; none after blur", async () => {
    const user = setupUser();
    render(<Code defaultValue="12" />);
    expect(active()).toEqual([]);
    await user.click(input());
    select(2);
    expect(active()).toEqual([2]);
    select(0);
    expect(active()).toEqual([0]);
    await user.tab();
    expect(active()).toEqual([]);
  });

  it("a range marks every slot in it; the end of a complete code marks the last slot", async () => {
    const user = setupUser();
    render(<Code defaultValue="123456" />);
    await user.click(input());
    select(1, 4);
    expect(active()).toEqual([1, 2, 3]);
    select(6);
    expect(active()).toEqual([5]);
    expect(slot(5)).toHaveAttribute("data-filled", "");
  });

  it("follows typing", async () => {
    const user = setupUser();
    render(<Code />);
    await user.click(input());
    await user.keyboard("12");
    expect(active()).toEqual([2]);
  });
});

// --- onValueChange (design 3.2) ------------------------------------------------------------------

renderBoth("onValueChange", (mode) => {
  it("is called synchronously per edit, with the filtered text in the DOM and reason activate", async () => {
    const calls: { next: string; dom: string; type: string | undefined; reason: string }[] = [];
    const onValueChange = vi.fn<Change>((next, details) => {
      calls.push({ next, dom: input().value, type: details.event?.type, reason: details.reason });
    });
    const user = setupUser();
    render(<Harness mode={mode} onValueChange={onValueChange} />);
    await user.click(input());
    await user.keyboard("1x2");
    await user.paste("12 34 56");
    expect(calls).toEqual([
      { next: "1", dom: "1", type: "input", reason: "activate" },
      { next: "12", dom: "12", type: "input", reason: "activate" },
      { next: "123456", dom: "123456", type: "input", reason: "activate" },
    ]);
    expect(JSON.stringify(onValueChange.mock.calls[0]![1])).toBe('{"reason":"activate"}');
  });

  it("is not a transition: typing stays in sync while an async action holds every transition", async () => {
    const save = deferred();
    const user = setupUser();
    function Probe() {
      const [isPending, start] = useTransition();
      const [, set] = useState(0);
      return (
        <button type="button" data-testid="probe" onClick={() => start(() => set((n) => n + 1))}>
          {String(isPending)}
        </button>
      );
    }
    render(
      <>
        <Probe />
        <Harness mode={mode} />
      </>,
    );
    act(() => startTransition(() => save.promise));
    await user.click(screen.getByTestId("probe"));
    expect(screen.getByTestId("probe")).toHaveTextContent("true");
    await user.click(input());
    await user.keyboard("123");
    expect(slotTexts()).toBe("1|2|3|||");
    if (mode === "controlled") expect(screen.getByTestId("parent")).toHaveTextContent("123");
    await act(async () => save.resolve());
  });

  it("a throwing handler goes to reportError; the edit stands", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const user = setupUser();
    render(
      <Code
        onValueChange={() => {
          throw new Error("boom");
        }}
      />,
    );
    await user.click(input());
    await user.keyboard("1");
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    if (mode === "uncontrolled") expect(input().value).toBe("1");
  });
});

describe("controlled value: a parent that ignores edits", () => {
  it("reports every edit against the rendered value", async () => {
    const onValueChange = vi.fn<Change>();
    const user = setupUser();
    render(<Code value="" onValueChange={onValueChange} />);
    await user.click(input());
    await user.keyboard("1");
    await user.keyboard("1");
    expect(input().value).toBe("");
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(["1", "1"]);
  });
});

describe("controlled value", () => {
  it("the parent can clear the field (setCode('') after the check)", async () => {
    const user = setupUser();
    function Clearing() {
      const [code, setCode] = useState("");
      return (
        <Code
          value={code}
          onValueChange={setCode}
          completeAction={async () => {
            await Promise.resolve();
            setCode("");
          }}
        />
      );
    }
    render(<Clearing />);
    await user.click(input());
    await user.keyboard("123456");
    await flushMicrotasks(2);
    expect(input().value).toBe("");
    expect(slotTexts()).toBe("|||||");
  });

  it("a value the filter changes is rendered filtered, with a development warning", async () => {
    const error = silenceErrors();
    render(<Code value="12-34" />);
    await act(async () => {});
    expect(input().value).toBe("1234");
    expect(error.mock.calls.some(([m]) => String(m).includes("controlled `value`"))).toBe(true);
  });

  it("a controlled change is not reported and runs no completion", async () => {
    const onValueChange = vi.fn<Change>();
    const completeAction = vi.fn<Complete>();
    const { rerender } = render(
      <Code value="" onValueChange={onValueChange} completeAction={completeAction} />,
    );
    rerender(<Code value="123456" onValueChange={onValueChange} completeAction={completeAction} />);
    await flushMicrotasks();
    expect(slotTexts()).toBe("1|2|3|4|5|6");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(completeAction).not.toHaveBeenCalled();
  });
});

// --- completeAction (design 3.1) -----------------------------------------------------------------

renderBoth("completeAction", (mode) => {
  it("runs once when an edit completes the code, after onValueChange, with reason activate", async () => {
    const order: string[] = [];
    const completeAction = vi.fn<Complete>((value) => {
      order.push(`complete ${value}`);
    });
    const user = setupUser();
    render(
      <Harness
        mode={mode}
        length={4}
        onValueChange={(v) => order.push(`value ${v}`)}
        completeAction={completeAction}
      />,
    );
    await user.click(input());
    await user.keyboard("1234");
    expect(completeAction).toHaveBeenCalledTimes(1);
    expect(completeAction.mock.calls[0]![0]).toBe("1234");
    const details = completeAction.mock.calls[0]![1];
    expect(details.reason).toBe("activate");
    expect(details.event?.type).toBe("input");
    expect(JSON.stringify(details)).toBe('{"reason":"activate"}');
    expect(order.slice(-2)).toEqual(["value 1234", "complete 1234"]);
  });

  it("async: data-pending on Root and Input until it settles; the input stays editable", async () => {
    const d = deferred();
    const user = setupUser();
    render(<Harness mode={mode} length={4} completeAction={() => d.promise} />);
    await user.click(input());
    await user.keyboard("1234");
    expectPending(root());
    expectPending(input());
    expect(input()).not.toBeDisabled();
    expect(input()).not.toHaveAttribute("aria-disabled");
    expect(input()).not.toHaveAttribute("readonly");
    await user.keyboard("{Backspace}");
    expect(input().value).toBe("123");
    await act(async () => d.resolve());
    expectNotPending(root());
    expectNotPending(input());
  });

  it("a second completion while the first is pending runs too; pending until both settle", async () => {
    const first = deferred();
    const second = deferred();
    const runs = [first, second];
    const completeAction = vi.fn<Complete>(() => runs.shift()!.promise);
    const user = setupUser();
    render(<Harness mode={mode} length={4} completeAction={completeAction} />);
    await user.click(input());
    await user.keyboard("1234");
    await user.keyboard("5");
    expect(input().value).toBe("1235");
    expect(completeAction.mock.calls.map(([v]) => v)).toEqual(["1234", "1235"]);
    await act(async () => first.resolve());
    expectPending(root());
    await act(async () => second.resolve());
    expectNotPending(root());
  });

  it("the same code pasted again runs again (retry); a dropped character does not", async () => {
    const completeAction = vi.fn<Complete>();
    const user = setupUser();
    render(<Harness mode={mode} length={4} completeAction={completeAction} />);
    await user.click(input());
    await user.paste("1234");
    await user.paste("1234");
    expect(completeAction).toHaveBeenCalledTimes(2);
    await user.keyboard("x");
    expect(completeAction).toHaveBeenCalledTimes(2);
  });

  it("a rejection reaches the nearest Error Boundary", async () => {
    silenceErrors();
    const user = setupUser();
    render(
      <ErrorCatcher>
        <Harness
          mode={mode}
          length={2}
          completeAction={async () => {
            throw new Error("check failed");
          }}
        />
      </ErrorCatcher>,
    );
    await user.click(input());
    await user.keyboard("12");
    await flushMicrotasks(2);
    expect(screen.getByTestId("error-catcher")).toHaveTextContent("check failed");
  });

  it("not at mount with a complete default, and not on a reset", async () => {
    const completeAction = vi.fn<Complete>();
    render(
      <form data-testid="form">
        <Harness mode={mode} length={2} defaultValue="12" completeAction={completeAction} />
      </form>,
    );
    await flushMicrotasks();
    const user = setupUser();
    await user.click(input());
    await user.keyboard("{Backspace}");
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flushMicrotasks();
    expect(input().value).toBe("12");
    expect(completeAction).not.toHaveBeenCalled();
  });
});

describe("completeAction: disabled and read-only", () => {
  it("a disabled field cannot be edited and completes nothing", async () => {
    const completeAction = vi.fn<Complete>();
    const user = setupUser();
    render(<Code length={2} disabled completeAction={completeAction} />);
    expect(input()).toBeDisabled();
    expect(root()).toHaveAttribute("data-disabled", "");
    expect(input()).toHaveAttribute("data-disabled", "");
    await user.type(input(), "12");
    expect(input().value).toBe("");
    expect(completeAction).not.toHaveBeenCalled();
  });

  it("read-only: native readonly, no edit, no completion even for an input event", async () => {
    const completeAction = vi.fn<Complete>();
    const onValueChange = vi.fn<Change>();
    render(
      <Code length={2} readOnly onValueChange={onValueChange} completeAction={completeAction} />,
    );
    expect(input()).toHaveAttribute("readonly");
    fireEvent.change(input(), { target: { value: "12" } });
    await flushMicrotasks();
    expect(input().value).toBe("");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(completeAction).not.toHaveBeenCalled();
  });
});

// --- submitOnComplete (design 3.1, 7) ------------------------------------------------------------

describe("submitOnComplete", () => {
  it("submits the Input's form once per completion, after completeAction", async () => {
    const order: string[] = [];
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      order.push(`submit ${new FormData(event.currentTarget).get("code")}`);
    });
    const user = setupUser();
    render(
      <form onSubmit={onSubmit}>
        <Code
          length={4}
          name="code"
          submitOnComplete
          completeAction={(v) => {
            order.push(`complete ${v}`);
          }}
        />
      </form>,
    );
    await user.click(input());
    await user.keyboard("123");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("4");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["complete 1234", "submit 1234"]);
    await user.paste("5678");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("inside a Field: a validate result on the pre-filter text does not block the submit", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = setupUser();
    render(
      <form onSubmit={onSubmit}>
        <Field.Root name="code" validate={(v) => (/^\d{4}$/.test(String(v)) ? null : "4 digits")}>
          <Field.Label>Code</Field.Label>
          <OTPField.Root length={4} submitOnComplete data-testid="root">
            <OTPField.Input data-testid="input" />
            {[0, 1, 2, 3].map((i) => (
              <OTPField.Slot key={i} index={i} />
            ))}
          </OTPField.Root>
        </Field.Root>
      </form>,
    );
    await user.click(input());
    await user.paste("12 34");
    expect(input().value).toBe("1234");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Rule 5 at the end of a complete code: the DOM holds five characters when the Field validates.
    await user.keyboard("{End}9");
    expect(input().value).toBe("1239");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("follows the form attribute; does nothing without a form", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = setupUser();
    render(
      <>
        <form id="verify" onSubmit={onSubmit} />
        <Code length={2} form="verify" submitOnComplete />
      </>,
    );
    await user.click(input());
    await user.keyboard("12");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("inside Form.Root: the form's pending, and a returned field error on Field.Error", async () => {
    const d = deferred<{ errors: Record<string, string> }>();
    const received: (string | null)[] = [];
    function Verify() {
      const [errors, setErrors] = useState<Record<string, string>>({});
      return (
        <Form.Root
          errors={errors}
          action={async (formData) => {
            received.push(formData.get("code") as string | null);
            const result = await d.promise;
            startTransition(() => setErrors(result.errors));
          }}
        >
          <Field.Root name="code" required>
            <Field.Label>Verification code</Field.Label>
            <Code length={4} submitOnComplete />
            <Field.Error data-testid="error" />
          </Field.Root>
          <Form.Submit data-testid="submit">Verify</Form.Submit>
        </Form.Root>
      );
    }
    const user = setupUser();
    render(<Verify />);
    await user.click(input());
    await user.keyboard("1234");
    expect(received).toEqual(["1234"]);
    expectPending(screen.getByTestId("submit"));
    // The control keeps its own pending for its own action (none here).
    expectNotPending(input());
    await act(async () => d.resolve({ errors: { code: "That code is not right." } }));
    await flushMicrotasks(2);
    expect(screen.getByTestId("error")).toHaveTextContent("That code is not right.");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(root()).toHaveAttribute("data-invalid", "");
    expect(input()).toHaveAttribute("data-invalid", "");
  });
});

// --- Field (design 7) ----------------------------------------------------------------------------

describe("in a Field", () => {
  function InField({ children, ...props }: { children?: ReactNode } & Partial<FieldRootLike>) {
    return (
      <Field.Root name="code" {...props}>
        <Field.Label data-testid="label">Code</Field.Label>
        <OTPField.Root length={4} data-testid="root">
          <OTPField.Input data-testid="input" />
          {[0, 1, 2, 3].map((i) => (
            <OTPField.Slot key={i} index={i} data-testid={`slot-${i}`} />
          ))}
        </OTPField.Root>
        <Field.Description data-testid="description">The 4-digit code.</Field.Description>
        <Field.Error data-testid="error" />
        {children}
      </Field.Root>
    );
  }
  type FieldRootLike = {
    required: boolean;
    disabled: boolean;
    validate: (value: unknown) => string | null;
  };

  it("registers the Input: Field.Label for, the Field's name, aria-describedby, no data-invalid", () => {
    render(<InField />);
    expect(screen.getByTestId("label")).toHaveAttribute("for", input().id);
    expect(screen.getByLabelText("Code")).toBe(input());
    expect(input()).toHaveAttribute("name", "code");
    expect(input().getAttribute("aria-describedby")).toBe(screen.getByTestId("description").id);
    expect(input()).toHaveAttribute("aria-invalid", "false");
    expect(root()).not.toHaveAttribute("data-invalid");
  });

  it("the Field's required and disabled reach the Input", () => {
    render(<InField required disabled />);
    expect(input()).toBeRequired();
    expect(input()).toBeDisabled();
    expect(root()).toHaveAttribute("data-disabled", "");
  });

  it("required and pattern validity: empty is valueMissing, a partial code patternMismatch", async () => {
    const user = setupUser();
    render(<InField required />);
    expect(input().validity.valueMissing).toBe(true);
    await user.click(input());
    await user.keyboard("12");
    expect(input().validity.valueMissing).toBe(false);
    expect(input().validity.patternMismatch).toBe(true);
    await user.keyboard("34");
    expect(input().validity.valid).toBe(true);
  });

  it("validate sees the filtered value after a write-back", async () => {
    const seen: unknown[] = [];
    const user = setupUser();
    render(
      <form>
        <InField
          validate={(value) => {
            seen.push(value);
            return value === "1234" ? null : "Wrong";
          }}
        />
      </form>,
    );
    await user.click(input());
    await user.paste("12 34");
    await flushMicrotasks();
    expect(input().value).toBe("1234");
    expect(seen.at(-1)).toBe("1234");
    expect(input().validationMessage).toBe("");
  });

  it("a server error is dismissed by an edit", async () => {
    const user = setupUser();
    render(
      <Form.Root errors={{ code: "Expired." }}>
        <InField />
      </Form.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("error")).toHaveTextContent("Expired.");
    expect(root()).toHaveAttribute("data-invalid", "");
    await user.click(input());
    await user.keyboard("1");
    await flushMicrotasks();
    expect(screen.queryByTestId("error")).toBeNull();
    expect(root()).not.toHaveAttribute("data-invalid");
  });

  it("a write-back that only filters still dismisses a server error (useFieldValueChange)", async () => {
    const user = setupUser();
    render(
      <Form.Root errors={{ code: "Expired." }}>
        <InField />
      </Form.Root>,
    );
    await flushMicrotasks();
    await user.click(input());
    await user.paste("9 8 7 6");
    await flushMicrotasks();
    expect(input().value).toBe("9876");
    expect(screen.queryByTestId("error")).toBeNull();
  });
});

// --- Forms: FormData, reset, hydration (design 7, 9) ---------------------------------------------

renderBoth("forms", (mode) => {
  it("posts the text under name; a partial code posts as typed", async () => {
    const user = setupUser();
    render(
      <form data-testid="form">
        <Harness mode={mode} name="code" />
      </form>,
    );
    await user.click(input());
    await user.keyboard("12");
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("code")).toBe("12");
  });

  it("reset: back to the default, reported with reason platform and the reset event", async () => {
    const onValueChange = vi.fn<Change>();
    const user = setupUser();
    render(
      <form data-testid="form">
        <Harness mode={mode} defaultValue="1" onValueChange={onValueChange} />
      </form>,
    );
    await user.click(input());
    await user.keyboard("{End}234");
    onValueChange.mockClear();
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flushMicrotasks();
    expect(input().value).toBe("1");
    expect(slotTexts()).toBe("1|||||");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe("1");
    expect(onValueChange.mock.calls[0]![1].reason).toBe("platform");
    expect(onValueChange.mock.calls[0]![1].event?.type).toBe("reset");
  });
});

describe("hydration", () => {
  it("text typed before hydration is adopted (reason platform) and runs no completion", async () => {
    const onValueChange = vi.fn<Change>();
    const completeAction = vi.fn<Complete>();
    const ui = <Code onValueChange={onValueChange} completeAction={completeAction} />;
    await hydrateFromServer(ui, {
      mutate: (container) => {
        container.querySelector("input")!.value = "123 456";
      },
    });
    expect(input().value).toBe("123456");
    expect(slotTexts()).toBe("1|2|3|4|5|6");
    expect(root()).toHaveAttribute("data-complete", "");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe("123456");
    expect(onValueChange.mock.calls[0]![1].reason).toBe("platform");
    expect(onValueChange.mock.calls[0]![1].event).toBeUndefined();
    expect(completeAction).not.toHaveBeenCalled();
  });

  it("hydrates without a mismatch and stays interactive", async () => {
    const error = silenceErrors();
    await hydrateFromServer(<Code defaultValue="12" />);
    expect(error).not.toHaveBeenCalled();
    const user = setupUser();
    await user.click(input());
    await user.keyboard("{End}3");
    expect(slotTexts()).toBe("1|2|3|||");
  });
});

// --- Composition (design 4.1, Composition) -------------------------------------------------------

describe("composition", () => {
  /** An `input` event as an IME sends it: the text set through React's value tracker. */
  function composeInput(text: string, isComposing: boolean) {
    act(() => {
      fireEvent.input(input(), {
        target: { value: text },
        isComposing,
        inputType: "insertCompositionText",
      });
    });
  }

  it("derives the value while composing without writing; writes back at compositionend", async () => {
    const onValueChange = vi.fn<Change>();
    const completeAction = vi.fn<Complete>();
    render(
      <Code
        length={3}
        charset="alphanumeric"
        onValueChange={onValueChange}
        completeAction={completeAction}
      />,
    );
    act(() => input().focus());
    fireEvent.compositionStart(input());
    composeInput("aか", true);
    // The composition keeps its text; the Slots show the filtered value.
    expect(input().value).toBe("aか");
    expect(slotTexts(3)).toBe("a||");
    expect(onValueChange).toHaveBeenLastCalledWith(
      "a",
      expect.objectContaining({ reason: "activate" }),
    );
    composeInput("aかb", true);
    expect(input().value).toBe("aかb");
    expect(slotTexts(3)).toBe("a|b|");
    act(() => {
      fireEvent.compositionEnd(input());
    });
    expect(input().value).toBe("ab");
    expect(slotTexts(3)).toBe("a|b|");
    expect(completeAction).not.toHaveBeenCalled();
  });

  it("submitOnComplete waits for compositionend", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const completeAction = vi.fn<Complete>();
    render(
      <form onSubmit={onSubmit}>
        <Code length={2} charset="alphanumeric" submitOnComplete completeAction={completeAction} />
      </form>,
    );
    act(() => input().focus());
    fireEvent.compositionStart(input());
    composeInput("ab", true);
    expect(completeAction).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      fireEvent.compositionEnd(input());
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(completeAction).toHaveBeenCalledTimes(1);
  });

  it("Firefox's order: compositionend, then the final input (isComposing false)", async () => {
    const onValueChange = vi.fn<Change>();
    render(<Code length={3} charset="alphanumeric" onValueChange={onValueChange} />);
    act(() => input().focus());
    fireEvent.compositionStart(input());
    composeInput("aか", true);
    act(() => {
      fireEvent.compositionEnd(input());
    });
    expect(input().value).toBe("a");
    // The final input carries the composed text again, now as an ordinary edit.
    act(() => {
      fireEvent.input(input(), {
        target: { value: "aか" },
        isComposing: false,
        inputType: "insertCompositionText",
      });
    });
    expect(input().value).toBe("a");
    expect(slotTexts(3)).toBe("a||");
    expect(onValueChange.mock.calls.every(([v]) => v === "a")).toBe(true);
  });

  it("completion may fire from composed text", async () => {
    const completeAction = vi.fn<Complete>();
    render(<Code length={2} charset="alphanumeric" completeAction={completeAction} />);
    act(() => input().focus());
    fireEvent.compositionStart(input());
    composeInput("ab", true);
    expect(completeAction).toHaveBeenCalledWith("ab", expect.anything());
    act(() => {
      fireEvent.compositionEnd(input());
    });
    expect(completeAction).toHaveBeenCalledTimes(1);
  });
});

// --- Pointer (design 4.3) ------------------------------------------------------------------------

describe("pointer", () => {
  /** Slot i occupies x = [i*40, i*40 + 32), y = [0, 48). */
  function stubSlotBoxes(length = 6) {
    for (let i = 0; i < length; i++) {
      const left = i * 40;
      vi.spyOn(slot(i), "getBoundingClientRect").mockReturnValue({
        left,
        right: left + 32,
        top: 0,
        bottom: 48,
        width: 32,
        height: 48,
        x: left,
        y: 0,
        toJSON: () => ({}),
      });
    }
  }

  it("a click puts the caret at the Slot under the pointer, clamped to the text", async () => {
    render(<Code defaultValue="1234" />);
    stubSlotBoxes();
    act(() => input().focus());
    fireEvent.click(input(), { clientX: 90, clientY: 20, detail: 1 });
    expect(input().selectionStart).toBe(2);
    fireEvent.click(input(), { clientX: 50, clientY: 20, detail: 1 });
    expect(input().selectionStart).toBe(1);
    fireEvent.click(input(), { clientX: 230, clientY: 20, detail: 1 });
    expect(input().selectionStart).toBe(4);
  });

  it("a double click or a selected range is left alone", () => {
    render(<Code defaultValue="1234" />);
    stubSlotBoxes();
    act(() => input().focus());
    input().setSelectionRange(0, 4);
    fireEvent.click(input(), { clientX: 90, clientY: 20, detail: 1 });
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 4]);
    input().setSelectionRange(4, 4);
    fireEvent.click(input(), { clientX: 10, clientY: 20, detail: 2 });
    expect(input().selectionStart).toBe(4);
  });
});

// --- WebOTP (design 8) ---------------------------------------------------------------------------

describe("experimental_webOTP", () => {
  function stubWebOTP() {
    const requests: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
    const get = vi.fn((options: { otp?: unknown; signal: AbortSignal }) => {
      return new Promise((resolve, reject) => {
        requests.push({ signal: options.signal, resolve });
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });
    vi.stubGlobal("OTPCredential", class {});
    const original = Object.getOwnPropertyDescriptor(navigator, "credentials");
    Object.defineProperty(navigator, "credentials", { configurable: true, value: { get } });
    onCleanup(() => {
      if (original) Object.defineProperty(navigator, "credentials", original);
      else delete (navigator as { credentials?: unknown }).credentials;
    });
    return { get, requests };
  }

  it("a resolved code fills the field and completes with reason platform", async () => {
    const { get, requests } = stubWebOTP();
    const onValueChange = vi.fn<Change>();
    const completeAction = vi.fn<Complete>();
    render(
      <Code experimental_webOTP onValueChange={onValueChange} completeAction={completeAction} />,
    );
    await flushMicrotasks();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![0].otp).toEqual({ transport: ["sms"] });
    await act(async () => requests[0]!.resolve({ code: "123456", type: "otp" }));
    expect(input().value).toBe("123456");
    expect(slotTexts()).toBe("1|2|3|4|5|6");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe("123456");
    expect(onValueChange.mock.calls[0]![1].reason).toBe("platform");
    expect(onValueChange.mock.calls[0]![1].event).toBeUndefined();
    expect(completeAction).toHaveBeenCalledTimes(1);
    expect(completeAction.mock.calls[0]![1].reason).toBe("platform");
    expect(completeAction.mock.calls[0]![1].event).toBeUndefined();
  });

  it("a code of the wrong length is ignored", async () => {
    const { requests } = stubWebOTP();
    const completeAction = vi.fn<Complete>();
    render(<Code experimental_webOTP completeAction={completeAction} />);
    await flushMicrotasks();
    await act(async () => requests[0]!.resolve({ code: "1234" }));
    expect(input().value).toBe("");
    expect(completeAction).not.toHaveBeenCalled();
  });

  it("one request across typing; none live after a manual completion; a late code is ignored", async () => {
    const { get, requests } = stubWebOTP();
    const completeAction = vi.fn<Complete>();
    render(<Code length={4} experimental_webOTP completeAction={completeAction} />);
    await flushMicrotasks();
    const user = setupUser();
    await user.click(input());
    await user.keyboard("12");
    expect(get).toHaveBeenCalledTimes(1);
    await user.keyboard("34");
    await flushMicrotasks();
    expect(get).toHaveBeenCalledTimes(1);
    expect(requests.every((r) => r.signal.aborted)).toBe(true);
    expect(completeAction).toHaveBeenCalledTimes(1);
    // An edit after the completion starts no new request.
    await user.keyboard("{Backspace}5");
    await flushMicrotasks();
    expect(get).toHaveBeenCalledTimes(1);
    await act(async () => requests[0]!.resolve({ code: "9999" }));
    expect(input().value).toBe("1235");
  });

  it("aborted at unmount, on manual completion and when the form is submitted", async () => {
    const { requests } = stubWebOTP();
    const { unmount } = render(<Code experimental_webOTP />);
    await flushMicrotasks();
    unmount();
    expect(requests[0]!.signal.aborted).toBe(true);

    render(<Code length={2} experimental_webOTP />);
    await flushMicrotasks();
    const user = setupUser();
    await user.click(input());
    await user.keyboard("12");
    expect(requests[1]!.signal.aborted).toBe(true);
  });

  it("aborted when the Input's form is submitted", async () => {
    const { requests } = stubWebOTP();
    render(
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <Code experimental_webOTP />
      </form>,
    );
    await flushMicrotasks();
    act(() => (screen.getByTestId("form") as HTMLFormElement).requestSubmit());
    expect(requests[0]!.signal.aborted).toBe(true);
  });

  it("no request with the flag off, or without the API", async () => {
    const { get } = stubWebOTP();
    render(<Code />);
    await flushMicrotasks();
    expect(get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    render(<Code experimental_webOTP inputProps={{ "aria-label": "Second" }} />);
    await flushMicrotasks();
    expect(get).not.toHaveBeenCalled();
  });

  it("read-only: a fill is ignored", async () => {
    const { requests } = stubWebOTP();
    const completeAction = vi.fn<Complete>();
    render(<Code experimental_webOTP readOnly completeAction={completeAction} />);
    await flushMicrotasks();
    await act(async () => requests[0]!.resolve({ code: "123456" }));
    expect(input().value).toBe("");
    expect(completeAction).not.toHaveBeenCalled();
  });
});

// --- Development warnings ------------------------------------------------------------------------

describe("development warnings", () => {
  const messages = (error: ReturnType<typeof silenceErrors>) =>
    error.mock.calls.map(([m]) => String(m));

  it.each([
    ["a missing index", [0, 1, 3], "no Slot has index 2"],
    ["a repeated index", [0, 1, 1, 2], "index 1 is used by more than one Slot"],
    ["an index out of range", [0, 1, 2, 4], "index 4 is outside 0 to 3"],
  ])("%s among the Slots", async (_name, indices, text) => {
    const error = silenceErrors();
    render(
      <OTPField.Root length={4}>
        <OTPField.Input aria-label="Code" />
        {indices.map((i, k) => (
          <OTPField.Slot key={k} index={i} />
        ))}
      </OTPField.Root>,
    );
    await act(async () => {});
    expect(messages(error).some((m) => m.includes(text))).toBe(true);
  });

  it("an unnamed Input", async () => {
    const error = silenceErrors();
    render(
      <OTPField.Root length={1}>
        <OTPField.Input />
        <OTPField.Slot index={0} />
      </OTPField.Root>,
    );
    await act(async () => {});
    expect(messages(error).some((m) => m.includes("no accessible name"))).toBe(true);
  });

  it("no warning for a named, complete field", async () => {
    const error = silenceErrors();
    render(
      <>
        <label htmlFor="c">Code</label>
        <OTPField.Root length={2}>
          <OTPField.Input id="c" />
          <OTPField.Slot index={0} />
          <OTPField.Slot index={1} />
        </OTPField.Root>
      </>,
    );
    await act(async () => {});
    expect(error).not.toHaveBeenCalled();
  });

  it("an invalid length", async () => {
    const error = silenceErrors();
    render(<Code length={0} />);
    await act(async () => {});
    expect(messages(error).some((m) => m.includes("`length` must be a positive integer"))).toBe(
      true,
    );
  });

  it("a part outside its Root throws", () => {
    silenceErrors();
    expect(() => render(<OTPField.Slot index={0} />)).toThrow(
      "OTPField.Slot must be rendered inside an OTPField.Root.",
    );
  });
});
