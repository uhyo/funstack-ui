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
// - ViewTransition: jsdom has no `startViewTransition`; `transition` is smoke-tested only.
//
// N/A rows: none of conventions 10.1 is N/A in library mode. JS-free mode has no action props, so
// its sync/async/rejection/overlap/parity rows do not apply (it is covered by the ARIA, function
// props, Close and Form rows).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, Suspense, startTransition, useRef, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand, isModal } from "../__tests__/dialog-shim.js";
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
import { Dialog } from "./index.js";
import type {
  DialogCloseState,
  DialogFormState,
  DialogOpenChangeDetails,
  DialogPopupProps,
  DialogPopupState,
  DialogRootState,
  DialogTriggerProps,
  DialogTriggerState,
} from "./index.js";

type ActionFn = (next: boolean, details: DialogOpenChangeDetails) => unknown;
type Mode = ControlMode | "static";

interface HarnessProps {
  mode: Mode;
  /** Initial committed open state. */
  initialOpen?: boolean;
  /** The consumer's work, awaited by the harness's `openChangeAction`. */
  action?: ActionFn;
  /** Catch errors thrown by `action` (turns a rejection into success for the library). */
  catchErrors?: boolean;
  /** Controlled mode: never adopt `false` (a parent that refuses to close). */
  refuseClose?: boolean;
  /** Controlled mode: never adopt `true` (a parent that vetoes the open). */
  refuseOpen?: boolean;
  /** Wrap the Root in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
  /** Wrap everything in a Suspense boundary (above the Root). */
  suspense?: boolean;
  modal?: boolean;
  trigger?: Partial<DialogTriggerProps> | false;
  popup?: Partial<DialogPopupProps>;
  /** Popup content; default: a span, a Close button with value "x". */
  content?: ReactNode;
  /** Rendered next to the Root (for controlled tests that flip `open` from outside). */
  outside?: (setOpen: (open: boolean) => void) => ReactNode;
}

/**
 * Controlled/uncontrolled parity harness. The controlled variant follows "update on success"
 * (`startTransition` after the await, design 2.2); the uncontrolled variant mirrors the value the
 * action saw succeed so both modes expose it the same way.
 */
