// Collapsible tests, after the test plan of the design (design/CHANGELOG.md, "#163: Collapsible
// designed"); design/components/collapsible.md.
//
// What jsdom cannot observe is covered elsewhere (conventions 10.1):
// - Enter/Space on a focused <summary> synthesize a click in browsers but not in jsdom.
//   Keyboard toggling is covered here through the click path (the same handler);
//   `collapsible.browser.test.tsx` presses the keys, in library mode and JS-free.
// - Find-in-page cannot be simulated. The platform path is driven by `setAttribute("open", "")`,
//   which makes jsdom fire `toggle` on a macrotask exactly like a browser does.
// - ViewTransition and `interpolate-size`: jsdom has neither; the value-action suite smoke-tests
//   `transition`, `collapsible.browser.test.tsx` runs one, and the `fsui-collapsible` types are
//   in collapsible-transition-types.test.tsx.
//
// The action-prop rows shared by every value component (sync and async actions, rejection,
// overlap, superseded rejection, the post-await rule, the controlled veto, `transition`, details,
// the open/defaultOpen warnings) come from __tests__/value-action-suite.tsx (driver
// __tests__/drivers/collapsible.tsx).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity, StrictMode, Suspense, startTransition, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  sequencedDeferreds,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  hydrateFromServer,
  renderBoth,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { collapsibleDriver } from "../__tests__/drivers/collapsible.js";
import { describeValueAction } from "../__tests__/value-action-suite.js";
import { Collapsible } from "./index.js";
import type {
  CollapsibleOpenChangeDetails,
  CollapsiblePanelState,
  CollapsibleRootState,
  CollapsibleTriggerState,
} from "./index.js";

type ActionFn = (next: boolean, details: CollapsibleOpenChangeDetails) => void | Promise<void>;

