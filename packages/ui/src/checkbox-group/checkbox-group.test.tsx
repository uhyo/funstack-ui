// CheckboxGroup, jsdom rows of design/components/checkbox-group.md section 13. Rows that need a
// real engine (`:indeterminate`, `:user-invalid`, a real label click, Space and Tab as the engine
// does them, a real click before hydration, React's automatic reset after a real form action,
// `document.startViewTransition`) are in checkbox-group.browser.test.tsx. Transition types are
// in checkbox-group-transition-types.test.tsx; the directive row in
// src/__tests__/directives.test.ts.
//
// About "rejection rolls the DOM back": a rejected action reaches the Error Boundary above the
// Root, which replaces the whole group, so the boxes that would roll back are unmounted. The DOM
// rollback is therefore asserted where the group stays mounted: a controlled parent that does not
// adopt the value (veto, or an error caught inside the action), which is the same optimistic
// revert and the same settle commit.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, use, useLayoutEffect, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
import { CheckboxGroup } from "./index.js";
import type {
  CheckboxGroupItemState,
  CheckboxGroupParentState,
  CheckboxGroupRootProps,
  CheckboxGroupRootState,
  CheckboxGroupValueChangeDetails,
} from "./index.js";

type Details = CheckboxGroupValueChangeDetails;
type ActionFn = (next: string[], details: Details) => unknown;

/** The functional update of design 2.6, keyed by what changed. */
function applyDetails(prev: readonly string[], details: Details): string[] {
  return [
    ...prev.filter((v) => !details.removed.includes(v)),
    ...details.added.filter((v) => !prev.includes(v)),
  ];
}

interface HarnessProps extends Omit<
  CheckboxGroupRootProps,
  "value" | "defaultValue" | "valueChangeAction" | "children"
