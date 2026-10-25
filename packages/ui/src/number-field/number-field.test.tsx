// NumberField tests (jsdom), mapped to design/components/number-field.md section 14.1. jsdom has
// full ICU and native constraint validation for `type="number"`, no `:user-invalid` (the Field's
// fallback), no `ariaNotify` (a stub covers that branch; without it nothing is announced), no
// layout. Pointer capture is polyfilled; the hold uses fake timers.
//
// "both" rows run over three wrappers: uncontrolled, a controlled parent that adopts every step,
// and a controlled "update on commit success" parent.
//
// Covered by `number-field.browser.test.tsx` instead: real keys and caret, the native report on
// the visible input, a real wheel and page scroll, a real hold with focus staying put, the
// accessibility tree, `startViewTransition` never called.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommitFixture,
  describeCommitAction,
  eachCommitMode,
} from "../__tests__/commit-action-suite.js";
import type { CommitFixtureProps } from "../__tests__/commit-action-suite.js";
import {
  blur,
  dec,
  hidden,
  inc,
  input,
  key,
  numberFieldDriver,
  Parts,
  pointer,
  press,
  root,
  typeText,
} from "../__tests__/drivers/number-field.js";
import {
  deferred,
  expectNotPending,
  expectPending,
  setupUser,
  PlainButton,
  flushMicrotasks,
  hydrateFromServer,
  silenceErrors,
} from "../__tests__/helpers.js";
import { capturedPointers } from "../__tests__/pointer-capture-shim.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { NumberField } from "./index.js";
import type {
  NumberFieldButtonState,
  NumberFieldRootProps,
  NumberFieldState,
  NumberFieldValueChangeDetails,
} from "./index.js";

type Fn = (next: number | null, details: NumberFieldValueChangeDetails) => unknown;

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.lang = "";
});

// --- Helpers -------------------------------------------------------------------------------------

type FixtureProps = Omit<
  CommitFixtureProps<
    number | null,
    NumberFieldValueChangeDetails,
    NumberFieldValueChangeDetails,
    NumberFieldRootProps
  >,
  "initial"
> & { initial?: number | null };

/** The suite's three wrappers (uncontrolled, adopt, commit) around an en-US field at 1. */
function Fixture({ initial = 1, ...props }: FixtureProps) {
  return <CommitFixture driver={numberFieldDriver} initial={initial} {...props} />;
}

// The two-channel commit rows (async commit, rejection, rollback, no snap under suspending
// content, overlap, superseded rejections, suspending content, mount reconciliation, form reset,
// the post-await rule) come from __tests__/commit-action-suite.tsx with the driver
// __tests__/drivers/number-field.tsx.
describeCommitAction(numberFieldDriver);

// --- Roles and ARIA ------------------------------------------------------------------------------

