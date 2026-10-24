// Accordion tests, mapped to design/components/accordion.md section 11.
//
// What jsdom cannot observe is covered elsewhere (conventions 10.1):
// - Enter/Space on a focused <summary> synthesize a click in browsers but not in jsdom, and
//   user-event's Enter/Space click only buttons, links and inputs. Keyboard toggling is covered
//   here through the click path (the same handler); `accordion.browser.test.tsx` presses the
//   keys, in library mode and JS-free.
// - `<details name>` exclusivity is not implemented by jsdom: JS-free exclusive tests here assert
//   the attribute only; `accordion.browser.test.tsx` shows the platform closing the other item.
//   Library-mode exclusivity (which does not use `name`) is tested fully here.
// - Find-in-page cannot be simulated. The platform path is driven by `setAttribute("open", "")`,
//   which makes jsdom fire `toggle` on a macrotask exactly like a browser does.
// - ViewTransition: jsdom has no `startViewTransition`, so `transition` is smoke-tested here;
//   `internal/transition-boundary.browser.test.tsx` ("Accordion expand") covers it in browsers.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
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
import { Accordion } from "./index.js";
import type {
  AccordionItemState,
  AccordionPanelState,
  AccordionRootState,
  AccordionTriggerState,
  AccordionValueChangeDetails,
} from "./index.js";

type AnyValue = string[] | string | null;
type ActionFn = (next: AnyValue, details: AccordionValueChangeDetails) => void | Promise<void>;

interface ItemSpec {
  value: string;
  disabled?: boolean;
  /** Render a link inside the trigger (nested interactive content). */
  link?: boolean;
}

const DEFAULT_ITEMS: readonly ItemSpec[] = [{ value: "a" }, { value: "b" }, { value: "c" }];

interface HarnessProps {
  mode: ControlMode;
  exclusive?: boolean;
  /** Initial committed value (`[]` / `null` when omitted). */
  initial?: AnyValue;
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Wrap the Root in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Panel "a" renders this suspender (key "a-content") while open; everything under one Suspense. */
  suspender?: ReturnType<typeof createSuspender>;
  items?: readonly ItemSpec[];
  disabled?: boolean;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows "update on success"
 * (design 2.2, third example); the uncontrolled variant mirrors the committed value in a sibling
 * so both modes expose it the same way.
 */
function Harness({
  mode,
  exclusive = false,
  initial,
  action,
  catchErrors = false,
  boundary,
  suspender,
  items = DEFAULT_ITEMS,
  disabled,
}: HarnessProps) {
  const initialValue: AnyValue = initial ?? (exclusive ? null : []);
  const [committed, setCommitted] = useState<AnyValue>(initialValue);
  const [error, setError] = useState<unknown>(null);

  const valueChangeAction = async (next: AnyValue, details: AccordionValueChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      startTransition(() => setError(e));
      return;
    }
    startTransition(() => setCommitted(next));
  };

  const children = items.map(({ value, disabled: itemDisabled, link }) => (
    <Accordion.Item key={value} value={value} disabled={itemDisabled} data-testid={`item-${value}`}>
      <Accordion.Trigger data-testid={`trigger-${value}`}>
        {value.toUpperCase()}
        {link && (
          <a href="#somewhere" data-testid={`link-${value}`}>
            link
          </a>
        )}
      </Accordion.Trigger>
      <Accordion.Panel data-testid={`panel-${value}`}>
        {({ open }) => (
          <>
            <span data-testid={`panel-open-${value}`}>{String(open)}</span>
            {value === "a" && suspender && open && <suspender.Suspender value="a-content" />}
          </>
        )}
      </Accordion.Panel>
    </Accordion.Item>
  ));

  let accordion: ReactNode = exclusive ? (
    <Accordion.Root
      exclusive
      {...(mode === "controlled"
        ? { value: committed as string | null }
        : { defaultValue: initialValue as string | null })}
      valueChangeAction={valueChangeAction}
      disabled={disabled}
      data-testid="root"
    >
      {children}
    </Accordion.Root>
  ) : (
    <Accordion.Root
      {...(mode === "controlled"
        ? { value: committed as string[] }
        : { defaultValue: initialValue as string[] })}
      valueChangeAction={valueChangeAction}
      disabled={disabled}
      data-testid="root"
    >
      {children}
    </Accordion.Root>
  );
  if (boundary) accordion = <ErrorCatcher onError={boundary}>{accordion}</ErrorCatcher>;

