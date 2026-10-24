// Shared test suite for the single native checkable inputs, Switch and Checkbox: every row of
// design/components/switch.md section 11 (Checkbox maps rows 1 to 25 one to one,
// design/components/checkbox.md section 11). Each component's test file calls
// `describeCheckableInput` and adds its own rows. Rows that need a real engine (4b, 21b, the DOM
// half of 26) live in the components' *.browser.test.tsx; row 25 (directive) is in
// directives.test.ts.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, use, useLayoutEffect, useState } from "react";
import type { ComponentPropsWithRef, ComponentType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import type { SwitchCheckedChangeDetails, SwitchProps, SwitchState } from "../switch/switch.js";
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
} from "./helpers.js";
import type { ControlMode } from "./helpers.js";

/** The props and state both components share (Checkbox's are a superset). */
type ControlProps = SwitchProps;
type ControlState = SwitchState;
type Details = SwitchCheckedChangeDetails;

export interface CheckableInputConfig {
  /** Display name, also the prefix of the dev warnings. */
  readonly name: "Switch" | "Checkbox";
  readonly Control: ComponentType<ControlProps>;
  /** The input's role: `"switch"` (owned by Switch) or `"checkbox"` (native, no attribute). */
  readonly role: "switch" | "checkbox";
  /** State fields beyond `{ checked, pending, disabled }` (Checkbox: `indeterminate: false`). */
  readonly extraState?: Readonly<Record<string, unknown>>;
  /** The component's two `fsui-<component>-<change>` types (on, off). */
  readonly changeTypes: readonly [string, string];
}

