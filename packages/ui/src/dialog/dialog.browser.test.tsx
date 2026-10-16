// Dialog rows that need a real engine (design/components/dialog.md 13.3): real Invoker Commands,
// `showModal()` with top layer and `:modal`, Escape as a close request, the platform's focusing
// steps and focus return through a deferred `showModal()`, nested dialogs, native `closedby`
// light dismiss (with the JS fallback where the engine lacks it), `<form method="dialog">`,
// exit animations and the deferred unmount (branching on whether the engine animates the exit;
// Firefox does not), and the CSS scroll-lock recipe. Real keyboard and pointer input comes from
// Playwright through `userEvent` from `vitest/browser`.
import { act, render, screen } from "@testing-library/react";
import { Suspense, useRef } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
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
    await userEvent.click(trigger());
    expect(popup().open).toBe(true);
    expect(isModal()).toBe(true);
    // The platform's focusing steps: the first focusable descendant.
    expect(document.activeElement).toHaveAttribute("name", "name");
    await userEvent.keyboard("{Escape}");
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
    await userEvent.click(trigger());
    await userEvent.click(screen.getByTestId("close"));
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
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(popup().open).toBe(false);
    expect(popup().returnValue).toBe("ok");
  });
});

describe("library mode (browser)", () => {
  it("the Trigger's click goes through the library: pending, then showModal()", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(<Library action={action} />);
    await userEvent.click(trigger());
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
    await userEvent.click(foreign);
    expect(action).toHaveBeenCalledTimes(1);
    const event = action.mock.calls[0]![1].event!;
    expect(event.type).toBe("command");
    expect(event).toBeInstanceOf(CommandEvent);
    await flush();
    expect(popup().open).toBe(true);
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
    await userEvent.click(trigger());
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
    await userEvent.click(trigger());
    await flush();
    expect(popup().open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(popup().open).toBe(false);
    expect(trigger()).toHaveFocus();
    await flush();
    expect(action).toHaveBeenCalledTimes(2);
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
    await userEvent.click(trigger());
    await flush();
    expect(document.activeElement).toHaveAttribute("name", "email");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("autofocus");
    await userEvent.keyboard("{Escape}");
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
    await userEvent.click(trigger());
    await flush();
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
    await userEvent.click(trigger());
    await flush();
    await userEvent.click(screen.getByTestId("inner-trigger"));
    const inner = screen.getByTestId("inner") as HTMLDialogElement;
    // No `transition`, so the inner Popup renders no `<ViewTransition>` and the outer open starts
    // no view transition that would hold the inner open (#35, transition-boundary.browser.test).
    await expect.poll(() => inner.open).toBe(true);
    expect(popup().open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(inner.open).toBe(false);
    expect(popup().open).toBe(true);
    expect(screen.getByTestId("inner-trigger")).toHaveFocus();
    await flush();
    await userEvent.keyboard("{Escape}");
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
    await userEvent.click(trigger());
    await flush();
    await userEvent.click(screen.getByTestId("delete"));
    expect(popup().open).toBe(true);
    expect(screen.getByTestId("delete")).toHaveAttribute("data-pending", "");
    await act(async () => d.resolve());
    expect(popup().open).toBe(false);
    await flush();
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
    await userEvent.click(trigger());
    await flush();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(popup().open).toBe(true);
    await act(async () => save.resolve());
    await flush();
    expect(popup().open).toBe(false);
    expect(popup().returnValue).toBe("save");
    expect(action.mock.calls[1]![1].reason).toBe("activate");
    expect(action.mock.calls[1]![1].returnValue).toBe("save");
  });
});

describe("light dismiss (browser)", () => {
  /** A real click on the ::backdrop: on the dialog, outside its border box. */
  async function clickBackdrop() {
    await userEvent.click(popup(), { position: { x: -20, y: -20 }, force: true });
  }

  it("modal, baseline JS: a backdrop click closes; a click inside does not", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} popup={{ lightDismiss: true }} />);
    await userEvent.click(trigger());
    await flush();
    await userEvent.click(screen.getByRole("heading"));
    expect(popup().open).toBe(true);
    await clickBackdrop();
    expect(popup().open).toBe(false);
    await flush();
    expect(action.mock.calls[1]![1].reason).toBe("dismiss");
  });

  it("modal without lightDismiss: a backdrop click does nothing", async () => {
    render(<Library />);
    await userEvent.click(trigger());
    await flush();
    await clickBackdrop();
    expect(popup().open).toBe(true);
  });

  it("experimental_closedBy: native closedby='any' where supported, the JS fallback elsewhere", async () => {
    const action = vi.fn<ActionFn>();
    const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
    render(<Library action={action} popup={{ lightDismiss: true, experimental_closedBy: true }} />);
    expect(popup()).toHaveAttribute("closedby", "any");
    await userEvent.click(trigger());
    await flush();
    await clickBackdrop();
    expect(popup().open).toBe(false);
    if (supportsDialogClosedBy) {
      // The platform dismissed it; the library's JS listener was not attached.
      expect(requestClose).not.toHaveBeenCalled();
    } else {
      expect(requestClose).toHaveBeenCalledTimes(1);
    }
    await flush();
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
    await userEvent.click(trigger());
    await flush();
    expect(popup().open).toBe(true);
    expect(isModal()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(popup().open).toBe(true);
    await userEvent.click(screen.getByTestId("outside"));
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
    await userEvent.click(trigger());
    await flush();
    await sleep(350); // let the enter transition finish
    expect(popup().open).toBe(true);
    let exitAnimations = -1;
    popup().addEventListener("close", () => {
      void getComputedStyle(popup()).opacity;
      exitAnimations = popup().getAnimations({ subtree: true }).length;
    });
    await userEvent.keyboard("{Escape}");
    await flush();
    expect(exitAnimations).toBeGreaterThanOrEqual(0);
    if (exitAnimations > 0) {
      // Chromium / WebKit: the dialog is still fading out; the content stays.
      expect(screen.queryByTestId("content")).not.toBeNull();
      await expect.poll(() => screen.queryByTestId("content"), { timeout: 2000 }).toBeNull();
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
    await userEvent.click(trigger());
    await flush();
    expect(getComputedStyle(html).overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(getComputedStyle(html).overflow).not.toBe("hidden");
  });
});
