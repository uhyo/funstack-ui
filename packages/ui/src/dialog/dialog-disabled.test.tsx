// Dialog tests (jsdom): `disabled` on Trigger and Close with link and component renders
// (design/components/button.md 17.3, #83).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupUser, PlainButton, flushTasks } from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import { Harness, popup, spyClose, spyShowModal, trigger } from "../__tests__/dialog-harness.js";
import type { ActionFn } from "../__tests__/dialog-harness.js";

afterEach(() => {
  // Restored here as well as in the setup file: the DOM is cleared below with real methods.
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Dialog", () => {
  describe("disabled on link and component renders (design/components/button.md 17.3)", () => {
    const renders = [
      ["a link", <a key="link" href="#x" />],
      ["a component", <PlainButton key="component" />],
    ] as const;

    /** Dispatches a cancelable click and reports whether it was cancelled. */
    const cancelled = (el: Element) => !fireEvent.click(el);

    function expectAriaDisabled(el: Element) {
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).not.toHaveAttribute("disabled");
      expect(el).toHaveAttribute("data-disabled", "");
    }

    describe.each(renders)("Close, %s render", (_, element) => {
      it("library mode: aria-disabled, the click is cancelled, nothing closes", async () => {
        const action = vi.fn<ActionFn>();
        const closeAction = vi.fn();
        render(
          <Harness
            mode="uncontrolled"
            initialOpen
            action={action}
            content={
              <Dialog.Close data-testid="close" disabled action={closeAction} render={element}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await flushTasks(2);
        const close = spyClose();
        expectAriaDisabled(screen.getByTestId("close"));
        expect(cancelled(screen.getByTestId("close"))).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(action).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
      });

      it("JS-free mode with action: aria-disabled, the click is cancelled, nothing closes", async () => {
        const closeAction = vi.fn();
        render(
          <Harness
            mode="static"
            content={
              <Dialog.Close data-testid="close" disabled action={closeAction} render={element}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await act(async () => popup().showModal());
        const close = spyClose();
        expect(screen.getByTestId("close")).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByTestId("close")).not.toHaveAttribute("disabled");
        expect(cancelled(screen.getByTestId("close"))).toBe(true);
        await flushTasks(2);
        expect(closeAction).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
        expect(popup().open).toBe(true);
      });
    });

    it("Close, a host <button> render and no render: native disabled, no aria-disabled", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          content={
            <>
              <Dialog.Close data-testid="a" disabled render={<button type="button" />} />
              <Dialog.Close data-testid="b" disabled />
            </>
          }
        />,
      );
      await flushTasks(2);
      for (const id of ["a", "b"]) {
        expect(screen.getByTestId(id)).toBeDisabled();
        expect(screen.getByTestId(id)).not.toHaveAttribute("aria-disabled");
      }
    });

    it("Close, JS-free mode without action, a component render: native disabled (the command)", () => {
      render(
        <Harness
          mode="static"
          content={<Dialog.Close data-testid="close" disabled render={<PlainButton />} />}
        />,
      );
      expect(screen.getByTestId("close")).toBeDisabled();
      expect(screen.getByTestId("close")).not.toHaveAttribute("aria-disabled");
    });

    describe.each(renders)("Trigger, %s render", (_, element) => {
      it.each([true, false])(
        "library mode (modal=%s): aria-disabled, cancelled, nothing opens",
        async (modal) => {
          const action = vi.fn<ActionFn>();
          const showModal = spyShowModal();
          render(
            <Harness
              mode="uncontrolled"
              modal={modal}
              action={action}
              trigger={{ disabled: true, render: element }}
            />,
          );
          expectAriaDisabled(trigger());
          expect(cancelled(trigger())).toBe(true);
          await flushTasks(2);
          expect(action).not.toHaveBeenCalled();
          expect(showModal).not.toHaveBeenCalled();
          expect(popup().open).toBe(false);
        },
      );

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

    // Review M1 of #83.
    it("disabled component renders in library mode are no invokers: no commandfor / command", async () => {
      render(
        <Harness
          mode="uncontrolled"
          initialOpen
          trigger={{ disabled: true, render: <PlainButton /> }}
          content={<Dialog.Close data-testid="close" disabled render={<PlainButton />} />}
        />,
      );
      await flushTasks(2);
      for (const el of [trigger(), screen.getByTestId("close")]) {
        expect(el).not.toHaveAttribute("commandfor");
        expect(el).not.toHaveAttribute("command");
      }
    });

    // Review M1 of #83.
    it("JS-free mode with action, a disabled component-render Close is no invoker", async () => {
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Close data-testid="close" disabled action={() => {}} render={<PlainButton />} />
          }
        />,
      );
      await act(async () => popup().showModal());
      expect(screen.getByTestId("close")).not.toHaveAttribute("command");
      expect(screen.getByTestId("close")).not.toHaveAttribute("commandfor");
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

    it("Trigger, JS-free modal with a component render: native disabled (the command)", () => {
      render(<Harness mode="static" trigger={{ disabled: true, render: <PlainButton /> }} />);
      expect(trigger()).toBeDisabled();
      expect(trigger()).not.toHaveAttribute("aria-disabled");
    });

    it("Trigger, a host <button> render in library mode: native disabled, no aria-disabled", () => {
      render(
        <Harness
          mode="uncontrolled"
          trigger={{ disabled: true, render: <button type="button" /> }}
        />,
      );
      expect(trigger()).toBeDisabled();
      expect(trigger()).not.toHaveAttribute("aria-disabled");
    });

    // review L1 (memo/reviewer/dialog.md).
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
