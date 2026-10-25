// Dialog tests (jsdom), mapped to design/components/dialog.md section 13.2. jsdom has no
// <dialog> methods, no Invoker Commands and no close watcher; `src/__tests__/dialog-shim.ts`
// provides them (13.1), including invoker clicks and `method="dialog"` submits.
//
// Files: this one (ARIA, JS-free mode, keyboard, function props, render element, light dismiss,
// focus, nested confirm, warnings, and the shared open-state suite,
// src/__tests__/overlay-open-state-suite.tsx), dialog-close.test.tsx (the Close part and the
// library-owned closes, held content), dialog-form.test.tsx (Dialog.Form and `method="dialog"`
// submits) and dialog-disabled.test.tsx (`disabled` with link and component renders). The harness
// is src/__tests__/dialog-harness.tsx.
//
// Not testable here, covered by `dialog.browser.test.tsx` (conventions 10.1):
// - Escape as a real close request (no close watcher in jsdom): the dismiss path is driven with
//   `requestClose()`, which is what a close request does after `cancel`.
// - Top layer, `::backdrop`, `:modal` styling, inertness, `aria-modal` exposure, real focus
//   return, nested-dialog Escape grouping, native `closedby`, exit animations
//   (`getAnimations()` is `[]` in the shim, so the deferred unmount is a browser test) and the
//   CSS scroll lock.
// - ViewTransition: jsdom has no `startViewTransition`; `transition` is smoke-tested, and one
//   row counts calls through a throwing stub (the `held` release is not a view transition).
//   The capture of the library-owned closes (#46) is in the browser file.
//
// N/A rows: none of conventions 10.1 is N/A in library mode. JS-free mode has no action props, so
// its sync/async/rejection/overlap/parity rows do not apply (it is covered by the ARIA, function
// props, Close and Form rows). For the Close part's own `action`, Overlap and Superseded rejection
// are N/A: the re-entry guard means a Close never has two of its own runs in flight (#79, #81);
// the Close "re-entry" rows (D1-D6, design/components/button.md 16.4, in dialog-close.test.tsx)
// replace them.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, use, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { dispatchCommand, isModal } from "../__tests__/dialog-shim.js";
import {
  deferred,
  expectPending,
  renderBoth,
  setupUser,
  flushTasks,
  silenceErrors,
} from "../__tests__/helpers.js";
import { DialogContext } from "./dialog-context.js";
import { Dialog } from "./index.js";
import type {
  DialogCloseState,
  DialogFormState,
  DialogOpenChangeDetails,
  DialogPopupState,
  DialogRootState,
  DialogTriggerState,
} from "./index.js";

import {
  content,
  Harness,
  openThroughTrigger,
  popup,
  spyClose,
  spyShowModal,
  trigger,
} from "../__tests__/dialog-harness.js";
import type { ActionFn } from "../__tests__/dialog-harness.js";
import { describeOverlayOpenState } from "../__tests__/overlay-open-state-suite.js";

describeOverlayOpenState<DialogOpenChangeDetails>({
  name: "Dialog",
  Harness,
  isOpen: () => popup().open,
  spyOpen: spyShowModal,
  spyClose,
  openArgs: () => [],
  dismiss: (value) => popup().requestClose(value),
  dismissEvent: "close",
  partCloses: [
    {
      name: "the Close part",
      close: (user) => user.click(screen.getByTestId("close")),
      cancelsClick: true,
      closeArgs: ["x"],
      returnsFocus: true,
    },
  ],
  detailsKeys: ["reason", "returnValue"],
  triggerToggles: false,
  popoverTarget: false,
  foreignOpen: () => dispatchCommand(popup(), "show-modal", screen.getByTestId("elsewhere")),
  foreignOpenCallsOpen: false,
  openBeforeHydration: (element) => element.setAttribute("open", ""),
  controlledOpenArgs: [],
  controlledCloseArgs: [""],
  closeIntents: {
    render: (probe) => (
      <Dialog.Root>
        <Dialog.Popup data-testid="popup" aria-label="Probe">
          {probe}
        </Dialog.Popup>
      </Dialog.Root>
    ),
    useIntents: () => use(DialogContext)!,
    open: (element) => (element as HTMLDialogElement).showModal(),
  },
});