function Harness({
  mode,
  initialOpen = false,
  action,
  catchErrors = false,
  refuseClose = false,
  refuseOpen = false,
  boundary,
  suspense = false,
  modal,
  trigger,
  popup,
  content,
  outside,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);

  const openChangeAction = async (next: boolean, details: DialogOpenChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (error) {
      if (!catchErrors) throw error;
      return;
    }
    if ((next && refuseOpen) || (!next && refuseClose)) return;
    startTransition(() => setOpen(next));
  };

  const rootProps =
    mode === "static"
      ? {}
      : mode === "controlled"
        ? { open, openChangeAction }
        : { defaultOpen: initialOpen, openChangeAction };

  let dialog: ReactNode = (
    <Dialog.Root {...rootProps} modal={modal}>
      {trigger !== false && (
        <Dialog.Trigger data-testid="trigger" {...trigger}>
          Open
        </Dialog.Trigger>
      )}
      <Dialog.Popup data-testid="popup" {...popup}>
        <Dialog.Title data-testid="title">Edit profile</Dialog.Title>
        <Dialog.Description data-testid="description">Saved to your account.</Dialog.Description>
        {content ?? (
          <>
            <span data-testid="content">content</span>
            <Dialog.Close data-testid="close" value="x">
              Cancel
            </Dialog.Close>
          </>
        )}
      </Dialog.Popup>
    </Dialog.Root>
  );
  if (boundary) dialog = <ErrorCatcher onError={boundary}>{dialog}</ErrorCatcher>;

  const body = (
    <>
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {dialog}
      {outside?.((next) => startTransition(() => setOpen(next)))}
      <output data-testid="committed">{String(open)}</output>
    </>
  );
  return suspense ? (
    <Suspense fallback={<span data-testid="fallback">loading</span>}>{body}</Suspense>
  ) : (
    body
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup") as HTMLDialogElement;
const content = () => screen.queryByTestId("content");
const committedText = () => screen.getByTestId("committed").textContent;

/** Runs the tasks the shim queued (`toggle`, `close`) and React's work after them. */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function spyShowModal() {
  return vi.spyOn(HTMLDialogElement.prototype, "showModal");
}
function spyClose() {
  return vi.spyOn(HTMLDialogElement.prototype, "close");
}
function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

/** Opens a library-mode dialog through the Trigger and waits for it to be shown. */
async function openThroughTrigger(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flush();
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
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
      await flush();
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
        await flush();
        expect(action).toHaveBeenCalledTimes(1);
        expect(popup().open).toBe(true);
        await act(async () => popup().requestClose());
        await flush();
        trigger().focus();
        await user.keyboard(" ");
        await flush();
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
      await flush();
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

  renderBoth("sync action", (mode) => {
    it("a Trigger click dispatches (true, details) with the native click, cancelled", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.returnValue).toBeUndefined();
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event!.type).toBe("click");
      // The command was cancelled: the library opens the dialog, not the browser.
      expect(details.event!.defaultPrevented).toBe(true);
      // `details` is serialisable; `event` is virtual (conventions 2.2).
      expect(Object.keys(details).sort()).toEqual(["reason", "returnValue"]);
      await flush();
      expect(popup().open).toBe(true);
      expect(committedText()).toBe("true");
    });

    it("a disabled Trigger never dispatches", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} trigger={{ disabled: true }} />);
      await user.click(trigger());
      fireEvent.click(trigger());
      await flush();
      expect(action).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveAttribute("data-disabled", "");
    });

    it("a click while optimistically open never dispatches", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Harness mode={mode} action={action} />);
      await user.click(trigger());
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => d.resolve());
      await flush();
    });

    it("a foreign show-modal command is cancelled and dispatched with the CommandEvent", async () => {
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      const source = screen.getByTestId("elsewhere");
      let event!: Event;
      await act(async () => {
        event = dispatchCommand(popup(), "show-modal", source);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![1].event).toBe(event);
      expect(action.mock.calls[0]![1].reason).toBe("activate");
      await flush();
      expect(popup().open).toBe(true);
    });
  });

  renderBoth("async action", (mode) => {
    it("open: pending Trigger, dialog closed and content unmounted until it resolves", async () => {
      const user = setupUser();
      const showModal = spyShowModal();
      const d = deferred();
      render(<Harness mode={mode} action={() => d.promise} />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      expectPending(trigger());
      expect(showModal).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
      expect(content()).toBeNull();
      await act(async () => d.resolve());
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      expect(content()).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("data-open", "");
      expectNotPending(trigger());
    });

    it("close: a dismiss notifies (false, { reason: 'dismiss', returnValue }) and shows pending", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const d = deferred();
      action.mockImplementation(() => d.promise);
      await act(async () => popup().requestClose("x"));
      // Closed natively and at once; the notification follows the `close` event.
      expect(popup().open).toBe(false);
      await flush();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.returnValue).toBe("x");
      expect(details.event!.type).toBe("close");
      expectPending(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(content()).toBeInTheDocument(); // committed is still true
      await act(async () => d.resolve());
      expectNotPending(trigger());
      expect(content()).toBeNull();
      expect(committedText()).toBe("false");
      expect(popup().open).toBe(false);
    });

    it("close: request-close from the Close part is 'activate' with the button's value", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close"));
      await flush();
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.returnValue).toBe("x");
      expect(details.event!.type).toBe("command");
      expect(trigger()).toHaveFocus();
    });

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
      await flush();
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.returnValue).toBe("ok");
      expect(details.event!.type).toBe("submit");
    });

    it("a commit between the native close and its `close` event does not re-open", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const { rerender } = render(<Harness mode={mode} action={action} />);
      await openThroughTrigger(user);
      const showModal = spyShowModal();
      await act(async () => {
        popup().close("x");
        // A re-render of the Root lands before the queued `close` event.
        rerender(<Harness mode={mode} action={action} popup={{ className: "re-rendered" }} />);
      });
      expect(popup()).toHaveClass("re-rendered");
      expect(popup().open).toBe(false);
      await flush();
      expect(showModal).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
      expect(action).toHaveBeenLastCalledWith(false, expect.anything());
    });

    it("a stale intent from a cancelled request-close does not mislabel a later dismiss", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness mode={mode} action={action} popup={{ onCancel: (e) => e.preventDefault() }} />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close"));
      expect(popup().open).toBe(true); // the consumer cancelled the close request
      await flush();
      await act(async () => popup().close());
      await flush();
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });
  });

  renderBoth("rejection", (mode) => {
    it("open rejects: the boundary gets it, the dialog never opened, no data-open", async () => {
      const user = setupUser();
      silenceErrors();
      const showModal = spyShowModal();
      const d = deferred();
      const caught = vi.fn();
      render(<Harness mode={mode} action={() => d.promise} boundary={caught} />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      await act(async () => d.reject(new Error("nope")));
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "nope" }));
      expect(showModal).not.toHaveBeenCalled();
      expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
    });

    it("open rejects, caught inside: resolves, commits, opens", async () => {
      const user = setupUser();
      render(
        <Harness
          mode={mode}
          catchErrors
          action={async () => {
            throw new Error("handled");
          }}
        />,
      );
      await openThroughTrigger(user);
      // A swallowed error is success: uncontrolled commits; the controlled harness returns early
      // (does not adopt) so it stays closed.
      if (mode === "uncontrolled") expect(popup().open).toBe(true);
      else expect(popup().open).toBe(false);
      if (mode === "uncontrolled") expect(trigger()).toHaveAttribute("data-open", "");
      else expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("close notification rejects: the boundary gets it (the dialog was already closed)", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} boundary={caught} />);
      await openThroughTrigger(user);
      action.mockImplementation(async () => {
        throw new Error("save failed");
      });
      await act(async () => popup().requestClose());
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
    });

    it("close notification rejects, caught inside: commits false in uncontrolled mode", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} catchErrors />);
      await openThroughTrigger(user);
      action.mockImplementation(async () => {
        throw new Error("handled");
      });
      const showModal = spyShowModal();
      await act(async () => popup().requestClose());
      await flush();
      if (mode === "uncontrolled") {
        expect(popup().open).toBe(false);
        expect(showModal).not.toHaveBeenCalled();
      } else {
        // The controlled harness does not adopt `false` on failure: the dialog re-opens.
        expect(popup().open).toBe(true);
        expect(showModal).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("refused close (controlled)", () => {
    it("re-opens the dialog after the notification settles; not a veto", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="controlled" action={action} refuseClose />);
      await openThroughTrigger(user);
      const showModal = spyShowModal();
      action.mockImplementation(() => d.promise);
      await act(async () => popup().requestClose());
      expect(popup().open).toBe(false);
      await flush();
      expectPending(trigger());
      expect(showModal).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      expect(trigger()).toHaveAttribute("data-open", "");
      expectNotPending(trigger());
    });

    it("a vetoed open snaps back and the dialog never opens", async () => {
      const user = setupUser();
      const showModal = spyShowModal();
      const d = deferred();
      render(<Harness mode="controlled" action={() => d.promise} refuseOpen />);
      await user.click(trigger());
      expect(trigger()).toHaveAttribute("data-open", "");
      await act(async () => d.resolve());
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(showModal).not.toHaveBeenCalled();
    });
  });

  describe("overlap (walkthrough 11.8)", () => {
    renderBoth("close pending, user re-opens", (mode) => {
      it("both actions run; the latest intent wins", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} />);
        await openThroughTrigger(user);
        const closing = deferred();
        const opening = deferred();
        action.mockImplementationOnce(() => closing.promise);
        action.mockImplementationOnce(() => opening.promise);
        const showModal = spyShowModal();
        await act(async () => popup().requestClose());
        await flush();
        expect(trigger()).not.toHaveAttribute("data-open");
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(3);
        expect(action.mock.calls[2]![0]).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        // Resolve out of order: the open first, then the superseded close.
        await act(async () => opening.resolve());
        await act(async () => closing.resolve());
        await flush();
        expectNotPending(trigger());
        if (mode === "uncontrolled") {
          // The latest-dispatch guard ignores the superseded close.
          expect(trigger()).toHaveAttribute("data-open", "");
          expect(popup().open).toBe(true);
          expect(showModal).toHaveBeenCalledTimes(1);
          expect(content()).toBeInTheDocument();
        } else {
          // A controlled parent that adopts every resolution in arrival order ends with the
          // slower one (conventions 2.5: the guard is the parent's job in controlled mode); the
          // DOM follows the parent.
          expect(committedText()).toBe("false");
          expect(trigger()).not.toHaveAttribute("data-open");
          expect(popup().open).toBe(false);
        }
      });
    });
  });

  renderBoth("superseded rejection", (mode) => {
    async function setup() {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const action = vi.fn<ActionFn>();
      render(<Harness mode={mode} action={action} boundary={caught} />);
      await openThroughTrigger(user);
      const closing = deferred();
      const opening = deferred();
      action.mockImplementationOnce(() => closing.promise);
      action.mockImplementationOnce(() => opening.promise);
      await act(async () => popup().requestClose());
      await flush();
      await user.click(trigger());
      return { caught, closing, opening };
    }

    it("the older dispatch rejects after the newer resolved: the boundary gets it", async () => {
      const { caught, closing, opening } = await setup();
      await act(async () => opening.resolve());
      await act(async () => closing.reject(new Error("older")));
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
    });

    it("the older dispatch rejects while the newer is pending: the boundary gets it", async () => {
      const { caught, closing, opening } = await setup();
      await act(async () => closing.reject(new Error("older")));
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older" }));
      await act(async () => opening.resolve());
    });
  });

  renderBoth("suspending content", (mode) => {
    it("keeps the dialog closed and the Trigger pending until the content is ready", async () => {
      const user = setupUser();
      const showModal = spyShowModal();
      const suspender = createSuspender();
      render(<Harness mode={mode} suspense content={<suspender.Suspender value="details" />} />);
      await user.click(trigger());
      await flush();
      expect(showModal).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
      expectPending(trigger());
      expect(screen.queryByTestId("fallback")).toBeNull();
      await act(async () => suspender.resolve("details", "Order details"));
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("suspender")).toHaveTextContent("Order details");
      expectNotPending(trigger());
    });

    it("keepMounted: content is pre-rendered hidden inside <Activity>", async () => {
      const user = setupUser();
      const suspender = createSuspender();
      suspender.resolve("details", "Ready");
      render(
        <Harness
          mode={mode}
          popup={{ keepMounted: true }}
          content={<suspender.Suspender value="details" />}
        />,
      );
      await flush();
      const hidden = screen.getByTestId("suspender");
      expect(hidden).not.toBeVisible();
      await openThroughTrigger(user);
      expect(screen.getByTestId("suspender")).toBe(hidden); // same DOM node: state preserved
      expect(hidden).toBeVisible();
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
      await flush();
      expect(closeStates.at(-1)).toEqual({ pending: false, disabled: false });
      expect(formStates.at(-1)).toEqual({ pending: false });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flush();
      expect(formStates.at(-1)).toEqual({ pending: true });
      expect(screen.getByTestId("form")).toHaveClass("saving");
      expect(screen.getByTestId("form")).not.toHaveAttribute("data-pending");
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(closeStates.at(-1)).toEqual({ pending: true, disabled: false });
      await act(async () => {
        saving.resolve();
        closing.resolve();
      });
      await flush();
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
      await flush();
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
      await flush();
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
      await flush();
      expect(content()).toBeNull();
      expect(trigger()).not.toHaveAttribute("data-open");
    });
  });

  describe("platform path", () => {
    async function hydrate(ui: ReactNode) {
      const container = document.createElement("div");
      container.innerHTML = renderToString(ui);
      document.body.append(container);
      // A click before hydration ran `show-modal` natively.
      container.querySelector("dialog")!.setAttribute("open", "");
      return render(ui, { container, hydrate: true });
    }

    renderBoth("pre-hydration open", (mode) => {
      it("one dispatch with reason 'platform' and no event; accepted: content mounts", async () => {
        silenceErrors();
        const showModal = spyShowModal();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(<Harness mode={mode} action={action} />);
        });
        await flush();
        expect(action).toHaveBeenCalledTimes(1);
        const [next, details] = action.mock.calls[0]!;
        expect(next).toBe(true);
        expect(details.reason).toBe("platform");
        expect(details.event).toBeUndefined();
        expect(details.returnValue).toBeUndefined();
        expect(content()).toBeInTheDocument();
        expect(popup().open).toBe(true);
        expect(showModal).not.toHaveBeenCalled();
      });

      it("StrictMode still dispatches once", async () => {
        silenceErrors();
        const action = vi.fn<ActionFn>();
        await act(async () => {
          await hydrate(
            <StrictMode>
              <Harness mode={mode} action={action} />
            </StrictMode>,
          );
        });
        await flush();
        expect(action).toHaveBeenCalledTimes(1);
      });

      it("rejected: the dialog is closed again and no close notification follows", async () => {
        silenceErrors();
        const close = spyClose();
        const action = vi.fn<ActionFn>(async (next) => {
          if (next) throw new Error("not now");
        });
        await act(async () => {
          await hydrate(<Harness mode={mode} action={action} catchErrors />);
        });
        await flush();
        if (mode === "controlled") {
          expect(close).toHaveBeenCalledTimes(1);
          expect(popup().open).toBe(false);
          expect(action).toHaveBeenCalledTimes(1); // the echo did not dispatch
        } else {
          // Uncontrolled: a caught error is success, so it commits `true` and stays open.
          expect(popup().open).toBe(true);
        }
      });
    });

    it("controlled parent refusing the pre-hydration open closes the dialog", async () => {
      silenceErrors();
      const close = spyClose();
      const action = vi.fn<ActionFn>();
      await act(async () => {
        await hydrate(<Harness mode="controlled" action={action} refuseOpen />);
      });
      await flush();
      expect(close).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a controlled `open` flipped programmatically calls showModal / close, no echo dispatch", async () => {
      const showModal = spyShowModal();
      const close = spyClose();
      const action = vi.fn<ActionFn>();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          action={action}
          trigger={false}
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await act(async () => setOpen(true));
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      await act(async () => setOpen(false));
      expect(close).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
      await flush();
      expect(action).not.toHaveBeenCalled();
      expect(content()).toBeNull();
    });

    it("defaultOpen opens after mount", async () => {
      const showModal = spyShowModal();
      render(<Harness mode="uncontrolled" initialOpen />);
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(true);
      expect(content()).toBeInTheDocument();
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
      await flush();
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
      await flush();
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "delete failed" }));
      expect(close).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
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
        await flush();
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0]![0].get("name")).toBe("Ada");
        expect(popup().open).toBe(true); // the dialog waits for the action
        expect(close).not.toHaveBeenCalled();
        await act(async () => saving.resolve());
        await flush();
        expect(close).toHaveBeenCalledWith("save");
        expect(popup().open).toBe(false);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        expect(details.returnValue).toBe("save");
        expect(details.event!.type).toBe("submit");
        // The dialog does not re-open from commits that land after the close.
        await flush();
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
      await flush();
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
      await flush();
      expect(save).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
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

    it("modal: a click on the dialog outside its box closes it with reason 'dismiss'", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(<Harness mode="uncontrolled" action={action} popup={{ lightDismiss: true }} />);
      await openThroughTrigger(user);
      mockRect(popup());
      fireEvent.click(popup(), { clientX: 150, clientY: 150 }); // inside the box
      fireEvent.click(screen.getByTestId("content"), { clientX: 10, clientY: 10 }); // descendant
      expect(requestClose).not.toHaveBeenCalled();
      fireEvent.click(popup(), { clientX: 10, clientY: 10 }); // the ::backdrop
      expect(requestClose).toHaveBeenCalledTimes(1);
      await flush();
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
      await flush(); // the `toggle` task attaches the document listener
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
      fireEvent.click(popup(), { clientX: 10, clientY: 10 });
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
      await flush();
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
      await flush();
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("remove"));
      screen.getByTestId("remove").focus();
      await act(async () => popup().close());
      await flush();
      expect(trigger()).toHaveFocus();
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