> {
  mode: ControlMode;
  initial?: string[];
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Controlled only: refuse `"platform"` dispatches (default: adopt them). */
  refusePlatform?: boolean;
  /** Wrap only the group in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Render the committed value through a suspender, everything inside one Suspense boundary. */
  suspender?: ReturnType<typeof createSuspender>;
  /** Wrap the group in a `<form>` with a reset button. */
  inForm?: boolean;
  items?: readonly string[];
  disabledItems?: readonly string[];
  /** Render a Parent (named "all") over these values before the Items. */
  parent?: readonly string[];
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows the "update on success"
 * pattern with the functional update of design 2.6; the uncontrolled variant mirrors the
 * committed value in a sibling the same way, so both modes expose it alike.
 */
function Harness({
  mode,
  initial = ["a"],
  action,
  catchErrors = false,
  refusePlatform = false,
  boundary,
  suspender,
  inForm = false,
  items = ["a", "b", "c"],
  disabledItems = [],
  parent,
  ...rest
}: HarnessProps) {
  const [committed, setCommitted] = useState<string[]>(initial);
  const [error, setError] = useState<unknown>(null);

  const valueChangeAction = async (next: string[], details: Details) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    if (mode === "controlled" && refusePlatform && details.reason === "platform") return;
    startTransition(() => setCommitted((prev) => applyDetails(prev, details)));
  };

  const modeProps = mode === "controlled" ? { value: committed } : { defaultValue: initial };
  let group: ReactNode = (
    <CheckboxGroup.Root
      aria-label="Fruit"
      {...modeProps}
      valueChangeAction={valueChangeAction}
      {...rest}
    >
      {parent && <CheckboxGroup.Parent values={[...parent]} aria-label="all" />}
      {items.map((v) => (
        <CheckboxGroup.Item key={v} value={v} aria-label={v} disabled={disabledItems.includes(v)} />
      ))}
    </CheckboxGroup.Root>
  );
  if (boundary) group = <ErrorCatcher onError={boundary}>{group}</ErrorCatcher>;
  if (inForm) {
    group = (
      <form data-testid="form">
        {group}
        <button type="reset">Reset</button>
      </form>
    );
  }

  const key = [...committed].sort().join(",");
  const content = (
    <>
      {group}
      <output data-testid="committed">{key}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
      {suspender && <suspender.Suspender value={key} />}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const group = () => screen.getByRole("group");
const box = (v: string) => screen.getByRole("checkbox", { name: v }) as HTMLInputElement;
const parentBox = () => box("all");
/** The committed value as the harness mirrors it, sorted and comma-joined. */
const committedText = () => screen.getByTestId("committed").textContent;
/** The Items (boxes with a `name`; Parents have none). */
const items = () =>
  (screen.getAllByRole("checkbox") as HTMLInputElement[]).filter((b) => b.name !== "");
/** Values of the Items whose DOM `checked` is true, in document order. */
const checkedValues = () =>
  items()
    .filter((b) => b.checked)
    .map((b) => b.value);
const dataChecked = () =>
  items()
    .filter((b) => b.hasAttribute("data-checked"))
    .map((b) => b.value);
const dataPending = () =>
  items()
    .filter((b) => b.hasAttribute("data-pending"))
    .map((b) => b.value);
const form = () => screen.getByTestId("form") as HTMLFormElement;
/** `[next, reason, added, removed]` of every call, for compact assertions. */
const calls = (action: { mock: { calls: [string[], Details][] } }) =>
  action.mock.calls.map(([n, d]) => [n, d.reason, [...d.added], [...d.removed]]);
/** The Parent's visible state: "checked", "mixed" or "unchecked" (DOM property and attributes agree). */
function parentShows(el: HTMLInputElement = parentBox()): string {
  const mixed = el.indeterminate;
  expect(el.hasAttribute("data-indeterminate")).toBe(mixed);
  expect(el.hasAttribute("data-checked")).toBe(el.checked);
  if (el.checked && mixed) return "checked+mixed";
  return el.checked ? "checked" : mixed ? "mixed" : "unchecked";
}

describe("CheckboxGroup", () => {
  describe("roles and ARIA", () => {
    it("renders a fieldset (implicit group, no role attribute) named by the Label legend", () => {
      render(
        <CheckboxGroup.Root defaultValue={["cheese"]}>
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          <label>
            <CheckboxGroup.Item value="cheese" /> Cheese
          </label>
          <label>
            <CheckboxGroup.Item value="ham" /> Ham
          </label>
        </CheckboxGroup.Root>,
      );
      const root = screen.getByRole("group", { name: "Toppings" });
      expect(root.tagName).toBe("FIELDSET");
      expect(root).not.toHaveAttribute("role");
      expect(root).not.toHaveAttribute("aria-required");
      expect(root.firstElementChild?.tagName).toBe("LEGEND");
      const cheese = screen.getByRole("checkbox", { name: "Cheese" }) as HTMLInputElement;
      expect(cheese.tagName).toBe("INPUT");
      expect(cheese).toHaveAttribute("type", "checkbox");
      expect(cheese.checked).toBe(true);
      expect(screen.getByRole("checkbox", { name: "Ham" })).not.toBeChecked();
    });

    it("falls back to aria-label on Root without a Label; role passes through", () => {
      render(
        <CheckboxGroup.Root aria-label="Size" role="region">
          <CheckboxGroup.Item value="s" aria-label="s" role="menuitemcheckbox" />
        </CheckboxGroup.Root>,
      );
      expect(screen.getByRole("region")).toHaveAccessibleName("Size");
      expect(screen.getByRole("menuitemcheckbox", { name: "s" })).toHaveAttribute(
        "type",
        "checkbox",
      );
    });

    it("gives every Item the same useId name, or the name prop", () => {
      const first = render(
        <CheckboxGroup.Root aria-label="A">
          <CheckboxGroup.Item value="x" aria-label="x" />
          <CheckboxGroup.Item value="y" aria-label="y" />
        </CheckboxGroup.Root>,
      );
      const name = box("x").name;
      expect(name).not.toBe("");
      expect(box("y").name).toBe(name);
      first.unmount();

      render(
        <>
          <CheckboxGroup.Root aria-label="A">
            <CheckboxGroup.Item value="x" aria-label="x" />
          </CheckboxGroup.Root>
          <CheckboxGroup.Root aria-label="B" name="perm">
            <CheckboxGroup.Item value="y" aria-label="y" />
            <CheckboxGroup.Item value="z" aria-label="z" />
          </CheckboxGroup.Root>
        </>,
      );
      expect(box("y")).toHaveAttribute("name", "perm");
      expect(box("z")).toHaveAttribute("name", "perm");
      expect(box("x").name).not.toBe("perm");
    });

    it("renders value and form on every Item and form on the fieldset; the Parent has neither name, value, form nor required", () => {
      render(
        <>
          <form id="f" />
          <CheckboxGroup.Root aria-label="Toppings" form="f" name="t" required>
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        </>,
      );
      expect(group()).toHaveAttribute("form", "f");
      expect((group() as HTMLFieldSetElement).form?.id).toBe("f");
      for (const v of ["a", "b"]) {
        expect(box(v)).toHaveAttribute("value", v);
        expect(box(v)).toHaveAttribute("name", "t");
        expect(box(v).form?.id).toBe("f");
      }
      const parent = parentBox();
      expect(parent).toHaveAttribute("type", "checkbox");
      expect(parent).not.toHaveAttribute("name");
      expect(parent).not.toHaveAttribute("value");
      expect(parent).not.toHaveAttribute("form");
      expect(parent).not.toBeRequired();
      expect(parent).not.toHaveAttribute("aria-checked");
    });

    it("Root disabled renders <fieldset disabled>; Item and Parent disabled render on the input", () => {
      const rootDisabled = render(
        <CheckboxGroup.Root aria-label="T" disabled>
          <CheckboxGroup.Parent values={["a"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      expect(group()).toHaveAttribute("disabled");
      expect(group()).toHaveAttribute("data-disabled", "");
      for (const el of [box("a"), parentBox()]) {
        expect(el).not.toHaveAttribute("disabled");
        expect(el).toBeDisabled();
        expect(el).toHaveAttribute("data-disabled", "");
      }
      rootDisabled.unmount();

      render(
        <CheckboxGroup.Root aria-label="T">
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" disabled />
          <CheckboxGroup.Item value="a" aria-label="a" disabled />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(group()).not.toHaveAttribute("disabled");
      expect(group()).not.toHaveAttribute("data-disabled");
      expect(box("a")).toHaveAttribute("disabled");
      expect(box("a")).toHaveAttribute("data-disabled", "");
      expect(parentBox()).toHaveAttribute("disabled");
      expect(box("b")).not.toHaveAttribute("data-disabled");
    });

    it("emits data attributes by presence; no aria-checked", () => {
      render(
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(box("a")).toHaveAttribute("data-checked", "");
      expect(box("b")).not.toHaveAttribute("data-checked");
      for (const v of ["a", "b"]) {
        expect(box(v)).not.toHaveAttribute("aria-checked");
        expect(box(v)).not.toHaveAttribute("data-pending");
        expect(box(v)).not.toHaveAttribute("data-indeterminate");
        expect(box(v)).not.toBeRequired();
      }
      expect(group()).not.toHaveAttribute("data-pending");
    });

    it("owned keys cannot be overridden through props or a render element", () => {
      const forcedItem = { type: "radio", name: "x", checked: true, form: "zzz", required: true };
      const forcedParent = {
        name: "p",
        value: "v",
        required: true,
        form: "zzz",
        checked: true,
        "aria-checked": "mixed",
        autoComplete: "on",
      };
      render(
        <CheckboxGroup.Root aria-label="T" name="t" defaultValue={["b"]}>
          <CheckboxGroup.Parent
            {...(forcedParent as object)}
            values={["a", "b"]}
            aria-label="all"
          />
          <CheckboxGroup.Item {...(forcedItem as object)} value="a" aria-label="a" />
          <CheckboxGroup.Item
            value="b"
            aria-label="b"
            render={<input type="radio" name="y" value="zzz" checked={false} readOnly disabled />}
          />
          <CheckboxGroup.Item
            value="c"
            aria-label="c"
            disabled
            render={<input disabled={false} />}
          />
        </CheckboxGroup.Root>,
      );
      expect(box("b")).not.toBeDisabled();
      expect(box("c")).toBeDisabled();
      for (const v of ["a", "b"]) {
        expect(box(v)).toHaveAttribute("type", "checkbox");
        expect(box(v)).toHaveAttribute("name", "t");
        expect(box(v)).toHaveAttribute("value", v);
        expect(box(v)).not.toHaveAttribute("form");
        expect(box(v)).not.toBeRequired();
      }
      expect(checkedValues()).toEqual(["b"]);
      const parent = parentBox();
      expect(parent).not.toHaveAttribute("name");
      expect(parent).not.toHaveAttribute("value");
      expect(parent).not.toHaveAttribute("form");
      expect(parent).not.toHaveAttribute("aria-checked");
      expect(parent).not.toBeRequired();
      expect(parent).toHaveAttribute("autocomplete", "off");
      expect(parentShows()).toBe("mixed");
    });

    it("Item, Parent and Label throw outside a Root", () => {
      silenceErrors();
      expect(() => render(<CheckboxGroup.Item value="a" />)).toThrow(
        "CheckboxGroup.Item must be rendered inside a CheckboxGroup.Root.",
      );
      expect(() => render(<CheckboxGroup.Parent values={["a"]} />)).toThrow(
        "CheckboxGroup.Parent must be rendered inside a CheckboxGroup.Root.",
      );
      expect(() => render(<CheckboxGroup.Label>x</CheckboxGroup.Label>)).toThrow(
        "CheckboxGroup.Label must be rendered inside a CheckboxGroup.Root.",
      );
    });
  });

  describe("keyboard", () => {
    it("Tab visits every enabled Parent and Item in order (no roving); Space toggles once", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <button type="button">before</button>
          <Harness
            mode="uncontrolled"
            initial={["b"]}
            action={action}
            parent={["a", "b", "c"]}
            disabledItems={["c"]}
          />
          <button type="button">after</button>
        </>,
      );
      const user = setupUser();
      await user.tab();
      await user.tab();
      expect(parentBox()).toHaveFocus();
      await user.tab();
      expect(box("a")).toHaveFocus();
      await user.tab();
      expect(box("b")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "after" })).toHaveFocus();

      box("a").focus();
      await user.keyboard("[Space]");
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toEqual(["a", "b"]);
      expect(details.event?.type).toBe("click");
      expect(details.reason).toBe("activate");
      expect(checkedValues()).toEqual(["a", "b"]);
    });

    it("has no key handling of its own: arrows, Home and End do nothing", () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      box("a").focus();
      for (const key of ["ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"]) {
        fireEvent.keyDown(box("a"), { key });
      }
      expect(box("a")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
    });
  });

  renderBoth("sync action", (mode) => {
    it("calls valueChangeAction(next, details) with a fresh array in document order", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial={["c"]} action={action} />);
      const user = setupUser();

      await user.click(box("a"));
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toEqual(["a", "c"]);
      expect(details.event).toBeInstanceOf(window.Event);
      expect(details.event?.type).toBe("click");
      expect(details.reason).toBe("activate");
      expect(details.added).toEqual(["a"]);
      expect(details.removed).toEqual([]);
      expect(checkedValues()).toEqual(["a", "c"]);
      expect(dataChecked()).toEqual(["a", "c"]);
      expect(dataPending()).toEqual([]);
      expectNotPending(group());
      expect(committedText()).toBe("a,c");

      await user.click(box("c"));
      expect(calls(action)[1]).toEqual([["a"], "activate", [], ["c"]]);
      expect(checkedValues()).toEqual(["a"]);
      expect(committedText()).toBe("a");
      // A fresh array on every call.
      expect(action.mock.calls[1]![0]).not.toBe(action.mock.calls[0]![0]);
    });

    it("a disabled Item, any Item under Root disabled, or a disabled Parent never dispatches", async () => {
      const action = vi.fn<ActionFn>();
      const { unmount } = render(<Harness mode={mode} action={action} disabledItems={["c"]} />);
      const user = setupUser();
      await user.click(box("c"));
      await act(async () => {
        box("c").click();
      });
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      unmount();

      render(<Harness mode={mode} action={action} disabled parent={["a", "b"]} />);
      await user.click(box("b"));
      await act(async () => {
        box("b").click();
      });
      await act(async () => {
        fireEvent.click(box("b"));
      });
      await act(async () => {
        fireEvent.click(parentBox());
      });
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      expect(committedText()).toBe("a");
    });

    it("a click already cancelled by a pass-through onClick never dispatches", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      function Cancelling() {
        const [value, setValue] = useState<string[]>(["a"]);
        return (
          <CheckboxGroup.Root
            aria-label="T"
            {...(mode === "controlled" ? { value } : { defaultValue: ["a"] })}
            valueChangeAction={async (next, details) => {
              await action(next, details);
              startTransition(() => setValue(next));
            }}
          >
            <CheckboxGroup.Parent
              values={["a", "b"]}
              aria-label="all"
              onClick={(e) => e.preventDefault()}
            />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" onClick={(e) => e.preventDefault()} />
          </CheckboxGroup.Root>
        );
      }
      render(<Cancelling />);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(parentBox());
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(dataChecked()).toEqual(["a"]);
      expectNotPending(group());
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  renderBoth("async action", (mode) => {
    it("shows the optimistic box and data-pending on Root and the clicked Item only until resolve", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(box("b"));
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(dataChecked()).toEqual(["a", "b"]);
      expect(dataPending()).toEqual(["b"]);
      expectPending(group());
      expect(committedText()).toBe("a");

      await act(async () => {
        d.resolve();
      });
      expectNotPending(group());
      expect(dataPending()).toEqual([]);
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(committedText()).toBe("a,b");
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the Error Boundary and leaves committed state", async () => {
      silenceErrors();
      const d = deferred();
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(box("b"));
      expect(checkedValues()).toEqual(["a", "b"]);
      expectPending(group());

      const err = new Error("save failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("group")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
      expect(committedText()).toBe("a");
    });

    it("caught inside the action counts as success", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();

      await user.click(box("b"));
      expectPending(group());
      await act(async () => {
        d.reject(new Error("vetoed"));
      });
      expectNotPending(group());
      expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
      expect(committedText()).toBe("a");
      // Only a controlled parent can veto: uncontrolled commits; controlled rolls the DOM back.
      const expected = mode === "uncontrolled" ? ["a", "b"] : ["a"];
      expect(checkedValues()).toEqual(expected);
      expect(dataChecked()).toEqual(expected);
      expect(dataPending()).toEqual([]);
    });
  });

  describe("rollback of the DOM", () => {
    it("a controlled parent that does not adopt the value unchecks the box again after settle", async () => {
      const d = deferred();
      render(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={() => d.promise}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(box("b"));
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(box("b")).toHaveAttribute("data-pending", "");
      await act(async () => {
        d.resolve();
      });
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
      expectNotPending(group());
      expect(box("b")).toHaveFocus();
    });
  });

  describe("overlapping actions", () => {
    it("click A (slow) then B (fast): both shown throughout, final committed {a, b} (uncontrolled)", async () => {
      const deferreds = [deferred(), deferred()];
      let n = 0;
      const action = vi.fn<ActionFn>(() => deferreds[n++]!.promise);
      render(<Harness mode="uncontrolled" initial={[]} action={action} />);
      const user = setupUser();
      await user.click(box("a"));
      await user.click(box("b"));
      expect(calls(action)).toEqual([
        [["a"], "activate", ["a"], []],
        [["a", "b"], "activate", ["b"], []],
      ]);
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(dataPending()).toEqual(["a", "b"]);

      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(checkedValues()).toEqual(["a", "b"]);
      expectPending(group());
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(dataChecked()).toEqual(["a", "b"]);
      expect(dataPending()).toEqual([]);
      expectNotPending(group());
    });

    it("controlled functional-update wrapper ends on {a, b} with B resolving first", async () => {
      const deferreds = [deferred(), deferred()];
      let n = 0;
      render(<Harness mode="controlled" initial={[]} action={() => deferreds[n++]!.promise} />);
      const user = setupUser();
      await user.click(box("a"));
      await user.click(box("b"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expect(committedText()).toBe("a,b");
      expect(checkedValues()).toEqual(["a", "b"]);
      expectNotPending(group());
    });

    it("clicking A twice fast: A not pending after the second click while Root is; final {}", async () => {
      const deferreds = [deferred(), deferred()];
      let n = 0;
      const action = vi.fn<ActionFn>(() => deferreds[n++]!.promise);
      render(<Harness mode="uncontrolled" initial={[]} action={action} />);
      const user = setupUser();
      await user.click(box("a"));
      expect(dataPending()).toEqual(["a"]);
      await user.click(box("a"));
      expect(calls(action)).toEqual([
        [["a"], "activate", ["a"], []],
        [[], "activate", [], ["a"]],
      ]);
      expect(dataPending()).toEqual([]);
      expectPending(group());
      expect(checkedValues()).toEqual([]);
      await act(async () => {
        deferreds[0]!.resolve();
        deferreds[1]!.resolve();
      });
      expect(checkedValues()).toEqual([]);
      expect(committedText()).toBe("");
      expectNotPending(group());
    });
  });

  renderBoth("superseded rejection", (mode) => {
    function renderTwo(onError: (error: unknown) => void) {
      const deferreds = [deferred(), deferred()];
      let n = 0;
      const action = vi.fn<ActionFn>(() => deferreds[n++]!.promise);
      render(<Harness mode={mode} action={action} boundary={onError} />);
      return { deferreds, action };
    }

    it("reaches the boundary when the older action rejects after the newer resolved", async () => {
      silenceErrors();
      const onError = vi.fn();
      const { deferreds, action } = renderTwo(onError);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(box("c"));
      expect(action.mock.calls.map(([n]) => n)).toEqual([
        ["a", "b"],
        ["a", "b", "c"],
      ]);
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(onError).not.toHaveBeenCalled();

      const err = new Error("older save failed");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("group")).not.toBeInTheDocument();
      // The newer action's outcome is unaffected: it resolved and the harness adopted its patch.
      expect(committedText()).toBe("a,c");
    });

    it("reaches the boundary when the older action rejects while the newer is pending", async () => {
      silenceErrors();
      const onError = vi.fn();
      const { deferreds } = renderTwo(onError);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(box("c"));
      expectPending(group());
      const err = new Error("older save failed");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");

      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(committedText()).toBe("a,c");
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps old content, no fallback, Root pending while the new content loads", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      render(<Harness mode={mode} suspender={suspender} />);
      const user = setupUser();
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");

      await user.click(box("b"));
      expect(checkedValues()).toEqual(["a", "b"]);
      expectPending(group());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");

      await act(async () => {
        suspender.resolve("a,b");
      });
      expect(screen.getByTestId("suspender")).toHaveTextContent("a,b");
      expect(committedText()).toBe("a,b");
      expectNotPending(group());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });
  });

  describe("value model", () => {
    it("ignores duplicates in value and defaultValue", async () => {
      const action = vi.fn<ActionFn>();
      const first = render(
        <CheckboxGroup.Root aria-label="T" defaultValue={["a", "a"]} valueChangeAction={action}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(box("b"));
      expect(action.mock.calls[0]?.[0]).toEqual(["a", "b"]);
      first.unmount();

      render(
        <CheckboxGroup.Root aria-label="T" value={["b", "b", "a"]} valueChangeAction={action}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(checkedValues()).toEqual(["a", "b"]);
      await user.click(box("a"));
      expect(action.mock.calls[1]?.[0]).toEqual(["b"]);
    });

    it("a value with no Item survives an Item toggle and is absent from FormData", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <form data-testid="form">
          <CheckboxGroup.Root
            aria-label="T"
            name="t"
            value={["ghost", "a"]}
            valueChangeAction={action}
          >
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        </form>,
      );
      expect(new FormData(form()).getAll("t")).toEqual(["a"]);
      const user = setupUser();
      await user.click(box("b"));
      // Items in document order, the value with no Item last.
      expect(action.mock.calls[0]?.[0]).toEqual(["a", "b", "ghost"]);
      await user.click(box("a"));
      expect(action.mock.calls[1]?.[0]).toEqual(["ghost"]);
    });

    it("Root state value is in document order, also after Items are reordered", async () => {
      function Reorder() {
        const [order, setOrder] = useState(["a", "b", "c"]);
        return (
          <>
            <CheckboxGroup.Root aria-label="T" defaultValue={["c", "ghost", "a"]}>
              {(s) => (
                <>
                  <output data-testid="state">{s.value.join(",")}</output>
                  {order.map((v) => (
                    <CheckboxGroup.Item key={v} value={v} aria-label={v} />
                  ))}
                </>
              )}
            </CheckboxGroup.Root>
            <button type="button" onClick={() => setOrder(["c", "b", "a"])}>
              reverse
            </button>
          </>
        );
      }
      render(<Reorder />);
      // Items first in document order, the value with no Item last.
      expect(screen.getByTestId("state").textContent).toBe("a,c,ghost");
      const user = setupUser();
      await user.click(box("b"));
      expect(screen.getByTestId("state").textContent).toBe("a,b,c,ghost");
      await user.click(screen.getByRole("button", { name: "reverse" }));
      expect(screen.getByTestId("state").textContent).toBe("c,b,a,ghost");
    });

    it("next follows the DOM order after the Items are reordered", async () => {
      const action = vi.fn<ActionFn>();
      function Reorder() {
        const [order, setOrder] = useState(["a", "b", "c"]);
        return (
          <>
            <CheckboxGroup.Root aria-label="T" defaultValue={["c"]} valueChangeAction={action}>
              {order.map((v) => (
                <CheckboxGroup.Item key={v} value={v} aria-label={v} />
              ))}
            </CheckboxGroup.Root>
            <button type="button" onClick={() => setOrder(["c", "b", "a"])}>
              reverse
            </button>
          </>
        );
      }
      render(<Reorder />);
      const user = setupUser();
      await user.click(box("a"));
      expect(action.mock.calls[0]?.[0]).toEqual(["a", "c"]);
      await user.click(screen.getByRole("button", { name: "reverse" }));
      await user.click(box("b"));
      expect(action.mock.calls[1]?.[0]).toEqual(["c", "b", "a"]);
    });

    it("a set-equal controlled value in a different order changes nothing, also while pending", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      function Parent() {
        const [value, setValue] = useState(["a", "b"]);
        return (
          <>
            <CheckboxGroup.Root aria-label="T" value={value} valueChangeAction={action}>
              <CheckboxGroup.Item value="a" aria-label="a" />
              <CheckboxGroup.Item value="b" aria-label="b" />
              <CheckboxGroup.Item value="c" aria-label="c" />
            </CheckboxGroup.Root>
            <button type="button" onClick={() => setValue(["b", "a"])}>
              reorder
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(box("c"));
      expect(checkedValues()).toEqual(["a", "b", "c"]);
      await user.click(screen.getByRole("button", { name: "reorder" }));
      expect(checkedValues()).toEqual(["a", "b", "c"]);
      expect(dataPending()).toEqual(["c"]);
      await act(async () => {
        d.resolve();
      });
      // The controlled parent did not adopt "c".
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("Parent derivation", () => {
    function Group({
      initial,
      values = ["a", "b", "c"],
    }: {
      initial: string[];
      values?: string[];
    }) {
      return (
        <CheckboxGroup.Root aria-label="T" defaultValue={initial}>
          <CheckboxGroup.Parent values={values} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>
      );
    }

    it.each([
      [[], "unchecked"],
      [["b"], "mixed"],
      [["a", "c"], "mixed"],
      [["a", "b", "c"], "checked"],
    ] as const)("over three values, %j checked → %s", (initial, shown) => {
      render(<Group initial={[...initial]} />);
      expect(parentShows()).toBe(shown);
    });

    it("values={[]} is unchecked, not mixed, and its click dispatches nothing", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Parent values={[]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      expect(parentShows()).toBe("unchecked");
      const user = setupUser();
      await user.click(parentBox());
      expect(action).not.toHaveBeenCalled();
      expect(parentShows()).toBe("unchecked");
    });

    it("follows an Item click immediately (while pending) and reverts on a controlled rollback", async () => {
      const d = deferred();
      render(
        <CheckboxGroup.Root aria-label="T" value={[]} valueChangeAction={() => d.promise}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(parentShows()).toBe("unchecked");
      const user = setupUser();
      await user.click(box("a"));
      expectPending(group());
      // Not suspended while pending (design 6.1).
      expect(parentShows()).toBe("mixed");
      await act(async () => {
        d.resolve();
      });
      expect(parentShows()).toBe("unchecked");
    });

    it("a Parent click from mixed that rolls back returns the Parent to mixed", async () => {
      const d = deferred();
      render(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={() => d.promise}>
          <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(parentBox());
      expect(parentShows()).toBe("checked");
      expect(checkedValues()).toEqual(["a", "b", "c"]);
      expect(dataPending()).toEqual(["b", "c"]);
      expect(parentBox()).toHaveAttribute("data-pending", "");
      await act(async () => {
        d.resolve();
      });
      expect(parentShows()).toBe("mixed");
      expect(checkedValues()).toEqual(["a"]);
      expect(parentBox()).not.toHaveAttribute("data-pending");
    });
  });

  renderBoth("Parent cycle", (mode) => {
    it("mixed → check all; checked → uncheck all; unchecked → restore the committed partial", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial={["b"]} action={action} parent={["a", "b", "c"]} />);
      const user = setupUser();
      expect(parentShows()).toBe("mixed");

      await user.click(parentBox());
      expect(calls(action)[0]).toEqual([["a", "b", "c"], "activate", ["a", "c"], []]);
      expect(parentShows()).toBe("checked");

      await user.click(parentBox());
      expect(calls(action)[1]).toEqual([[], "activate", [], ["a", "b", "c"]]);
      expect(parentShows()).toBe("unchecked");

      // The memory was seeded from the mount-time value.
      await user.click(parentBox());
      expect(calls(action)[2]).toEqual([["b"], "activate", ["b"], []]);
      expect(parentShows()).toBe("mixed");
      expect(committedText()).toBe("b");

      // A newer committed partial replaces the memory.
      await user.click(box("c"));
      await user.click(box("b"));
      expect(checkedValues()).toEqual(["c"]);
      await user.click(parentBox());
      await user.click(parentBox());
      expect(checkedValues()).toEqual([]);
      await user.click(parentBox());
      expect(calls(action).at(-1)).toEqual([["c"], "activate", ["c"], []]);
    });

    it("unchecked without history checks all", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial={[]} action={action} parent={["a", "b", "c"]} />);
      const user = setupUser();
      await user.click(parentBox());
      expect(calls(action)).toEqual([[["a", "b", "c"], "activate", ["a", "b", "c"], []]]);
      expect(parentShows()).toBe("checked");
    });

    it("a partial state that only ever rolled back is not restored", async () => {
      const d = deferred();
      let n = 0;
      const action = vi.fn<ActionFn>(() => (n++ === 0 ? d.promise : undefined));
      render(
        <Harness mode={mode} initial={[]} action={action} catchErrors parent={["a", "b", "c"]} />,
      );
      const user = setupUser();
      await user.click(box("a"));
      expect(parentShows()).toBe("mixed");
      await act(async () => {
        d.reject(new Error("no"));
      });
      if (mode === "controlled") {
        // The controlled parent vetoed: the partial {a} was never committed.
        expect(parentShows()).toBe("unchecked");
        await user.click(parentBox());
        expect(calls(action).at(-1)).toEqual([["a", "b", "c"], "activate", ["a", "b", "c"], []]);
      } else {
        // Uncontrolled: a caught error is a success, so {a} was committed and is restored.
        await user.click(box("a"));
        await user.click(parentBox());
        expect(calls(action).at(-1)).toEqual([["a"], "activate", ["a"], []]);
      }
    });

    it("a value of the Parent with no Item is still added and removed", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} initial={[]} action={action} parent={["a", "b", "ghost"]} />);
      const user = setupUser();
      await user.click(parentBox());
      expect(calls(action)[0]).toEqual([["a", "b", "ghost"], "activate", ["a", "b", "ghost"], []]);
      expect(parentShows()).toBe("checked");
      await user.click(parentBox());
      expect(calls(action)[1]).toEqual([[], "activate", [], ["a", "b", "ghost"]]);
    });
  });

  describe("Parent pending", () => {
    it("pending while any of its values differs; not for an unrelated Item", async () => {
      const deferreds = [deferred(), deferred()];
      let n = 0;
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={() => deferreds[n++]!.promise}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="x" aria-label="x" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(box("x"));
      expectPending(group());
      expect(parentBox()).not.toHaveAttribute("data-pending");
      await act(async () => {
        deferreds[0]!.resolve();
      });
      await user.click(box("b"));
      expect(parentBox()).toHaveAttribute("data-pending", "");
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(parentBox()).not.toHaveAttribute("data-pending");
    });
  });

  describe("Parent, server rendering", () => {
    it("emits data-indeterminate and no aria-checked; the property is set after hydration", async () => {
      const consoleError = silenceErrors();
      const ui = (
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>
      );
      const html = renderToString(ui);
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = html;
      const serverParent = container.querySelector<HTMLInputElement>("input:not([name])")!;
      expect(serverParent).toHaveAttribute("data-indeterminate", "");
      expect(serverParent).not.toHaveAttribute("aria-checked");
      expect(serverParent).not.toHaveAttribute("name");
      // Never restored by Firefox's form-state restoration (design 8.1).
      expect(serverParent).toHaveAttribute("autocomplete", "off");
      expect(serverParent.indeterminate).toBe(false);

      render(ui, { container, hydrate: true });
      await flushMicrotasks();
      expect(parentBox()).toBe(serverParent);
      expect(serverParent.indeterminate).toBe(true);
      expect(parentShows()).toBe("mixed");
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("Parent and disabled Items", () => {
    async function hydrate(ui: ReactNode, mutate: (container: HTMLElement) => void = () => {}) {
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      const serverParent = container.querySelector<HTMLInputElement>("input:not([name])")!;
      const server = {
        checked: serverParent.hasAttribute("data-checked"),
        indeterminate: serverParent.hasAttribute("data-indeterminate"),
      };
      mutate(container);
      render(ui, { container, hydrate: true });
      await flushMicrotasks();
      return server;
    }

    renderBoth("click and derivation", (mode) => {
      it("from mixed checks only the enabled values; a disabled unchecked Item stays unchecked", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            initial={["a"]}
            action={action}
            parent={["a", "b", "c"]}
            disabledItems={["c"]}
          />,
        );
        expect(parentShows()).toBe("mixed");
        const user = setupUser();
        await user.click(parentBox());
        expect(calls(action)).toEqual([[["a", "b"], "activate", ["b"], []]]);
        // Every enabled Item is checked: the Parent shows checked over the unchecked disabled one.
        expect(parentShows()).toBe("checked");
        expect(box("c").checked).toBe(false);
        expect(committedText()).toBe("a,b");
        await user.click(parentBox());
        expect(calls(action)[1]).toEqual([[], "activate", [], ["a", "b"]]);
        expect(parentShows()).toBe("unchecked");
      });

      it("uncheck all keeps a checked disabled Item, and the Parent then shows unchecked", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            initial={["a", "b", "c"]}
            action={action}
            parent={["a", "b", "c"]}
            disabledItems={["c"]}
          />,
        );
        expect(parentShows()).toBe("checked");
        const user = setupUser();
        await user.click(parentBox());
        expect(calls(action)).toEqual([[["c"], "activate", [], ["a", "b"]]]);
        expect(checkedValues()).toEqual(["c"]);
        expect(parentShows()).toBe("unchecked");
        // No partial combination of the enabled values was ever committed: check all of them.
        await user.click(parentBox());
        expect(calls(action)[1]).toEqual([["a", "b", "c"], "activate", ["a", "b"], []]);
        expect(parentShows()).toBe("checked");
      });

      it("restores the last committed partial combination of the enabled values", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            initial={["a", "c"]}
            action={action}
            parent={["a", "b", "c"]}
            disabledItems={["c"]}
          />,
        );
        expect(parentShows()).toBe("mixed");
        const user = setupUser();
        await user.click(parentBox());
        await user.click(parentBox());
        await user.click(parentBox());
        expect(calls(action)).toEqual([
          [["a", "b", "c"], "activate", ["b"], []],
          [["c"], "activate", [], ["a", "b"]],
          [["a", "c"], "activate", ["a"], []],
        ]);
        expect(parentShows()).toBe("mixed");
      });

      it("every value has only disabled Items: the Parent acts on all of them", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            initial={["b"]}
            action={action}
            parent={["b", "c"]}
            disabledItems={["b", "c"]}
          />,
        );
        expect(parentShows()).toBe("mixed");
        const user = setupUser();
        await user.click(parentBox());
        expect(calls(action)).toEqual([[["b", "c"], "activate", ["c"], []]]);
        expect(parentShows()).toBe("checked");
      });
    });

    it("follows an Item's disabled prop as it changes", async () => {
      function Group({ disabledC }: { disabledC: boolean }) {
        return (
          <CheckboxGroup.Root aria-label="T" defaultValue={["a", "b"]}>
            <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
            <CheckboxGroup.Item value="c" aria-label="c" disabled={disabledC} />
          </CheckboxGroup.Root>
        );
      }
      const { rerender } = render(<Group disabledC={false} />);
      expect(parentShows()).toBe("mixed");
      rerender(<Group disabledC />);
      expect(parentShows()).toBe("checked");
      rerender(<Group disabledC={false} />);
      expect(parentShows()).toBe("mixed");
    });

    it("Root disabled is not an Item's own disabled: the derivation is unchanged", () => {
      render(
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]} disabled>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(parentShows()).toBe("mixed");
      expect(parentBox()).toBeDisabled();
    });

    it("the server counts disabled Items; hydration settles without a dispatch or a warning", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      const server = await hydrate(
        <Harness
          mode="uncontrolled"
          initial={["a", "b"]}
          action={action}
          parent={["a", "b", "c"]}
          disabledItems={["c"]}
        />,
      );
      expect(server).toEqual({ checked: false, indeterminate: true });
      expect(action).not.toHaveBeenCalled();
      expect(parentShows()).toBe("checked");
      expect(consoleError).not.toHaveBeenCalled();
    });

    renderBoth("hydration", (mode) => {
      it("a Parent checked before hydration checks only the enabled values", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <StrictMode>
            <Harness
              mode={mode}
              initial={["a"]}
              action={action}
              parent={["a", "b", "c"]}
              disabledItems={["c"]}
            />
          </StrictMode>,
          (c) => {
            c.querySelector<HTMLInputElement>("input:not([name])")!.checked = true;
          },
        );
        expect(calls(action)).toEqual([[["a", "b"], "platform", ["b"], []]]);
        expect(checkedValues()).toEqual(["a", "b"]);
        expect(parentShows()).toBe("checked");
      });

      it("a Parent unchecked before hydration keeps a checked disabled Item", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <Harness
            mode={mode}
            initial={["a", "b", "c"]}
            action={action}
            parent={["a", "b", "c"]}
            disabledItems={["c"]}
          />,
          (c) => {
            c.querySelector<HTMLInputElement>("input:not([name])")!.checked = false;
          },
        );
        expect(calls(action)).toEqual([[["c"], "platform", [], ["a", "b"]]]);
        expect(parentShows()).toBe("unchecked");
      });
    });
  });

  describe("section parents", () => {
    it("two Parents over disjoint subsets derive and dispatch independently; a union Parent is a grand-parent", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <CheckboxGroup.Root aria-label="Perm" defaultValue={["u1"]} valueChangeAction={action}>
          <CheckboxGroup.Parent values={["u1", "u2", "b1", "b2"]} aria-label="everything" />
          <CheckboxGroup.Parent values={["u1", "u2"]} aria-label="users" />
          <CheckboxGroup.Item value="u1" aria-label="u1" />
          <CheckboxGroup.Item value="u2" aria-label="u2" />
          <CheckboxGroup.Parent values={["b1", "b2"]} aria-label="billing" />
          <CheckboxGroup.Item value="b1" aria-label="b1" />
          <CheckboxGroup.Item value="b2" aria-label="b2" />
        </CheckboxGroup.Root>,
      );
      expect(parentShows(box("users"))).toBe("mixed");
      expect(parentShows(box("billing"))).toBe("unchecked");
      expect(parentShows(box("everything"))).toBe("mixed");

      const user = setupUser();
      await user.click(box("billing"));
      expect(calls(action)[0]).toEqual([["u1", "b1", "b2"], "activate", ["b1", "b2"], []]);
      expect(parentShows(box("billing"))).toBe("checked");
      expect(parentShows(box("users"))).toBe("mixed");
      expect(parentShows(box("everything"))).toBe("mixed");

      await user.click(box("users"));
      expect(calls(action)[1]).toEqual([["u1", "u2", "b1", "b2"], "activate", ["u2"], []]);
      expect(parentShows(box("everything"))).toBe("checked");

      await user.click(box("everything"));
      expect(calls(action)[2]).toEqual([[], "activate", [], ["u1", "u2", "b1", "b2"]]);
      expect(parentShows(box("users"))).toBe("unchecked");
      expect(parentShows(box("billing"))).toBe("unchecked");
    });
  });

  describe("group required", () => {
    it("every Item is required while nothing is checked, none once one is; never the Parent", async () => {
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" required>
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
        </form>,
      );
      expect(box("a")).toBeRequired();
      expect(box("b")).toBeRequired();
      expect(parentBox()).not.toBeRequired();
      expect(group()).not.toHaveAttribute("aria-required");
      expect(form().checkValidity()).toBe(false);

      const user = setupUser();
      await user.click(box("b"));
      expect(box("a")).not.toBeRequired();
      expect(box("b")).not.toBeRequired();
      expect(form().checkValidity()).toBe(true);
    });

    it("follows optimistic state: a pending uncheck of the last box adds it, a rollback removes it", async () => {
      const d = deferred();
      render(
        <CheckboxGroup.Root
          aria-label="T"
          value={["a"]}
          required
          valueChangeAction={() => d.promise}
        >
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(box("a")).not.toBeRequired();
      const user = setupUser();
      await user.click(box("a"));
      expectPending(group());
      expect(box("a")).toBeRequired();
      expect(box("b")).toBeRequired();
      await act(async () => {
        d.resolve();
      });
      expect(box("a")).not.toBeRequired();
      expect(box("b")).not.toBeRequired();
    });

    it("a checked disabled Item does not satisfy it (it is not submitted)", async () => {
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" required defaultValue={["c"]}>
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="c" aria-label="c" disabled />
          </CheckboxGroup.Root>
        </form>,
      );
      expect(box("a")).toBeRequired();
      expect(form().checkValidity()).toBe(false);
      expect(new FormData(form()).getAll("t")).toEqual([]);
      const user = setupUser();
      await user.click(box("a"));
      expect(box("a")).not.toBeRequired();
      expect(form().checkValidity()).toBe(true);
    });

    it("a value with no Item does not satisfy it", () => {
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" required value={["ghost"]}>
            <CheckboxGroup.Item value="a" aria-label="a" />
          </CheckboxGroup.Root>
        </form>,
      );
      expect(box("a")).toBeRequired();
      expect(form().checkValidity()).toBe(false);
    });

    it("the server HTML counts any checked value (it cannot know the Items); hydration corrects it", async () => {
      const consoleError = silenceErrors();
      const ui = (
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" required defaultValue={["c"]}>
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="c" aria-label="c" disabled />
          </CheckboxGroup.Root>
        </form>
      );
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      expect(container.querySelector('input[value="a"]')).not.toHaveAttribute("required");
      render(ui, { container, hydrate: true });
      await flushMicrotasks();
      expect(box("a")).toBeRequired();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("a disabled group never blocks submission", () => {
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" required disabled>
            <CheckboxGroup.Item value="a" aria-label="a" />
          </CheckboxGroup.Root>
        </form>,
      );
      expect(box("a")).toBeRequired();
      expect(form().checkValidity()).toBe(true);
    });
  });

  describe("forms", () => {
    it("FormData.getAll(name) lists the checked values in document order; the Parent posts nothing", async () => {
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" name="t" defaultValue={["c"]}>
            <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
            <CheckboxGroup.Item value="c" aria-label="c" />
          </CheckboxGroup.Root>
        </form>,
      );
      expect([...new FormData(form())]).toEqual([["t", "c"]]);
      const user = setupUser();
      await user.click(box("a"));
      expect(new FormData(form()).getAll("t")).toEqual(["a", "c"]);
      await user.click(parentBox());
      expect([...new FormData(form())]).toEqual([
        ["t", "a"],
        ["t", "b"],
        ["t", "c"],
      ]);
    });

    it("a form= Root posts and resets with the external form", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <form id="ext" data-testid="form" />
          <CheckboxGroup.Root aria-label="T" name="t" form="ext" valueChangeAction={action}>
            <CheckboxGroup.Item value="a" aria-label="a" />
          </CheckboxGroup.Root>
        </>,
      );
      const user = setupUser();
      await user.click(box("a"));
      expect(new FormData(form()).getAll("t")).toEqual(["a"]);
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(calls(action)).toEqual([
        [["a"], "activate", ["a"], []],
        [[], "platform", [], ["a"]],
      ]);
      expect(checkedValues()).toEqual([]);
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
    const setChecked =
      (value: string, checked = true) =>
      (c: HTMLElement) => {
        (c.querySelector(`input[value="${value}"]`) as HTMLInputElement).checked = checked;
      };

    renderBoth("hydration", (mode) => {
      it("dispatches the hydrated DOM value once with reason platform and no event", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} initial={["a"]} action={action} />, setChecked("c"));
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toEqual(["a", "c"]);
        expect(details.event).toBeUndefined();
        expect(JSON.stringify(details)).toBe('{"reason":"platform","added":["c"],"removed":[]}');
        expect(checkedValues()).toEqual(["a", "c"]);
        expect(dataChecked()).toEqual(["a", "c"]);
        expect(committedText()).toBe("a,c");
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("dispatches once under StrictMode, for several pre-hydration clicks", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <StrictMode>
            <Harness mode={mode} initial={["a"]} action={action} />
          </StrictMode>,
          (c) => {
            setChecked("c")(c);
            setChecked("a", false)(c);
          },
        );
        expect(calls(action)).toEqual([[["c"], "platform", ["c"], ["a"]]]);
        expect(checkedValues()).toEqual(["c"]);
      });

      it("nothing when the DOM matches", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} initial={["b"]} action={action} />, () => {});
        expect(action).not.toHaveBeenCalled();
        expect(checkedValues()).toEqual(["b"]);
      });
    });

    it("a controlled parent that refuses gets the DOM back on its value after settle", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>,
        setChecked("c"),
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
    });

    it("a controlled value with no Item is not removed by the mount read", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <CheckboxGroup.Root aria-label="T" value={["ghost", "a"]} valueChangeAction={action}>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
        () => {},
      );
      expect(action).not.toHaveBeenCalled();
    });

    it("createRoot never dispatches on mount", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <StrictMode>
          <Harness mode="uncontrolled" initial={["b"]} action={action} parent={["a", "b"]} />
        </StrictMode>,
      );
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["b"]);
    });
  });

  describe("platform: a pre-hydration Parent click", () => {
    async function hydrate(ui: ReactNode, mutate: (container: HTMLElement) => void) {
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      mutate(container);
      render(ui, { container, hydrate: true });
      await flushMicrotasks();
    }
    const clickParent = (checked: boolean) => (c: HTMLElement) => {
      c.querySelector<HTMLInputElement>("input:not([name])")!.checked = checked;
    };

    renderBoth("hydration", (mode) => {
      it("a mixed Parent checked before hydration dispatches its missing values once", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        await hydrate(
          <StrictMode>
            <Harness mode={mode} initial={["a"]} action={action} parent={["a", "b", "c"]} />
          </StrictMode>,
          clickParent(true),
        );
        expect(calls(action)).toEqual([[["a", "b", "c"], "platform", ["b", "c"], []]]);
        expect(action.mock.calls[0]?.[1].event).toBeUndefined();
        expect(checkedValues()).toEqual(["a", "b", "c"]);
        expect(dataChecked()).toEqual(["a", "b", "c"]);
        expect(parentShows()).toBe("checked");
        expect(committedText()).toBe("a,b,c");
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("a checked Parent unchecked before hydration removes all its values", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <Harness mode={mode} initial={["a", "b"]} action={action} parent={["a", "b"]} />,
          clickParent(false),
        );
        expect(calls(action)).toEqual([[[], "platform", [], ["a", "b"]]]);
        expect(checkedValues()).toEqual([]);
        expect(parentShows()).toBe("unchecked");
      });
    });

    it("form-state restoration of the Items only (the Parent is autocomplete=off) removes just them", async () => {
      // Firefox, after the user unchecked "c" and reloaded: it restores the Items, not the Parent.
      const action = vi.fn<ActionFn>();
      await hydrate(
        <Harness
          mode="uncontrolled"
          initial={["a", "b", "c"]}
          action={action}
          parent={["a", "b", "c"]}
        />,
        (c) => {
          c.querySelector<HTMLInputElement>('input[value="c"]')!.checked = false;
        },
      );
      expect(calls(action)).toEqual([[["a", "b"], "platform", [], ["c"]]]);
      expect(parentShows()).toBe("mixed");
    });

    it("a refused dispatch puts the Parent back to mixed", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
        clickParent(true),
      );
      expect(calls(action)).toEqual([[["a", "b"], "platform", ["b"], []]]);
      expect(checkedValues()).toEqual(["a"]);
      expect(parentShows()).toBe("mixed");
    });
  });

  describe("platform: parts that mount after the Root (Suspense between Root and parts)", () => {
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
    function LateGroup({
      gate,
      mode,
      action,
      initial = ["a"],
      lateParent = false,
    }: {
      gate: Promise<void>;
      mode: ControlMode;
      action: ActionFn;
      initial?: string[];
      lateParent?: boolean;
    }) {
      const [value, setValue] = useState<string[]>(initial);
      return (
        <CheckboxGroup.Root
          aria-label="T"
          {...(mode === "controlled" ? { value } : { defaultValue: initial })}
          valueChangeAction={async (next, details) => {
            await action(next, details);
            startTransition(() => setValue((prev) => applyDetails(prev, details)));
          }}
        >
          <CheckboxGroup.Item value="a" aria-label="a" />
          <Suspense fallback={null}>
            <Gate promise={gate}>
              {lateParent && <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />}
              <CheckboxGroup.Item value="b" aria-label="b" />
              <CheckboxGroup.Item value="c" aria-label="c" />
            </Gate>
          </Suspense>
        </CheckboxGroup.Root>
      );
    }
    async function hydrateLate(props: Omit<Parameters<typeof LateGroup>[0], "gate">) {
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(<LateGroup gate={fulfilled()} {...props} />);
      const g = gate();
      // Inside an async `act`: a render that suspends in a sync `act` never retries in jsdom.
      await act(async () => {
        render(<LateGroup gate={g.promise} {...props} />, { container, hydrate: true });
      });
      return { container, g };
    }

    renderBoth("late hydration", (mode) => {
      it("pre-hydration clicks on two late Items dispatch exactly once when they hydrate", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        const { container, g } = await hydrateLate({ mode, action });
        expect(action).not.toHaveBeenCalled();

        const b = container.querySelector<HTMLInputElement>('input[value="b"]')!;
        const c = container.querySelector<HTMLInputElement>('input[value="c"]')!;
        b.checked = true;
        c.checked = true;
        await act(async () => {
          g.open();
        });
        await flushMicrotasks();

        expect(calls(action)).toEqual([[["a", "b", "c"], "platform", ["b", "c"], []]]);
        expect(action.mock.calls[0]?.[1].event).toBeUndefined();
        expect(box("c")).toBe(c);
        expect(checkedValues()).toEqual(["a", "b", "c"]);
        expect(dataChecked()).toEqual(["a", "b", "c"]);
        // No partial-hydration warning (design 8.3): nothing logged at all.
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("a late Parent clicked before hydration reports through the late path", async () => {
        const action = vi.fn<ActionFn>();
        const { container, g } = await hydrateLate({ mode, action, lateParent: true });
        container.querySelector<HTMLInputElement>("input:not([name])")!.checked = true;
        await act(async () => {
          g.open();
        });
        await flushMicrotasks();
        expect(calls(action)).toEqual([[["a", "b", "c"], "platform", ["b", "c"], []]]);
        expect(checkedValues()).toEqual(["a", "b", "c"]);
        expect(parentShows()).toBe("checked");
      });

      it("partial hydration works: a click on a hydrated Item while others are dehydrated", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        const { container, g } = await hydrateLate({ mode, action, initial: ["b"] });
        const uncaught: unknown[] = [];
        const onError = (e: ErrorEvent) => {
          uncaught.push(e.error);
          e.preventDefault();
        };
        window.addEventListener("error", onError);
        try {
          await act(async () => {
            container.querySelector<HTMLInputElement>('input[value="a"]')!.click();
          });
        } finally {
          window.removeEventListener("error", onError);
        }
        expect(uncaught).toEqual([]);
        expect(calls(action)).toEqual([[["a", "b"], "activate", ["a"], []]]);

        await act(async () => {
          g.open();
        });
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(1);
        expect(checkedValues()).toEqual(["a", "b"]);
        expect(dataChecked()).toEqual(["a", "b"]);
        expect(dataPending()).toEqual([]);
        // No library warning (React itself may report the boundary it had to client-render).
        expect(
          consoleError.mock.calls.filter(([m]) => String(m).startsWith("CheckboxGroup")),
        ).toEqual([]);
      });
    });

    it("a late Parent hydrating after a disabled Item registered compares with the server's derivation", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      function Group({ gate }: { gate: Promise<void> }) {
        return (
          <CheckboxGroup.Root aria-label="T" defaultValue={["a", "b"]} valueChangeAction={action}>
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="c" aria-label="c" disabled />
            <Suspense fallback={null}>
              <Gate promise={gate}>
                <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
                <CheckboxGroup.Item value="b" aria-label="b" />
              </Gate>
            </Suspense>
          </CheckboxGroup.Root>
        );
      }
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(<Group gate={fulfilled()} />);
      const g = gate();
      await act(async () => {
        render(<Group gate={g.promise} />, { container, hydrate: true });
      });
      await act(async () => {
        g.open();
      });
      await flushMicrotasks();
      // Server: mixed (2 of 3). Over the enabled values the Parent is checked, but its DOM was
      // never clicked: nothing to report.
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(parentShows()).toBe("checked");
      expect(
        consoleError.mock.calls.filter(([m]) => String(m).startsWith("CheckboxGroup")),
      ).toEqual([]);
    });

    it("late Items mounted by createRoot do not dispatch", async () => {
      const consoleError = vi.spyOn(console, "error");
      const action = vi.fn<ActionFn>();
      const g = gate();
      await act(async () => {
        render(<LateGroup gate={g.promise} mode="uncontrolled" action={action} lateParent />);
      });
      expect(items()).toHaveLength(1);
      await act(async () => {
        g.open();
      });
      await flushMicrotasks();
      expect(items()).toHaveLength(3);
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      expect(parentShows()).toBe("mixed");
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  renderBoth("platform: form reset", (mode) => {
    it("<button type=reset> dispatches once with the reset event and commits", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(box("c"));
      expect(committedText()).toBe("a,b,c");
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(3);
      const [next, details] = action.mock.calls[2]!;
      expect(next).toEqual(["a"]);
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("reset");
      expect(details.added).toEqual([]);
      expect(details.removed).toEqual(["b", "c"]);
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
      expect(committedText()).toBe("a");
    });

    it("a reset that both checks and unchecks carries added and removed", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm parent={["a", "b", "c"]} />);
      const user = setupUser();
      await user.click(box("a"));
      await user.click(box("b"));
      expect(checkedValues()).toEqual(["b"]);
      await act(async () => {
        form().reset();
      });
      expect(calls(action).at(-1)).toEqual([["a"], "platform", ["a"], ["b"]]);
      expect(checkedValues()).toEqual(["a"]);
      expect(parentShows()).toBe("mixed");
    });

    it("a cancelled reset dispatches nothing and leaves the DOM", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.click(box("b"));
      form().addEventListener("reset", (e) => e.preventDefault());
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(checkedValues()).toEqual(["a", "b"]);
    });

    it("a reset whose target set-equals the optimistic set dispatches nothing", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm initial={["b", "c"]} />);
      const user = setupUser();
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["b", "c"]);
    });

    it("a disabled group still follows the reset", async () => {
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
      await user.click(box("b"));
      await user.click(screen.getByRole("button", { name: "disable" }));
      expect(group()).toBeDisabled();
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(calls(action)).toEqual([
        [["a", "b"], "activate", ["b"], []],
        [["a"], "platform", [], ["b"]],
      ]);
      expect(checkedValues()).toEqual(["a"]);
      expect(committedText()).toBe("a");
    });
  });

  renderBoth("platform: base comparison and equals", (mode) => {
    // Guards the explicit null check in `base()` and the `equals` option: with `Object.is` every
    // reset read (a new Set) would differ from the base and dispatch.
    it("two synchronous form.reset() calls while a reset is pending dispatch once", async () => {
      const d = deferred();
      const actions: [string[], string][] = [];
      render(
        <Harness
          mode={mode}
          initial={[]}
          inForm
          action={(next, details) => {
            actions.push([next, details.reason]);
            return d.promise;
          }}
        />,
      );
      const user = setupUser();
      await user.click(box("c"));
      await act(async () => {
        form().reset();
        form().reset();
      });
      expect(actions).toEqual([
        [["c"], "activate"],
        [[], "platform"],
      ]);
      expect(checkedValues()).toEqual([]);
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(actions).toHaveLength(2);
      expect(checkedValues()).toEqual([]);
      expect(committedText()).toBe("");
    });
  });

  describe("platform: form reset, controlled parent decides", () => {
    it("a parent that refuses gets the DOM re-synced to its value after settle", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} inForm refusePlatform />);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(calls(action)).toEqual([
        [["a", "b"], "activate", ["b"], []],
        [["a"], "platform", [], ["b"]],
      ]);
      expect(checkedValues()).toEqual(["a", "b"]);
      expect(dataChecked()).toEqual(["a", "b"]);
      expect(committedText()).toBe("a,b");
    });
  });

  describe("platform: reset target by mode", () => {
    it("uncontrolled: the reset returns to the latest defaultValue", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [def, setDef] = useState(["a"]);
        return (
          <form data-testid="form">
            <CheckboxGroup.Root aria-label="T" defaultValue={def} valueChangeAction={action}>
              <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
              <CheckboxGroup.Item value="a" aria-label="a" />
              <CheckboxGroup.Item value="b" aria-label="b" />
              <CheckboxGroup.Item value="c" aria-label="c" />
            </CheckboxGroup.Root>
            <button type="button" onClick={() => startTransition(() => setDef(["b", "c"]))}>
              new default
            </button>
          </form>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(screen.getByRole("button", { name: "new default" }));
      expect(box("a").defaultChecked).toBe(false);
      expect(box("b").defaultChecked).toBe(true);
      expect(box("c").defaultChecked).toBe(true);
      expect(parentBox().defaultChecked).toBe(false);
      expect(checkedValues()).toEqual(["a", "b"]);
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(calls(action)).toEqual([
        [["a", "b"], "activate", ["b"], []],
        [["b", "c"], "platform", ["c"], ["a"]],
      ]);
      expect(checkedValues()).toEqual(["b", "c"]);
    });

    it("uncontrolled: a value with no Item returns to defaultValue too", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <form data-testid="form">
          <CheckboxGroup.Root aria-label="T" defaultValue={["kept"]} valueChangeAction={action}>
            <CheckboxGroup.Parent values={["a", "ghost"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
          </CheckboxGroup.Root>
        </form>,
      );
      const user = setupUser();
      await user.click(parentBox());
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(calls(action)).toEqual([
        [["a", "kept", "ghost"], "activate", ["a", "ghost"], []],
        [["kept"], "platform", [], ["a", "ghost"]],
      ]);
      expect(checkedValues()).toEqual([]);
      expect(parentShows()).toBe("unchecked");
    });

    it("controlled: a Parent whose React reset target is stale shows its derivation after a reset", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [values, setValues] = useState(["a"]);
        return (
          <form data-testid="form">
            <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={action}>
              <CheckboxGroup.Parent values={values} aria-label="all" />
              <CheckboxGroup.Item value="a" aria-label="a" />
              <CheckboxGroup.Item value="b" aria-label="b" />
            </CheckboxGroup.Root>
            <button type="button" onClick={() => setValues(["b"])}>
              switch
            </button>
          </form>
        );
      }
      render(<Parent />);
      // React set the Parent's defaultChecked at mount, from its derivation over ["a"].
      expect(parentBox().defaultChecked).toBe(true);
      const user = setupUser();
      await user.click(screen.getByRole("button", { name: "switch" }));
      expect(parentShows()).toBe("unchecked");
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      // The Items reset to the value the group already has: no dispatch, no re-render.
      expect(action).not.toHaveBeenCalled();
      expect(parentShows()).toBe("unchecked");
    });

    it("controlled: the reset returns to the mount-time values and the parent is notified", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [value, setValue] = useState(["a"]);
        return (
          <form data-testid="form">
            <CheckboxGroup.Root
              aria-label="T"
              value={value}
              valueChangeAction={(next, details) => {
                action(next, details);
                setValue(next);
              }}
            >
              <CheckboxGroup.Item value="a" aria-label="a" />
              <CheckboxGroup.Item value="b" aria-label="b" />
            </CheckboxGroup.Root>
          </form>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(box("b"));
      await user.click(box("a"));
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
        [["a", "b"], "activate", "click"],
        [["b"], "activate", "click"],
        [["a"], "platform", "reset"],
      ]);
      expect(checkedValues()).toEqual(["a"]);
    });
  });

  describe("platform: React's automatic reset after a form action", () => {
    it("returns to the default with one dispatch, also without a valueChangeAction", async () => {
      for (const withAction of [true, false]) {
        const d = deferred();
        const action = vi.fn<ActionFn>();
        const { unmount } = render(
          <form
            action={async () => {
              await d.promise;
            }}
          >
            <CheckboxGroup.Root
              aria-label="T"
              name="t"
              defaultValue={["a"]}
              {...(withAction && { valueChangeAction: action })}
            >
              <CheckboxGroup.Item value="a" aria-label="a" />
              <CheckboxGroup.Item value="b" aria-label="b" />
            </CheckboxGroup.Root>
            <button type="submit">Save</button>
          </form>,
        );
        const user = setupUser();
        await user.click(box("b"));
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        if (withAction) {
          expect(calls(action)).toEqual([
            [["a", "b"], "activate", ["b"], []],
            [["a"], "platform", [], ["b"]],
          ]);
        }
        expect(checkedValues()).toEqual(["a"]);
        expect(dataChecked()).toEqual(["a"]);
        // Still in sync: the next click checks again.
        await user.click(box("b"));
        expect(checkedValues()).toEqual(["a", "b"]);
        unmount();
      }
    });
  });

  describe("preventDefault in the action", () => {
    it("warns once per element (Item and Parent) and the action still runs", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>((_next, details) => {
        details.event?.preventDefault();
      });
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={action}>
          <CheckboxGroup.Parent values={["a"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      const warnings = () =>
        consoleError.mock.calls
          .map(([m]) => String(m))
          .filter((m) => m.includes("preventDefault()"));
      await user.click(box("a"));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toMatch(/^CheckboxGroup\.Item: /);
      await user.click(box("a"));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      expect(warnings()).toHaveLength(1);
      await user.click(parentBox());
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(3);
      expect(warnings()).toHaveLength(2);
      expect(warnings()[1]).toMatch(/^CheckboxGroup\.Parent: /);
    });
  });

  describe("details", () => {
    it("exposes `event` as a virtual, non-own property", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={action}>
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(box("a"));
      const details = action.mock.calls[0]![1];
      expect(details.event).toBeInstanceOf(window.Event);
      expect("event" in details).toBe(true);
      expect(Object.keys(details)).not.toContain("event");
      expect(JSON.stringify(details)).toBe('{"reason":"activate","added":["a"],"removed":[]}');
    });

    it("can be passed straight to a Server-Function-shaped action", async () => {
      const serverFn = vi.fn(async (_next: string[], _details: Details) => {});
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={serverFn}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(parentBox());
      const [next, details] = serverFn.mock.calls[0]!;
      expect(JSON.parse(JSON.stringify([next, details]))).toEqual([
        ["a", "b"],
        { reason: "activate", added: ["a", "b"], removed: [] },
      ]);
    });
  });

  describe("function props", () => {
    it("className, style and children receive the documented state", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: CheckboxGroupRootState) => `g${s.pending ? " busy" : ""}`);
      const labelClass = vi.fn((s: CheckboxGroupRootState) => `l-${s.value.join("-")}`);
      const itemClass = vi.fn(
        (s: CheckboxGroupItemState) =>
          `r${s.checked ? " on" : ""}${s.pending ? " busy" : ""}${s.disabled ? " off" : ""}`,
      );
      const parentClass = vi.fn(
        (s: CheckboxGroupParentState) =>
          `p${s.checked ? " on" : ""}${s.indeterminate ? " mixed" : ""}${s.pending ? " busy" : ""}`,
      );
      render(
        <CheckboxGroup.Root
          aria-label="T"
          defaultValue={["a"]}
          valueChangeAction={() => d.promise}
          className={rootClass}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
        >
          {(rootState) => (
            <>
              <CheckboxGroup.Label className={labelClass} style={() => ({ color: "red" })}>
                {(s) => `Fruit ${s.value.join("+")}${s.pending ? " (saving)" : ""}`}
              </CheckboxGroup.Label>
              <span data-testid="root-children">{rootState.value.join("+")}</span>
              <CheckboxGroup.Parent
                values={["a", "b"]}
                aria-label="all"
                className={parentClass}
                style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
              />
              <CheckboxGroup.Item value="a" aria-label="a" className={itemClass} />
              <CheckboxGroup.Item
                value="b"
                aria-label="b"
                className={itemClass}
                style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
              />
              <CheckboxGroup.Item value="c" aria-label="c" className={itemClass} disabled />
            </>
          )}
        </CheckboxGroup.Root>,
      );
      expect(rootClass).toHaveBeenLastCalledWith({ value: ["a"], pending: false, disabled: false });
      expect(screen.getByText("Fruit a")).toHaveClass("l-a");
      expect(screen.getByText("Fruit a")).toHaveStyle({ color: "rgb(255, 0, 0)" });
      expect(box("a")).toHaveClass("r", "on");
      expect(box("c")).toHaveClass("r", "off");
      expect(parentBox()).toHaveClass("p", "mixed");
      expect(parentClass).toHaveBeenLastCalledWith({
        values: ["a", "b"],
        checked: false,
        indeterminate: true,
        pending: false,
        disabled: false,
      });

      const user = setupUser();
      await user.click(box("b"));
      expect(rootClass).toHaveBeenLastCalledWith({
        value: ["a", "b"],
        pending: true,
        disabled: false,
      });
      expect(group()).toHaveClass("g", "busy");
      expect(group()).toHaveStyle({ opacity: "0.5" });
      expect(screen.getByTestId("root-children")).toHaveTextContent("a+b");
      expect(screen.getByText("Fruit a+b (saving)")).toHaveClass("l-a-b");
      expect(box("b")).toHaveClass("r", "on", "busy");
      expect(box("b")).toHaveStyle({ opacity: "0.5" });
      expect(box("a")).not.toHaveClass("busy");
      expect(parentBox()).toHaveClass("p", "on", "busy");
      expect(parentBox()).toHaveStyle({ opacity: "0.5" });

      await act(async () => {
        d.resolve();
      });
      expect(box("b")).not.toHaveClass("busy");
      expect(parentBox()).not.toHaveClass("busy");
      expect(screen.getByText("Fruit a+b")).toBeInTheDocument();
    });

    it("Item and Parent state.disabled include Root disabled", () => {
      render(
        <CheckboxGroup.Root aria-label="T" disabled>
          <CheckboxGroup.Parent
            values={["a"]}
            aria-label="all"
            className={(s) => (s.disabled ? "off" : "on")}
          />
          <CheckboxGroup.Item
            value="a"
            aria-label="a"
            className={(s) => (s.disabled ? "off" : "on")}
          />
        </CheckboxGroup.Root>,
      );
      expect(box("a")).toHaveClass("off");
      expect(parentBox()).toHaveClass("off");
    });
  });

  describe("render element", () => {
    it("Item render element keeps type, name, checked and the handler; merges className; forwards ref", async () => {
      const action = vi.fn<ActionFn>();
      const itemRef = { current: null as HTMLInputElement | null };
      const elementRef = { current: null as HTMLInputElement | null };
      render(
        <CheckboxGroup.Root aria-label="T" name="t" valueChangeAction={action}>
          <CheckboxGroup.Item
            value="b"
            aria-label="b"
            className="r"
            ref={itemRef}
            render={<input id="x" className="y" ref={elementRef} data-testid="bank" />}
          />
        </CheckboxGroup.Root>,
      );
      const el = screen.getByTestId("bank") as HTMLInputElement;
      expect(el).toBe(box("b"));
      expect(el).toHaveAttribute("id", "x");
      expect(el).toHaveClass("r", "y");
      expect(el).toHaveAttribute("type", "checkbox");
      expect(el).toHaveAttribute("name", "t");
      expect(itemRef.current).toBe(el);
      expect(elementRef.current).toBe(el);
      const user = setupUser();
      await user.click(el);
      expect(action.mock.calls[0]?.[0]).toEqual(["b"]);
      expect(el.checked).toBe(true);
      expect(el).toHaveAttribute("data-checked", "");
    });

    it("Parent render element strips name, required, indeterminate and aria-checked", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      const extra = { indeterminate: true } as object;
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={action}>
          <CheckboxGroup.Parent
            values={["a"]}
            aria-label="all"
            render={
              <input
                name="p"
                required
                aria-checked="mixed"
                data-testid="parent"
                className="y"
                {...extra}
              />
            }
          />
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      const el = screen.getByTestId("parent") as HTMLInputElement;
      expect(el).toHaveClass("y");
      expect(el).not.toHaveAttribute("name");
      expect(el).not.toBeRequired();
      expect(el).not.toHaveAttribute("aria-checked");
      expect(el).not.toHaveAttribute("indeterminate");
      expect(el.indeterminate).toBe(false);
      const user = setupUser();
      await user.click(el);
      expect(action.mock.calls[0]?.[0]).toEqual(["a"]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("Root render element stays a fieldset with the library's attributes; ref forwarded", () => {
      const rootRef = { current: null as HTMLFieldSetElement | null };
      render(
        <CheckboxGroup.Root
          aria-label="T"
          ref={rootRef}
          disabled
          render={<fieldset className="custom" data-testid="fs" />}
        >
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>,
      );
      const fs = screen.getByTestId("fs");
      expect(fs).toBe(group());
      expect(fs).toHaveClass("custom");
      expect(fs).toHaveAttribute("data-disabled", "");
      expect(rootRef.current).toBe(fs);
    });

    it("function form on Item receives (props, state)", async () => {
      const d = deferred();
      const renderFn = vi.fn(
        (props: ComponentPropsWithRef<"input">, state: CheckboxGroupItemState) => (
          <>
            <input {...props} />
            <span data-testid="dot">{state.pending ? "saving" : state.checked ? "on" : "off"}</span>
          </>
        ),
      );
      render(
        <CheckboxGroup.Root aria-label="T" valueChangeAction={() => d.promise}>
          <CheckboxGroup.Item value="a" aria-label="a" render={renderFn} />
        </CheckboxGroup.Root>,
      );
      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "checkbox", checked: false, value: "a" }),
        { value: "a", checked: false, pending: false, disabled: false },
      );
      const user = setupUser();
      await user.click(box("a"));
      expect(screen.getByTestId("dot")).toHaveTextContent("saving");
      await act(async () => {
        d.resolve();
      });
      expect(screen.getByTestId("dot")).toHaveTextContent("on");
    });

    it("warns in development when the mounted element is not a fieldset / checkbox input", () => {
      const consoleError = silenceErrors();
      const ui = (
        <CheckboxGroup.Root aria-label="T" render={<div />}>
          <CheckboxGroup.Parent
            values={["a"]}
            aria-label="all"
            render={(props) => <button {...(props as object)} />}
          />
          <CheckboxGroup.Item
            value="a"
            aria-label="a"
            render={(props) => <button {...(props as object)} />}
          />
        </CheckboxGroup.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      const messages = consoleError.mock.calls.map(([m]) => String(m));
      expect(
        messages.filter((m) => m.startsWith("CheckboxGroup.Root: expected to render a <fieldset>")),
      ).toHaveLength(1);
      expect(
        messages.filter((m) =>
          m.startsWith('CheckboxGroup.Item: expected to render an `<input type="checkbox">`'),
        ),
      ).toHaveLength(1);
      expect(
        messages.filter((m) =>
          m.startsWith('CheckboxGroup.Parent: expected to render an `<input type="checkbox">`'),
        ),
      ).toHaveLength(1);
    });
  });

  describe("post-await rule", () => {
    it("checked and data-pending converge with a functional startTransition after the await", async () => {
      const d = deferred();
      const snapshots: { checked: string[]; pending: boolean }[] = [];
      function Recorder() {
        useLayoutEffect(() => {
          const boxes = [...document.querySelectorAll<HTMLInputElement>("input[name]")];
          snapshots.push({
            checked: boxes.filter((r) => r.checked).map((r) => r.value),
            pending: document.querySelector("fieldset")?.hasAttribute("data-pending") ?? false,
          });
        });
        return null;
      }
      function Parent() {
        const [value, setValue] = useState(["a"]);
        return (
          <CheckboxGroup.Root
            aria-label="T"
            value={value}
            valueChangeAction={async (_next, details) => {
              await d.promise;
              startTransition(() => setValue((prev) => applyDetails(prev, details)));
            }}
          >
            {() => (
              <>
                <CheckboxGroup.Item value="a" aria-label="a" />
                <CheckboxGroup.Item value="b" aria-label="b" />
                <Recorder />
              </>
            )}
          </CheckboxGroup.Root>
        );
      }
      render(<Parent />);
      // The mount commits (the Items' registration re-renders the group once at layout time).
      const mountSnapshots = snapshots.length;
      const user = setupUser();
      await user.click(box("b"));
      const inFlight = snapshots.at(-1);
      await act(async () => {
        d.resolve();
      });
      expect(inFlight).toEqual({ checked: ["a", "b"], pending: true });
      expect(snapshots.at(-1)).toEqual({ checked: ["a", "b"], pending: false });
      expect(snapshots.slice(mountSnapshots).every((s) => s.checked.join() === "a,b")).toBe(true);
    });
  });

  describe("transition prop", () => {
    it("Item and Parent render the same markup with and without `transition`", () => {
      const ui = (transition?: string) =>
        render(
          <CheckboxGroup.Root aria-label="x" defaultValue={["a"]}>
            <CheckboxGroup.Label>x</CheckboxGroup.Label>
            <CheckboxGroup.Parent
              values={["a", "b"]}
              aria-label="all"
              {...(transition && { transition })}
            />
            <CheckboxGroup.Item value="a" aria-label="a" {...(transition && { transition })} />
          </CheckboxGroup.Root>,
        ).container.innerHTML.replace(/_r_[0-9a-z]+_/g, "ID");
      const plain = ui();
      expect(ui("fsui-fade")).toBe(plain);
    });
  });

  describe("dev warnings", () => {
    it("warns once when value and defaultValue are both set", () => {
      const consoleError = silenceErrors();
      const ui = (
        <CheckboxGroup.Root aria-label="x" value={["a"]} defaultValue={["a"]}>
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(
        /^CheckboxGroup\.Root: both `value` and `defaultValue`/,
      );
    });

    it("warns once when switching from uncontrolled to controlled", () => {
      const consoleError = silenceErrors();
      const ui = (value?: string[]) => (
        <CheckboxGroup.Root aria-label="x" {...(value !== undefined && { value })}>
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>
      );
      const { rerender } = render(ui());
      rerender(ui(["a"]));
      rerender(ui(["b"]));
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/uncontrolled to controlled/);
    });

    it("warns once about duplicate Item values", () => {
      const consoleError = silenceErrors();
      const ui = (
        <CheckboxGroup.Root aria-label="x">
          <CheckboxGroup.Item value="a" aria-label="a1" />
          <CheckboxGroup.Item value="a" aria-label="a2" />
        </CheckboxGroup.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/^CheckboxGroup\.Item: two Items share/);
    });

    it("does not warn in normal use, without value or defaultValue, or for values with no Item", async () => {
      const consoleError = silenceErrors();
      render(
        <CheckboxGroup.Root aria-label="x">
          <CheckboxGroup.Parent values={["a", "b", "ghost"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      const user = setupUser();
      await user.click(box("a"));
      await user.click(parentBox());
      await user.click(box("b"));
      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});
// design/components/field-form.md 13.1, "Controls inside a Field".
describe("CheckboxGroup inside a Field.Root", () => {
  it("is named by Field.Label (aria-labelledby), takes name / required (at least one) and the ARIA wiring; its own data-pending stays its own", async () => {
    const own = deferred();
    const submission = deferred();
    render(
      <Form.Root action={() => submission.promise}>
        <Field.Root name="toppings" required data-testid="root">
          <Field.Label data-testid="label">Toppings</Field.Label>
          <CheckboxGroup.Root valueChangeAction={() => own.promise} data-testid="group">
            <label>
              <CheckboxGroup.Item value="a" /> A
            </label>
            <label>
              <CheckboxGroup.Item value="b" /> B
            </label>
          </CheckboxGroup.Root>
          <Field.Description data-testid="desc">Pick one.</Field.Description>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const group = screen.getByTestId("group");
    expect(screen.getByTestId("label")).not.toHaveAttribute("for");
    expect(group).toHaveAttribute("aria-labelledby", screen.getByTestId("label").id);
    expect(group).toHaveAccessibleName("Toppings");
    expect(group).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
    // ARIA 1.2: `aria-invalid` is not supported on role `group`; the Items carry it (review L1).
    expect(group).not.toHaveAttribute("aria-invalid");
    const boxes = screen.getAllByRole("checkbox");
    for (const box of boxes) {
      expect(box).toHaveAttribute("name", "toppings");
      expect(box).toBeRequired();
      expect(box).toHaveAttribute("aria-invalid", "false");
    }

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(group).toHaveAttribute("data-invalid");
    for (const box of boxes) expect(box).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(boxes[0]);

    await user.click(boxes[1]!);
    expectPending(group);
    expectNotPending(screen.getByTestId("root"));
    await act(async () => own.resolve());
    expect(screen.queryByTestId("error")).toBeNull();
    for (const box of boxes) expect(box).not.toBeRequired();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expectPending(screen.getByTestId("root"));
    expectNotPending(group);
    await act(async () => submission.resolve());
  });

  // Review H1 (the same gap in CheckboxGroup) and L2.
  it("focuses the first item, not the Parent; a Parent click re-reads validate after the commit", async () => {
    const action = vi.fn();
    render(
      <Form.Root action={action}>
        <Field.Root
          name="toppings"
          validate={(_value, formData) =>
            formData.getAll("toppings").length < 2 ? "Pick two." : null
          }
        >
          <Field.Label>Toppings</Field.Label>
          <CheckboxGroup.Root data-testid="group">
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="All" />
            <CheckboxGroup.Item value="a" aria-label="A" />
            <CheckboxGroup.Item value="b" aria-label="B" />
          </CheckboxGroup.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent("Pick two.");
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "A" }));

    // The Parent checks both Items; their `checked` is written by React after the Parent's own
    // `change`, and the Field re-reads it in that commit (no blur needed).
    await user.click(screen.getByRole("checkbox", { name: "All" }));
    expect(screen.getByRole("checkbox", { name: "B" })).toBeChecked();
    expect(screen.queryByTestId("error")).toBeNull();
    expect(
      (screen.getByRole("checkbox", { name: "A" }) as HTMLInputElement).validationMessage,
    ).toBe("");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("required: checking a later Item clears the error in the same commit", async () => {
    render(
      <Form.Root action={() => {}}>
        <Field.Root name="toppings" required>
          <Field.Label>Toppings</Field.Label>
          <CheckboxGroup.Root>
            <CheckboxGroup.Item value="a" aria-label="A" />
            <CheckboxGroup.Item value="b" aria-label="B" />
          </CheckboxGroup.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(screen.getByTestId("error")).toBeInTheDocument();
    // "B" is checked by the click; "A" (where validity is read) loses `required` only when React
    // re-renders the group.
    await user.click(screen.getByRole("checkbox", { name: "B" }));
    expect(screen.queryByTestId("error")).toBeNull();
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toHaveAttribute("aria-invalid", "false");
    }
  });
});
