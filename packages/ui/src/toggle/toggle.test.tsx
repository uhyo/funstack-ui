// Toggle tests (design/components/toggle.md section 11). The action-prop rows (sync and async
// actions, rejection, overlap, superseded rejection, suspending content, the post-await rule, the
// controlled veto, `transition`, details, dev warnings) come from the shared value-action suite
// (__tests__/value-action-suite.tsx, driver __tests__/drivers/toggle.tsx); the transition types
// are in toggle-transition-types.test.tsx. This file keeps the Toggle-specific rows.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  deferred,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
} from "../__tests__/helpers.js";
import { toggleDriver } from "../__tests__/drivers/toggle.js";
import { describeValueAction, ValueHarness } from "../__tests__/value-action-suite.js";
import { Toggle } from "./toggle.js";
import type { ToggleState, TogglePressedChangeDetails } from "./toggle.js";

type ActionFn = (next: boolean, details: TogglePressedChangeDetails) => unknown;

const button = () => screen.getByRole("button");
const committed = () => screen.getByTestId("committed");

describeValueAction(toggleDriver);

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
    it("disabled never dispatches, even through ref.click() (row 7)", async () => {
      const action = vi.fn<ActionFn>();
      const ref = { current: null as HTMLButtonElement | null };
      render(
        <ValueHarness
          driver={toggleDriver}
          mode={mode}
          action={action}
          extra={{ disabled: true, ref }}
        />,
      );
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

    it("a host <button> render keeps its own aria-disabled: the key is not owned there (#83)", () => {
      render(
        <>
          <Toggle render={<button aria-disabled="true" />}>A</Toggle>
          <Toggle disabled render={<button aria-disabled="true" />}>
            B
          </Toggle>
        </>,
      );
      expect(screen.getByRole("button", { name: "A" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("button", { name: "B" })).toHaveAttribute("aria-disabled", "true");
    });

    it("a component render gets `disabled` owned as absent: an own undefined key (#83)", () => {
      const received: ComponentPropsWithRef<"button">[] = [];
      function Spy(props: ComponentPropsWithRef<"button">) {
        received.push(props);
        return <button {...props} />;
      }
      render(
        <Toggle disabled render={<Spy disabled />}>
          Favorite
        </Toggle>,
      );
      const props = received.at(-1)!;
      expect(Object.hasOwn(props, "disabled")).toBe(true);
      expect(props.disabled).toBeUndefined();
      expect(props["aria-disabled"]).toBe(true);
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

  describe("controlled edge cases", () => {
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