interface HarnessProps {
  mode: ControlMode;
  initial?: boolean;
  /** The consumer's work; awaited by the harness's change action. */
  action?: ActionFn;
  /** Wrap the Root in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** The Panel renders this suspender (key "content") while open; everything under one Suspense. */
  suspender?: ReturnType<typeof createSuspender>;
  disabled?: boolean;
  /** Controlled only: the parent never adopts a value. */
  veto?: boolean;
  /** Render a link inside the Trigger (nested interactive content). */
  link?: boolean;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows "update on success"
 * (design 2.2, fourth example); the uncontrolled variant mirrors the committed value in a sibling
 * so both modes expose it the same way.
 */
function Harness({
  mode,
  initial = false,
  action,
  boundary,
  suspender,
  disabled,
  veto = false,
  link = false,
}: HarnessProps) {
  const [committed, setCommitted] = useState(initial);
  const openChangeAction = async (next: boolean, details: CollapsibleOpenChangeDetails) => {
    await action?.(next, details);
    if (veto) return;
    startTransition(() => setCommitted(next));
  };
  let collapsible: ReactNode = (
    <Collapsible.Root
      {...(mode === "controlled" ? { open: committed } : { defaultOpen: initial })}
      openChangeAction={openChangeAction}
      disabled={disabled}
      data-testid="root"
    >
      <Collapsible.Trigger data-testid="trigger">
        Details
        {link && (
          <a href="#somewhere" data-testid="link">
            link
          </a>
        )}
      </Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel">
        {({ open }) => (
          <>
            <span data-testid="panel-open">{String(open)}</span>
            {suspender && open && <suspender.Suspender value="content" />}
          </>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
  if (boundary) collapsible = <ErrorCatcher onError={boundary}>{collapsible}</ErrorCatcher>;
  const content = (
    <>
      {collapsible}
      <output data-testid="committed">{String(committed)}</output>
    </>
  );
  return suspender ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{content}</Suspense>
  ) : (
    content
  );
}

function JsFree({ disabled }: { disabled?: boolean }) {
  return (
    <Collapsible.Root data-testid="root" disabled={disabled}>
      <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel">{({ open }) => String(open)}</Collapsible.Panel>
    </Collapsible.Root>
  );
}

const root = () => screen.getByTestId("root") as HTMLDetailsElement;
const trigger = () => screen.getByTestId("trigger");
const panel = () => screen.getByTestId("panel");
const panelOpen = () => screen.getByTestId("panel-open");
const committed = () => screen.getByTestId("committed").textContent;

/**
 * `toggle` is dispatched from a queued task (browser and jsdom alike); run it inside `act`. jsdom
 * queues it with `setImmediate`, which a `setTimeout(0)` can race, so wait for an immediate: they
 * run in FIFO order, after the ones jsdom queued.
 */
const flushToggle = () =>
  act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

/** A cancelable click dispatched on the Trigger; returns whether it was default-prevented. */
async function clickPrevented(): Promise<boolean> {
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => {
    trigger().dispatchEvent(click);
  });
  return click.defaultPrevented;
}

describeValueAction(collapsibleDriver);

describe("Collapsible", () => {
  describe("roles and ARIA", () => {
    it("renders details > summary + div with no added ARIA", () => {
      render(<Harness mode="uncontrolled" />);
      expect(root().tagName).toBe("DETAILS");
      expect(trigger().tagName).toBe("SUMMARY");
      expect(trigger()).toBe(root().firstElementChild);
      expect(panel().tagName).toBe("DIV");
      expect(panel().parentElement).toBe(root());
      for (const el of [root(), trigger(), panel()]) {
        expect(el).not.toHaveAttribute("role");
        for (const attr of el.getAttributeNames()) expect(attr).not.toMatch(/^aria-/);
      }
      expect(root()).not.toHaveAttribute("name");
      // The summary is the engine's disclosure control; the name is the Trigger's content.
      expect(screen.getByRole("group")).toBe(root());
    });

    it("`disabled` renders aria-disabled on the Trigger and data-disabled on every part", () => {
      render(<Harness mode="uncontrolled" disabled />);
      expect(trigger()).toHaveAttribute("aria-disabled", "true");
      for (const el of [root(), trigger(), panel()])
        expect(el).toHaveAttribute("data-disabled", "");
    });

    it("passes native props through on every part", () => {
      const onPointerDown = vi.fn();
      render(
        <Collapsible.Root id="c" data-testid="root" onPointerDown={onPointerDown}>
          <Collapsible.Trigger title="hint" data-testid="trigger">
            A
          </Collapsible.Trigger>
          <Collapsible.Panel lang="en" data-testid="panel">
            Alpha
          </Collapsible.Panel>
        </Collapsible.Root>,
      );
      expect(root()).toHaveAttribute("id", "c");
      expect(trigger()).toHaveAttribute("title", "hint");
      expect(panel()).toHaveAttribute("lang", "en");
      fireEvent.pointerDown(root());
      expect(onPointerDown).toHaveBeenCalledTimes(1);
    });
  });

  describe("modes (design 2)", () => {
    it("JS-free mode: no data-open / data-pending, no handlers, the browser toggles natively", async () => {
      render(<JsFree />);
      const user = setupUser();
      expect(root().open).toBe(false);
      expect(panel()).toHaveTextContent("undefined");
      for (const el of [root(), trigger()]) {
        expect(el).not.toHaveAttribute("data-open");
        expect(el).not.toHaveAttribute("data-pending");
      }

      await user.click(trigger());
      await flushToggle();
      expect(root().open).toBe(true);
      expect(root().matches(":open")).toBe(true);
      // Still nothing emitted: the browser owns `open` (use `:open` in CSS).
      expect(root()).not.toHaveAttribute("data-open");
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(panel()).toHaveTextContent("undefined");

      // No click handler: the click is not default-prevented (the native toggle runs).
      expect(await clickPrevented()).toBe(false);
      expect(root().open).toBe(false);

      // No toggle handler: a platform flip is left alone (nothing re-applied, nothing emitted).
      const consoleError = silenceErrors();
      act(() => {
        root().setAttribute("open", "");
      });
      await flushToggle();
      expect(root().open).toBe(true);
      expect(root()).not.toHaveAttribute("data-open");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("`defaultOpen` selects library mode: <details open>, data-open, intercepted clicks", async () => {
      render(
        <Collapsible.Root defaultOpen data-testid="root">
          <Collapsible.Trigger data-testid="trigger">A</Collapsible.Trigger>
          <Collapsible.Panel data-testid="panel">{({ open }) => String(open)}</Collapsible.Panel>
        </Collapsible.Root>,
      );
      expect(root()).toHaveAttribute("open");
      expect(root()).toHaveAttribute("data-open", "");
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(panel()).toHaveTextContent("true");

      // No action: the toggle runs through the Root's transition and commits at once.
      await setupUser().click(trigger());
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(panel()).toHaveTextContent("false");
      expectNotPending(root());
    });

    it("`defaultOpen={false}` is library mode too", async () => {
      const childState = vi.fn((s: CollapsibleRootState) => String(s.open));
      render(
        <Collapsible.Root defaultOpen={false} data-testid="root">
          <Collapsible.Trigger data-testid="trigger">{childState}</Collapsible.Trigger>
          <Collapsible.Panel data-testid="panel">{({ open }) => String(open)}</Collapsible.Panel>
        </Collapsible.Root>,
      );
      expect(childState).toHaveBeenLastCalledWith({ open: false, pending: false, disabled: false });
      expect(panel()).toHaveTextContent("false");
      expect(await clickPrevented()).toBe(true);
      expect(root().open).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(panel()).toHaveTextContent("true");
    });

    it("`open` alone (no action) is controlled library mode: a click is refused", async () => {
      render(
        <Collapsible.Root open={false} data-testid="root">
          <Collapsible.Trigger data-testid="trigger">A</Collapsible.Trigger>
        </Collapsible.Root>,
      );
      await setupUser().click(trigger());
      await flushToggle();
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });
  });

  renderBoth("sync action", (mode) => {
    it("a disabled Collapsible never dispatches and the click is default-prevented", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} disabled />);
      await setupUser().click(trigger());
      expect(await clickPrevented()).toBe(true);
      await flushToggle();
      expect(action).not.toHaveBeenCalled();
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("clicking a link inside the summary neither toggles nor dispatches", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} link />);
      const user = setupUser();
      await user.click(screen.getByTestId("link"));
      expect(action).not.toHaveBeenCalled();
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
      // The summary itself still works.
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      expect(root().open).toBe(true);
    });
  });

  it("clicking a form control inside the summary neither toggles nor dispatches", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <Collapsible.Root defaultOpen={false} openChangeAction={action} data-testid="root">
        <Collapsible.Trigger data-testid="trigger">
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
        </Collapsible.Trigger>
      </Collapsible.Root>,
    );
    const user = setupUser();
    for (const id of ["select", "textarea", "editable", "text", "checkbox"]) {
      await user.click(screen.getByTestId(id));
      await flushToggle();
      expect(root().open, id).toBe(false);
      expect(action, id).not.toHaveBeenCalled();
    }
    // Controls with their own activation behaviour keep it.
    expect(screen.getByTestId("checkbox")).toBeChecked();
  });

  it("JS-free `disabled`: the click is cancelled and nothing toggles", async () => {
    render(<JsFree disabled />);
    expect(trigger()).toHaveAttribute("aria-disabled", "true");
    expect(await clickPrevented()).toBe(true);
    await flushToggle();
    expect(root().open).toBe(false);
  });

  renderBoth("async action", (mode) => {
    it("a second click while pending reverses the first; pending stays until both settle", async () => {
      const deferreds = sequencedDeferreds(2);
      const action = vi.fn<ActionFn>(() => deferreds.next());
      render(<Harness mode={mode} action={action} />);
      const user = setupUser();

      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      await user.click(trigger());
      expect(action.mock.calls.map(([next]) => next)).toEqual([true, false]);
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(root()).not.toHaveAttribute("data-open");
      // The Root's own transition: pending although optimistic equals committed (design 2.2).
      expectPending(root());
      expectPending(trigger());

      await act(async () => {
        deferreds[0]!.resolve();
      });
      expectPending(trigger());
      await act(async () => {
        deferreds[1]!.resolve();
      });
      expectNotPending(root());
      expectNotPending(trigger());
      expect(root().open).toBe(false);
      expect(committed()).toBe("false");
    });

    it("a rejection reverts data-open, never opens, and reaches the Error Boundary", async () => {
      silenceErrors();
      const d = deferred();
      const boundary = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={boundary} />);
      await setupUser().click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(root().open).toBe(false);
      await act(async () => {
        d.reject(new Error("nope"));
      });
      expect(boundary).toHaveBeenCalledTimes(1);
      expect(String(boundary.mock.calls[0]?.[0])).toMatch(/nope/);
      expect(screen.queryByTestId("root")).not.toBeInTheDocument();
      expect(committed()).toBe("false");
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps the <details> closed and pending until lazily mounted content is ready", async () => {
      const suspender = createSuspender();
      render(<Harness mode={mode} suspender={suspender} />);
      await setupUser().click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      expectPending(trigger());
      expectPending(root());
      expect(root().open).toBe(false);
      expect(panelOpen()).toHaveTextContent("false");
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
      expect(screen.queryByTestId("suspender")).not.toBeInTheDocument();

      await act(async () => {
        suspender.resolve("content");
      });
      expect(root().open).toBe(true);
      expect(panelOpen()).toHaveTextContent("true");
      expect(screen.getByTestId("suspender")).toHaveTextContent("content");
      expectNotPending(trigger());
      expectNotPending(root());
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });
  });

  describe("function props", () => {
    it("every part receives its documented state (library mode)", async () => {
      const d = deferred();
      const rootClass = vi.fn((s: CollapsibleRootState) => (s.pending ? "busy" : "idle"));
      const rootStyle = vi.fn((s: CollapsibleRootState) => ({ opacity: s.open ? 1 : 0.5 }));
      const triggerChildren = vi.fn((s: CollapsibleTriggerState) =>
        s.pending ? "Opening" : s.open ? "Close" : "Open",
      );
      const panelClass = vi.fn((s: CollapsiblePanelState) => (s.open ? "shown" : "hidden"));
      render(
        <Collapsible.Root
          openChangeAction={() => d.promise}
          className={rootClass}
          style={rootStyle}
          data-testid="root"
        >
          <Collapsible.Trigger data-testid="trigger">{triggerChildren}</Collapsible.Trigger>
          <Collapsible.Panel className={panelClass} data-testid="panel">
            Alpha
          </Collapsible.Panel>
        </Collapsible.Root>,
      );
      const idle: CollapsibleRootState = { open: false, pending: false, disabled: false };
      expect(rootClass).toHaveBeenLastCalledWith(idle);
      expect(rootStyle).toHaveBeenLastCalledWith(idle);
      expect(triggerChildren).toHaveBeenLastCalledWith(idle);
      expect(panelClass).toHaveBeenLastCalledWith({ open: false, disabled: false });
      expect(trigger()).toHaveTextContent("Open");

      await setupUser().click(trigger());
      const inFlight: CollapsibleRootState = { open: true, pending: true, disabled: false };
      expect(rootClass).toHaveBeenLastCalledWith(inFlight);
      expect(triggerChildren).toHaveBeenLastCalledWith(inFlight);
      // Panel state is committed: still closed.
      expect(panelClass).toHaveBeenLastCalledWith({ open: false, disabled: false });
      expect(root()).toHaveClass("busy");
      expect(root()).toHaveStyle({ opacity: "1" });
      expect(trigger()).toHaveTextContent("Opening");
      expect(panel()).toHaveClass("hidden");

      await act(async () => {
        d.resolve();
      });
      expect(rootClass).toHaveBeenLastCalledWith({ ...idle, open: true });
      expect(panelClass).toHaveBeenLastCalledWith({ open: true, disabled: false });
      expect(trigger()).toHaveTextContent("Close");
      expect(panel()).toHaveClass("shown");
    });

    it("JS-free mode passes `open: undefined` and `disabled`", () => {
      const rootChildren = vi.fn((s: CollapsibleRootState) => (
        <>
          <Collapsible.Trigger>{String(s.open)}</Collapsible.Trigger>
          <Collapsible.Panel>{(p) => `${String(p.open)}/${String(p.disabled)}`}</Collapsible.Panel>
        </>
      ));
      render(
        <Collapsible.Root disabled data-testid="root">
          {rootChildren}
        </Collapsible.Root>,
      );
      expect(rootChildren).toHaveBeenLastCalledWith({
        open: undefined,
        pending: false,
        disabled: true,
      });
      expect(root()).toHaveTextContent("undefined/true");
    });
  });

  describe("render prop", () => {
    function MyDetails({ ref, ...props }: ComponentPropsWithRef<"details">) {
      return <details ref={ref} data-my-details="" {...props} />;
    }

    it("element form on Root and Trigger merges props, forwards refs and keeps dispatching", async () => {
      const action = vi.fn<ActionFn>();
      const rootRef = { current: null as HTMLDetailsElement | null };
      const elementRef = { current: null as HTMLDetailsElement | null };
      const triggerRef = { current: null as HTMLElement | null };
      const order: string[] = [];
      render(
        <Collapsible.Root
          openChangeAction={(next, details) => {
            order.push("library");
            action(next, details);
          }}
          ref={rootRef}
          className="card"
          style={{ opacity: 0.5, color: "blue" }}
          data-testid="root"
          render={<MyDetails ref={elementRef} className="x" style={{ color: "red" }} />}
        >
          <Collapsible.Trigger
            ref={triggerRef}
            data-testid="trigger"
            render={<summary className="y" onClick={() => order.push("element")} />}
          >
            A
          </Collapsible.Trigger>
          <Collapsible.Panel render={<section />} data-testid="panel">
            Alpha
          </Collapsible.Panel>
        </Collapsible.Root>,
      );
      expect(root()).toHaveAttribute("data-my-details", "");
      expect(root()).toHaveClass("card", "x");
      expect(root()).toHaveStyle({ color: "rgb(255, 0, 0)", opacity: "0.5" });
      expect(rootRef.current).toBe(root());
      expect(elementRef.current).toBe(root());
      expect(trigger()).toHaveClass("y");
      expect(triggerRef.current).toBe(trigger());
      expect(panel().tagName).toBe("SECTION");

      await setupUser().click(trigger());
      expect(order).toEqual(["element", "library"]);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(root().open).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
    });

    it("element form: library-controlled keys are owned", async () => {
      render(
        <Collapsible.Root
          defaultOpen
          data-testid="root"
          render={<details data-open="nope" data-pending="nope" name="g" />}
        >
          <Collapsible.Trigger
            data-testid="trigger"
            render={<summary data-open="nope" aria-disabled="false" />}
          >
            A
          </Collapsible.Trigger>
        </Collapsible.Root>,
      );
      expect(root()).toHaveAttribute("data-open", "");
      expect(root()).not.toHaveAttribute("data-pending");
      // A second writer of `open` (the platform's `name` group) is removed.
      expect(root()).not.toHaveAttribute("name");
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(trigger()).not.toHaveAttribute("aria-disabled");
      await setupUser().click(trigger());
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("element form in JS-free mode keeps the element's own onToggle and onClick", async () => {
      const onToggle = vi.fn();
      const onClick = vi.fn();
      render(
        <Collapsible.Root data-testid="root" render={<details onToggle={onToggle} />}>
          <Collapsible.Trigger data-testid="trigger" render={<summary onClick={onClick} />}>
            A
          </Collapsible.Trigger>
        </Collapsible.Root>,
      );
      await setupUser().click(trigger());
      await flushToggle();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(root().open).toBe(true);
    });

    it("function form receives (props, state)", async () => {
      const d = deferred();
      const renderTrigger = vi.fn(
        (props: ComponentPropsWithRef<"summary">, state: CollapsibleTriggerState) => (
          <summary {...props} aria-busy={state.pending || undefined}>
            {state.open ? "On" : "Off"}
          </summary>
        ),
      );
      render(
        <Collapsible.Root openChangeAction={() => d.promise} data-testid="root">
          <Collapsible.Trigger data-testid="trigger" render={renderTrigger} />
        </Collapsible.Root>,
      );
      expect(trigger()).toHaveTextContent("Off");
      expect(renderTrigger).toHaveBeenLastCalledWith(
        expect.objectContaining({ "data-testid": "trigger" }),
        { open: false, pending: false, disabled: false },
      );
      await setupUser().click(trigger());
      expect(trigger()).toHaveTextContent("On");
      expect(trigger()).toHaveAttribute("aria-busy", "true");
      await act(async () => {
        d.resolve();
      });
      expect(trigger()).not.toHaveAttribute("aria-busy");
      expect(root().open).toBe(true);
    });

    it("warns in development when the mounted element is not <details> / <summary>", () => {
      const consoleError = silenceErrors();
      render(
        <Collapsible.Root render={<div />}>
          <Collapsible.Trigger render={<button type="button" />}>A</Collapsible.Trigger>
        </Collapsible.Root>,
      );
      const messages = consoleError.mock.calls.map((c) => String(c[0]));
      const details = messages.find((m) =>
        /^Collapsible\.Root: expected to render a <details>/.test(m),
      );
      // Collapsible's own semantics: it has no exclusive group (`name` is owned).
      expect(details).toMatch(/\(toggle, find-in-page, ::details-content\)/);
      expect(details).not.toMatch(/exclusive/);
      expect(
        messages.some((m) => /^Collapsible\.Trigger: expected to render a <summary>/.test(m)),
      ).toBe(true);
    });
  });

  describe("platform path (design 2.2): the browser opens the <details> itself", () => {
    it("dispatches with reason 'platform' and the `toggle` event; uncontrolled commits it", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);

      act(() => {
        root().setAttribute("open", "");
      });
      expect(action).not.toHaveBeenCalled(); // `toggle` is a queued task
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("platform");
      expect(details.event?.type).toBe("toggle");
      expect(JSON.parse(JSON.stringify(details))).toEqual({ reason: "platform" });
      expect(root().open).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(panelOpen()).toHaveTextContent("true");
      expect(committed()).toBe("true");
      expectNotPending(root());

      // The commit echoing back through `toggle` does not dispatch again.
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a platform close dispatches too", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" initial action={action} />);
      act(() => {
        root().removeAttribute("open");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(false);
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expect(committed()).toBe("false");
      expect(root().open).toBe(false);
    });

    it("keeps the revealed content visible while pending, then re-closes it when the parent refuses", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode="controlled" action={action} veto />);

      act(() => {
        root().setAttribute("open", "");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expectPending(root());
      expectPending(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      expect(root().open).toBe(true); // what the user searched for stays visible

      await act(async () => {
        d.resolve();
      });
      expect(root().open).toBe(false); // committed state re-applied after settle
      expect(trigger()).not.toHaveAttribute("data-open");
      expectNotPending(root());
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
    });

    renderBoth("rejected reveal", (mode) => {
      it("reaches the Error Boundary and commits nothing", async () => {
        silenceErrors();
        const d = deferred();
        const boundary = vi.fn();
        render(<Harness mode={mode} action={() => d.promise} boundary={boundary} />);
        const details = root();
        act(() => {
          details.setAttribute("open", "");
        });
        await flushToggle();
        expect(details.open).toBe(true);
        await act(async () => {
          d.reject(new Error("offline"));
        });
        expect(boundary).toHaveBeenCalledTimes(1);
        expect(committed()).toBe("false");
      });
    });

    renderBoth("superseded reveal", (mode) => {
      it("a reveal superseded by a click, then rejected, goes to reportError; the Root stays", async () => {
        const reportError = vi.fn();
        vi.stubGlobal("reportError", reportError);
        const ds = sequencedDeferreds(2);
        const boundary = vi.fn();
        const action = vi.fn<ActionFn>(() => ds.next());
        render(<Harness mode={mode} action={action} boundary={boundary} />);

        act(() => {
          root().setAttribute("open", "");
        });
        await flushToggle();
        expect(root().open).toBe(true); // revealed, pending
        // The user closes it again while the reveal's action runs.
        await setupUser().click(trigger());
        expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
          [true, "platform"],
          [false, "activate"],
        ]);
        expect(trigger()).not.toHaveAttribute("data-open");

        const err = new Error("reveal not saved");
        await act(async () => {
          ds[0]!.reject(err);
        });
        expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
        expect(boundary).not.toHaveBeenCalled();
        expect(screen.getByTestId("root")).toBeInTheDocument();

        await act(async () => {
          ds[1]!.resolve();
        });
        // The DOM follows the later dispatch: closed.
        expect(root().open).toBe(false);
        expect(trigger()).not.toHaveAttribute("data-open");
        expect(committed()).toBe("false");
        expectNotPending(root());
      });
    });

    it("a reveal equal to the intended value does not dispatch", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode="uncontrolled" action={action} />);
      await setupUser().click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      act(() => {
        root().setAttribute("open", "");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
      expect(root().open).toBe(true);
      expect(committed()).toBe("true");
    });

    it("a platform close while a close is pending equals the intended value: no dispatch", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode="uncontrolled" initial action={action} />);
      await setupUser().click(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(root().open).toBe(true); // committed: still open
      act(() => {
        root().removeAttribute("open");
      });
      await flushToggle();
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.resolve();
      });
      expect(root().open).toBe(false);
      expect(committed()).toBe("false");
      expectNotPending(root());
    });

    describe("the known value tells the library's own write from the browser's (#175)", () => {
      it("a re-open while a close is pending is dispatched, although the DOM is back at committed", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode="uncontrolled" initial action={action} />);
        await setupUser().click(trigger());
        expect(root().open).toBe(true); // committed: still open
        // A script closes it (equal to the intended value: nothing to dispatch) ...
        act(() => {
          root().removeAttribute("open");
        });
        await flushToggle();
        expect(action).toHaveBeenCalledTimes(1);
        // ... and find-in-page re-opens it in a later task.
        act(() => {
          root().setAttribute("open", "");
        });
        await flushToggle();
        expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
          [false, "activate"],
          [true, "platform"],
        ]);
        expect(trigger()).toHaveAttribute("data-open", "");

        await act(async () => {
          d.resolve();
        });
        await flushToggle();
        expect(root().open).toBe(true); // the revealed content stays
        expect(committed()).toBe("true");
        expect(action).toHaveBeenCalledTimes(2);
        expectNotPending(root());
      });

      it("the mirror: a platform close while an open is pending is dispatched", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode="uncontrolled" action={action} />);
        await setupUser().click(trigger());
        expect(root().open).toBe(false); // committed: still closed
        act(() => {
          root().setAttribute("open", "");
        });
        await flushToggle();
        expect(action).toHaveBeenCalledTimes(1);
        act(() => {
          root().removeAttribute("open");
        });
        await flushToggle();
        expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
          [true, "activate"],
          [false, "platform"],
        ]);

        await act(async () => {
          d.resolve();
        });
        await flushToggle();
        expect(root().open).toBe(false);
        expect(committed()).toBe("false");
        expect(action).toHaveBeenCalledTimes(2);
      });

      it("a click between a commit and that commit's `toggle` stands: the echo is not dispatched", async () => {
        const d = deferred();
        const action = vi.fn<ActionFn>(() => d.promise);
        render(<Harness mode="uncontrolled" action={action} />);
        await setupUser().click(trigger());
        const details = root();
        const toggles = vi.fn();
        details.addEventListener("toggle", toggles);
        // The click runs right after React writes `open` (a microtask of the commit's task), so
        // the commit's `toggle` task is still queued: the click changes the intended value first.
        let openAtClick: boolean | undefined;
        let togglesAtClick = -1;
        const observer = new MutationObserver(() => {
          observer.disconnect();
          openAtClick = details.open;
          togglesAtClick = toggles.mock.calls.length;
          fireEvent.click(trigger());
        });
        observer.observe(details, { attributeFilter: ["open"] });

        await act(async () => {
          d.resolve();
        });
        expect(openAtClick).toBe(true); // committed and written by React
        expect(togglesAtClick).toBe(0); // its `toggle` was not delivered yet
        await flushToggle();
        expect(toggles).toHaveBeenCalled();
        expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
        await flushToggle();
        expect(root().open).toBe(false);
        expect(committed()).toBe("false");
      });
    });

    it("a disabled Collapsible is re-closed without dispatching", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} disabled />);
      act(() => {
        root().setAttribute("open", "");
      });
      await flushToggle();
      expect(action).not.toHaveBeenCalled();
      expect(root().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });
  });

  describe("hydration: clicks before hydration (design 2.2)", () => {
    /** Server-renders `ui`, sets `open` before hydration (a click), then hydrates. */
    const hydrate = (ui: ReactNode, open = true) =>
      hydrateFromServer(ui, {
        mutate: async (container) => {
          const details = container.querySelector("details")!;
          if (open) details.setAttribute("open", "");
          else details.removeAttribute("open");
          // The click's `toggle` fires long before hydration in a browser; let jsdom's queued one
          // go by too, so it is not mistaken for a new platform event after hydration.
          await new Promise((resolve) => setImmediate(resolve));
        },
        flush: null,
      });

    renderBoth("library mode", (mode) => {
      it("reconciles a pre-opened <details> in ONE dispatch with reason 'platform' and no event", async () => {
        const consoleError = silenceErrors();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(<Harness mode={mode} action={action} />);
        });
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(root().open).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expect(committed()).toBe("true");
        expectNotPending(root());
        // No hydration-mismatch warning: `suppressHydrationWarning` covers the `open` attribute.
        expect(consoleError).not.toHaveBeenCalled();
      });

      it("reconciles a pre-closed `defaultOpen` / `open` Collapsible", async () => {
        silenceErrors();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(<Harness mode={mode} initial action={action} />, false);
        });
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0]?.[0]).toBe(false);
        expect(root().open).toBe(false);
        expect(committed()).toBe("false");
      });
    });

    it("a refused pre-hydration open is closed again", async () => {
      silenceErrors();
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(<Harness mode="controlled" action={action} veto />);
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(root().open).toBe(false);
    });

    it("a pre-opened disabled Collapsible is put back without dispatching", async () => {
      silenceErrors();
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(<Harness mode="uncontrolled" action={action} disabled />);
      });
      expect(action).not.toHaveBeenCalled();
      expect(root().open).toBe(false);
    });

    it("JS-free mode: the browser's state stays and nothing warns", async () => {
      const consoleError = silenceErrors();
      await act(async () => {
        await hydrate(<JsFree />);
      });
      await flushToggle();
      expect(root().open).toBe(true);
      expect(root()).not.toHaveAttribute("data-open");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("StrictMode: one dispatch, and the pre-opened <details> stays open through a slow accept", async () => {
      silenceErrors();
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      const flips: boolean[] = [];
      await act(async () => {
        const { container } = await hydrate(
          <StrictMode>
            <Harness mode="controlled" action={action} />
          </StrictMode>,
        );
        new MutationObserver(() => {
          flips.push(container.querySelector("details")!.open);
        }).observe(container.querySelector("details")!, { attributeFilter: ["open"] });
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(root().open).toBe(true);
      expectPending(root());
      await act(async () => {
        d.resolve();
      });
      expect(root().open).toBe(true);
      expectNotPending(root());
      // The attribute never flipped off: no dev-only flash.
      expect(flips.every(Boolean)).toBe(true);
    });
  });

  describe("<Activity>", () => {
    it("reconciles again when an Activity re-shows the Root", async () => {
      const action = vi.fn<ActionFn>();
      function Parent() {
        const [visible, setVisible] = useState(true);
        return (
          <>
            <Activity mode={visible ? "visible" : "hidden"}>
              <Harness mode="uncontrolled" action={action} />
            </Activity>
            <button
              type="button"
              data-testid="toggle-activity"
              onClick={() => setVisible((v) => !v)}
            >
              toggle
            </button>
          </>
        );
      }
      render(<Parent />);
      const user = setupUser();
      await user.click(screen.getByTestId("toggle-activity"));
      // Hidden: effects are disconnected, so a DOM write is not seen by the toggle listener's
      // effects; the reveal's layout effect finds it.
      act(() => {
        root().setAttribute("open", "");
      });
      await flushToggle();
      await user.click(screen.getByTestId("toggle-activity"));
      await flushToggle();
      expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
        [true, "platform"],
      ]);
      expect(root().open).toBe(true);
    });
  });

  describe("dev warnings", () => {
    it("warns once when the mode changes after mount, and keeps the mounted mode", async () => {
      const consoleError = silenceErrors();
      const { rerender } = render(
        <Collapsible.Root data-testid="root">
          <Collapsible.Trigger data-testid="trigger">A</Collapsible.Trigger>
        </Collapsible.Root>,
      );
      expect(consoleError).not.toHaveBeenCalled();
      rerender(
        <Collapsible.Root defaultOpen={false} data-testid="root">
          <Collapsible.Trigger data-testid="trigger">A</Collapsible.Trigger>
        </Collapsible.Root>,
      );
      rerender(
        <Collapsible.Root defaultOpen data-testid="root">
          <Collapsible.Trigger data-testid="trigger">A</Collapsible.Trigger>
        </Collapsible.Root>,
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toMatch(/^Collapsible\.Root: the mode changed/);
      // Still JS-free: nothing emitted, the click is native.
      expect(root()).not.toHaveAttribute("data-open");
      expect(await clickPrevented()).toBe(false);
    });

    it("warns on each part when `transition` is given in JS-free mode", () => {
      const consoleError = silenceErrors();
      render(
        <Collapsible.Root transition="fsui-grow">
          <Collapsible.Trigger transition="fsui-grow">A</Collapsible.Trigger>
          <Collapsible.Panel transition="fsui-grow">Alpha</Collapsible.Panel>
        </Collapsible.Root>,
      );
      const messages = consoleError.mock.calls.map((c) => String(c[0]));
      expect(messages).toHaveLength(3);
      expect(messages.join("\n")).toMatch(/Collapsible\.Root: `transition` has no effect/);
      expect(messages.join("\n")).toMatch(/Collapsible\.Trigger: `transition` has no effect/);
      expect(messages.join("\n")).toMatch(/Collapsible\.Panel: `transition` has no effect/);
    });

    it("does not warn in normal use of either mode", async () => {
      const consoleError = silenceErrors();
      const { unmount } = render(<Harness mode="uncontrolled" />);
      const user = setupUser();
      await user.click(trigger());
      await flushToggle();
      unmount();
      render(<JsFree />);
      await user.click(trigger());
      await flushToggle();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("Trigger and Panel outside a Root throw", () => {
      silenceErrors();
      expect(() => render(<Collapsible.Trigger>A</Collapsible.Trigger>)).toThrow(
        /must be rendered inside a Collapsible\.Root/,
      );
      expect(() => render(<Collapsible.Panel>A</Collapsible.Panel>)).toThrow(
        /must be rendered inside a Collapsible\.Root/,
      );
    });
  });

  describe("experimental_interpolateSize", () => {
    it("adds `interpolate-size: allow-keywords` to the <details> style; the consumer's style wins", () => {
      let seen: ComponentPropsWithRef<"details">["style"];
      const { unmount } = render(
        <Collapsible.Root
          experimental_interpolateSize
          style={{ color: "red" }}
          render={(props) => {
            seen = props.style;
            return <details {...props} />;
          }}
        />,
      );
      expect(seen).toEqual({ interpolateSize: "allow-keywords", color: "red" });
      unmount();

      render(
        <Collapsible.Root
          experimental_interpolateSize
          style={{ interpolateSize: "numeric-only" }}
          render={(props) => {
            seen = props.style;
            return <details {...props} />;
          }}
        />,
      );
      expect(seen).toEqual({ interpolateSize: "numeric-only" });
    });

    it("adds nothing when off", () => {
      render(<Collapsible.Root data-testid="root" />);
      expect(root()).not.toHaveAttribute("style");
    });
  });

  describe("refs", () => {
    it("attaches consumer refs on every part; callback refs may return a cleanup", () => {
      const cleanup = vi.fn();
      const rootRef = vi.fn((_node: HTMLDetailsElement) => cleanup);
      const triggerRef = { current: null as HTMLElement | null };
      const panelRef = { current: null as HTMLDivElement | null };
      const { unmount } = render(
        <Collapsible.Root ref={rootRef} data-testid="root">
          <Collapsible.Trigger ref={triggerRef}>A</Collapsible.Trigger>
          <Collapsible.Panel ref={panelRef}>Alpha</Collapsible.Panel>
        </Collapsible.Root>,
      );
      expect(rootRef).toHaveBeenCalledWith(root());
      expect(triggerRef.current?.tagName).toBe("SUMMARY");
      expect(panelRef.current?.tagName).toBe("DIV");
      unmount();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(triggerRef.current).toBeNull();
      expect(panelRef.current).toBeNull();
    });
  });
});