export function describeCheckableInput(config: CheckableInputConfig): void {
  const { name, Control, role, changeTypes } = config;
  const extraState = config.extraState ?? {};
  /** The full state object the component passes to its function props. */
  const fullState = (s: ControlState) => ({ ...s, ...extraState });
  /** The role attribute the component renders: Switch owns `role="switch"`, Checkbox none. */
  const expectRoleAttribute = (el: Element) => {
    if (role === "switch") expect(el).toHaveAttribute("role", "switch");
    else expect(el).not.toHaveAttribute("role");
  };

  type ActionFn = (next: boolean, details: Details) => unknown;

  interface HarnessProps extends Omit<
    ControlProps,
    "checked" | "defaultChecked" | "checkedChangeAction"
  > {
    mode: ControlMode;
    initial?: boolean;
    /** The consumer's work; awaited by the harness's change action. */
    action?: ActionFn;
    /** Catch errors thrown by `action` (turns a rejection into success for the library). */
    catchErrors?: boolean;
    /** Controlled only: adopt `"platform"` dispatches (default) or refuse them. */
    refusePlatform?: boolean;
    /** Wrap only the control in an `ErrorCatcher` that reports to this callback. */
    boundary?: (error: unknown) => void;
    /** Render the committed value through a suspender, everything inside one Suspense boundary. */
    suspender?: ReturnType<typeof createSuspender>;
    /** Wrap the control in a `<form>` with a reset button. */
    inForm?: boolean;
  }

  /**
   * Controlled/uncontrolled parity harness. The controlled variant follows the "update on success"
   * pattern (design 2.5); the uncontrolled variant mirrors the committed value in a sibling so both
   * modes expose it the same way.
   */
  function Harness({
    mode,
    initial = false,
    action,
    catchErrors = false,
    refusePlatform = false,
    boundary,
    suspender,
    inForm = false,
    ...rest
  }: HarnessProps) {
    const [committed, setCommitted] = useState(initial);
    const [error, setError] = useState<unknown>(null);

    const checkedChangeAction = async (next: boolean, details: Details) => {
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

    const modeProps = mode === "controlled" ? { checked: committed } : { defaultChecked: initial };
    let control: ReactNode = (
      <Control
        aria-label="Notifications"
        {...modeProps}
        checkedChangeAction={checkedChangeAction}
        {...rest}
      />
    );
    if (boundary) control = <ErrorCatcher onError={boundary}>{control}</ErrorCatcher>;
    if (inForm) {
      control = (
        <form data-testid="form">
          {control}
          <button type="reset">Reset</button>
        </form>
      );
    }

    const content = (
      <>
        {control}
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

  const input = () => screen.getByRole(role) as HTMLInputElement;
  const committed = () => screen.getByTestId("committed");

  describe(name, () => {
    describe("roles and ARIA", () => {
      it("renders the checkbox input with its role and never aria-checked (row 1, C1)", () => {
        const plain = render(<Control aria-label="Wi-Fi" />);
        const el = screen.getByRole(role, { name: "Wi-Fi" }) as HTMLInputElement;
        expect(el.tagName).toBe("INPUT");
        expect(el).toHaveAttribute("type", "checkbox");
        expectRoleAttribute(el);
        expect(el.checked).toBe(false);
        expect(el).not.toHaveAttribute("aria-checked");
        plain.unmount();

        const on = render(<Control aria-label="Wi-Fi" defaultChecked />);
        expect(input().checked).toBe(true);
        expect(input()).not.toHaveAttribute("aria-checked");
        on.unmount();

        // Through props (type-level it is omitted, but the runtime removal is the guarantee) and
        // through a render element.
        const forced = { "aria-checked": "true" } as object;
        const viaProps = render(<Control aria-label="Wi-Fi" {...forced} />);
        expect(input()).not.toHaveAttribute("aria-checked");
        viaProps.unmount();
        render(<Control aria-label="Wi-Fi" render={<input aria-checked="mixed" />} />);
        expect(input()).not.toHaveAttribute("aria-checked");
      });

      it("emits data attributes by presence and passes native props through (row 2)", () => {
        const plain = render(<Control aria-label="Wi-Fi" />);
        expect(input()).not.toHaveAttribute("data-checked");
        expect(input()).not.toHaveAttribute("data-pending");
        expect(input()).not.toHaveAttribute("data-disabled");
        expect(input()).not.toBeDisabled();
        plain.unmount();

        const onBlur = vi.fn();
        render(
          <>
            <form id="f" />
            <Control
              checked
              disabled
              id="wifi"
              name="wifi"
              value="yes"
              required
              form="f"
              aria-label="Wi-Fi"
              onBlur={onBlur}
            />
          </>,
        );
        const el = input();
        expect(el).toHaveAttribute("data-checked", "");
        expect(el).toHaveAttribute("data-disabled", "");
        expect(el).not.toHaveAttribute("data-pending");
        expect(el).toBeDisabled();
        expect(el).toHaveAttribute("id", "wifi");
        expect(el).toHaveAttribute("name", "wifi");
        expect(el).toHaveAttribute("value", "yes");
        expect(el).toBeRequired();
        expect(el.form?.id).toBe("f");
        fireEvent.blur(el);
        expect(onBlur).toHaveBeenCalledTimes(1);
      });

      it("type is owned; role is owned by Switch and passes through on Checkbox (row 2, C1)", () => {
        const forced = { type: "radio", role: "menuitemcheckbox" } as object;
        const viaProps = render(<Control aria-label="Wi-Fi" {...forced} />);
        const el = screen.getByLabelText("Wi-Fi");
        expect(el).toHaveAttribute("type", "checkbox");
        expect(el).toHaveAttribute("role", role === "switch" ? "switch" : "menuitemcheckbox");
        viaProps.unmount();
        render(
          <Control aria-label="Wi-Fi" render={<input type="radio" role="menuitemcheckbox" />} />,
        );
        const viaRender = screen.getByLabelText("Wi-Fi");
        expect(viaRender).toHaveAttribute("type", "checkbox");
        expect(viaRender).toHaveAttribute(
          "role",
          role === "switch" ? "switch" : "menuitemcheckbox",
        );
      });

      it("a <label htmlFor> and a wrapping <label> name it; a label click dispatches once (row 3)", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <>
            <label htmlFor="a">Airplane mode</label>
            <Control id="a" checkedChangeAction={action} />
            <label>
              <Control checkedChangeAction={action} />
              Bluetooth
            </label>
          </>,
        );
        const user = setupUser();
        const airplane = screen.getByLabelText("Airplane mode") as HTMLInputElement;
        const bluetooth = screen.getByLabelText("Bluetooth") as HTMLInputElement;
        expectRoleAttribute(airplane);

        await user.click(screen.getByText("Airplane mode"));
        expect(action).toHaveBeenCalledTimes(1);
        expect(airplane.checked).toBe(true);
        await user.click(screen.getByText("Bluetooth"));
        expect(action).toHaveBeenCalledTimes(2);
        expect(bluetooth.checked).toBe(true);
        expect(action.mock.calls.map(([, d]) => d.reason)).toEqual(["activate", "activate"]);
      });
    });

    describe("keyboard", () => {
      it("Space dispatches through the native click; Enter does not (row 4)", async () => {
        const action = vi.fn<ActionFn>();
        render(<Control aria-label="Wi-Fi" checkedChangeAction={action} />);
        const user = setupUser();

        await user.tab();
        expect(input()).toHaveFocus();
        await user.keyboard("[Space]");
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.event?.type).toBe("click");
        expect(details.reason).toBe("activate");
        expect(input().checked).toBe(true);

        await user.keyboard("[Enter]");
        expect(action).toHaveBeenCalledTimes(1);
        expect(input().checked).toBe(true);
      });

      it("a disabled switch is not focusable and Space does not dispatch (row 5)", async () => {
        const action = vi.fn<ActionFn>();
        render(<Control aria-label="Wi-Fi" disabled checkedChangeAction={action} />);
        const user = setupUser();
        await user.tab();
        expect(input()).not.toHaveFocus();
        await user.keyboard("[Space]");
        expect(action).not.toHaveBeenCalled();
        expect(input().checked).toBe(false);
      });
    });

    renderBoth("sync action", (mode) => {
      it("calls checkedChangeAction(next, details) and flips (row 6)", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        await user.click(input());
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.event).toBeInstanceOf(window.Event);
        expect(details.event?.type).toBe("click");
        expect(details.reason).toBe("activate");
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");
        expectNotPending(input());
        expect(committed()).toHaveTextContent("true");

        await user.click(input());
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]?.[0]).toBe(false);
        expect(input().checked).toBe(false);
        expect(committed()).toHaveTextContent("false");
      });

      it("disabled never dispatches, even through ref.click() (row 7)", async () => {
        const action = vi.fn<ActionFn>();
        const ref = { current: null as HTMLInputElement | null };
        render(<Harness mode={mode} action={action} disabled ref={ref} />);
        const user = setupUser();

        await user.click(input());
        await act(async () => {
          ref.current!.click();
        });
        await act(async () => {
          fireEvent.click(ref.current!);
        });
        expect(action).not.toHaveBeenCalled();
        expect(input().checked).toBe(false);
        expect(committed()).toHaveTextContent("false");
      });

      it("a click already cancelled by a pass-through onClick does not dispatch (row 26)", async () => {
        // The DOM half of this row (`el.checked` back to the old value) is in
        // switch.browser.test.tsx: jsdom's canceled-activation step toggles `checked` instead of
        // restoring the pre-click value, so after React's restore it ends up wrong in jsdom only.
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} onClick={(e) => e.preventDefault()} />);
        const user = setupUser();

        await user.click(input());
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        expect(input()).not.toHaveAttribute("data-checked");
        expectNotPending(input());
        expect(committed()).toHaveTextContent("false");
        expect(consoleError).not.toHaveBeenCalled();
      });
    });

    renderBoth("async action", (mode) => {
      it("shows the optimistic DOM state and data-pending until the action resolves (row 8)", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        await user.click(input());
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");
        expectPending(input());
        expect(committed()).toHaveTextContent("false");

        await act(async () => {
          d.resolve();
        });
        expectNotPending(input());
        expect(input().checked).toBe(true);
        expect(committed()).toHaveTextContent("true");
      });

      it("awaits an action that resolves with data (non-void return)", async () => {
        const d = deferred<{ ok: boolean }>();
        const save = (_next: boolean): Promise<{ ok: boolean }> => d.promise;
        render(<Harness mode={mode} action={(next) => save(next)} />);
        const user = setupUser();
        await user.click(input());
        expectPending(input());
        await act(async () => {
          d.resolve({ ok: true });
        });
        expectNotPending(input());
        expect(committed()).toHaveTextContent("true");
      });
    });

    renderBoth("rejection", (mode) => {
      it("reaches the Error Boundary and leaves committed state (row 9)", async () => {
        silenceErrors();
        const d = deferred();
        const onError = vi.fn();
        render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
        const user = setupUser();

        await user.click(input());
        expect(input().checked).toBe(true);
        expectPending(input());

        const err = new Error("save failed");
        await act(async () => {
          d.reject(err);
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(screen.queryByRole(role)).not.toBeInTheDocument();
        expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
        expect(committed()).toHaveTextContent("false");
      });

      it("caught inside the action counts as success (row 10)", async () => {
        const d = deferred();
        render(<Harness mode={mode} action={() => d.promise} catchErrors />);
        const user = setupUser();

        await user.click(input());
        expectPending(input());
        await act(async () => {
          d.reject(new Error("vetoed"));
        });
        expectNotPending(input());
        expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
        expect(committed()).toHaveTextContent("false");
        // Only a controlled parent can veto: uncontrolled commits `true`.
        expect(input().checked).toBe(mode === "uncontrolled");
      });
    });

    describe("rejection, DOM rollback (row 9b)", () => {
      it("the DOM checked state rolls back with optimistic state", async () => {
        const d = deferred();
        render(<Harness mode="controlled" action={() => d.promise} catchErrors />);
        const user = setupUser();

        await user.click(input());
        expect(input().checked).toBe(true);
        await act(async () => {
          d.reject(new Error("nope"));
        });
        expect(input()).toBeInTheDocument();
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("data-checked");
        expectNotPending(input());
      });
    });

    describe("overlapping actions (uncontrolled)", () => {
      it.each([
        ["second then first", [1, 0]],
        ["first then second", [0, 1]],
      ] as const)("latest dispatch wins when resolved %s (row 11)", async (_label, order) => {
        const deferreds = [deferred(), deferred()];
        let calls = 0;
        const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
        render(<Harness mode="uncontrolled" action={action} />);
        const user = setupUser();

        await user.click(input());
        await user.click(input());
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
        expect(input().checked).toBe(false);
        expectPending(input());

        for (const i of order) {
          await act(async () => {
            deferreds[i]!.resolve();
          });
        }
        expect(input().checked).toBe(false);
        expectNotPending(input());
      });

      it("stays pending until every in-flight action settles (row 12)", async () => {
        const deferreds = [deferred(), deferred()];
        let calls = 0;
        render(<Harness mode="uncontrolled" action={() => deferreds[calls++]!.promise} />);
        const user = setupUser();

        await user.click(input());
        await user.click(input());
        await act(async () => {
          deferreds[1]!.resolve();
        });
        expectPending(input());
        expect(input().checked).toBe(false);
        await act(async () => {
          deferreds[0]!.resolve();
        });
        expectNotPending(input());
      });
    });

    renderBoth("superseded rejection", (mode) => {
      function renderTwoClicks(onError: (error: unknown) => void) {
        const deferreds = [deferred(), deferred()];
        let calls = 0;
        const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
        render(<Harness mode={mode} action={action} boundary={onError} />);
        return { deferreds, action };
      }

      it("reaches the boundary when the older action rejects after the newer resolved (row 12a)", async () => {
        silenceErrors();
        const onError = vi.fn();
        const { deferreds, action } = renderTwoClicks(onError);
        const user = setupUser();

        await user.click(input());
        await user.click(input());
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
        await act(async () => {
          deferreds[1]!.resolve();
        });
        expect(onError).not.toHaveBeenCalled();
        expect(input().checked).toBe(false);

        const err = new Error("older save failed");
        await act(async () => {
          deferreds[0]!.reject(err);
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(err);
        expect(screen.queryByRole(role)).not.toBeInTheDocument();
        expect(committed()).toHaveTextContent("false");
      });

      it("reaches the boundary when the older action rejects while the newer is pending (row 12b)", async () => {
        silenceErrors();
        const onError = vi.fn();
        const { deferreds } = renderTwoClicks(onError);
        const user = setupUser();

        await user.click(input());
        await user.click(input());
        expectPending(input());
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
        expect(committed()).toHaveTextContent("false");
      });
    });

    renderBoth("suspending content", (mode) => {
      it("keeps old content, no fallback, pending while the new content loads (row 13)", async () => {
        const suspender = createSuspender();
        suspender.resolve("false");
        render(<Harness mode={mode} suspender={suspender} />);
        const user = setupUser();
        expect(screen.getByTestId("suspender")).toHaveTextContent("false");

        await user.click(input());
        expect(input().checked).toBe(true);
        expectPending(input());
        expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
        expect(screen.getByTestId("suspender")).toHaveTextContent("false");

        await act(async () => {
          suspender.resolve("true");
        });
        expect(screen.getByTestId("suspender")).toHaveTextContent("true");
        expect(committed()).toHaveTextContent("true");
        expectNotPending(input());
        expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      });
    });

    describe("function props (row 14)", () => {
      it("className, style and render receive the state and the attributes agree", async () => {
        const d = deferred();
        const className = vi.fn(
          (s: ControlState) => `sw${s.checked ? " on" : ""}${s.pending ? " busy" : ""}`,
        );
        const style = vi.fn((s: ControlState) => ({ opacity: s.pending ? 0.5 : 1 }));
        render(
          <Control
            aria-label="Wi-Fi"
            checkedChangeAction={() => d.promise}
            className={className}
            style={style}
          />,
        );
        const user = setupUser();

        const initial = fullState({ checked: false, pending: false, disabled: false });
        expect(className).toHaveBeenLastCalledWith(initial);
        expect(style).toHaveBeenLastCalledWith(initial);
        expect(input()).toHaveClass("sw");

        await user.click(input());
        const inFlight = fullState({ checked: true, pending: true, disabled: false });
        expect(className).toHaveBeenLastCalledWith(inFlight);
        expect(style).toHaveBeenLastCalledWith(inFlight);
        expect(input()).toHaveClass("sw", "on", "busy");
        expect(input()).toHaveStyle({ opacity: "0.5" });
        expect(input().checked).toBe(true);
        expectPending(input());

        await act(async () => {
          d.resolve();
        });
        expect(className).toHaveBeenLastCalledWith(
          fullState({ checked: true, pending: false, disabled: false }),
        );
        expect(input()).not.toHaveClass("busy");
      });

      it("state.disabled reflects the prop", () => {
        const className = vi.fn((s: ControlState) => (s.disabled ? "off" : "on"));
        render(<Control aria-label="Wi-Fi" disabled className={className} />);
        expect(input()).toHaveClass("off");
      });
    });

    describe("render prop", () => {
      function MyInput({ ref, size: _size, ...props }: ComponentPropsWithRef<"input">) {
        return <input ref={ref} data-my-input="" {...props} />;
      }

      it("element form merges props, forwards ref and keeps dispatching (row 15)", async () => {
        const action = vi.fn<ActionFn>();
        const controlRef = { current: null as HTMLInputElement | null };
        const elementRef = { current: null as HTMLInputElement | null };
        render(
          <Control
            aria-label="Wi-Fi"
            ref={controlRef}
            className="sw"
            style={{ opacity: 0.5, color: "blue" }}
            checkedChangeAction={action}
            render={<MyInput ref={elementRef} size={3} className="x" style={{ color: "red" }} />}
          />,
        );
        const user = setupUser();

        const el = input();
        expect(el).toHaveAttribute("data-my-input", "");
        expect(el).toHaveClass("sw", "x");
        expect(el).toHaveStyle({ color: "rgb(255, 0, 0)", opacity: "0.5" });
        expect(el).toHaveAttribute("type", "checkbox");
        expectRoleAttribute(el);
        expect(controlRef.current).toBe(el);
        expect(elementRef.current).toBe(el);

        await user.click(el);
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe(true);
        expect(el.checked).toBe(true);
        expect(el).toHaveAttribute("data-checked", "");
      });

      it("element form cannot set checked, defaultChecked or aria-checked (row 15)", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        render(
          <Control
            aria-label="Wi-Fi"
            checkedChangeAction={action}
            render={<input checked readOnly aria-checked="true" data-checked="nope" />}
          />,
        );
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("aria-checked");
        expect(input()).not.toHaveAttribute("data-checked");
        const user = setupUser();
        await user.click(input());
        expect(action).toHaveBeenCalledWith(true, expect.anything());
        expect(input().checked).toBe(true);

        const withDefault = render(
          <Control aria-label="Bluetooth" render={<input defaultChecked />} />,
        );
        expect(
          (withDefault.getByRole(role, { name: "Bluetooth" }) as HTMLInputElement).checked,
        ).toBe(false);
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("element form cannot override disabled: native disabled and data-disabled agree", async () => {
        const action = vi.fn<ActionFn>();
        const { rerender } = render(
          <Control
            aria-label="Wi-Fi"
            disabled
            checkedChangeAction={action}
            render={<input disabled={false} />}
          />,
        );
        expect(input()).toBeDisabled();
        expect(input()).toHaveAttribute("data-disabled", "");
        await act(async () => {
          input().click();
        });
        expect(action).not.toHaveBeenCalled();
        expect(input().checked).toBe(false);

        rerender(
          <Control aria-label="Wi-Fi" checkedChangeAction={action} render={<input disabled />} />,
        );
        expect(input()).toBeEnabled();
        expect(input()).not.toHaveAttribute("data-disabled");
        await setupUser().click(input());
        expect(action).toHaveBeenCalledTimes(1);
        expect(input().checked).toBe(true);
      });

      it("function form receives (props, state) and may render siblings (row 16)", async () => {
        const d = deferred();
        const renderFn = vi.fn((props: ComponentPropsWithRef<"input">, state: ControlState) => (
          <>
            <input {...props} />
            <span data-testid="thumb">
              {state.pending ? "saving" : state.checked ? "on" : "off"}
            </span>
          </>
        ));
        render(
          <Control aria-label="Wi-Fi" checkedChangeAction={() => d.promise} render={renderFn} />,
        );
        const user = setupUser();
        expect(renderFn).toHaveBeenLastCalledWith(
          expect.objectContaining({
            type: "checkbox",
            checked: false,
            ...(role === "switch" && { role: "switch" }),
          }),
          fullState({ checked: false, pending: false, disabled: false }),
        );
        expect(screen.getByTestId("thumb")).toHaveTextContent("off");

        await user.click(input());
        expect(screen.getByTestId("thumb")).toHaveTextContent("saving");
        expect(input().checked).toBe(true);
        await act(async () => {
          d.resolve();
        });
        expect(screen.getByTestId("thumb")).toHaveTextContent("on");
      });

      it("warns in development when the rendered element is not a checkbox input (row 16)", () => {
        const consoleError = silenceErrors();
        const { rerender } = render(
          <Control aria-label="Wi-Fi" render={(props) => <button {...(props as object)} />} />,
        );
        rerender(
          <Control aria-label="Wi-Fi" render={(props) => <button {...(props as object)} />} />,
        );
        const warnings = consoleError.mock.calls.filter(([m]) =>
          String(m).includes('expected to render an `<input type="checkbox">`'),
        );
        expect(warnings).toHaveLength(1);
        expect(String(warnings[0]?.[0])).toMatch(new RegExp(`^${name}: .*but got .<button>.`));
      });
    });

    describe("post-await rule (row 17)", () => {
      it("checked and data-pending converge with startTransition after the await", async () => {
        const d = deferred();
        const snapshots: { checked: boolean; pending: boolean }[] = [];
        // Rendered next to the input through `render`, so its layout effect runs after every commit
        // of the control and sees each intermediate state.
        function Recorder() {
          useLayoutEffect(() => {
            const el = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (el)
              snapshots.push({ checked: el.checked, pending: el.hasAttribute("data-pending") });
          });
          return null;
        }
        function Parent() {
          const [checked, setChecked] = useState(false);
          return (
            <Control
              aria-label="Wi-Fi"
              checked={checked}
              checkedChangeAction={async (next) => {
                await d.promise;
                startTransition(() => setChecked(next));
              }}
              render={(props) => (
                <>
                  <input {...props} />
                  <Recorder />
                </>
              )}
            />
          );
        }
        render(<Parent />);
        const user = setupUser();
        await user.click(input());
        expect(snapshots.at(-1)).toEqual({ checked: true, pending: true });
        await act(async () => {
          d.resolve();
        });
        expect(snapshots.at(-1)).toEqual({ checked: true, pending: false });
        expect(snapshots.slice(1).every((s) => s.checked)).toBe(true);
      });
    });

    describe("controlled edge cases", () => {
      it("snaps back when the parent never adopts the value (veto)", async () => {
        const d = deferred();
        render(
          <Control aria-label="Wi-Fi" checked={false} checkedChangeAction={() => d.promise} />,
        );
        const user = setupUser();
        await user.click(input());
        expect(input().checked).toBe(true);
        await act(async () => {
          d.resolve();
        });
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("data-checked");
        expectNotPending(input());
      });
    });

    describe("transition prop (row 18)", () => {
      it("renders the same markup with and without `transition`", () => {
        const plain = render(<Control aria-label="x" defaultChecked />).container.innerHTML;
        const str = render(<Control aria-label="x" defaultChecked transition="fsui-fade" />)
          .container.innerHTML;
        const map = render(
          <Control
            aria-label="x"
            defaultChecked
            transition={{ [changeTypes[0]]: "on", [changeTypes[1]]: "off", default: "none" }}
          />,
        ).container.innerHTML;
        expect(str).toBe(plain);
        expect(map).toBe(plain);
      });
    });

    describe("dev warnings (row 19)", () => {
      it("warns once when checked and defaultChecked are both set", () => {
        const consoleError = silenceErrors();
        const { rerender } = render(<Control aria-label="x" checked defaultChecked />);
        rerender(<Control aria-label="x" checked defaultChecked />);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toMatch(/both `checked` and `defaultChecked`/);
      });

      it("warns once when switching from uncontrolled to controlled", () => {
        const consoleError = silenceErrors();
        const { rerender } = render(<Control aria-label="x" />);
        rerender(<Control aria-label="x" checked />);
        rerender(<Control aria-label="x" checked={false} />);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toMatch(/uncontrolled to controlled/);
      });

      it("preventDefault() in the action warns once and desyncs only while pending", async () => {
        const consoleError = silenceErrors();
        const deferreds = [deferred(), deferred()];
        let calls = 0;
        render(
          <Control
            aria-label="x"
            checkedChangeAction={(_next, details) => {
              details.event?.preventDefault();
              return deferreds[calls++]!.promise;
            }}
          />,
        );
        const user = setupUser();
        await user.click(input());
        // The documented desync: the browser restored the DOM after React did.
        expect(input().checked).toBe(false);
        expect(input()).toHaveAttribute("data-checked", "");
        expectPending(input());
        const warnings = () =>
          consoleError.mock.calls.filter(([m]) => String(m).includes("preventDefault()"));
        expect(warnings()).toHaveLength(1);
        expect(String(warnings()[0]?.[0])).toMatch(new RegExp(`^${name}: `));

        await act(async () => {
          deferreds[0]!.resolve();
        });
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");

        await user.click(input());
        await act(async () => {
          deferreds[1]!.resolve();
        });
        expect(warnings()).toHaveLength(1);
      });

      it("does not warn in normal use", async () => {
        const consoleError = silenceErrors();
        const { rerender } = render(<Control aria-label="x" defaultChecked />);
        const user = setupUser();
        await user.click(input());
        rerender(<Control aria-label="x" defaultChecked={false} />);
        expect(consoleError).not.toHaveBeenCalled();
      });
    });

    renderBoth("platform: form reset (row 20)", (mode) => {
      it("follows <button type=reset> with a platform dispatch carrying the reset event", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm />);
        const user = setupUser();

        await user.click(input());
        expect(committed()).toHaveTextContent("true");
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(2);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("platform");
        expect(details.event?.type).toBe("reset");
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("data-checked");
        expect(committed()).toHaveTextContent("false");
      });

      it("follows a programmatic form.reset() the same way", async () => {
        const d = deferred();
        const actions: [boolean, string][] = [];
        render(
          <Harness
            mode={mode}
            action={(next, details) => {
              actions.push([next, details.reason]);
              if (details.reason === "platform") return d.promise;
            }}
            inForm
          />,
        );
        const user = setupUser();
        await user.click(input());
        await act(async () => {
          (screen.getByTestId("form") as HTMLFormElement).reset();
        });
        expect(actions).toEqual([
          [true, "activate"],
          [false, "platform"],
        ]);
        expect(input().checked).toBe(false);
        expectPending(input());
        await act(async () => {
          d.resolve();
        });
        expectNotPending(input());
        expect(input().checked).toBe(false);
        expect(committed()).toHaveTextContent("false");
      });

      it("a cancelled reset dispatches nothing and leaves the DOM", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm />);
        const user = setupUser();
        await user.click(input());
        screen.getByTestId("form").addEventListener("reset", (e) => e.preventDefault());
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(1);
        expect(input().checked).toBe(true);
      });

      it("a reset to the value the user already intends dispatches nothing", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} inForm initial />);
        const user = setupUser();
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        expect(input().checked).toBe(true);
      });
    });

    describe("platform: form reset, controlled parent decides (row 20)", () => {
      it("a parent that refuses gets the DOM re-synced after settle", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode="controlled" action={action} inForm refusePlatform />);
        const user = setupUser();
        await user.click(input());
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]?.[1].reason).toBe("platform");
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");
        expect(committed()).toHaveTextContent("true");
      });

      it("the controlled reset target is the mount-time value", async () => {
        const action = vi.fn<ActionFn>();
        render(<Harness mode="controlled" action={action} inForm initial />);
        const user = setupUser();
        await user.click(input());
        expect(input().checked).toBe(false);
        await user.click(screen.getByRole("button", { name: "Reset" }));
        await flushMicrotasks();
        expect(action.mock.calls.at(-1)?.[0]).toBe(true);
        expect(input().checked).toBe(true);
      });
    });

    describe("platform: React's automatic reset after a form action (row 21)", () => {
      function ProfileForm({
        submit,
        newDefault,
        action,
      }: {
        submit: Promise<void>;
        newDefault?: boolean;
        action?: ActionFn;
      }) {
        const [def, setDef] = useState(false);
        return (
          <form
            action={async () => {
              await submit;
              if (newDefault !== undefined) startTransition(() => setDef(newDefault));
            }}
          >
            <Control
              aria-label="Newsletter"
              name="newsletter"
              defaultChecked={def}
              {...(action && { checkedChangeAction: action })}
            />
            <button type="submit">Save</button>
          </form>
        );
      }

      it("returns to defaultChecked after a successful action, with no desync", async () => {
        const d = deferred();
        render(<ProfileForm submit={d.promise} />);
        const user = setupUser();
        await user.click(input());
        expect(input().checked).toBe(true);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("data-checked");
        expectNotPending(input());
        // Still in sync: the next click turns it on again.
        await user.click(input());
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");
      });

      it("dispatches the reset to checkedChangeAction", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>();
        render(<ProfileForm submit={d.promise} action={action} />);
        const user = setupUser();
        await user.click(input());
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]?.[0]).toBe(false);
        expect(action.mock.calls[1]?.[1].reason).toBe("platform");
        expect(action.mock.calls[1]?.[1].event?.type).toBe("reset");
        expect(input().checked).toBe(false);
      });

      it("the reset target follows a defaultChecked changed in the same transition", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>();
        render(<ProfileForm submit={d.promise} newDefault action={action} />);
        const user = setupUser();
        await user.click(input());
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        expect(input().checked).toBe(true);
        expect(input()).toHaveAttribute("data-checked", "");
        expect(input().defaultChecked).toBe(true);
        // The browser reset to the new default, which is what the user already had: no dispatch.
        expect(action).toHaveBeenCalledTimes(1);
      });

      it("controlled: the reset is offered to the parent", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>();
        function Controlled() {
          const [checked, setChecked] = useState(false);
          return (
            <form
              action={async () => {
                await d.promise;
              }}
            >
              <Control
                aria-label="Newsletter"
                checked={checked}
                checkedChangeAction={(next, details) => {
                  action(next, details);
                  setChecked(next);
                }}
              />
              <button type="submit">Save</button>
            </form>
          );
        }
        render(<Controlled />);
        const user = setupUser();
        await user.click(input());
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => {
          d.resolve();
        });
        await flushMicrotasks();
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]?.[0]).toBe(false);
        expect(action.mock.calls[1]?.[1].event?.type).toBe("reset");
        expect(input().checked).toBe(false);
      });
    });

    describe("platform: click before hydration (row 22)", () => {
      async function hydrate(ui: ReactNode, mutate: (el: HTMLInputElement) => void) {
        const container = document.createElement("div");
        document.body.append(container);
        container.innerHTML = renderToString(ui);
        mutate(container.querySelector("input")!);
        const result = render(ui, { container, hydrate: true });
        await flushMicrotasks();
        return result;
      }

      renderBoth("mount reconciliation", (mode) => {
        it("dispatches the hydrated DOM value once with reason platform", async () => {
          const consoleError = silenceErrors();
          const action = vi.fn<ActionFn>();
          await hydrate(<Harness mode={mode} action={action} />, (el) => {
            el.checked = true;
          });
          expect(action).toHaveBeenCalledTimes(1);
          const [next, details] = action.mock.calls[0]!;
          expect(next).toBe(true);
          expect(details.reason).toBe("platform");
          expect(details.event).toBeUndefined();
          expect(JSON.stringify(details)).toBe('{"reason":"platform"}');
          expect(input().checked).toBe(true);
          expect(input()).toHaveAttribute("data-checked", "");
          expect(committed()).toHaveTextContent("true");
          expect(consoleError).not.toHaveBeenCalled();
        });

        it("dispatches once under StrictMode", async () => {
          const action = vi.fn<ActionFn>();
          await hydrate(
            <StrictMode>
              <Harness mode={mode} action={action} />
            </StrictMode>,
            (el) => {
              el.checked = true;
            },
          );
          expect(action).toHaveBeenCalledTimes(1);
          expect(input().checked).toBe(true);
        });

        it("does not dispatch when the DOM matches", async () => {
          const action = vi.fn<ActionFn>();
          await hydrate(<Harness mode={mode} action={action} initial />, () => {});
          expect(action).not.toHaveBeenCalled();
          expect(input().checked).toBe(true);
        });
      });

      it("a controlled parent that refuses gets the DOM re-synced after settle", async () => {
        const action = vi.fn<ActionFn>();
        await hydrate(
          <Control aria-label="x" checked={false} checkedChangeAction={action} />,
          (el) => {
            el.checked = true;
          },
        );
        expect(action).toHaveBeenCalledTimes(1);
        expect(input().checked).toBe(false);
        expect(input()).not.toHaveAttribute("data-checked");
      });

      describe("inside a Suspense boundary that hydrates after its parent", () => {
        function Gate({ promise, children }: { promise: Promise<void>; children: ReactNode }) {
          use(promise);
          return children;
        }
        function Page({ gate, action }: { gate: Promise<void>; action: ActionFn }) {
          return (
            <main>
              <Suspense fallback={null}>
                <Gate promise={gate}>
                  <Control aria-label="Late" checkedChangeAction={action} />
                </Gate>
              </Suspense>
            </main>
          );
        }

        for (const strict of [false, true]) {
          it(`a click before the boundary hydrates dispatches once${strict ? " (StrictMode)" : ""}`, async () => {
            // A single control reconciles at its own mount, which is the boundary's hydration;
            // nothing depends on when its parents mounted (contrast the group adapter).
            const consoleError = silenceErrors();
            const action = vi.fn<ActionFn>();
            const wrap = (ui: ReactNode) => (strict ? <StrictMode>{ui}</StrictMode> : ui);
            const container = document.createElement("div");
            document.body.append(container);
            const ready = Object.assign(Promise.resolve(), {
              status: "fulfilled",
              value: undefined,
            });
            container.innerHTML = renderToString(wrap(<Page gate={ready} action={action} />));
            const gate = deferred();
            render(wrap(<Page gate={gate.promise} action={action} />), {
              container,
              hydrate: true,
            });
            await flushMicrotasks();
            const server = container.querySelector("input")!;
            await act(async () => {
              server.click();
            });
            expect(server.checked).toBe(true);
            expect(action).not.toHaveBeenCalled();

            await act(async () => {
              gate.resolve();
            });
            await flushMicrotasks();
            expect(action).toHaveBeenCalledTimes(1);
            expect(action.mock.calls[0]?.[0]).toBe(true);
            expect(action.mock.calls[0]?.[1].reason).toBe("platform");
            expect(input()).toBe(server);
            expect(input().checked).toBe(true);
            expect(input()).toHaveAttribute("data-checked", "");
            const errors = consoleError.mock.calls.map(([m]) => String(m));
            expect(errors.filter((m) => /hydrat|match/i.test(m))).toEqual([]);
          });
        }
      });

      it("createRoot never dispatches on mount", async () => {
        const action = vi.fn<ActionFn>();
        render(
          <StrictMode>
            <Control aria-label="x" defaultChecked checkedChangeAction={action} />
          </StrictMode>,
        );
        await flushMicrotasks();
        expect(action).not.toHaveBeenCalled();
        expect(input().checked).toBe(true);
      });
    });

    describe("details (row 23)", () => {
      it("exposes `event` as a virtual, non-own property", async () => {
        const action = vi.fn<ActionFn>();
        render(<Control aria-label="x" checkedChangeAction={action} />);
        const user = setupUser();
        await user.click(input());
        const details = action.mock.calls[0]![1];
        expect(details.event).toBeInstanceOf(window.Event);
        expect("event" in details).toBe(true);
        expect(Object.keys(details)).toEqual(["reason"]);
        expect(JSON.stringify(details)).toBe('{"reason":"activate"}');
      });

      it("can be passed straight to a Server-Function-shaped action", async () => {
        const serverFn = vi.fn(async (_next: boolean, _details: Details) => {});
        render(<Control aria-label="x" checkedChangeAction={serverFn} />);
        const user = setupUser();
        await user.click(input());
        const [next, details] = serverFn.mock.calls[0]!;
        expect(JSON.parse(JSON.stringify([next, details]))).toEqual([true, { reason: "activate" }]);
        expect(input().checked).toBe(true);
      });

      it("attaches the component transition types (wiring smoke test)", async () => {
        // jsdom has no view transitions; this only proves a dispatch with types does not throw.
        const action = vi.fn<ActionFn>();
        render(<Control aria-label="x" transition="fsui-fade" checkedChangeAction={action} />);
        const user = setupUser();
        await user.click(input());
        await user.click(input());
        expect(action.mock.calls.map(([n]) => n)).toEqual([true, false]);
      });
    });

    describe("forms (row 24)", () => {
      it("contributes name=value to FormData only when checked", async () => {
        render(
          <form data-testid="form">
            <Control aria-label="Notifications" name="notifications" />
            <Control aria-label="Digest" name="digest" value="weekly" defaultChecked />
          </form>,
        );
        const form = screen.getByTestId("form") as HTMLFormElement;
        expect([...new FormData(form)]).toEqual([["digest", "weekly"]]);
        const user = setupUser();
        await user.click(screen.getByRole(role, { name: "Notifications" }));
        expect([...new FormData(form)]).toEqual([
          ["notifications", "on"],
          ["digest", "weekly"],
        ]);
      });

      it("required and unchecked makes the form invalid", async () => {
        render(
          <form data-testid="form">
            <Control aria-label="Terms" name="terms" required />
          </form>,
        );
        const form = screen.getByTestId("form") as HTMLFormElement;
        expect(form.checkValidity()).toBe(false);
        expect(input().matches(":invalid")).toBe(true);
        const user = setupUser();
        await user.click(input());
        expect(form.checkValidity()).toBe(true);
      });
    });

    it("merges a consumer object ref with the library's ref", () => {
      const ref = { current: null as HTMLInputElement | null };
      const { unmount } = render(<Control aria-label="x" ref={ref} />);
      expect(ref.current?.tagName).toBe("INPUT");
      unmount();
      expect(ref.current).toBeNull();
    });
  });

  // design/components/field-form.md 13.1, "Controls inside a Field".
  describe(`${name} inside a Field.Root`, () => {
    it("gets the Field's id, name, ARIA wiring, disabled and required; its own data-pending stays its own", async () => {
      const own = deferred();
      const submission = deferred();
      render(
        <Form.Root action={() => submission.promise}>
          <Field.Root name="terms" required data-testid="root">
            <Field.Label data-testid="label">Accept</Field.Label>
            <Control checkedChangeAction={() => own.promise} data-testid="control" />
            <Field.Description data-testid="desc">Read them first.</Field.Description>
            <Field.Error data-testid="error" />
          </Field.Root>
          <Form.Submit>Save</Form.Submit>
        </Form.Root>,
      );
      await act(async () => {});
      const el = screen.getByTestId("control") as HTMLInputElement;
      const label = screen.getByTestId("label");
      expect(label).toHaveAttribute("for", el.id);
      expect(el).toHaveAccessibleName("Accept");
      expect(el).toHaveAttribute("name", "terms");
      expect(el).toBeRequired();
      expect(el).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
      expect(el).toHaveAttribute("aria-invalid", "false");

      const user = setupUser();
      // A submission attempt while unchecked: the Field shows the error, focuses the control.
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {});
      expect(el).toHaveAttribute("aria-invalid", "true");
      expect(el).toHaveAttribute("data-invalid", "");
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(document.activeElement).toBe(el);

      // Its own action: its own data-pending, not the Field's.
      await user.click(el);
      expectPending(el);
      expectNotPending(screen.getByTestId("root"));
      await act(async () => own.resolve());
      expectNotPending(el);
      expect(screen.queryByTestId("error")).toBeNull();

      // The form's submission: the Field's data-pending, not the control's.
      await user.click(screen.getByRole("button", { name: "Save" }));
      expectPending(screen.getByTestId("root"));
      expectNotPending(el);
      await act(async () => submission.resolve());
    });

    it("Field disabled disables it; its own id is ignored with a warning", async () => {
      const error = silenceErrors();
      render(
        <Field.Root name="n" disabled>
          <Field.Label>N</Field.Label>
          <Control id="mine" data-testid="control" />
        </Field.Root>,
      );
      await act(async () => {});
      const el = screen.getByTestId("control");
      expect(el).toBeDisabled();
      expect(el).toHaveAttribute("data-disabled", "");
      expect(el.id).not.toBe("mine");
      expect(error).toHaveBeenCalledWith(expect.stringContaining(`${name}: the \`id\` prop`));
    });
  });
}
