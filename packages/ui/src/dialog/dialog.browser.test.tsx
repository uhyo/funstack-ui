// Dialog rows that need a real engine (design/components/dialog.md 13.3): real Invoker Commands,
// `showModal()` with top layer and `:modal`, Escape as a close request, the platform's focusing
// steps and focus return through a deferred `showModal()`, nested dialogs, native `closedby`
// light dismiss (with the JS fallback where the engine lacks it) and its press-and-click rule
// under a real drag, Escape left to a popover inside a non-modal dialog, the nested-confirm
// pattern (design 11.10 / 12.5 as reworked after the review), `<form method="dialog">`, exit
// animations and the deferred unmount (branching on whether the engine animates the exit;
// Firefox does not), `<ViewTransition>` around a `showModal()` dialog for the library-owned
// closes of #46 (design 13.3), and the CSS scroll-lock recipe. Real keyboard and pointer input
// comes from Playwright through `user` (`userEvent` from `vitest/browser` inside `act`); the
// ViewTransition rows click in-page outside `act`, as the Popover ones do, because `act` would
// flush React's queue itself. Escape with its focus return, the exit rows and the ViewTransition
// rows Dialog shares with Popover and Menu are in __tests__/overlay-browser-suite.tsx.
import { act, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { mouse } from "../__tests__/browser-commands.js";
import { browserName, pressFocusesButtons, supportsDialogClosedBy } from "../__tests__/engine.js";
import {
  addExitStyle,
  describeOverlayInBrowser,
  setUpViewTransitionRows,
  watchExit,
  finishExit,
} from "../__tests__/overlay-browser-suite.js";
import type {
  OverlayBrowserHarnessProps,
  OverlayViewTransitionProps,
} from "../__tests__/overlay-browser-suite.js";
import { createSuspender, deferred } from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import type { DialogOpenChangeDetails, DialogPopupProps } from "./index.js";
import {
  addStyle,
  flushFor,
  leaveActEnvironment,
  quietPeriod,
  settle,
  sleep,
} from "../__tests__/browser-helpers.js";

type ActionFn = (next: boolean, details: DialogOpenChangeDetails) => unknown;

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup") as HTMLDialogElement;
const isModal = () => popup().matches(":modal");

/** Clicks the Trigger and waits for the library's deferred `showModal()` / `show()`. */
async function openWithTrigger(): Promise<void> {
  await user.click(trigger());
  await settle(() => expect(popup().open).toBe(true));
}

function Library({
  action,
  popup: popupProps,
  children,
}: {
  action?: ActionFn;
  popup?: Partial<DialogPopupProps>;
  children?: ReactNode;
}) {
  return (
    <div style={{ padding: 40 }}>
      <Dialog.Root defaultOpen={false} openChangeAction={action}>
        <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
        <Dialog.Popup data-testid="popup" {...popupProps} style={{ width: 300, height: 200 }}>
          <Dialog.Title>Edit profile</Dialog.Title>
          {children ?? (
            <>
              <input name="name" />
              <Dialog.Close data-testid="close" value="cancel">
                Cancel
              </Dialog.Close>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Root>
    </div>
  );
}

/**
 * No wrapper element above the Root, so a Root inserted by a transition has the Popup's
 * boundary at the top of the subtree. `controlled` adds an in-page button that closes the
 * dialog through the parent (it lives inside the dialog: the page is inert while modal).
 */
function Plain({
  transition,
  className,
  keepMounted,
  modal,
  controlled = false,
}: OverlayViewTransitionProps & { keepMounted?: boolean; modal?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootProps = controlled
    ? { open, openChangeAction: (next: boolean) => setOpen(next) }
    : { defaultOpen: false };
  return (
    <Dialog.Root {...rootProps} modal={modal}>
      <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
      <Dialog.Popup
        data-testid="popup"
        aria-label="Edit"
        transition={transition}
        className={className}
        keepMounted={keepMounted}
        style={{ width: 240, height: 120 }}
      >
        <span data-testid="content">content</span>
        <Dialog.Close data-testid="close" value="cancel">
          Cancel
        </Dialog.Close>
        <Dialog.Form>
          <button type="submit" data-testid="ok" value="ok">
            OK
          </button>
        </Dialog.Form>
        {controlled && (
          <button
            type="button"
            data-testid="parent-close"
            onClick={() => startTransition(() => setOpen(false))}
          >
            Parent close
          </button>
        )}
      </Dialog.Popup>
    </Dialog.Root>
  );
}

/** The shared suite's harness: the content, then `inside`, then a Close part (value "cancel"). */
function SuiteHarness({
  action,
  className,
  inside,
}: OverlayBrowserHarnessProps<DialogOpenChangeDetails>) {
  return (
    <Library action={action} popup={{ className }}>
      <span data-testid="content">content</span>
      {inside}
      <Dialog.Close data-testid="close" value="cancel">
        Cancel
      </Dialog.Close>
    </Library>
  );
}

/** The suite harness with `lightDismiss` on the Popup. */
function LightDismissHarness({
  action,
  className,
}: OverlayBrowserHarnessProps<DialogOpenChangeDetails>) {
  return (
    <Library action={action} popup={{ className, lightDismiss: true }}>
      <span data-testid="content">content</span>
      <Dialog.Close data-testid="close">Cancel</Dialog.Close>
    </Library>
  );
}

/** The suite harness with a `Dialog.Form` whose submitter closes the dialog (value "ok"). */
function FormHarness({ action, className }: OverlayBrowserHarnessProps<DialogOpenChangeDetails>) {
  return (
    <Library action={action} popup={{ className }}>
      <span data-testid="content">content</span>
      <Dialog.Form>
        <button type="submit" data-testid="ok" value="ok">
          OK
        </button>
      </Dialog.Form>
    </Library>
  );
}

describe("Dialog (browser)", () => {
  describeOverlayInBrowser<DialogOpenChangeDetails>({
    name: "Dialog",
    Harness: SuiteHarness,
    isOpen: (element) => (element as HTMLDialogElement).open,
    openPseudo: ":open",
    open: openWithTrigger,
    partClose: () => user.click(screen.getByTestId("close")),
    dismissEvent: "close",
    popoverTarget: false,
    dismissDetails: (details) => expect(details.returnValue).toBe(""),
    // Design 2.3 and 7, a modal dialog (the Trigger is under the `::backdrop`). The non-modal
    // Trigger press (#116) is its own describe below.
    pressesWhileOpen: [
      {
        name: "a Close part: awaited close ('activate'), focus returns to the Trigger",
        target: () => screen.getByTestId("close"),
        outcome: "awaited",
        focusAtPress: "target",
        focusAfter: () => trigger(),
      },
      {
        name: 'a method="dialog" submitter: awaited close with the SubmitEvent',
        Harness: FormHarness,
        target: () => screen.getByTestId("ok"),
        outcome: "awaited",
        eventType: "submit",
        focusAtPress: "target",
        focusAfter: () => trigger(),
      },
      {
        name: "the ::backdrop with lightDismiss: dismissed ('dismiss')",
        Harness: LightDismissHarness,
        target: popup,
        at: { x: -20, y: -20 },
        outcome: "dismissed",
        focusAtPress: popup,
        focusAfter: () => trigger(),
      },
      {
        name: "the ::backdrop without lightDismiss: nothing closes; the engine focuses the <dialog>",
        target: popup,
        at: { x: -20, y: -20 },
        outcome: "stays-open",
        focusAtPress: popup,
      },
      {
        name: "the dialog's own content: nothing closes; the engine focuses the <dialog>",
        target: () => screen.getByTestId("content"),
        outcome: "stays-open",
        focusAtPress: popup,
      },
    ],
    viewTransition: {
      Plain,
      partCloses: [
        {
          name: "a Dialog.Close",
          close: () => screen.getByTestId("close").click(),
          afterClose: () => expect(popup().returnValue).toBe("cancel"),
        },
        {
          name: 'a method="dialog" submit',
          close: () => screen.getByTestId("ok").click(),
          afterClose: () => expect(popup().returnValue).toBe("ok"),
        },
        {
          name: "a controlled open={false}",
          controlled: true,
          close: () => screen.getByTestId("parent-close").click(),
          afterClose: () => expect(popup().returnValue).toBe(""),
        },
      ],
      dismiss: () => userEvent.keyboard("{Escape}"),
      afterOpen: () => expect(popup().matches(":modal")).toBe(true),
    },
  });

  describe("JS-free mode", () => {
    it("a real command click opens the dialog modally; Escape closes and returns focus", async () => {
      render(
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Edit profile</Dialog.Title>
            <input name="name" />
            <Dialog.Close data-testid="close" value="cancel">
              Cancel
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(isModal()).toBe(true);
      // The platform's focusing steps: the first focusable descendant.
      expect(document.activeElement).toHaveAttribute("name", "name");
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveFocus();
    });

    it("request-close from the Close part sets returnValue to its value", async () => {
      render(
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
          <Dialog.Popup data-testid="popup" aria-label="Edit">
            <Dialog.Close data-testid="close" value="cancel">
              Cancel
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await user.click(trigger());
      await user.click(screen.getByTestId("close"));
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("cancel");
    });

    it('<form method="dialog"> closes with the submitter\'s value', async () => {
      render(
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Confirm</Dialog.Trigger>
          <Dialog.Popup data-testid="popup" aria-label="Confirm">
            <Dialog.Form>
              <button type="submit" value="ok">
                OK
              </button>
            </Dialog.Form>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await user.click(trigger());
      await user.click(screen.getByRole("button", { name: "OK" }));
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("ok");
    });
  });

  describe("library mode", () => {
    it("the Trigger's click goes through the library: pending, then showModal()", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<Library action={action} />);
      await user.click(trigger());
      expect(action).toHaveBeenCalledTimes(1);
      const details = action.mock.calls[0]![1];
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.reason).toBe("activate");
      // The command was cancelled: the dialog is still closed while the action runs.
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveAttribute("data-pending", "");
      expect(trigger()).toHaveAttribute("data-open", "");
      await act(async () => d.resolve());
      expect(popup().open).toBe(true);
      expect(isModal()).toBe(true);
      expect(trigger()).not.toHaveAttribute("data-pending");
      // Focus moved inside by the platform even though showModal() ran later than the click.
      expect(popup().contains(document.activeElement)).toBe(true);
    });

    it("a foreign invoker's show-modal command is intercepted (details.event is a CommandEvent)", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <Library action={action} />
          <button type="button" data-testid="foreign" id="foreign">
            Foreign
          </button>
        </>,
      );
      const foreign = screen.getByTestId("foreign");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "show-modal");
      await user.click(foreign);
      expect(action).toHaveBeenCalledTimes(1);
      const event = action.mock.calls[0]![1].event!;
      expect(event.type).toBe("command");
      expect(event).toBeInstanceOf(CommandEvent);
      await settle(() => expect(popup().open).toBe(true));
    });

    // #46
    it("a foreign request-close invoker is intercepted; its value arrives through event.source", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Library action={action}>
          <button type="button" data-testid="foreign" value="foreign">
            Foreign close
          </button>
        </Library>,
      );
      await openWithTrigger();
      const foreign = screen.getByTestId("foreign");
      foreign.setAttribute("commandfor", popup().id);
      foreign.setAttribute("command", "request-close");
      await user.click(foreign);
      expect(action).toHaveBeenCalledTimes(2);
      const details = action.mock.calls[1]![1];
      expect(details.event).toBeInstanceOf(CommandEvent);
      expect(details.event!.defaultPrevented).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.returnValue).toBe("foreign");
      await settle(() => expect(popup().open).toBe(false));
      expect(popup().returnValue).toBe("foreign");
    });

    it("content that suspends holds the open; the dialog opens complete", async () => {
      const suspender = createSuspender();
      render(
        <Suspense fallback={<span data-testid="fallback">loading</span>}>
          <Library>
            <suspender.Suspender value="order" />
          </Library>
        </Suspense>,
      );
      await user.click(trigger());
      await flushFor();
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveAttribute("data-pending", "");
      expect(screen.queryByTestId("fallback")).toBeNull();
      await act(async () => suspender.resolve("order", "Order #1"));
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("suspender")).toHaveTextContent("Order #1");
    });

    it("initialFocus: focus lands on the target through the deferred showModal()", async () => {
      function App() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <Library popup={{ initialFocus: ref }}>
            <button type="button">First</button>
            <input ref={ref} name="email" />
          </Library>
        );
      }
      render(<App />);
      await openWithTrigger();
      expect(document.activeElement).toHaveAttribute("name", "email");
      expect(screen.getByRole("textbox")).not.toHaveAttribute("autofocus");
      await user.keyboard("{Escape}");
      expect(trigger()).toHaveFocus();
    });

    it("initialFocus as a selector on a tabIndex={-1} title", async () => {
      render(
        <Library popup={{ initialFocus: "[data-initial-focus]" }}>
          <h3 tabIndex={-1} data-initial-focus="">
            Delete everything?
          </h3>
          <button type="button">Delete</button>
        </Library>,
      );
      await openWithTrigger();
      expect(document.activeElement).toHaveAttribute("data-initial-focus");
    });

    it("nested dialogs need two Escapes; focus returns to the inner opener", async () => {
      render(
        <Library>
          <Dialog.Root defaultOpen={false}>
            <Dialog.Trigger data-testid="inner-trigger">Inner</Dialog.Trigger>
            <Dialog.Popup data-testid="inner" aria-label="Inner">
              <button type="button">Inside</button>
            </Dialog.Popup>
          </Dialog.Root>
        </Library>,
      );
      await openWithTrigger();
      await user.click(screen.getByTestId("inner-trigger"));
      const inner = screen.getByTestId("inner") as HTMLDialogElement;
      // No `transition`, so the inner Popup renders no `<ViewTransition>` and the outer open starts
      // no view transition that would hold the inner open (#35, transition-boundary.browser.test).
      await expect.poll(() => inner.open).toBe(true);
      expect(popup().open).toBe(true);
      await user.keyboard("{Escape}");
      expect(inner.open).toBe(false);
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("inner-trigger")).toHaveFocus();
      await flushFor();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveFocus();
    });

    it("a Close action runs, then closes with its value ('activate')", async () => {
      const action = vi.fn<ActionFn>();
      const d = deferred();
      render(
        <Library action={action}>
          <Dialog.Close data-testid="delete" value="deleted" action={() => d.promise}>
            Delete
          </Dialog.Close>
        </Library>,
      );
      await openWithTrigger();
      await user.click(screen.getByTestId("delete"));
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("delete")).toHaveAttribute("data-pending", "");
      await act(async () => d.resolve());
      expect(popup().open).toBe(false);
      // The close notification (the `close` task, then the openChangeAction) can lag under load.
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1]![1].reason).toBe("activate");
      expect(action.mock.calls[1]![1].returnValue).toBe("deleted");
    });

    it("a Dialog.Form action runs, then closes with the submitter's value", async () => {
      const action = vi.fn<ActionFn>();
      const save = deferred();
      render(
        <Library action={action}>
          <Dialog.Form action={() => save.promise}>
            <input name="name" defaultValue="Ada" />
            <button type="submit" value="save">
              Save
            </button>
          </Dialog.Form>
        </Library>,
      );
      await openWithTrigger();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushFor();
      expect(popup().open).toBe(true);
      await act(async () => save.resolve());
      await settle(() => expect(popup().open).toBe(false));
      expect(popup().returnValue).toBe("save");
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1]![1].reason).toBe("activate");
      expect(action.mock.calls[1]![1].returnValue).toBe("save");
    });

    it("non-modal: Escape inside a popover closes the popover only", async () => {
      render(
        <Dialog.Root defaultOpen={false} modal={false}>
          <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
          <Dialog.Popup data-testid="popup" aria-label="Help">
            <button type="button" data-testid="inside">
              Inside
            </button>
            <div popover="auto" data-testid="menu">
              <button type="button" data-testid="item">
                Item
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      await openWithTrigger();
      const menu = screen.getByTestId("menu");
      act(() => menu.showPopover());
      screen.getByTestId("item").focus();
      await user.keyboard("{Escape}");
      await flushFor();
      expect(menu.matches(":popover-open")).toBe(false);
      expect(popup().open).toBe(true);
      // With no popover open, Escape inside the dialog closes it.
      screen.getByTestId("inside").focus();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
    });
  });

  describe("light dismiss", () => {
    /** A real click on the ::backdrop: on the dialog, outside its border box. */
    async function clickBackdrop() {
      await user.click(popup(), { position: { x: -20, y: -20 }, force: true });
    }

    it("modal, baseline JS: a backdrop click closes; a click inside does not", async () => {
      const action = vi.fn<ActionFn>();
      render(<Library action={action} popup={{ lightDismiss: true }} />);
      await openWithTrigger();
      await user.click(screen.getByRole("heading"));
      expect(popup().open).toBe(true);
      await clickBackdrop();
      expect(popup().open).toBe(false);
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });

    it("modal without lightDismiss: a backdrop click does nothing", async () => {
      render(<Library />);
      await openWithTrigger();
      await clickBackdrop();
      expect(popup().open).toBe(true);
    });

    it("experimental_closedBy: native closedby='any' where supported, the JS fallback elsewhere", async () => {
      const action = vi.fn<ActionFn>();
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(
        <Library action={action} popup={{ lightDismiss: true, experimental_closedBy: true }} />,
      );
      expect(popup()).toHaveAttribute("closedby", "any");
      await openWithTrigger();
      await clickBackdrop();
      expect(popup().open).toBe(false);
      if (supportsDialogClosedBy) {
        // The platform dismissed it; the library's JS listener was not attached.
        expect(requestClose).not.toHaveBeenCalled();
      } else {
        expect(requestClose).toHaveBeenCalledTimes(1);
      }
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    });

    it("non-modal: a click outside closes it", async () => {
      render(
        <>
          <Dialog.Root defaultOpen={false} modal={false}>
            <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="Help" lightDismiss>
              <button type="button">Inside</button>
            </Dialog.Popup>
          </Dialog.Root>
          <button type="button" data-testid="outside">
            Outside
          </button>
        </>,
      );
      await openWithTrigger();
      expect(isModal()).toBe(false);
      await user.click(screen.getByRole("button", { name: "Inside" }));
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("outside"));
      expect(popup().open).toBe(false);
    });

    it("lightDismiss (JS baseline): a drag from inside that ends on the backdrop does not close", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Library action={action} popup={{ lightDismiss: true }}>
          <input data-testid="field" defaultValue="Ada Lovelace" />
        </Library>,
      );
      await openWithTrigger();
      // Select text in the input and release over the backdrop. Chromium fires `click` on the
      // common ancestor, the dialog, outside its box; native `closedby="any"` stays open too.
      await user.dragAndDrop(screen.getByTestId("field"), popup(), {
        sourcePosition: { x: 4, y: 4 },
        targetPosition: { x: -20, y: -20 },
        force: true,
      });
      await flushFor();
      expect(popup().open).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      // A real backdrop click still closes.
      await user.click(popup(), { position: { x: -20, y: -20 }, force: true });
      expect(popup().open).toBe(false);
    });
  });

  describe("nested confirm", () => {
    /** Design 12.5 as reworked: no action awaits user input. */
    function Editor({ discard }: { discard: () => Promise<void> }) {
      const [open, setOpen] = useState(false);
      const [count, setCount] = useState(0);
      return (
        <div style={{ padding: 40 }}>
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
          <button
            type="button"
            data-testid="unrelated"
            onClick={() => startTransition(() => setCount((c) => c + 1))}
          >
            {count}
          </button>
        </div>
      );
    }

    it("the inner dialog opens at once; the outer closes after the confirm", async () => {
      const discarding = deferred();
      render(<Editor discard={() => discarding.promise} />);
      await openWithTrigger();
      const confirm = screen.getByTestId("confirm") as HTMLDialogElement;
      await user.click(screen.getByTestId("discard"));
      // A native command: no transition, nothing to wait for.
      expect(confirm.open).toBe(true);
      expect(confirm.matches(":modal")).toBe(true);
      // Escape closes the inner dialog only; focus returns to its opener.
      await user.keyboard("{Escape}");
      expect(confirm.open).toBe(false);
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("discard")).toHaveFocus();
      // Confirm: the action runs (pending) and then both dialogs close.
      await user.click(screen.getByTestId("discard"));
      await user.click(screen.getByTestId("confirm-discard"));
      expect(screen.getByTestId("confirm-discard")).toHaveAttribute("data-pending", "");
      await act(async () => discarding.resolve());
      await settle(() => expect(popup().open).toBe(false));
      expect(confirm.open).toBe(false);
      expect(trigger()).toHaveFocus();
      // Nothing stays entangled: an unrelated transition commits.
      await user.click(screen.getByTestId("unrelated"));
      await settle(() => expect(screen.getByTestId("unrelated")).toHaveTextContent("1"));
    });
  });

  // A fade whose exit outlasts any test (#71): the row ends the exit itself with `finish()`.
  describe("exit animation and the deferred unmount", () => {
    // #46
    it("a controlled close without transition keeps the content through the fade, mounted once", async () => {
      addExitStyle("held-exit", "60s", { openPseudo: ":open", instantEnter: true });
      let mounts = 0;
      function Content() {
        useEffect(() => {
          mounts++;
        }, []);
        return <span data-testid="content">content</span>;
      }
      function Controlled() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Dialog.Root open={open} openChangeAction={(next) => setOpen(next)}>
              <Dialog.Trigger data-testid="trigger">Edit</Dialog.Trigger>
              <Dialog.Popup data-testid="popup" aria-label="Edit" className="held-exit">
                <Content />
              </Dialog.Popup>
            </Dialog.Root>
            <button
              type="button"
              data-testid="close-from-outside"
              onClick={() => startTransition(() => setOpen(false))}
            >
              Close
            </button>
          </>
        );
      }
      render(<Controlled />);
      await openWithTrigger();
      expect(mounts).toBe(1);
      const exit = watchExit(popup(), "close");
      // A programmatic close (the dialog's page is inert, so not a click on the page).
      await act(async () => screen.getByTestId("close-from-outside").click());
      expect(popup().open).toBe(false);
      let animations: Animation[] = [];
      await act(async () => {
        animations = await exit;
      });
      // Chromium animates the exit: the held branch below must not pass vacuously there.
      if (browserName === "chromium") expect(animations.length).toBeGreaterThan(0);
      if (animations.length > 0) {
        // Chromium / WebKit: the close commit held the content and it is still there mid-fade.
        expect(screen.queryByTestId("content")).not.toBeNull();
        await finishExit(animations);
      }
      await settle(() => expect(screen.queryByTestId("content")).toBeNull());
      // Never emptied and re-mounted into the fading dialog (the pre-#46 behaviour).
      expect(mounts).toBe(1);
    });
  });

  // The library-owned closes are captured since #46; the shared rows are in the suite above.
  describe("ViewTransition", () => {
    const vt = setUpViewTransitionRows((element) => (element as HTMLDialogElement).open);

    const isOpen = () => popup().open;

    /** The view-transition pseudo-element animations running now (read at `ready`). */
    function pseudoAnimations(prefix: string): Animation[] {
      return document
        .getAnimations()
        .filter((animation) =>
          ((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(prefix),
        );
    }

    it('transition="pop": the opening commit captures the dialog shown by showModal() (10.3)', async () => {
      render(<Plain transition="pop" />);
      trigger().click();
      await expect.poll(() => vt.calls.length).toBe(1);
      await vt.transitions[0]!.ready;
      // The top-layer dialog promoted inside the update callback has a new snapshot. If an engine
      // ever stops capturing it, this row tells (design 10.3 then documents the open as CSS only).
      expect(pseudoAnimations("::view-transition-new").length).toBeGreaterThan(0);
      await vt.transitions[0]!.finished;
      expect(isOpen()).toBe(true);
    });

    // The close commit unmounts (or hides) the focused Close before `close()` runs; a non-modal
    // dialog restores focus only from inside, so the library returns it (design 6.2 rule 2). The
    // modal rows go through the platform's unconditional restore and guard against a regression.
    describe.each([
      [false, false],
      [false, true],
      [true, false],
    ] as const)("modal=%s keepMounted=%s", (modal, keepMounted) => {
      it('transition="pop": a Close activated with Enter returns focus to the Trigger', async () => {
        render(<Plain transition="pop" modal={modal} keepMounted={keepMounted} />);
        await vt.open();
        const close = screen.getByTestId("close");
        close.focus();
        expect(close).toHaveFocus();
        await userEvent.keyboard("{Enter}");
        await expect.poll(() => isOpen()).toBe(false);
        await Promise.allSettled(vt.transitions.map((t) => t.finished));
        await expect.poll(() => document.activeElement).toBe(trigger());
      });
    });
  });

  describe("scroll lock recipe", () => {
    it("html:has(dialog:modal) { overflow: hidden } applies while a modal dialog is open", async () => {
      addStyle(`
        html { scrollbar-gutter: stable; }
        html:has(dialog:modal) { overflow: hidden; }
      `);
      render(<Library />);
      const html = document.documentElement;
      expect(getComputedStyle(html).overflow).not.toBe("hidden");
      await openWithTrigger();
      expect(getComputedStyle(html).overflow).toBe("hidden");
      await user.keyboard("{Escape}");
      expect(getComputedStyle(html).overflow).not.toBe("hidden");
    });
  });

  // #116: the dialog light-dismiss algorithm has no invoker exemption (and a non-modal dialog's
  // Trigger is no invoker), so a Trigger click on an open non-modal `lightDismiss` dialog is a
  // dismissal on every engine and path: native `closedby="any"` where supported with the flag, the
  // JS baseline otherwise. Only the mechanism is branched on; the outcome is the same.
  describe("non-modal lightDismiss: a Trigger click while open", () => {
    it.each([
      ["without experimental_closedBy", false],
      ["with experimental_closedBy", true],
    ])("closes with one (false, 'dismiss') from the close event, %s", async (_label, flag) => {
      const action = vi.fn<ActionFn>();
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(
        <div style={{ padding: 40 }}>
          <Dialog.Root defaultOpen={false} modal={false} openChangeAction={action}>
            <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
            <Dialog.Popup
              data-testid="popup"
              aria-label="Help"
              lightDismiss
              experimental_closedBy={flag}
            >
              <button type="button">Inside</button>
            </Dialog.Popup>
          </Dialog.Root>
        </div>,
      );
      await openWithTrigger();
      expect(isModal()).toBe(false);
      await flushFor(); // the `toggle` task attaches the JS baseline's document listeners
      expect(action).toHaveBeenCalledTimes(1);
      await user.click(trigger());
      await settle(() => expect(popup().open).toBe(false));
      if (flag && supportsDialogClosedBy) {
        // The platform dismissed it; the library's JS listener was not attached.
        expect(requestClose).not.toHaveBeenCalled();
      } else {
        expect(requestClose).toHaveBeenCalledTimes(1);
      }
      await settle(() => expect(action).toHaveBeenCalledTimes(2));
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event?.type).toBe("close");
      // No re-open: the click ran while the dialog was still optimistically open.
      await flushFor(50);
      expect(action).toHaveBeenCalledTimes(2);
      expect(popup().open).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    // #117: without `lightDismiss` nothing dismisses on a click outside (design 7), and the
    // Trigger only opens: a real press on it while open is no close at all.
    it("without lightDismiss: a real Trigger press while open neither closes nor dispatches", async () => {
      const focusesButtons = await pressFocusesButtons();
      const action = vi.fn<ActionFn>();
      render(
        <div style={{ padding: 40 }}>
          <Dialog.Root defaultOpen={false} modal={false} openChangeAction={action}>
            <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="Help">
              <button type="button">Inside</button>
            </Dialog.Popup>
          </Dialog.Root>
        </div>,
      );
      await openWithTrigger();
      await flushFor();
      const restore = leaveActEnvironment();
      try {
        const box = trigger().getBoundingClientRect();
        const x = Math.round(box.left + box.width / 2);
        const y = Math.round(box.top + box.height / 2);
        await mouse.down(x, y);
        await sleep(20);
        await mouse.up(x, y);
        await quietPeriod(80, "the dialog must stay open and nothing may be dispatched");
      } finally {
        await mouse.releaseHeld();
        restore();
      }
      expect(popup().open).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      expect(trigger()).toHaveAttribute("data-open", "");
      if (focusesButtons) expect(trigger()).toHaveFocus();
    });

    // JS-free mode (review F1): the light dismiss closes the dialog before the click, and the
    // Trigger, which saw it open at the press, does not `show()` it again.
    function JsFree({ flag }: { flag: boolean }) {
      return (
        <div style={{ padding: 40 }}>
          <Dialog.Root modal={false}>
            <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
            <Dialog.Popup
              data-testid="popup"
              aria-label="Help"
              lightDismiss
              experimental_closedBy={flag}
            >
              <button type="button">Inside</button>
            </Dialog.Popup>
          </Dialog.Root>
        </div>
      );
    }

    it.each([
      ["without experimental_closedBy", false],
      ["with experimental_closedBy", true],
    ])("JS-free: closes once and does not re-open, %s", async (_label, flag) => {
      const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
      render(<JsFree flag={flag} />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await flushFor(); // the `toggle` task attaches the JS baseline's document listeners
      const toggles: string[] = [];
      popup().addEventListener("toggle", (event) => toggles.push((event as ToggleEvent).newState));
      const closes = vi.fn();
      popup().addEventListener("close", closes);
      await user.click(trigger());
      await flushFor(50);
      expect(popup().open).toBe(false);
      expect(closes).toHaveBeenCalledTimes(1);
      expect(toggles).toEqual(["closed"]);
      if (flag && supportsDialogClosedBy) {
        expect(requestClose).not.toHaveBeenCalled();
      } else {
        expect(requestClose).toHaveBeenCalledTimes(1);
      }
      // The next click opens again.
      await user.click(trigger());
      expect(popup().open).toBe(true);
    });

    it("JS-free: Enter on the Trigger while open does nothing", async () => {
      render(<JsFree flag={false} />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await flushFor();
      const toggles: string[] = [];
      popup().addEventListener("toggle", (event) => toggles.push((event as ToggleEvent).newState));
      trigger().focus();
      await user.keyboard("{Enter}");
      await flushFor(50);
      expect(popup().open).toBe(true);
      expect(toggles).toEqual([]);
    });
  });

  // #117: real presses with real timing on the closes the shared suite's modal harness does not
  // reach. A foreign `request-close` / `close` invoker is library-owned (design 2.3: the command is
  // cancelled, the same awaited dispatch as the Close part); a non-modal dialog without
  // `lightDismiss` ignores an outside press (7); its Close part is awaited like the modal one.
  describe("a real press while open: foreign invokers and non-modal", () => {
    async function pressOn(target: Element) {
      const r = target.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      await mouse.down(x, y);
      await sleep(20);
      const atPress = { open: popup().open, focus: document.activeElement };
      await mouse.up(x, y);
      await sleep(20);
      return atPress;
    }

    /** The pending window of an awaited close, then the close once `work` settles. */
    async function expectAwaitedClose(
      action: { mock: { calls: Parameters<ActionFn>[] } },
      calls: number,
      work: { resolve: () => void },
      focus: Element,
      eventType: string,
    ) {
      expect(popup().open).toBe(true);
      expect(document.activeElement).toBe(focus);
      expect(trigger()).toHaveAttribute("data-pending", "");
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(action.mock.calls).toHaveLength(calls + 1);
      const [next, details] = action.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe(eventType);
      expect(details.event?.defaultPrevented).toBe(true);
      await quietPeriod(50, "the dialog must stay open until the action settles");
      expect(popup().open).toBe(true);
      work.resolve();
      await expect.poll(() => popup().open).toBe(false);
      await expect.poll(() => document.activeElement).toBe(trigger());
      await quietPeriod(50, "no re-open and no second dispatch");
      expect(popup().open).toBe(false);
      expect(action.mock.calls).toHaveLength(calls + 1);
    }

    it.each(["request-close", "close"])(
      "a foreign command=%s invoker inside: cancelled, awaited ('activate', the CommandEvent), closed with its value",
      async (command) => {
        const focusesButtons = await pressFocusesButtons();
        const work = deferred();
        const action = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
        render(
          <Library action={action}>
            <button type="button" data-testid="foreign" value="foreign">
              Foreign close
            </button>
          </Library>,
        );
        await openWithTrigger();
        await flushFor();
        const foreign = screen.getByTestId("foreign");
        foreign.setAttribute("commandfor", popup().id);
        foreign.setAttribute("command", command);
        const before = document.activeElement!;
        const calls = action.mock.calls.length;
        leaveActEnvironment();
        const focus = focusesButtons ? foreign : before;
        expect(await pressOn(foreign)).toEqual({ open: true, focus });
        expect(action.mock.calls.at(-1)![1].returnValue).toBe("foreign");
        await expectAwaitedClose(action, calls, work, focus, "command");
        expect(popup().returnValue).toBe("foreign");
      },
    );

    function NonModal({ action }: { action: ActionFn }) {
      return (
        <div style={{ padding: 40 }}>
          <button type="button" data-testid="outside" style={{ display: "block" }}>
            Outside
          </button>
          <Dialog.Root defaultOpen={false} modal={false} openChangeAction={action}>
            <Dialog.Trigger data-testid="trigger">Help</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="Help" style={{ margin: "40px 0 0 0" }}>
              <Dialog.Close data-testid="close">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Root>
        </div>
      );
    }

    it("non-modal without lightDismiss: an outside press neither closes nor dispatches", async () => {
      const focusesButtons = await pressFocusesButtons();
      const action = vi.fn<ActionFn>();
      render(<NonModal action={action} />);
      await openWithTrigger();
      await flushFor();
      leaveActEnvironment();
      const outside = screen.getByTestId("outside");
      const before = document.activeElement;
      expect(await pressOn(outside)).toEqual({
        open: true,
        focus: focusesButtons ? outside : before,
      });
      await quietPeriod(80, "the dialog must stay open and nothing may be dispatched");
      expect(popup().open).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("non-modal: the Close part's close is awaited ('activate'); focus returns to the Trigger", async () => {
      const focusesButtons = await pressFocusesButtons();
      const work = deferred();
      const action = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
      render(<NonModal action={action} />);
      await openWithTrigger();
      await flushFor();
      const close = screen.getByTestId("close");
      const before = document.activeElement!;
      const calls = action.mock.calls.length;
      leaveActEnvironment();
      const focus = focusesButtons ? close : before;
      expect(await pressOn(close)).toEqual({ open: true, focus });
      await expectAwaitedClose(action, calls, work, focus, "click");
    });
  });
});
