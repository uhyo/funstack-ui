// AlertDialog tests (jsdom), design/components/alert-dialog.md. An AlertDialog runs the Dialog
// parts' code, so the shared overlay suites run against it as they do against Dialog (open
// state, requests and facts; the Action as a Close part with an `action`), and this file adds
// what differs: the role, always modal, no light dismiss, the Cancel as the initial focus
// target (library mode, JS-free mode, server HTML), the Action without a native command, the
// Description warning, the Form confirm and the async walkthroughs of design 7. The jsdom
// `<dialog>` shim is src/__tests__/dialog-shim.ts.
//
// Not testable here, covered by alert-dialog.browser.test.tsx (conventions 10.1): a real
// backdrop click (no light dismiss with no attribute and no listener), real Escape, the
// platform's dialog focusing steps (`autofocus` on a disabled Cancel skipped, React's
// `autoFocus` on a Cancel mounting into an open JS-free dialog) and the exposed role.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useOptimistic, useRef, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertHarness, alertPopup as popup } from "../__tests__/alert-dialog-harness.js";
import type { AlertActionFn } from "../__tests__/alert-dialog-harness.js";
import { dispatchCommand } from "../__tests__/dialog-shim.js";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushTasks,
  hydrateFromServer,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { describeOverlayClosePart } from "../__tests__/overlay-close-part-suite.js";
import { describeOverlayOpenState } from "../__tests__/overlay-open-state-suite.js";
import { Dialog } from "../dialog/index.js";
import { AlertDialog } from "./index.js";
import type {
  AlertDialogActionState,
  AlertDialogOpenChangeDetails,
  AlertDialogPopupProps,
  AlertDialogRootProps,
} from "./index.js";

const trigger = () => screen.getByTestId("trigger");
const cancel = () => screen.getByTestId("close");
const confirm = () => screen.getByTestId("confirm");
const spyShowModal = () => vi.spyOn(HTMLDialogElement.prototype, "showModal");
const spyClose = () => vi.spyOn(HTMLDialogElement.prototype, "close");

async function openThroughTrigger(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(trigger());
  await flushTasks(2);
  expect(popup().open).toBe(true);
}