describe("Dialog", () => {
  describe("roles and ARIA", () => {
    it("renders the documented elements and wires the ids (JS-free mode)", () => {
      render(<Harness mode="static" />);
      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("command", "show-modal");
      const id = t.getAttribute("commandfor");
      expect(id).toBeTruthy();
      const p = popup();
      expect(p.tagName).toBe("DIALOG");
      expect(p.id).toBe(id);
      expect(p).toHaveAttribute("data-modal", "");
      expect(p).not.toHaveAttribute("open");
      expect(p).not.toHaveAttribute("aria-modal");
      expect(p).not.toHaveAttribute("closedby");
      const title = screen.getByTestId("title");
      const description = screen.getByTestId("description");
      expect(title.tagName).toBe("H2");
      expect(description.tagName).toBe("P");
      expect(p.getAttribute("aria-labelledby")).toBe(title.id);
      expect(p.getAttribute("aria-describedby")).toBe(description.id);
      const close = screen.getByTestId("close");
      expect(close).toHaveAttribute("type", "button");
      expect(close).toHaveAttribute("commandfor", id);
      expect(close).toHaveAttribute("command", "request-close");
      expect(close).toHaveAttribute("value", "x");
      // JS-free: no state attributes on the Trigger.
      for (const attr of ["data-open", "data-pending", "data-disabled"]) {
        expect(t).not.toHaveAttribute(attr);
      }
    });

    it("renders identical markup in library mode", () => {
      render(<Harness mode="uncontrolled" />);
      expect(trigger()).toHaveAttribute("command", "show-modal");
      expect(trigger().getAttribute("commandfor")).toBe(popup().id);
      expect(popup()).toHaveAttribute("data-modal", "");
      expect(popup()).not.toHaveAttribute("open");
    });

    it("names the dialog by its title for assistive technology", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      expect(screen.getByRole("dialog", { name: "Edit profile" })).toBe(popup());
      expect(popup()).toHaveAccessibleDescription("Saved to your account.");
    });

    it("token-merges the consumer's aria-describedby / aria-labelledby", () => {
      render(
        <Harness
          mode="static"
          popup={{ "aria-describedby": "extra", "aria-labelledby": "label" }}
        />,
      );
      expect(popup().getAttribute("aria-describedby")).toBe(
        `extra ${screen.getByTestId("description").id}`,
      );
      expect(popup().getAttribute("aria-labelledby")).toBe(
        `label ${screen.getByTestId("title").id}`,
      );
    });

    it("modal={false} renders no command attributes and no data-modal", () => {
      render(<Harness mode="static" modal={false} />);
      expect(trigger()).not.toHaveAttribute("command");
      expect(trigger()).not.toHaveAttribute("commandfor");
      expect(popup()).not.toHaveAttribute("data-modal");
    });

    it("experimental_closedBy renders closedby; lightDismiss makes it 'any'", () => {
      const { unmount } = render(<Harness mode="static" popup={{ experimental_closedBy: true }} />);
      expect(popup()).toHaveAttribute("closedby", "closerequest");
      unmount();
      render(<Harness mode="static" popup={{ experimental_closedBy: true, lightDismiss: true }} />);
      expect(popup()).toHaveAttribute("closedby", "any");
    });

    it("passes role='alertdialog' through", () => {
      render(<Harness mode="static" popup={{ role: "alertdialog" }} />);
      expect(popup()).toHaveAttribute("role", "alertdialog");
    });

    it("never renders `open`, also with defaultOpen (server HTML)", () => {
      const html = renderToString(<Harness mode="uncontrolled" initialOpen />);
      const container = document.createElement("div");
      container.innerHTML = html;
      expect(container.querySelector("dialog")!.hasAttribute("open")).toBe(false);
    });

    it("never lets a render element add open, id or state attributes (owned keys)", () => {
      render(
        <Harness
          mode="static"
          popup={{ render: <dialog open id="mine" data-modal="no" className="el" /> }}
          trigger={{
            render: <button type="submit" command="close" commandfor="other" data-open="" />,
          }}
        />,
      );
      expect(popup()).not.toHaveAttribute("open");
      expect(popup().id).not.toBe("mine");
      expect(popup()).toHaveAttribute("data-modal", "");
      expect(popup()).toHaveClass("el");
      expect(trigger()).toHaveAttribute("type", "button");
      expect(trigger()).toHaveAttribute("command", "show-modal");
      expect(trigger().getAttribute("commandfor")).toBe(popup().id);
      expect(trigger()).not.toHaveAttribute("data-open");
    });
  });

  describe("JS-free mode", () => {
    it("opens through the native command and closes through request-close", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      expect(content()).toBeInTheDocument(); // always mounted
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(isModal(popup())).toBe(true);
      await user.click(screen.getByTestId("close"));
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("x");
      await flushTasks(2);
      expect(trigger()).toHaveFocus();
    });

    it("non-modal: the Trigger calls show()", async () => {
      const user = setupUser();
      const show = vi.spyOn(HTMLDialogElement.prototype, "show");
      render(<Harness mode="static" modal={false} />);
      await user.click(trigger());
      expect(show).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      expect(isModal(popup())).toBe(false);
    });

    // #125 review F2
    it("a foreign close command at a closed dialog leaves no close intent", async () => {
      const user = setupUser();
      let ctx: { takeCloseIntent: () => unknown } | null = null;
      function Probe() {
        ctx = use(DialogContext)!;
        return null;
      }
      render(
        <>
          <button type="button" data-testid="foreign">
            Foreign
          </button>
          <Dialog.Root>
            <Dialog.Popup data-testid="popup" aria-label="Probe">
              <Probe />
            </Dialog.Popup>
          </Dialog.Root>
        </>,
      );
      const foreign = screen.getByTestId("foreign");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "close");
      // The platform fires `command` whatever the dialog's state; nothing closes.
      await user.click(foreign);
      await flushTasks(1);
      expect(popup().open).toBe(false);
      expect(ctx!.takeCloseIntent()).toBeUndefined();
    });

    it("a disabled Trigger never opens", async () => {
      const user = setupUser();
      render(<Harness mode="static" trigger={{ disabled: true }} />);
      expect(trigger()).toBeDisabled();
      await user.click(trigger());
      expect(popup().open).toBe(false);
    });
  });

  describe("keyboard", () => {
    renderBoth("library mode", (mode) => {
      it("Enter and Space on the Trigger dispatch", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        trigger().focus();
        await user.keyboard("{Enter}");
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(1);
        expect(popup().open).toBe(true);
        await act(async () => popup().requestClose());
        await flushTasks(2);
        trigger().focus();
        await user.keyboard(" ");
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(3);
        expect(action.mock.calls[2]![0]).toBe(true);
      });
    });

    it("non-modal: Escape inside the dialog closes it with reason 'dismiss'", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" modal={false} action={action} />);
      await openThroughTrigger(user);
      expect(popup().open).toBe(true);
      screen.getByTestId("close").focus();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
      await flushTasks(2);
      expect(action).toHaveBeenLastCalledWith(false, expect.anything());
      expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
    });

    it("non-modal JS-free: Escape closes too", async () => {
      const user = setupUser();
      render(<Harness mode="static" modal={false} />);
      await user.click(trigger());
      screen.getByTestId("close").focus();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
    });

    it("non-modal: Escape is left to an open popover inside the dialog", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="uncontrolled"
          modal={false}
          content={
            <>
              <button type="button" data-testid="inside">
                Inside
              </button>
              <div popover="auto" data-testid="menu">
                <button type="button" data-testid="item">
                  Item
                </button>
              </div>
              <div popover="manual" data-testid="toast">
                <button type="button" data-testid="toast-button">
                  Undo
                </button>
              </div>
            </>
          }
        />,
      );
      await openThroughTrigger(user);
      const menu = screen.getByTestId("menu");
      act(() => menu.showPopover());
      // Focus inside the popover: not the dialog's Escape, and not cancelled.
      expect(fireEvent.keyDown(screen.getByTestId("item"), { key: "Escape" })).toBe(true);
      expect(popup().open).toBe(true);
      // Focus elsewhere in the dialog: the open popover's close watcher still takes Escape.
      expect(fireEvent.keyDown(screen.getByTestId("inside"), { key: "Escape" })).toBe(true);
      expect(popup().open).toBe(true);
      act(() => menu.hidePopover());
      // A manual popover has no close watcher: Escape inside it closes the dialog.
      act(() => screen.getByTestId("toast").showPopover());
      expect(fireEvent.keyDown(screen.getByTestId("toast-button"), { key: "Escape" })).toBe(false);
      expect(popup().open).toBe(false);
    });
  });

  describe("function props", () => {
    it("Root children, Trigger, Popup, Title receive their state (library mode)", async () => {
      const user = setupUser();
      const rootStates: DialogRootState[] = [];
      const triggerStates: DialogTriggerState[] = [];
      const popupStates: DialogPopupState[] = [];
      const d = deferred();
      render(
        <Dialog.Root defaultOpen={false} openChangeAction={() => d.promise}>
          {(state) => {
            rootStates.push(state);
            return (
              <>
                <Dialog.Trigger
                  data-testid="trigger"
                  className={(s) => (s.pending ? "busy" : "idle")}
                  style={(s) => ({ opacity: s.open ? 0.5 : 1 })}
                >
                  {(s) => {
                    triggerStates.push(s);
                    return s.pending ? "Loading" : "Open";
                  }}
                </Dialog.Trigger>
                <Dialog.Popup data-testid="popup" className={(s) => (s.open ? "shown" : "hidden")}>
                  {(s) => {
                    popupStates.push(s);
                    return <Dialog.Title>{(t) => `Title ${String(t.open)}`}</Dialog.Title>;
                  }}
                </Dialog.Popup>
              </>
            );
          }}
        </Dialog.Root>,
      );
      expect(rootStates.at(-1)).toEqual({ open: false, pending: false, modal: true });
      expect(trigger()).toHaveClass("idle");
      expect(popup()).toHaveClass("hidden");
      await user.click(trigger());
      expect(rootStates.at(-1)).toEqual({ open: true, pending: true, modal: true });
      expect(triggerStates.at(-1)).toEqual({ open: true, pending: true, disabled: false });
      expect(trigger()).toHaveClass("busy");
      expect(trigger()).toHaveTextContent("Loading");
      expect(trigger()).toHaveStyle({ opacity: "0.5" });
      expect(popupStates).toEqual([]); // not rendered while committed is closed
      await act(async () => d.resolve());
      expect(popupStates.at(-1)).toEqual({ open: true, modal: true });
      expect(popup()).toHaveClass("shown");
      expect(screen.getByRole("heading")).toHaveTextContent("Title true");
    });

    it("JS-free mode passes open: false and pending: false", () => {
      const rootStates: DialogRootState[] = [];
      render(
        <Dialog.Root>
          {(state) => {
            rootStates.push(state);
            return (
              <>
                <Dialog.Trigger data-testid="trigger">
                  {(s) => `${String(s.open)} ${String(s.pending)}`}
                </Dialog.Trigger>
                <Dialog.Popup data-testid="popup" aria-label="x">
                  {(s) => `${String(s.open)} ${String(s.modal)}`}
                </Dialog.Popup>
              </>
            );
          }}
        </Dialog.Root>,
      );
      expect(rootStates.at(-1)).toEqual({ open: false, pending: false, modal: true });
      expect(trigger()).toHaveTextContent("false false");
      expect(popup()).toHaveTextContent("false true");
    });

    it("Close and Form receive their state", async () => {
      const user = setupUser();
      const closeStates: DialogCloseState[] = [];
      const formStates: DialogFormState[] = [];
      const closing = deferred();
      const saving = deferred();
      render(
        <Dialog.Root defaultOpen>
          <Dialog.Popup data-testid="popup" aria-label="x">
            <Dialog.Form
              action={() => saving.promise}
              className={(s) => (s.pending ? "saving" : "idle")}
              data-testid="form"
            >
              {(s) => {
                formStates.push(s);
                return <button type="submit">Save</button>;
              }}
            </Dialog.Form>
            <Dialog.Close action={() => closing.promise}>
              {(s) => {
                closeStates.push(s);
                return s.pending ? "Deleting" : "Delete";
              }}
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await flushTasks(2);
      expect(closeStates.at(-1)).toEqual({ pending: false, disabled: false });
      expect(formStates.at(-1)).toEqual({ pending: false });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushTasks(2);
      expect(formStates.at(-1)).toEqual({ pending: true });
      expect(screen.getByTestId("form")).toHaveClass("saving");
      expect(screen.getByTestId("form")).not.toHaveAttribute("data-pending");
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(closeStates.at(-1)).toEqual({ pending: true, disabled: false });
      await act(async () => {
        saving.resolve();
        closing.resolve();
      });
      await flushTasks(2);
    });

    it("Root state.pending is true while a re-open waits for a dismissal's notification", async () => {
      const user = setupUser();
      const closing = deferred();
      const action = vi.fn<ActionFn>();
      render(
        <Dialog.Root defaultOpen={false} openChangeAction={action}>
          {({ pending, open }) => (
            <>
              <output data-testid="root">{`open=${open} pending=${pending}`}</output>
              <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
              <Dialog.Popup data-testid="popup" aria-label="x" />
            </>
          )}
        </Dialog.Root>,
      );
      await openThroughTrigger(user);
      action.mockImplementationOnce(() => closing.promise);
      await act(async () => popup().requestClose());
      await flushTasks(2);
      await user.click(trigger());
      expect(screen.getByTestId("root")).toHaveTextContent("open=true pending=true");
      expectPending(trigger());
      await act(async () => closing.resolve());
      await flushTasks(2);
      expect(screen.getByTestId("root")).toHaveTextContent("open=true pending=false");
      expect(popup().open).toBe(true);
    });
  });

  describe("render element", () => {
    it("render={<dialog />} keeps id, ARIA and the listeners", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          popup={{ render: <dialog className="custom" /> }}
        />,
      );
      expect(popup()).toHaveClass("custom");
      expect(popup().id).toBe(trigger().getAttribute("commandfor"));
      await openThroughTrigger(user);
      expect(popup().getAttribute("aria-labelledby")).toBe(screen.getByTestId("title").id);
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(action).toHaveBeenLastCalledWith(false, expect.anything());
    });

    it("a link Trigger in library mode dispatches through the click and gets no type", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness mode="uncontrolled" action={action} trigger={{ render: <a href="#edit" /> }} />,
      );
      expect(trigger().tagName).toBe("A");
      expect(trigger()).not.toHaveAttribute("type");
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      await flushTasks(2);
      expect(popup().open).toBe(true);
    });

    it("forwards refs", () => {
      const triggerRef = { current: null as HTMLElement | null };
      const popupRef = { current: null as HTMLDialogElement | null };
      render(
        <Dialog.Root>
          <Dialog.Trigger ref={triggerRef as never}>Open</Dialog.Trigger>
          <Dialog.Popup ref={popupRef} aria-label="x" />
        </Dialog.Root>,
      );
      expect(triggerRef.current?.tagName).toBe("BUTTON");
      expect(popupRef.current?.tagName).toBe("DIALOG");
    });

    it("warns when the Popup does not render a <dialog>", () => {
      const error = silenceErrors();
      render(
        <Dialog.Root>
          <Dialog.Popup render={<aside />} aria-label="x" />
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("expected to render a <dialog>"));
    });

    it("warns for a non-button Trigger in JS-free mode", () => {
      const error = silenceErrors();
      render(
        <Dialog.Root>
          <Dialog.Trigger render={<span />}>Open</Dialog.Trigger>
          <Dialog.Popup aria-label="x" />
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Only a <button>"));
    });
  });

  describe("post-await rule", () => {
    it("a controlled parent that adopts after its own await (startTransition) works end to end", async () => {
      const user = setupUser();
      const server = deferred();
      function App() {
        const [open, setOpen] = useState(false);
        return (
          <Dialog.Root
            open={open}
            openChangeAction={async (next) => {
              if (next) await server.promise;
              startTransition(() => setOpen(next));
            }}
          >
            <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="x">
              <span data-testid="content">loaded</span>
            </Dialog.Popup>
          </Dialog.Root>
        );
      }
      render(<App />);
      await user.click(trigger());
      expectPending(trigger());
      await act(async () => server.resolve());
      expect(popup().open).toBe(true);
      expect(content()).toBeInTheDocument();
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(content()).toBeNull();
      expect(trigger()).not.toHaveAttribute("data-open");
    });
  });

  describe("light dismiss (baseline)", () => {
    function mockRect(dialog: HTMLDialogElement) {
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
        top: 100,
        left: 100,
        bottom: 300,
        right: 300,
        width: 200,
        height: 200,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });
    }

    /** A press and a click at the same point, as a real click on `target` produces. */
    function pressAndClick(target: Element, point: { clientX: number; clientY: number }) {
      fireEvent.pointerDown(target, point);
      fireEvent.click(target, point);
    }

    it("modal: a click on the dialog outside its box closes it with reason 'dismiss'", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(<Harness mode="uncontrolled" action={action} popup={{ lightDismiss: true }} />);
      await openThroughTrigger(user);
      mockRect(popup());
      pressAndClick(popup(), { clientX: 150, clientY: 150 }); // inside the box
      pressAndClick(screen.getByTestId("content"), { clientX: 10, clientY: 10 }); // descendant
      expect(requestClose).not.toHaveBeenCalled();
      pressAndClick(popup(), { clientX: 10, clientY: 10 }); // the ::backdrop
      expect(requestClose).toHaveBeenCalledTimes(1);
      await flushTasks(2);
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });

    it("modal: without lightDismiss a backdrop click does nothing", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      mockRect(popup());
      fireEvent.click(popup(), { clientX: 10, clientY: 10 });
      expect(popup().open).toBe(true);
    });

    it("non-modal: a click outside closes it; a click inside does not", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" modal={false} popup={{ lightDismiss: true }} />);
      await openThroughTrigger(user);
      await flushTasks(2); // the `toggle` task attaches the document listener
      await user.click(screen.getByTestId("content"));
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("elsewhere"));
      expect(popup().open).toBe(false);
    });

    // #116: native `closedby="any"` has no invoker exemption, so the JS baseline has none
    // either; with the flag, jsdom (no `closedBy`) runs the same JS listeners.
    it.each([
      ["without experimental_closedBy", false],
      ["with experimental_closedBy (JS fallback)", true],
    ])(
      "non-modal: a Trigger click while open is a dismissal (%s)",
      async (_label, experimental_closedBy) => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode="uncontrolled"
            modal={false}
            action={action}
            popup={{ lightDismiss: true, experimental_closedBy }}
          />,
        );
        await openThroughTrigger(user);
        await flushTasks(2); // the `toggle` task attaches the document listeners
        expect(action).toHaveBeenCalledTimes(1);
        await user.click(trigger());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(action).toHaveBeenCalledTimes(2);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("dismiss");
        expect(details.event?.type).toBe("close");
        // The click ran while the dialog was still optimistically open: no re-open.
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(popup().open).toBe(false);
      },
    );

    // #116 in JS-free mode: the light dismiss closes the dialog before the click, and the
    // Trigger, which saw it open at the press, does not `show()` it again.
    it.each([
      ["without experimental_closedBy", false],
      ["with experimental_closedBy (JS fallback)", true],
    ])(
      "non-modal JS-free: a Trigger click while open closes it and does not re-open (%s)",
      async (_label, experimental_closedBy) => {
        const user = setupUser();
        render(
          <Harness
            mode="static"
            modal={false}
            popup={{ lightDismiss: true, experimental_closedBy }}
          />,
        );
        await user.click(trigger());
        expect(popup().open).toBe(true);
        await flushTasks(2); // the `toggle` task attaches the document listeners
        const show = vi.spyOn(HTMLDialogElement.prototype, "show");
        const closes = vi.fn();
        popup().addEventListener("close", closes);
        await user.click(trigger());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(show).not.toHaveBeenCalled();
        expect(closes).toHaveBeenCalledTimes(1);
        // The next click opens again: the press saw it closed.
        await user.click(trigger());
        expect(popup().open).toBe(true);
      },
    );

    // #116
    it("non-modal JS-free: keyboard activation of the Trigger while open does nothing", async () => {
      const user = setupUser();
      render(<Harness mode="static" modal={false} popup={{ lightDismiss: true }} />);
      await user.click(trigger());
      await flushTasks(2);
      const show = vi.spyOn(HTMLDialogElement.prototype, "show");
      trigger().focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(show).not.toHaveBeenCalled();
    });

    // #116
    it("non-modal JS-free: a press on the open dialog's Trigger released elsewhere swallows no later keyboard open", async () => {
      const user = setupUser();
      render(<Harness mode="static" modal={false} />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      // A press that never becomes a click on the Trigger.
      fireEvent.pointerDown(trigger());
      act(() => popup().close());
      expect(popup().open).toBe(false);
      trigger().focus();
      await user.keyboard("{Enter}");
      expect(popup().open).toBe(true);
    });

    it("experimental_closedBy without native closedBy keeps the JS fallback", async () => {
      const user = setupUser();
      render(
        <Harness mode="uncontrolled" popup={{ lightDismiss: true, experimental_closedBy: true }} />,
      );
      await openThroughTrigger(user);
      mockRect(popup());
      pressAndClick(popup(), { clientX: 10, clientY: 10 });
      expect(popup().open).toBe(false);
    });

    it("modal: a drag from inside that ends on the backdrop does not close", async () => {
      const user = setupUser();
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(<Harness mode="uncontrolled" popup={{ lightDismiss: true }} />);
      await openThroughTrigger(user);
      mockRect(popup());
      // Selecting text in the content and releasing over the backdrop: the press is inside, the
      // click lands on the common ancestor (the dialog) outside its box.
      fireEvent.pointerDown(screen.getByTestId("content"), { clientX: 150, clientY: 150 });
      fireEvent.click(popup(), { clientX: 10, clientY: 10 });
      expect(requestClose).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
      // A click without any press (keyboard activation, synthetic) is not a dismiss either.
      fireEvent.click(popup(), { clientX: 10, clientY: 10 });
      expect(popup().open).toBe(true);
      // A press on the backdrop that is released inside does not close.
      fireEvent.pointerDown(popup(), { clientX: 10, clientY: 10 });
      fireEvent.click(popup(), { clientX: 150, clientY: 150 });
      expect(popup().open).toBe(true);
      pressAndClick(popup(), { clientX: 10, clientY: 10 });
      expect(popup().open).toBe(false);
    });

    it("non-modal: a drag from inside that ends outside does not close", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" modal={false} popup={{ lightDismiss: true }} />);
      await openThroughTrigger(user);
      await flushTasks(2); // the `toggle` task attaches the document listeners
      fireEvent.pointerDown(screen.getByTestId("content"));
      fireEvent.click(document.body);
      expect(popup().open).toBe(true);
      pressAndClick(screen.getByTestId("elsewhere"), { clientX: 0, clientY: 0 });
      expect(popup().open).toBe(false);
    });
  });

  describe("focus", () => {
    it("initialFocus (ref): autofocus is on the target while showModal runs, removed after", async () => {
      const user = setupUser();
      const seen: (string | null)[] = [];
      const showModal = spyShowModal().mockImplementation(function (this: HTMLDialogElement) {
        seen.push(this.querySelector("[autofocus]")?.getAttribute("name") ?? null);
        this.setAttribute("open", "");
      });
      function App() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <Dialog.Root defaultOpen={false}>
            <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="x" initialFocus={ref}>
              <button type="button">First</button>
              <input ref={ref} name="name" />
            </Dialog.Popup>
          </Dialog.Root>
        );
      }
      render(<App />);
      await user.click(trigger());
      await flushTasks(2);
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(seen).toEqual(["name"]);
      expect(popup().querySelector("[autofocus]")).toBeNull();
    });

    it("initialFocus (selector): the platform's focusing steps land on it", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="uncontrolled"
          popup={{ initialFocus: "[name=email]" }}
          content={
            <>
              <button type="button">First</button>
              <input name="email" />
            </>
          }
        />,
      );
      await openThroughTrigger(user);
      expect(document.activeElement).toHaveAttribute("name", "email");
      expect(popup().querySelector("[autofocus]")).toBeNull();
    });

    it("initialFocus in JS-free mode: autofocus is written after mount for the native open", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="static"
          popup={{ initialFocus: "[name=email]" }}
          content={
            <>
              <button type="button">First</button>
              <input name="email" />
            </>
          }
        />,
      );
      expect(popup().querySelector("[name=email]")).toHaveAttribute("autofocus");
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(document.activeElement).toHaveAttribute("name", "email");
    });

    it("initialFocus that resolves to nothing warns", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(<Harness mode="uncontrolled" popup={{ initialFocus: "#missing" }} />);
      await openThroughTrigger(user);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`initialFocus` resolved to no"));
      expect(popup().open).toBe(true);
    });

    it("focus returns to the Trigger when the opener was removed and focus is left inside", async () => {
      const user = setupUser();
      function App() {
        const [showOpener, setShowOpener] = useState(true);
        return (
          <Dialog.Root defaultOpen={false}>
            {showOpener && (
              <button type="button" data-testid="opener" commandfor="unused">
                Opener
              </button>
            )}
            <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="x">
              <button type="button" data-testid="remove" onClick={() => setShowOpener(false)}>
                Remove opener
              </button>
            </Dialog.Popup>
          </Dialog.Root>
        );
      }
      render(<App />);
      // Open from the "opener" so the platform would return focus to it.
      screen.getByTestId("opener").focus();
      await act(async () => dispatchCommand(popup(), "show-modal", screen.getByTestId("opener")));
      await flushTasks(2);
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("remove"));
      screen.getByTestId("remove").focus();
      await act(async () => popup().close());
      await flushTasks(2);
      expect(trigger()).toHaveFocus();
    });
  });

  describe("nested confirm dialog", () => {
    function Unrelated() {
      const [count, setCount] = useState(0);
      return (
        <button
          type="button"
          data-testid="unrelated"
          onClick={() => startTransition(() => setCount((c) => c + 1))}
        >
          {count}
        </button>
      );
    }

    /**
     * The recommended shape: no action awaits user input. The outer "Discard…" button is the
     * Trigger of a JS-free confirm dialog; the confirm's own Close action does the work and
     * closes the (controlled) outer dialog.
     */
    function Editor({ discard }: { discard: () => Promise<void> }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Dialog.Root open={open} openChangeAction={(next) => setOpen(next)}>
            <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="Editor">
              <textarea defaultValue="Unsaved notes" />
              <Dialog.Root>
                <Dialog.Trigger data-testid="discard">Discard…</Dialog.Trigger>
                <Dialog.Popup data-testid="confirm" role="alertdialog" aria-label="Discard?">
                  <Dialog.Close data-testid="keep" value="keep">
                    Keep editing
                  </Dialog.Close>
                  <Dialog.Close
                    data-testid="confirm-discard"
                    value="discard"
                    action={async () => {
                      await discard();
                      startTransition(() => setOpen(false));
                    }}
                  >
                    Discard
                  </Dialog.Close>
                </Dialog.Popup>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Root>
          <Unrelated />
        </>
      );
    }

    const confirm = () => screen.getByTestId("confirm") as HTMLDialogElement;

    it("the recommended pattern opens the confirm at once and never stalls other transitions", async () => {
      const user = setupUser();
      const discarding = deferred();
      render(<Editor discard={() => discarding.promise} />);
      await user.click(trigger());
      await flushTasks(2);
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("discard"));
      expect(confirm().open).toBe(true);
      // While the user decides, nothing is pending: an unrelated transition commits.
      await user.click(screen.getByTestId("unrelated"));
      await flushTasks(2);
      expect(screen.getByTestId("unrelated")).toHaveTextContent("1");
      // "Keep editing" closes the confirm only.
      await user.click(screen.getByTestId("keep"));
      expect(confirm().open).toBe(false);
      expect(popup().open).toBe(true);
      // Confirm: the action runs (pending), then both dialogs close.
      await user.click(screen.getByTestId("discard"));
      await user.click(screen.getByTestId("confirm-discard"));
      expectPending(screen.getByTestId("confirm-discard"));
      expect(popup().open).toBe(true);
      await act(async () => discarding.resolve());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      await user.click(screen.getByTestId("unrelated"));
      await flushTasks(2);
      expect(screen.getByTestId("unrelated")).toHaveTextContent("2");
    });

    it("characterisation: awaiting input that arrives through a transition holds every transition", async () => {
      // The shape the review found deadlocking (React 19.3 puts every transition started
      // while an async action is pending into that action's lane). Kept to flag a React change.
      const user = setupUser();
      const answer = deferred();
      function Anti() {
        const [confirming, setConfirming] = useState(false);
        return (
          <>
            <Dialog.Root defaultOpen>
              <Dialog.Popup data-testid="popup" aria-label="Editor">
                <Dialog.Close
                  data-testid="discard"
                  action={() => {
                    startTransition(() => setConfirming(true));
                    return answer.promise;
                  }}
                >
                  Discard
                </Dialog.Close>
              </Dialog.Popup>
            </Dialog.Root>
            <output data-testid="confirming">{String(confirming)}</output>
            <Unrelated />
          </>
        );
      }
      render(<Anti />);
      await flushTasks(2);
      await user.click(screen.getByTestId("discard"));
      await flushTasks(2);
      expect(screen.getByTestId("confirming")).toHaveTextContent("false");
      await user.click(screen.getByTestId("unrelated"));
      await flushTasks(2);
      expect(screen.getByTestId("unrelated")).toHaveTextContent("0");
      await act(async () => answer.resolve());
      await flushTasks(2);
      expect(screen.getByTestId("confirming")).toHaveTextContent("true");
      expect(screen.getByTestId("unrelated")).toHaveTextContent("1");
    });
  });

  describe("mode guard and dev warnings", () => {
    it("warns when the Root switches from JS-free to library mode", () => {
      const error = silenceErrors();
      const { rerender } = render(
        <Dialog.Root>
          <Dialog.Popup aria-label="x" />
        </Dialog.Root>,
      );
      rerender(
        <Dialog.Root defaultOpen={false}>
          <Dialog.Popup aria-label="x" />
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("the mode changed after mount"));
    });

    it("warns for transition and keepMounted={false} in JS-free mode", () => {
      const error = silenceErrors();
      render(
        <Dialog.Root>
          <Dialog.Popup aria-label="x" transition="fade" keepMounted={false} />
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`transition` has no effect"));
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`keepMounted={false}`"));
    });

    it("warns when the dialog has no accessible name", () => {
      const error = silenceErrors();
      render(
        <Dialog.Root>
          <Dialog.Popup />
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("no accessible name"));
    });

    it("warns for a Trigger without a Popup", () => {
      const error = silenceErrors();
      render(
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
        </Dialog.Root>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("no Dialog.Popup"));
    });

    it("throws for a part outside a Root", () => {
      silenceErrors();
      expect(() => render(<Dialog.Popup />)).toThrow("must be rendered inside a Dialog.Root");
    });
  });

  describe("transition smoke", () => {
    it("renders with and without `transition`", async () => {
      const user = setupUser();
      const { unmount } = render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      expect(popup().open).toBe(true);
      unmount();
      render(
        <Harness
          mode="uncontrolled"
          popup={{ transition: { "fsui-dialog-open": "fade-in", default: "none" } }}
        />,
      );
      await openThroughTrigger(user);
      expect(popup().open).toBe(true);
    });
  });
});
