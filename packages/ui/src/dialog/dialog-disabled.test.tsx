// Dialog tests (jsdom): `disabled` on Trigger and Close with link and component renders
// (design/components/button.md 17.3, #83). The rows Dialog shares with Popover and Menu are in
// __tests__/overlay-disabled-render-suite.tsx; the Dialog-only ones (the non-modal JS-free
// Trigger, enabled commands, `data-disabled` in JS-free mode, owned `disabled`) are here.
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupUser, PlainButton, flushTasks } from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import { Harness, popup, spyClose, spyShowModal, trigger } from "../__tests__/dialog-harness.js";
import { describeOverlayDisabledRenders } from "../__tests__/overlay-disabled-render-suite.js";
import type { DialogOpenChangeDetails } from "./index.js";

afterEach(() => {
  // Restored here as well as in the setup file: the DOM is cleared below with real methods.
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describeOverlayDisabledRenders<DialogOpenChangeDetails, { modal?: boolean; content?: ReactNode }>({
  name: "Dialog",
  Harness,
  isOpen: () => popup().open,
  spyOpen: spyShowModal,
  triggerVariants: [
    [" (modal=true)", { modal: true }],
    [" (modal=false)", { modal: false }],
  ],
  close: {
    props: (props) => ({ content: <Dialog.Close data-testid="close" {...props} /> }),
    spyClose,
    // JS-free: the dialog is opened as its Trigger's `show-modal` command would.
    openStatic: async () => {
      await act(async () => popup().showModal());
    },
  },
});

describe("Dialog", () => {
  describe("disabled on link and component renders (design/components/button.md 17.3)", () => {
    const renders = [
      ["a link", <a key="link" href="#x" />],
      ["a component", <PlainButton key="component" />],
    ] as const;

    /** Dispatches a cancelable click and reports whether it was cancelled. */
    const cancelled = (el: Element) => !fireEvent.click(el);

    describe.each(renders)("Trigger, %s render", (_, element) => {
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

    // Fold W8.
    it.each([
      ["modal, host button", true, undefined],
      ["non-modal, host button", false, undefined],
      ["non-modal, component render", false, <PlainButton key="component" />],
    ] as const)(
      "Trigger, JS-free %s: a disabled Trigger carries data-disabled",
      (_, modal, element) => {
        render(
          <Harness mode="static" modal={modal} trigger={{ disabled: true, render: element }} />,
        );
        expect(trigger()).toHaveAttribute("data-disabled", "");
      },
    );

    it("disabled is owned: a render element cannot re-enable Trigger or Close", async () => {
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
  });
});
