// Select, jsdom rows of design/components/select.md section 14.1. Rows that need a real engine
// (customizable select rendering, the real parser cloning into <selectedcontent>, the automatic
// refresh, the picker, `:open`, `:user-invalid`, stacking inside Popover / Dialog, the
// accessibility tree, ViewTransition) are in select.browser.test.tsx. The directive row is in
// src/__tests__/directives.test.ts.
//
// Keyboard: N/A here. The keyboard is entirely the engine's (design section 8; the library
// installs no key handler); jsdom has no select keyboard model, so value changes go through
// `user.selectOptions()`, which sets the value and fires `input` + `change` like a pick.
//
// jsdom facts the tests rely on (memo/developer/select.md): no `HTMLSelectedContentElement` (the
// Value's observer is not installed unless a test stubs it); the parser is the old one, so server
// HTML set through `innerHTML` drops `<button>`, `<selectedcontent>`, `<legend>` and tags inside
// options: hydration rows render text-only options without Trigger / Value. Option selectedness,
// dirtiness, `defaultSelected` and `form.reset()` follow the spec.
//
// About "rejection rolls the DOM back": a rejected action reaches the Error Boundary above the
// Root, which replaces the Select, so the rollback is asserted where the Select stays mounted (a
// controlled veto, a rejection caught inside the action, a refused platform dispatch).
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, use, useLayoutEffect, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushMicrotasks,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { Select } from "./index.js";
import type {
  SelectOptionState,
  SelectRootProps,
  SelectRootState,
  SelectValueChangeDetails,
} from "./index.js";

type Details = SelectValueChangeDetails;
type ActionFn = (next: string, details: Details) => unknown;

interface HarnessProps extends Omit<
  SelectRootProps,
  "value" | "defaultValue" | "valueChangeAction" | "children"
