// Escape decided last (design/conventions.md 15 rule 4, #194) with a real key, in all three
// engines: the late path (a `stopPropagation()` kept the event from the window, so the layers
// decide in a task after the dispatch) exists only for an event the user caused. A React
// `onKeyDown` that stops propagation stops the native event at React's root, below the document.
// The jsdom rows (escape-key, tooltip, hover-card, toast and dialog-escape tests) cover the
// order, the mark and the cancels with scripted events.
import { act, render, screen } from "@testing-library/react";
import type { KeyboardEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Dialog } from "../dialog/index.js";
import { HoverCard } from "../hover-card/index.js";
import { createToastManager, Toast } from "../toast/index.js";
import type { ToastManager, ToastViewportState } from "../toast/index.js";
import { Tooltip } from "../tooltip/index.js";
import { quietPeriod, settle, sleep } from "./browser-helpers.js";
import { user } from "./browser-user.js";

const stop = (event: KeyboardEvent) => event.stopPropagation();

/** A wrapper whose React `onKeyDown` stops propagation (`stopping`), or a plain one. */
function Stopper({ stopping, children }: { stopping: boolean; children: ReactNode }) {
  return <div onKeyDown={stopping ? stop : undefined}>{children}</div>;
}

function TooltipPart() {
  return (
    <Tooltip.Root delay={0} closeDelay={10_000}>
      <Tooltip.Trigger data-testid="tip-trigger">Save</Tooltip.Trigger>
      <Tooltip.Popup data-testid="tip">Saves the document</Tooltip.Popup>
    </Tooltip.Root>
  );
}

/** Whether the tooltip shows; a closed Dialog around it unmounts it (closed too). */
const tipOpen = () => screen.queryByTestId("tip")?.matches(":popover-open") ?? false;

/** Hovers the Tooltip open, then focuses its trigger so the Escape starts inside the wrapper. */
async function openTooltip(): Promise<void> {
  const trigger = screen.getByTestId("tip-trigger");
  await user.hover(trigger);
  await settle(() => expect(tipOpen()).toBe(true));
  act(() => trigger.focus());
  expect(trigger).toHaveFocus();
}

describe("Escape decided last with a real key (#194)", () => {
  it("a Tooltip with a React onKeyDown that stops propagation: closes", async () => {
    render(
      <Stopper stopping>
        <TooltipPart />
      </Stopper>,
    );
    await openTooltip();
    await user.keyboard("{Escape}");
    await settle(() => expect(tipOpen()).toBe(false));
  });

  it("a HoverCard with a React onKeyDown that stops propagation: closes", async () => {
    render(
      <Stopper stopping>
        <HoverCard.Root defaultOpen>
          <HoverCard.Trigger href="#ada" data-testid="card-trigger">
            @ada
          </HoverCard.Trigger>
          <HoverCard.Popup data-testid="card">
            <button type="button" data-testid="in-card">
              Follow
            </button>
          </HoverCard.Popup>
        </HoverCard.Root>
      </Stopper>,
    );
    const card = screen.getByTestId("card");
    await settle(() => expect(card.matches(":popover-open")).toBe(true));
    act(() => screen.getByTestId("in-card").focus());
    await user.keyboard("{Escape}");
    await settle(() => expect(card.matches(":popover-open")).toBe(false));
    // Focus was inside: it returns to the Trigger.
    expect(screen.getByTestId("card-trigger")).toHaveFocus();
  });

  describe("a toast", () => {
    let manager: ToastManager;
    beforeEach(() => {
      manager = createToastManager();
    });

    it("with a React onKeyDown that stops propagation: dismissed", async () => {
      render(
        <Toast.Viewport manager={manager}>
          {({ toasts }: ToastViewportState) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t} data-testid="toast">
                <Toast.Title />
                {/* The Root's own `onKeyDown` is the library's (not in its props). */}
                <div onKeyDown={stop}>
                  <button type="button" data-testid="in-toast">
                    Reply
                  </button>
                </div>
              </Toast.Root>
            ))
          }
        </Toast.Viewport>,
      );
      await act(async () => {
        manager({ title: "Saved", duration: null });
        await sleep(0);
      });
      act(() => screen.getByTestId("in-toast").focus());
      await user.keyboard("{Escape}");
      await settle(() => expect(screen.queryByTestId("toast")).toBeNull());
    });
  });

  it("a Tooltip inside a non-modal Dialog, with the handler: the tooltip, then the dialog", async () => {
    render(
      <Dialog.Root defaultOpen modal={false}>
        <Dialog.Popup data-testid="dialog" aria-label="Panel">
          <Stopper stopping>
            <TooltipPart />
          </Stopper>
        </Dialog.Popup>
      </Dialog.Root>,
    );
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    await settle(() => expect(dialog.open).toBe(true));
    await openTooltip();
    await user.keyboard("{Escape}");
    await settle(() => expect(tipOpen()).toBe(false));
    await quietPeriod(50, "the first Escape must not also close the dialog");
    expect(dialog.open).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
  });

  describe("a Tooltip inside a modal Dialog", () => {
    function renderInModal(stopping: boolean) {
      render(
        <Dialog.Root defaultOpen>
          <Dialog.Popup data-testid="dialog" aria-label="Panel">
            <Stopper stopping={stopping}>
              <TooltipPart />
            </Stopper>
          </Dialog.Popup>
        </Dialog.Root>,
      );
      return screen.getByTestId("dialog") as HTMLDialogElement;
    }

    // The stated limit (conventions 15): on the late path the Escape can no longer be
    // prevented, so the dialog's close watcher closes it on the same key. Pinned so that a
    // change (an engine, or a better mechanism) is noticed.
    it("with the handler: both close on one Escape (the stated limit)", async () => {
      const dialog = renderInModal(true);
      await settle(() => expect(dialog.open).toBe(true));
      await openTooltip();
      await user.keyboard("{Escape}");
      await settle(() => {
        expect(tipOpen()).toBe(false);
        expect(dialog.open).toBe(false);
      });
    });

    it("without the handler: the tooltip only", async () => {
      const dialog = renderInModal(false);
      await settle(() => expect(dialog.open).toBe(true));
      await openTooltip();
      await user.keyboard("{Escape}");
      await settle(() => expect(tipOpen()).toBe(false));
      await quietPeriod(50, "the first Escape must not also close the dialog");
      expect(dialog.open).toBe(true);
      await user.keyboard("{Escape}");
      await settle(() => expect(dialog.open).toBe(false));
    });
  });
});
