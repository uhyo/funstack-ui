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
// flush React's queue itself.
import { act, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useEffect, useRef, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsDialogClosedBy } from "../__tests__/engine.js";
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

  it("a foreign request-close invoker is intercepted; its value arrives through event.source (#46)", async () => {
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
      // The unmount is a normal update the Popup makes when the animations finish: inside `act`.
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

  it("a controlled close without transition keeps the content through the fade, mounted once (#46)", async () => {
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
            <Dialog.Popup data-testid="popup" aria-label="Edit" className="fade">
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
    await sleep(350); // the enter fade
    expect(mounts).toBe(1);
    let exitAnimations = -1;
    let finished: Promise<unknown> = Promise.resolve();
    popup().addEventListener("close", () => {
      void getComputedStyle(popup()).opacity;
      const animations = popup().getAnimations({ subtree: true });
      exitAnimations = animations.length;
      finished = Promise.allSettled(animations.map((animation) => animation.finished));
    });
    // A programmatic close (the dialog's page is inert, so not a click on the page).
    await act(async () => screen.getByTestId("close-from-outside").click());
    expect(popup().open).toBe(false);
    await settle(() => expect(exitAnimations).toBeGreaterThanOrEqual(0));
    if (exitAnimations > 0) {
      // Chromium / WebKit: the close commit held the content and it is still there mid-fade.
      expect(screen.queryByTestId("content")).not.toBeNull();
      await act(async () => {
        await finished;
        await sleep(20);
      });
    }
    await settle(() => expect(screen.queryByTestId("content")).toBeNull());
    // Never emptied and re-mounted into the fading dialog (the pre-#46 behaviour).
    expect(mounts).toBe(1);
  });
});