  const content = (
    <>
      {accordion}
      <output data-testid="committed">{JSON.stringify(committed)}</output>
      {error !== null && <output data-testid="error">{String(error)}</output>}
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

const root = () => screen.getByTestId("root");
const item = (v: string) => screen.getByTestId(`item-${v}`) as HTMLDetailsElement;
const trigger = (v: string) => screen.getByTestId(`trigger-${v}`);
const panel = (v: string) => screen.getByTestId(`panel-${v}`);
const panelOpen = (v: string) => screen.getByTestId(`panel-open-${v}`);
const committed = () => JSON.parse(screen.getByTestId("committed").textContent ?? "null");

/**
 * `toggle` is dispatched from a queued task (browser and jsdom alike); run it inside `act`. jsdom
 * queues it with `setImmediate`, which a `setTimeout(0)` can race, so wait for an immediate: they
 * run in FIFO order, after the ones jsdom queued.
 */
const flushToggle = () =>
  act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

function expectOpenAttr(el: Element, open: boolean) {
  if (open) expect(el).toHaveAttribute("open");
  else expect(el).not.toHaveAttribute("open");
}

describe("Accordion", () => {
  describe("roles and ARIA", () => {
    it("renders div > details > summary + div with no added ARIA", () => {
      render(<Harness mode="uncontrolled" />);
      expect(root().tagName).toBe("DIV");
      expect(item("a").tagName).toBe("DETAILS");
      expect(item("a").parentElement).toBe(root());
      expect(trigger("a").tagName).toBe("SUMMARY");
      expect(trigger("a")).toBe(item("a").firstElementChild);
      expect(panel("a").tagName).toBe("DIV");
      expect(panel("a").parentElement).toBe(item("a"));
      for (const el of [root(), item("a"), trigger("a"), panel("a")]) {
        expect(el).not.toHaveAttribute("role");
        for (const attr of el.getAttributeNames()) expect(attr).not.toMatch(/^aria-/);
      }
      expect(item("a")).not.toHaveAttribute("name");
    });

    it("JS-free mode: no data-open / data-pending, no handlers, browser toggles natively", async () => {
      render(
        <Accordion.Root data-testid="root">
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
            <Accordion.Panel data-testid="panel-a">Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      expect(item("a").open).toBe(false);
      expect(item("a")).not.toHaveAttribute("data-open");
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(root()).not.toHaveAttribute("data-pending");

      await user.click(trigger("a"));
      await flushToggle();
      expect(item("a").open).toBe(true);
      expect(item("a").matches(":open")).toBe(true);
      // Still nothing emitted: the browser owns `open` (use `:open` in CSS).
      expect(item("a")).not.toHaveAttribute("data-open");
      expect(trigger("a")).not.toHaveAttribute("data-open");

      // No click handler: the click is not default-prevented (the native toggle runs).
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      act(() => {
        trigger("a").dispatchEvent(click);
      });
      expect(click.defaultPrevented).toBe(false);
      expect(item("a").open).toBe(false);

      // No toggle handler: a platform flip is left alone (nothing re-applied, nothing emitted).
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      act(() => {
        item("a").setAttribute("open", "");
      });
      await flushToggle();
      expect(item("a").open).toBe(true);
      expect(item("a")).not.toHaveAttribute("data-open");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("JS-free `exclusive` renders the same `name` on every details; library mode renders none", () => {
      const { unmount } = render(
        <Accordion.Root exclusive>
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
          <Accordion.Item value="b" data-testid="item-b">
            <Accordion.Trigger>B</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const name = item("a").getAttribute("name");
      expect(name).toBeTruthy();
      expect(item("b")).toHaveAttribute("name", name!);
      unmount();

      // The platform's `name` group closing A is shown in accordion.browser.test.tsx.
      render(<Harness mode="uncontrolled" exclusive />);
      expect(item("a")).not.toHaveAttribute("name");
      expect(item("b")).not.toHaveAttribute("name");
    });

    it("`defaultOpen` renders `open` in JS-free mode only once", () => {
      const { rerender } = render(
        <Accordion.Root>
          <Accordion.Item value="a" defaultOpen data-testid="item-a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(item("a").open).toBe(true);
      // The browser now owns the attribute: a prop change never rewrites it.
      rerender(
        <Accordion.Root>
          <Accordion.Item value="a" defaultOpen={false} data-testid="item-a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(item("a").open).toBe(true);
    });

    it("`defaultOpen` is ignored and warned about in library mode", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Accordion.Root defaultValue={[]}>
          <Accordion.Item value="a" defaultOpen data-testid="item-a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(item("a").open).toBe(false);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/`defaultOpen` is ignored in library mode/);
    });

    it("library mode: `defaultValue` / `value` drive the `open` attribute", () => {
      render(<Harness mode="uncontrolled" initial={["b"]} />);
      expectOpenAttr(item("a"), false);
      expectOpenAttr(item("b"), true);
      expect(item("b")).toHaveAttribute("data-open", "");
      expect(trigger("b")).toHaveAttribute("data-open", "");
      expect(panelOpen("b")).toHaveTextContent("true");
      expect(panelOpen("a")).toHaveTextContent("false");
    });

    it("`disabled` renders aria-disabled on the Trigger and data-disabled on every part", () => {
      render(
        <Harness
          mode="uncontrolled"
          items={[{ value: "a" }, { value: "b", disabled: true }]}
          disabled={false}
        />,
      );
      expect(trigger("b")).toHaveAttribute("aria-disabled", "true");
      expect(trigger("b")).toHaveAttribute("data-disabled", "");
      expect(item("b")).toHaveAttribute("data-disabled", "");
      expect(panel("b")).toHaveAttribute("data-disabled", "");
      expect(trigger("a")).not.toHaveAttribute("aria-disabled");
      expect(trigger("a")).not.toHaveAttribute("data-disabled");
      expect(root()).not.toHaveAttribute("data-disabled");
    });

    it("Root `disabled` disables every item", () => {
      render(<Harness mode="uncontrolled" disabled />);
      expect(root()).toHaveAttribute("data-disabled", "");
      for (const v of ["a", "b", "c"]) {
        expect(trigger(v)).toHaveAttribute("aria-disabled", "true");
        expect(item(v)).toHaveAttribute("data-disabled", "");
      }
    });

    it("passes native props through on every part", () => {
      const onPointerDown = vi.fn();
      render(
        <Accordion.Root id="acc" aria-label="FAQ" data-testid="root">
          <Accordion.Item value="a" id="item" data-testid="item-a" onPointerDown={onPointerDown}>
            <Accordion.Trigger id="trigger" title="hint" data-testid="trigger-a">
              A
            </Accordion.Trigger>
            <Accordion.Panel id="panel" lang="en" data-testid="panel-a">
              Alpha
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(root()).toHaveAttribute("id", "acc");
      expect(root()).toHaveAttribute("aria-label", "FAQ");
      expect(item("a")).toHaveAttribute("id", "item");
      expect(trigger("a")).toHaveAttribute("title", "hint");
      expect(panel("a")).toHaveAttribute("lang", "en");
      fireEvent.pointerDown(item("a"));
      expect(onPointerDown).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard", () => {
    // Enter/Space: see the browser-mode note at the top of this file.
    it("ArrowDown / ArrowUp move between triggers and wrap", async () => {
      render(<Harness mode="uncontrolled" />);
      const user = setupUser();
      trigger("a").focus();
      expect(trigger("a")).toHaveFocus();

      await user.keyboard("[ArrowDown]");
      expect(trigger("b")).toHaveFocus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("c")).toHaveFocus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("a")).toHaveFocus();
      await user.keyboard("[ArrowUp]");
      expect(trigger("c")).toHaveFocus();
      await user.keyboard("[ArrowUp]");
      expect(trigger("b")).toHaveFocus();
    });

    it("Home / End focus the first / last enabled trigger", async () => {
      render(<Harness mode="uncontrolled" />);
      const user = setupUser();
      trigger("b").focus();
      await user.keyboard("[End]");
      expect(trigger("c")).toHaveFocus();
      await user.keyboard("[Home]");
      expect(trigger("a")).toHaveFocus();
    });

    it("skips disabled triggers (which stay focusable themselves)", async () => {
      render(
        <Harness
          mode="uncontrolled"
          items={[{ value: "a" }, { value: "b", disabled: true }, { value: "c" }]}
        />,
      );
      const user = setupUser();
      trigger("a").focus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("c")).toHaveFocus();
      await user.keyboard("[ArrowUp]");
      expect(trigger("a")).toHaveFocus();

      // A disabled trigger can be reached by Tab; arrows leave it for an enabled one.
      trigger("b").focus();
      expect(trigger("b")).toHaveFocus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("c")).toHaveFocus();
      trigger("b").focus();
      await user.keyboard("[End]");
      expect(trigger("c")).toHaveFocus();
    });

    it("navigation keys do nothing outside a trigger and do not toggle", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      trigger("a").focus();
      await user.keyboard("[ArrowDown][Home][End][ArrowUp]");
      expect(action).not.toHaveBeenCalled();
      expect(item("a").open).toBe(false);

      // Keys from inside a panel are left to the content.
      const input = document.createElement("input");
      panel("a").append(input);
      input.focus();
      await user.keyboard("[ArrowDown]");
      expect(input).toHaveFocus();
    });

    it("a nested Root handles its own triggers; the outer one does not move focus again", async () => {
      render(
        <Accordion.Root data-testid="outer">
          <Accordion.Item value="o1">
            <Accordion.Trigger data-testid="trigger-o1">O1</Accordion.Trigger>
            <Accordion.Panel>
              <Accordion.Root data-testid="inner">
                <Accordion.Item value="i1">
                  <Accordion.Trigger data-testid="trigger-i1">I1</Accordion.Trigger>
                </Accordion.Item>
                <Accordion.Item value="i2">
                  <Accordion.Trigger data-testid="trigger-i2">I2</Accordion.Trigger>
                </Accordion.Item>
              </Accordion.Root>
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="o2">
            <Accordion.Trigger data-testid="trigger-o2">O2</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      trigger("i1").focus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("i2")).toHaveFocus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("i1")).toHaveFocus();

      trigger("o1").focus();
      await user.keyboard("[ArrowDown]");
      expect(trigger("o2")).toHaveFocus();
    });
  });

  renderBoth("sync action", (mode) => {
    it("click dispatches (next, { event, reason: 'activate', item, open }) and opens", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(trigger("a"));
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toEqual(["a"]);
      expect(details.reason).toBe("activate");
      expect(details.item).toBe("a");
      expect(details.open).toBe(true);
      expect(details.event).toBeInstanceOf(window.Event);
      expect(details.event?.type).toBe("click");
      expectOpenAttr(item("a"), true);
      expect(item("a").open).toBe(true);
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expectNotPending(trigger("a"));
      expectNotPending(root());
      expect(panelOpen("a")).toHaveTextContent("true");
      expect(committed()).toEqual(["a"]);

      await user.click(trigger("a"));
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toEqual([]);
      expect(action.mock.calls[1]?.[1].open).toBe(false);
      expect(item("a").open).toBe(false);
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(committed()).toEqual([]);
    });

    it("multiple mode accumulates open items", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();
      await user.click(trigger("a"));
      await user.click(trigger("b"));
      expect(action.mock.calls.map(([next]) => next)).toEqual([["a"], ["a", "b"]]);
      expect(item("a").open).toBe(true);
      expect(item("b").open).toBe(true);
      await user.click(trigger("a"));
      expect(action.mock.calls[2]?.[0]).toEqual(["b"]);
      expect(item("a").open).toBe(false);
      expect(item("b").open).toBe(true);
    });

    it("exclusive mode replaces the open item and closes to null", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} exclusive action={action} />);
      const user = setupUser();
      await user.click(trigger("a"));
      expect(action.mock.calls[0]?.[0]).toBe("a");
      await user.click(trigger("b"));
      expect(action.mock.calls[1]?.[0]).toBe("b");
      expect(item("a").open).toBe(false);
      expect(item("b").open).toBe(true);
      expect(committed()).toBe("b");
      await user.click(trigger("b"));
      expect(action.mock.calls[2]?.[0]).toBeNull();
      expect(item("b").open).toBe(false);
      expect(committed()).toBeNull();
    });

    it("a disabled item never dispatches and the click is default-prevented", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode={mode}
          action={action}
          items={[{ value: "a" }, { value: "b", disabled: true }]}
        />,
      );
      const user = setupUser();
      await user.click(trigger("b"));
      await act(async () => {
        trigger("b").click();
      });
      expect(action).not.toHaveBeenCalled();
      expect(item("b").open).toBe(false);
      expect(trigger("b")).not.toHaveAttribute("data-open");

      // The guard is on the item, not the whole accordion.
      await user.click(trigger("a"));
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("clicking a form control inside the summary neither toggles nor dispatches", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Accordion.Root defaultValue={[]} valueChangeAction={action} data-testid="root">
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">
              A
              <select data-testid="select" aria-label="pick">
                <option>one</option>
              </select>
              <textarea data-testid="textarea" aria-label="notes" />
              <span contentEditable data-testid="editable" suppressContentEditableWarning>
                edit me
              </span>
              <input data-testid="text" aria-label="text" />
              <input type="checkbox" data-testid="checkbox" aria-label="check" />
            </Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      for (const id of ["select", "textarea", "editable", "text", "checkbox"]) {
        await user.click(screen.getByTestId(id));
        await flushToggle();
        expect(item("a").open, id).toBe(false);
        expect(action, id).not.toHaveBeenCalled();
      }
      // Controls with their own activation behaviour keep it.
      expect(screen.getByTestId("checkbox")).toBeChecked();
      void mode;
    });

    it("clicking a link inside the summary neither toggles nor dispatches", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} items={[{ value: "a", link: true }]} />);
      const user = setupUser();
      await user.click(screen.getByTestId("link-a"));
      expect(action).not.toHaveBeenCalled();
      expect(item("a").open).toBe(false);
      expect(trigger("a")).not.toHaveAttribute("data-open");
      // The summary itself still works.
      await user.click(trigger("a"));
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  renderBoth("async action", (mode) => {
    it("shows optimistic data-open and data-pending; <details> and Panel wait for the commit", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(trigger("a"));
      expectPending(root());
      expectPending(item("a"));
      expectPending(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(item("a")).toHaveAttribute("data-open", "");
      expect(item("a").open).toBe(false);
      expectOpenAttr(item("a"), false);
      expect(panelOpen("a")).toHaveTextContent("false");
      expect(panel("a")).not.toHaveAttribute("data-pending");
      // Other items are untouched.
      expectNotPending(item("b"));
      expectNotPending(trigger("b"));
      expect(committed()).toEqual([]);

      await act(async () => {
        d.resolve();
      });
      expectNotPending(root());
      expectNotPending(item("a"));
      expectNotPending(trigger("a"));
      expect(item("a").open).toBe(true);
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(panelOpen("a")).toHaveTextContent("true");
      expect(committed()).toEqual(["a"]);
    });

    it("exclusive: the closing and the opening item are both pending", async () => {
      const d = deferred();
      render(<Harness mode={mode} exclusive initial="a" action={() => d.promise} />);
      const user = setupUser();
      expect(item("a").open).toBe(true);

      await user.click(trigger("b"));
      expectPending(trigger("a"));
      expectPending(trigger("b"));
      expectNotPending(trigger("c"));
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(trigger("b")).toHaveAttribute("data-open", "");
      expect(item("a").open).toBe(true);
      expect(item("b").open).toBe(false);

      await act(async () => {
        d.resolve();
      });
      expect(item("a").open).toBe(false);
      expect(item("b").open).toBe(true);
      expectNotPending(trigger("a"));
      expectNotPending(trigger("b"));
    });

    it("clicking again while pending reverts the intent: item no longer pending, Root still is", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(trigger("a"));
      await user.click(trigger("a"));
      expect(action.mock.calls.map(([next]) => next)).toEqual([["a"], []]);
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expectNotPending(trigger("a"));
      expectPending(root());

      await act(async () => {
        deferreds[0]!.resolve();
        deferreds[1]!.resolve();
      });
      expectNotPending(root());
      expect(item("a").open).toBe(false);
    });

    it("keeps working after unmounting while pending", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const { unmount } = render(<Harness mode={mode} action={() => d.promise} />);
      const user = setupUser();
      await user.click(trigger("a"));
      expectPending(root());
      unmount();
      await act(async () => {
        d.resolve();
      });
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  renderBoth("rejection", (mode) => {
    it("reaches the Error Boundary around the Root; nothing was committed", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const onError = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={onError} />);
      const user = setupUser();

      await user.click(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expectPending(trigger("a"));
      expect(item("a").open).toBe(false);

      const err = new Error("save failed");
      await act(async () => {
        d.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByTestId("root")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
      expect(committed()).toEqual([]);
    });

    it("caught inside the action counts as success", async () => {
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();

      await user.click(trigger("a"));
      expectPending(trigger("a"));
      await act(async () => {
        d.reject(new Error("vetoed"));
      });
      expectNotPending(trigger("a"));
      expect(screen.getByTestId("error")).toHaveTextContent("vetoed");
      // The harness never adopted the value in either mode...
      expect(committed()).toEqual([]);
      // ...but only a controlled parent can veto: uncontrolled commits the open item.
      expect(item("a").open).toBe(mode === "uncontrolled");
      if (mode === "controlled") expect(trigger("a")).not.toHaveAttribute("data-open");
    });
  });

  describe("overlapping actions (uncontrolled, exclusive; walkthrough 9.3)", () => {
    it.each([
      ["B then C", [0, 1]],
      ["C then B", [1, 0]],
    ] as const)("latest dispatch wins when resolved %s", async (_label, order) => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
      render(<Harness mode="uncontrolled" exclusive initial="a" action={action} />);
      const user = setupUser();

      await user.click(trigger("b"));
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(trigger("b")).toHaveAttribute("data-open", "");
      expectPending(trigger("a"));
      expectPending(trigger("b"));

      await user.click(trigger("c"));
      expect(action.mock.calls.map(([next]) => next)).toEqual(["b", "c"]);
      expect(trigger("b")).not.toHaveAttribute("data-open");
      expect(trigger("c")).toHaveAttribute("data-open", "");
      expectPending(trigger("a"));
      expectNotPending(trigger("b")); // optimistic === committed (closed) again
      expectPending(trigger("c"));
      expect(item("a").open).toBe(true);

      for (const i of order) {
        await act(async () => {
          deferreds[i]!.resolve();
        });
      }
      expect(item("a").open).toBe(false);
      expect(item("b").open).toBe(false);
      expect(item("c").open).toBe(true);
      expectNotPending(root());
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("stays pending until every in-flight action settles", async () => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      render(<Harness mode="uncontrolled" exclusive action={() => deferreds[calls++]!.promise} />);
      const user = setupUser();
      await user.click(trigger("a"));
      await user.click(trigger("b"));
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expectPending(root());
      await act(async () => {
        deferreds[0]!.resolve();
      });
      expectNotPending(root());
      expect(item("b").open).toBe(true);
    });
  });

  describe("overlapping actions (uncontrolled, multiple)", () => {
    it.each([
      ["A then B", [0, 1]],
      ["B then A", [1, 0]],
    ] as const)("both opens survive when resolved %s", async (_label, order) => {
      const deferreds = [deferred(), deferred()];
      let calls = 0;
      const action = vi.fn<ActionFn>(() => deferreds[calls++]!.promise);
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();

      await user.click(trigger("a"));
      await user.click(trigger("b"));
      expect(action.mock.calls.map(([next]) => next)).toEqual([["a"], ["a", "b"]]);
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(trigger("b")).toHaveAttribute("data-open", "");

      for (const i of order) {
        await act(async () => {
          deferreds[i]!.resolve();
        });
      }
      expect(item("a").open).toBe(true);
      expect(item("b").open).toBe(true);
      expectNotPending(root());
      // Not asserted: the harness mirror writes in completion order (a controlled parent using
      // "update on success" with a whole-set `next` has the same property; see the memo).
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

    it("reaches the boundary when the older action rejects after the newer resolved", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn();
      const { deferreds, action } = renderTwoClicks(onError);
      const user = setupUser();

      await user.click(trigger("a"));
      await user.click(trigger("b"));
      expect(action.mock.calls.map(([next]) => next)).toEqual([["a"], ["a", "b"]]);

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
      expect(screen.queryByTestId("root")).not.toBeInTheDocument();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
      // The newer action's outcome was unaffected.
      expect(committed()).toEqual(["a", "b"]);
    });

    it("reaches the boundary when the older action rejects while the newer is pending", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn();
      const { deferreds } = renderTwoClicks(onError);
      const user = setupUser();

      await user.click(trigger("a"));
      await user.click(trigger("b"));
      expectPending(root());

      const err = new Error("older save failed");
      await act(async () => {
        deferreds[0]!.reject(err);
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(err);
      expect(screen.queryByTestId("root")).not.toBeInTheDocument();

      await act(async () => {
        deferreds[1]!.resolve();
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("older save failed");
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps the item closed and pending until lazily mounted content is ready", async () => {
      const suspender = createSuspender();
      render(<Harness mode={mode} suspender={suspender} />);
      const user = setupUser();

      await user.click(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expectPending(trigger("a"));
      expectPending(root());
      expect(item("a").open).toBe(false);
      expect(panelOpen("a")).toHaveTextContent("false");
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(screen.queryByTestId("suspender")).not.toBeInTheDocument();

      await act(async () => {
        suspender.resolve("a-content");
      });
      expect(item("a").open).toBe(true);
      expect(panelOpen("a")).toHaveTextContent("true");
      expect(screen.getByTestId("suspender")).toHaveTextContent("a-content");
      expectNotPending(trigger("a"));
      expectNotPending(root());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });
  });

  describe("function props", () => {
    it("every part receives its documented state (library mode)", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: AccordionRootState) => (s.pending ? "busy" : "idle"));
      const itemClass = vi.fn((s: AccordionItemState) => `item${s.open ? " open" : ""}`);
      const itemStyle = vi.fn((s: AccordionItemState) => ({ opacity: s.pending ? 0.5 : 1 }));
      const triggerChildren = vi.fn((s: AccordionTriggerState) =>
        s.pending ? "Opening" : s.open ? "Close" : "Open",
      );
      const panelClass = vi.fn((s: AccordionPanelState) => (s.open ? "shown" : "hidden"));
      render(
        <Accordion.Root
          defaultValue={[]}
          valueChangeAction={() => d.promise}
          className={rootClass}
          data-testid="root"
        >
          <Accordion.Item value="a" className={itemClass} style={itemStyle} data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">{triggerChildren}</Accordion.Trigger>
            <Accordion.Panel className={panelClass} data-testid="panel-a">
              Alpha
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();

      const idle: AccordionItemState = { value: "a", open: false, pending: false, disabled: false };
      expect(rootClass).toHaveBeenLastCalledWith({ pending: false, disabled: false });
      expect(itemClass).toHaveBeenLastCalledWith(idle);
      expect(itemStyle).toHaveBeenLastCalledWith(idle);
      expect(triggerChildren).toHaveBeenLastCalledWith(idle);
      expect(panelClass).toHaveBeenLastCalledWith({ value: "a", open: false, disabled: false });
      expect(root()).toHaveClass("idle");
      expect(trigger("a")).toHaveTextContent("Open");
      expect(panel("a")).toHaveClass("hidden");

      await user.click(trigger("a"));
      const inFlight: AccordionItemState = {
        value: "a",
        open: true,
        pending: true,
        disabled: false,
      };
      expect(rootClass).toHaveBeenLastCalledWith({ pending: true, disabled: false });
      expect(itemClass).toHaveBeenLastCalledWith(inFlight);
      expect(triggerChildren).toHaveBeenLastCalledWith(inFlight);
      // Panel state is committed: still closed.
      expect(panelClass).toHaveBeenLastCalledWith({ value: "a", open: false, disabled: false });
      expect(root()).toHaveClass("busy");
      expect(item("a")).toHaveClass("item", "open");
      expect(item("a")).toHaveStyle({ opacity: "0.5" });
      expect(trigger("a")).toHaveTextContent("Opening");
      expect(panel("a")).toHaveClass("hidden");

      await act(async () => {
        d.resolve();
      });
      expect(itemClass).toHaveBeenLastCalledWith({ ...idle, open: true });
      expect(panelClass).toHaveBeenLastCalledWith({ value: "a", open: true, disabled: false });
      expect(trigger("a")).toHaveTextContent("Close");
      expect(panel("a")).toHaveClass("shown");
    });

    it("JS-free mode passes `open: undefined` and `disabled` from the Item or Root", () => {
      const itemChildren = vi.fn((s: AccordionItemState) => (
        <>
          <Accordion.Trigger>{String(s.open)}</Accordion.Trigger>
          <Accordion.Panel>{(p) => `${String(p.open)}/${String(p.disabled)}`}</Accordion.Panel>
        </>
      ));
      render(
        <Accordion.Root disabled>
          <Accordion.Item value="a" data-testid="item-a">
            {itemChildren}
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(itemChildren).toHaveBeenLastCalledWith({
        value: "a",
        open: undefined,
        pending: false,
        disabled: true,
      });
      expect(item("a")).toHaveTextContent("undefined");
      expect(item("a")).toHaveTextContent("undefined/true");
    });
  });

  describe("render prop", () => {
    function MyDetails({ ref, ...props }: ComponentPropsWithRef<"details">) {
      return <details ref={ref} data-my-details="" {...props} />;
    }

    it("element form on Item and Trigger merges props, forwards refs and keeps dispatching", async () => {
      const action = vi.fn<ActionFn>();
      const itemRef = { current: null as HTMLDetailsElement | null };
      const elementRef = { current: null as HTMLDetailsElement | null };
      const triggerRef = { current: null as HTMLElement | null };
      const order: string[] = [];
      render(
        <Accordion.Root
          defaultValue={[]}
          valueChangeAction={(next, details) => {
            order.push("library");
            action(next, details);
          }}
        >
          <Accordion.Item
            value="a"
            ref={itemRef}
            className="card"
            style={{ opacity: 0.5, color: "blue" }}
            data-testid="item-a"
            render={<MyDetails ref={elementRef} className="x" style={{ color: "red" }} />}
          >
            <Accordion.Trigger
              ref={triggerRef}
              data-testid="trigger-a"
              render={<summary className="y" onClick={() => order.push("element")} />}
            >
              A
            </Accordion.Trigger>
            <Accordion.Panel render={<section />} data-testid="panel-a">
              Alpha
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();

      expect(item("a")).toHaveAttribute("data-my-details", "");
      expect(item("a")).toHaveClass("card", "x");
      expect(item("a")).toHaveStyle({ color: "rgb(255, 0, 0)", opacity: "0.5" });
      expect(itemRef.current).toBe(item("a"));
      expect(elementRef.current).toBe(item("a"));
      expect(trigger("a")).toHaveClass("y");
      expect(triggerRef.current).toBe(trigger("a"));
      expect(panel("a").tagName).toBe("SECTION");

      await user.click(trigger("a"));
      expect(order).toEqual(["element", "library"]);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toEqual(["a"]);
      expect(item("a").open).toBe(true);
      expect(trigger("a")).toHaveAttribute("data-open", "");
    });

    it("element form: library-controlled keys are owned, pass-through props lose to the element", async () => {
      render(
        <Accordion.Root defaultValue={["a"]}>
          <Accordion.Item
            value="a"
            aria-label="part"
            data-testid="item-a"
            render={<details data-open="nope" data-pending="nope" name="g" aria-label="element" />}
          >
            <Accordion.Trigger
              data-testid="trigger-a"
              render={<summary data-open="nope" aria-disabled="false" />}
            >
              A
            </Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      expect(item("a")).toHaveAttribute("data-open", "");
      expect(item("a")).not.toHaveAttribute("data-pending");
      // A second writer of `open` (the platform's `name` group) is removed in library mode.
      expect(item("a")).not.toHaveAttribute("name");
      expect(item("a")).toHaveAttribute("aria-label", "element");
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(trigger("a")).not.toHaveAttribute("aria-disabled");
      // The element cannot take `open` away from the library either.
      await user.click(trigger("a"));
      expect(item("a").open).toBe(false);
      // Owned key: once closed the attribute is absent, whatever the element says.
      expect(trigger("a")).not.toHaveAttribute("data-open");
    });

    it("element form in JS-free mode keeps the element's own onToggle and onClick", async () => {
      const onToggle = vi.fn();
      const onClick = vi.fn();
      render(
        <Accordion.Root>
          <Accordion.Item value="a" data-testid="item-a" render={<details onToggle={onToggle} />}>
            <Accordion.Trigger data-testid="trigger-a" render={<summary onClick={onClick} />}>
              A
            </Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      await user.click(trigger("a"));
      await flushToggle();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(item("a").open).toBe(true);
    });

    it("function form receives (props, state)", async () => {
      const d = deferred();
      const renderTrigger = vi.fn(
        (props: ComponentPropsWithRef<"summary">, state: AccordionTriggerState) => (
          <summary {...props} aria-busy={state.pending || undefined}>
            {state.open ? "On" : "Off"}
          </summary>
        ),
      );
      render(
        <Accordion.Root defaultValue={[]} valueChangeAction={() => d.promise}>
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a" render={renderTrigger} />
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      expect(trigger("a")).toHaveTextContent("Off");
      expect(renderTrigger).toHaveBeenLastCalledWith(
        expect.objectContaining({ "data-testid": "trigger-a" }),
        { value: "a", open: false, pending: false, disabled: false },
      );

      await user.click(trigger("a"));
      expect(trigger("a")).toHaveTextContent("On");
      expect(trigger("a")).toHaveAttribute("aria-busy", "true");
      expectPending(trigger("a"));
      await act(async () => {
        d.resolve();
      });
      expect(trigger("a")).not.toHaveAttribute("aria-busy");
      expect(item("a").open).toBe(true);
    });

    it("warns in development when the mounted element is not <details> / <summary>", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Accordion.Root>
          <Accordion.Item value="a" render={<div />}>
            <Accordion.Trigger render={<button type="button" />}>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const messages = consoleError.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /Accordion\.Item: expected to render a <details>/.test(m))).toBe(
        true,
      );
      expect(
        messages.some((m) => /Accordion\.Trigger: expected to render a <summary>/.test(m)),
      ).toBe(true);
    });
  });

  describe("post-await rule", () => {
    function Parent({ promise, wrap }: { promise: Promise<void>; wrap: boolean }) {
      const [value, setValue] = useState<string | null>(null);
      return (
        <Accordion.Root
          exclusive
          value={value}
          valueChangeAction={async (next) => {
            await promise;
            if (wrap) startTransition(() => setValue(next));
            else setValue(next);
          }}
        >
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      );
    }

    it("`open` and data-pending converge in one commit with startTransition", async () => {
      const d = deferred();
      render(<Parent promise={d.promise} wrap />);
      const user = setupUser();
      const el = item("a");
      const snapshots: { open: boolean; pending: boolean }[] = [];
      const observer = new MutationObserver(() => {
        snapshots.push({ open: el.hasAttribute("open"), pending: el.hasAttribute("data-pending") });
      });
      observer.observe(el, { attributes: true });

      await user.click(trigger("a"));
      await act(async () => {
        d.resolve();
      });
      observer.disconnect();

      expect(snapshots[0]).toEqual({ open: false, pending: true });
      expect(snapshots.at(-1)).toEqual({ open: true, pending: false });
      // The attribute never flipped while still pending.
      expect(snapshots.every((s) => !s.open || !s.pending)).toBe(true);
    });

    it("still ends in the right state without startTransition (documented limitation)", async () => {
      const d = deferred();
      render(<Parent promise={d.promise} wrap={false} />);
      const user = setupUser();
      await user.click(trigger("a"));
      await act(async () => {
        d.resolve();
      });
      expect(item("a").open).toBe(true);
      expectNotPending(item("a"));
    });
  });

  describe("controlled edge cases", () => {
    it("snaps back when the parent never adopts the value (veto)", async () => {
      const d = deferred();
      render(
        <Accordion.Root value={[]} valueChangeAction={() => d.promise} data-testid="root">
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      await user.click(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expectPending(trigger("a"));
      await act(async () => {
        d.resolve();
      });
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(item("a").open).toBe(false);
      expectNotPending(root());
    });

    it("rebases the optimistic set when `value` changes externally while pending", async () => {
      const d = deferred();
      function Parent() {
        const [value, setValue] = useState<string[]>([]);
        return (
          <>
            <Accordion.Root value={value} valueChangeAction={() => d.promise} data-testid="root">
              <Accordion.Item value="a" data-testid="item-a">
                <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
              </Accordion.Item>
              <Accordion.Item value="b" data-testid="item-b">
                <Accordion.Trigger data-testid="trigger-b">B</Accordion.Trigger>
              </Accordion.Item>
            </Accordion.Root>
            <button type="button" data-testid="external" onClick={() => setValue(["b"])}>
              open b
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      await user.click(screen.getByTestId("external"));
      // The pending patch "open a" re-applies on top of the new committed set {b}.
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(trigger("b")).toHaveAttribute("data-open", "");
      expect(item("b").open).toBe(true);
      expect(item("a").open).toBe(false);
      await act(async () => {
        d.resolve();
      });
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expect(item("b").open).toBe(true);
      expectNotPending(root());
    });
  });

  describe("platform path (design 2.3): the browser opens a <details> itself", () => {
    it("dispatches with reason 'platform' and the `toggle` event; uncontrolled commits it", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);

      act(() => {
        item("b").setAttribute("open", "");
      });
      expect(action).not.toHaveBeenCalled(); // `toggle` is a queued task
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toEqual(["b"]);
      expect(details.reason).toBe("platform");
      expect(details.item).toBe("b");
      expect(details.open).toBe(true);
      expect(details.event?.type).toBe("toggle");
      expect(item("b").open).toBe(true);
      expect(trigger("b")).toHaveAttribute("data-open", "");
      expect(committed()).toEqual(["b"]);
      expectNotPending(root());

      // The commit echoing back through `toggle` does not dispatch again.
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("keeps the revealed content visible while pending, then re-closes it when the parent ignores it", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(
        <Accordion.Root value={[]} valueChangeAction={action} data-testid="root">
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );

      act(() => {
        item("a").setAttribute("open", "");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expectPending(root());
      expectPending(trigger("a"));
      expect(trigger("a")).toHaveAttribute("data-open", "");
      expect(item("a").open).toBe(true); // what the user searched for stays visible

      await act(async () => {
        d.resolve();
      });
      expect(item("a").open).toBe(false); // committed state re-applied after settle
      expect(trigger("a")).not.toHaveAttribute("data-open");
      expectNotPending(root());
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("exclusive, parent accepts: the toggled item wins over an already-open one (walkthrough 9.6)", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [value, setValue] = useState<string | null>("a");
        return (
          <Accordion.Root
            exclusive
            value={value}
            valueChangeAction={(next, details) => {
              action(next, details);
              setValue(next);
            }}
            data-testid="root"
          >
            <Accordion.Item value="a" data-testid="item-a">
              <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
            </Accordion.Item>
            <Accordion.Item value="b" data-testid="item-b">
              <Accordion.Trigger data-testid="trigger-b">B</Accordion.Trigger>
            </Accordion.Item>
          </Accordion.Root>
        );
      }
      render(<Parent />);
      expect(item("a").open).toBe(true);

      act(() => {
        item("b").setAttribute("open", "");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");
      expect(action.mock.calls[0]?.[1]).toMatchObject({
        reason: "platform",
        item: "b",
        open: true,
      });
      expect(item("a").open).toBe(false);
      expect(item("b").open).toBe(true);
      await flushToggle(); // A's close echoes back; no new dispatch
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a platform close dispatches too", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" initial={["a", "b"]} action={action} />);
      act(() => {
        item("a").removeAttribute("open");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toEqual(["b"]);
      expect(action.mock.calls[0]?.[1]).toMatchObject({
        reason: "platform",
        item: "a",
        open: false,
      });
      expect(committed()).toEqual(["b"]);
    });

    renderBoth("platform/user race", (mode) => {
      it("multiple: a platform open while a click is pending keeps both intents", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode={mode} action={action} />);
        const user = setupUser();

        await user.click(trigger("a"));
        expectPending(trigger("a"));
        act(() => {
          item("b").setAttribute("open", "");
        });
        await flushToggle();
        expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
          [["a"], "activate"],
          [["a", "b"], "platform"],
        ]);
        expect(trigger("a")).toHaveAttribute("data-open", "");
        expect(trigger("b")).toHaveAttribute("data-open", "");

        await act(async () => {
          d.resolve();
        });
        expect(item("a").open).toBe(true);
        expect(item("b").open).toBe(true);
        expect(committed()).toEqual(["a", "b"]);
        expectNotPending(root());
      });

      it("exclusive: the platform-opened item wins over the pending click", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode={mode} exclusive action={action} />);
        const user = setupUser();

        await user.click(trigger("a"));
        act(() => {
          item("b").setAttribute("open", "");
        });
        await flushToggle();
        expect(action.mock.calls.map(([next]) => next)).toEqual(["a", "b"]);
        expect(trigger("a")).not.toHaveAttribute("data-open");
        expect(trigger("b")).toHaveAttribute("data-open", "");

        await act(async () => {
          d.resolve();
        });
        expect(item("a").open).toBe(false);
        expect(item("b").open).toBe(true);
        expect(committed()).toBe("b");
      });
    });

    it("a disabled item is re-closed without dispatching", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Harness mode="uncontrolled" action={action} items={[{ value: "a", disabled: true }]} />,
      );
      act(() => {
        item("a").setAttribute("open", "");
      });
      await flushToggle();
      expect(action).not.toHaveBeenCalled();
      expect(item("a").open).toBe(false);
      expect(trigger("a")).not.toHaveAttribute("data-open");
    });

    it("JS-free mode: a platform open is simply the browser's business", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Accordion.Root>
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      act(() => {
        item("a").setAttribute("open", "");
      });
      await flushToggle();
      expect(item("a").open).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("hydration: clicks before hydration (design 2.3)", () => {
    /** Server-renders `ui`, "clicks" the given items before hydration, then hydrates. */
    async function hydrate(ui: ReactNode, preOpen: readonly string[]) {
      const container = document.createElement("div");
      container.innerHTML = renderToString(ui);
      document.body.append(container);
      for (const v of preOpen) {
        container.querySelector(`[data-testid="item-${v}"]`)!.setAttribute("open", "");
      }
      // The clicks' `toggle` events fire long before hydration in a browser; let jsdom's queued
      // ones go by too, so they are not mistaken for new platform events after hydration.
      await new Promise((resolve) => setImmediate(resolve));
      const result = render(ui, { container, hydrate: true });
      return { ...result, container };
    }

    afterEach(() => {
      document.body.innerHTML = "";
    });

    renderBoth("library mode", (mode) => {
      it("reconciles every pre-opened item in ONE dispatch with reason 'platform' and no event", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(<Harness mode={mode} action={action} />, ["a", "b"]);
        });
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toEqual(["a", "b"]);
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(details.item).toBe("a");
        expect(details.open).toBe(true);
        expect(item("a").open).toBe(true);
        expect(item("b").open).toBe(true);
        expect(item("c").open).toBe(false);
        expect(committed()).toEqual(["a", "b"]);
        expectNotPending(root());
        // No hydration-mismatch warning: `suppressHydrationWarning` covers the `open` attribute.
        expect(consoleError).not.toHaveBeenCalled();
      });
    });

    it("exclusive: the first pre-opened item in document order wins", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(<Harness mode="uncontrolled" exclusive action={action} />, ["b", "c"]);
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");
      expect(item("b").open).toBe(true);
      expect(item("c").open).toBe(false);
    });

    it("a pre-opened disabled item is put back without dispatching", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(
          <Harness mode="uncontrolled" action={action} items={[{ value: "a", disabled: true }]} />,
          ["a"],
        );
      });
      expect(action).not.toHaveBeenCalled();
      expect(item("a").open).toBe(false);
    });

    it("JS-free mode: the browser's state stays and nothing warns", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const ui = (
        <Accordion.Root exclusive>
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
          </Accordion.Item>
          <Accordion.Item value="b" data-testid="item-b">
            <Accordion.Trigger data-testid="trigger-b">B</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      );
      await act(async () => {
        await hydrate(ui, ["b"]);
      });
      await flushToggle();
      expect(item("b").open).toBe(true);
      expect(item("a").open).toBe(false);
      expect(item("b")).not.toHaveAttribute("data-open");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("StrictMode: a pre-opened item stays open through the double effect run and a slow accept", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      function Parent() {
        const [value, setValue] = useState<string[]>([]);
        return (
          <Accordion.Root
            value={value}
            valueChangeAction={async (next, details) => {
              await action(next, details);
              startTransition(() => setValue(next));
            }}
            data-testid="root"
          >
            <Accordion.Item value="a" data-testid="item-a">
              <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
            </Accordion.Item>
          </Accordion.Root>
        );
      }
      const flips: boolean[] = [];
      await act(async () => {
        const { container } = await hydrate(
          <StrictMode>
            <Parent />
          </StrictMode>,
          ["a"],
        );
        new MutationObserver(() => {
          flips.push(container.querySelector("details")!.open);
        }).observe(container.querySelector("details")!, { attributeFilter: ["open"] });
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(item("a").open).toBe(true);
      expectPending(root());
      await act(async () => {
        d.resolve();
      });
      expect(item("a").open).toBe(true);
      expectNotPending(root());
      // The attribute never flipped off: no dev-only flash.
      expect(flips.every(Boolean)).toBe(true);
    });
  });

  describe("multiple-mode value order", () => {
    it("lists open items in document order, not in the order they were opened", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.click(trigger("c"));
      await user.click(trigger("a"));
      await user.click(trigger("b"));
      expect(action.mock.calls.map(([next]) => next)).toEqual([["c"], ["a", "c"], ["a", "b", "c"]]);
      expect(committed()).toEqual(["a", "b", "c"]);
    });
  });

  describe("dev warnings", () => {
    it("warns once when the mode changes after mount", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = render(
        <Accordion.Root>
          <Accordion.Item value="a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(consoleError).not.toHaveBeenCalled();
      rerender(
        <Accordion.Root defaultValue={[]}>
          <Accordion.Item value="a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      rerender(
        <Accordion.Root defaultValue={["a"]}>
          <Accordion.Item value="a">
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/mode changed after mount/);
    });

    it("warns once when `value` and `defaultValue` are both set", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<Accordion.Root value={[]} defaultValue={[]} />);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/both `value` and `defaultValue`/);
    });

    it("does not warn in normal use of either mode", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { unmount } = render(<Harness mode="uncontrolled" />);
      const user = setupUser();
      await user.click(trigger("a"));
      await flushToggle();
      unmount();
      render(
        <Accordion.Root exclusive>
          <Accordion.Item value="a" defaultOpen data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
            <Accordion.Panel>Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      await user.click(trigger("a"));
      await flushToggle();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("Trigger and Panel outside an Item throw", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<Accordion.Trigger>A</Accordion.Trigger>)).toThrow(
        /must be rendered inside an Accordion\.Item/,
      );
      expect(() => render(<Accordion.Panel>A</Accordion.Panel>)).toThrow(
        /must be rendered inside an Accordion\.Item/,
      );
    });
  });

  describe("transition prop (smoke)", () => {
    const tree = (transition: string | undefined) => (
      <Accordion.Root defaultValue={["a"]}>
        <Accordion.Item value="a" transition={transition}>
          <Accordion.Trigger transition={transition}>A</Accordion.Trigger>
          <Accordion.Panel transition={transition}>Alpha</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    );

    it("renders the same markup with and without `transition` in library mode", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const plain = render(tree(undefined)).container.innerHTML;
      const withTransition = render(tree("fsui-grow")).container.innerHTML;
      expect(withTransition).toBe(plain);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("still dispatches with a transition set", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Accordion.Root defaultValue={[]} valueChangeAction={action}>
          <Accordion.Item value="a" transition="fsui-grow" data-testid="item-a">
            <Accordion.Trigger transition="fsui-grow" data-testid="trigger-a">
              A
            </Accordion.Trigger>
            <Accordion.Panel transition="fsui-grow">Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const user = setupUser();
      await user.click(trigger("a"));
      expect(action).toHaveBeenCalledWith(["a"], expect.anything());
      expect(item("a").open).toBe(true);
    });

    it("warns on each part in JS-free mode", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Accordion.Root>
          <Accordion.Item value="a" transition="fsui-grow">
            <Accordion.Trigger transition="fsui-grow">A</Accordion.Trigger>
            <Accordion.Panel transition="fsui-grow">Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      const messages = consoleError.mock.calls.map((c) => String(c[0]));
      expect(messages).toHaveLength(3);
      expect(messages.join("\n")).toMatch(/Accordion\.Item: `transition` has no effect/);
      expect(messages.join("\n")).toMatch(/Accordion\.Trigger: `transition` has no effect/);
      expect(messages.join("\n")).toMatch(/Accordion\.Panel: `transition` has no effect/);
    });
  });

