// A non-modal Dialog's Escape (jsdom), design/components/dialog.md 2.6 and section 9, #177: the
// Escape is recorded at the dialog (capture) with the inner-layer snapshot and decided last, in a
// window listener added for that event only, or in a task when propagation was stopped.
// `preventDefault()` from any listener keeps the dialog open; `stopPropagation()` does not. The
// HoverCard, Tooltip, Drawer and "manual popover" rows are in dialog.test.tsx (keyboard); the rows
// that need a real engine (a non-modal dialog inside a modal one, an `auto` Popover with
// `stopPropagation()`) are in dialog.browser.test.tsx.
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox } from "../combobox/index.js";
import { HoverCard } from "../hover-card/index.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { flushTasks, setupUser } from "../__tests__/helpers.js";
import { Harness, openThroughTrigger, popup } from "../__tests__/dialog-harness.js";
import type { ActionFn } from "../__tests__/dialog-harness.js";
import { Dialog } from "./index.js";

/** A real-looking Escape `keydown` (bubbles, cancelable, composed) dispatched at `target`. */
function escape(target: Element): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/** A non-modal Dialog with its own test ids (`<name>-trigger`, `<name>-popup`, `<name>-inside`). */
function NonModal({
  name,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  name: string;
  defaultOpen?: boolean;
  onOpenChange?: ActionFn;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root defaultOpen={defaultOpen} modal={false} onOpenChange={onOpenChange}>
      <Dialog.Trigger data-testid={`${name}-trigger`}>Open {name}</Dialog.Trigger>
      <Dialog.Popup data-testid={`${name}-popup`} aria-label={name}>
        <button type="button" data-testid={`${name}-inside`}>
          Inside {name}
        </button>
        {children}
      </Dialog.Popup>
    </Dialog.Root>
  );
}

const dialogOf = (
  name: string,
  root: { getByTestId: (id: string) => HTMLElement } = screen,
): HTMLDialogElement => root.getByTestId(`${name}-popup`) as HTMLDialogElement;

/** The `keydown` listeners added to and removed from the document's window while the spy runs. */
function watchWindowKeydown() {
  const win = document.defaultView!;
  const add = vi.spyOn(win, "addEventListener");
  const remove = vi.spyOn(win, "removeEventListener");
  return {
    added: () => add.mock.calls.filter(([type]) => type === "keydown").length,
    /** Replays the adds and removes in call order. */
    live: () => {
      const steps = [
        ...add.mock.calls.map((args, i) => ({
          args,
          add: true,
          at: add.mock.invocationCallOrder[i]!,
        })),
        ...remove.mock.calls.map((args, i) => ({
          args,
          add: false,
          at: remove.mock.invocationCallOrder[i]!,
        })),
      ].sort((a, b) => a.at - b.at);
      const live = new Set<unknown>();
      for (const { args, add: isAdd } of steps) {
        if (args[0] !== "keydown") continue;
        if (isAdd) live.add(args[1]);
        else live.delete(args[1]);
      }
      return live.size;
    },
    restore: () => {
      add.mockRestore();
      remove.mockRestore();
    },
  };
}