> {
  mode: ControlMode;
  initial?: string;
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Controlled only: refuse `"platform"` dispatches (default: adopt them). */
  refusePlatform?: boolean;
  /** Wrap only the Select in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Render the committed value through a suspender, everything inside one Suspense boundary. */
  suspender?: ReturnType<typeof createSuspender>;
  /** Wrap the Select in a `<form>` with a reset button. */
  inForm?: boolean;
  options?: readonly string[];
  disabledOptions?: readonly string[];
  /** Render `Select.Trigger` + `Select.Value` (not for hydration rows: jsdom's parser drops them). */
  trigger?: boolean;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows the "update on success"
 * pattern; the uncontrolled variant mirrors the committed value in a sibling.
 */
function Harness({
  mode,
  initial = "a",
  action,
  catchErrors = false,
  refusePlatform = false,
  boundary,
  suspender,
  inForm = false,
  options = ["a", "b", "c"],
  disabledOptions = [],
  trigger = true,
  ...rest
}: HarnessProps) {
  const [committed, setCommitted] = useState(initial);
  const [error, setError] = useState<unknown>(null);

  const valueChangeAction = async (next: string, details: Details) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    if (mode === "controlled" && refusePlatform && details.reason === "platform") return;
    startTransition(() => setCommitted(next));
  };

  const modeProps = mode === "controlled" ? { value: committed } : { defaultValue: initial };
  let select: ReactNode = (
    <Select.Root aria-label="Fruit" {...modeProps} valueChangeAction={valueChangeAction} {...rest}>
      {trigger && (
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
      )}
      {options.map((v) => (
        <Select.Option key={v} value={v} disabled={disabledOptions.includes(v)}>
          {v === "" ? "Choose" : v.toUpperCase()}
        </Select.Option>
      ))}
    </Select.Root>
  );
  if (boundary) select = <ErrorCatcher onError={boundary}>{select}</ErrorCatcher>;
  if (inForm) {
    select = (
      <form data-testid="form">
        {select}
        <button type="reset">Reset</button>
      </form>
    );
  }

  const content = (
    <>
      {select}
      <output data-testid="committed">{committed}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
      {suspender && <suspender.Suspender value={committed} />}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
const opt = (v: string) => sel().querySelector<HTMLOptionElement>(`option[value="${v}"]`)!;
const allOptions = () => [...sel().options];
const committed = () => screen.getByTestId("committed");
const dataSelected = () =>
  allOptions()
    .filter((o) => o.hasAttribute("data-selected"))
    .map((o) => o.value);
const dataPending = () =>
  allOptions()
    .filter((o) => o.hasAttribute("data-pending"))
    .map((o) => o.value);
const defaultSelected = () =>
  allOptions()
    .filter((o) => o.defaultSelected)
    .map((o) => o.value);
const form = () => screen.getByTestId("form") as HTMLFormElement;

// React warns once per file that `<selectedcontent>` is an unknown tag (jsdom has no customizable
// select). Take that warning before any row, so the rows asserting no `console.error` do not
// depend on running after another row that rendered a Select (#101: failed under
// --sequence.shuffle). The expectation below fails the day React stops warning: drop the warm-up.
beforeAll(() => {
  const error = silenceErrors();
  render(
    <Select.Root aria-label="warm-up">
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Option value="a">A</Select.Option>
    </Select.Root>,
  );
  // Unmounts it and removes its container: the first row starts from an empty body.
  cleanup();
  expect(error).toHaveBeenCalledWith(expect.stringContaining("is unrecognized"), "selectedcontent");
  error.mockRestore();
});

describe("Select", () => {
  describe("roles and ARIA", () => {
    it("renders a native select (combobox) with the native form props", () => {
      render(
        <form id="f">
          <Select.Root
            aria-label="Fruit"
            name="fruit"
            required
            form="f"
            autoComplete="off"
            defaultValue="a"
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Option value="a">Apple</Select.Option>
            <Select.Option value="b" disabled>
              Banana
            </Select.Option>
          </Select.Root>
        </form>,
      );
      const s = sel();
      expect(s.tagName).toBe("SELECT");
      expect(s).toHaveAccessibleName("Fruit");
      expect(s).toHaveAttribute("name", "fruit");
      expect(s).toBeRequired();
      expect(s).toHaveAttribute("form", "f");
      expect(s).toHaveAttribute("autocomplete", "off");
      expect(s).not.toHaveAttribute("multiple");
      expect(s.value).toBe("a");

      const button = s.firstElementChild as HTMLButtonElement;
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      const value = button.firstElementChild!;
      expect(value.tagName).toBe("SELECTEDCONTENT");
      // The browser fills it; React renders it empty (and jsdom never clones).
      expect(value.innerHTML).toBe("");

      expect(opt("a")).toHaveAttribute("data-selected", "");
      expect(opt("a")).not.toHaveAttribute("data-disabled");
      expect(opt("b")).toBeDisabled();
      expect(opt("b")).toHaveAttribute("data-disabled", "");
      expect(screen.getByRole("option", { name: "Apple" })).toBe(opt("a"));
    });

    it("renders Group as optgroup[label] with GroupLabel as its first-child legend, Separator as hr", () => {
      const consoleError = vi.spyOn(console, "error");
      render(
        <Select.Root aria-label="Fruit" defaultValue="o">
          <Select.Group label="Citrus" data-testid="group">
            <Select.GroupLabel>
              Citrus <em>fruits</em>
            </Select.GroupLabel>
            <Select.Option value="o">Orange</Select.Option>
          </Select.Group>
          <Select.Separator data-testid="sep" />
          <Select.Option value="b">Banana</Select.Option>
        </Select.Root>,
      );
      const group = screen.getByTestId("group");
      expect(group.tagName).toBe("OPTGROUP");
      expect(group).toHaveAttribute("label", "Citrus");
      expect(group.firstElementChild?.tagName).toBe("LEGEND");
      expect(screen.getByTestId("sep").tagName).toBe("HR");
      expect(sel().options).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("emits data attributes by presence; `selected` only as the mirrored reset target", async () => {
      render(<Harness mode="uncontrolled" initial="b" />);
      expect(dataSelected()).toEqual(["b"]);
      expect(opt("b").getAttribute("data-selected")).toBe("");
      const user = setupUser();
      await user.selectOptions(sel(), "c");
      // The `selected` content attribute is `defaultSelected`: the reset target, not the pick.
      expect(
        allOptions()
          .filter((o) => o.hasAttribute("selected"))
          .map((o) => o.value),
      ).toEqual(["b"]);
      expectNotPending(sel());
      expectNotPending(screen.getByTestId("trigger"));
      expect(sel()).not.toHaveAttribute("data-disabled");
    });

    it("Root disabled disables the select natively and marks Root, Trigger and Options", () => {
      render(<Harness mode="uncontrolled" disabled />);
      expect(sel()).toBeDisabled();
      expect(sel()).toHaveAttribute("data-disabled", "");
      expect(screen.getByTestId("trigger")).toHaveAttribute("data-disabled", "");
      expect(allOptions().every((o) => o.hasAttribute("data-disabled"))).toBe(true);
      // Native `disabled` on options is the Option's own prop only.
      expect(allOptions().some((o) => o.disabled)).toBe(false);
    });

    it("owned keys cannot be overridden through props or a render element", () => {
      render(
        <Select.Root
          aria-label="Fruit"
          defaultValue="a"
          {...({ value: "b", onChange: () => {} } as object)}
          render={<select data-pending="x" />}
        >
          <Select.Trigger {...({ type: "submit" } as object)} />
          <Select.Option value="a" {...({ selected: true } as object)} />
          <Select.Option value="b" render={<option value="zzz" data-selected="x" />} />
        </Select.Root>,
      );
      // `value` from the spread is the controlled prop (it is a real prop of Root).
      expect(sel().value).toBe("b");
      expect(sel()).not.toHaveAttribute("data-pending");
      expect(sel().firstElementChild).toHaveAttribute("type", "button");
      expect(sel().options[1]).toHaveAttribute("value", "b");
      expect(sel().options[1]).toHaveAttribute("data-selected", "");
      expect(sel().options[0]).not.toHaveAttribute("selected");
    });

    it("every part throws outside a Root", () => {
      silenceErrors();
      expect(() => render(<Select.Option value="a" />)).toThrow(
        "Select.Option must be rendered inside a Select.Root.",
      );
      expect(() => render(<Select.Trigger />)).toThrow(/Select\.Trigger must be rendered/);
      expect(() => render(<Select.Value />)).toThrow(/Select\.Value must be rendered/);
      expect(() => render(<Select.Group label="x" />)).toThrow(/Select\.Group must be rendered/);
      expect(() => render(<Select.GroupLabel />)).toThrow(/Select\.GroupLabel must be rendered/);
      expect(() => render(<Select.Separator />)).toThrow(/Select\.Separator must be rendered/);
    });

    it("types: no multiple / size on Root, no children on Value, no transition anywhere", () => {
      // Compile-time assertions; rendering is incidental.
      render(
        <Select.Root
          aria-label="x"
          // @ts-expect-error multi-select is not part of v1
          multiple
        >
          {/* @ts-expect-error the browser writes Value's content */}
          <Select.Value>text</Select.Value>
          {/* @ts-expect-error no part takes `transition` (design decision 13) */}
          <Select.Option value="a" transition="fade" />
        </Select.Root>,
      );
      // @ts-expect-error `size` is omitted too
      const props: SelectRootProps = { size: 3 };
      // @ts-expect-error Group `label` is required
      const group = <Select.Group />;
      expect(props).toBeDefined();
      expect(group).toBeDefined();
    });
  });

  renderBoth("sync action", (mode) => {
    it("calls valueChangeAction(next, details) with the native change event", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("b");
      expect(details.reason).toBe("activate");
      expect(details.event).toBeInstanceOf(window.Event);
      expect(details.event?.type).toBe("change");
      expect(sel().value).toBe("b");
      expect(dataSelected()).toEqual(["b"]);
      expect(committed()).toHaveTextContent("b");
    });

    it("re-picking the selected option or picking under Root disabled never dispatches", async () => {
      const action = vi.fn<ActionFn>();
      const { unmount } = render(<Harness mode={mode} action={action} />);
      const user = setupUser();
      await user.selectOptions(sel(), "a");
      expect(action).not.toHaveBeenCalled();
      unmount();

      render(<Harness mode={mode} action={action} disabled />);
      // user-event refuses a disabled select; a change event forced through the DOM is ignored too.
      await act(async () => {
        sel().value = "c";
        sel().dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(action).not.toHaveBeenCalled();
      expect(sel().value).toBe("a");
    });
  });

  renderBoth("async action", (mode) => {
    it("shows the pick and data-pending on Root, Trigger and that Option until resolve", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} />);
      const user = setupUser();
      await user.selectOptions(sel(), "c");
      expect(sel().value).toBe("c");
      expect(opt("c").selected).toBe(true);
      expect(dataSelected()).toEqual(["c"]);
      expectPending(sel());
      expectPending(screen.getByTestId("trigger"));
      expect(dataPending()).toEqual(["c"]);
      expect(committed()).toHaveTextContent("a");

      await act(async () => {
        d.resolve();
      });
      expectNotPending(sel());
      expectNotPending(screen.getByTestId("trigger"));
      expect(dataPending()).toEqual([]);
      expect(sel().value).toBe("c");
      expect(committed()).toHaveTextContent("c");
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the Error Boundary and leaves committed state", async () => {
      silenceErrors();
      const d = deferred();
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await act(async () => {
        d.reject(new Error("nope"));
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("nope");
      expect(committed()).toHaveTextContent("a");
    });

    it("caught inside the action counts as success", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await act(async () => {
        d.reject(new Error("caught"));
      });
      expect(screen.getByTestId("error")).toHaveTextContent("caught");
      expectNotPending(sel());
      if (mode === "uncontrolled") {
        // The library saw a resolved action: the pick is committed.
        expect(sel().value).toBe("b");
      } else {
        // The parent did not adopt it: the DOM rolls back to the parent's option.
        expect(sel().value).toBe("a");
        expect(dataSelected()).toEqual(["a"]);
      }
    });
  });

  describe("rollback of the DOM to the previous option", () => {
    it("a controlled veto re-selects the old option after settle (walkthrough 9.5)", async () => {
      const d = deferred();
      render(
        <Select.Root aria-label="Fruit" value="a" valueChangeAction={() => d.promise}>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
        </Select.Root>,
      );
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(sel().value).toBe("b");
      expect(dataSelected()).toEqual(["b"]);
      await act(async () => {
        d.resolve();
      });
      expect(sel().value).toBe("a");
      expect(opt("a").selected).toBe(true);
      expect(dataSelected()).toEqual(["a"]);
      expectNotPending(sel());
    });
  });

  describe("overlapping actions", () => {
    it("resolved out of order: DOM and data-selected stay on the latest; the latest commits", async () => {
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      const action = vi.fn<ActionFn>(() => queue.shift()!.promise);
      render(
        <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
          <Select.Option value="c">C</Select.Option>
        </Select.Root>,
      );
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.selectOptions(sel(), "c");
      expect(sel().value).toBe("c");
      await act(async () => {
        second.resolve();
      });
      expect(sel().value).toBe("c");
      expect(dataSelected()).toEqual(["c"]);
      await act(async () => {
        first.resolve();
      });
      expect(sel().value).toBe("c");
      expect(dataSelected()).toEqual(["c"]);
      expectNotPending(sel());
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "c"]);
    });

    it("picking the committed option back while another is pending dispatches (walkthrough 9.6)", async () => {
      const slow = deferred();
      const action = vi.fn<ActionFn>((next) => (next === "b" ? slow.promise : undefined));
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(dataPending()).toEqual(["b"]);
      await user.selectOptions(sel(), "a");
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "a"]);
      expect(sel().value).toBe("a");
      expect(dataSelected()).toEqual(["a"]);
      await act(async () => {
        slow.resolve();
      });
      expect(sel().value).toBe("a");
      expectNotPending(sel());
    });
  });

  renderBoth("superseded rejection", (mode) => {
    it("reaches the boundary when the older action rejects after the newer resolved", async () => {
      silenceErrors();
      const older = deferred();
      const newer = deferred();
      const queue = [older, newer];
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => queue.shift()!.promise} boundary={onError} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.selectOptions(sel(), "c");
      await act(async () => {
        newer.resolve();
      });
      await act(async () => {
        older.reject(new Error("older"));
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older");
    });

    it("reaches the boundary when the older action rejects while the newer is pending", async () => {
      silenceErrors();
      const older = deferred();
      const newer = deferred();
      const queue = [older, newer];
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => queue.shift()!.promise} boundary={onError} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.selectOptions(sel(), "c");
      await act(async () => {
        older.reject(new Error("older"));
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older");
      await act(async () => {
        newer.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps old content, no fallback, Root pending while the new content loads", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      render(<Harness mode={mode} suspender={suspender} />);
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(screen.queryByTestId("fallback")).toBeNull();
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");
      expectPending(sel());
      expect(sel().value).toBe("b");
      await act(async () => {
        suspender.resolve("b");
      });
      expect(screen.getByTestId("suspender")).toHaveTextContent("b");
      expectNotPending(sel());
      expect(sel().value).toBe("b");
    });
  });

  describe("late options (design 6.2)", () => {
    /** A pending gate; `open()` marks it fulfilled the way React's `use` expects, then resolves. */
    function lateGate() {
      const d = deferred();
      const p = d.promise as Promise<void> & { status?: string; value?: unknown };
      p.status = "pending";
      return {
        promise: d.promise,
        open() {
          p.status = "fulfilled";
          p.value = undefined;
          d.resolve();
        },
      };
    }
    type Gate = ReturnType<typeof lateGate>;
    function LateOptions({ gate }: { gate: Gate }) {
      use(gate.promise);
      return (
        <>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
          <Select.Option value="c">C</Select.Option>
        </>
      );
    }

    function LateSelect({
      mode,
      fallback,
      action,
      gate,
      initial,
      boundaryKey = 0,
    }: {
      mode: ControlMode | "none";
      fallback: "disabled" | "enabled";
      action: ActionFn;
      gate: Gate;
      initial?: string;
      /** A new key remounts the boundary: the options suspend again (a "Reload"). */
      boundaryKey?: number;
    }) {
      const [value, setValue] = useState(initial ?? "c");
      const modeProps =
        mode === "controlled"
          ? { value }
          : mode === "uncontrolled"
            ? { defaultValue: initial ?? "c" }
            : {};
      return (
        <Select.Root
          aria-label="Fruit"
          {...modeProps}
          valueChangeAction={async (next, details) => {
            await action(next, details);
            startTransition(() => setValue(next));
          }}
        >
          {(state) => (
            <>
              <Suspense
                key={boundaryKey}
                fallback={
                  <Select.Option value="" disabled={fallback === "disabled"}>
                    Loading…
                  </Select.Option>
                }
              >
                <LateOptions gate={gate} />
              </Suspense>
              <output data-testid="state">{state.value}</output>
            </>
          )}
        </Select.Root>
      );
    }

    renderBoth("re-apply", (mode) => {
      it("selects the intended option when the options arrive, without a dispatch", async () => {
        const gate = lateGate();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          render(<LateSelect mode={mode} fallback="disabled" action={action} gate={gate} />);
        });
        expect(sel().selectedIndex).toBe(-1);
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();

        await act(async () => {
          gate.open();
        });
        await flushMicrotasks();
        expect(sel().value).toBe("c");
        expect(dataSelected()).toEqual(["c"]);
        expect(action).not.toHaveBeenCalled();
      });

      it("the same with an enabled fallback option", async () => {
        const gate = lateGate();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          render(<LateSelect mode={mode} fallback="enabled" action={action} gate={gate} />);
        });
        expect(sel().value).toBe("");
        await act(async () => {
          gate.open();
        });
        await flushMicrotasks();
        expect(sel().value).toBe("c");
        expect(action).not.toHaveBeenCalled();
      });
    });

    it("without value or defaultValue: the browser's default is adopted, then re-adopted when the options arrive", async () => {
      const gate = lateGate();
      const action = vi.fn<ActionFn>();
      await act(async () => {
        render(<LateSelect mode="none" fallback="enabled" action={action} gate={gate} />);
      });
      // The fallback option "" is what the browser selected.
      expect(screen.getByTestId("state")).toHaveTextContent("");
      await act(async () => {
        gate.open();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("a");
      expect(screen.getByTestId("state")).toHaveTextContent("a");
      expect(dataSelected()).toEqual(["a"]);
      expect(action).not.toHaveBeenCalled();
    });

    it("without value or defaultValue: a picked value survives the options suspending again (no re-adoption)", async () => {
      const gate = lateGate();
      const action = vi.fn<ActionFn>();
      let rerender!: (ui: ReactNode) => void;
      await act(async () => {
        ({ rerender } = render(
          <LateSelect mode="none" fallback="disabled" action={action} gate={gate} />,
        ));
      });
      await act(async () => {
        gate.open();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("a");
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await flushMicrotasks();
      expect(screen.getByTestId("state")).toHaveTextContent("b");

      // Reload: the options suspend again behind the disabled "" fallback, then come back.
      const reload = lateGate();
      await act(async () => {
        rerender(
          <LateSelect
            mode="none"
            fallback="disabled"
            action={action}
            gate={reload}
            boundaryKey={1}
          />,
        );
      });
      await flushMicrotasks();
      expect(sel().options).toHaveLength(1);
      expect(screen.getByTestId("state")).toHaveTextContent("b");
      await act(async () => {
        reload.open();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("b");
      expect(screen.getByTestId("state")).toHaveTextContent("b");
      expect(dataSelected()).toEqual(["b"]);
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["b", "activate"]]);
    });
  });

  describe("platform: mount reconciliation", () => {
    async function hydrate(ui: ReactNode, mutate: (container: HTMLElement) => void) {
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      mutate(container);
      const result = render(ui, { container, hydrate: true });
      await flushMicrotasks();
      return result;
    }
    const pickC = (c: HTMLElement) => {
      c.querySelector("select")!.value = "c";
    };

    renderBoth("hydration", (mode) => {
      it("dispatches the hydrated DOM value once with reason platform and no event", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} action={action} trigger={false} />, pickC);
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe("c");
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(JSON.stringify(details)).toBe('{"reason":"platform"}');
        expect(sel().value).toBe("c");
        expect(dataSelected()).toEqual(["c"]);
        expect(committed()).toHaveTextContent("c");
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("dispatches once under StrictMode", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <StrictMode>
            <Harness mode={mode} action={action} trigger={false} />
          </StrictMode>,
          pickC,
        );
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe("c");
        expect(sel().value).toBe("c");
      });

      it("dispatches nothing when the DOM matches", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <Harness mode={mode} initial="b" action={action} trigger={false} />,
          () => {},
        );
        expect(action).not.toHaveBeenCalled();
        expect(sel().value).toBe("b");
      });
    });

    it("a refused dispatch rolls the DOM back to the server value", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <Select.Root aria-label="Fruit" value="a" valueChangeAction={action}>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
          <Select.Option value="c">C</Select.Option>
        </Select.Root>,
        pickC,
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(sel().value).toBe("a");
      expect(dataSelected()).toEqual(["a"]);
    });

    it("no dispatch when the value matches no option (fallback-only DOM)", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <Select.Root aria-label="Fruit" value="c" valueChangeAction={action}>
          <Select.Option value="">Loading…</Select.Option>
          <Select.Option value="x">X</Select.Option>
        </Select.Root>,
        (c) => {
          c.querySelector("select")!.value = "x";
        },
      );
      expect(action).not.toHaveBeenCalled();
    });

    it("createRoot never dispatches on mount", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <StrictMode>
          <Harness mode="uncontrolled" initial="b" action={action} />
        </StrictMode>,
      );
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(sel().value).toBe("b");
    });

    describe("without value or defaultValue (the browser's default, design 5)", () => {
      function Plain({ action }: { action: ActionFn }) {
        const [state, setState] = useState<string | null>(null);
        return (
          <>
            <Select.Root aria-label="Fruit" valueChangeAction={action}>
              {(s) => (
                <>
                  <Select.Option value="a" disabled>
                    A
                  </Select.Option>
                  <Select.Option value="b">B</Select.Option>
                  <Select.Option value="c">C</Select.Option>
                  <StateProbe value={s.value} onValue={setState} />
                </>
              )}
            </Select.Root>
            <output data-testid="state">{String(state)}</output>
          </>
        );
      }
      function StateProbe({ value, onValue }: { value: string; onValue: (v: string) => void }) {
        useLayoutEffect(() => {
          onValue(value);
        });
        return null;
      }

      it("adopts the first enabled option at mount: no dispatch, no warning", async () => {
        const consoleError = vi.spyOn(console, "error");
        const action = vi.fn<ActionFn>();
        render(
          <StrictMode>
            <Plain action={action} />
          </StrictMode>,
        );
        await flushMicrotasks();
        expect(sel().value).toBe("b");
        expect(screen.getByTestId("state")).toHaveTextContent("b");
        expect(dataSelected()).toEqual(["b"]);
        expect(action).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
      });

      it('a placeholder option `""` is the browser\'s default', async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Select.Root aria-label="Fruit" valueChangeAction={action}>
            {(s) => (
              <>
                <Select.Option value="" disabled>
                  Choose
                </Select.Option>
                <Select.Option value="b">B</Select.Option>
                <output data-testid="state">[{s.value}]</output>
              </>
            )}
          </Select.Root>,
        );
        await flushMicrotasks();
        expect(sel().value).toBe("");
        expect(screen.getByTestId("state")).toHaveTextContent("[]");
        expect(action).not.toHaveBeenCalled();
      });

      it("hydration: a pre-hydration pick of another option dispatches once", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(<Plain action={action} />, pickC);
        expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["c", "platform"]]);
        expect(sel().value).toBe("c");
        expect(screen.getByTestId("state")).toHaveTextContent("c");
      });

      it("hydration without a pick adopts silently", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(<Plain action={action} />, () => {});
        expect(action).not.toHaveBeenCalled();
        expect(screen.getByTestId("state")).toHaveTextContent("b");
      });

      it("form.reset() returns to the adopted option (mirrored as the reset target)", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <form data-testid="form">
            <Plain action={action} />
          </form>,
        );
        await flushMicrotasks();
        const user = setupUser();
        await user.selectOptions(sel(), "c");
        expect(defaultSelected()).toEqual(["b"]);
        await act(async () => {
          form().reset();
        });
        await flushMicrotasks();
        expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
          ["c", "activate"],
          ["b", "platform"],
        ]);
        expect(sel().value).toBe("b");
        expect(screen.getByTestId("state")).toHaveTextContent("b");
      });
    });
  });

  describe("platform: options that mount after the Root (late hydration)", () => {
    function fulfilled(): Promise<void> {
      const p = Promise.resolve() as Promise<void> & { status?: string; value?: unknown };
      p.status = "fulfilled";
      p.value = undefined;
      return p;
    }
    function gate() {
      const d = deferred();
      const p = d.promise as Promise<void> & { status?: string; value?: unknown };
      p.status = "pending";
      return {
        promise: d.promise,
        open() {
          p.status = "fulfilled";
          p.value = undefined;
          d.resolve();
        },
      };
    }
    function Gate({ promise, children }: { promise: Promise<void>; children: ReactNode }) {
      use(promise);
      return children;
    }
    function LateSelect({
      gate,
      mode,
      action,
    }: {
      gate: Promise<void>;
      mode: ControlMode;
      action: ActionFn;
    }) {
      const [value, setValue] = useState("a");
      return (
        <Select.Root
          aria-label="Fruit"
          {...(mode === "controlled" ? { value } : { defaultValue: "a" })}
          valueChangeAction={async (next, details) => {
            await action(next, details);
            startTransition(() => setValue(next));
          }}
        >
          <Select.Option value="a">A</Select.Option>
          <Suspense fallback={null}>
            <Gate promise={gate}>
              <Select.Option value="b">B</Select.Option>
              <Select.Option value="c">C</Select.Option>
            </Gate>
          </Suspense>
        </Select.Root>
      );
    }

    renderBoth("late hydration", (mode) => {
      it("a pre-hydration pick of a late option dispatches exactly once when it hydrates", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        const container = document.createElement("div");
        document.body.append(container);
        container.innerHTML = renderToString(
          <LateSelect gate={fulfilled()} mode={mode} action={action} />,
        );
        const g = gate();
        await act(async () => {
          render(<LateSelect gate={g.promise} mode={mode} action={action} />, {
            container,
            hydrate: true,
          });
        });
        expect(action).not.toHaveBeenCalled();
        const c = container.querySelector<HTMLOptionElement>('option[value="c"]')!;

        // The user picks "c" while its boundary is still dehydrated: React sees nothing.
        container.querySelector("select")!.value = "c";
        await act(async () => {
          g.open();
        });
        await flushMicrotasks();

        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe("c");
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(opt("c")).toBe(c);
        expect(sel().value).toBe("c");
        expect(dataSelected()).toEqual(["c"]);
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("late options hydrating with no pick dispatch nothing", async () => {
        const action = vi.fn<ActionFn>();
        const container = document.createElement("div");
        document.body.append(container);
        container.innerHTML = renderToString(
          <LateSelect gate={fulfilled()} mode={mode} action={action} />,
        );
        const g = gate();
        await act(async () => {
          render(<LateSelect gate={g.promise} mode={mode} action={action} />, {
            container,
            hydrate: true,
          });
        });
        await act(async () => {
          g.open();
        });
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        expect(sel().value).toBe("a");
      });
    });

    it("late options created by createRoot never dispatch, even when the browser auto-selects", async () => {
      const action = vi.fn<ActionFn>();
      const g = gate();
      await act(async () => {
        render(<LateSelect gate={g.promise} mode="controlled" action={action} />);
      });
      expect(sel().options).toHaveLength(1);
      await act(async () => {
        g.open();
      });
      await flushMicrotasks();
      expect(sel().options).toHaveLength(3);
      expect(action).not.toHaveBeenCalled();
      expect(sel().value).toBe("a");
    });
  });

  renderBoth("platform: form reset", (mode) => {
    it("<button type=reset> dispatches once with the reset event and commits", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.selectOptions(sel(), "c");
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe("a");
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("reset");
      expect(sel().value).toBe("a");
      expect(dataSelected()).toEqual(["a"]);
      expect(committed()).toHaveTextContent("a");
    });

    it("form.reset() dispatches once, also to the placeholder", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm initial="" options={["", "a", "b"]} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["b", "activate"],
        ["", "platform"],
      ]);
      expect(sel().value).toBe("");
      expect(committed()).toHaveTextContent("");
    });

    it("a cancelled reset dispatches nothing and leaves the DOM", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      form().addEventListener("reset", (e) => e.preventDefault());
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(sel().value).toBe("b");
    });

    it("a reset whose target is the optimistic value dispatches nothing", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(sel().value).toBe("a");
    });

    it("a disabled Select still follows the reset", async () => {
      const action = vi.fn<ActionFn>();
      function Toggleable() {
        const [disabled, setDisabled] = useState(false);
        return (
          <>
            <Harness mode={mode} action={action} inForm disabled={disabled} />
            <button type="button" onClick={() => setDisabled(true)}>
              disable
            </button>
          </>
        );
      }
      render(<Toggleable />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.click(screen.getByRole("button", { name: "disable" }));
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "a"]);
      expect(sel().value).toBe("a");
    });

    it("two synchronous form.reset() calls while one is pending dispatch once (base rule)", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>((_n, details) =>
        details.reason === "platform" ? d.promise : undefined,
      );
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await act(async () => {
        form().reset();
      });
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "a"]);
      await act(async () => {
        d.resolve();
      });
      expect(sel().value).toBe("a");
    });
  });

  describe("platform: form reset, controlled parent decides", () => {
    it("a parent that refuses gets the DOM re-synced to its option after settle", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} inForm refusePlatform />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["b", "activate"],
        ["a", "platform"],
      ]);
      expect(sel().value).toBe("b");
      expect(dataSelected()).toEqual(["b"]);
    });
  });

  describe("reset target (design 6.1)", () => {
    it("uncontrolled: follows the latest defaultValue, without moving the current selection", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [def, setDef] = useState("a");
        return (
          <form data-testid="form">
            <Select.Root aria-label="Fruit" defaultValue={def} valueChangeAction={action}>
              <Select.Option value="a">A</Select.Option>
              <Select.Option value="b">B</Select.Option>
              <Select.Option value="c">C</Select.Option>
            </Select.Root>
            <button type="button" onClick={() => startTransition(() => setDef("c"))}>
              default c
            </button>
          </form>
        );
      }
      render(<Parent />);
      expect(defaultSelected()).toEqual(["a"]);
      const user = setupUser();
      await user.click(screen.getByRole("button", { name: "default c" }));
      // "c" is non-dirty: its new defaultSelected would select it; the re-apply keeps "a".
      expect(defaultSelected()).toEqual(["c"]);
      expect(sel().value).toBe("a");
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("c");
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["c", "platform"]]);
    });

    it("controlled client render: defaultSelected on the mount-time option; reset returns to it", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" initial="b" action={action} inForm />);
      // react-dom alone writes no defaultSelected for a controlled select.
      expect(defaultSelected()).toEqual(["b"]);
      const user = setupUser();
      await user.selectOptions(sel(), "c");
      expect(defaultSelected()).toEqual(["b"]);
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["c", "activate"],
        ["b", "platform"],
      ]);
      expect(sel().value).toBe("b");
      expect(committed()).toHaveTextContent("b");
    });

    it("an Option added later never gains defaultSelected", async () => {
      function Parent() {
        const [extra, setExtra] = useState(false);
        const [value, setValue] = useState("a");
        return (
          <>
            <Select.Root
              aria-label="Fruit"
              value={value}
              valueChangeAction={(next) => {
                setValue(next);
              }}
            >
              <Select.Option value="a">A</Select.Option>
              <Select.Option value="b">B</Select.Option>
              {extra && <Select.Option value="b2">B2</Select.Option>}
            </Select.Root>
            <button type="button" onClick={() => setExtra(true)}>
              add
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.click(screen.getByRole("button", { name: "add" }));
      expect(defaultSelected()).toEqual(["a"]);
      expect(sel().value).toBe("b");
    });
  });

  describe("platform: React's automatic reset after a form action", () => {
    function OrderForm({ submit, action }: { submit: Promise<void>; action?: ActionFn }) {
      return (
        <form
          action={async () => {
            await submit;
          }}
        >
          <Select.Root
            aria-label="Fruit"
            name="fruit"
            defaultValue=""
            {...(action && { valueChangeAction: action })}
          >
            <Select.Option value="">Choose</Select.Option>
            <Select.Option value="banana">Banana</Select.Option>
          </Select.Root>
          <button type="submit">Order</button>
        </form>
      );
    }

    it("returns to the placeholder with one platform dispatch (walkthrough 9.7)", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>();
      render(<OrderForm submit={d.promise} action={action} />);
      const user = setupUser();
      await user.selectOptions(sel(), "banana");
      await user.click(screen.getByRole("button", { name: "Order" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe("");
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("reset");
      expect(sel().value).toBe("");
      expect(dataSelected()).toEqual([""]);
      expectNotPending(sel());
      await user.selectOptions(sel(), "banana");
      expect(sel().value).toBe("banana");
      expect(action).toHaveBeenCalledTimes(3);
    });

    it("works without a valueChangeAction", async () => {
      const d = deferred();
      render(<OrderForm submit={d.promise} />);
      const user = setupUser();
      await user.selectOptions(sel(), "banana");
      await user.click(screen.getByRole("button", { name: "Order" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("");
      expect(dataSelected()).toEqual([""]);
    });
  });

  describe("platform: React's automatic reset, without value or defaultValue (design 5)", () => {
    // The adopted placeholder is the reset target, as Fizz's `selected` makes it for SSR: the
    // browser's own reset result would be the first *enabled* option.
    function PlainOrderForm({ submit, action }: { submit: () => Promise<void>; action: ActionFn }) {
      return (
        <form
          action={async () => {
            await submit();
          }}
        >
          {/* The state as a class: an <output> would be reset by the form, under React. */}
          <Select.Root
            aria-label="Fruit"
            name="fruit"
            valueChangeAction={action}
            className={(s) => `state-[${s.value}]`}
          >
            <Select.Option value="" disabled>
              Choose
            </Select.Option>
            <Select.Option value="banana">Banana</Select.Option>
          </Select.Root>
          <button type="submit">Order</button>
        </form>
      );
    }

    it("a client-rendered disabled placeholder stays selected with no dispatch; after a pick, the reset returns to it", async () => {
      let d = deferred();
      const action = vi.fn<ActionFn>();
      render(<PlainOrderForm submit={() => d.promise} action={action} />);
      await flushMicrotasks();
      expect(sel().value).toBe("");
      expect(defaultSelected()).toEqual([""]);
      const user = setupUser();

      // Untouched form: React's automatic reset after the action.
      await user.click(screen.getByRole("button", { name: "Order" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("");
      expect(sel()).toHaveClass("state-[]");
      expect(action).not.toHaveBeenCalled();

      // After a pick: back to the placeholder with one platform dispatch.
      d = deferred();
      await user.selectOptions(sel(), "banana");
      await user.click(screen.getByRole("button", { name: "Order" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(sel().value).toBe("");
      expect(sel()).toHaveClass("state-[]");
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["banana", "activate"],
        ["", "platform"],
      ]);
    });
  });

  describe("forms, placeholder and required", () => {
    it("contributes name=value to FormData", async () => {
      render(
        <form data-testid="form">
          <Select.Root aria-label="Fruit" name="fruit" defaultValue="b">
            <Select.Option value="a">A</Select.Option>
            <Select.Option value="b">B</Select.Option>
          </Select.Root>
        </form>,
      );
      expect([...new FormData(form())]).toEqual([["fruit", "b"]]);
      const user = setupUser();
      await user.selectOptions(sel(), "a");
      expect([...new FormData(form())]).toEqual([["fruit", "a"]]);
    });

    it('a disabled placeholder with defaultValue="" is selected; required + "" is valueMissing', async () => {
      render(
        <Select.Root aria-label="Fruit" defaultValue="" required>
          <Select.Option value="" disabled>
            Choose
          </Select.Option>
          <Select.Option value="a">A</Select.Option>
        </Select.Root>,
      );
      expect(sel().value).toBe("");
      expect(opt("").selected).toBe(true);
      expect(sel().validity.valueMissing).toBe(true);
      const user = setupUser();
      await user.selectOptions(sel(), "a");
      expect(sel().validity.valueMissing).toBe(false);
      expect(sel().checkValidity()).toBe(true);
    });
  });

  describe("details", () => {
    it("exposes `event` as a virtual, non-own property", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      const details = action.mock.calls[0]![1];
      expect(details.event).toBeInstanceOf(window.Event);
      expect("event" in details).toBe(true);
      expect(Object.keys(details)).not.toContain("event");
      expect(JSON.stringify(details)).toBe('{"reason":"activate"}');
    });

    it("can be passed straight to a Server-Function-shaped action", async () => {
      const serverFn = vi.fn(async (_next: string, _details: Details) => {});
      render(
        <Select.Root aria-label="Fruit" defaultValue="a" valueChangeAction={serverFn}>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
        </Select.Root>,
      );
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      const [next, details] = serverFn.mock.calls[0]!;
      expect(JSON.parse(JSON.stringify([next, details]))).toEqual(["b", { reason: "activate" }]);
    });
  });

  describe("function props", () => {
    it("className / style / children on Root, Trigger and Option receive the documented state", async () => {
      const d = deferred();
      const optionChildren = vi.fn(
        (s: SelectOptionState) => `${s.value}${s.selected ? "*" : ""}${s.pending ? "…" : ""}`,
      );
      render(
        <Select.Root
          aria-label="Fruit"
          defaultValue="a"
          valueChangeAction={() => d.promise}
          className={(s: SelectRootState) => `root-${s.value}${s.pending ? " busy" : ""}`}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
        >
          {(s) => (
            <>
              <Select.Trigger
                data-testid="trigger"
                className={(t) => `t-${t.value}`}
                style={(t) => ({ cursor: t.pending ? "progress" : "auto" })}
              >
                {(t) => <span data-testid="spinner">{t.pending ? "spin" : "idle"}</span>}
              </Select.Trigger>
              <Select.Option
                value="a"
                className={(o) => (o.selected ? "on" : "off")}
                style={(o) => ({ fontWeight: o.selected ? 700 : 400 })}
              >
                {optionChildren}
              </Select.Option>
              <Select.Option value="b" className={(o) => (o.selected ? "on" : "off")}>
                {optionChildren}
              </Select.Option>
              <Select.Separator className={(r) => `sep-${r.value}`} />
              <option disabled value="state">
                {s.value}
              </option>
            </>
          )}
        </Select.Root>,
      );
      expect(sel()).toHaveClass("root-a");
      expect(sel()).toHaveStyle({ opacity: "1" });
      expect(screen.getByTestId("trigger")).toHaveClass("t-a");
      expect(opt("a")).toHaveClass("on");
      expect(opt("a")).toHaveTextContent("a*");
      expect(opt("b")).toHaveTextContent("b");
      expect(sel().querySelector("hr")).toHaveClass("sep-a");

      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(sel()).toHaveClass("root-b", "busy");
      expect(sel()).toHaveStyle({ opacity: "0.5" });
      expect(screen.getByTestId("spinner")).toHaveTextContent("spin");
      expect(screen.getByTestId("trigger")).toHaveStyle({ cursor: "progress" });
      expect(opt("b")).toHaveTextContent("b*…");
      expect(opt("b")).toHaveClass("on");
      expect(opt("a")).toHaveClass("off");
      expect(opt("state")).toHaveTextContent("b");
      await act(async () => {
        d.resolve();
      });
      expect(opt("b")).toHaveTextContent("b*");
      expect(screen.getByTestId("spinner")).toHaveTextContent("idle");
    });

    it("Option state.disabled includes Root disabled", () => {
      const states: SelectOptionState[] = [];
      render(
        <Select.Root aria-label="Fruit" defaultValue="a" disabled>
          <Select.Option
            value="a"
            className={(s) => {
              states.push(s);
              return undefined;
            }}
          />
        </Select.Root>,
      );
      expect(states.at(-1)).toEqual({ value: "a", selected: true, pending: false, disabled: true });
    });

    it("Option state.disabled and data-disabled include a disabled Group (as :disabled does)", () => {
      const states = new Map<string, SelectOptionState>();
      const track = (s: SelectOptionState) => {
        states.set(s.value, s);
        return undefined;
      };
      render(
        <Select.Root aria-label="Fruit" defaultValue="a">
          <Select.Option value="a" className={track} />
          <Select.Group label="Off" disabled>
            <Select.Option value="b" className={track} />
          </Select.Group>
          <Select.Group label="On">
            <Select.Option value="c" className={track} />
          </Select.Group>
        </Select.Root>,
      );
      expect(states.get("a")?.disabled).toBe(false);
      expect(states.get("b")?.disabled).toBe(true);
      expect(states.get("c")?.disabled).toBe(false);
      expect(opt("b")).toHaveAttribute("data-disabled");
      expect(opt("b").disabled).toBe(false);
      expect(opt("b").parentElement).toBeDisabled();
      expect(opt("c")).not.toHaveAttribute("data-disabled");
      expect(opt("c").parentElement).not.toBeDisabled();
    });
  });

  describe("render element", () => {
    it("Root, Trigger and Option render elements keep owned attributes and handlers, merge className, forward refs", async () => {
      const action = vi.fn<ActionFn>();
      const rootRef = { current: null as HTMLSelectElement | null };
      const triggerRef = { current: null as HTMLButtonElement | null };
      const optionRef = { current: null as HTMLOptionElement | null };
      render(
        <Select.Root
          aria-label="Fruit"
          defaultValue="a"
          valueChangeAction={action}
          className="r"
          ref={rootRef}
          render={<select id="s" className="rs" />}
        >
          <Select.Trigger className="t" ref={triggerRef} render={<button className="tb" />}>
            <Select.Value />
          </Select.Trigger>
          <Select.Option value="a">A</Select.Option>
          <Select.Option
            value="b"
            className="o"
            ref={optionRef}
            render={<option className="ob" data-testid="b" />}
          >
            B
          </Select.Option>
        </Select.Root>,
      );
      expect(sel()).toHaveAttribute("id", "s");
      expect(sel()).toHaveClass("r", "rs");
      expect(rootRef.current).toBe(sel());
      expect(triggerRef.current).toBe(sel().firstElementChild);
      expect(triggerRef.current).toHaveClass("t", "tb");
      expect(triggerRef.current).toHaveAttribute("type", "button");
      const b = screen.getByTestId("b");
      expect(optionRef.current).toBe(b);
      expect(b).toHaveClass("o", "ob");
      expect(b).toHaveAttribute("value", "b");
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b"]);
      expect(b).toHaveAttribute("data-selected", "");
    });

    it("function form on Option receives (props, state)", () => {
      const renderFn = vi.fn((props: ComponentPropsWithRef<"option">, state: SelectOptionState) => (
        <option {...props} data-state={state.selected ? "on" : "off"} />
      ));
      render(
        <Select.Root aria-label="Fruit" defaultValue="a">
          <Select.Option value="a" render={renderFn}>
            A
          </Select.Option>
        </Select.Root>,
      );
      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ value: "a", "data-selected": "" }),
        { value: "a", selected: true, pending: false, disabled: false },
      );
      expect(opt("a")).toHaveAttribute("data-state", "on");
    });

    it("warns once per part when a render element changes the tag", () => {
      const consoleError = silenceErrors();
      const ui = (
        <Select.Root aria-label="Fruit" render={(props) => <div {...(props as object)} />}>
          <Select.Trigger render={(props) => <span {...(props as object)} />}>
            <Select.Value render={(props) => <span {...(props as object)} />} />
          </Select.Trigger>
          <Select.Group label="g" render={(props) => <div {...(props as object)} />}>
            <Select.Option value="a" render={(props) => <div {...(props as object)} />} />
          </Select.Group>
        </Select.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      const messages = consoleError.mock.calls.map(([m]) => String(m));
      for (const [part, tag] of [
        ["Root", "select"],
        ["Trigger", "button"],
        ["Value", "selectedcontent"],
        ["Group", "optgroup"],
        ["Option", "option"],
      ]) {
        expect(
          messages.filter((m) => m.startsWith(`Select.${part}: expected to render a <${tag}>`)),
        ).toHaveLength(1);
      }
    });

    it("warns when the Trigger is not the first child and the GroupLabel not the first child of its Group", () => {
      const consoleError = silenceErrors();
      render(
        <Select.Root aria-label="Fruit" defaultValue="a">
          <Select.Option value="a">A</Select.Option>
          <Select.Trigger />
          <Select.Group label="G">
            <Select.Option value="b">B</Select.Option>
            <Select.GroupLabel>G</Select.GroupLabel>
          </Select.Group>
        </Select.Root>,
      );
      const messages = consoleError.mock.calls.map(([m]) => String(m));
      expect(
        messages.filter((m) => /^Select\.Trigger: must be the first child/.test(m)),
      ).toHaveLength(1);
      expect(
        messages.filter((m) => /^Select\.GroupLabel: must be the first child/.test(m)),
      ).toHaveLength(1);
    });
  });

  describe("post-await rule", () => {
    it("value and data-pending converge with startTransition after the await", async () => {
      const d = deferred();
      const snapshots: { value: string; pending: boolean }[] = [];
      function Recorder() {
        useLayoutEffect(() => {
          const s = document.querySelector("select")!;
          snapshots.push({ value: s.value, pending: s.hasAttribute("data-pending") });
        });
        return null;
      }
      function Parent() {
        const [value, setValue] = useState("a");
        return (
          <Select.Root
            aria-label="Fruit"
            value={value}
            valueChangeAction={async (next) => {
              await d.promise;
              startTransition(() => setValue(next));
            }}
          >
            {() => (
              <>
                <Select.Option value="a">A</Select.Option>
                <Select.Option value="b">B</Select.Option>
                <Recorder />
              </>
            )}
          </Select.Root>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      const inFlight = snapshots.at(-1);
      await act(async () => {
        d.resolve();
      });
      expect(inFlight).toEqual({ value: "b", pending: true });
      expect(snapshots.at(-1)).toEqual({ value: "b", pending: false });
      expect(snapshots.slice(1).every((s) => s.value === "b")).toBe(true);
    });
  });

  describe("controlled edge cases", () => {
    it("a value prop change while pending converges after settle (walkthrough 9.11)", async () => {
      const d = deferred();
      function Parent() {
        const [value, setValue] = useState("a");
        return (
          <>
            <Select.Root aria-label="Fruit" value={value} valueChangeAction={() => d.promise}>
              <Select.Option value="a">A</Select.Option>
              <Select.Option value="b">B</Select.Option>
              <Select.Option value="c">C</Select.Option>
            </Select.Root>
            <button type="button" onClick={() => setValue("c")}>
              navigate
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.selectOptions(sel(), "b");
      await user.click(screen.getByRole("button", { name: "navigate" }));
      expect(sel().value).toBe("b");
      await act(async () => {
        d.resolve();
      });
      expect(sel().value).toBe("c");
      expect(dataSelected()).toEqual(["c"]);
    });
  });

  describe("Select.Value refresh (design 6.3), with HTMLSelectedContentElement stubbed", () => {
    // jsdom never clones into <selectedcontent>; these rows check the observer's filter and its
    // refresh write (`select.value = select.value`). The real clone is the browser row.
    function spyValueWrites() {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!;
      const writes: string[] = [];
      vi.spyOn(HTMLSelectElement.prototype, "value", "set").mockImplementation(function (
        this: HTMLSelectElement,
        v: string,
      ) {
        writes.push(v);
        descriptor.set!.call(this, v);
      });
      return writes;
    }

    it("refreshes once when the selected option's content changes, not for other options or option attributes", async () => {
      vi.stubGlobal("HTMLSelectedContentElement", class {});
      try {
        function Parent() {
          const [label, setLabel] = useState("Bee");
          const [other, setOther] = useState("Ant");
          const [mark, setMark] = useState(false);
          return (
            <>
              <Select.Root aria-label="Fruit" defaultValue="b">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Option value="a">{other}</Select.Option>
                <Select.Option value="b" data-mark={mark ? "" : undefined}>
                  <i>{label}</i>
                </Select.Option>
              </Select.Root>
              <button type="button" onClick={() => setLabel("Bumblebee")}>
                label
              </button>
              <button type="button" onClick={() => setOther("Aphid")}>
                other
              </button>
              <button type="button" onClick={() => setMark(true)}>
                mark
              </button>
            </>
          );
        }
        render(<Parent />);
        const writes = spyValueWrites();
        const user = setupUser();
        await user.click(screen.getByRole("button", { name: "other" }));
        await user.click(screen.getByRole("button", { name: "mark" }));
        await flushMicrotasks();
        expect(writes).toEqual([]);
        await user.click(screen.getByRole("button", { name: "label" }));
        await flushMicrotasks();
        expect(writes).toEqual(["b"]);
        expect(sel().value).toBe("b");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("refreshes after a form reset (Chromium does not re-clone for one), not after a cancelled one", async () => {
      vi.stubGlobal("HTMLSelectedContentElement", class {});
      try {
        render(<Harness mode="uncontrolled" inForm />);
        const user = setupUser();
        await user.selectOptions(sel(), "c");
        const writes = spyValueWrites();
        const cancel = (e: Event) => e.preventDefault();
        form().addEventListener("reset", cancel);
        await act(async () => {
          form().reset();
        });
        await flushMicrotasks();
        expect(writes).toEqual([]);
        form().removeEventListener("reset", cancel);
        await act(async () => {
          form().reset();
        });
        await flushMicrotasks();
        expect(writes[0]).toBe("a");
        expect(sel().value).toBe("a");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("the reset refresh listens on the form owner: unaffected by stopPropagation, follows the form attribute", async () => {
      vi.stubGlobal("HTMLSelectedContentElement", class {});
      try {
        const { rerender } = render(
          <>
            <form id="f1" data-testid="f1" />
            <form id="f2" data-testid="f2" />
            <Harness mode="uncontrolled" form="f1" />
          </>,
        );
        const f1 = screen.getByTestId("f1") as HTMLFormElement;
        const f2 = screen.getByTestId("f2") as HTMLFormElement;
        const user = setupUser();
        await user.selectOptions(sel(), "c");
        const writes = spyValueWrites();
        f1.addEventListener("reset", (e) => e.stopPropagation());
        await act(async () => {
          f1.reset();
        });
        await flushMicrotasks();
        expect(writes[0]).toBe("a");
        expect(sel().value).toBe("a");

        rerender(
          <>
            <form id="f1" data-testid="f1" />
            <form id="f2" data-testid="f2" />
            <Harness mode="uncontrolled" form="f2" />
          </>,
        );
        await user.selectOptions(sel(), "b");
        writes.length = 0;
        await act(async () => {
          f1.reset();
        });
        await flushMicrotasks();
        expect(writes).toEqual([]);
        expect(sel().value).toBe("b");
        await act(async () => {
          f2.reset();
        });
        await flushMicrotasks();
        expect(writes[0]).toBe("a");
        expect(sel().value).toBe("a");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("does not refresh when nothing is selected", async () => {
      vi.stubGlobal("HTMLSelectedContentElement", class {});
      try {
        function Parent() {
          const [label, setLabel] = useState("Loading");
          return (
            <>
              <Select.Root aria-label="Fruit" value="zzz">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Option value="" disabled>
                  {label}
                </Select.Option>
              </Select.Root>
              <button type="button" onClick={() => setLabel("Still loading")}>
                label
              </button>
            </>
          );
        }
        render(<Parent />);
        expect(sel().selectedIndex).toBe(-1);
        const writes = spyValueWrites();
        const user = setupUser();
        await user.click(screen.getByRole("button", { name: "label" }));
        await flushMicrotasks();
        expect(writes).toEqual([]);
        expect(sel().selectedIndex).toBe(-1);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("installs no observer without HTMLSelectedContentElement (jsdom, Firefox)", async () => {
      const observe = vi.spyOn(MutationObserver.prototype, "observe");
      render(
        <Select.Root aria-label="Fruit" defaultValue="a">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Option value="a">A</Select.Option>
        </Select.Root>,
      );
      await flushMicrotasks();
      expect(observe).not.toHaveBeenCalled();
    });
  });

  describe("dev warnings", () => {
    it("warns once when value and defaultValue are both set", () => {
      const consoleError = silenceErrors();
      const ui = (
        <Select.Root aria-label="x" value="a" defaultValue="a">
          <Select.Option value="a">A</Select.Option>
        </Select.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(
        /^Select\.Root: both `value` and `defaultValue`/,
      );
    });

    it("does not warn in normal use, nor for a value matching no option", async () => {
      const consoleError = vi.spyOn(console, "error");
      render(
        <>
          <Harness mode="uncontrolled" />
          <Select.Root aria-label="y" value="zzz">
            <Select.Option value="a">A</Select.Option>
          </Select.Root>
        </>,
      );
      const user = setupUser();
      await user.selectOptions(screen.getByRole("combobox", { name: "Fruit" }), "b");
      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});
// design/components/field-form.md 13.1, "Controls inside a Field".
describe("Select inside a Field.Root", () => {
  it("gets the Field's id, name, required, disabled and ARIA wiring; its own data-pending stays its own", async () => {
    const own = deferred();
    const submission = deferred();
    render(
      <Form.Root action={() => submission.promise}>
        <Field.Root name="fruit" required data-testid="root">
          <Field.Label data-testid="label">Fruit</Field.Label>
          <Select.Root defaultValue="" valueChangeAction={() => own.promise} data-testid="select">
            <Select.Option value="">Choose…</Select.Option>
            <Select.Option value="apple">Apple</Select.Option>
          </Select.Root>
          <Field.Description data-testid="desc">Any.</Field.Description>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const select = screen.getByTestId("select") as HTMLSelectElement;
    expect(screen.getByTestId("label")).toHaveAttribute("for", select.id);
    expect(select).toHaveAccessibleName("Fruit");
    expect(select).toHaveAttribute("name", "fruit");
    expect(select).toBeRequired();
    expect(select).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
    expect(select).toHaveAttribute("aria-invalid", "false");

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(select);

    await user.selectOptions(select, "apple");
    expectPending(select);
    expectNotPending(screen.getByTestId("root"));
    await act(async () => own.resolve());
    expect(screen.queryByTestId("error")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expectPending(screen.getByTestId("root"));
    expectNotPending(select);
    await act(async () => submission.resolve());
  });

  it("Field disabled disables the select", async () => {
    render(
      <Field.Root name="fruit" disabled>
        <Field.Label>Fruit</Field.Label>
        <Select.Root data-testid="select">
          <Select.Option value="a">A</Select.Option>
        </Select.Root>
      </Field.Root>,
    );
    await act(async () => {});
    expect(screen.getByTestId("select")).toBeDisabled();
  });
});
