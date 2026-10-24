// RadioGroup, jsdom rows of design/components/radio-group.md section 12. Rows that need a real
// engine (RTL arrow mirroring, native arrow wrap and disabled skipping as the engine does them,
// Space activation, a real label click, a real click before hydration, React's automatic reset
// after a real form action, `:checked` / `:indeterminate` / `:user-invalid`) are in
// radio-group.browser.test.tsx. The directive row is in src/__tests__/directives.test.ts.
//
// About "rejection rolls the DOM back": a rejected action reaches the Error Boundary above the
// Root, which replaces the whole group, so the radios that would roll back are unmounted. The DOM
// rollback is therefore asserted where the group stays mounted: a controlled parent that does not
// adopt the value (veto, or an error caught inside the action), which is the same optimistic
// revert and the same settle commit.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  sequencedDeferreds,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushMicrotasks,
  hydrateFromServer,
  silenceErrors,
  fulfilledPromise,
  hydrationGate,
  Gate,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { radioGroupDriver } from "../__tests__/drivers/radio-group.js";
import { describeValueAction } from "../__tests__/value-action-suite.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { RadioGroup } from "./index.js";
import type {
  RadioGroupItemState,
  RadioGroupRootProps,
  RadioGroupRootState,
  RadioGroupValueChangeDetails,
} from "./index.js";

type Details = RadioGroupValueChangeDetails;
type ActionFn = (next: string | null, details: Details) => unknown;

interface HarnessProps extends Omit<
  RadioGroupRootProps,
  "value" | "defaultValue" | "valueChangeAction" | "children"
