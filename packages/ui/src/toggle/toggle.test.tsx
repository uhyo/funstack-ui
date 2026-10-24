import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useLayoutEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Toggle } from "./toggle.js";
import type { ToggleProps, ToggleState, TogglePressedChangeDetails } from "./toggle.js";

type ActionFn = (next: boolean, details: TogglePressedChangeDetails) => unknown;

interface HarnessProps extends Omit<
  ToggleProps,
  "pressed" | "defaultPressed" | "pressedChangeAction"
> {
  mode: ControlMode;
  initial?: boolean;
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Wrap only the Toggle in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Render the committed value through a suspender, everything inside one Suspense boundary. */
  suspender?: ReturnType<typeof createSuspender>;
}

/**
 * Test harness for controlled/uncontrolled parity. The controlled variant follows the
 * "update on success" pattern from the design (section 2.4); the uncontrolled variant mirrors the
 * committed value in a sibling so both modes expose it the same way.
 */
function Harness({
  mode,
  initial = false,
  action,
  catchErrors = false,
  boundary,
  suspender,
  children = "Favorite",
  ...rest
}: HarnessProps) {
  const [committed, setCommitted] = useState(initial);
  const [error, setError] = useState<unknown>(null);

  const pressedChangeAction = async (next: boolean, details: TogglePressedChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    startTransition(() => setCommitted(next));
  };

  const modeProps = mode === "controlled" ? { pressed: committed } : { defaultPressed: initial };
  let toggle: ReactNode = (
    <Toggle {...modeProps} pressedChangeAction={pressedChangeAction} {...rest}>
      {children}
    </Toggle>
  );
  if (boundary) toggle = <ErrorCatcher onError={boundary}>{toggle}</ErrorCatcher>;

  const content = (
    <>
      {toggle}
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

const button = () => screen.getByRole("button");
const committed = () => screen.getByTestId("committed");

describe("Toggle", () => {
  describe("roles and ARIA", () => {
    it("renders <button type=button> with aria-pressed (row 1)", () => {
      render(<Toggle>Favorite</Toggle>);
      const el = screen.getByRole("button", { name: "Favorite" });
      expect(el.tagName).toBe("BUTTON");
      expect(el).toHaveAttribute("type", "button");
      expect(el).toHaveAttribute("aria-pressed", "false");
      expect(el).not.toHaveAttribute("role");
    });

    it("defaultPressed gives aria-pressed=true; never mixed or absent (row 1)", () => {
      // Fresh renders rather than rerenders: switching modes after mount is a dev warning.
      const uncontrolled = render(<Toggle defaultPressed>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "true");
      uncontrolled.unmount();

      const off = render(<Toggle pressed={false}>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "false");
      off.unmount();

      render(<Toggle pressed>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "true");
    });

    it("emits boolean data attributes by presence (row 2)", () => {
      const plain = render(<Toggle>Favorite</Toggle>);
      expect(button()).not.toHaveAttribute("data-pressed");
      expect(button()).not.toHaveAttribute("data-pending");
      expect(button()).not.toHaveAttribute("data-disabled");
      expect(button()).not.toBeDisabled();
      plain.unmount();

      render(
        <Toggle pressed disabled>
          Favorite
        </Toggle>,
      );
      expect(button()).toHaveAttribute("data-pressed", "");
      expect(button()).toHaveAttribute("data-disabled", "");
      expect(button()).toBeDisabled();
      expect(button()).not.toHaveAttribute("data-pending");
    });

    it("passes native props through (row 3)", () => {
      const onPointerDown = vi.fn();
      render(
        <Toggle id="fav" aria-label="Favorite" form="post-form" onPointerDown={onPointerDown}>
          <span aria-hidden>*</span>
        </Toggle>,
      );
      const el = screen.getByRole("button", { name: "Favorite" });
      expect(el).toHaveAttribute("id", "fav");
      expect(el).toHaveAttribute("form", "post-form");
      fireEvent.pointerDown(el);
      expect(onPointerDown).toHaveBeenCalledTimes(1);
    });

    it("does not accept `type` (row 3, type-level)", () => {
      // @ts-expect-error `type` is not a Toggle prop; a toggle is always type="button".
      render(<Toggle type="submit">Favorite</Toggle>);
      // Even when forced through, the library's type wins at runtime.
      expect(button()).toHaveAttribute("type", "button");
    });
  });

  describe("keyboard", () => {
    it("Space and Enter dispatch through the native click (row 4)", async () => {
      const action = vi.fn<ActionFn>();
      render(<Toggle pressedChangeAction={action}>Favorite</Toggle>);
      const user = setupUser();

      await user.tab();
      expect(button()).toHaveFocus();

      await user.keyboard("[Space]");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
      expect(button()).toHaveAttribute("aria-pressed", "true");

      await user.keyboard("[Enter]");
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe(false);
      expect(action.mock.calls[1]?.[1].event?.type).toBe("click");
      expect(button()).toHaveAttribute("aria-pressed", "false");
    });

    it("disabled button is not in the tab order and keys do not dispatch (row 5)", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Toggle disabled pressedChangeAction={action}>
          Favorite
        </Toggle>,
      );
      const user = setupUser();

      await user.tab();
      expect(button()).not.toHaveFocus();
      await user.keyboard("[Space][Enter]");
      expect(action).not.toHaveBeenCalled();
      expect(button()).toHaveAttribute("aria-pressed", "false");
    });
  });

  renderBoth("sync action", (mode) => {
    it("calls pressedChangeAction(next, { event }) and flips (row 6)", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(button());
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.event).toBeInstanceOf(window.Event);
      expect(details.event?.type).toBe("click");
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectNotPending(button());
      expect(committed()).toHaveTextContent("true");

      await user.click(button());
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe(false);
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expect(committed()).toHaveTextContent("false");
    });

    it("disabled never dispatches, even through ref.click() (row 7)", async () => {
      const action = vi.fn<ActionFn>();
      const ref = { current: null as HTMLButtonElement | null };
      render(<Harness mode={mode} action={action} disabled ref={ref} />);
      const user = setupUser();

      await user.click(button());
      await act(async () => {
        ref.current!.click();
      });
      await act(async () => {
        fireEvent.click(ref.current!);
      });
      expect(action).not.toHaveBeenCalled();
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expect(committed()).toHaveTextContent("false");
    });
  });

  renderBoth("async action", (mode) => {
    it("shows optimistic state and data-pending until the action resolves (row 8)", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(button()).toHaveAttribute("data-pressed", "");
      expectPending(button());
      expect(committed()).toHaveTextContent("false");

      await act(async () => {
        d.resolve();
      });
      expectNotPending(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(committed()).toHaveTextContent("true");
    });

    it("awaits an action that resolves with data (non-void return, row 8)", async () => {
      const d = deferred<{ ok: boolean }>();
      const save = (_next: boolean): Promise<{ ok: boolean }> => d.promise;
      // Type-level: `(next) => save(next)` returns `Promise<{ ok }>`, which `Action` must accept.
      render(<Harness mode={mode} action={(next) => save(next)} />);
      const user = setupUser();

      await user.click(button());
      expectPending(button());
      await act(async () => {
        d.resolve({ ok: true });
      });
      expectNotPending(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(committed()).toHaveTextContent("true");
    });

    it("ignores a non-thenable return value (sync data, row 8)", async () => {
      render(<Harness mode={mode} action={() => 42} />);
      const user = setupUser();
      await user.click(button());
      expectNotPending(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(committed()).toHaveTextContent("true");
    });

    it("settles quietly when unmounted while pending (smoke test)", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const { unmount } = render(<Harness mode={mode} action={() => d.promise} />);
      const user = setupUser();

      await user.click(button());
      expectPending(button());
      unmount();
      await act(async () => {
        d.resolve();
      });
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the Error Boundary, reverts optimistic state, leaves committed state (row 9)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectPending(button());

      const err = new Error("save failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
      expect(committed()).toHaveTextContent("false");
    });

    it("treats a synchronous throw like a rejection (edge case)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn();
      const err = new Error("sync boom");
      render(
        <Harness
          mode={mode}
          action={() => {
            throw err;
          }}
          boundary={onError}
        />,
      );
      const user = setupUser();

      await user.click(button());
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(committed()).toHaveTextContent("false");
    });

    it("caught inside the action counts as success (row 10)", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();

      await user.click(button());
      expectPending(button());
      await act(async () => {
        d.reject(new Error("vetoed"));
      });

      expectNotPending(button());
      expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
      // The harness never adopted the value in either mode...
      expect(committed()).toHaveTextContent("false");
      // ...but only a controlled parent can veto: uncontrolled commits `true`.
      expect(button()).toHaveAttribute("aria-pressed", mode === "controlled" ? "false" : "true");
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

      await user.click(button());
      await user.click(button());
      expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expectPending(button());

      for (const i of order) {
        await act(async () => {
          deferreds[i]!.resolve();
        });
      }
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expectNotPending(button());
    });

    it("stays pending until every in-flight action settles (row 12)", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();

      await user.click(button());
      await user.click(button());
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expectPending(button());
      expect(button()).toHaveAttribute("aria-pressed", "false");

      await act(async () => {
        deferreds[0]!.resolve();
      });
      expectNotPending(button());
    });
  });

  renderBoth("superseded rejection", (mode) => {
    function renderTwoClicks(onError: (error: unknown) => void, count = 2) {
      const deferreds = Array.from({ length: count }, () => deferred());
      let calls = 0;
      const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
      render(<Harness mode={mode} action={action} boundary={onError} />);
      return { deferreds, action };
    }

    it("reaches the boundary when the older action rejects after the newer resolved (row 12a)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn();
      const { deferreds, action } = renderTwoClicks(onError);
      const user = setupUser();

      await user.click(button());
      await user.click(button());
      expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);

      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(onError).not.toHaveBeenCalled();
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

      const err = new Error("older save failed");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
      expect(committed()).toHaveTextContent("false");
    });

    it("reaches the boundary when the older action rejects while the newer is pending (row 12b)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn();
      const { deferreds } = renderTwoClicks(onError);
      const user = setupUser();

      await user.click(button());
      await user.click(button());
      expectPending(button());

      const err = new Error("older save failed");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");

      // The newer action's outcome is unaffected and nothing is thrown a second time.
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
      expect(committed()).toHaveTextContent("false");
    });

    it("keeps the first superseded error and reports later ones through reportError", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      const onError = vi.fn();
      const { deferreds } = renderTwoClicks(onError, 3);
      const user = setupUser();

      await user.click(button());
      await user.click(button());
      await user.click(button());

      const first = new Error("first");
      const second = new Error("second");
      await act(async () => {
        deferreds[0]!.reject(first);
        deferreds[1]!.reject(second);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(first);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(second);

      await act(async () => {
        deferreds[2]!.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it("ignores a superseded rejection after unmount (smoke test)", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const reportError = vi.fn();
      vi.stubGlobal("reportError", reportError);
      const onError = vi.fn();
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const { unmount } = render(
        <Harness mode={mode} action={() => deferreds[calls++]!.promise} boundary={onError} />,
      );
      const user = setupUser();

      await user.click(button());
      await user.click(button());
      unmount();
      await act(async () => {
        deferreds[0]!.reject(new Error("too late"));
        deferreds[1]!.resolve();
      });
      expect(onError).not.toHaveBeenCalled();
      expect(reportError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps old content, no fallback, pending while the new content loads (row 13)", async () => {
      const suspender = createSuspender();
      suspender.resolve("false");
      render(<Harness mode={mode} suspender={suspender} />);
      const user = setupUser();
      expect(screen.getByTestId("suspender")).toHaveTextContent("false");

      await user.click(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectPending(button());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(screen.getByTestId("suspender")).toHaveTextContent("false");
      expect(committed()).toHaveTextContent("false");

      await act(async () => {
        suspender.resolve("true");
      });
      expect(screen.getByTestId("suspender")).toHaveTextContent("true");
      expect(committed()).toHaveTextContent("true");
      expectNotPending(button());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });
  });

  describe("function props", () => {
    it("className, style and children receive the state (row 14)", async () => {
      const d = deferred();
      const className = vi.fn(
        (s: ToggleState) => `chip${s.pressed ? " on" : ""}${s.pending ? " busy" : ""}`,
      );
      const style = vi.fn((s: ToggleState) => ({ opacity: s.pending ? 0.5 : 1 }));
      const children = vi.fn((s: ToggleState) => (s.pending ? "Saving" : "Favorite"));
      render(
        <Toggle pressedChangeAction={() => d.promise} className={className} style={style}>
          {children}
        </Toggle>,
      );
      const user = setupUser();

      const initial: ToggleState = { pressed: false, pending: false, disabled: false };
      expect(className).toHaveBeenLastCalledWith(initial);
      expect(style).toHaveBeenLastCalledWith(initial);
      expect(children).toHaveBeenLastCalledWith(initial);
      expect(button()).toHaveClass("chip");
      expect(button()).toHaveStyle({ opacity: "1" });
      expect(button()).toHaveTextContent("Favorite");

      await user.click(button());
      const inFlight: ToggleState = { pressed: true, pending: true, disabled: false };
      expect(className).toHaveBeenLastCalledWith(inFlight);
      expect(style).toHaveBeenLastCalledWith(inFlight);
      expect(children).toHaveBeenLastCalledWith(inFlight);
      expect(button()).toHaveClass("chip", "on", "busy");
      expect(button()).toHaveStyle({ opacity: "0.5" });
      expect(button()).toHaveTextContent("Saving");
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectPending(button());

      await act(async () => {
        d.resolve();
      });
      expect(className).toHaveBeenLastCalledWith({
        pressed: true,
        pending: false,
        disabled: false,
      });
      expect(button()).toHaveClass("chip", "on");
      expect(button()).not.toHaveClass("busy");
    });

    it("state.disabled reflects the prop", () => {
      const children = vi.fn((s: ToggleState) => String(s.disabled));
      render(<Toggle disabled>{children}</Toggle>);
      expect(button()).toHaveTextContent("true");
    });
  });

  describe("render prop", () => {
    function MyButton({ ref, ...props }: ComponentPropsWithRef<"button">) {
      return <button ref={ref} data-my-button="" {...props} />;
    }

    it("element form merges props, forwards ref and keeps dispatching (row 15)", async () => {
      const action = vi.fn<ActionFn>();
      const order: string[] = [];
      const toggleRef = { current: null as HTMLButtonElement | null };
      const elementRef = { current: null as HTMLButtonElement | null };
      render(
        <Toggle
          ref={toggleRef}
          className="chip"
          style={{ opacity: 0.5, color: "blue" }}
          pressedChangeAction={(next, details) => {
            order.push("library");
            action(next, details);
          }}
          render={
            <MyButton
              ref={elementRef}
              className="x"
              style={{ color: "red" }}
              onClick={() => order.push("element")}
            />
          }
        >
          Favorite
        </Toggle>,
      );
      const user = setupUser();

      const el = screen.getByRole("button", { name: "Favorite" });
      expect(el).toHaveAttribute("data-my-button", "");
      expect(el).toHaveClass("chip", "x");
      expect(el).toHaveStyle({ color: "rgb(255, 0, 0)", opacity: "0.5" });
      expect(el).toHaveAttribute("aria-pressed", "false");
      expect(toggleRef.current).toBe(el);
      expect(elementRef.current).toBe(el);

      await user.click(el);
      expect(order).toEqual(["element", "library"]);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(action.mock.calls[0]?.[1].event).toBeInstanceOf(Event);
      expect(el).toHaveAttribute("aria-pressed", "true");
      expect(el).toHaveAttribute("data-pressed", "");
    });

    it("element form lets library-controlled attributes win", () => {
      render(
        <Toggle pressed render={<button aria-pressed="false" data-pressed="nope" id="mine" />}>
          Favorite
        </Toggle>,
      );
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(button()).toHaveAttribute("data-pressed", "");
      expect(button()).toHaveAttribute("id", "mine");
    });

    it("element form cannot override disabled: native disabled and data-disabled agree", async () => {
      const action = vi.fn();
      const { rerender } = render(
        <Toggle disabled pressedChangeAction={action} render={<button disabled={false} />}>
          Favorite
        </Toggle>,
      );
      expect(button()).toBeDisabled();
      expect(button()).toHaveAttribute("data-disabled", "");
      await act(async () => {
        button().click();
      });
      expect(action).not.toHaveBeenCalled();

      rerender(
        <Toggle pressedChangeAction={action} render={<button disabled />}>
          Favorite
        </Toggle>,
      );
      expect(button()).toBeEnabled();
      expect(button()).not.toHaveAttribute("data-disabled");
      await setupUser().click(button());
      expect(action).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["a link", <a key="link" href="#x" />],
      ["a component", <MyButton key="component" />],
    ] as const)(
      "disabled with %s render: aria-disabled, no native disabled, the click is cancelled (#83)",
      async (_, element) => {
        const action = vi.fn();
        render(
          <Toggle disabled pressedChangeAction={action} render={element}>
            Favorite
          </Toggle>,
        );
        const el = screen.getByText("Favorite");
        expect(el).toHaveAttribute("aria-disabled", "true");
        expect(el).not.toHaveAttribute("disabled");
        expect(el).toHaveAttribute("data-disabled", "");
        expect(el).toHaveAttribute("aria-pressed", "false");
        expect(fireEvent.click(el)).toBe(false); // cancelled: a link does not navigate
        await setupUser().click(el);
        expect(action).not.toHaveBeenCalled();
        expect(el).toHaveAttribute("aria-pressed", "false");
      },
    );

    it("disabled with a host <button> render or none: native disabled, no aria-disabled (#83)", () => {
      render(
        <>
          <Toggle disabled render={<button />}>
            A
          </Toggle>
          <Toggle disabled>B</Toggle>
        </>,
      );
      for (const name of ["A", "B"]) {
        const el = screen.getByRole("button", { name });
        expect(el).toBeDisabled();
        expect(el).not.toHaveAttribute("aria-disabled");
      }
    });

    it("element form cannot re-introduce an owned attribute the library left off", async () => {
      const d = deferred();
      render(
        <Toggle
          pressedChangeAction={() => d.promise}
          render={<button data-pressed="nope" data-pending="nope" data-disabled="nope" />}
        >
          Favorite
        </Toggle>,
      );
      const user = setupUser();
      // Library-controlled keys are owned (conventions 1.2): absent, not "nope".
      expect(button()).not.toHaveAttribute("data-pressed");
      expect(button()).not.toHaveAttribute("data-pending");
      expect(button()).not.toHaveAttribute("data-disabled");

      await user.click(button());
      expect(button()).toHaveAttribute("data-pressed", "");
      expectPending(button());
      await act(async () => {
        d.resolve();
      });
      expect(button()).not.toHaveAttribute("data-pending");
    });

    it("element form lets the element win over pass-through props and merges id lists", () => {
      render(
        <Toggle
          aria-label="From Toggle"
          aria-describedby="toggle-desc"
          data-kind="toggle"
          title="toggle"
          render={
            <button
              type="submit"
              aria-label="From element"
              aria-describedby="el-desc toggle-desc"
              data-kind="element"
            />
          }
        >
          Favorite
        </Toggle>,
      );
      const el = screen.getByRole("button", { name: "From element" });
      expect(el).toHaveAttribute("aria-describedby", "el-desc toggle-desc");
      expect(el).toHaveAttribute("data-kind", "element");
      expect(el).toHaveAttribute("title", "toggle");
      // The element's own `type` wins (design section 3); the default is still "button".
      expect(el).toHaveAttribute("type", "submit");
    });

    it('type="button" only when the rendered element is a button', () => {
      render(
        <>
          <Toggle render={<a href="#" />}>Link</Toggle>
          <Toggle render={<button />}>Button</Toggle>
          <Toggle render={<span tabIndex={0} />}>Span</Toggle>
        </>,
      );
      const link = screen.getByText("Link");
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("type");
      expect(link).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("Span")).not.toHaveAttribute("type");
      expect(screen.getByRole("button", { name: "Button" })).toHaveAttribute("type", "button");
    });

    it('a component render element gets type="button" and does not submit a form (conventions 1.2)', async () => {
      function MyButton(props: ComponentPropsWithRef<"button">) {
        return <button {...props} className="my" />;
      }
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      render(
        <form
          ref={(form) => {
            form?.addEventListener("submit", onSubmit);
          }}
        >
          <Toggle render={<MyButton />}>Mine</Toggle>
        </form>,
      );
      const el = screen.getByRole("button", { name: "Mine" });
      expect(el).toHaveClass("my");
      expect(el).toHaveAttribute("type", "button");
      await setupUser().click(el);
      expect(el).toHaveAttribute("aria-pressed", "true");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("function form receives (props, state) (row 16)", async () => {
      const d = deferred();
      const renderFn = vi.fn((props: ComponentPropsWithRef<"button">, state: ToggleState) => (
        <button {...props} aria-busy={state.pending || undefined}>
          {state.pressed ? "On" : "Off"}
        </button>
      ));
      render(<Toggle pressedChangeAction={() => d.promise} render={renderFn} />);
      const user = setupUser();

      expect(button()).toHaveTextContent("Off");
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "button", "aria-pressed": false }),
        { pressed: false, pending: false, disabled: false },
      );

      await user.click(button());
      expect(button()).toHaveTextContent("On");
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expect(button()).toHaveAttribute("aria-busy", "true");
      expectPending(button());

      await act(async () => {
        d.resolve();
      });
      expect(button()).not.toHaveAttribute("aria-busy");
      expectNotPending(button());
    });
  });

  describe("post-await rule (row 17)", () => {
    function Parent({
      promise,
      wrap,
      children = "Favorite",
    }: { promise: Promise<void>; wrap: boolean } & Pick<ToggleProps, "children">) {
      const [pressed, setPressed] = useState(false);
      return (
        <Toggle
          pressed={pressed}
          pressedChangeAction={async (next) => {
            await promise;
            if (wrap) startTransition(() => setPressed(next));
            else setPressed(next);
          }}
        >
          {children}
        </Toggle>
      );
    }

    it("aria-pressed and data-pending converge in one commit with startTransition", async () => {
      const d = deferred();
      // A layout effect inside `children` runs after every commit of the Toggle, so it sees each
      // intermediate commit (a MutationObserver would coalesce commits made in the same task).
      const snapshots: { pressed: string | null; pending: boolean }[] = [];
      function Recorder() {
        const ref = useRef<HTMLSpanElement>(null);
        useLayoutEffect(() => {
          // Own ref rather than the Toggle's: a child's layout effect runs before the parent's
          // ref is attached within the same commit.
          const el = ref.current!.closest("button")!;
          snapshots.push({
            pressed: el.getAttribute("aria-pressed"),
            pending: el.hasAttribute("data-pending"),
          });
        });
        return <span ref={ref}>Favorite</span>;
      }
      render(
        <Parent promise={d.promise} wrap>
          {() => <Recorder />}
        </Parent>,
      );
      const user = setupUser();
      expect(snapshots).toEqual([{ pressed: "false", pending: false }]);

      await user.click(button());
      expect(snapshots.at(-1)).toEqual({ pressed: "true", pending: true });
      const afterClick = snapshots.length;
      await act(async () => {
        d.resolve();
      });

      expect(snapshots.length).toBeGreaterThan(afterClick);
      expect(snapshots.at(-1)).toEqual({ pressed: "true", pending: false });
      // No commit after the click ever showed the old value again.
      expect(snapshots.slice(1).every((s) => s.pressed === "true")).toBe(true);
    });

    it("still ends in the right state without startTransition (documented limitation)", async () => {
      const d = deferred();
      render(<Parent promise={d.promise} wrap={false} />);
      const user = setupUser();

      await user.click(button());
      await act(async () => {
        d.resolve();
      });
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectNotPending(button());
    });
  });

  describe("controlled edge cases", () => {
    it("snaps back when the parent never adopts the value (veto)", async () => {
      const d = deferred();
      render(
        <Toggle pressed={false} pressedChangeAction={() => d.promise}>
          Favorite
        </Toggle>,
      );
      const user = setupUser();

      await user.click(button());
      expect(button()).toHaveAttribute("aria-pressed", "true");
      expectPending(button());
      await act(async () => {
        d.resolve();
      });
      expect(button()).toHaveAttribute("aria-pressed", "false");
      expect(button()).not.toHaveAttribute("data-pressed");
      expectNotPending(button());
    });

    it("rebases the optimistic value when `pressed` changes externally while pending", async () => {
      const d = deferred();
      function Parent() {
        const [pressed, setPressed] = useState(false);
        return (
          <>
            <Toggle pressed={pressed} pressedChangeAction={() => d.promise}>
              Favorite
            </Toggle>
            <button type="button" data-testid="external" onClick={() => setPressed(true)}>
              set pressed
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      const toggle = screen.getByRole("button", { name: "Favorite" });

      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      await user.click(screen.getByTestId("external"));
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expectPending(toggle);
      await act(async () => {
        d.resolve();
      });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expectNotPending(toggle);
    });
  });

  describe("transition prop (row 18)", () => {
    it("renders the same markup with and without `transition`", () => {
      const plain = render(<Toggle defaultPressed>Favorite</Toggle>).container.innerHTML;
      const str = render(
        <Toggle defaultPressed transition="fsui-fade">
          Favorite
        </Toggle>,
      ).container.innerHTML;
      const map = render(
        <Toggle
          defaultPressed
          transition={{
            "fsui-toggle-press": "pop",
            "fsui-toggle-release": "fade",
            default: "none",
          }}
        >
          Favorite
        </Toggle>,
      ).container.innerHTML;
      expect(str).toBe(plain);
      expect(map).toBe(plain);
    });

    it("still dispatches with a transition set", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Toggle transition="fsui-fade" pressedChangeAction={action}>
          Favorite
        </Toggle>,
      );
      const user = setupUser();
      await user.click(button());
      expect(action).toHaveBeenCalledWith(true, expect.anything());
      expect(button()).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("details (row 21)", () => {
    it("exposes `event` as a virtual, non-own property", async () => {
      const action = vi.fn<ActionFn>();
      render(<Toggle pressedChangeAction={action}>Favorite</Toggle>);
      const user = setupUser();

      await user.click(button());
      const details = action.mock.calls[0]![1];
      expect(details.event).toBeInstanceOf(window.Event);
      expect(details.event?.type).toBe("click");
      expect("event" in details).toBe(true);
      expect(Object.keys(details)).not.toContain("event");
      expect({ ...details }).not.toHaveProperty("event");
      expect(JSON.stringify(details)).toBe(JSON.stringify({}));
      expect(Object.isExtensible(details)).toBe(true);
    });

    it("can be passed straight to a Server-Function-shaped action", async () => {
      // A Server Function is just an async function to the library; it receives `(next, details)`
      // and the serialiser only ever sees the real fields.
      const serverFn = vi.fn(async (_next: boolean, _details: TogglePressedChangeDetails) => {});
      render(<Toggle pressedChangeAction={serverFn}>Favorite</Toggle>);
      const user = setupUser();

      await user.click(button());
      expect(serverFn).toHaveBeenCalledTimes(1);
      const [next, details] = serverFn.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.event).toBeInstanceOf(window.Event);
      expect(JSON.parse(JSON.stringify([next, details]))).toEqual([true, {}]);
      expect(button()).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("dev warnings (row 19)", () => {
    it("warns once when pressed and defaultPressed are both set", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = render(
        <Toggle pressed defaultPressed>
          Favorite
        </Toggle>,
      );
      rerender(
        <Toggle pressed defaultPressed>
          Favorite
        </Toggle>,
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/both `pressed` and `defaultPressed`/);
    });

    it("warns once when switching from uncontrolled to controlled", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = render(<Toggle>Favorite</Toggle>);
      expect(consoleError).not.toHaveBeenCalled();
      rerender(<Toggle pressed>Favorite</Toggle>);
      rerender(<Toggle pressed={false}>Favorite</Toggle>);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/uncontrolled to controlled/);
    });

    it("does not warn in normal use", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = render(<Toggle defaultPressed>Favorite</Toggle>);
      const user = setupUser();
      await user.click(button());
      rerender(<Toggle defaultPressed={false}>Favorite</Toggle>);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  it("attaches a consumer ref that may return a cleanup", () => {
    const cleanup = vi.fn();
    const refFn = vi.fn((_node: HTMLButtonElement) => cleanup);
    const { unmount } = render(<Toggle ref={refFn}>Favorite</Toggle>);
    expect(refFn).toHaveBeenCalledWith(button());
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("merges a consumer object ref with the library's internal ref handling", () => {
    const ref = { current: null as HTMLButtonElement | null };
    const { unmount } = render(<Toggle ref={ref}>Favorite</Toggle>);
    expect(ref.current?.tagName).toBe("BUTTON");
    unmount();
    expect(ref.current).toBeNull();
  });
});
