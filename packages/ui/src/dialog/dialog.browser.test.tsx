// Dialog rows that need a real engine (design/components/dialog.md 13.3): real Invoker Commands,
// `showModal()` with top layer and `:modal`, Escape as a close request, the platform's focusing
// steps and focus return through a deferred `showModal()`, nested dialogs, native `closedby`
// light dismiss (with the JS fallback where the engine lacks it) and its press-and-click rule
// under a real drag, Escape left to a popover inside a non-modal dialog, the nested-confirm
// pattern (design 11.10 / 12.5 as reworked after the review), `<form method="dialog">`, exit
// animations and the deferred unmount (branching on whether the engine animates the exit;
// Firefox does not), and the CSS scroll-lock recipe. Real keyboard and pointer input comes from
// Playwright through `user` (`userEvent` from `vitest/browser` inside `act`).
import { act, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useRef, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { supportsDialogClosedBy } from "../__tests__/engine.js";
import { createSuspender, deferred } from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import type { DialogOpenChangeDetails, DialogPopupProps } from "./index.js";

type ActionFn = (next: boolean, details: DialogOpenChangeDetails) => unknown;

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup") as HTMLDialogElement;
const isModal = () => popup().matches(":modal");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lets queued `close` / `toggle` tasks and React's follow-up work run. */
const flush = () =>
  act(async () => {
    await sleep(20);
  });

/**
 * Flushes until `check` passes, rethrowing its last failure after `timeout` ms. The first round
 * is one `flush()`; more rounds only absorb a slow `close` / `toggle` task under load (issue #49).
 */
async function settle(check: () => void, timeout = 2000): Promise<void> {
  const start = performance.now();
  for (;;) {
    await flush();
    try {
      check();
      return;
    } catch (error) {
      if (performance.now() - start > timeout) throw error;
    }
  }
}

/** Clicks the Trigger and waits for the library's deferred `showModal()` / `show()`. */
async function openWithTrigger(): Promise<void> {
  await user.click(trigger());
  await settle(() => expect(popup().open).toBe(true));
}

function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

const cleanups: (() => void)[] = [];

afterEach(async () => {
  // Close anything left open so the next test starts with an interactive page.
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

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

describe("JS-free mode (browser)", () => {
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

describe("library mode (browser)", () => {
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
    await flush();
    expect(popup().open).toBe(false);
    expect(trigger()).toHaveAttribute("data-pending", "");
    expect(screen.queryByTestId("fallback")).toBeNull();
    await act(async () => suspender.resolve("order", "Order #1"));
    expect(popup().open).toBe(true);
    expect(screen.getByTestId("suspender")).toHaveTextContent("Order #1");
  });

  it("Escape closes with reason 'dismiss'; focus returns to the Trigger", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} />);
    await openWithTrigger();
    await user.keyboard("{Escape}");
    expect(popup().open).toBe(false);
    expect(trigger()).toHaveFocus();
    await settle(() => expect(action).toHaveBeenCalledTimes(2));
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("dismiss");
    expect(details.returnValue).toBe("");
    expect(details.event?.type).toBe("close");
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
    await flush();
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
    await flush();
    expect(popup().open).toBe(true);
    await act(async () => save.resolve());
    await settle(() => expect(popup().open).toBe(false));
    expect(popup().returnValue).toBe("save");
    await settle(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]![1].reason).toBe("activate");
    expect(action.mock.calls[1]![1].returnValue).toBe("save");
  });
});

describe("light dismiss (browser)", () => {
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
    render(<Library action={action} popup={{ lightDismiss: true, experimental_closedBy: true }} />);
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
});

describe("review rows (browser)", () => {
  /** Design 12.5 as reworked: no action awaits user input (H1). */
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

  it("nested confirm: the inner dialog opens at once; the outer closes after the confirm (H1)", async () => {
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

  it("lightDismiss (JS baseline): a drag from inside that ends on the backdrop does not close (M1)", async () => {
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
    await flush();
    expect(popup().open).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    // A real backdrop click still closes.
    await user.click(popup(), { position: { x: -20, y: -20 }, force: true });
    expect(popup().open).toBe(false);
  });

  it("non-modal: Escape inside a popover closes the popover only (M2)", async () => {
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
    await flush();
    expect(menu.matches(":popover-open")).toBe(false);
    expect(popup().open).toBe(true);
    // With no popover open, Escape inside the dialog closes it.
    screen.getByTestId("inside").focus();
    await user.keyboard("{Escape}");
    expect(popup().open).toBe(false);
  });
});

describe("exit animation and the deferred unmount (browser)", () => {
  it("keeps the content mounted while the exit animation runs; none in Firefox", async () => {
    cleanups.push(
      addStyle(`
        .fade, .fade::backdrop {
          opacity: 0;
          transition: opacity 300ms, display 300ms allow-discrete, overlay 300ms allow-discrete;
        }
        .fade:open, .fade:open::backdrop { opacity: 1; }
        @starting-style { .fade:open, .fade:open::backdrop { opacity: 0; } }
      `),
    );
    render(
      <Library popup={{ className: "fade" }}>
        <span data-testid="content">content</span>
      </Library>,
    );
    await openWithTrigger();
    await sleep(350); // let the enter transition finish
    expect(popup().open).toBe(true);
    let exitAnimations = -1;
    let finished: Promise<unknown> = Promise.resolve();
    popup().addEventListener("close", () => {
      void getComputedStyle(popup()).opacity;
      const animations = popup().getAnimations({ subtree: true });
      exitAnimations = animations.length;
      finished = Promise.allSettled(animations.map((animation) => animation.finished));
    });
    await user.keyboard("{Escape}");
    // The `close` listener ran (it is a queued task).
    await settle(() => expect(exitAnimations).toBeGreaterThanOrEqual(0));
    if (exitAnimations > 0) {
      // Chromium / WebKit: the dialog is still fading out; the content stays.
      expect(screen.queryByTestId("content")).not.toBeNull();
      // The unmount is a transition the Popup starts when the animations finish: inside `act`.
      await act(async () => {
        await finished;
        await sleep(20);
      });
      expect(screen.queryByTestId("content")).toBeNull();
    } else {
      // Firefox: `display` flips at once (bug 1834877); nothing to wait for.
      expect(screen.queryByTestId("content")).toBeNull();
    }
  });
});

describe("scroll lock recipe (browser)", () => {
  it("html:has(dialog:modal) { overflow: hidden } applies while a modal dialog is open", async () => {
    cleanups.push(
      addStyle(`
        html { scrollbar-gutter: stable; }
        html:has(dialog:modal) { overflow: hidden; }
      `),
    );
    render(<Library />);
    const html = document.documentElement;
    expect(getComputedStyle(html).overflow).not.toBe("hidden");
    await openWithTrigger();
    expect(getComputedStyle(html).overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(getComputedStyle(html).overflow).not.toBe("hidden");
  });
});