describe("non-modal Dialog Escape (#177)", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  describe.each(["open", "closed"] as const)("in a %s shadow root", (mode) => {
    function renderInShadow(ui: ReactNode) {
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode });
      const container = document.createElement("div");
      shadow.append(container);
      cleanups.push(() => host.remove());
      return render(ui, { container });
    }

    it("Escape from inside closes the dialog", async () => {
      const view = renderInShadow(<NonModal name="a" defaultOpen />);
      await flushTasks(2);
      const dialog = dialogOf("a", view);
      expect(dialog.open).toBe(true);
      expect(escape(view.getByTestId("a-inside")).defaultPrevented).toBe(true);
      expect(dialog.open).toBe(false);
    });

    it("with a manual HoverCard shown inside, the card closes first", async () => {
      const view = renderInShadow(
        <NonModal name="a" defaultOpen>
          <HoverCard.Root defaultOpen>
            <HoverCard.Trigger href="/u/ada" data-testid="card-trigger">
              @ada
            </HoverCard.Trigger>
            <HoverCard.Popup data-testid="card">Ada</HoverCard.Popup>
          </HoverCard.Root>
        </NonModal>,
      );
      await flushTasks(2);
      const dialog = dialogOf("a", view);
      const card = view.getByTestId("card");
      expect(dialog.open).toBe(true);
      expect(isPopoverOpen(card)).toBe(true);
      expect(escape(view.getByTestId("card-trigger")).defaultPrevented).toBe(true);
      expect(isPopoverOpen(card)).toBe(false);
      expect(dialog.open).toBe(true);
      escape(view.getByTestId("a-inside"));
      expect(dialog.open).toBe(false);
    });
  });

  it("nested non-modal dialogs: Escape in the inner closes the inner only, the next the outer", async () => {
    const user = setupUser();
    render(
      <NonModal name="outer">
        <NonModal name="inner" />
      </NonModal>,
    );
    await user.click(screen.getByTestId("outer-trigger"));
    await flushTasks(2);
    await user.click(screen.getByTestId("inner-trigger"));
    await flushTasks(2);
    expect(dialogOf("outer").open).toBe(true);
    expect(dialogOf("inner").open).toBe(true);
    expect(escape(screen.getByTestId("inner-inside")).defaultPrevented).toBe(true);
    expect(dialogOf("inner").open).toBe(false);
    expect(dialogOf("outer").open).toBe(true);
    await flushTasks(2);
    expect(dialogOf("outer").open).toBe(true);
    escape(screen.getByTestId("outer-inside"));
    expect(dialogOf("outer").open).toBe(false);
  });

  it("sibling non-modal dialogs: Escape closes the one that has the target only", async () => {
    const user = setupUser();
    render(
      <>
        <NonModal name="a" />
        <NonModal name="b" />
      </>,
    );
    await user.click(screen.getByTestId("a-trigger"));
    await user.click(screen.getByTestId("b-trigger"));
    await flushTasks(2);
    expect(dialogOf("a").open).toBe(true);
    expect(dialogOf("b").open).toBe(true);
    escape(screen.getByTestId("b-inside"));
    expect(dialogOf("b").open).toBe(false);
    await flushTasks(2);
    expect(dialogOf("a").open).toBe(true);
  });

  describe("stopPropagation() does not keep the dialog open; preventDefault() does", () => {
    it("a native listener inside the dialog stops propagation: closed after a task, one fact", async () => {
      const user = setupUser();
      const fact = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" modal={false} fact={fact} />);
      await openThroughTrigger(user);
      const inside = screen.getByTestId("content");
      const stop = (event: Event) => event.stopPropagation();
      inside.addEventListener("keydown", stop);
      cleanups.push(() => inside.removeEventListener("keydown", stop));
      const event = escape(inside);
      // The event never reached the window: the late path decides after the dispatch (for a
      // scripted event a microtask), and cannot prevent any more.
      await Promise.resolve();
      expect(popup().open).toBe(false);
      await flushTasks(2);
      expect(event.defaultPrevented).toBe(false);
      const closes = fact.mock.calls.filter(([next]) => !next);
      expect(closes).toHaveLength(1);
      expect(closes[0]![1].reason).toBe("dismiss");
    });

    it("a React onKeyDown on an ancestor outside the dialog stops propagation: closed after a task, one fact", async () => {
      const user = setupUser();
      const fact = vi.fn<ActionFn>();
      render(
        <div onKeyDown={(event) => event.stopPropagation()}>
          <Harness mode="uncontrolled" modal={false} fact={fact} />
        </div>,
      );
      await openThroughTrigger(user);
      escape(screen.getByTestId("content"));
      await Promise.resolve();
      expect(popup().open).toBe(false);
      await flushTasks(2);
      const closes = fact.mock.calls.filter(([next]) => !next);
      expect(closes).toHaveLength(1);
      expect(closes[0]![1].reason).toBe("dismiss");
    });

    it("stopPropagation() with preventDefault() as well: the dialog stays open", async () => {
      const user = setupUser();
      render(
        <div
          onKeyDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Harness mode="uncontrolled" modal={false} />
        </div>,
      );
      await openThroughTrigger(user);
      escape(screen.getByTestId("content"));
      await flushTasks(2);
      expect(popup().open).toBe(true);
    });

    it.each(["document", "window"] as const)(
      "preventDefault() from a listener on the %s: the dialog stays open",
      async (where) => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" modal={false} />);
        await openThroughTrigger(user);
        const target = where === "document" ? document : window;
        // Registered before the Escape, so before the dialog's per-event window listener.
        const prevent = (event: Event) => event.preventDefault();
        target.addEventListener("keydown", prevent);
        cleanups.push(() => target.removeEventListener("keydown", prevent));
        escape(screen.getByTestId("content"));
        await flushTasks(2);
        expect(popup().open).toBe(true);
      },
    );
  });

  it("a Combobox chip's Escape is the chip's; the next Escape, from the closed input, closes the dialog", async () => {
    const user = setupUser();
    render(
      <Harness
        mode="uncontrolled"
        modal={false}
        content={
          <Combobox.Root multiple defaultValue={["jp", "fr"]}>
            <Combobox.Label>Countries</Combobox.Label>
            <Combobox.Chips>
              {({ value }) =>
                value.map((v) => (
                  <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`}>
                    {v}
                  </Combobox.Chip>
                ))
              }
            </Combobox.Chips>
            <Combobox.Input data-testid="input" />
            <Combobox.Popup data-testid="list-popup">
              <Combobox.List>
                <Combobox.Option value="jp">Japan</Combobox.Option>
                <Combobox.Option value="fr">France</Combobox.Option>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Root>
        }
      />,
    );
    await openThroughTrigger(user);
    const chip = screen.getByTestId("chip-fr");
    act(() => chip.focus());
    expect(isPopoverOpen(screen.getByTestId("list-popup"))).toBe(false);
    // The chip prevents its Escape and moves focus to the input.
    expect(escape(chip).defaultPrevented).toBe(true);
    expect(screen.getByTestId("input")).toHaveFocus();
    await flushTasks(2);
    expect(popup().open).toBe(true);
    escape(screen.getByTestId("input"));
    await flushTasks(2);
    expect(popup().open).toBe(false);
  });

  it("a non-modal Dialog inside a HoverCard: Escape inside the dialog closes it, from the card the card", async () => {
    const user = setupUser();
    render(
      <HoverCard.Root defaultOpen>
        <HoverCard.Trigger href="/u/ada" data-testid="card-trigger">
          @ada
        </HoverCard.Trigger>
        <HoverCard.Popup data-testid="card">
          <button type="button" data-testid="in-card">
            Follow
          </button>
          <NonModal name="d" />
        </HoverCard.Popup>
      </HoverCard.Root>,
    );
    await flushTasks(2);
    const card = screen.getByTestId("card");
    expect(isPopoverOpen(card)).toBe(true);
    await user.click(screen.getByTestId("d-trigger"));
    await flushTasks(2);
    expect(dialogOf("d").open).toBe(true);
    expect(isPopoverOpen(card)).toBe(true);
    expect(escape(screen.getByTestId("d-inside")).defaultPrevented).toBe(true);
    expect(dialogOf("d").open).toBe(false);
    expect(isPopoverOpen(card)).toBe(true);
    await flushTasks(2);
    expect(isPopoverOpen(card)).toBe(true);
    expect(escape(screen.getByTestId("in-card")).defaultPrevented).toBe(true);
    expect(isPopoverOpen(card)).toBe(false);
  });

  describe("no window listener outside one Escape's dispatch", () => {
    it("after an Escape that closed the dialog and after one that was prevented", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" modal={false} />);
      await openThroughTrigger(user);
      const spy = watchWindowKeydown();
      cleanups.push(spy.restore);
      const inside = screen.getByTestId("content");
      const prevent = (event: Event) => event.preventDefault();
      inside.addEventListener("keydown", prevent);
      escape(inside);
      inside.removeEventListener("keydown", prevent);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(spy.added()).toBe(1);
      expect(spy.live()).toBe(0);
      escape(inside);
      expect(popup().open).toBe(false);
      expect(spy.added()).toBe(2);
      expect(spy.live()).toBe(0);
    });

    it("unmount while a record is pending removes the listener and the late path decides nothing", async () => {
      const user = setupUser();
      const view = render(<Harness mode="uncontrolled" modal={false} />);
      await openThroughTrigger(user);
      const spy = watchWindowKeydown();
      cleanups.push(spy.restore);
      const inside = screen.getByTestId("content");
      const dialog = popup();
      const requestClose = vi.spyOn(dialog, "requestClose");
      let liveDuringDispatch = -1;
      // Inside the dispatch, after the dialog's capture listener recorded the Escape: unmount.
      inside.addEventListener("keydown", (event) => {
        liveDuringDispatch = spy.live();

        event.stopPropagation();
        view.unmount();
      });
      escape(inside);
      expect(liveDuringDispatch).toBe(1);
      expect(spy.live()).toBe(0);
      await flushTasks(2);
      expect(requestClose).not.toHaveBeenCalled();
    });

    it("a closed or never-opened non-modal dialog adds none", async () => {
      const spy = watchWindowKeydown();
      cleanups.push(spy.restore);
      render(<NonModal name="a" />);
      await flushTasks(2);
      const dialog = dialogOf("a");
      expect(dialog.open).toBe(false);
      escape(dialog);
      escape(document.body);
      expect(spy.added()).toBe(0);
    });
  });
});