describe("NumberField", () => {
  describe("roles and ARIA", () => {
    it("renders the section 1 markup", () => {
      render(
        <form>
          <NumberField.Root
            data-testid="root"
            name="quantity"
            defaultValue={1}
            min={1}
            max={99}
            required
            locale="en-US"
            aria-labelledby="extra"
          >
            <Parts />
          </NumberField.Root>
        </form>,
      );
      const label = screen.getByTestId("label");
      expect(root()).toHaveAttribute("role", "group");
      expect(root().getAttribute("aria-labelledby")).toBe(`extra ${label.id}`);
      expect(label).toHaveAttribute("for", input().id);
      expect(input().type).toBe("text");
      expect(input()).not.toHaveAttribute("role");
      for (const attr of [
        "aria-valuenow",
        "aria-valuemin",
        "aria-valuemax",
        "aria-roledescription",
      ]) {
        expect(input()).not.toHaveAttribute(attr);
      }
      expect(input()).toHaveAttribute("inputmode", "decimal");
      expect(input()).toHaveAttribute("autocomplete", "off");
      expect(input()).toHaveAttribute("autocorrect", "off");
      expect(input()).toHaveAttribute("spellcheck", "false");
      expect(input()).not.toHaveAttribute("name");
      expect(input()).not.toHaveAttribute("required");
      expect(input().value).toBe("1");
      const h = hidden();
      expect(h.type).toBe("number");
      expect(h.name).toBe("quantity");
      expect(h).toHaveAttribute("min", "1");
      expect(h).toHaveAttribute("max", "99");
      expect(h).toHaveAttribute("step", "1");
      expect(h.required).toBe(true);
      expect(h).toHaveAttribute("aria-hidden", "true");
      expect(h).toHaveAttribute("tabindex", "-1");
      expect(h.value).toBe("1");
      for (const [button, name] of [
        [inc(), "Increase"],
        [dec(), "Decrease"],
      ] as const) {
        expect(button).toHaveAttribute("type", "button");
        expect(button).toHaveAttribute("tabindex", "-1");
        expect(button).toHaveAttribute("aria-controls", input().id);
        expect(button).toHaveAttribute("aria-label", name);
      }
      // At min: the next step down would change nothing.
      expect(dec()).toBeDisabled();
      expect(dec()).toHaveAttribute("data-disabled", "");
      expect(inc()).toBeEnabled();
      expect(screen.getByRole("group", { name: "Quantity" })).toBe(root());
      expect(screen.getByRole("textbox", { name: "Quantity" })).toBe(input());
    });

    it("inputmode follows the 8.5 rule and a consumer's inputMode replaces it", () => {
      render(
        <>
          <NumberField.Root locale="en-US" format={{ maximumFractionDigits: 0 }}>
            <NumberField.Input data-testid="a" />
          </NumberField.Root>
          <NumberField.Root locale="en-US" format={{ maximumFractionDigits: 0 }} step={0.5}>
            <NumberField.Input data-testid="b" />
          </NumberField.Root>
          <NumberField.Root locale="en-US">
            <NumberField.Input data-testid="c" inputMode="text" />
          </NumberField.Root>
        </>,
      );
      expect(screen.getByTestId("a")).toHaveAttribute("inputmode", "numeric");
      expect(screen.getByTestId("b")).toHaveAttribute("inputmode", "decimal");
      expect(screen.getByTestId("c")).toHaveAttribute("inputmode", "text");
    });

    it("a consumer aria-label replaces the default; aria-labelledby drops it", () => {
      render(
        <NumberField.Root locale="de-DE">
          <NumberField.Increment data-testid="inc" aria-label="Erhöhen" />
          <NumberField.Decrement data-testid="dec" aria-labelledby="x" />
          <NumberField.Input />
        </NumberField.Root>,
      );
      expect(inc()).toHaveAttribute("aria-label", "Erhöhen");
      expect(dec()).not.toHaveAttribute("aria-label");
    });

    it("warns for render type number, NaN, min > max, lang disagreement and an empty aria-label", () => {
      const consoleError = silenceErrors();
      document.documentElement.lang = "de";
      render(
        <>
          <NumberField.Root value={Number.NaN} min={5} max={1}>
            <NumberField.Input render={<input type="number" />} />
            <NumberField.Increment aria-label="" />
          </NumberField.Root>
        </>,
      );
      const messages = consoleError.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes('type="number"'))).toBe(true);
      expect(messages.some((m) => m.includes("finite number"))).toBe(true);
      expect(messages.some((m) => m.includes("greater than `max`"))).toBe(true);
      expect(messages.some((m) => m.includes('lang="de"'))).toBe(true);
      expect(messages.some((m) => m.includes('aria-label=""'))).toBe(true);
    });

    it("does not warn about lang with a locale prop", () => {
      const consoleError = silenceErrors();
      document.documentElement.lang = "de";
      render(
        <NumberField.Root locale="en-US">
          <NumberField.Input />
        </NumberField.Root>,
      );
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("warns for compact notation", () => {
      const consoleError = silenceErrors();
      render(
        <NumberField.Root locale="en-US" format={{ notation: "compact" }}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      expect(consoleError.mock.calls.some((c) => String(c[0]).includes("compact"))).toBe(true);
    });

    it("throws for a part outside a Root", () => {
      silenceErrors();
      expect(() => render(<NumberField.Input />)).toThrow(/inside a NumberField.Root/);
    });
  });

  // --- Typing (both) -------------------------------------------------------------------------------

  eachCommitMode("typing", (mode) => {
    it("keeps a draft per keystroke and commits on blur, once each, with the focusout", async () => {
      const onChange = vi.fn<Fn>();
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onChange={onChange} onCommit={onCommit} />);
      const user = setupUser();
      await user.click(input());
      await user.clear(input());
      await user.type(input(), "42");
      expect(input().value).toBe("42");
      expect(hidden().value).toBe("1");
      expect(onChange).not.toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
      expectNotPending(root());
      await user.tab();
      await flushMicrotasks();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
      const [next, details] = onCommit.mock.calls[0]!;
      expect(next).toBe(42);
      expect(details.reason).toBe("activate");
      expect(details.source).toBe("input");
      expect(details.event?.type).toBe("focusout");
      expect(onChange.mock.calls[0]![0]).toBe(42);
      expect(onChange.mock.calls[0]![1].source).toBe("input");
      expect(hidden().value).toBe("42");
      expect(input().value).toBe("42");
      if (mode !== "uncontrolled") expect(screen.getByTestId("parent")).toHaveTextContent("42");
    });

    it("Enter commits with the keydown, not prevented", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      typeText("7");
      const notPrevented = key("Enter");
      await flushMicrotasks();
      expect(notPrevented).toBe(true);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(7);
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("keydown");
    });

    it("an Enter with keyCode 229 (WebKit's composition-confirming keydown) does nothing", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      typeText("１２");
      key("Enter", { keyCode: 229 });
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("１２");
    });

    it("composition handlers pass through to the visible input", () => {
      const start = vi.fn();
      const end = vi.fn();
      render(
        <NumberField.Root locale="en-US">
          <NumberField.Input
            data-testid="input"
            onCompositionStart={start}
            onCompositionEnd={end}
          />
        </NumberField.Root>,
      );
      fireEvent.compositionStart(input());
      fireEvent.compositionEnd(input());
      expect(start).toHaveBeenCalledTimes(1);
      expect(end).toHaveBeenCalledTimes(1);
    });

    it("Enter during an IME composition does nothing", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      typeText("7");
      key("Enter", { isComposing: true });
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("7");
    });

    it("unparsable text reverts with no dispatch; empty commits null", async () => {
      const onChange = vi.fn<Fn>();
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onChange={onChange} onCommit={onCommit} />);
      typeText("abc");
      blur();
      await flushMicrotasks();
      expect(input().value).toBe("1");
      expect(onCommit).not.toHaveBeenCalled();
      typeText("1,5");
      blur();
      await flushMicrotasks();
      expect(input().value).toBe("1");
      expect(onCommit).not.toHaveBeenCalled();
      typeText("");
      blur();
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBeNull();
      expect(input().value).toBe("");
      expect(hidden().value).toBe("");
    });

    it("a draft equal to the value dispatches nothing and re-formats", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      typeText("1.0");
      blur();
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("1");
    });

    it("typed values are neither clamped nor snapped; the hidden input reports them", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} rootProps={{ min: 0, max: 10, step: 2 }} />);
      typeText("11");
      blur();
      await flushMicrotasks();
      expect(onCommit.mock.calls[0]![0]).toBe(11);
      expect(hidden().validity.rangeOverflow).toBe(true);
      typeText("3");
      blur();
      await flushMicrotasks();
      expect(onCommit.mock.calls[1]![0]).toBe(3);
      expect(hidden().validity.stepMismatch).toBe(true);
      expect(input().validationMessage).toBe(hidden().validationMessage);
      expect(input().validity.customError).toBe(true);
    });

    it("disabled dispatches nothing; readOnly is native", async () => {
      const onCommit = vi.fn<Fn>();
      const { rerender } = render(
        <Fixture mode={mode} onCommit={onCommit} rootProps={{ disabled: true }} />,
      );
      expect(input()).toBeDisabled();
      expect(hidden()).toBeDisabled();
      key("ArrowUp");
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      rerender(<Fixture mode={mode} onCommit={onCommit} rootProps={{ readOnly: true }} />);
      expect(input()).toHaveAttribute("readonly");
      expect(hidden()).toHaveAttribute("readonly");
      expect(inc()).toBeDisabled();
      key("ArrowUp");
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  // --- Keyboard (both) -----------------------------------------------------------------------------

  eachCommitMode("keyboard", (mode) => {
    it("each 4.2 row is a step + commit with the keydown and source keyboard", async () => {
      const onChange = vi.fn<Fn>();
      const onCommit = vi.fn<Fn>();
      render(
        <Fixture
          mode={mode}
          initial={50}
          onChange={onChange}
          onCommit={onCommit}
          rootProps={{ min: 0, max: 100, largeStep: 5 }}
        />,
      );
      const rows: [string, KeyboardEventInit, number][] = [
        ["ArrowUp", {}, 51],
        ["ArrowDown", {}, 50],
        ["ArrowUp", { shiftKey: true }, 55],
        ["ArrowDown", { shiftKey: true }, 50],
        ["PageUp", {}, 55],
        ["PageDown", {}, 50],
        ["Home", {}, 0],
        ["End", {}, 100],
      ];
      for (const [k, init, expected] of rows) {
        const notPrevented = key(k, init);
        await flushMicrotasks();
        expect(notPrevented, k).toBe(false);
        expect(input().value, k).toBe(String(expected));
        expect(hidden().value, k).toBe(String(expected));
      }
      expect(onCommit.mock.calls.map((c) => c[0])).toEqual(rows.map((r) => r[2]));
      expect(onChange.mock.calls.map((c) => c[0])).toEqual(rows.map((r) => r[2]));
      for (const [, details] of onCommit.mock.calls) {
        expect(details.source).toBe("keyboard");
        expect(details.reason).toBe("activate");
        expect(details.event?.type).toBe("keydown");
      }
    });

    it("Shift+Home / Shift+End keep their native text selection", async () => {
      const onCommit = vi.fn<Fn>();
      render(
        <Fixture mode={mode} initial={5} onCommit={onCommit} rootProps={{ min: 0, max: 10 }} />,
      );
      expect(key("Home", { shiftKey: true })).toBe(true);
      expect(key("End", { shiftKey: true })).toBe(true);
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("5");
    });

    it("Home / End without bounds are not handled", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      expect(key("Home")).toBe(true);
      expect(key("End")).toBe(true);
      expect(key("ArrowUp", { altKey: true })).toBe(true);
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("parses an open draft first; empty steps from 0", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      typeText("5");
      key("ArrowUp");
      await flushMicrotasks();
      expect(input().value).toBe("6");
      expect(onCommit.mock.calls[0]![0]).toBe(6);
      typeText("");
      key("ArrowDown");
      await flushMicrotasks();
      expect(input().value).toBe("-1");
    });

    it("auto-repeat dispatches per event; keys on a button do nothing", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode={mode} onCommit={onCommit} />);
      key("ArrowUp");
      key("ArrowUp", { repeat: true });
      key("ArrowUp", { repeat: true });
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(3);
      expect(input().value).toBe("4");
      expect(key("ArrowUp", {}, inc())).toBe(true);
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(3);
    });
  });

  // --- Hold ----------------------------------------------------------------------------------------

  describe("hold", () => {
    it("steps at the press, after 400 ms, then every 60 ms; commits once at the release", async () => {
      vi.useFakeTimers();
      const onChange = vi.fn<Fn>();
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onChange={onChange} onCommit={onCommit} />);
      const notPrevented = pointer("pointerDown", inc());
      expect(notPrevented).toBe(false);
      expect(capturedPointers.get(1)).toBe(inc());
      expect(input().value).toBe("2");
      expect(onCommit).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(399));
      expect(input().value).toBe("2");
      act(() => vi.advanceTimersByTime(1));
      expect(input().value).toBe("3");
      act(() => vi.advanceTimersByTime(120));
      expect(input().value).toBe("5");
      expect(hidden().value).toBe("5");
      pointer("pointerUp", inc());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(onChange.mock.calls.map((c) => c[0])).toEqual([2, 3, 4, 5]);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(5);
      expect(onCommit.mock.calls[0]![1].source).toBe("increment");
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("pointerup");
      // The release stops the timers.
      act(() => vi.advanceTimersByTime(1000));
      expect(input().value).toBe("5");
    });

    it.each(["pointerCancel", "lostpointercapture", "blur"] as const)(
      "%s ends the hold and commits",
      async (end) => {
        vi.useFakeTimers();
        const onCommit = vi.fn<Fn>();
        render(<Fixture mode="uncontrolled" onCommit={onCommit} />);
        pointer("pointerDown", dec());
        act(() => {
          if (end === "pointerCancel") {
            fireEvent.pointerCancel(dec(), { pointerId: 1 });
          } else if (end === "lostpointercapture") {
            dec().dispatchEvent(Object.assign(new Event("lostpointercapture"), { pointerId: 1 }));
          } else {
            window.dispatchEvent(new Event("blur"));
          }
        });
        await act(async () => {
          await vi.runOnlyPendingTimersAsync();
        });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit.mock.calls[0]![0]).toBe(0);
      },
    );

    it("a hold reaching max ends itself and commits", async () => {
      vi.useFakeTimers();
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ max: 3 }} />);
      pointer("pointerDown", inc());
      act(() => vi.advanceTimersByTime(400));
      expect(input().value).toBe("3");
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(3);
      expect(inc()).toBeDisabled();
      expect(inc()).toHaveAttribute("data-disabled", "");
    });

    it("+ then − back to the start commits nothing; a second pointer is ignored", async () => {
      const onCommit = vi.fn<Fn>();
      const onChange = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onCommit={onCommit} onChange={onChange} />);
      pointer("pointerDown", inc());
      pointer("pointerDown", inc(), { pointerId: 2 });
      pointer("pointerUp", inc(), { pointerId: 2 });
      expect(input().value).toBe("2");
      pointer("pointerUp", inc());
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(1);
      press(dec());
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(onCommit.mock.calls[1]![0]).toBe(1);
    });

    it("contextmenu during the hold is prevented; not otherwise", () => {
      render(<Fixture mode="uncontrolled" />);
      expect(fireEvent.contextMenu(inc())).toBe(true);
      pointer("pointerDown", inc());
      expect(fireEvent.contextMenu(inc())).toBe(false);
      pointer("pointerUp", inc());
    });

    it("a click with detail 0 and no pointerdown steps and commits once; a click after a hold is ignored", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onCommit={onCommit} />);
      act(() => {
        fireEvent.click(inc(), { detail: 0 });
      });
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![1].source).toBe("increment");
      expect(onCommit.mock.calls[0]![1].event?.type).toBe("click");
      expect(input().value).toBe("2");
      pointer("pointerDown", inc());
      pointer("pointerUp", inc());
      act(() => {
        fireEvent.click(inc(), { detail: 0 });
      });
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(input().value).toBe("3");
      act(() => {
        fireEvent.click(inc(), { detail: 1 });
      });
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(2);
    });

    it("while a draft is open the bound state follows the draft", async () => {
      const onCommit = vi.fn<Fn>();
      render(
        <Fixture mode="uncontrolled" initial={99} onCommit={onCommit} rootProps={{ max: 99 }} />,
      );
      expect(inc()).toBeDisabled();
      typeText("50");
      expect(inc()).toBeEnabled();
      press(inc());
      await flushMicrotasks();
      expect(input().value).toBe("51");
      expect(onCommit.mock.calls[0]![0]).toBe(51);
      // An unparsable draft: the shown value decides.
      typeText("abc");
      expect(inc()).toBeEnabled();
      typeText("99");
      expect(inc()).toBeDisabled();
    });

    it("disabled, readOnly and at-bound buttons do nothing", async () => {
      const onCommit = vi.fn<Fn>();
      const { rerender } = render(
        <Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ disabled: true }} />,
      );
      press(inc());
      act(() => {
        fireEvent.click(inc(), { detail: 0 });
      });
      rerender(<Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ readOnly: true }} />);
      press(inc());
      rerender(<Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ min: 1 }} />);
      expect(dec()).toBeDisabled();
      press(dec());
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
    });

    // #83
    describe("disabled on component renders (design/components/button.md 17.3)", () => {
      const cases = [
        ["the prop", { disabled: true }, {}],
        ["readOnly", {}, { readOnly: true }],
        ["the bound", {}, { max: 1 }],
      ] as const;

      function Box({
        own,
        rootProps,
        element,
        onChange,
      }: {
        own: { disabled?: boolean };
        rootProps: Partial<NumberFieldRootProps>;
        element?: ReactElement<ComponentPropsWithRef<"button">>;
        onChange: Fn;
      }) {
        return (
          <NumberField.Root
            data-testid="root"
            locale="en-US"
            defaultValue={1}
            valueChangeAction={onChange}
            {...rootProps}
          >
            <NumberField.Input data-testid="input" />
            <NumberField.Increment data-testid="inc" {...own} render={element}>
              +
            </NumberField.Increment>
          </NumberField.Root>
        );
      }

      it.each(cases)(
        "disabled by %s with a component render: aria-disabled, no step on click or hold",
        async (_, own, rootProps) => {
          vi.useFakeTimers();
          const onChange = vi.fn<Fn>();
          render(
            <Box own={own} rootProps={rootProps} element={<PlainButton />} onChange={onChange} />,
          );
          expect(inc()).toHaveAttribute("aria-disabled", "true");
          expect(inc()).not.toHaveAttribute("disabled");
          expect(inc()).toHaveAttribute("data-disabled", "");
          pointer("pointerDown", inc());
          act(() => {
            vi.advanceTimersByTime(1000);
          });
          pointer("pointerUp", inc());
          let notCancelled = true;
          act(() => {
            notCancelled = fireEvent.click(inc(), { detail: 0 });
          });
          expect(notCancelled).toBe(false); // cancelled: a link render does not navigate
          // A pointer click (`detail > 0`) is cancelled too (wave 9 review L2).
          act(() => {
            notCancelled = fireEvent.click(inc(), { detail: 1 });
          });
          expect(notCancelled).toBe(false);
          await flushMicrotasks();
          expect(onChange).not.toHaveBeenCalled();
          expect(input().value).toBe("1");
        },
      );

      it.each(cases)(
        "disabled by %s with a component render: a press keeps focus in the input",
        async (_, own, rootProps) => {
          render(
            <Box
              own={own}
              rootProps={rootProps}
              element={<PlainButton />}
              onChange={vi.fn<Fn>()}
            />,
          );
          act(() => input().focus());
          expect(pointer("pointerDown", inc())).toBe(false); // the press is cancelled
          pointer("pointerUp", inc());
          const user = setupUser();
          await user.pointer({ keys: "[MouseLeft]", target: inc() });
          expect(document.activeElement).toBe(input());
        },
      );

      it.each(cases)(
        "disabled by %s with a host button: native disabled (unchanged)",
        (_, own, rootProps) => {
          render(<Box own={own} rootProps={rootProps} onChange={vi.fn<Fn>()} />);
          expect(inc()).toBeDisabled();
          expect(inc()).not.toHaveAttribute("aria-disabled");
        },
      );
    });

    it("data-pending lands on the button whose gesture is pending", async () => {
      const d = deferred();
      render(<Fixture mode="uncontrolled" onCommit={() => d.promise} />);
      press(inc());
      await flushMicrotasks();
      expectPending(inc());
      expectNotPending(dec());
      expectPending(root());
      expectPending(input());
      expectPending(screen.getByTestId("label"));
      await act(async () => d.resolve());
      expectNotPending(inc());
      expectNotPending(root());
    });

    it("focus stays where it was (no focus call)", () => {
      render(<Fixture mode="uncontrolled" />);
      input().focus();
      press(inc());
      expect(document.activeElement).toBe(input());
    });
  });

  // --- Wheel ---------------------------------------------------------------------------------------

  describe("wheel", () => {
    function wheel(deltaY: number): boolean {
      let result = true;
      act(() => {
        result = input().dispatchEvent(new WheelEvent("wheel", { deltaY, cancelable: true }));
      });
      return result;
    }

    it("steps per event while focused, prevented, source wheel", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ stepOnWheel: true }} />);
      expect(wheel(-1)).toBe(true);
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      input().focus();
      expect(wheel(-1)).toBe(false);
      expect(wheel(-3)).toBe(false);
      expect(wheel(1)).toBe(false);
      await flushMicrotasks();
      expect(onCommit.mock.calls.map((c) => c[0])).toEqual([2, 3, 2]);
      expect(onCommit.mock.calls[0]![1].source).toBe("wheel");
    });

    it("does nothing without the prop", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onCommit={onCommit} />);
      input().focus();
      expect(wheel(-1)).toBe(true);
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("the listener is non-passive", () => {
      const spy = vi.spyOn(HTMLInputElement.prototype, "addEventListener");
      render(<Fixture mode="uncontrolled" rootProps={{ stepOnWheel: true }} />);
      expect(spy).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    });
  });

  // --- Hidden input and the mirror -----------------------------------------------------------------

  describe("hidden input and the mirror", () => {
    it("is written synchronously in the event and re-applied after commits", async () => {
      let inEvent = "";
      render(<Fixture mode="uncontrolled" rootProps={{ max: 5 }} />);
      input().addEventListener("keydown", () => {
        queueMicrotask(() => {
          inEvent = hidden().value;
        });
      });
      key("ArrowUp");
      expect(hidden().value).toBe("2");
      await flushMicrotasks();
      expect(inEvent).toBe("2");
    });

    it("mirrors the hidden input's validity; a changed max re-mirrors", async () => {
      const { rerender } = render(
        <Fixture mode="uncontrolled" initial={8} rootProps={{ max: 10 }} />,
      );
      expect(input().validationMessage).toBe("");
      expect(input().validity.valid).toBe(true);
      rerender(<Fixture mode="uncontrolled" initial={8} rootProps={{ max: 5 }} />);
      expect(hidden().validity.rangeOverflow).toBe(true);
      expect(input().validationMessage).toBe(hidden().validationMessage);
      expect(input().validity.customError).toBe(true);
      rerender(<Fixture mode="uncontrolled" initial={8} rootProps={{ max: 10 }} />);
      expect(input().validationMessage).toBe("");
    });

    it("defaultValue attribute is the reset target (uncontrolled latest, controlled mount-time)", () => {
      function Latest() {
        const [d, setD] = useState(1);
        return (
          <>
            <NumberField.Root defaultValue={d} locale="en-US">
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
            <button type="button" onClick={() => setD(9)}>
              change
            </button>
          </>
        );
      }
      render(<Latest />);
      fireEvent.click(screen.getByText("change"));
      expect(hidden().getAttribute("value")).toBe("9");
      expect(hidden().value).toBe("1");
    });

    it("a reset clears a draft even when the value is already the target (no dispatch)", async () => {
      const onCommit = vi.fn<Fn>();
      render(
        <form data-testid="form">
          <Fixture mode="uncontrolled" onCommit={onCommit} rootProps={{ name: "quantity" }} />
        </form>,
      );
      typeText("8");
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushMicrotasks();
      expect(input().value).toBe("1");
      expect(hidden().value).toBe("1");
      // The draft is gone, not only overwritten in the DOM: the blur has nothing to commit.
      blur();
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("1");
    });

    it("the hidden input is autocomplete=off (no form-state restoration the text does not show)", () => {
      render(<Fixture mode="uncontrolled" />);
      expect(hidden()).toHaveAttribute("autocomplete", "off");
    });

    it("a step finer than the format is rounded like a typed value: text and FormData agree", async () => {
      const onCommit = vi.fn<Fn>();
      render(
        <form data-testid="form">
          <Fixture
            mode="uncontrolled"
            onCommit={onCommit}
            rootProps={{
              name: "price",
              step: 0.001,
              format: { style: "currency", currency: "EUR" },
            }}
          />
        </form>,
      );
      // 1 + 0.001 = 1.001, which the euro format shows as €1.00: rounded to 1, no change.
      key("ArrowUp");
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(hidden().value).toBe("1");
      key("PageUp");
      await flushMicrotasks();
      // + 0.01 (10 steps): €1.01, and the form posts 1.01.
      expect(input().value).toBe("€1.01");
      expect(onCommit.mock.calls[0]![0]).toBe(1.01);
      expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("price")).toBe("1.01");
    });

    it("invalid on the hidden input is always cancelled; on the visible not (bare)", () => {
      const ref = { current: null as HTMLInputElement | null };
      render(
        <NumberField.Root required locale="en-US">
          <NumberField.Input data-testid="input" hiddenInputRef={ref} />
        </NumberField.Root>,
      );
      expect(ref.current).toBe(hidden());
      const hiddenInvalid = new Event("invalid", { cancelable: true });
      hidden().dispatchEvent(hiddenInvalid);
      expect(hiddenInvalid.defaultPrevented).toBe(true);
      const visibleInvalid = new Event("invalid", { cancelable: true });
      input().dispatchEvent(visibleInvalid);
      expect(visibleInvalid.defaultPrevented).toBe(false);
      expect(hidden().validity.valueMissing).toBe(true);
      expect(input().validationMessage).toBe(hidden().validationMessage);
    });
  });

  // --- Steps and commits ---------------------------------------------------------------------------

  describe("steps run in transitions", () => {
    it("without a valueChangeAction a step starts no transition; the text holds until the commit", async () => {
      vi.useFakeTimers();
      render(
        <NumberField.Root data-testid="root" locale="en-US" value={1}>
          <Parts />
        </NumberField.Root>,
      );
      pointer("pointerDown", inc());
      expectNotPending(root());
      expect(input().value).toBe("2");
      act(() => vi.advanceTimersByTime(400));
      expect(input().value).toBe("3");
      pointer("pointerUp", inc());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      // A non-adopting controlled parent: back to `value`, once.
      expect(input().value).toBe("1");
    });
  });

  describe("rollback with the field mounted", () => {
    function Parent({ d, onChange }: { d: Promise<void>; onChange?: Fn }) {
      const [value, setValue] = useState<number | null>(1);
      return (
        <>
          <NumberField.Root
            data-testid="root"
            locale="en-US"
            value={value}
            valueChangeAction={onChange}
            valueCommitAction={async (next) => {
              try {
                await d;
                startTransition(() => setValue(next));
              } catch {
                // The parent keeps its value.
              }
            }}
          >
            <Parts />
          </NumberField.Root>
          <output data-testid="parent">{String(value)}</output>
        </>
      );
    }

    it("a draft open at the rollback stays open and commits later", async () => {
      const d = deferred();
      render(<Parent d={d.promise} />);
      typeText("5");
      blur();
      await flushMicrotasks();
      typeText("7");
      await act(async () => d.reject(new Error("x")));
      expect(input().value).toBe("7");
      expect(hidden().value).toBe("1");
    });
  });

  describe("no snap", () => {
    it("between two ticks with a sync step action the text shows the last tick", async () => {
      vi.useFakeTimers();
      const onChange = vi.fn<Fn>();
      render(<Fixture mode="uncontrolled" onChange={onChange} />);
      pointer("pointerDown", inc());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(input().value).toBe("2");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(input().value).toBe("3");
      pointer("pointerUp", inc());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(input().value).toBe("3");
    });
  });

  // --- Platform paths ------------------------------------------------------------------------------

  const hydrate = (ui: ReactNode, mutate: (container: HTMLElement) => void) =>
    hydrateFromServer(ui, { mutate });

  const visibleIn = (c: HTMLElement) => c.querySelector('input[type="text"]') as HTMLInputElement;

  eachCommitMode("mount reconciliation", (mode) => {
    it("focused, unparsable text at hydration stays as the draft (never overwritten under the caret)", async () => {
      const onCommit = vi.fn<Fn>();
      await hydrate(<Fixture mode={mode} onCommit={onCommit} />, (c) => {
        visibleIn(c).value = "12,";
        visibleIn(c).focus();
      });
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("12,");
      expect(document.activeElement).toBe(input());
      expect(hidden().value).toBe("1");
      // The blur resolves it by the ordinary rule: `12,` is not a number under en-US, so it reverts.
      blur();
      await flushMicrotasks();
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("1");
    });

    it("a focused input adopts the text as the draft; the blur commits", async () => {
      const onCommit = vi.fn<Fn>();
      await hydrate(<Fixture mode={mode} onCommit={onCommit} />, (c) => {
        visibleIn(c).value = "6";
        visibleIn(c).focus();
      });
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("6");
      blur();
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(6);
    });

    it("another locale's text for the same value: no dispatch, the text is re-synced", async () => {
      const onCommit = vi.fn<Fn>();
      await hydrate(<Fixture mode={mode} initial={1234.5} onCommit={onCommit} />, (c) => {
        visibleIn(c).value = "1.234,5";
      });
      expect(onCommit).not.toHaveBeenCalled();
      expect(input().value).toBe("1,234.5");
    });
  });

  describe("forms", () => {
    it("posts String(value), nothing when disabled, '' when empty; honours form", () => {
      render(
        <>
          <form data-testid="f" id="f" />
          <form data-testid="g">
            <NumberField.Root name="a" defaultValue={1.5} locale="de-DE">
              <NumberField.Input />
            </NumberField.Root>
            <NumberField.Root name="b" defaultValue={2} disabled>
              <NumberField.Input />
            </NumberField.Root>
            <NumberField.Root name="c">
              <NumberField.Input />
            </NumberField.Root>
            <NumberField.Root name="d" defaultValue={4} form="f">
              <NumberField.Input />
            </NumberField.Root>
          </form>
        </>,
      );
      const data = new FormData(screen.getByTestId("g") as HTMLFormElement);
      expect(data.get("a")).toBe("1.5");
      expect(data.get("b")).toBeNull();
      expect(data.get("c")).toBe("");
      expect(data.get("d")).toBeNull();
      expect([...data.keys()]).toEqual(["a", "c"]);
      expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("d")).toBe("4");
    });

    it("Enter's implicit submission sees the committed value", async () => {
      const seen: (string | null)[] = [];
      render(
        <form
          data-testid="form"
          onSubmit={(e) => {
            e.preventDefault();
            seen.push(new FormData(e.currentTarget).get("quantity") as string | null);
          }}
        >
          <NumberField.Root name="quantity" defaultValue={1} locale="en-US">
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
          <button type="submit">save</button>
        </form>,
      );
      const user = setupUser();
      await user.click(input());
      await user.clear(input());
      await user.type(input(), "12{Enter}");
      expect(seen).toEqual(["12"]);
    });
  });

  // --- Inside a Field ------------------------------------------------------------------------------

  describe("inside a Field.Root", () => {
    it("wiring", async () => {
      render(
        <Field.Root name="quantity" disabled required>
          <Field.Label data-testid="field-label">Quantity</Field.Label>
          <NumberField.Root data-testid="root" locale="en-US" aria-labelledby="consumer">
            <NumberField.Label data-testid="label">Qty</NumberField.Label>
            <NumberField.Decrement data-testid="dec" />
            <NumberField.Input data-testid="input" aria-describedby="own" />
            <NumberField.Increment data-testid="inc" />
          </NumberField.Root>
          <Field.Description data-testid="desc">Packs of six.</Field.Description>
        </Field.Root>,
      );
      await flushMicrotasks();
      const fieldLabel = screen.getByTestId("field-label");
      expect(fieldLabel).toHaveAttribute("for", input().id);
      expect(screen.getByTestId("label")).toHaveAttribute("for", input().id);
      expect(hidden().name).toBe("quantity");
      expect(hidden().required).toBe(true);
      expect(input()).not.toHaveAttribute("name");
      expect(input()).not.toHaveAttribute("required");
      expect(input()).toBeDisabled();
      expect(hidden()).toBeDisabled();
      expect(inc()).toBeDisabled();
      expect(dec()).toBeDisabled();
      expect(input()).toHaveAttribute("aria-describedby", `own ${screen.getByTestId("desc").id}`);
      expect(input()).toHaveAttribute("aria-invalid", "false");
      expect(hidden()).not.toHaveAttribute("aria-invalid");
      expect(root().getAttribute("aria-labelledby")).toBe(
        `consumer ${screen.getByTestId("label").id} ${fieldLabel.id}`,
      );
    });

    it("flags come from the hidden input; the visible mirrors", async () => {
      let seen: { stepMismatch: boolean; message: string } | undefined;
      render(
        <Field.Root name="quantity">
          <NumberField.Root locale="en-US" min={6} max={120} step={6} defaultValue={6}>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
          <Field.Error>
            {({ validity, messages }) => {
              seen = { stepMismatch: validity.stepMismatch, message: messages[0] ?? "" };
              return validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ");
            }}
          </Field.Error>
        </Field.Root>,
      );
      typeText("7");
      blur();
      await flushMicrotasks();
      // jsdom has no `:user-invalid`: a submission attempt (an `invalid` event) shows it.
      act(() => {
        input().dispatchEvent(new Event("invalid", { cancelable: true }));
      });
      await flushMicrotasks();
      expect(seen?.stepMismatch).toBe(true);
      expect(seen?.message).toBe(hidden().validationMessage);
      expect(input().validationMessage).toBe(hidden().validationMessage);
      expect(input().validity.customError).toBe(true);
      expect(screen.getByText("Enter a multiple of six.")).toBeInTheDocument();
    });

    it("the slot is on the hidden input; validate reads the hidden value, not the draft", async () => {
      const validate = vi.fn((v: string) => (Number(v) % 6 === 0 ? null : "Sold in packs of six."));
      render(
        <form>
          <Field.Root name="quantity" validate={validate}>
            <NumberField.Root locale="en-US" defaultValue={6}>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
          </Field.Root>
        </form>,
      );
      await flushMicrotasks();
      validate.mockClear();
      typeText("7");
      await flushMicrotasks();
      expect(validate).toHaveBeenLastCalledWith("6", expect.any(FormData));
      blur();
      await flushMicrotasks();
      expect(validate).toHaveBeenLastCalledWith("7", expect.any(FormData));
      expect(hidden().validity.customError).toBe(true);
      expect(hidden().validationMessage).toBe("Sold in packs of six.");
      expect(input().validationMessage).toBe("Sold in packs of six.");
    });

    it("submit attempt: the hidden invalid is cancelled always; the visible when a Field.Error is mounted; focus goes to the visible input", async () => {
      render(
        <form data-testid="form">
          <Field.Root name="quantity" required>
            <NumberField.Root locale="en-US">
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
            <Field.Error />
          </Field.Root>
          <input data-testid="other" />
        </form>,
      );
      screen.getByTestId("other").focus();
      const events: Event[] = [];
      const record = (e: Event) => events.push(e);
      input().addEventListener("invalid", record);
      hidden().addEventListener("invalid", record);
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
      });
      await flushMicrotasks();
      const visibleEvent = events.find((e) => e.target === input());
      const hiddenEvent = events.find((e) => e.target === hidden());
      expect(hiddenEvent?.defaultPrevented).toBe(true);
      expect(visibleEvent?.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input());
    });

    it("without a Field.Error the visible invalid is not cancelled", async () => {
      render(
        <form data-testid="form">
          <Field.Root name="quantity" required>
            <NumberField.Root locale="en-US">
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
          </Field.Root>
        </form>,
      );
      const events: Event[] = [];
      input().addEventListener("invalid", (e) => events.push(e));
      await act(async () => {
        (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
      });
      expect(events[0]?.defaultPrevented).toBe(false);
    });

    it("a server error is dismissed by a + press; a platform reset keeps a shown server error", async () => {
      render(
        <Form.Root data-testid="form" errors={{ quantity: "Only 24 left." }}>
          <Field.Root name="quantity" data-testid="field">
            <NumberField.Root data-testid="root" locale="en-US" defaultValue={1}>
              <Parts />
            </NumberField.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form.Root>,
      );
      await flushMicrotasks();
      expect(screen.getByTestId("error")).toHaveTextContent("Only 24 left.");
      expect(input()).toHaveAttribute("aria-invalid", "true");
      expect(root()).toHaveAttribute("data-invalid", "");
      expect(input()).toHaveAttribute("data-invalid", "");
      expect(hidden().validationMessage).toBe("Only 24 left.");
      expect(input().validationMessage).toBe("Only 24 left.");
      press(inc());
      await flushMicrotasks();
      expect(screen.queryByTestId("error")).toBeNull();
      expect(input().validationMessage).toBe("");
    });

    it("a platform reset notifies with edit = false: a shown server error stays", async () => {
      const onCommit = vi.fn<Fn>();
      function Latest() {
        const [d, setD] = useState(1);
        return (
          <Form.Root data-testid="form" errors={{ quantity: "Only 24 left." }}>
            <Field.Root name="quantity">
              <NumberField.Root
                data-testid="root"
                locale="en-US"
                defaultValue={d}
                valueCommitAction={onCommit}
              >
                <Parts />
              </NumberField.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => setD(5)}>
              change default
            </button>
          </Form.Root>
        );
      }
      render(<Latest />);
      await flushMicrotasks();
      fireEvent.click(screen.getByText("change default"));
      await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledWith(5, expect.objectContaining({ reason: "platform" }));
      expect(input().value).toBe("5");
      expect(screen.getByTestId("error")).toHaveTextContent("Only 24 left.");
    });

    it("two channels: the commit pends on Root, Input and button; the Field's data-pending follows the form", async () => {
      const d = deferred();
      render(
        <Field.Root name="quantity" data-testid="field">
          <NumberField.Root
            data-testid="root"
            locale="en-US"
            defaultValue={1}
            valueCommitAction={() => d.promise}
          >
            <Parts />
          </NumberField.Root>
        </Field.Root>,
      );
      press(inc());
      await flushMicrotasks();
      expectPending(root());
      expectPending(input());
      expectPending(inc());
      expectNotPending(screen.getByTestId("field"));
      await act(async () => d.resolve());
    });

    it("Field.Root required: the hidden input is required; an empty commit is valueMissing, mirrored", async () => {
      render(
        <Field.Root name="quantity" required data-testid="field">
          <NumberField.Root locale="en-US" defaultValue={1}>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
        </Field.Root>,
      );
      await flushMicrotasks();
      expect(screen.getByTestId("field")).toHaveAttribute("data-required", "");
      typeText("");
      blur();
      await flushMicrotasks();
      expect(hidden().validity.valueMissing).toBe(true);
      expect(input().validationMessage).toBe(hidden().validationMessage);
      expect(input().validationMessage).not.toBe("");
    });
  });

  // --- Announcements -------------------------------------------------------------------------------

  describe("announcements", () => {
    it("ariaNotify on the visible input per key press, wheel, click and hold release; never per tick or for a typed commit", async () => {
      const notify = vi.fn();
      (Element.prototype as unknown as { ariaNotify?: unknown }).ariaNotify = notify;
      try {
        vi.useFakeTimers();
        render(
          <Fixture
            mode="uncontrolled"
            initial={1000}
            rootProps={{
              stepOnWheel: true,
              announce: (value, state) => (value === 1003 ? null : `now ${state.text}`),
            }}
          />,
        );
        key("ArrowUp");
        expect(notify).toHaveBeenLastCalledWith("now 1,001");
        expect(notify.mock.contexts[0]).toBe(input());
        input().focus();
        act(() => {
          input().dispatchEvent(new WheelEvent("wheel", { deltaY: -1, cancelable: true }));
        });
        expect(notify).toHaveBeenLastCalledWith("now 1,002");
        act(() => {
          fireEvent.click(inc(), { detail: 0 });
        });
        // 1003: the consumer's `announce` returned null.
        expect(notify).toHaveBeenCalledTimes(2);
        pointer("pointerDown", inc());
        act(() => vi.advanceTimersByTime(520));
        expect(notify).toHaveBeenCalledTimes(2);
        pointer("pointerUp", inc());
        expect(notify).toHaveBeenCalledTimes(3);
        expect(notify).toHaveBeenLastCalledWith("now 1,007");
        typeText("5");
        blur();
        expect(notify).toHaveBeenCalledTimes(3);
        await act(async () => {
          await vi.runOnlyPendingTimersAsync();
        });
      } finally {
        delete (Element.prototype as unknown as { ariaNotify?: unknown }).ariaNotify;
      }
    });

    // #113 A1
    it("without ariaNotify, steps announce nothing and insert no live region", () => {
      vi.useFakeTimers();
      render(<Fixture mode="uncontrolled" />);
      expect(() => key("ArrowUp")).not.toThrow();
      act(() => vi.advanceTimersByTime(2000));
      expect(input()).toHaveValue("2");
      expect(document.querySelector('[role="status"], [aria-live]')).toBeNull();
    });
  });

  // --- Function props / render ---------------------------------------------------------------------

  describe("function props and render", () => {
    it("every part receives its documented state", async () => {
      const d = deferred();
      const buttonStates: NumberFieldButtonState[] = [];
      render(
        <NumberField.Root
          data-testid="root"
          locale="en-US"
          defaultValue={5}
          max={6}
          required
          valueCommitAction={() => d.promise}
          className={(s) => (s.pending ? "pending" : "idle")}
        >
          {(s: NumberFieldState) => (
            <>
              <span data-testid="text">{`${s.text}|${String(s.value)}|${s.required}`}</span>
              <NumberField.Label data-testid="label" className={(l) => `label-${l.text}`}>
                Q
              </NumberField.Label>
              <NumberField.Input
                data-testid="input"
                style={(i) => ({ width: `${i.text.length}ch` })}
              />
              <NumberField.Increment
                data-testid="inc"
                className={(b) => {
                  buttonStates.push(b);
                  return b.disabled ? "off" : "on";
                }}
              >
                {(b) => (b.pending ? "…" : "+")}
              </NumberField.Increment>
            </>
          )}
        </NumberField.Root>,
      );
      expect(screen.getByTestId("text")).toHaveTextContent("5|5|true");
      expect(screen.getByTestId("label")).toHaveClass("label-5");
      expect(input().style.width).toBe("1ch");
      expect(inc()).toHaveClass("on");
      press(inc());
      await flushMicrotasks();
      expect(root()).toHaveClass("pending");
      expect(inc()).toHaveTextContent("…");
      expect(inc()).toHaveClass("off");
      expect(buttonStates.at(-1)).toEqual({ pending: true, disabled: true });
      await act(async () => d.resolve());
      expect(root()).toHaveClass("idle");
    });

    it("render: a search input keeps the handlers and the hidden sibling; a button rendered as <a> gets no type", async () => {
      const onCommit = vi.fn<Fn>();
      render(
        <NumberField.Root locale="en-US" defaultValue={1} valueCommitAction={onCommit}>
          <NumberField.Input
            data-testid="input"
            render={<input type="search" className="x" />}
            className="y"
          />
          <NumberField.Increment data-testid="inc" render={<a href="#inc" />} />
        </NumberField.Root>,
      );
      expect(input().type).toBe("search");
      expect(input()).toHaveClass("x");
      expect(input()).toHaveClass("y");
      expect(hidden().type).toBe("number");
      expect(inc()).not.toHaveAttribute("type");
      expect(inc().tagName).toBe("A");
      key("ArrowUp");
      await flushMicrotasks();
      expect(onCommit).toHaveBeenCalledWith(2, expect.anything());
    });
  });
});
