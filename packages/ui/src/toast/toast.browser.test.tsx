// Toast rows that need a real engine (design/components/toast.md 16.2): the region in the top
// layer and its re-raise above a later popover, the move into a real modal `<dialog>` (outside it
// the region would be inert), CSS enter / exit animations and the held `data-ending` toast,
// `document.ariaNotify`, no view transition, and real focus for F8 and Escape. Real input comes
// from Playwright through `user` (`userEvent` from `vitest/browser` inside `act`).
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - `ariaNotify` is in Chromium 141+, Firefox 150+ and Safari 27; where a Playwright build lacks
//   it (`supportsAriaNotify`), the row asserts the library does not throw.
// - Firefox animates CSS transitions on a toast element (not a popover's own exit), so the exit
//   rows hold in all three engines; the region itself has no exit animation.
// - Re-raise (design 4.2): the existing toast's `@starting-style` enter must not replay on
//   `hidePopover(); showPopover()`. Verified in Chromium and Firefox; WebKit on CI.
// - Prefers-reduced-motion cannot be emulated from inside the page; the "no animation" row uses a
//   stylesheet without transitions instead (the same code path: no animations, dropped at once).
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { supportsAriaNotify } from "../__tests__/engine.js";
import { Dialog } from "../dialog/index.js";
import { Menu } from "../menu/index.js";
import { createToastManager, Toast } from "./index.js";
import type { ToastItem, ToastManager, ToastViewportState } from "./index.js";
import { addStyle, flushFor, sleep, settle } from "../__tests__/browser-helpers.js";

async function call<T>(fn: () => T): Promise<T> {
  let result!: T;
  await act(async () => {
    result = fn();
    await sleep(0);
  });
  return result;
}

/** The design's starter stylesheet (10.4), with short transitions. */
const STARTER_CSS = `
  .toasts {
    position: fixed; inset: auto 16px 16px auto; margin: 0; padding: 0; border: 0;
    display: flex; flex-direction: column-reverse; gap: 8px; width: 240px;
    pointer-events: none; background: transparent; overflow: visible;
  }
  .toast { pointer-events: auto; padding: 12px; background: white; color: black;
           transition: opacity 120ms, translate 120ms; }
  @starting-style { .toast { opacity: 0; translate: 0 16px; } }
  .toast[data-ending] { opacity: 0; translate: 0 16px; }
`;

const PLAIN_CSS = `
  .toasts { position: fixed; inset: auto 16px 16px auto; margin: 0; padding: 0; border: 0;
            width: 240px; }
  .toast { padding: 12px; background: white; }
`;

let manager: ToastManager;

beforeEach(() => {
  manager = createToastManager();
});

function renderToast(t: ToastItem) {
  return (
    <Toast.Root key={t.id} toast={t} className="toast" data-testid={`toast-${t.id}`}>
      <Toast.Title />
      <Toast.Description />
      <Toast.Action data-testid={`action-${t.id}`} />
      <Toast.Close data-testid={`close-${t.id}`} aria-label="Close">
        ×
      </Toast.Close>
    </Toast.Root>
  );
}

function Viewport({ before }: { before?: ReactNode }) {
  return (
    <>
      <button type="button" data-testid="outside">
        Outside
      </button>
      {before}
      <Toast.Viewport manager={manager} className="toasts" data-testid="viewport">
        {({ toasts }: ToastViewportState) => toasts.map(renderToast)}
      </Toast.Viewport>
    </>
  );
}

const region = () => screen.getByTestId("viewport");
const root = (id: string) => screen.getByTestId(`toast-${id}`);
const queryRoot = (id: string) => screen.queryByTestId(`toast-${id}`);
const isOpen = (element: Element) => element.matches(":popover-open");

/** Whether a real pointer at the element's centre hits it (not something above it). */
function hitTestable(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return hit !== null && element.contains(hit);
}