> {
  mode: ControlMode;
  initial?: string | null;
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
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows the "update on success"
 * pattern; the uncontrolled variant mirrors the committed value in a sibling so both modes expose
 * it the same way.
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
  items = ["a", "b", "c"],
  disabledItems = [],
  ...rest
}: HarnessProps) {
  const [committed, setCommitted] = useState<string | null>(initial);
  const [error, setError] = useState<unknown>(null);

  const valueChangeAction = async (next: string | null, details: Details) => {
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
  let group: ReactNode = (
    <RadioGroup.Root
      aria-label="Fruit"
      {...modeProps}
      valueChangeAction={valueChangeAction}
      {...rest}
    >
      {items.map((v) => (
        <RadioGroup.Item key={v} value={v} aria-label={v} disabled={disabledItems.includes(v)} />
      ))}
    </RadioGroup.Root>
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

  const content = (
    <>
      {group}
      <output data-testid="committed">{String(committed)}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
      {suspender && <suspender.Suspender value={String(committed)} />}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const group = () => screen.getByRole("radiogroup");
const radio = (v: string) => screen.getByRole("radio", { name: v }) as HTMLInputElement;
const committed = () => screen.getByTestId("committed");
/** Values of the radios whose DOM `checked` is true. */
const checkedValues = () =>
  (screen.getAllByRole("radio") as HTMLInputElement[]).filter((r) => r.checked).map((r) => r.value);
const dataChecked = () =>
  screen
    .getAllByRole("radio")
    .filter((r) => r.hasAttribute("data-checked"))
    .map((r) => (r as HTMLInputElement).value);
const dataPending = () =>
  screen
    .getAllByRole("radio")
    .filter((r) => r.hasAttribute("data-pending"))
    .map((r) => (r as HTMLInputElement).value);
const form = () => screen.getByTestId("form") as HTMLFormElement;

// The action-prop rows shared by every value component (sync and async actions, rejection,
// overlap, superseded rejection, suspending content, the post-await rule, the controlled veto,
// `transition`, details, the value/defaultValue warnings) come from
// __tests__/value-action-suite.tsx with the driver __tests__/drivers/radio-group.tsx; the
// transition types are in radio-group-transition-types.test.tsx.
describeValueAction(radioGroupDriver);

describe("RadioGroup", () => {
  describe("roles and ARIA", () => {
    it("renders fieldset[role=radiogroup] named by the Label legend", () => {
      render(
        <RadioGroup.Root defaultValue="free">
          <RadioGroup.Label>Plan</RadioGroup.Label>
          <label>
            <RadioGroup.Item value="free" /> Free
          </label>
          <label>
            <RadioGroup.Item value="pro" /> Pro
          </label>
        </RadioGroup.Root>,
      );
      const root = screen.getByRole("radiogroup", { name: "Plan" });
      expect(root.tagName).toBe("FIELDSET");
      expect(root).toHaveAccessibleName("Plan");
      expect(root.firstElementChild?.tagName).toBe("LEGEND");
      const free = screen.getByRole("radio", { name: "Free" }) as HTMLInputElement;
      expect(free.tagName).toBe("INPUT");
      expect(free).toHaveAttribute("type", "radio");
      expect(free.checked).toBe(true);
      expect(screen.getByRole("radio", { name: "Pro" })).not.toBeChecked();
    });

    it("falls back to aria-label on Root without a Label", () => {
      render(
        <RadioGroup.Root aria-label="Size">
          <RadioGroup.Item value="s" aria-label="s" />
        </RadioGroup.Root>,
      );
      expect(group()).toHaveAccessibleName("Size");
    });

    it("gives every Item the same useId name, or the name prop", () => {
      const first = render(
        <RadioGroup.Root aria-label="A">
          <RadioGroup.Item value="x" aria-label="x" />
          <RadioGroup.Item value="y" aria-label="y" />
        </RadioGroup.Root>,
      );
      const name = radio("x").name;
      expect(name).not.toBe("");
      expect(radio("y").name).toBe(name);
      first.unmount();

      render(
        <>
          <RadioGroup.Root aria-label="A">
            <RadioGroup.Item value="x" aria-label="x" />
          </RadioGroup.Root>
          <RadioGroup.Root aria-label="B" name="plan">
            <RadioGroup.Item value="y" aria-label="y" />
            <RadioGroup.Item value="z" aria-label="z" />
          </RadioGroup.Root>
        </>,
      );
      expect(radio("y")).toHaveAttribute("name", "plan");
      expect(radio("z")).toHaveAttribute("name", "plan");
      expect(radio("x").name).not.toBe("plan");
    });

    it("gives two unnamed groups distinct names, so each keeps its own checked radio", () => {
      render(
        <>
          <RadioGroup.Root aria-label="A" defaultValue="x">
            <RadioGroup.Item value="x" aria-label="x" />
          </RadioGroup.Root>
          <RadioGroup.Root aria-label="B" defaultValue="y">
            <RadioGroup.Item value="y" aria-label="y" />
          </RadioGroup.Root>
        </>,
      );
      expect(radio("x").name).not.toBe("");
      expect(radio("y").name).not.toBe("");
      expect(radio("x").name).not.toBe(radio("y").name);
      expect(radio("x").checked).toBe(true);
      expect(radio("y").checked).toBe(true);
    });

    it("renders value, required and form on every Item and form on the fieldset", () => {
      render(
        <>
          <form id="f" />
          <RadioGroup.Root aria-label="Plan" required form="f">
            <RadioGroup.Item value="free" aria-label="free" />
            <RadioGroup.Item value="pro" aria-label="pro" />
          </RadioGroup.Root>
        </>,
      );
      expect(group()).toHaveAttribute("form", "f");
      expect((group() as HTMLFieldSetElement).form?.id).toBe("f");
      for (const v of ["free", "pro"]) {
        expect(radio(v)).toHaveAttribute("value", v);
        expect(radio(v)).toBeRequired();
        expect(radio(v).form?.id).toBe("f");
      }
    });

    it("Root required renders aria-required on the fieldset, owned against a render element", () => {
      const first = render(
        <RadioGroup.Root aria-label="Plan" required>
          <RadioGroup.Item value="free" aria-label="free" />
        </RadioGroup.Root>,
      );
      expect(group()).toHaveAttribute("aria-required", "true");
      expect(group()).toBeRequired();
      first.unmount();

      const second = render(
        <RadioGroup.Root aria-label="Plan">
          <RadioGroup.Item value="free" aria-label="free" />
        </RadioGroup.Root>,
      );
      expect(group()).not.toHaveAttribute("aria-required");
      second.unmount();

      const third = render(
        <RadioGroup.Root aria-label="Plan" required render={<fieldset aria-required="false" />}>
          <RadioGroup.Item value="free" aria-label="free" />
        </RadioGroup.Root>,
      );
      expect(group()).toHaveAttribute("aria-required", "true");
      third.unmount();

      render(
        <RadioGroup.Root aria-label="Plan" render={<fieldset aria-required="true" />}>
          <RadioGroup.Item value="free" aria-label="free" />
        </RadioGroup.Root>,
      );
      expect(group()).not.toHaveAttribute("aria-required");
    });

    it("Root disabled renders <fieldset disabled>; Item disabled renders on the input", () => {
      const rootDisabled = render(
        <RadioGroup.Root aria-label="Plan" disabled>
          <RadioGroup.Item value="a" aria-label="a" />
        </RadioGroup.Root>,
      );
      expect(group()).toHaveAttribute("disabled");
      expect(group()).toHaveAttribute("data-disabled", "");
      expect(radio("a")).not.toHaveAttribute("disabled");
      expect(radio("a")).toBeDisabled();
      expect(radio("a")).toHaveAttribute("data-disabled", "");
      rootDisabled.unmount();

      render(
        <RadioGroup.Root aria-label="Plan">
          <RadioGroup.Item value="a" aria-label="a" disabled />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      expect(group()).not.toHaveAttribute("disabled");
      expect(group()).not.toHaveAttribute("data-disabled");
      expect(radio("a")).toHaveAttribute("disabled");
      expect(radio("a")).toHaveAttribute("data-disabled", "");
      expect(radio("b")).not.toHaveAttribute("data-disabled");
    });

    it("emits data attributes by presence; no aria-checked, tabindex or data-indeterminate", () => {
      render(
        <RadioGroup.Root aria-label="Plan" defaultValue="a">
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      expect(radio("a")).toHaveAttribute("data-checked", "");
      expect(radio("b")).not.toHaveAttribute("data-checked");
      for (const v of ["a", "b"]) {
        expect(radio(v)).not.toHaveAttribute("aria-checked");
        expect(radio(v)).not.toHaveAttribute("tabindex");
        expect(radio(v)).not.toHaveAttribute("data-pending");
        expect(radio(v)).not.toHaveAttribute("data-indeterminate");
      }
      expect(group()).not.toHaveAttribute("data-pending");
      expect(group()).toHaveAttribute("role", "radiogroup");
    });

    it("an empty group (default null) checks nothing and does not warn", () => {
      const consoleError = silenceErrors();
      render(
        <RadioGroup.Root aria-label="Plan">
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      expect(checkedValues()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("owned keys cannot be overridden through props or a render element", () => {
      const forcedRoot = { role: "group" } as object;
      const forcedItem = { type: "checkbox", name: "x", checked: true, form: "zzz" } as object;
      render(
        <RadioGroup.Root {...forcedRoot} aria-label="Plan" name="plan" defaultValue="b">
          <RadioGroup.Item {...forcedItem} value="a" aria-label="a" />
          <RadioGroup.Item
            value="b"
            aria-label="b"
            render={
              <input type="checkbox" name="y" value="zzz" checked={false} readOnly disabled />
            }
          />
          <RadioGroup.Item value="c" aria-label="c" disabled render={<input disabled={false} />} />
        </RadioGroup.Root>,
      );
      // `disabled` is owned: a render element can neither disable nor re-enable the radio.
      expect(radio("b")).not.toBeDisabled();
      expect(radio("b")).not.toHaveAttribute("data-disabled");
      expect(radio("c")).toBeDisabled();
      expect(radio("c")).toHaveAttribute("data-disabled", "");
      expect(group()).toHaveAttribute("role", "radiogroup");
      for (const v of ["a", "b"]) {
        expect(radio(v)).toHaveAttribute("type", "radio");
        expect(radio(v)).toHaveAttribute("name", "plan");
        expect(radio(v)).toHaveAttribute("value", v);
        expect(radio(v)).not.toHaveAttribute("form");
      }
      expect(checkedValues()).toEqual(["b"]);
    });

    it("Item and Label throw outside a Root", () => {
      silenceErrors();
      expect(() => render(<RadioGroup.Item value="a" />)).toThrow(
        "RadioGroup.Item must be rendered inside a RadioGroup.Root.",
      );
      expect(() => render(<RadioGroup.Label>x</RadioGroup.Label>)).toThrow(
        "RadioGroup.Label must be rendered inside a RadioGroup.Root.",
      );
    });
  });

  describe("keyboard", () => {
    it("Tab enters on the checked radio; Space checks the focused one", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <button type="button">before</button>
          <Harness mode="uncontrolled" initial="b" action={action} />
        </>,
      );
      const user = setupUser();
      await user.tab();
      await user.tab();
      expect(radio("b")).toHaveFocus();

      // Space on the checked radio: no change, no dispatch.
      await user.keyboard("[Space]");
      expect(action).not.toHaveBeenCalled();

      radio("c").focus();
      await user.keyboard("[Space]");
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe("c");
      expect(details.event?.type).toBe("click");
      expect(details.reason).toBe("activate");
      expect(checkedValues()).toEqual(["c"]);
    });

    it("arrow keys check the next / previous radio, wrap, and dispatch once per press", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" initial="a" action={action} />);
      const user = setupUser();
      radio("a").focus();

      await user.keyboard("[ArrowDown]");
      expect(radio("b")).toHaveFocus();
      await user.keyboard("[ArrowRight]");
      expect(radio("c")).toHaveFocus();
      // Wrap from last to first.
      await user.keyboard("[ArrowDown]");
      expect(radio("a")).toHaveFocus();
      // Wrap from first to last.
      await user.keyboard("[ArrowUp]");
      expect(radio("c")).toHaveFocus();
      await user.keyboard("[ArrowLeft]");
      expect(radio("b")).toHaveFocus();

      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "c", "a", "c", "b"]);
      expect(action.mock.calls.every(([, d]) => d.event?.type === "click")).toBe(true);
      expect(action.mock.calls.every(([, d]) => d.reason === "activate")).toBe(true);
      expect(checkedValues()).toEqual(["b"]);
      expect(committed()).toHaveTextContent("b");
    });

    it("arrow keys skip a disabled radio", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" initial="a" action={action} disabledItems={["b"]} />);
      const user = setupUser();
      radio("a").focus();
      await user.keyboard("[ArrowDown]");
      expect(radio("c")).toHaveFocus();
      expect(action.mock.calls.map(([n]) => n)).toEqual(["c"]);
    });

    it("has no key handling of its own: Home and End do nothing", () => {
      // user-event cannot press Home/End on a radio in jsdom (no selection API); the engine's own
      // behaviour is asserted in radio-group.browser.test.tsx. Here: the library adds no handler.
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" initial="b" action={action} />);
      radio("b").focus();
      fireEvent.keyDown(radio("b"), { key: "Home" });
      fireEvent.keyDown(radio("b"), { key: "End" });
      expect(radio("b")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["b"]);
    });
  });

  renderBoth("sync action", (mode) => {
    it("clicking the checked radio, a disabled radio or a radio under Root disabled never dispatches", async () => {
      const action = vi.fn<ActionFn>();
      const { unmount } = render(<Harness mode={mode} action={action} disabledItems={["c"]} />);
      const user = setupUser();
      await user.click(radio("a"));
      await user.click(radio("c"));
      await act(async () => {
        radio("c").click();
      });
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      unmount();

      render(<Harness mode={mode} action={action} disabled />);
      await user.click(radio("b"));
      await act(async () => {
        radio("b").click();
      });
      await act(async () => {
        fireEvent.click(radio("b"));
      });
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      expect(committed()).toHaveTextContent("a");
    });

    it("a click already cancelled by a pass-through onClick never dispatches", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      function Cancelling() {
        const [value, setValue] = useState<string | null>("a");
        const groupAction = async (next: string | null, details: Details) => {
          await action(next, details);
          startTransition(() => setValue(next));
        };
        return (
          <RadioGroup.Root
            aria-label="Fruit"
            {...(mode === "controlled" ? { value } : { defaultValue: "a" })}
            valueChangeAction={groupAction}
          >
            <RadioGroup.Item value="a" aria-label="a" />
            <RadioGroup.Item value="b" aria-label="b" onClick={(e) => e.preventDefault()} />
          </RadioGroup.Root>
        );
      }
      render(<Cancelling />);
      const user = setupUser();
      await user.click(radio("b"));
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
      expectNotPending(group());
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("rollback of the DOM to the previous radio", () => {
    it("a controlled parent that does not adopt the value re-checks the old radio after settle", async () => {
      const d = deferred();
      render(
        <RadioGroup.Root aria-label="Fruit" value="a" valueChangeAction={() => d.promise}>
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      const user = setupUser();
      await user.click(radio("b"));
      expect(checkedValues()).toEqual(["b"]);
      expect(radio("b")).toHaveAttribute("data-pending", "");
      await act(async () => {
        d.resolve();
      });
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
      expectNotPending(group());
      expect(radio("b")).toHaveFocus();
    });
  });

  describe("overlapping actions", () => {
    it("rapid arrows: the latest wins, DOM stays on it while earlier ones resolve last", async () => {
      const deferreds = sequencedDeferreds(2);
      const action = vi.fn<ActionFn>(() => deferreds.next());
      render(<Harness mode="uncontrolled" initial="a" action={action} />);
      const user = setupUser();
      radio("a").focus();
      await user.keyboard("[ArrowDown]");
      await user.keyboard("[ArrowDown]");
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "c"]);
      expect(checkedValues()).toEqual(["c"]);
      expect(dataChecked()).toEqual(["c"]);
      expect(dataPending()).toEqual(["c"]);

      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(checkedValues()).toEqual(["c"]);
      expectPending(group());
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expect(checkedValues()).toEqual(["c"]);
      expect(dataChecked()).toEqual(["c"]);
      expectNotPending(group());
      // The harness's own mirror is not latest-wins; the DOM shows the converged optimistic value,
      // which is the library's committed value.
    });

    it("clicking back to the committed radio while another is pending (walkthrough 9.6)", async () => {
      const deferreds = sequencedDeferreds(2);
      const action = vi.fn<ActionFn>(() => deferreds.next());
      render(<Harness mode="uncontrolled" initial="a" action={action} />);
      const user = setupUser();
      await user.click(radio("b"));
      await user.click(radio("a"));
      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "a"]);
      expect(checkedValues()).toEqual(["a"]);
      expect(dataPending()).toEqual(["a"]);
      await act(async () => {
        deferreds[0]!.resolve();
      });
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(checkedValues()).toEqual(["a"]);
      expect(committed()).toHaveTextContent("a");
      expectNotPending(group());
    });
  });

  describe("platform: mount reconciliation", () => {
    const hydrate = (ui: ReactNode, mutate: (container: HTMLElement) => void) =>
      hydrateFromServer(ui, { mutate });
    const checkC = (c: HTMLElement) => {
      (c.querySelector('input[value="c"]') as HTMLInputElement).checked = true;
    };

    renderBoth("hydration", (mode) => {
      it("dispatches the hydrated DOM value once with reason platform and no event", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} initial="a" action={action} />, checkC);
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe("c");
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(JSON.stringify(details)).toBe('{"reason":"platform"}');
        expect(checkedValues()).toEqual(["c"]);
        expect(dataChecked()).toEqual(["c"]);
        expect(committed()).toHaveTextContent("c");
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("dispatches once under StrictMode", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <StrictMode>
            <Harness mode={mode} initial="a" action={action} />
          </StrictMode>,
          checkC,
        );
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe("c");
        expect(checkedValues()).toEqual(["c"]);
      });

      it("dispatches from an empty server render too, and nothing when the DOM matches", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} initial={null} action={action} />, checkC);
        expect(action.mock.calls.map(([n]) => n)).toEqual(["c"]);
        document.body.innerHTML = "";

        const quiet = vi.fn<ActionFn>();
        await hydrate(<Harness mode={mode} initial="b" action={quiet} />, () => {});
        expect(quiet).not.toHaveBeenCalled();
        expect(checkedValues()).toEqual(["b"]);
      });
    });

    it("a refused (or rejected-and-caught) dispatch rolls the DOM back to the server value", async () => {
      const action = vi.fn<ActionFn>();
      await hydrate(
        <RadioGroup.Root aria-label="Fruit" value="a" valueChangeAction={action}>
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
          <RadioGroup.Item value="c" aria-label="c" />
        </RadioGroup.Root>,
        checkC,
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
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
      expect(checkedValues()).toEqual(["b"]);
    });
  });

  describe("platform: items that mount after the Root (Suspense between Root and Items)", () => {
    function LateGroup({
      gate,
      mode,
      action,
      initial = "a",
    }: {
      gate: Promise<void>;
      mode: ControlMode;
      action: ActionFn;
      initial?: string;
    }) {
      const [value, setValue] = useState<string | null>(initial);
      return (
        <RadioGroup.Root
          aria-label="Fruit"
          {...(mode === "controlled" ? { value } : { defaultValue: initial })}
          valueChangeAction={async (next, details) => {
            await action(next, details);
            startTransition(() => setValue(next));
          }}
        >
          <RadioGroup.Item value="a" aria-label="a" />
          <Suspense fallback={null}>
            <Gate promise={gate}>
              <RadioGroup.Item value="b" aria-label="b" />
              <RadioGroup.Item value="c" aria-label="c" />
            </Gate>
          </Suspense>
        </RadioGroup.Root>
      );
    }

    renderBoth("late hydration", (mode) => {
      it("a pre-hydration click on a late item dispatches exactly once when it hydrates", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        // The Root hydrates; the boundary around b and c stays dehydrated until `gate` resolves.
        const g = hydrationGate();
        const { container } = await hydrateFromServer(
          <LateGroup gate={fulfilledPromise()} mode={mode} action={action} />,
          {
            client: <LateGroup gate={g.promise} mode={mode} action={action} />,
            inAct: true,
            flush: null,
          },
        );
        expect(action).not.toHaveBeenCalled();

        // The user checks "c" while its boundary is still dehydrated: React sees nothing.
        const c = container.querySelector<HTMLInputElement>('input[value="c"]')!;
        c.checked = true;
        await act(async () => {
          g.open();
        });
        await flushMicrotasks();

        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe("c");
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(radio("c")).toBe(c);
        expect(checkedValues()).toEqual(["c"]);
        expect(dataChecked()).toEqual(["c"]);
        // The only console output is the dev warning about partial hydration, once per group.
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toMatch(
          /RadioGroup\.Item: an Item hydrated after its RadioGroup\.Root.*Partial hydration/s,
        );
      });

      // Pins a React limitation (react-dom 19.3.1, design 5.1 "Unsupported: partial hydration").
      // If React stops throwing here, revisit the design note, the dev warning and this test.
      it("a click on a hydrated radio while siblings are dehydrated: react-dom throws; the state is consistent after hydration", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        const g = hydrationGate();
        const { container } = await hydrateFromServer(
          <LateGroup gate={fulfilledPromise()} mode={mode} action={action} initial="b" />,
          {
            client: <LateGroup gate={g.promise} mode={mode} action={action} initial="b" />,
            inAct: true,
            flush: null,
          },
        );

        // react-dom's restoreStateOfTarget finds the dehydrated same-name radios (no fiber) after
        // the event and throws; the error escapes the event listener as an uncaught error.
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
        expect(uncaught).toHaveLength(1);
        expect(String(uncaught[0])).toMatch(
          /Mixing React and non-React radio inputs with the same `name` is not supported/,
        );
        // The action still ran, once, with the user's radio.
        expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["a", "activate"]]);

        await act(async () => {
          g.open();
        });
        await flushMicrotasks();

        // After the boundary hydrates: no platform dispatch, and `data-checked` agrees with
        // `:checked` (hydration alone would keep the server's `data-checked` on "b").
        expect(action).toHaveBeenCalledTimes(1);
        expect(checkedValues()).toEqual(["a"]);
        expect(dataChecked()).toEqual(["a"]);
        expect(dataPending()).toEqual([]);
        expect(
          consoleError.mock.calls.filter(([m]) =>
            /Partial hydration of a radio group/.test(String(m)),
          ),
        ).toHaveLength(1);
      });
    });

    it("a group hydrated in one boundary does not warn about partial hydration (StrictMode)", async () => {
      // Any Suspense boundary between Root and Items hydrates in a later commit, even one that
      // never suspends (react-dom 19.3.1), so only a group without one is quiet.
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      const ui = (
        <StrictMode>
          <Suspense fallback={null}>
            <RadioGroup.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
              <RadioGroup.Item value="a" aria-label="a" />
              <RadioGroup.Item value="b" aria-label="b" />
            </RadioGroup.Root>
          </Suspense>
        </StrictMode>
      );
      await hydrateFromServer(ui, { inAct: true });
      expect(screen.getAllByRole("radio")).toHaveLength(2);
      expect(action).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("late items mounted by createRoot do not dispatch", async () => {
      const consoleError = vi.spyOn(console, "error");
      const action = vi.fn<ActionFn>();
      const g = hydrationGate();
      await act(async () => {
        render(<LateGroup gate={g.promise} mode="uncontrolled" action={action} />);
      });
      expect(screen.getAllByRole("radio")).toHaveLength(1);
      await act(async () => {
        g.open();
      });
      await flushMicrotasks();
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      // Client-created Items are not partial hydration.
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  renderBoth("platform: form reset", (mode) => {
    it("<button type=reset> dispatches once with the reset event and commits", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.click(radio("b"));
      expect(committed()).toHaveTextContent("b");
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe("a");
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("reset");
      expect(checkedValues()).toEqual(["a"]);
      expect(dataChecked()).toEqual(["a"]);
      expect(committed()).toHaveTextContent("a");
    });

    it("form.reset() dispatches once, also to null", async () => {
      const d = deferred();
      const actions: [string | null, string][] = [];
      render(
        <Harness
          mode={mode}
          initial={null}
          inForm
          action={(next, details) => {
            actions.push([next, details.reason]);
            if (details.reason === "platform") return d.promise;
          }}
        />,
      );
      const user = setupUser();
      await user.click(radio("c"));
      await act(async () => {
        form().reset();
      });
      expect(actions).toEqual([
        ["c", "activate"],
        [null, "platform"],
      ]);
      expect(checkedValues()).toEqual([]);
      expect(dataChecked()).toEqual([]);
      expectPending(group());
      expect(dataPending()).toEqual([]);
      await act(async () => {
        d.resolve();
      });
      expectNotPending(group());
      expect(checkedValues()).toEqual([]);
      expect(committed()).toHaveTextContent("null");
    });

    it("a cancelled reset dispatches nothing and leaves the DOM", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm />);
      const user = setupUser();
      await user.click(radio("b"));
      form().addEventListener("reset", (e) => e.preventDefault());
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(checkedValues()).toEqual(["b"]);
    });

    it("a reset whose target is the optimistic value dispatches nothing", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} inForm initial="b" />);
      const user = setupUser();
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["b"]);
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
      await user.click(radio("b"));
      await user.click(screen.getByRole("button", { name: "disable" }));
      expect(group()).toBeDisabled();
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["b", "activate"],
        ["a", "platform"],
      ]);
      expect(checkedValues()).toEqual(["a"]);
      expect(committed()).toHaveTextContent("a");
    });
  });

  renderBoth("platform: base comparison (conventions 3.8 rule 1)", (mode) => {
    // Guards the explicit null check in the Root's `base()`: with `?.next ?? optimistic` the
    // second reset would read the stale optimistic "c" and dispatch `null` again.
    it("two synchronous form.reset() calls while a reset to null is pending dispatch once", async () => {
      const d = deferred();
      const actions: [string | null, string][] = [];
      render(
        <Harness
          mode={mode}
          initial={null}
          inForm
          action={(next, details) => {
            actions.push([next, details.reason]);
            return d.promise;
          }}
        />,
      );
      const user = setupUser();
      await user.click(radio("c"));
      expect(checkedValues()).toEqual(["c"]);
      await act(async () => {
        form().reset();
        form().reset();
      });
      expect(actions).toEqual([
        ["c", "activate"],
        [null, "platform"],
      ]);
      expect(checkedValues()).toEqual([]);
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(actions).toHaveLength(2);
      expect(checkedValues()).toEqual([]);
      expect(committed()).toHaveTextContent("null");
    });
  });

  describe("platform: form reset, controlled parent decides", () => {
    it("a parent that refuses gets the DOM re-synced to its radio after settle", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} inForm refusePlatform />);
      const user = setupUser();
      await user.click(radio("b"));
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("a");
      expect(action.mock.calls[1]?.[1].reason).toBe("platform");
      expect(checkedValues()).toEqual(["b"]);
      expect(dataChecked()).toEqual(["b"]);
      expect(committed()).toHaveTextContent("b");
    });
  });

  describe("platform: reset target by mode", () => {
    it("uncontrolled: the reset returns to the latest defaultValue", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [def, setDef] = useState("a");
        return (
          <form data-testid="form">
            <RadioGroup.Root aria-label="Fruit" defaultValue={def} valueChangeAction={action}>
              <RadioGroup.Item value="a" aria-label="a" />
              <RadioGroup.Item value="b" aria-label="b" />
              <RadioGroup.Item value="c" aria-label="c" />
            </RadioGroup.Root>
            <button type="button" onClick={() => startTransition(() => setDef("c"))}>
              new default
            </button>
          </form>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(radio("b"));
      await user.click(screen.getByRole("button", { name: "new default" }));
      expect(radio("c").defaultChecked).toBe(true);
      expect(radio("a").defaultChecked).toBe(false);
      // Changing the default does not move the current value.
      expect(checkedValues()).toEqual(["b"]);
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([
        ["b", "activate"],
        ["c", "platform"],
      ]);
      expect(checkedValues()).toEqual(["c"]);
    });

    it("uncontrolled: a defaultValue of null resets to nothing checked", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [def, setDef] = useState<string | null>("a");
        return (
          <form data-testid="form">
            <RadioGroup.Root aria-label="Fruit" defaultValue={def} valueChangeAction={action}>
              <RadioGroup.Item value="a" aria-label="a" />
              <RadioGroup.Item value="b" aria-label="b" />
            </RadioGroup.Root>
            <button type="button" onClick={() => startTransition(() => setDef(null))}>
              clear default
            </button>
          </form>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(screen.getByRole("button", { name: "clear default" }));
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n]) => n)).toEqual([null]);
      expect(checkedValues()).toEqual([]);
    });

    it("controlled: the reset returns to the mount-time value and the parent is notified", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [value, setValue] = useState<string | null>("a");
        return (
          <form data-testid="form">
            <RadioGroup.Root
              aria-label="Fruit"
              value={value}
              valueChangeAction={(next, details) => {
                action(next, details);
                setValue(next);
              }}
            >
              <RadioGroup.Item value="a" aria-label="a" />
              <RadioGroup.Item value="b" aria-label="b" />
              <RadioGroup.Item value="c" aria-label="c" />
            </RadioGroup.Root>
          </form>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(radio("b"));
      await user.click(radio("c"));
      await act(async () => {
        form().reset();
      });
      await flushMicrotasks();
      expect(action.mock.calls.map(([n, d]) => [n, d.reason, d.event?.type])).toEqual([
        ["b", "activate", "click"],
        ["c", "activate", "click"],
        ["a", "platform", "reset"],
      ]);
      expect(checkedValues()).toEqual(["a"]);
    });
  });

  describe("platform: React's automatic reset after a form action", () => {
    function PlanForm({
      submit,
      initial,
      action,
    }: {
      submit: Promise<void>;
      initial: string | null;
      action?: ActionFn;
    }) {
      return (
        <form
          action={async () => {
            await submit;
          }}
        >
          <RadioGroup.Root
            aria-label="Plan"
            name="plan"
            defaultValue={initial}
            {...(action && { valueChangeAction: action })}
          >
            <RadioGroup.Item value="free" aria-label="free" />
            <RadioGroup.Item value="pro" aria-label="pro" />
          </RadioGroup.Root>
          <button type="submit">Save</button>
        </form>
      );
    }

    it.each([
      ["a value", "free"],
      ["null", null],
    ] as const)("returns to the default (%s) with one dispatch", async (_label, initial) => {
      const d = deferred();
      const action = vi.fn<ActionFn>();
      render(<PlanForm submit={d.promise} initial={initial} action={action} />);
      const user = setupUser();
      await user.click(radio("pro"));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(initial);
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("reset");
      expect(checkedValues()).toEqual(initial === null ? [] : [initial]);
      expect(dataChecked()).toEqual(initial === null ? [] : [initial]);
      expectNotPending(group());
      // Still in sync: the next click checks again.
      await user.click(radio("pro"));
      expect(checkedValues()).toEqual(["pro"]);
      expect(action).toHaveBeenCalledTimes(3);
    });

    it("works without a valueChangeAction", async () => {
      const d = deferred();
      render(<PlanForm submit={d.promise} initial={null} />);
      const user = setupUser();
      await user.click(radio("free"));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(checkedValues()).toEqual([]);
      expect(dataChecked()).toEqual([]);
      await user.click(radio("free"));
      expect(checkedValues()).toEqual(["free"]);
      expect(dataChecked()).toEqual(["free"]);
    });
  });

  describe("preventDefault in the action", () => {
    it("warns once and the action still runs", async () => {
      const consoleError = silenceErrors();
      const d = deferred();
      let calls = 0;
      const action = vi.fn<ActionFn>((_next, details) => {
        details.event?.preventDefault();
        // Only the first call stays pending; the later ones settle at once.
        return calls++ === 0 ? d.promise : undefined;
      });
      render(
        <RadioGroup.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      const user = setupUser();
      await user.click(radio("b"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(radio("b")).toHaveAttribute("data-checked", "");
      expectPending(group());
      await act(async () => {
        d.resolve();
      });
      expect(checkedValues()).toEqual(["b"]);
      const warnings = () =>
        consoleError.mock.calls.filter(([m]) => String(m).includes("preventDefault()"));
      expect(warnings()).toHaveLength(1);
      expect(String(warnings()[0]?.[0])).toMatch(/^RadioGroup\.Item: /);

      await user.click(radio("a"));
      await flushMicrotasks();
      expect(checkedValues()).toEqual(["a"]);
      expect(action).toHaveBeenCalledTimes(2);
      // Once per input element: the second radio's first cancelled click warns too.
      expect(warnings()).toHaveLength(2);
      await user.click(radio("b"));
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(3);
      expect(warnings()).toHaveLength(2);
    });
  });

  describe("forms", () => {
    it("contributes name=value of the checked radio to FormData", async () => {
      render(
        <form data-testid="form">
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="free" aria-label="free" />
            <RadioGroup.Item value="pro" aria-label="pro" />
          </RadioGroup.Root>
          <RadioGroup.Root aria-label="Size" name="size" defaultValue="m">
            <RadioGroup.Item value="s" aria-label="s" />
            <RadioGroup.Item value="m" aria-label="m" />
          </RadioGroup.Root>
        </form>,
      );
      expect([...new FormData(form())]).toEqual([["size", "m"]]);
      const user = setupUser();
      await user.click(radio("pro"));
      expect([...new FormData(form())]).toEqual([
        ["plan", "pro"],
        ["size", "m"],
      ]);
    });

    it("required makes the form invalid until one radio is checked", async () => {
      render(
        <form data-testid="form">
          <RadioGroup.Root aria-label="Plan" name="plan" required>
            <RadioGroup.Item value="free" aria-label="free" />
            <RadioGroup.Item value="pro" aria-label="pro" />
          </RadioGroup.Root>
        </form>,
      );
      expect(form().checkValidity()).toBe(false);
      const user = setupUser();
      await user.click(radio("free"));
      expect(form().checkValidity()).toBe(true);
    });
  });

  describe("function props", () => {
    it("className and style on Root, Label and Item, children on Root and Label receive state", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: RadioGroupRootState) => `g${s.pending ? " busy" : ""}`);
      const rootStyle = vi.fn((s: RadioGroupRootState) => ({ opacity: s.pending ? 0.5 : 1 }));
      const labelClass = vi.fn((s: RadioGroupRootState) => `l-${String(s.value)}`);
      const labelStyle = vi.fn((_s: RadioGroupRootState) => ({ color: "red" }));
      const itemClass = vi.fn(
        (s: RadioGroupItemState) =>
          `r${s.checked ? " on" : ""}${s.pending ? " busy" : ""}${s.disabled ? " off" : ""}`,
      );
      const itemStyle = vi.fn((s: RadioGroupItemState) => ({ opacity: s.pending ? 0.5 : 1 }));
      render(
        <RadioGroup.Root
          aria-label="Fruit"
          defaultValue="a"
          valueChangeAction={() => d.promise}
          className={rootClass}
          style={rootStyle}
        >
          {(rootState) => (
            <>
              <RadioGroup.Label className={labelClass} style={labelStyle}>
                {(s) => `Fruit ${String(s.value)}${s.pending ? " (saving)" : ""}`}
              </RadioGroup.Label>
              <span data-testid="root-children">{String(rootState.value)}</span>
              <RadioGroup.Item value="a" aria-label="a" className={itemClass} style={itemStyle} />
              <RadioGroup.Item value="b" aria-label="b" className={itemClass} style={itemStyle} />
              <RadioGroup.Item value="c" aria-label="c" className={itemClass} disabled />
            </>
          )}
        </RadioGroup.Root>,
      );
      expect(rootClass).toHaveBeenLastCalledWith({ value: "a", pending: false, disabled: false });
      expect(group()).toHaveClass("g");
      expect(screen.getByText("Fruit a")).toHaveClass("l-a");
      expect(screen.getByText("Fruit a")).toHaveStyle({ color: "rgb(255, 0, 0)" });
      expect(radio("a")).toHaveClass("r", "on");
      expect(radio("c")).toHaveClass("r", "off");
      expect(itemClass).toHaveBeenCalledWith({
        value: "c",
        checked: false,
        pending: false,
        disabled: true,
      });

      const user = setupUser();
      await user.click(radio("b"));
      expect(rootClass).toHaveBeenLastCalledWith({ value: "b", pending: true, disabled: false });
      expect(group()).toHaveClass("g", "busy");
      expect(group()).toHaveStyle({ opacity: "0.5" });
      expect(screen.getByTestId("root-children")).toHaveTextContent("b");
      expect(screen.getByText("Fruit b (saving)")).toHaveClass("l-b");
      expect(radio("b")).toHaveClass("r", "on", "busy");
      expect(radio("b")).toHaveStyle({ opacity: "0.5" });
      expect(radio("a")).toHaveClass("r");
      expect(radio("a")).not.toHaveClass("on");
      expect(radio("a")).toHaveStyle({ opacity: "1" });

      await act(async () => {
        d.resolve();
      });
      expect(radio("b")).not.toHaveClass("busy");
      expect(screen.getByText("Fruit b")).toBeInTheDocument();
    });

    it("Item state.disabled includes Root disabled", () => {
      render(
        <RadioGroup.Root aria-label="Fruit" disabled>
          <RadioGroup.Item
            value="a"
            aria-label="a"
            className={(s) => (s.disabled ? "off" : "on")}
          />
        </RadioGroup.Root>,
      );
      expect(radio("a")).toHaveClass("off");
      expect(radio("a")).toHaveAttribute("data-disabled", "");
    });
  });

  describe("render element", () => {
    it("Item render element keeps type, name, checked and the handler; merges className; forwards ref", async () => {
      const action = vi.fn<ActionFn>();
      const itemRef = { current: null as HTMLInputElement | null };
      const elementRef = { current: null as HTMLInputElement | null };
      render(
        <RadioGroup.Root
          aria-label="Fruit"
          name="fruit"
          defaultValue="a"
          valueChangeAction={action}
        >
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item
            value="b"
            aria-label="b"
            className="r"
            ref={itemRef}
            render={<input id="x" className="y" ref={elementRef} data-testid="bank" />}
          />
        </RadioGroup.Root>,
      );
      const el = screen.getByTestId("bank") as HTMLInputElement;
      expect(el).toBe(radio("b"));
      expect(el).toHaveAttribute("id", "x");
      expect(el).toHaveClass("r", "y");
      expect(el).toHaveAttribute("type", "radio");
      expect(el).toHaveAttribute("name", "fruit");
      expect(el.checked).toBe(false);
      expect(itemRef.current).toBe(el);
      expect(elementRef.current).toBe(el);

      const user = setupUser();
      await user.click(el);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");
      expect(el.checked).toBe(true);
      expect(el).toHaveAttribute("data-checked", "");
    });

    it("Root render element stays a fieldset with the library's attributes; ref forwarded", () => {
      const rootRef = { current: null as HTMLFieldSetElement | null };
      render(
        <RadioGroup.Root
          aria-label="Fruit"
          ref={rootRef}
          disabled
          render={<fieldset className="custom" data-testid="fs" />}
        >
          <RadioGroup.Item value="a" aria-label="a" />
        </RadioGroup.Root>,
      );
      const fs = screen.getByTestId("fs");
      expect(fs).toBe(group());
      expect(fs).toHaveClass("custom");
      expect(fs).toHaveAttribute("role", "radiogroup");
      expect(fs).toHaveAttribute("data-disabled", "");
      expect(rootRef.current).toBe(fs);
    });

    it("function form on Item receives (props, state)", async () => {
      const d = deferred();
      const renderFn = vi.fn(
        (props: ComponentPropsWithRef<"input">, state: RadioGroupItemState) => (
          <>
            <input {...props} />
            <span data-testid="dot">{state.pending ? "saving" : state.checked ? "on" : "off"}</span>
          </>
        ),
      );
      render(
        <RadioGroup.Root aria-label="Fruit" valueChangeAction={() => d.promise}>
          <RadioGroup.Item value="a" aria-label="a" render={renderFn} />
        </RadioGroup.Root>,
      );
      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "radio", checked: false, value: "a" }),
        { value: "a", checked: false, pending: false, disabled: false },
      );
      const user = setupUser();
      await user.click(radio("a"));
      expect(screen.getByTestId("dot")).toHaveTextContent("saving");
      await act(async () => {
        d.resolve();
      });
      expect(screen.getByTestId("dot")).toHaveTextContent("on");
    });

    it("warns in development when the mounted element is not a fieldset / radio input", () => {
      const consoleError = silenceErrors();
      const ui = (
        <RadioGroup.Root aria-label="Fruit" render={<div />}>
          <RadioGroup.Item
            value="a"
            aria-label="a"
            render={(props) => <button {...(props as object)} />}
          />
        </RadioGroup.Root>
      );
      const { rerender } = render(ui);
      rerender(ui);
      const messages = consoleError.mock.calls.map(([m]) => String(m));
      expect(
        messages.filter((m) => m.startsWith("RadioGroup.Root: expected to render a <fieldset>")),
      ).toHaveLength(1);
      expect(
        messages.filter((m) =>
          m.startsWith('RadioGroup.Item: expected to render an `<input type="radio">`'),
        ),
      ).toHaveLength(1);
    });
  });

  describe("controlled edge cases", () => {
    it("a value prop change while pending converges after settle (walkthrough 9.9)", async () => {
      const d = deferred();
      function Parent() {
        const [value, setValue] = useState<string | null>("a");
        return (
          <>
            <RadioGroup.Root aria-label="Fruit" value={value} valueChangeAction={() => d.promise}>
              <RadioGroup.Item value="a" aria-label="a" />
              <RadioGroup.Item value="b" aria-label="b" />
              <RadioGroup.Item value="c" aria-label="c" />
            </RadioGroup.Root>
            <button type="button" onClick={() => setValue("c")}>
              navigate
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(radio("b"));
      await user.click(screen.getByRole("button", { name: "navigate" }));
      expect(checkedValues()).toEqual(["b"]);
      await act(async () => {
        d.resolve();
      });
      expect(checkedValues()).toEqual(["c"]);
    });

    it("a controlled value that matches no Item checks nothing and does not warn", () => {
      const consoleError = silenceErrors();
      render(
        <RadioGroup.Root aria-label="Fruit" value="zzz">
          <RadioGroup.Item value="a" aria-label="a" />
        </RadioGroup.Root>,
      );
      expect(checkedValues()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("dev warnings", () => {
    it("does not warn in normal use, nor without value or defaultValue", async () => {
      const consoleError = silenceErrors();
      render(
        <RadioGroup.Root aria-label="x">
          <RadioGroup.Item value="a" aria-label="a" />
          <RadioGroup.Item value="b" aria-label="b" />
        </RadioGroup.Root>,
      );
      const user = setupUser();
      await user.click(radio("a"));
      await user.click(radio("b"));
      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});
// design/components/field-form.md 13.1, "Controls inside a Field".
describe("RadioGroup inside a Field.Root", () => {
  it("is named by Field.Label (aria-labelledby), takes name / required / disabled and the ARIA wiring; its own data-pending stays its own", async () => {
    const own = deferred();
    const submission = deferred();
    render(
      <Form.Root action={() => submission.promise}>
        <Field.Root name="plan" required data-testid="root">
          <Field.Label data-testid="label">Plan</Field.Label>
          <RadioGroup.Root valueChangeAction={() => own.promise} data-testid="group">
            <label>
              <RadioGroup.Item value="free" /> Free
            </label>
            <label>
              <RadioGroup.Item value="pro" /> Pro
            </label>
          </RadioGroup.Root>
          <Field.Description data-testid="desc">Later.</Field.Description>
          <Field.Error data-testid="error" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await act(async () => {});
    const group = screen.getByTestId("group");
    expect(screen.getByTestId("label")).not.toHaveAttribute("for");
    expect(group).toHaveAttribute("aria-labelledby", screen.getByTestId("label").id);
    expect(group).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
    expect(group).toHaveAttribute("aria-invalid", "false");
    expect(group).toHaveAttribute("aria-required", "true");
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("name", "plan");
      expect(radio).toBeRequired();
    }

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(radios[0]);

    await user.click(radios[1]!);
    expectPending(group);
    expectNotPending(screen.getByTestId("root"));
    await act(async () => own.resolve());
    expect(screen.queryByTestId("error")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expectPending(screen.getByTestId("root"));
    expectNotPending(group);
    await act(async () => submission.resolve());
  });

  it("Field disabled disables the fieldset", async () => {
    render(
      <Field.Root name="plan" disabled>
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root data-testid="group">
          <RadioGroup.Item value="a" aria-label="A" />
        </RadioGroup.Root>
      </Field.Root>,
    );
    await act(async () => {});
    expect(screen.getByTestId("group")).toBeDisabled();
    expect(screen.getByTestId("group")).toHaveAttribute("data-disabled", "");
  });
});
