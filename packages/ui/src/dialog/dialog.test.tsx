// Dialog tests (jsdom), mapped to design/components/dialog.md section 13.2. jsdom has no
// <dialog> methods, no Invoker Commands and no close watcher; `src/__tests__/dialog-shim.ts`
// provides them (13.1), including invoker clicks and `method="dialog"` submits.
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
// the Close "re-entry" rows (D1-D6, design/components/button.md 16.4) replace them.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, use, useActionState, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand, isModal } from "../__tests__/dialog-shim.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  PlainButton,
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
import { recordClicks } from "../__tests__/overlay-helpers.js";

import {
  committedText,
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

afterEach(() => {
  // Restored here as well as in the setup file: the DOM is cleared below with real methods.
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describeOverlayOpenState<DialogOpenChangeDetails>({
  name: "Dialog",
  Harness,
  isOpen: () => popup().open,
  spyOpen: spyShowModal,
  spyClose,
  openArgs: () => [],
  dismiss: (value) => popup().requestClose(value),
  dismissEvent: "close",
  partClose: (user) => user.click(screen.getByTestId("close")),
  partCloseArgs: ["x"],
  returnValue: true,
  detailsKeys: ["reason", "returnValue"],
  triggerToggles: false,
  ariaExpanded: false,
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
  });

  renderBoth("async action", (mode) => {
    it("close: a method='dialog' submit is 'activate' with the submitter's value", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode={mode}
          action={action}
          content={
            <Dialog.Form data-testid="form">
              <button type="submit" value="ok">
                OK
              </button>
            </Dialog.Form>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "OK" }));
      expect(popup().open).toBe(false);
      await flushTasks(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.returnValue).toBe("ok");
      expect(details.event!.type).toBe("submit");
    });

    it("a Close part's close is not a close request: `cancel` neither fires nor blocks it", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const onCancel = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
      render(<Harness mode={mode} action={action} popup={{ onCancel }} />);
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close"));
      await flushTasks(2);
      // The veto point of a part's close is openChangeAction, not `cancel` (design 7).
      expect(onCancel).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
      // A later dismissal being labelled as one is a suite row ("close intents").
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

  describe("Close part", () => {
    it("with action: the click is cancelled, data-pending while it runs, close(value) on resolve", async () => {
      const user = setupUser();
      const close = spyClose();
      const d = deferred();
      const closeAction = vi.fn(() => d.promise);
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("delete"));
      expect(closeAction).toHaveBeenCalledTimes(1);
      const details = (closeAction.mock.calls[0] as unknown[])[0] as {
        event: Event;
        returnValue: string;
      };
      expect(details.event.defaultPrevented).toBe(true);
      expect(details.returnValue).toBe("deleted");
      expect(popup().open).toBe(true); // the command was cancelled
      expectPending(screen.getByTestId("delete"));
      expectNotPending(trigger()); // the Root's pending is for openChangeAction only
      expect(close).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      expect(close).toHaveBeenCalledWith("deleted");
      await flushTasks(2);
      const [next, notify] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(notify.reason).toBe("activate");
      expect(notify.returnValue).toBe("deleted");
      expect(notify.event!.type).toBe("click");
    });

    it("with action that rejects: the boundary inside the dialog gets it, the dialog stays open", async () => {
      const user = setupUser();
      silenceErrors();
      const close = spyClose();
      const caught = vi.fn();
      render(
        <Harness
          mode="uncontrolled"
          content={
            <ErrorCatcher onError={caught}>
              <Dialog.Close
                data-testid="delete"
                action={async () => {
                  throw new Error("delete failed");
                }}
              >
                Delete
              </Dialog.Close>
            </ErrorCatcher>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("delete"));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "delete failed" }));
      expect(close).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
    });

    it("with action: a rejection reaches the boundary; after a reset the Close runs again (D4)", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const close = spyClose();
      const runs = [deferred(), deferred()];
      let call = 0;
      function Resettable() {
        const [key, setKey] = useState(0);
        return (
          <>
            <button type="button" data-testid="reset" onClick={() => setKey((k) => k + 1)} />
            <ErrorCatcher key={key} onError={caught}>
              <Dialog.Close data-testid="delete" action={() => runs[call++]!.promise}>
                Delete
              </Dialog.Close>
            </ErrorCatcher>
          </>
        );
      }
      render(<Harness mode="uncontrolled" content={<Resettable />} />);
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("delete"));
      await act(async () => runs[0]!.reject(new Error("first failed")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "first failed" }));
      expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
      expect(popup().open).toBe(true);
      expect(close).not.toHaveBeenCalled();
      // The boundary sits above the Close: reset it and the next click runs the action again.
      fireEvent.click(screen.getByTestId("reset"));
      await user.click(screen.getByTestId("delete"));
      expect(call).toBe(2);
      await act(async () => runs[1]!.resolve());
      await flushTasks(2);
      expect(close).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
    });

    describe("re-entry (#81, design/components/button.md 16.4)", () => {
      it("D1: library mode, a second click, Enter and Space while pending are ignored and cancelled", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            content={
              <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        const close = spyClose();
        const button = screen.getByTestId("delete");
        expect(button).not.toHaveAttribute("aria-disabled");
        const clicks = recordClicks();
        try {
          await user.click(button);
          await user.click(button);
          button.focus();
          await user.keyboard("{Enter}");
          await user.keyboard(" ");
        } finally {
          clicks.stop();
        }
        expect(closeAction).toHaveBeenCalledTimes(1);
        // Library mode cancels every Close click (the command); the ignored ones are no exception.
        expect(clicks.seen).toEqual([true, true, true, true]);
        expect(button).toHaveAttribute("aria-disabled", "true");
        expectPending(button);
        expect(button).not.toHaveAttribute("data-disabled");
        expect(button).not.toBeDisabled();
        expect(document.activeElement).toBe(button);
        expect(action).toHaveBeenCalledTimes(1); // the open only
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith("deleted");
        expect(popup().open).toBe(false);
        // The element reference: the attributes are gone with the settle.
        expect(button).not.toHaveAttribute("aria-disabled");
        expectNotPending(button);
      });

      it("D1: JS-free mode with action, a second click while pending is ignored; one close(value)", async () => {
        const user = setupUser();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness
            mode="static"
            content={
              <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await act(async () => popup().showModal());
        const close = spyClose();
        const button = screen.getByTestId("delete");
        const clicks = recordClicks();
        try {
          await user.click(button);
          await user.click(button);
          button.focus();
          await user.keyboard("{Enter}");
        } finally {
          clicks.stop();
        }
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(clicks.seen).toEqual([true, true, true]);
        expect(button).toHaveAttribute("aria-disabled", "true");
        expectPending(button);
        expect(popup().open).toBe(true);
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith("deleted");
        expect(button).not.toHaveAttribute("aria-disabled");
      });

      it("D2: two clicks in one task call the action once", async () => {
        const user = setupUser();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness
            mode="uncontrolled"
            content={
              <Dialog.Close data-testid="delete" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        act(() => {
          fireEvent.click(screen.getByTestId("delete"));
          fireEvent.click(screen.getByTestId("delete"));
        });
        expect(closeAction).toHaveBeenCalledTimes(1);
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });

      it("D3: without action, a second click while the Root's close is pending changes nothing", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode="uncontrolled" action={action} />);
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByTestId("close"));
        await user.click(screen.getByTestId("close"));
        // `requestClose` is a no-op against `intended()`: one dispatch. No own run, so no
        // pending and no aria-disabled on the Close.
        expect(action).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("close")).not.toHaveAttribute("aria-disabled");
        expectNotPending(screen.getByTestId("close"));
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
      });

      it("D6: a render element's aria-disabled is removed while the Close is idle (owned)", async () => {
        const user = setupUser();
        render(
          <Harness
            mode="uncontrolled"
            content={
              <Dialog.Close
                data-testid="delete"
                action={() => {}}
                render={<button type="button" aria-disabled="true" />}
              >
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        expect(screen.getByTestId("delete")).not.toHaveAttribute("aria-disabled");
      });
    });

    renderBoth("open-generation guard (review M2)", (mode) => {
      it("action pending, closed by Escape and re-opened: the settle does not close the new open", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const close = spyClose();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Close data-testid="delete" action={() => work.promise}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByTestId("delete"));
        // Escape while the action runs: the dialog closes natively.
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        // The re-open is entangled with the Close's pending async transition (React batches
        // them), so it commits together with the action's end.
        await user.click(trigger());
        close.mockClear();
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
      });
    });

    it("JS-free: action pending, closed by Escape and re-opened natively: the dialog stays open", async () => {
      const user = setupUser();
      const work = deferred();
      const close = spyClose();
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Close data-testid="delete" action={() => work.promise}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      await act(async () => popup().showModal());
      await user.click(screen.getByTestId("delete"));
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      close.mockClear();
      // The action may settle after the native re-open but before its queued `toggle` task (the
      // order varied in CI when the guard counted opens at `toggle`). Hold that task's event
      // back for good, so only the synchronous `beforetoggle` can count the re-open.
      const holdToggle = (event: Event) => event.stopImmediatePropagation();
      window.addEventListener("toggle", holdToggle, true);
      try {
        await act(async () => popup().showModal());
        await act(async () => work.resolve());
        await flushTasks(2);
      } finally {
        window.removeEventListener("toggle", holdToggle, true);
      }
      expect(popup().open).toBe(true);
      expect(close).not.toHaveBeenCalled();
    });

    it("a disabled Close never runs its action", async () => {
      const user = setupUser();
      const closeAction = vi.fn();
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          content={
            <Dialog.Close data-testid="delete" disabled action={closeAction}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      fireEvent.click(screen.getByTestId("delete"));
      await user.click(screen.getByTestId("delete"));
      expect(closeAction).not.toHaveBeenCalled();
      expect(screen.getByTestId("delete")).toHaveAttribute("data-disabled", "");
    });
  });

  describe("Form part", () => {
    it("without action: method='dialog'", () => {
      render(<Harness mode="static" content={<Dialog.Form data-testid="form" />} />);
      expect(screen.getByTestId("form")).toHaveAttribute("method", "dialog");
    });

    renderBoth("with action", (mode) => {
      it("runs the action with FormData, then closes with the submitter's value", async () => {
        const user = setupUser();
        const close = spyClose();
        const saving = deferred();
        const save = vi.fn((_formData: FormData) => saving.promise);
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form data-testid="form" action={save}>
                <input name="name" defaultValue="Ada" />
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        expect(screen.getByTestId("form")).not.toHaveAttribute("method");
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0]![0].get("name")).toBe("Ada");
        expect(popup().open).toBe(true); // the dialog waits for the action
        expect(close).not.toHaveBeenCalled();
        await act(async () => saving.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledWith("save");
        expect(popup().open).toBe(false);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        expect(details.returnValue).toBe("save");
        expect(details.event!.type).toBe("submit");
        // The dialog does not re-open from commits that land after the close.
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });
    });

    it("with an action that throws: the dialog stays open", async () => {
      const user = setupUser();
      silenceErrors();
      const close = spyClose();
      const caught = vi.fn();
      render(
        <Harness
          mode="uncontrolled"
          content={
            <ErrorCatcher onError={caught}>
              <Dialog.Form
                action={async () => {
                  throw new Error("invalid");
                }}
              >
                <button type="submit">Save</button>
              </Dialog.Form>
            </ErrorCatcher>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "invalid" }));
      expect(close).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
    });

    it("works in JS-free mode too (the watcher closes after the action)", async () => {
      const user = setupUser();
      const save = vi.fn();
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Form action={save}>
              <button type="submit">Save</button>
            </Dialog.Form>
          }
        />,
      );
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushTasks(2);
      expect(save).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
    });
  });

  describe("library-owned part-initiated closes (#46)", () => {
    renderBoth("Close part", (mode) => {
      it("with action: openChangeAction(false) runs after the action; the Close stays pending until the close commits", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByTestId("delete"));
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledTimes(1); // the open only
        expectPending(screen.getByTestId("delete"));
        expectNotPending(trigger());
        await act(async () => work.resolve());
        // The action resolved: the Root dispatched, the dialog is still open.
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "deleted",
        });
        expect(action.mock.calls[1]![1].event!.type).toBe("click");
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expectPending(trigger());
        // React entangles the Root's transition with the Close's async action.
        expectPending(screen.getByTestId("delete"));
        await act(async () => closing.resolve());
        expect(close).toHaveBeenCalledWith("deleted");
        expect(popup().open).toBe(false);
        expectNotPending(trigger());
      });
    });

    it("a vetoed close's returnValue does not leak into a later controlled close", async () => {
      const user = setupUser();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          refuseClose
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close")); // value "x", vetoed
      await flushTasks(2);
      expect(popup().open).toBe(true);
      const close = spyClose();
      await act(async () => setOpen(false));
      expect(close).toHaveBeenCalledWith("");
      expect(popup().returnValue).toBe("");
    });

    describe("review of #46 (memo/reviewer/dialog-46.md)", () => {
      /**
       * A controlled parent following 11.14: it vetoes a Close part's close (reason
       * "activate") and adopts everything else, a dismissal included.
       */
      function VetoCloseParent({
        action,
        modal,
        content,
      }: {
        action: ActionFn;
        modal?: boolean;
        content?: ReactNode;
      }) {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Dialog.Root
              open={open}
              modal={modal}
              openChangeAction={async (next, details) => {
                await action(next, details);
                if (!next && details.reason === "activate") return; // veto
                startTransition(() => setOpen(next));
              }}
            >
              <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
              <Dialog.Popup data-testid="popup" aria-label="Edit">
                <span data-testid="content">content</span>
                {content ?? (
                  <Dialog.Close data-testid="close" value="x">
                    Cancel
                  </Dialog.Close>
                )}
              </Dialog.Popup>
            </Dialog.Root>
            <output data-testid="committed">{String(open)}</output>
          </>
        );
      }

      it("M1: an Escape during a pending part close that is then vetoed is notified, not undone", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const showModal = spyShowModal();
        render(<VetoCloseParent action={action} />);
        await openThroughTrigger(user);
        expect(showModal).toHaveBeenCalledTimes(1);
        const closing = deferred();
        action.mockImplementation((next) => (next ? undefined : closing.promise));
        await user.click(screen.getByTestId("close"));
        expect(popup().open).toBe(true);
        // Escape while openChangeAction(false) runs: the platform closes at once.
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        // Nothing more yet: the user's intent is already "close" (11.13).
        expect(action).toHaveBeenCalledTimes(2);
        action.mockImplementation(() => undefined);
        await act(async () => closing.resolve());
        await flushTasks(2);
        // The parent vetoed the Close; the dismissal stands and is notified now.
        expect(action.mock.calls.map(([next, d]) => [next, d.reason, d.returnValue])).toEqual([
          [true, "activate", undefined],
          [false, "activate", "x"],
          [false, "dismiss", ""],
        ]);
        expect(action.mock.calls[2]![1].event!.type).toBe("close");
        expect(showModal).toHaveBeenCalledTimes(1); // never re-opened
        expect(popup().open).toBe(false);
        expect(committedText()).toBe("false");
        expect(content()).toBeNull();
        expectNotPending(trigger());
        expect(trigger()).not.toHaveAttribute("data-open");
      });

      it("M1: the dismissal is superseded by a re-open through the Trigger", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<VetoCloseParent action={action} />);
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation((next) => (next ? undefined : closing.promise));
        await user.click(screen.getByTestId("close"));
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        await user.click(trigger());
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
          [true, "activate"],
        ]);
        expect(popup().open).toBe(true);
        expect(committedText()).toBe("true");
      });

      it("a Close action plus a controlled veto: the action runs, the close is vetoed, no blink", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const showModal = spyShowModal();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <VetoCloseParent
            action={action}
            content={
              <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        showModal.mockClear();
        const close = spyClose();
        await user.click(screen.getByTestId("delete"));
        expectPending(screen.getByTestId("delete"));
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason, d.returnValue])).toEqual([
          [true, "activate", undefined],
          [false, "activate", "deleted"],
        ]);
        expect(close).not.toHaveBeenCalled();
        expect(showModal).not.toHaveBeenCalled();
        expect(popup().open).toBe(true);
        expect(content()).toBeInTheDocument();
        expect(trigger()).toHaveAttribute("data-open", "");
        expectNotPending(screen.getByTestId("delete"));
        expectNotPending(trigger());
        // A later close is not affected by the vetoed one's value.
        action.mockImplementation(() => undefined);
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(popup().returnValue).toBe("");
      });

      // Uncontrolled: a controlled parent that adopts every resolution in arrival order ends
      // with the slower, superseded `false` (conventions 2.5).
      describe("re-open during a pending part close (P2)", () => {
        it("non-modal: the Trigger re-opens while openChangeAction(false) runs; the dialog stays open", async () => {
          const user = setupUser();
          const action = vi.fn<ActionFn>();
          render(<Harness mode="uncontrolled" action={action} modal={false} />);
          await openThroughTrigger(user);
          const closing = deferred();
          action.mockImplementation((next) => (next ? undefined : closing.promise));
          const close = spyClose();
          await user.click(screen.getByTestId("close"));
          expect(trigger()).not.toHaveAttribute("data-open");
          await user.click(trigger());
          await act(async () => closing.resolve());
          await flushTasks(2);
          expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
          expect(close).not.toHaveBeenCalled();
          expect(popup().open).toBe(true);
          expect(trigger()).toHaveAttribute("data-open", "");
          expect(content()).toBeInTheDocument();
          expectNotPending(trigger());
        });
      });

      it("walkthrough 11.16: a controlled close while a Close action runs closes once", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        let setOpen!: (open: boolean) => void;
        render(
          <Harness
            mode="controlled"
            action={action}
            content={
              <>
                <span data-testid="content">content</span>
                <Dialog.Close data-testid="delete" value="v" action={() => work.promise}>
                  Delete
                </Dialog.Close>
              </>
            }
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await openThroughTrigger(user);
        const close = spyClose();
        await user.click(screen.getByTestId("delete"));
        await act(async () => setOpen(false));
        await act(async () => work.resolve());
        await flushTasks(2);
        expect(action.mock.calls.filter(([next]) => !next)).toHaveLength(1);
        expect(action.mock.calls[1]![1]).toMatchObject({ reason: "activate", returnValue: "v" });
        expect(close).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledWith("v");
        expect(popup().open).toBe(false);
        expect(committedText()).toBe("false");
      });

      it("M3: stopPropagation() from a document listener that runs first (React root on the document) opts out", async () => {
        const user = setupUser();
        silenceErrors(); // jsdom: "Not implemented: requestSubmit()" for the uncancelled submit
        // Stands in for React's own listener when the root is the document (FUNSTACK Static
        // hydrates `document`): registered before the Popup's, on the same node.
        const stop = (event: Event) => event.stopPropagation();
        document.addEventListener("submit", stop);
        try {
          const action = vi.fn<ActionFn>();
          render(
            <Harness
              mode="uncontrolled"
              action={action}
              content={
                <Dialog.Form>
                  <button type="submit" value="ok">
                    OK
                  </button>
                </Dialog.Form>
              }
            />,
          );
          await openThroughTrigger(user);
          await user.click(screen.getByRole("button", { name: "OK" }));
          // Not cancelled by the library: closed natively, at once.
          expect(popup().open).toBe(false);
          await flushTasks(2);
          expect(action.mock.calls[1]![1]).toMatchObject({ reason: "dismiss", returnValue: "ok" });
        } finally {
          document.removeEventListener("submit", stop);
        }
      });

      it("L1: a method='dialog' submit inside a shadow root goes through the Root", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        shadow.append(container);
        const action = vi.fn<ActionFn>();
        const closing = deferred();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            content={
              <Dialog.Form>
                <button type="submit" data-testid="ok" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
          { container },
        );
        const dialog = shadow.querySelector<HTMLDialogElement>("[data-testid=popup]")!;
        await act(async () => shadow.querySelector<HTMLElement>("[data-testid=trigger]")!.click());
        await flushTasks(2);
        expect(dialog.open).toBe(true);
        action.mockImplementation(() => closing.promise);
        await act(async () => shadow.querySelector<HTMLButtonElement>("[data-testid=ok]")!.click());
        // Intercepted: still open until openChangeAction(false) settles.
        expect(dialog.open).toBe(true);
        expect(action.mock.calls[1]![1]).toMatchObject({ reason: "activate", returnValue: "ok" });
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(dialog.open).toBe(false);
        expect(dialog.returnValue).toBe("ok");
      });

      it("L4: a re-open between the library's close() and its close event is not superseded", async () => {
        const action = vi.fn<ActionFn>();
        let setOpen!: (open: boolean) => void;
        render(
          <Harness
            mode="controlled"
            action={action}
            modal={false}
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await act(async () => trigger().click());
        await flushTasks(2);
        expect(popup().open).toBe(true);
        const close = spyClose();
        act(() => setOpen(false));
        expect(close).toHaveBeenCalledTimes(1);
        expect(popup().open).toBe(false);
        // The Trigger, in the task gap before the `close` event.
        act(() => trigger().click());
        await flushTasks(2);
        await flushTasks(2);
        expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [true, "activate"],
        ]);
        expect(popup().open).toBe(true);
        expect(committedText()).toBe("true");
      });

      describe("nested dialogs and the shared submit listener", () => {
        function Nested({
          outerAction,
          innerAction,
          innerStatic,
        }: {
          outerAction: ActionFn;
          innerAction: ActionFn;
          innerStatic: boolean;
        }) {
          return (
            <Dialog.Root defaultOpen={false} openChangeAction={outerAction}>
              <Dialog.Trigger data-testid="outer-trigger">Outer</Dialog.Trigger>
              <Dialog.Popup data-testid="outer" aria-label="Outer">
                <Dialog.Form>
                  <button type="submit" value="outer-ok">
                    Outer OK
                  </button>
                </Dialog.Form>
                <Dialog.Root
                  {...(innerStatic ? {} : { defaultOpen: false, openChangeAction: innerAction })}
                >
                  <Dialog.Trigger data-testid="inner-trigger">Inner</Dialog.Trigger>
                  <Dialog.Popup data-testid="inner" aria-label="Inner">
                    <Dialog.Form>
                      <button type="submit" value="inner-ok">
                        Inner OK
                      </button>
                    </Dialog.Form>
                  </Dialog.Popup>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Root>
          );
        }

        it.each([
          ["a library", false],
          ["a JS-free", true],
        ])("%s inner Root: its submit closes the inner dialog only", async (_, innerStatic) => {
          const user = setupUser();
          const outerAction = vi.fn<ActionFn>();
          const innerAction = vi.fn<ActionFn>();
          render(
            <Nested
              outerAction={outerAction}
              innerAction={innerAction}
              innerStatic={innerStatic}
            />,
          );
          const outer = () => screen.getByTestId("outer") as HTMLDialogElement;
          const inner = () => screen.getByTestId("inner") as HTMLDialogElement;
          await user.click(screen.getByTestId("outer-trigger"));
          await flushTasks(2);
          expect(outer().open).toBe(true);
          await user.click(screen.getByTestId("inner-trigger"));
          await flushTasks(2);
          expect(inner().open).toBe(true);
          await user.click(screen.getByRole("button", { name: "Inner OK" }));
          await flushTasks(2);
          expect(inner().open).toBe(false);
          expect(inner().returnValue).toBe("inner-ok");
          expect(outer().open).toBe(true);
          expect(outer().returnValue).toBe("");
          expect(outerAction.mock.calls.map(([next]) => next)).toEqual([true]);
          if (!innerStatic) {
            expect(innerAction.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
              [true, "activate"],
              [false, "activate"],
            ]);
          }
          // The outer form still closes the outer dialog through its own Root.
          await user.click(screen.getByRole("button", { name: "Outer OK" }));
          await flushTasks(2);
          expect(outer().open).toBe(false);
          expect(outer().returnValue).toBe("outer-ok");
          expect(outerAction.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [true, "activate"],
            [false, "activate"],
          ]);
        });
      });
    });

    it("a render={<a href />} Close closes through the click handler in library mode", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Close data-testid="link-close" value="link" render={<a href="#close" />}>
              Close
            </Dialog.Close>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("link-close"));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("link");
      expect(action.mock.calls[1]![1].returnValue).toBe("link");
    });

    it("JS-free: a Close action closes with close(value) directly when it resolves", async () => {
      const user = setupUser();
      const work = deferred();
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Close data-testid="delete" value="deleted" action={() => work.promise}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      await user.click(trigger());
      const close = spyClose();
      await user.click(screen.getByTestId("delete"));
      expect(popup().open).toBe(true);
      await act(async () => work.resolve());
      expect(close).toHaveBeenCalledWith("deleted");
      expect(popup().open).toBe(false);
    });

    renderBoth("method='dialog' submit", (mode) => {
      it("is cancelled and closes through the Root once openChangeAction(false) settled", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        let submitEvent: Event | undefined;
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form data-testid="form" onSubmit={(e) => (submitEvent = e.nativeEvent)}>
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        const close = spyClose();
        await user.click(screen.getByRole("button", { name: "OK" }));
        expect(submitEvent?.defaultPrevented).toBe(true);
        expect(popup().open).toBe(true);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details).toMatchObject({ reason: "activate", returnValue: "ok" });
        expect(details.event).toBe(submitEvent);
        expectPending(trigger());
        await act(async () => d.resolve());
        expect(close).toHaveBeenCalledWith("ok");
        expect(popup().open).toBe(false);
        expect(popup().returnValue).toBe("ok");
      });

      it("a consumer onSubmit that prevents the submission keeps the dialog open, no dispatch", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form onSubmit={(e) => e.preventDefault()}>
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "OK" }));
        await flushTasks(2);
        expect(popup().open).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
      });
    });

    it("a plain <form method='dialog'> and a formMethod='dialog' submitter are intercepted too", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <>
              <form method="dialog">
                <button type="submit" value="plain">
                  Plain
                </button>
              </form>
              <form onSubmit={(e) => e.preventDefault()}>
                <button type="submit" value="ignored">
                  Not a dialog submit
                </button>
              </form>
              <form>
                <button type="submit" formMethod="dialog" value="submitter">
                  Submitter
                </button>
              </form>
            </>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Not a dialog submit" }));
      await flushTasks(2);
      expect(popup().open).toBe(true);
      await user.click(screen.getByRole("button", { name: "Plain" }));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("plain");
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Submitter" }));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("submitter");
      expect(
        action.mock.calls.filter(([next]) => !next).map(([, d]) => [d.reason, d.returnValue]),
      ).toEqual([
        ["activate", "plain"],
        ["activate", "submitter"],
      ]);
    });

    it("stopPropagation() in onSubmit opts out: the browser closes, notified as a dismissal", async () => {
      const user = setupUser();
      silenceErrors(); // jsdom: "Not implemented: requestSubmit()" for the uncancelled submit
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Form onSubmit={(e) => e.stopPropagation()}>
              <button type="submit" value="ok">
                OK
              </button>
            </Dialog.Form>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "OK" }));
      // Closed natively, at once.
      expect(popup().open).toBe(false);
      await flushTasks(2);
      expect(action.mock.calls[1]![1]).toMatchObject({ reason: "dismiss", returnValue: "ok" });
    });

    renderBoth("Form action settle close", (mode) => {
      it("goes through the Root: the dialog stays open until openChangeAction(false) settles", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const saving = deferred();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form action={() => saving.promise}>
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => saving.resolve());
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "save",
        });
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        await act(async () => closing.resolve());
        expect(close).toHaveBeenCalledWith("save");
        expect(popup().open).toBe(false);
      });
    });

    renderBoth("foreign close command", (mode) => {
      it.each(["request-close", "close"])(
        "%s is cancelled and closes through the Root with the invoker's value",
        async (command) => {
          const user = setupUser();
          const action = vi.fn<ActionFn>();
          render(<Harness mode={mode} action={action} />);
          await openThroughTrigger(user);
          const d = deferred();
          action.mockImplementation(() => d.promise);
          const close = spyClose();
          const source = document.createElement("button");
          source.value = "foreign";
          document.body.append(source);
          let event!: Event;
          await act(async () => {
            event = dispatchCommand(popup(), command, source);
          });
          expect(event.defaultPrevented).toBe(true);
          expect(popup().open).toBe(true);
          const [next, details] = action.mock.calls[1]!;
          expect(next).toBe(false);
          expect(details).toMatchObject({ reason: "activate", returnValue: "foreign" });
          expect(details.event).toBe(event);
          await act(async () => d.resolve());
          expect(close).toHaveBeenCalledWith("foreign");
          expect(popup().open).toBe(false);
        },
      );
    });

    it("a foreign close command without a source closes with ''", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await act(async () => {
        dispatchCommand(popup(), "request-close", null);
      });
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(action.mock.calls[1]![1].returnValue).toBe("");
    });

    it("JS-free: a foreign request-close invoker closes natively", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="static"
          content={
            <button type="button" data-testid="foreign" command="request-close" value="native">
              Foreign
            </button>
          }
        />,
      );
      screen.getByTestId("foreign").setAttribute("commandfor", popup().id);
      await user.click(trigger());
      await user.click(screen.getByTestId("foreign"));
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("native");
    });

    describe("held content (design 4.4)", () => {
      /** Records what the DOM looks like when the library calls `close()` in the close commit. */
      function atClose<T>(read: () => T): { readonly value: () => T | undefined } {
        let value: T | undefined;
        const original = HTMLDialogElement.prototype.close;
        vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
          this: HTMLDialogElement,
          returnValue?: string,
        ) {
          value = read();
          original.call(this, returnValue);
        });
        return { value: () => value };
      }

      it("without transition a controlled close keeps the children through the close commit", async () => {
        let setOpen!: (open: boolean) => void;
        const mounts = vi.fn();
        function Content() {
          useEffect(() => mounts(), []);
          return <span data-testid="content" />;
        }
        render(
          <Harness
            mode="controlled"
            initialOpen
            content={<Content />}
            outside={(set) => {
              setOpen = set;
              return null;
            }}
          />,
        );
        await flushTasks(2);
        expect(popup().open).toBe(true);
        const seen = atClose(() => [committedText(), content() !== null] as const);
        await act(async () => setOpen(false));
        expect(seen.value()).toEqual(["false", true]);
        await flushTasks(2);
        // Released after the `close` event found no exit animation; never re-mounted.
        expect(content()).toBeNull();
        expect(mounts).toHaveBeenCalledTimes(1);
      });

      it("without transition a Close part's close keeps the children through the close commit", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" />);
        await openThroughTrigger(user);
        const seen = atClose(() => [committedText(), content() !== null] as const);
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        expect(seen.value()).toEqual(["false", true]);
        expect(content()).toBeNull();
      });

      it("with transition the children are gone in the close commit", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ transition: "none" }} />);
        await openThroughTrigger(user);
        const seen = atClose(() => [committedText(), content() !== null] as const);
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        expect(seen.value()).toEqual(["false", false]);
        expect(popup().open).toBe(false);
      });

      it("keepMounted: the Activity stays visible through the close commit, hidden after", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ keepMounted: true }} />);
        await openThroughTrigger(user);
        const seen = atClose(() => content()!.style.display);
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        expect(seen.value()).not.toBe("none");
        expect(content()!.style.display).toBe("none");
      });

      it("a dismissal held for an exit animation is released by a normal update, not a view transition", async () => {
        const calls = vi.fn<() => never>(() => {
          throw new Error("startViewTransition stub");
        });
        Object.defineProperty(document, "startViewTransition", {
          configurable: true,
          value: calls,
        });
        try {
          const user = setupUser();
          render(<Harness mode="uncontrolled" popup={{ transition: "pop" }} />);
          await openThroughTrigger(user);
          const fade = deferred();
          const animation = {
            effect: { getComputedTiming: () => ({ endTime: 150 }) },
            finished: fade.promise,
          } as unknown as Animation;
          // The exit starts with the close: an animation already running at `beforetoggle` is
          // the baseline, not the exit (#64).
          vi.spyOn(popup(), "getAnimations").mockImplementation(() =>
            popup().open ? [] : [animation],
          );
          calls.mockClear();
          await act(async () => popup().requestClose());
          await flushTasks(2);
          // The notification commit (one document view transition); the content is held.
          expect(calls).toHaveBeenCalledTimes(1);
          expect(content()).toBeInTheDocument();
          await act(async () => fade.resolve());
          await flushTasks(2);
          expect(content()).toBeNull();
          expect(calls).toHaveBeenCalledTimes(1);
        } finally {
          Reflect.deleteProperty(document, "startViewTransition");
        }
      });

      it("an animation already running before the close does not hold the content (#64)", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" />);
        await openThroughTrigger(user);
        const running = {
          effect: { getComputedTiming: () => ({ endTime: 10_000 }) },
          finished: new Promise<never>(() => {}),
        } as unknown as Animation;
        // The same object before and after the close: a progress bar, not the exit.
        vi.spyOn(popup(), "getAnimations").mockReturnValue([running]);
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(content()).toBeNull();
      });
    });

    describe.each([
      [false, "none", false],
      [false, "none", true],
      [false, undefined, false],
      [true, "none", false],
    ] as const)(
      "focus return: modal=%s transition=%s keepMounted=%s",
      (modal, transition, keepMounted) => {
        it("a Close activated with Enter returns focus to the Trigger (design 6.2 rule 2)", async () => {
          const user = setupUser();
          render(<Harness mode="uncontrolled" modal={modal} popup={{ transition, keepMounted }} />);
          await openThroughTrigger(user);
          screen.getByTestId("close").focus();
          await user.keyboard("{Enter}");
          await flushTasks(2);
          expect(popup().open).toBe(false);
          expect(trigger()).toHaveFocus();
        });
      },
    );
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

    it("modal: a drag from inside that ends on the backdrop does not close (M1)", async () => {
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

    it("non-modal: a drag from inside that ends outside does not close (M1)", async () => {
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

  describe("disabled on link and component renders (#83, design/components/button.md 17.3)", () => {
    const renders = [
      ["a link", <a key="link" href="#x" />],
      ["a component", <PlainButton key="component" />],
    ] as const;

    /** Dispatches a cancelable click and reports whether it was cancelled. */
    const cancelled = (el: Element) => !fireEvent.click(el);

    function expectAriaDisabled(el: Element) {
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).not.toHaveAttribute("disabled");
      expect(el).toHaveAttribute("data-disabled", "");
    }

    describe.each(renders)("Close, %s render", (_, element) => {
      it("library mode: aria-disabled, the click is cancelled, nothing closes", async () => {
        const action = vi.fn<ActionFn>();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="uncontrolled"
            initialOpen
            action={action}
            content={
              <Dialog.Close data-testid="close" disabled action={closeAction} render={element}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await flushTasks(2);
        const close = spyClose();
        expectAriaDisabled(screen.getByTestId("close"));
        expect(cancelled(screen.getByTestId("close"))).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(action).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
      });

      it("JS-free mode with action: aria-disabled, the click is cancelled, nothing closes", async () => {
        const closeAction = vi.fn();
        render(
          <Harness
            mode="static"
            content={
              <Dialog.Close data-testid="close" disabled action={closeAction} render={element}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await act(async () => popup().showModal());
        const close = spyClose();
        expect(screen.getByTestId("close")).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByTestId("close")).not.toHaveAttribute("disabled");
        expect(cancelled(screen.getByTestId("close"))).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
        expect(popup().open).toBe(true);
      });
    });

    it("Close, a host <button> render and no render: native disabled, no aria-disabled", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          content={
            <>
              <Dialog.Close data-testid="a" disabled render={<button type="button" />} />
              <Dialog.Close data-testid="b" disabled />
            </>
          }
        />,
      );
      await flushTasks(2);
      for (const id of ["a", "b"]) {
        expect(screen.getByTestId(id)).toBeDisabled();
        expect(screen.getByTestId(id)).not.toHaveAttribute("aria-disabled");
      }
    });

    it("Close, JS-free mode without action, a component render: native disabled (the command)", () => {
      render(
        <Harness
          mode="static"
          content={<Dialog.Close data-testid="close" disabled render={<PlainButton />} />}
        />,
      );
      expect(screen.getByTestId("close")).toBeDisabled();
      expect(screen.getByTestId("close")).not.toHaveAttribute("aria-disabled");
    });

    describe.each(renders)("Trigger, %s render", (_, element) => {
      it.each([true, false])(
        "library mode (modal=%s): aria-disabled, cancelled, nothing opens",
        async (modal) => {
          const action = vi.fn<ActionFn>();
          const showModal = spyShowModal();
          render(
            <Harness
              mode="uncontrolled"
              modal={modal}
              action={action}
              trigger={{ disabled: true, render: element }}
            />,
          );
          expectAriaDisabled(trigger());
          expect(cancelled(trigger())).toBe(true);
          await flushTasks(2);
          expect(action).not.toHaveBeenCalled();
          expect(showModal).not.toHaveBeenCalled();
          expect(popup().open).toBe(false);
        },
      );

      it("JS-free non-modal: aria-disabled, cancelled, nothing opens", async () => {
        render(
          <Harness mode="static" modal={false} trigger={{ disabled: true, render: element }} />,
        );
        expect(trigger()).toHaveAttribute("aria-disabled", "true");
        expect(trigger()).not.toHaveAttribute("disabled");
        expect(cancelled(trigger())).toBe(true);
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });
    });

    it("disabled component renders in library mode are no invokers: no commandfor / command (review M1)", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          trigger={{ disabled: true, render: <PlainButton /> }}
          content={<Dialog.Close data-testid="close" disabled render={<PlainButton />} />}
        />,
      );
      await flushTasks(2);
      for (const el of [trigger(), screen.getByTestId("close")]) {
        expect(el).not.toHaveAttribute("commandfor");
        expect(el).not.toHaveAttribute("command");
      }
    });

    it("JS-free mode with action, a disabled component-render Close is no invoker (review M1)", async () => {
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Close data-testid="close" disabled action={() => {}} render={<PlainButton />} />
          }
        />,
      );
      await act(async () => popup().showModal());
      expect(screen.getByTestId("close")).not.toHaveAttribute("command");
      expect(screen.getByTestId("close")).not.toHaveAttribute("commandfor");
    });

    it("an enabled component-render Trigger and Close keep their commands", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          trigger={{ render: <PlainButton /> }}
          content={<Dialog.Close data-testid="close" render={<PlainButton />} />}
        />,
      );
      await flushTasks(2);
      expect(trigger()).toHaveAttribute("command", "show-modal");
      expect(screen.getByTestId("close")).toHaveAttribute("command", "request-close");
    });

    it.each([
      ["modal, host button", true, undefined],
      ["non-modal, host button", false, undefined],
      ["non-modal, component render", false, <PlainButton key="component" />],
    ] as const)(
      "Trigger, JS-free %s: a disabled Trigger carries data-disabled (fold W8)",
      (_, modal, element) => {
        render(
          <Harness mode="static" modal={modal} trigger={{ disabled: true, render: element }} />,
        );
        expect(trigger()).toHaveAttribute("data-disabled", "");
      },
    );

    it("Trigger, JS-free modal with a component render: native disabled (the command)", () => {
      render(<Harness mode="static" trigger={{ disabled: true, render: <PlainButton /> }} />);
      expect(trigger()).toBeDisabled();
      expect(trigger()).not.toHaveAttribute("aria-disabled");
    });

    it("Trigger, a host <button> render in library mode: native disabled, no aria-disabled", () => {
      render(
        <Harness
          mode="uncontrolled"
          trigger={{ disabled: true, render: <button type="button" /> }}
        />,
      );
      expect(trigger()).toBeDisabled();
      expect(trigger()).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("review fixes", () => {
    it("disabled is owned: a render element cannot re-enable Trigger or Close (L1)", async () => {
      const user = setupUser();
      const closeAction = vi.fn();
      render(
        <Harness
          mode="static"
          trigger={{ disabled: true, render: <button disabled={false} /> }}
          content={
            <Dialog.Close
              data-testid="close"
              disabled
              action={closeAction}
              render={<button disabled={false} />}
            >
              Delete
            </Dialog.Close>
          }
        />,
      );
      expect(trigger()).toBeDisabled();
      expect(screen.getByTestId("close")).toBeDisabled();
      await user.click(trigger());
      expect(popup().open).toBe(false);
      act(() => popup().showModal());
      await user.click(screen.getByTestId("close"));
      expect(closeAction).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
    });

    renderBoth("re-open while a close notification is pending (L2)", (mode) => {
      it("Escape during a Form save, then the Trigger: pending meanwhile, opens after the save, no extra close", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const saving = deferred();
        const close = spyClose();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form action={() => saving.promise}>
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        // Escape while the save runs: closed natively; the notification is entangled with the
        // form's async action (React holds it until the save settles).
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![0]).toBe(false);
        expect(action.mock.calls[1]![1].reason).toBe("dismiss");
        expectPending(trigger());
        // The user re-opens: still held, and shown as pending.
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(3);
        expect(action.mock.calls[2]![0]).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expectPending(trigger());
        expect(popup().open).toBe(false);
        close.mockClear();
        await act(async () => saving.resolve());
        await flushTasks(2);
        // The save settled: the dialog opens (the user's latest intent) and the Form does not
        // close it again, because it was closed after the submit.
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(3);
        expectNotPending(trigger());
        expect(trigger()).toHaveAttribute("data-open", "");
      });
    });

    it("Root state.pending is true during the re-open window (L2)", async () => {
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

    describe("Dialog.Form closeOnSettle (M3)", () => {
      function ValidatingForm({ closeOnSettle }: { closeOnSettle?: boolean }) {
        const [error, formAction] = useActionState(
          async (_previous: string | null, formData: FormData) =>
            String(formData.get("name")) === "" ? "Name is required" : null,
          null,
        );
        return (
          <Dialog.Form action={formAction} closeOnSettle={closeOnSettle}>
            <input name="name" defaultValue="" />
            {error !== null && <p role="alert">{error}</p>}
            <button type="submit" value="save">
              Save
            </button>
          </Dialog.Form>
        );
      }

      it("default: a non-throwing validation result still closes the dialog", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" content={<ValidatingForm />} />);
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });

      it("closeOnSettle={false}: the dialog stays open with the result; the consumer closes it", async () => {
        const user = setupUser();
        const close = spyClose();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            content={
              <>
                <ValidatingForm closeOnSettle={false} />
                <Dialog.Close data-testid="close" value="cancel">
                  Cancel
                </Dialog.Close>
              </>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "cancel",
        });
      });
    });

    it("Dialog.Form keeps `method` with a string action; owns it otherwise (L4)", () => {
      render(
        <Harness
          mode="static"
          content={
            <>
              <Dialog.Form data-testid="navigating" action="/profile" method="post" />
              <Dialog.Form data-testid="closing" method="post" />
            </>
          }
        />,
      );
      expect(screen.getByTestId("navigating")).toHaveAttribute("method", "post");
      expect(screen.getByTestId("navigating")).toHaveAttribute("action", "/profile");
      expect(screen.getByTestId("closing")).toHaveAttribute("method", "dialog");
    });

    it("non-modal: Escape is left to an open popover inside the dialog (M2)", async () => {
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

    describe("nested confirm (H1)", () => {
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

      it("characterisation: an action that awaits input arriving through a transition holds every transition", async () => {
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