  describe("experimental_interpolateSize", () => {
    it("adds `interpolate-size: allow-keywords` to the Root style; the consumer's style wins", () => {
      let seen: ComponentPropsWithRef<"div">["style"];
      render(
        <Accordion.Root
          experimental_interpolateSize
          style={{ color: "red" }}
          render={(props) => {
            seen = props.style;
            return <div {...props} />;
          }}
        />,
      );
      expect(seen).toEqual({ interpolateSize: "allow-keywords", color: "red" });

      render(
        <Accordion.Root
          experimental_interpolateSize
          style={{ interpolateSize: "numeric-only" }}
          render={(props) => {
            seen = props.style;
            return <div {...props} />;
          }}
        />,
      );
      expect(seen).toEqual({ interpolateSize: "numeric-only" });
    });

    it("adds nothing when off", () => {
      render(<Accordion.Root data-testid="root" />);
      expect(root()).not.toHaveAttribute("style");
    });
  });

  describe("details (virtual `event`)", () => {
    it("serialises to the plain fields only", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      const user = setupUser();
      await user.click(trigger("a"));
      const details = action.mock.calls[0]![1];
      expect(details.event).toBeInstanceOf(window.Event);
      expect("event" in details).toBe(true);
      expect(Object.keys(details)).toEqual(["reason", "item", "open"]);
      expect(JSON.parse(JSON.stringify(details))).toEqual({
        reason: "activate",
        item: "a",
        open: true,
      });
    });
  });

  describe("standalone Item (no Root)", () => {
    it("is a JS-free disclosure and unmounts cleanly", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { unmount } = render(
        <Accordion.Item value="solo" data-testid="item-solo">
          <Accordion.Trigger data-testid="trigger-solo">Solo</Accordion.Trigger>
          <Accordion.Panel data-testid="panel-solo">{({ open }) => String(open)}</Accordion.Panel>
        </Accordion.Item>,
      );
      const user = setupUser();
      expect(item("solo").open).toBe(false);
      expect(panel("solo")).toHaveTextContent("undefined");
      await user.click(trigger("solo"));
      await flushToggle();
      expect(item("solo").open).toBe(true);
      expect(item("solo")).not.toHaveAttribute("data-open");
      unmount();
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("refs", () => {
    it("attaches consumer refs on every part; callback refs may return a cleanup", () => {
      const cleanup = vi.fn();
      const itemRef = vi.fn((_node: HTMLDetailsElement) => cleanup);
      const rootRef = { current: null as HTMLDivElement | null };
      const triggerRef = { current: null as HTMLElement | null };
      const panelRef = { current: null as HTMLDivElement | null };
      const { unmount } = render(
        <Accordion.Root ref={rootRef}>
          <Accordion.Item value="a" ref={itemRef} data-testid="item-a">
            <Accordion.Trigger ref={triggerRef}>A</Accordion.Trigger>
            <Accordion.Panel ref={panelRef}>Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );
      expect(rootRef.current?.tagName).toBe("DIV");
      expect(itemRef).toHaveBeenCalledWith(item("a"));
      expect(triggerRef.current?.tagName).toBe("SUMMARY");
      expect(panelRef.current?.tagName).toBe("DIV");
      unmount();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(rootRef.current).toBeNull();
      expect(triggerRef.current).toBeNull();
    });
  });
});