describeOverlayOpenState<AlertDialogOpenChangeDetails>({
  name: "AlertDialog",
  Harness: AlertHarness,
  isOpen: () => popup().open,
  spyOpen: spyShowModal,
  spyClose,
  openArgs: () => [],
  dismiss: (value) => popup().requestClose(value),
  dismissEvent: "close",
  partCloses: [
    {
      name: "the Cancel part",
      close: (user) => user.click(cancel()),
      cancelsClick: true,
      closeArgs: ["x"],
      returnsFocus: true,
    },
    {
      name: "the Action part without action",
      close: (user) => user.click(confirm()),
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
});

// The Action with an `action` is Dialog.Close with an `action`, row for row (design 3.2).
describeOverlayClosePart<AlertDialogOpenChangeDetails>({
  name: "AlertDialog (Action)",
  Harness: AlertHarness,
  isOpen: () => popup().open,
  Close: (props) => <AlertDialog.Action value="v" {...props} />,
  spyClose,
  closeArgs: ["v"],
  value: "v",
  dismiss: () => popup().requestClose(),
  openStatic: async () => {
    await act(async () => popup().showModal());
  },
});

describeOverlayClosePart<AlertDialogOpenChangeDetails>({
  name: "AlertDialog (Cancel)",
  Harness: AlertHarness,
  isOpen: () => popup().open,
  Close: (props) => <AlertDialog.Cancel value="v" {...props} />,
  spyClose,
  closeArgs: ["v"],
  value: "v",
  dismiss: () => popup().requestClose(),
  openStatic: async () => {
    await act(async () => popup().showModal());
  },
});

/** A minimal AlertDialog; `popup` and `children` replace the defaults. */
function Confirm({
  root,
  popup: popupProps,
  children,
}: {
  root?: AlertDialogRootProps;
  popup?: Partial<AlertDialogPopupProps>;
  children?: ReactNode;
}) {
  return (
    <AlertDialog.Root {...root}>
      <AlertDialog.Trigger data-testid="trigger">Delete</AlertDialog.Trigger>
      <AlertDialog.Popup data-testid="popup" {...popupProps}>
        <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
        <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
        {children}
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}

describe("AlertDialog", () => {
  describe("roles and ARIA (design 2.2, 10)", () => {
    it("renders the documented elements and wires the ids (JS-free mode)", () => {
      render(<AlertHarness mode="static" />);
      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("command", "show-modal");
      expect(t).not.toHaveAttribute("aria-expanded");
      expect(t).not.toHaveAttribute("aria-haspopup");
      const p = popup();
      expect(p.tagName).toBe("DIALOG");
      expect(p.id).toBe(t.getAttribute("commandfor"));
      expect(p).toHaveAttribute("role", "alertdialog");
      expect(p).toHaveAttribute("data-modal", "");
      expect(p).not.toHaveAttribute("closedby");
      expect(p).not.toHaveAttribute("open");
      expect(p.getAttribute("aria-labelledby")).toBe(screen.getByTestId("title").id);
      expect(p.getAttribute("aria-describedby")).toBe(screen.getByTestId("description").id);
      expect(screen.getByTestId("title").tagName).toBe("H2");
      expect(screen.getByTestId("description").tagName).toBe("P");
      expect(cancel()).toHaveAttribute("command", "request-close");
      expect(cancel().getAttribute("commandfor")).toBe(p.id);
      expect(cancel()).toHaveAttribute("type", "button");
    });

    it("role is owned: a consumer's role on the part or on a render element is dropped", () => {
      const props = { role: "dialog" } as Partial<AlertDialogPopupProps>;
      const { unmount } = render(<AlertHarness mode="static" popup={props} />);
      expect(popup()).toHaveAttribute("role", "alertdialog");
      unmount();
      render(<AlertHarness mode="static" popup={{ render: <dialog role="dialog" /> }} />);
      expect(popup()).toHaveAttribute("role", "alertdialog");
    });

    it("an untyped lightDismiss or experimental_closedBy renders no closedby", () => {
      const props = {
        lightDismiss: true,
        experimental_closedBy: true,
      } as Partial<AlertDialogPopupProps>;
      render(<AlertHarness mode="static" popup={props} />);
      expect(popup()).not.toHaveAttribute("closedby");
    });

    it("the Root's state reports modal: true", () => {
      render(
        <AlertDialog.Root defaultOpen={false}>
          {(state) => <span data-testid="state">{JSON.stringify(state)}</span>}
        </AlertDialog.Root>,
      );
      expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual({
        open: false,
        pending: false,
        modal: true,
      });
    });

    it("a part outside a Root throws with the AlertDialog name", () => {
      silenceErrors();
      expect(() => render(<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>)).toThrow(
        "AlertDialog.Cancel must be rendered inside an AlertDialog.Root.",
      );
      expect(() => render(<Dialog.Close>Close</Dialog.Close>)).toThrow(
        "Dialog.Close must be rendered inside a Dialog.Root.",
      );
    });
  });

  describe("always modal (design 2.1)", () => {
    it("an untyped modal={false} is ignored: the Root opens with showModal()", async () => {
      const user = setupUser();
      const showModal = spyShowModal();
      const show = vi.spyOn(HTMLDialogElement.prototype, "show");
      const root = { defaultOpen: false, modal: false } as AlertDialogRootProps;
      render(
        <Confirm root={root}>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      expect(popup()).toHaveAttribute("data-modal", "");
      await openThroughTrigger(user);
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(show).not.toHaveBeenCalled();
    });
  });

  describe("no light dismiss (design 2.3)", () => {
    it("a press and click outside the open dialog do not close it, also with an untyped lightDismiss", async () => {
      const user = setupUser();
      const fact = vi.fn();
      const props = { lightDismiss: true } as Partial<AlertDialogPopupProps>;
      render(
        <>
          <button type="button" data-testid="outside">
            Outside
          </button>
          <Confirm root={{ defaultOpen: false, onOpenChange: fact }} popup={props}>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </Confirm>
        </>,
      );
      await openThroughTrigger(user);
      const outside = screen.getByTestId("outside");
      fireEvent.pointerDown(outside);
      fireEvent.click(outside);
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(fact).not.toHaveBeenCalled();
    });
  });

  describe("Escape (design 4, 5)", () => {
    it("a close request is a fact: onOpenChange(false, dismiss, ''), no openChangeAction", async () => {
      const user = setupUser();
      const request = vi.fn<AlertActionFn>();
      const fact = vi.fn<AlertActionFn>();
      render(<AlertHarness mode="uncontrolled" action={request} fact={fact} />);
      await openThroughTrigger(user);
      request.mockClear();
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(request).not.toHaveBeenCalled();
      expect(fact).toHaveBeenCalledTimes(1);
      expect(fact.mock.calls[0]![0]).toBe(false);
      expect(fact.mock.calls[0]![1]).toMatchObject({ reason: "dismiss", returnValue: "" });
    });

    it("Cancel and Escape both leave returnValue '' by default, on different channels", async () => {
      const user = setupUser();
      const request = vi.fn<AlertActionFn>();
      render(
        <Confirm root={{ defaultOpen: false, openChangeAction: request }}>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      await openThroughTrigger(user);
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(request).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "activate", returnValue: "" }),
      );
      expect(popup().returnValue).toBe("");
    });
  });

  describe("initial focus (design 3.4)", () => {
    it("library mode: opens with focus on the Cancel, also when the Action comes first", async () => {
      const user = setupUser();
      const seen: (string | null)[] = [];
      const showModal = spyShowModal();
      showModal.mockImplementation(function (this: HTMLDialogElement) {
        seen.push(this.querySelector("[autofocus]")?.textContent ?? null);
        this.setAttribute("open", "");
        this.querySelector<HTMLElement>("[autofocus]")?.focus();
      });
      render(
        <Confirm root={{ defaultOpen: false }}>
          <AlertDialog.Action data-testid="confirm">Delete</AlertDialog.Action>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      // Library mode renders no `autofocus`: it is written right before showModal().
      expect(document.querySelector("[autofocus]")).toBeNull();
      await user.click(trigger());
      await flushTasks(2);
      expect(seen).toEqual(["Cancel"]);
      expect(cancel()).toHaveFocus();
      // Removed after the open (Dialog's mechanism).
      expect(cancel()).not.toHaveAttribute("autofocus");
    });

    it("the first enabled Cancel in tree order: a disabled one is skipped", async () => {
      const user = setupUser();
      render(
        <Confirm root={{ defaultOpen: false }}>
          <AlertDialog.Cancel disabled>Not now</AlertDialog.Cancel>
          <AlertDialog.Action>Delete</AlertDialog.Action>
          <AlertDialog.Cancel data-testid="close">Keep</AlertDialog.Cancel>
          <AlertDialog.Cancel>Later</AlertDialog.Cancel>
        </Confirm>,
      );
      await openThroughTrigger(user);
      expect(cancel()).toHaveFocus();
    });

    it("without a Cancel the platform chooses, and nothing warns", async () => {
      const user = setupUser();
      const error = vi.spyOn(console, "error");
      render(
        <Confirm root={{ defaultOpen: false }}>
          <AlertDialog.Action data-testid="confirm">OK</AlertDialog.Action>
        </Confirm>,
      );
      await openThroughTrigger(user);
      // The shim's focusing steps: the first focusable element.
      expect(confirm()).toHaveFocus();
      expect(error).not.toHaveBeenCalled();
    });

    it("initialFocus wins over the Cancel (library mode)", async () => {
      const user = setupUser();
      function App() {
        const ref = useRef<HTMLHeadingElement>(null);
        return (
          <AlertDialog.Root defaultOpen={false}>
            <AlertDialog.Trigger data-testid="trigger">Delete</AlertDialog.Trigger>
            <AlertDialog.Popup data-testid="popup" initialFocus={ref}>
              <AlertDialog.Title ref={ref} tabIndex={-1} data-testid="title">
                Delete?
              </AlertDialog.Title>
              <AlertDialog.Description>Long text.</AlertDialog.Description>
              <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
            </AlertDialog.Popup>
          </AlertDialog.Root>
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      expect(screen.getByTestId("title")).toHaveFocus();
    });

    it("content that suspends: the Trigger is pending, then the dialog opens with focus on the Cancel", async () => {
      const user = setupUser();
      const data = deferred();
      let ready = false;
      void data.promise.then(() => {
        ready = true;
      });
      function Slow() {
        if (!ready) throw data.promise;
        return <p>12 documents</p>;
      }
      render(
        <Confirm root={{ defaultOpen: false }}>
          <Slow />
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      await user.click(trigger());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expectPending(trigger());
      await act(async () => data.resolve());
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expectNotPending(trigger());
      expect(cancel()).toHaveFocus();
    });

    it("JS-free mode: the Cancel carries autofocus after mount; a native open focuses it", async () => {
      const user = setupUser();
      render(
        <Confirm>
          <AlertDialog.Action data-testid="confirm" action={() => {}}>
            Delete
          </AlertDialog.Action>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      expect(cancel()).toHaveAttribute("autofocus");
      expect(confirm()).not.toHaveAttribute("autofocus");
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(cancel()).toHaveFocus();
    });

    it("JS-free mode: a Cancel that becomes disabled loses autofocus, one that is enabled gains it", () => {
      function App({ disabled }: { disabled: boolean }) {
        return (
          <Confirm>
            <AlertDialog.Cancel data-testid="close" disabled={disabled}>
              Cancel
            </AlertDialog.Cancel>
          </Confirm>
        );
      }
      const { rerender } = render(<App disabled={false} />);
      expect(cancel()).toHaveAttribute("autofocus");
      rerender(<App disabled />);
      expect(cancel()).not.toHaveAttribute("autofocus");
      rerender(<App disabled={false} />);
      expect(cancel()).toHaveAttribute("autofocus");
    });

    it("JS-free mode with initialFocus: no Cancel carries autofocus; the target does", () => {
      render(
        <Confirm popup={{ initialFocus: "[data-testid=title2]" }}>
          <h3 data-testid="title2" tabIndex={-1}>
            Details
          </h3>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      expect(cancel()).not.toHaveAttribute("autofocus");
      expect(screen.getByTestId("title2")).toHaveAttribute("autofocus");
    });

    it("server HTML (JS-free): autofocus on every enabled Cancel, not on a disabled one or the Action", () => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Confirm>
          <AlertDialog.Cancel disabled>Not now</AlertDialog.Cancel>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Cancel>Later</AlertDialog.Cancel>
          <AlertDialog.Action action={() => {}}>Delete</AlertDialog.Action>
        </Confirm>,
      );
      const buttons = [...container.querySelectorAll("dialog button")];
      expect(buttons.map((b) => [b.textContent, b.hasAttribute("autofocus")])).toEqual([
        ["Not now", false],
        ["Cancel", true],
        ["Later", true],
        ["Delete", false],
      ]);
      expect(container.querySelector("dialog")).toHaveAttribute("role", "alertdialog");
    });

    it("server HTML: no autofocus in library mode (the content is not rendered) or with initialFocus", () => {
      const container = document.createElement("div");
      container.innerHTML =
        renderToString(
          <Confirm root={{ defaultOpen: true }}>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </Confirm>,
        ) +
        renderToString(
          <Confirm popup={{ initialFocus: "h2" }}>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </Confirm>,
        );
      expect(container.querySelector("[autofocus]")).toBeNull();
    });

    it("hydration (JS-free): the server's autofocus is kept and a native open focuses the Cancel", async () => {
      const user = setupUser();
      const error = vi.spyOn(console, "error");
      const ui = (
        <Confirm>
          <AlertDialog.Action data-testid="confirm" action={() => {}}>
            Delete
          </AlertDialog.Action>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>
      );
      await hydrateFromServer(ui);
      expect(error).not.toHaveBeenCalled();
      expect(cancel()).toHaveAttribute("autofocus");
      // React's `autoFocus` focus() at hydration targets a closed dialog: no focus moved.
      expect(cancel()).not.toHaveFocus();
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(cancel()).toHaveFocus();
    });
  });

  describe("JS-free Cancels mounting on the client (design 3.4)", () => {
    it("two Cancels mounting into an open dialog take no focus; both carry autofocus", async () => {
      const user = setupUser();
      function App() {
        const [more, setMore] = useState(false);
        return (
          <Confirm>
            <input data-testid="field" />
            <button type="button" data-testid="more" onClick={() => setMore(true)}>
              More
            </button>
            {more && (
              <>
                <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
                <AlertDialog.Cancel data-testid="later">Later</AlertDialog.Cancel>
              </>
            )}
          </Confirm>
        );
      }
      render(<App />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      screen.getByTestId("field").focus();
      fireEvent.click(screen.getByTestId("more"));
      await flushTasks(1);
      expect(cancel()).toHaveAttribute("autofocus");
      expect(screen.getByTestId("later")).toHaveAttribute("autofocus");
      expect(screen.getByTestId("field")).toHaveFocus();
    });

    it("a Cancel that remounts (key change) does not take focus", async () => {
      const user = setupUser();
      function App() {
        const [key, setKey] = useState(0);
        return (
          <Confirm>
            <input data-testid="field" />
            <button type="button" data-testid="remount" onClick={() => setKey((k) => k + 1)}>
              Remount
            </button>
            <AlertDialog.Cancel key={key} data-testid="close">
              Cancel
            </AlertDialog.Cancel>
          </Confirm>
        );
      }
      render(<App />);
      await user.click(trigger());
      expect(cancel()).toHaveFocus();
      screen.getByTestId("field").focus();
      fireEvent.click(screen.getByTestId("remount"));
      await flushTasks(1);
      expect(cancel()).toHaveAttribute("autofocus");
      expect(screen.getByTestId("field")).toHaveFocus();
    });

    it("hydration renders React's autoFocus; the re-render after it keeps the attribute", async () => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Confirm>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </Confirm>,
      );
      expect(container.querySelector("[autofocus]")).not.toBeNull();
      await hydrateFromServer(
        <Confirm>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
        </Confirm>,
        { flush: () => flushTasks(2) },
      );
      expect(cancel()).toHaveAttribute("autofocus");
    });
  });

  describe("Action (design 3.2)", () => {
    it("with action: no commandfor / command, in JS-free and library mode; without: the native command", () => {
      const { unmount } = render(
        <Confirm>
          <AlertDialog.Action data-testid="confirm" action={() => {}}>
            Delete
          </AlertDialog.Action>
          <AlertDialog.Action data-testid="plain" value="ok">
            OK
          </AlertDialog.Action>
        </Confirm>,
      );
      expect(confirm()).toHaveAttribute("type", "button");
      expect(confirm()).not.toHaveAttribute("command");
      expect(confirm()).not.toHaveAttribute("commandfor");
      expect(screen.getByTestId("plain")).toHaveAttribute("command", "request-close");
      expect(screen.getByTestId("plain")).toHaveAttribute("value", "ok");
      unmount();
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Confirm>
          <AlertDialog.Action action={() => {}}>Delete</AlertDialog.Action>
        </Confirm>,
      );
      // The server HTML: the click before hydration does nothing (no native close).
      const button = container.querySelector("dialog button")!;
      expect(button).not.toHaveAttribute("command");
      expect(button).not.toHaveAttribute("commandfor");
    });

    it("a render element's command is dropped (owned) when the Action has an action", () => {
      render(
        <Confirm>
          <AlertDialog.Action
            data-testid="confirm"
            action={() => {}}
            render={<button command="request-close" commandfor="x" />}
          >
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      expect(confirm()).not.toHaveAttribute("command");
      expect(confirm()).not.toHaveAttribute("commandfor");
    });

    it("confirm resolves: pending on the Action, then a close request with returnValue; focus returns to the Trigger", async () => {
      const user = setupUser();
      const work = deferred();
      const request = vi.fn<AlertActionFn>();
      const close = spyClose();
      render(
        <Confirm root={{ defaultOpen: false, openChangeAction: request }}>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" value="delete" action={() => work.promise}>
            {({ pending }: AlertDialogActionState) => (pending ? "Deleting…" : "Delete")}
          </AlertDialog.Action>
        </Confirm>,
      );
      await openThroughTrigger(user);
      request.mockClear();
      await user.click(confirm());
      expectPending(confirm());
      expect(confirm()).toHaveAttribute("aria-disabled", "true");
      expect(confirm()).toHaveTextContent("Deleting…");
      expect(request).not.toHaveBeenCalled();
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(request).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "activate", returnValue: "delete" }),
      );
      expect(close).toHaveBeenCalledWith("delete");
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveFocus();
    });

    it("confirm rejects: the boundary inside the Popup shows the error, the dialog stays open, its Cancel closes it", async () => {
      silenceErrors();
      const user = setupUser();
      const work = deferred();
      render(
        <AlertDialog.Root defaultOpen={false}>
          <AlertDialog.Trigger data-testid="trigger">Delete</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Delete?</AlertDialog.Title>
            <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
            <ErrorCatcher>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
                Delete
              </AlertDialog.Action>
            </ErrorCatcher>
            <AlertDialog.Cancel data-testid="close">Close</AlertDialog.Cancel>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await openThroughTrigger(user);
      await user.click(confirm());
      await act(async () => work.reject(new Error("Network down")));
      await flushTasks(2);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("Network down");
      expect(popup().open).toBe(true);
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("Enter and Space on the Action run it", async () => {
      const user = setupUser();
      const action = vi.fn();
      render(
        <Confirm root={{ defaultOpen: false }}>
          <AlertDialog.Action data-testid="confirm" action={action}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await openThroughTrigger(user);
      confirm().focus();
      await user.keyboard("{Enter}");
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
      await openThroughTrigger(user);
      confirm().focus();
      await user.keyboard(" ");
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(2);
      expect(popup().open).toBe(false);
    });

    it("JS-free mode, after hydration: the action runs, then close(value)", async () => {
      const user = setupUser();
      const work = deferred();
      const close = spyClose();
      await hydrateFromServer(
        <Confirm>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" value="delete" action={() => work.promise}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await user.click(confirm());
      expectPending(confirm());
      expect(popup().open).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(close).toHaveBeenCalledWith("delete");
      expect(popup().open).toBe(false);
    });
  });

  describe("Cancel while the confirm is pending (design 7 walkthroughs 3, 4)", () => {
    it("library mode: the Cancel stays active; its close is entangled with the pending action and commits when it settles", async () => {
      const user = setupUser();
      const work = deferred();
      const request = vi.fn<AlertActionFn>();
      const close = spyClose();
      render(
        <Confirm root={{ defaultOpen: false, openChangeAction: request }}>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await openThroughTrigger(user);
      request.mockClear();
      await user.click(confirm());
      expectPending(confirm());
      expect(cancel()).not.toHaveAttribute("aria-disabled");
      expect(cancel()).not.toBeDisabled();
      await user.click(cancel());
      await flushTasks(2);
      // The Cancel's request ran, but its commit waits for the Action's transition
      // (conventions 2.3 item 5): still open, the Trigger shows the pending close.
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "activate", returnValue: "" }),
      );
      expect(popup().open).toBe(true);
      expectPending(trigger());
      // The Cancel shows that its click was taken (walkthrough 4, conventions 4.3): pending
      // until its close commits, without aria-disabled.
      expectPending(cancel());
      expect(cancel()).not.toHaveAttribute("aria-disabled");
      await act(async () => work.resolve());
      await flushTasks(2);
      // One close: the Action's own close found `false` already intended.
      expect(popup().open).toBe(false);
      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith("");
      expect(request).toHaveBeenCalledTimes(1);
    });

    it("library mode: Cancel while pending and the action rejects: the dialog closes, the error reaches the boundary", async () => {
      silenceErrors();
      const user = setupUser();
      const work = deferred();
      const boundary = vi.fn();
      render(
        <AlertDialog.Root defaultOpen={false}>
          <AlertDialog.Trigger data-testid="trigger">Delete</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Delete?</AlertDialog.Title>
            <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
            <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
            <ErrorCatcher onError={boundary}>
              <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
                Delete
              </AlertDialog.Action>
            </ErrorCatcher>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await openThroughTrigger(user);
      await user.click(confirm());
      await user.click(cancel());
      await act(async () => work.reject(new Error("nope")));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(boundary).toHaveBeenCalledTimes(1);
    });

    it("JS-free mode: the Cancel is the browser's command and closes at once while the action runs", async () => {
      const user = setupUser();
      const work = deferred();
      const close = spyClose();
      render(
        <Confirm>
          <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await user.click(trigger());
      await user.click(confirm());
      expectPending(confirm());
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      close.mockClear();
      await act(async () => work.resolve());
      await flushTasks(2);
      // The Action's close found the dialog closed: nothing.
      expect(close).not.toHaveBeenCalled();
    });

    it("Escape while pending: closed at once (a fact); the resolve closes nothing", async () => {
      const user = setupUser();
      const work = deferred();
      const request = vi.fn<AlertActionFn>();
      const fact = vi.fn<AlertActionFn>();
      render(
        <Confirm root={{ defaultOpen: false, openChangeAction: request, onOpenChange: fact }}>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await openThroughTrigger(user);
      request.mockClear();
      await user.click(confirm());
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(fact).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "dismiss" }));
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(request).not.toHaveBeenCalled();
      expect(popup().open).toBe(false);
    });

    it("Escape while pending, then the action rejects: the Action is gone, the error goes to reportError (walkthrough 3)", async () => {
      silenceErrors();
      const user = setupUser();
      const work = deferred();
      const reported = vi.fn();
      vi.stubGlobal("reportError", reported);
      const boundary = vi.fn();
      render(
        <ErrorCatcher onError={boundary}>
          <Confirm root={{ defaultOpen: false }}>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action data-testid="confirm" action={() => work.promise}>
              Delete
            </AlertDialog.Action>
          </Confirm>
        </ErrorCatcher>,
      );
      await openThroughTrigger(user);
      await user.click(confirm());
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(screen.queryByTestId("confirm")).toBeNull();
      await act(async () => work.reject(new Error("too late")));
      await flushTasks(2);
      expect(boundary).not.toHaveBeenCalled();
      expect(reported).toHaveBeenCalledTimes(1);
      expect((reported.mock.calls[0]![0] as Error).message).toBe("too late");
      expect(popup().open).toBe(false);
    });

    it("optimistic: the consumer's useOptimistic disables the Cancel while deleting and reverts on settle (design 9.3)", async () => {
      const user = setupUser();
      const work = deferred();
      silenceErrors();
      function App() {
        const [deleting, setDeleting] = useOptimistic(false);
        return (
          <ErrorCatcher>
            <Confirm root={{ defaultOpen: false }}>
              <AlertDialog.Cancel data-testid="close" disabled={deleting}>
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                data-testid="confirm"
                action={async () => {
                  setDeleting(true);
                  await work.promise;
                }}
              >
                Delete
              </AlertDialog.Action>
            </Confirm>
          </ErrorCatcher>
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      await user.click(confirm());
      expect(cancel()).toBeDisabled();
      await act(async () => work.reject(new Error("nope")));
      await flushTasks(2);
      // The rejection reached the boundary above the Root: the dialog went with it.
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("nope");
    });

    it("optimistic: the Cancel is enabled again after a resolve that the parent vetoes", async () => {
      const user = setupUser();
      const work = deferred();
      function App() {
        const [open, setOpen] = useState(false);
        const [deleting, setDeleting] = useOptimistic(false);
        return (
          <Confirm
            root={{
              open,
              // Opens are adopted; the close after the Action is refused (a veto).
              openChangeAction: (next) => {
                if (next) startTransition(() => setOpen(true));
              },
              onOpenChange: setOpen,
            }}
          >
            <AlertDialog.Cancel data-testid="close" disabled={deleting}>
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              data-testid="confirm"
              action={async () => {
                setDeleting(true);
                await work.promise;
              }}
            >
              Delete
            </AlertDialog.Action>
          </Confirm>
        );
      }
      render(<App />);
      await openThroughTrigger(user);
      await user.click(confirm());
      expect(cancel()).toBeDisabled();
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(cancel()).not.toBeDisabled();
      expectNotPending(confirm());
    });
  });

  describe("Form (design 3.3, 6)", () => {
    it("a function action with a plain submit button: runs, then the dialog closes on settle", async () => {
      const user = setupUser();
      const work = deferred();
      const seen: string[] = [];
      render(
        <Confirm root={{ defaultOpen: false }}>
          <AlertDialog.Form
            data-testid="form"
            action={async (formData) => {
              seen.push(String(formData.get("id")));
              await work.promise;
            }}
          >
            {({ pending }) => (
              <>
                <input type="hidden" name="id" value="atlas" />
                <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
                <button type="submit" data-testid="submit" value="delete">
                  {pending ? "Deleting…" : "Delete"}
                </button>
              </>
            )}
          </AlertDialog.Form>
        </Confirm>,
      );
      await openThroughTrigger(user);
      // The Cancel is still the focus target inside the form.
      expect(cancel()).toHaveFocus();
      await user.click(screen.getByTestId("submit"));
      await flushTasks(2);
      expect(seen).toEqual(["atlas"]);
      expect(screen.getByTestId("submit")).toHaveTextContent("Deleting…");
      expect(popup().open).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(3);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("delete");
    });

    it("without action: method=dialog", () => {
      render(
        <Confirm>
          <AlertDialog.Form data-testid="form">
            <button type="submit">OK</button>
          </AlertDialog.Form>
        </Confirm>,
      );
      expect(screen.getByTestId("form")).toHaveAttribute("method", "dialog");
    });
  });

  describe("development warnings (design 2.2, 10)", () => {
    const descriptionWarnings = (error: ReturnType<typeof silenceErrors>) =>
      error.mock.calls.filter(([m]) => String(m).includes("no description"));

    it("JS-free mode: warns once, at the end of the first showing, when there is no Description", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(
        <AlertDialog.Root>
          <AlertDialog.Trigger data-testid="trigger">Open</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Session expired</AlertDialog.Title>
            <AlertDialog.Cancel data-testid="close">OK</AlertDialog.Cancel>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await flushTasks(2);
      expect(descriptionWarnings(error)).toHaveLength(0);
      await user.click(trigger());
      await flushTasks(2);
      expect(popup().open).toBe(true);
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      const calls = descriptionWarnings(error);
      expect(calls).toHaveLength(1);
      expect(String(calls[0]![0])).toContain("AlertDialog.Description");
      // Once per instance.
      await user.click(trigger());
      await flushTasks(2);
      await user.click(cancel());
      await flushTasks(2);
      expect(descriptionWarnings(error)).toHaveLength(1);
    });

    it("library mode: not before the first showing; logged when it ends", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(
        <AlertDialog.Root defaultOpen={false}>
          <AlertDialog.Trigger data-testid="trigger">Open</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Session expired</AlertDialog.Title>
            <AlertDialog.Cancel data-testid="close">OK</AlertDialog.Cancel>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await flushTasks(2);
      expect(descriptionWarnings(error)).toHaveLength(0);
      await openThroughTrigger(user);
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(descriptionWarnings(error)).toHaveLength(1);
    });

    it("a Description behind a Suspense boundary pending at the open counts once it arrives", async () => {
      const user = setupUser();
      const error = silenceErrors();
      const data = deferred();
      let ready = false;
      void data.promise.then(() => {
        ready = true;
      });
      function SlowDescription() {
        if (!ready) throw data.promise;
        return <AlertDialog.Description>12 documents are removed.</AlertDialog.Description>;
      }
      render(
        <AlertDialog.Root defaultOpen={false}>
          <AlertDialog.Trigger data-testid="trigger">Open</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Delete?</AlertDialog.Title>
            <Suspense fallback={<p>Loading…</p>}>
              <SlowDescription />
            </Suspense>
            <AlertDialog.Cancel data-testid="close">Cancel</AlertDialog.Cancel>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await openThroughTrigger(user);
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      await act(async () => data.resolve());
      await flushTasks(2);
      expect(screen.getByText("12 documents are removed.")).toBeInTheDocument();
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(descriptionWarnings(error)).toHaveLength(0);
    });

    it("no warning with a Description, or with a consumer aria-describedby naming an element", () => {
      const error = vi.spyOn(console, "error");
      render(
        <>
          <p id="msg">Your changes are lost.</p>
          <AlertDialog.Root>
            <AlertDialog.Popup aria-describedby="msg">
              <AlertDialog.Title>Session expired</AlertDialog.Title>
            </AlertDialog.Popup>
          </AlertDialog.Root>
          <AlertHarness mode="static" />
        </>,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("the missing-name warning names AlertDialog.Title", async () => {
      const error = silenceErrors();
      render(
        <AlertDialog.Root>
          <AlertDialog.Popup>
            <AlertDialog.Description>Text</AlertDialog.Description>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      // A microtask after the showing effect (a Title registers first, #218).
      await act(async () => {});
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("AlertDialog.Popup: the dialog has no accessible name"),
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("AlertDialog.Title"));
    });
  });

  describe("shared context (design 1)", () => {
    it("a Dialog.Close inside an AlertDialog.Popup closes the alert dialog", async () => {
      const user = setupUser();
      render(
        <Confirm root={{ defaultOpen: false }}>
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Confirm>,
      );
      await openThroughTrigger(user);
      await user.click(cancel());
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });
  });
});