describe("ViewTransition (browser, #46)", () => {
  type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let actEnvironment: boolean | undefined;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    transitions = [];
    const original = document.startViewTransition.bind(document);
    vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      const element = document.querySelector<HTMLDialogElement>("[data-testid=popup]");
      calls.push({ openAtStart: element?.open ?? false });
      const transition = original(arg);
      transitions.push(transition);
      return transition;
    }) as typeof document.startViewTransition);
    actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    cleanups.push(
      addStyle(`
        ::view-transition-old(.pop) { animation: 200ms ease-in both vt-pop-out; }
        ::view-transition-new(.pop) { animation: 200ms ease-out both vt-pop-in; }
        @keyframes vt-pop-out { to { opacity: 0; } }
        @keyframes vt-pop-in { from { opacity: 0; } }
      `),
    );
  });

  afterEach(async () => {
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  const isOpen = () => popup().open;

  /** The view-transition pseudo-element animations running now (read at `ready`). */
  function pseudoAnimations(prefix: string): Animation[] {
    return document
      .getAnimations()
      .filter((animation) =>
        ((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(prefix),
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
  }: {
    transition?: ViewTransitionClass;
    className?: string;
    keepMounted?: boolean;
    modal?: boolean;
    controlled?: boolean;
  }) {
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

  /** Opens through the Trigger and waits for the open's view transition (if any) to finish. */
  async function open(): Promise<void> {
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await Promise.allSettled(transitions.map((t) => t.finished));
  }

  it.each([
    ["a Dialog.Close", "close"],
    ['a method="dialog" submit', "ok"],
    ["a controlled open={false}", "parent-close"],
  ])('transition="pop": the open and %s each run one view transition', async (_, testId) => {
    render(<Plain transition="pop" controlled={testId === "parent-close"} />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    // Started before the dialog was shown; shown inside the update callback.
    expect(calls[0]!.openAtStart).toBe(false);
    await transitions[0]!.updateCallbackDone;
    expect(isOpen()).toBe(true);
    expect(popup().matches(":modal")).toBe(true);
    await transitions[0]!.finished;

    screen.getByTestId(testId).click();
    await expect.poll(() => calls.length).toBe(2);
    // The library closes inside the update callback, so the dialog is open at the start.
    expect(calls[1]!.openAtStart).toBe(true);
    await transitions[1]!.ready;
    // The old snapshot carries the dialog (with its content) out, in every engine.
    expect(pseudoAnimations("::view-transition-old").length).toBeGreaterThan(0);
    await transitions[1]!.finished;
    expect(isOpen()).toBe(false);
    expect(screen.queryByTestId("content")).toBeNull();
    const expected = testId === "close" ? "cancel" : testId === "ok" ? "ok" : "";
    expect(popup().returnValue).toBe(expected);
    await sleep(50);
    expect(calls).toHaveLength(2);
  });

  it('transition="pop": the opening commit captures the dialog shown by showModal() (10.3)', async () => {
    render(<Plain transition="pop" />);
    trigger().click();
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.ready;
    // The top-layer dialog promoted inside the update callback has a new snapshot. If an engine
    // ever stops capturing it, this row tells (design 10.3 then documents the open as CSS only).
    expect(pseudoAnimations("::view-transition-new").length).toBeGreaterThan(0);
    await transitions[0]!.finished;
    expect(isOpen()).toBe(true);
  });

  it('transition="pop": an Escape runs one only for the notification commit, dialog already closed', async () => {
    render(<Plain transition="pop" />);
    await open();
    expect(calls).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(false);
    await transitions[1]!.finished;
    await expect.poll(() => screen.queryByTestId("content")).toBeNull();
    await sleep(50);
    expect(calls).toHaveLength(2);
  });

  /** The `::view-transition-*` pseudo-elements animating now, by name (read at `ready`). */
  function pseudoNames(): string[] {
    return [
      ...new Set(
        document
          .getAnimations()
          .map((animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "")
          .filter((name) => name.startsWith("::view-transition-")),
      ),
    ].sort();
  }

  /** The dialog's `new` image: any `::view-transition-new` other than the root's. */
  const dialogNewImages = () =>
    pseudoNames().filter(
      (name) => name.startsWith("::view-transition-new(") && name !== "::view-transition-new(root)",
    );

  // The CSS exit of design 10.1 on the box, plus the recipe that cuts it while a view transition
  // runs (review M2 of #46): without the last rule, Chromium keeps the closing dialog rendered
  // through its fade and captures it as a live `::view-transition-new` next to the old image.
  // WebKit (CI, Playwright's WebKit build, 2026-10): the box is already `display: none` at
  // `ready` with or without the recipe, so it cannot have a new image; yet WebKit lists the
  // animation of the dialog's group under `::view-transition-new(<name>)` and none under `old`.
  // The names are not reliable there, so the WebKit rows assert the box's `display` only.
  const namesReliable = browserName !== "webkit";
  const cssExit = (recipe: boolean) => `
    .fade, .fade::backdrop {
      opacity: 0;
      transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
    }
    .fade:open, .fade:open::backdrop { opacity: 1; }
    @starting-style { .fade:open, .fade:open::backdrop { opacity: 0; } }
    ${recipe ? "html:active-view-transition .fade { transition: none; }" : ""}
  `;

  it('transition="pop" plus a CSS exit and the recipe: an Escape runs one view transition, no new image of the dialog', async () => {
    cleanups.push(addStyle(cssExit(true)));
    render(<Plain transition="pop" className="fade" />);
    await open();
    await sleep(250); // the enter fade
    await userEvent.keyboard("{Escape}");
    // The notification commit (design 4.4); the content may be held for the CSS fade.
    await expect.poll(() => calls.length).toBe(2);
    await transitions[1]!.ready;
    if (namesReliable) expect(dialogNewImages(), JSON.stringify(pseudoNames())).toEqual([]);
    await transitions[1]!.finished;
    await expect.poll(() => screen.queryByTestId("content")).toBeNull();
    // Releasing the hold is a normal update: no second document view transition.
    await sleep(100);
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["a Dialog.Close", "close"],
    ["a controlled open={false}", "parent-close"],
  ])(
    'transition="pop" plus a CSS exit and the recipe: %s has the old image only',
    async (_, testId) => {
      cleanups.push(addStyle(cssExit(true)));
      render(<Plain transition="pop" className="fade" controlled={testId === "parent-close"} />);
      await open();
      await sleep(250); // the enter fade
      screen.getByTestId(testId).click();
      await expect.poll(() => calls.length).toBe(2);
      await transitions[1]!.ready;
      const names = pseudoNames();
      const seen = JSON.stringify({ names, display: getComputedStyle(popup()).display });
      // Not rendered while the new snapshot is taken: no live image of the fading dialog.
      expect(getComputedStyle(popup()).display, seen).toBe("none");
      if (namesReliable) {
        expect(
          names.some(
            (name) =>
              name.startsWith("::view-transition-old(") && name !== "::view-transition-old(root)",
          ),
          seen,
        ).toBe(true);
        expect(dialogNewImages(), seen).toEqual([]);
      }
      await transitions[1]!.finished;
      expect(isOpen()).toBe(false);
      await sleep(100);
      expect(calls).toHaveLength(2);
    },
  );

  it('characterisation: transition="pop" plus a CSS exit without the recipe has a live new image in Chromium', async () => {
    cleanups.push(addStyle(cssExit(false)));
    render(<Plain transition="pop" className="fade" />);
    await open();
    await sleep(250);
    screen.getByTestId("close").click();
    await expect.poll(() => calls.length).toBe(2);
    await transitions[1]!.ready;
    // Chromium keeps the closed dialog rendered through its CSS fade, so the new snapshot
    // captures it: a double image. Firefox closes at once (bug 1834877) and WebKit has the box
    // `display: none` by `ready`: no new image. If this row starts failing, an engine changed;
    // re-check the docs' recipe.
    const fading = getComputedStyle(popup()).display !== "none";
    const seen = JSON.stringify({ names: pseudoNames(), fading });
    expect(fading, seen).toBe(browserName === "chromium");
    if (namesReliable) expect(dialogNewImages().length > 0, seen).toBe(fading);
    await transitions[1]!.finished;
  });

  it("without transition: no view transition for an open, a Close close or an Escape", async () => {
    render(<Plain />);
    await open();
    screen.getByTestId("close").click();
    await expect.poll(() => isOpen()).toBe(false);
    await open();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => isOpen()).toBe(false);
    await sleep(50);
    expect(calls).toHaveLength(0);
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
      await open();
      const close = screen.getByTestId("close");
      close.focus();
      expect(close).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => isOpen()).toBe(false);
      await Promise.allSettled(transitions.map((t) => t.finished));
      await expect.poll(() => document.activeElement).toBe(trigger());
    });
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
