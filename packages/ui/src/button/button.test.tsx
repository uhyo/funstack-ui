// Button tests (jsdom), mapped to design/components/button.md section 13 (rows 1-19; row 20 is in
// src/__tests__/directives.test.ts, rows 21-26 in button.browser.test.tsx).
//
// Button: no controlled state, so the controlled-parity, optimistic, platform-path, urgent-action,
// continuous-control and inside-a-Field rows are N/A; the overlap and superseded-rejection rows
// are N/A because the re-entry guard means a Button never has two of its own runs in flight
// (rows 5 and 6 replace them).
import { act, render, screen } from "@testing-library/react";
import { createRef, startTransition, Suspense, useState, useTransition } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  setupUser,
} from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Form } from "../form/index.js";
import * as root from "../index.js";
import { Toggle } from "../toggle/index.js";
import { Toolbar } from "../toolbar/index.js";
import { Button } from "./index.js";
import type { ButtonActionDetails, ButtonProps, ButtonState } from "./index.js";

const button = (name: string) => screen.getByRole("button", { name });

/** Dispatches a cancelable click on `el` inside `act` and returns it. */
function click(el: Element): MouseEvent {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

/**
 * Records `defaultPrevented` of every click once it has bubbled past React's root listener (a
 * document listener runs after it), including the clicks user-event synthesises for Enter and
 * Space.
 */
function recordClicks(): boolean[] {
  const seen: boolean[] = [];
  const listener = (event: Event) => seen.push(event.defaultPrevented);
  document.addEventListener("click", listener);
  cleanups.push(() => document.removeEventListener("click", listener));
  return seen;
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

describe("Button", () => {
  describe("roles and ARIA (row 1)", () => {
    it('renders <button type="button"> with no role and no state attributes', () => {
      render(<Button>Save</Button>);
      const el = button("Save");
      expect(el.tagName).toBe("BUTTON");
      expect(el).toHaveAttribute("type", "button");
      expect(el).not.toHaveAttribute("role");
      expect(el).not.toHaveAttribute("aria-disabled");
      expect(el).not.toHaveAttribute("data-pending");
      expect(el).not.toHaveAttribute("data-disabled");
      expect(el).not.toBeDisabled();
    });

    it('type is "submit" with a function formAction; a consumer type wins', () => {
      render(
        <form>
          <Button formAction={() => {}}>A</Button>
          <Button formAction="/go">B</Button>
          <Button type="submit">C</Button>
          <Button type="reset">D</Button>
          <Button formAction={() => {}} type="submit">
            E
          </Button>
        </form>,
      );
      expect(button("A")).toHaveAttribute("type", "submit");
      expect(button("B")).toHaveAttribute("type", "submit");
      expect(button("C")).toHaveAttribute("type", "submit");
      expect(button("D")).toHaveAttribute("type", "reset");
      expect(button("E")).toHaveAttribute("type", "submit");
    });

    it("a component render element gets type=button and does not submit a form (review item 2)", async () => {
      function MyButton(props: ComponentPropsWithRef<"button">) {
        return <button {...props} className="my" />;
      }
      const action = vi.fn();
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      render(
        <form
          ref={(form) => {
            form?.addEventListener("submit", onSubmit);
          }}
        >
          <Button action={action} render={<MyButton />}>
            Mine
          </Button>
        </form>,
      );
      expect(button("Mine")).toHaveAttribute("type", "button");
      await setupUser().click(button("Mine"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("disabled on a component render element: aria-disabled, no disabled (review fold F1)", async () => {
      function MyButton(props: ComponentPropsWithRef<"button">) {
        return <button {...props} />;
      }
      const action = vi.fn();
      render(
        <Button disabled action={action} render={<MyButton />}>
          Mine
        </Button>,
      );
      expect(button("Mine")).toHaveAttribute("aria-disabled", "true");
      expect(button("Mine")).not.toBeDisabled();
      expect(button("Mine")).toHaveAttribute("data-disabled", "");
      await setupUser().click(button("Mine"));
      expect(click(button("Mine")).defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });

    it("a link gets no type; a render <button type=submit> is overridden (owned)", () => {
      render(
        <>
          <Button render={<a href="#go" />}>Link</Button>
          <Button render={<button type="submit" />}>Owned</Button>
        </>,
      );
      expect(screen.getByText("Link").tagName).toBe("A");
      expect(screen.getByText("Link")).not.toHaveAttribute("type");
      expect(button("Owned")).toHaveAttribute("type", "button");
    });

    it("disabled: native disabled + data-disabled, no aria-disabled", () => {
      render(<Button disabled>Off</Button>);
      expect(button("Off")).toBeDisabled();
      expect(button("Off")).toHaveAttribute("data-disabled", "");
      expect(button("Off")).not.toHaveAttribute("aria-disabled");
    });

    it("focusableWhenDisabled: aria-disabled, no native disabled, data-disabled", () => {
      render(
        <Button disabled focusableWhenDisabled render={<button disabled />}>
          Off
        </Button>,
      );
      expect(button("Off")).toHaveAttribute("aria-disabled", "true");
      expect(button("Off")).not.toBeDisabled();
      expect(button("Off")).toHaveAttribute("data-disabled", "");
      // focusableWhenDisabled alone (not disabled) changes nothing.
    });

    it("a disabled non-<button> render element is aria-disabled, without disabled", () => {
      const action = vi.fn();
      render(
        <Button disabled action={action} render={<a href="#x" />}>
          Link
        </Button>,
      );
      const link = screen.getByText("Link");
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).not.toHaveAttribute("disabled");
      expect(link).toHaveAttribute("data-disabled", "");
      expect(click(link).defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });

    it("focusableWhenDisabled without disabled renders no aria-disabled", () => {
      render(<Button focusableWhenDisabled>On</Button>);
      expect(button("On")).not.toHaveAttribute("aria-disabled");
      expect(button("On")).not.toHaveAttribute("data-disabled");
    });

    it("aria-disabled is not a prop, and a render element's is removed (owned)", () => {
      // Not in ButtonProps (row 18). JSX does not type-check hyphenated attributes, so a stray
      // one is passed through and then removed by the owned key.
      render(<Button {...{ "aria-disabled": true }}>Typed</Button>);
      expect(button("Typed")).not.toHaveAttribute("aria-disabled");
      render(<Button render={<button aria-disabled="true" />}>Owned</Button>);
      expect(button("Owned")).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("sync action (row 2)", () => {
    it("click, Enter and Space each call action once with the native event", async () => {
      const action = vi.fn<(d: ButtonActionDetails) => void>();
      render(<Button action={action}>Go</Button>);
      const user = setupUser();
      await user.click(button("Go"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![0].event).toBeInstanceOf(MouseEvent);
      expect(action.mock.calls[0]![0].event?.type).toBe("click");
      button("Go").focus();
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(2);
      await user.keyboard(" ");
      expect(action).toHaveBeenCalledTimes(3);
      expect(action.mock.calls[2]![0].event?.type).toBe("click");
    });

    it("disabled (both spellings) never dispatches; a disabled link click is cancelled", async () => {
      const action = vi.fn();
      render(
        <>
          <Button action={action} disabled>
            Native
          </Button>
          <Button action={action} disabled focusableWhenDisabled>
            Focusable
          </Button>
          <Button action={action} disabled render={<a href="#no" />}>
            Link
          </Button>
        </>,
      );
      const user = setupUser();
      await user.click(button("Native"));
      await user.click(button("Focusable"));
      button("Focusable").focus();
      await user.keyboard("{Enter} ");
      expect(click(button("Focusable")).defaultPrevented).toBe(true);
      expect(click(screen.getByText("Link")).defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
    });

    it("a Button without action starts no transition", () => {
      render(<Button>Plain</Button>);
      const event = click(button("Plain"));
      expect(event.defaultPrevented).toBe(false);
      expectNotPending(button("Plain"));
      expect(button("Plain")).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("async action (row 3)", () => {
    it("data-pending and aria-disabled while it runs; focus stays; then all invert", async () => {
      const d = deferred();
      const states: ButtonState[] = [];
      render(
        <Button action={() => d.promise}>
          {(s) => {
            states.push(s);
            return s.pending ? "Saving" : "Save";
          }}
        </Button>,
      );
      const user = setupUser();
      await user.click(button("Save"));
      const el = button("Saving");
      expectPending(el);
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).not.toHaveAttribute("data-disabled");
      expect(el).not.toBeDisabled();
      expect(states.at(-1)).toEqual({ pending: true, disabled: false });
      expect(document.activeElement).toBe(el);
      await act(async () => {
        d.resolve();
      });
      expectNotPending(button("Save"));
      expect(button("Save")).not.toHaveAttribute("aria-disabled");
      expect(states.at(-1)).toEqual({ pending: false, disabled: false });
      expect(document.activeElement).toBe(button("Save"));
    });
  });

  describe("rejection (row 4)", () => {
    it("reaches the boundary above the Button", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      render(
        <>
          <ErrorCatcher onError={onError}>
            <Button action={() => d.promise}>Go</Button>
          </ErrorCatcher>
          <Button>Other</Button>
        </>,
      );
      await setupUser().click(button("Go"));
      const err = new Error("failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("failed");
      expectNotPending(button("Other"));
    });

    it("caught inside: the action resolves and the next click runs (no stuck guard)", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn(async () => {
        try {
          await deferreds[calls++]!.promise;
        } catch {
          // The consumer's inline error.
        }
      });
      render(<Button action={action}>Go</Button>);
      const user = setupUser();
      await user.click(button("Go"));
      await act(async () => {
        deferreds[0]!.reject(new Error("x"));
      });
      expectNotPending(button("Go"));
      await user.click(button("Go"));
      expect(action).toHaveBeenCalledTimes(2);
      expectPending(button("Go"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expectNotPending(button("Go"));
    });
  });

  describe("re-entry (row 5)", () => {
    it("a second click, Enter and Space while pending are ignored and cancelled", async () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      render(<Button action={action}>Go</Button>);
      const clicks = recordClicks();
      const user = setupUser();
      await user.click(button("Go"));
      expect(clicks).toEqual([false]);
      await user.click(button("Go"));
      button("Go").focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(action).toHaveBeenCalledTimes(1);
      expect(clicks).toEqual([false, true, true, true]);
      expect(button("Go")).toHaveAttribute("aria-disabled", "true");
      await act(async () => {
        d.resolve();
      });
      await user.click(button("Go"));
      expect(action).toHaveBeenCalledTimes(2);
      expect(clicks.at(-1)).toBe(false);
    });

    it("two clicks in one task call the action once (the in-flight counter)", () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      render(<Button action={action}>Go</Button>);
      let second!: MouseEvent;
      act(() => {
        button("Go").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        second = new MouseEvent("click", { bubbles: true, cancelable: true });
        button("Go").dispatchEvent(second);
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(second.defaultPrevented).toBe(true);
    });

    it("a rendered link's second click while pending is cancelled, the first was not", async () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      render(
        <Button action={action} render={<a href="#go" />}>
          Link
        </Button>,
      );
      const link = screen.getByText("Link");
      expect(click(link).defaultPrevented).toBe(false);
      expect(click(link).defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
    });

    it("with commandfor / command present, the second click is cancelled", async () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      render(
        <Button action={action} commandfor="p" command="toggle-popover">
          Go
        </Button>,
      );
      expect(button("Go")).toHaveAttribute("commandfor", "p");
      expect(button("Go")).toHaveAttribute("command", "toggle-popover");
      expect(click(button("Go")).defaultPrevented).toBe(false);
      expect(click(button("Go")).defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
    });
  });

  describe("settled-but-held commit (row 6)", () => {
    function Other({ other }: { other: { promise: Promise<void> } }) {
      const [pending, start] = useTransition();
      return (
        <button
          type="button"
          data-pending={pending ? "" : undefined}
          onClick={() =>
            start(async () => {
              await other.promise;
            })
          }
        >
          Other
        </button>
      );
    }

    it("a click in the held window runs the action again (the guard is the in-flight counter)", async () => {
      const other = deferred();
      const mine = deferred();
      const action = vi.fn(() => mine.promise);
      render(
        <>
          <Other other={other} />
          <Button action={action}>Go</Button>
        </>,
      );
      const user = setupUser();
      await user.click(button("Other"));
      await user.click(button("Go"));
      await act(async () => {
        mine.resolve();
      });
      // React holds the commit that ends the Button's transition until every async action is done:
      // the Button still looks pending, but its own run has settled.
      expectPending(button("Go"));
      expect(button("Go")).toHaveAttribute("aria-disabled", "true");
      let event!: MouseEvent;
      await act(async () => {
        event = new MouseEvent("click", { bubbles: true, cancelable: true });
        button("Go").dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(action).toHaveBeenCalledTimes(2);
      await act(async () => {
        other.resolve();
      });
      expectNotPending(button("Go"));
      expectNotPending(button("Other"));
      expect(button("Go")).not.toHaveAttribute("aria-disabled");
    });

    it("a non-awaiting action counts every click under an unrelated pending action", async () => {
      const other = deferred();
      const increment = vi.fn();
      render(
        <>
          <Other other={other} />
          <Button
            action={() => {
              increment();
            }}
          >
            +1
          </Button>
        </>,
      );
      const user = setupUser();
      await user.click(button("Other"));
      await user.click(button("+1"));
      await user.click(button("+1"));
      await user.click(button("+1"));
      expect(increment).toHaveBeenCalledTimes(3);
      // The held commit keeps the attributes until the unrelated action settles.
      expectPending(button("+1"));
      await act(async () => {
        other.resolve();
      });
      expectNotPending(button("+1"));
    });
  });

  describe("two Buttons (row 7)", () => {
    it("A pending does not block B; both clear after both resolve", async () => {
      const da = deferred();
      const db = deferred();
      const a = vi.fn(() => da.promise);
      const b = vi.fn(() => db.promise);
      render(
        <>
          <Button action={a}>A</Button>
          <Button action={b}>B</Button>
        </>,
      );
      const user = setupUser();
      await user.click(button("A"));
      await user.click(button("B"));
      expect(b).toHaveBeenCalledTimes(1);
      expectPending(button("A"));
      expectPending(button("B"));
      await act(async () => {
        da.resolve();
      });
      await act(async () => {
        db.resolve();
      });
      expectNotPending(button("A"));
      expectNotPending(button("B"));
    });
  });

  describe("suspending content (row 8)", () => {
    it("old content stays, data-pending stays until it resolves; a click meanwhile runs again", async () => {
      const suspender = createSuspender();
      suspender.resolve("a");
      const action = vi.fn();
      function App() {
        const [value, setValue] = useState("a");
        return (
          <>
            <Button
              action={() => {
                action();
                setValue("b");
              }}
            >
              Go
            </Button>
            <Suspense fallback={<span data-testid="fallback" />}>
              <suspender.Suspender value={value} />
            </Suspense>
          </>
        );
      }
      render(<App />);
      const user = setupUser();
      await user.click(button("Go"));
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");
      expect(screen.queryByTestId("fallback")).toBeNull();
      expectPending(button("Go"));
      // The action itself settled; only the render suspends, so the guard (the in-flight counter)
      // is clear and a click starts a new run (design walkthrough 7).
      let event!: MouseEvent;
      await act(async () => {
        event = new MouseEvent("click", { bubbles: true, cancelable: true });
        button("Go").dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(action).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("suspender")).toHaveTextContent("a");
      await act(async () => {
        suspender.resolve("b");
      });
      expect(screen.getByTestId("suspender")).toHaveTextContent("b");
      expectNotPending(button("Go"));
    });
  });

  describe("function props and render (row 9)", () => {
    it("className / style / children receive the state and agree with the attributes", async () => {
      const d = deferred();
      render(
        <Button
          action={() => d.promise}
          className={(s) => (s.pending ? "is-pending" : "idle")}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
        >
          {(s) => (s.pending ? "Saving" : "Save")}
        </Button>,
      );
      expect(button("Save")).toHaveClass("idle");
      await setupUser().click(button("Save"));
      const el = button("Saving");
      expect(el).toHaveClass("is-pending");
      expect(el.style.opacity).toBe("0.5");
      expectPending(el);
      await act(async () => {
        d.resolve();
      });
    });

    it("element render merges className / style, keeps dispatch and guard, forwards ref", async () => {
      const d = deferred();
      const action = vi.fn(() => d.promise);
      const ref = createRef<HTMLButtonElement>();
      const elementRef = createRef<HTMLButtonElement>();
      render(
        <Button
          ref={ref}
          action={action}
          className="mine"
          style={{ color: "red" }}
          render={<button ref={elementRef} className="el" style={{ margin: "1px" }} />}
        >
          Go
        </Button>,
      );
      const el = button("Go");
      expect(el).toHaveClass("mine", "el");
      expect(el.style.color).toBe("red");
      expect(el.style.margin).toBe("1px");
      expect(ref.current).toBe(el);
      expect(elementRef.current).toBe(el);
      click(el);
      expect(click(el).defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
    });

    it("function render gets (props, state); a component that spreads props works", async () => {
      const action = vi.fn();
      const render2 = vi.fn((props: ComponentPropsWithRef<"button">, state: ButtonState) => (
        <button {...props} data-state={state.pending ? "p" : "i"} />
      ));
      function MyButton(props: ComponentPropsWithRef<"button">) {
        return <button {...props} className="my" />;
      }
      render(
        <>
          <Button action={action} render={render2}>
            Fn
          </Button>
          <Button action={action} render={<MyButton />}>
            Mine
          </Button>
        </>,
      );
      expect(button("Fn")).toHaveAttribute("type", "button");
      expect(button("Fn")).toHaveAttribute("data-state", "i");
      expect(render2.mock.calls[0]![1]).toEqual({ pending: false, disabled: false });
      expect(button("Mine")).toHaveClass("my");
      const user = setupUser();
      await user.click(button("Fn"));
      await user.click(button("Mine"));
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("pass-through onFocus / onPointerEnter / onKeyDown fire while pending", async () => {
      const d = deferred();
      const onFocus = vi.fn();
      const onPointerEnter = vi.fn();
      const onKeyDown = vi.fn();
      render(
        <>
          <button type="button">elsewhere</button>
          <Button
            action={() => d.promise}
            onFocus={onFocus}
            onPointerEnter={onPointerEnter}
            onKeyDown={onKeyDown}
          >
            Go
          </Button>
        </>,
      );
      const user = setupUser();
      await user.click(button("Go"));
      expectPending(button("Go"));
      onFocus.mockClear();
      onPointerEnter.mockClear();
      act(() => button("elsewhere").focus());
      await user.unhover(button("Go"));
      await user.hover(button("Go"));
      act(() => button("Go").focus());
      await user.keyboard("a");
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onPointerEnter).toHaveBeenCalledTimes(1);
      expect(onKeyDown).toHaveBeenCalled();
      await act(async () => {
        d.resolve();
      });
    });
  });

  describe("consumer state after await (row 10)", () => {
    it("commits once per accepted click", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      function Counter() {
        const [count, setCount] = useState(0);
        return (
          <>
            <Button
              action={async () => {
                await deferreds[calls++]!.promise;
                startTransition(() => setCount((c) => c + 1));
              }}
            >
              Add
            </Button>
            <output data-testid="count">{count}</output>
          </>
        );
      }
      render(<Counter />);
      const user = setupUser();
      await user.click(button("Add"));
      await user.click(button("Add"));
      await user.click(button("Add"));
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expect(screen.getByTestId("count")).toHaveTextContent("1");
      await user.click(button("Add"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(screen.getByTestId("count")).toHaveTextContent("2");
      expect(calls).toBe(2);
    });
  });

  describe("formAction (rows 11-13)", () => {
    it("per-submitter pending: own submissions only; the form channel on Form.Submit", async () => {
      const da = deferred();
      const db = deferred();
      const a = vi.fn<(formData: FormData) => Promise<void>>(() => da.promise);
      const b = vi.fn<(formData: FormData) => Promise<void>>(() => db.promise);
      const seen: unknown[] = [];
      function Probe() {
        const status = useFormStatus();
        if (status.pending) seen.push(status.action);
        return null;
      }
      render(
        <form action={() => {}}>
          <Probe />
          <Form.Submit>Publish</Form.Submit>
          <Button formAction={a}>A</Button>
          <Button formAction={b}>B</Button>
        </form>,
      );
      expect(button("A")).toHaveAttribute("type", "submit");
      expect(button("B")).toHaveAttribute("type", "submit");
      const user = setupUser();
      await user.click(button("A"));
      expect(a).toHaveBeenCalledTimes(1);
      expect(seen.at(-1)).toBe(a);
      expectPending(button("A"));
      expect(button("A")).toHaveAttribute("aria-disabled", "true");
      expectNotPending(button("B"));
      expect(button("B")).not.toHaveAttribute("aria-disabled");
      expectPending(button("Publish"));

      // Again while pending: ignored, cancelled.
      expect(click(button("A")).defaultPrevented).toBe(true);
      expect(a).toHaveBeenCalledTimes(1);

      // B while A pends: B's own submission runs.
      await user.click(button("B"));
      expect(b).toHaveBeenCalledTimes(1);
      expectPending(button("B"));
      expectPending(button("Publish"));
      await act(async () => {
        da.resolve();
      });
      // Only A clears; B's own submission and the form channel are still pending.
      expectNotPending(button("A"));
      expect(button("A")).not.toHaveAttribute("aria-disabled");
      expectPending(button("B"));
      expect(button("B")).toHaveAttribute("aria-disabled", "true");
      expectPending(button("Publish"));
      await act(async () => {
        db.resolve();
      });
      expectNotPending(button("A"));
      expectNotPending(button("B"));
      expectNotPending(button("Publish"));
    });

    it("inside Form.Root: the Button's function runs, not the form's; the form shows pending", async () => {
      const d = deferred();
      const mine = vi.fn<(formData: FormData) => Promise<void>>(() => d.promise);
      const formAction = vi.fn();
      render(
        <Form.Root action={formAction} data-testid="form">
          <Form.Submit>Publish</Form.Submit>
          <Button formAction={mine}>Draft</Button>
        </Form.Root>,
      );
      // react-dom's URL for a function formAction, which Form.Root's submitter check keys on.
      expect(button("Draft")).toHaveAttribute("formaction");
      const user = setupUser();
      await user.click(button("Draft"));
      expect(mine).toHaveBeenCalledTimes(1);
      expect(formAction).not.toHaveBeenCalled();
      expectPending(screen.getByTestId("form"));
      expectPending(button("Draft"));
      await act(async () => {
        d.resolve();
      });
      expectNotPending(screen.getByTestId("form"));
      expectNotPending(button("Draft"));
      await user.click(button("Publish"));
      await act(async () => {});
      expect(formAction).toHaveBeenCalledTimes(1);
      expect(mine).toHaveBeenCalledTimes(1);
    });

    it("an inline formAction keeps pending across a parent re-render (submittedWith)", async () => {
      const d = deferred();
      const calls = vi.fn();
      function App() {
        const [n, setN] = useState(0);
        return (
          <form>
            <output data-testid="n">{n}</output>
            <button type="button" onClick={() => setN((x) => x + 1)}>
              rerender
            </button>
            <Button
              formAction={(fd) => {
                calls(fd);
                return d.promise;
              }}
            >
              Draft
            </Button>
          </form>
        );
      }
      render(<App />);
      const user = setupUser();
      await user.click(button("Draft"));
      expectPending(button("Draft"));
      await user.click(button("rerender"));
      expect(screen.getByTestId("n")).toHaveTextContent("1");
      expectPending(button("Draft"));
      expect(click(button("Draft")).defaultPrevented).toBe(true);
      expect(calls).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
      expectNotPending(button("Draft"));
    });

    it("a stable formAction keeps pending across a parent re-render too", async () => {
      const d = deferred();
      const stable = vi.fn<(formData: FormData) => Promise<void>>(() => d.promise);
      function App() {
        const [n, setN] = useState(0);
        return (
          <form>
            <button type="button" onClick={() => setN((x) => x + 1)}>
              rerender {n}
            </button>
            <Button formAction={stable}>Draft</Button>
          </form>
        );
      }
      render(<App />);
      const user = setupUser();
      await user.click(button("Draft"));
      await user.click(screen.getByText(/rerender/));
      expectPending(button("Draft"));
      await act(async () => {
        d.resolve();
      });
      expectNotPending(button("Draft"));
    });

    it("a plain type=submit Button does not read the form channel", async () => {
      const d = deferred();
      render(
        <form action={() => d.promise}>
          <Button type="submit">Send</Button>
        </form>,
      );
      await setupUser().click(button("Send"));
      expectNotPending(button("Send"));
      expect(button("Send")).not.toHaveAttribute("aria-disabled");
      await act(async () => {
        d.resolve();
      });
    });
  });

  describe("development warnings (row 14)", () => {
    let error: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      error = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    const ours = () =>
      error.mock.calls.filter((c: unknown[]) => String(c[0]).startsWith("Button:")).length;

    it("action + formAction logs once", () => {
      const { rerender } = render(
        <form>
          <Button action={() => {}} formAction={() => {}}>
            X
          </Button>
        </form>,
      );
      rerender(
        <form>
          <Button action={() => {}} formAction={() => {}}>
            X
          </Button>
        </form>,
      );
      expect(ours()).toBe(1);
      expect(String(error.mock.calls[0]![0])).toMatch(/`action` and `formAction`/);
    });

    it.each(["submit", "reset"] as const)("action + type=%s warns once", (type) => {
      const { rerender } = render(
        <Button action={() => {}} type={type}>
          X
        </Button>,
      );
      rerender(
        <Button action={() => {}} type={type}>
          Y
        </Button>,
      );
      expect(ours()).toBe(1);
      expect(String(error.mock.calls[0]![0])).toContain(`type="${type}"`);
    });

    it("no warning for formAction alone, type=submit alone, commandfor + action", () => {
      render(
        <form>
          <Button formAction={() => {}}>A</Button>
          <Button type="submit">B</Button>
          <Button action={() => {}} commandfor="x" command="show-modal">
            C
          </Button>
        </form>,
      );
      expect(ours()).toBe(0);
    });
  });

  describe("Trigger-wrapped (row 15)", () => {
    function flush() {
      return act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    it("Dialog.Trigger render={<Button action />}: one click runs the action and opens", async () => {
      const d = deferred();
      const a = vi.fn(() => d.promise);
      const clicks = recordClicks();
      render(
        <Dialog.Root defaultOpen={false}>
          <Dialog.Trigger render={<Button action={a} />}>Edit</Dialog.Trigger>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Edit</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      const user = setupUser();
      await user.click(button("Edit"));
      await flush();
      expect(a).toHaveBeenCalledTimes(1);
      // The Trigger cancelled the click (its command) before the Button's handler ran.
      expect(clicks).toEqual([true]);
      // The open is dispatched in the same event as `a`, so React entangles the two transitions:
      // the Trigger shows the optimistic `data-open` at once, but `showModal()` waits for the
      // commit, which waits for `a` (design row 15 expected the dialog open while `a` pends;
      // recorded in memo/developer/button.md).
      expect(button("Edit")).toHaveAttribute("data-open", "");
      expectPending(button("Edit"));
      expect((screen.getByTestId("popup") as HTMLDialogElement).open).toBe(false);
      // While `a` pends, a second click does not run it again.
      click(screen.getByText("Edit", { selector: "button" }));
      expect(a).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
      await flush();
      expect((screen.getByTestId("popup") as HTMLDialogElement).open).toBe(true);
    });

    it("with a non-awaiting action the dialog opens in the same commit", async () => {
      const a = vi.fn();
      render(
        <Dialog.Root defaultOpen={false}>
          <Dialog.Trigger
            render={
              <Button
                action={() => {
                  a();
                }}
              />
            }
          >
            Edit
          </Dialog.Trigger>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Edit</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await setupUser().click(button("Edit"));
      await flush();
      expect(a).toHaveBeenCalledTimes(1);
      expect((screen.getByTestId("popup") as HTMLDialogElement).open).toBe(true);
    });

    it("Button render={<Dialog.Trigger />} works likewise", async () => {
      const a = vi.fn();
      render(
        <Dialog.Root defaultOpen={false}>
          <Button action={a} render={<Dialog.Trigger />}>
            Edit
          </Button>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Edit</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await setupUser().click(button("Edit"));
      await flush();
      expect(a).toHaveBeenCalledTimes(1);
      expect((screen.getByTestId("popup") as HTMLDialogElement).open).toBe(true);
    });
  });

  describe("Toolbar (row 16)", () => {
    function Editor({ action }: { action: () => void }) {
      return (
        <Toolbar.Root aria-label="Editor">
          <Button action={action}>Cut</Button>
          <Button action={action} disabled>
            Copy
          </Button>
          <Button action={action} tabIndex={-1}>
            Hidden
          </Button>
          <Toolbar.Separator />
          <Toggle>Bold</Toggle>
          <button type="button">Plain</button>
        </Toolbar.Root>
      );
    }

    function press(target: Element, key: string) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      act(() => {
        target.dispatchEvent(event);
      });
    }

    it("a disabled Button is aria-disabled, reached by the arrows, never dispatches", async () => {
      const action = vi.fn();
      render(<Editor action={action} />);
      expect(button("Copy")).toHaveAttribute("aria-disabled", "true");
      expect(button("Copy")).not.toBeDisabled();
      expect(button("Copy")).toHaveAttribute("data-disabled", "");
      act(() => button("Cut").focus());
      press(button("Cut"), "ArrowRight");
      expect(document.activeElement).toBe(button("Copy"));
      await setupUser().keyboard("{Enter} ");
      expect(click(button("Copy")).defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
      // A tabIndex={-1} item is skipped by the arrows (pass-through, as any item).
      press(button("Copy"), "ArrowRight");
      expect(document.activeElement).toBe(button("Bold"));
      press(button("Bold"), "ArrowRight");
      expect(document.activeElement).toBe(button("Plain"));
    });

    it("Toolbar has no Button member (type and runtime)", () => {
      expect("Button" in Toolbar).toBe(false);
      // @ts-expect-error -- Toolbar.Button was removed (design/components/button.md 7.3)
      expect(Toolbar.Button).toBeUndefined();
    });
  });

  describe("details (row 17)", () => {
    it("exposes `event` as a virtual, non-own property", async () => {
      const action = vi.fn<(d: ButtonActionDetails) => void>();
      render(<Button action={action}>Go</Button>);
      await setupUser().click(button("Go"));
      const details = action.mock.calls[0]![0];
      expect(details.event?.type).toBe("click");
      expect("event" in details).toBe(true);
      expect(Object.keys(details)).toEqual([]);
      expect(JSON.stringify(details)).toBe("{}");
    });

    it("can be passed straight to a Server-Function-shaped action", async () => {
      const serverFn = vi.fn(async (_details: ButtonActionDetails) => {});
      render(<Button action={serverFn}>Go</Button>);
      await setupUser().click(button("Go"));
      expect(serverFn).toHaveBeenCalledTimes(1);
      expect(JSON.parse(JSON.stringify(serverFn.mock.calls[0]))).toEqual([{}]);
    });
  });

  describe("types (row 18)", () => {
    it("ButtonProps", () => {
      expectTypeOf<ButtonProps>().not.toHaveProperty("onClick");
      expectTypeOf<ButtonProps>().not.toHaveProperty("aria-disabled");
      expectTypeOf<NonNullable<ButtonProps["type"]>>().toEqualTypeOf<
        "button" | "submit" | "reset"
      >();
      expectTypeOf<(fd: FormData) => Promise<void>>().toMatchTypeOf<
        NonNullable<ButtonProps["formAction"]>
      >();
      expectTypeOf<string>().toMatchTypeOf<NonNullable<ButtonProps["formAction"]>>();
      expectTypeOf<ButtonState>().toEqualTypeOf<{
        readonly pending: boolean;
        readonly disabled: boolean;
      }>();
      expectTypeOf<root.ButtonProps>().toEqualTypeOf<ButtonProps>();
      expectTypeOf<root.ButtonState>().toEqualTypeOf<ButtonState>();
      expectTypeOf<root.ButtonActionDetails>().toEqualTypeOf<ButtonActionDetails>();
      expect(root.Button).toBe(Button);
    });
  });

  describe("SSR markup (row 19)", () => {
    it("server HTML has type=button and no pending state; hydration matches", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const fn = () => {};
      const ui: ReactNode = (
        <form>
          <Button action={() => {}}>Go</Button>
          <Button formAction={fn}>Draft</Button>
        </form>
      );
      const html = renderToString(ui);
      const host = document.createElement("div");
      host.innerHTML = html;
      const [go, draft] = [...host.querySelectorAll("button")];
      expect(go).toHaveAttribute("type", "button");
      expect(go).not.toHaveAttribute("aria-disabled");
      expect(go).not.toHaveAttribute("data-pending");
      expect(draft).toHaveAttribute("type", "submit");
      expect(draft).toHaveAttribute("formaction");
      document.body.append(host);
      const recoverable = vi.fn();
      await act(async () => {
        hydrateRoot(host, ui, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      host.remove();
    });
  });
});