describe("Toast (browser)", () => {
  describe("top layer", () => {
    it("shows the region with the first toast and hides it after the last leaves", async () => {
      addStyle(PLAIN_CSS);
      render(<Viewport />);
      expect(isOpen(region())).toBe(false);
      const id = await call(() => manager({ title: "Saved", duration: null }));
      expect(isOpen(region())).toBe(true);
      expect(hitTestable(root(id))).toBe(true);
      await user.click(screen.getByTestId(`close-${id}`));
      await settle(() => expect(queryRoot(id)).toBeNull());
      expect(isOpen(region())).toBe(false);
    });

    it("adding a toast does not close an open Menu", async () => {
      addStyle(PLAIN_CSS);
      render(
        <Viewport
          before={
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Actions</Menu.Trigger>
              <Menu.Popup data-testid="menu">
                <Menu.Item>Rename</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          }
        />,
      );
      await user.click(screen.getByTestId("menu-trigger"));
      await settle(() => expect(isOpen(screen.getByTestId("menu"))).toBe(true));
      const id = await call(() => manager({ title: "Hello", duration: null }));
      // Still open (nothing closed it): checked after the flush, not waited for.
      await flushFor();
      expect(isOpen(screen.getByTestId("menu"))).toBe(true);
      expect(isOpen(region())).toBe(true);
      // Re-raised above it for a second toast as well.
      await call(() => manager({ title: "Again", duration: null }));
      // Still open (nothing closed it): checked after the flush, not waited for.
      await flushFor();
      expect(isOpen(screen.getByTestId("menu"))).toBe(true);
      expect(root(id)).toBeVisible();
    });

    it("a click on a toast light-dismisses an open auto popover (expected)", async () => {
      addStyle(PLAIN_CSS);
      render(
        <Viewport
          before={
            <div
              popover="auto"
              data-testid="pop"
              style={{ inset: "16px auto auto 16px", margin: 0 }}
            >
              Popover
            </div>
          }
        />,
      );
      const id = await call(() => manager({ title: "Hi", duration: null }));
      const pop = screen.getByTestId("pop");
      pop.showPopover();
      expect(isOpen(pop)).toBe(true);
      await user.click(root(id));
      await settle(() => expect(isOpen(pop)).toBe(false));
    });
  });

  describe("re-raise", () => {
    it("a toast added while a later popover covers the region is on top; the popover stays open", async () => {
      addStyle(STARTER_CSS);
      render(
        <Viewport
          before={
            <div
              popover="manual"
              data-testid="cover"
              style={{ inset: "auto 0 0 auto", width: 400, height: 400, margin: 0, padding: 0 }}
            >
              Cover
            </div>
          }
        />,
      );
      const first = await call(() => manager({ title: "First", duration: null }));
      // Let the first toast's enter transition finish.
      await act(async () => {
        await Promise.allSettled(
          root(first)
            .getAnimations()
            .map((a) => a.finished),
        );
        await sleep(30);
      });
      const cover = screen.getByTestId("cover");
      cover.showPopover();
      expect(hitTestable(root(first))).toBe(false);
      const second = await call(() => manager({ title: "Second", duration: null }));
      expect(isOpen(cover)).toBe(true);
      // No enter replay on the existing toast (design 4.2).
      expect(root(first).getAnimations()).toHaveLength(0);
      await act(async () => {
        await Promise.allSettled(
          root(second)
            .getAnimations()
            .map((a) => a.finished),
        );
      });
      expect(hitTestable(root(second))).toBe(true);
      expect(hitTestable(root(first))).toBe(true);
    });
  });

  describe("modal dialog", () => {
    function WithDialog() {
      const [open, setOpen] = useState(false);
      return (
        <Dialog.Root open={open} openChangeAction={setOpen}>
          <Dialog.Trigger data-testid="open-dialog">Edit</Dialog.Trigger>
          <Dialog.Popup data-testid="dialog">
            <Dialog.Title>Edit</Dialog.Title>
            <Dialog.Close data-testid="close-dialog">Done</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>
      );
    }

    it("moves the region into an open modal Dialog so the Undo is focusable and clickable, and back", async () => {
      addStyle(PLAIN_CSS);
      const undo = vi.fn();
      render(<Viewport before={<WithDialog />} />);
      const id = await call(() =>
        manager({ title: "Archived", action: { label: "Undo", action: undo }, closeAction() {} }),
      );
      await user.click(screen.getByTestId("open-dialog"));
      await flushFor();
      const dialog = screen.getByTestId("dialog");
      expect(dialog.matches(":modal")).toBe(true);
      expect(dialog.contains(region())).toBe(true);
      expect(isOpen(region())).toBe(true);
      const action = screen.getByTestId(`action-${id}`);
      action.focus();
      expect(action).toHaveFocus();
      expect(hitTestable(action)).toBe(true);

      await user.click(screen.getByTestId("close-dialog"));
      await settle(() => expect(dialog.matches(":modal")).toBe(false));
      expect(region().closest("dialog")).toBeNull();
      expect(isOpen(region())).toBe(true);
      expect(region().checkVisibility()).toBe(true);
      await user.click(screen.getByTestId(`action-${id}`));
      await settle(() => expect(undo).toHaveBeenCalledTimes(1));
      expect(queryRoot(id)).toBeNull();
    });
  });

  describe("enter and exit", () => {
    it("animates the enter; holds the closed toast with data-ending until its animations settle", async () => {
      // A long exit, so the held state is asserted without racing the clock; the test then
      // finishes the exit itself.
      addStyle(STARTER_CSS + ".toast[data-ending] { transition-duration: 5s; }");
      render(<Viewport />);
      const id = await call(() => manager({ title: "Saved", duration: null }));
      expect(root(id).getAnimations().length).toBeGreaterThan(0);
      await act(async () => {
        await Promise.allSettled(
          root(id)
            .getAnimations()
            .map((a) => a.finished),
        );
      });
      await user.click(screen.getByTestId(`close-${id}`));
      const element = root(id);
      expect(element).toHaveAttribute("data-ending", "");
      expect(element.inert).toBe(true);
      const exits = element.getAnimations();
      expect(exits.length).toBeGreaterThan(0);
      expect(isOpen(region())).toBe(true);
      await act(async () => {
        for (const animation of exits) animation.finish();
        await Promise.allSettled(exits.map((a) => a.finished));
        await sleep(20);
      });
      expect(queryRoot(id)).toBeNull();
      expect(isOpen(region())).toBe(false);
    });

    it("does not wait for an animation that ran before the close (a progress bar)", async () => {
      addStyle(
        PLAIN_CSS +
          `@keyframes toast-progress { from { scale: 1 1; } to { scale: 0 1; } }
           .progress { height: 2px; background: black; transform-origin: left;
                       animation: toast-progress 5s linear; }
           .toasts[data-paused] .progress { animation-play-state: paused; }`,
      );
      render(
        <>
          <Toast.Viewport manager={manager} className="toasts" data-testid="viewport">
            {({ toasts }: ToastViewportState) =>
              toasts.map((t) => (
                <Toast.Root key={t.id} toast={t} className="toast" data-testid={`toast-${t.id}`}>
                  <Toast.Title />
                  <div className="progress" />
                  <Toast.Close data-testid={`close-${t.id}`}>Close</Toast.Close>
                </Toast.Root>
              ))
            }
          </Toast.Viewport>
        </>,
      );
      const id = await call(() => manager({ title: "Saved", duration: null }));
      expect(root(id).getAnimations({ subtree: true }).length).toBeGreaterThan(0);
      // The click rests the pointer over the region: the progress bar is paused too.
      await user.click(screen.getByTestId(`close-${id}`));
      await settle(() => expect(queryRoot(id)).toBeNull());
      expect(isOpen(region())).toBe(false);
    });

    it("without animations the closed toast is dropped at once", async () => {
      addStyle(PLAIN_CSS);
      render(<Viewport />);
      const id = await call(() => manager({ title: "Saved", duration: null }));
      await user.click(screen.getByTestId(`close-${id}`));
      expect(queryRoot(id)).toBeNull();
      expect(isOpen(region())).toBe(false);
    });
  });

  describe("announcement", () => {
    it("calls document.ariaNotify once per add", async () => {
      addStyle(PLAIN_CSS);
      if (!supportsAriaNotify) {
        render(<Viewport />);
        await call(() => manager({ title: "Saved" }));
        await settle(() => expect(screen.getByText("Saved")).toBeInTheDocument());
        return;
      }
      expect(typeof (document as { ariaNotify?: unknown }).ariaNotify).toBe("function");
      const spy = vi.spyOn(document as Document & { ariaNotify: () => void }, "ariaNotify");
      render(<Viewport />);
      await call(() => manager({ title: "Saved", description: "All changes stored" }));
      await settle(() => expect(spy).toHaveBeenCalledTimes(1));
      expect(spy).toHaveBeenCalledWith("Saved All changes stored", { priority: "normal" });
      await call(() => manager({ title: "Failed", priority: "high" }));
      await settle(() => expect(spy).toHaveBeenCalledTimes(2));
      expect(spy).toHaveBeenLastCalledWith("Failed", { priority: "high" });
    });
  });

  describe("no view transition", () => {
    it("never starts a document view transition for add, update, Close, Escape or Undo settle", async () => {
      addStyle(PLAIN_CSS);
      const spy = vi.spyOn(document, "startViewTransition");
      render(<Viewport />);
      const a = await call(() => manager({ title: "A", duration: null }));
      await call(() => manager.update(a, { title: "A2" }));
      await user.click(screen.getByTestId(`close-${a}`));
      await flushFor();
      const b = await call(() => manager({ title: "B", duration: null }));
      root(b).focus();
      await user.keyboard("{Escape}");
      await flushFor();
      const c = await call(() =>
        manager({ title: "C", action: { label: "Undo", action: () => sleep(10) } }),
      );
      await user.click(screen.getByTestId(`action-${c}`));
      // The Undo action (10 ms) settles and the toast closes.
      await settle(() => expect(queryRoot(c)).toBeNull());
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("focus", () => {
    it("F8 focuses the newest toast; Escape returns focus to the button that had it", async () => {
      addStyle(PLAIN_CSS);
      render(<Viewport />);
      await call(() => manager({ title: "A", duration: null }));
      const b = await call(() => manager({ title: "B", duration: null }));
      const outside = screen.getByTestId("outside");
      outside.focus();
      await user.keyboard("{F8}");
      expect(root(b)).toHaveFocus();
      expect(region()).toHaveAttribute("data-paused", "");
      await user.keyboard("{ArrowUp}");
      await user.keyboard("{Escape}");
      await flushFor();
      // Focus moved on to the remaining (newest) toast.
      expect(root(b)).toHaveFocus();
      await user.keyboard("{Escape}");
      await settle(() => expect(outside).toHaveFocus());
    });
  });
});
