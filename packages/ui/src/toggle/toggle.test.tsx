import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

type ActionFn = (next: boolean, details: TogglePressedChangeDetails) => void | Promise<void>;

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

afterEach(() => {
  vi.restoreAllMocks();
});

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
      const { rerender } = render(<Toggle defaultPressed>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "true");
      rerender(<Toggle pressed={false}>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "false");
      rerender(<Toggle pressed>Favorite</Toggle>);
      expect(button()).toHaveAttribute("aria-pressed", "true");
    });

    it("emits boolean data attributes by presence (row 2)", () => {
      const { rerender } = render(<Toggle>Favorite</Toggle>);
      expect(button()).not.toHaveAttribute("data-pressed");
      expect(button()).not.toHaveAttribute("data-pending");
      expect(button()).not.toHaveAttribute("data-disabled");
      expect(button()).not.toBeDisabled();

      rerender(
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

    it("keeps working after unmounting while pending (edge case)", async () => {
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
      expect(action).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ event: expect.any(Event) }),
      );
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
    function Parent({ promise, wrap }: { promise: Promise<void>; wrap: boolean }) {
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
          Favorite
        </Toggle>
      );
    }

    it("aria-pressed and data-pending converge in one commit with startTransition", async () => {
      const d = deferred();
      render(<Parent promise={d.promise} wrap />);
      const user = setupUser();
      const el = button();
      const snapshots: { pressed: string | null; pending: boolean }[] = [];
      const observer = new MutationObserver(() => {
        snapshots.push({
          pressed: el.getAttribute("aria-pressed"),
          pending: el.hasAttribute("data-pending"),
        });
      });
      observer.observe(el, { attributes: true });

      await user.click(el);
      await act(async () => {
        d.resolve();
      });
      observer.disconnect();

      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(snapshots[0]).toEqual({ pressed: "true", pending: true });
      expect(snapshots.at(-1)).toEqual({ pressed: "true", pending: false });
      // No commit ever showed the old value again.
      expect(snapshots.every((s) => s.pressed === "true")).toBe(true);
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
