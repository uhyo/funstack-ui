// Dialog tests (jsdom): the Close part and the library-owned closes (design/components/dialog.md
// 2.3, 3.4, 4.4, 13.2). The shims and the browser-only rows are described in dialog.test.tsx; the
// open-state rows every overlay shares are in src/__tests__/overlay-open-state-suite.tsx.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../__tests__/dialog-shim.js";
import {
  deferred,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushTasks,
} from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import type { DialogOpenChangeDetails } from "./index.js";
import {
  committedText,
  content,
  Harness,
  openThroughTrigger,
  popup,
  spyClose,
  spyShowModal,
  trigger,
} from "../__tests__/dialog-harness.js";
import type { ActionFn } from "../__tests__/dialog-harness.js";
import { describeOverlayClosePart } from "../__tests__/overlay-close-part-suite.js";

describeOverlayClosePart<DialogOpenChangeDetails>({
  name: "Dialog",
  Harness,
  isOpen: () => popup().open,
  Close: (props) => <Dialog.Close value="v" {...props} />,
  spyClose,
  closeArgs: ["v"],
  value: "v",
  dismiss: () => popup().requestClose(),
  openStatic: async () => {
    await act(async () => popup().showModal());
  },
});

describe("Dialog", () => {
  describe("Close part", () => {
    // #81. The rows with `action` are in the shared Close part suite.
    describe("re-entry (design/components/button.md 16.4)", () => {
      it("without action, a second click while the Root's close is pending changes nothing", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode="uncontrolled" action={action} />);
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByTestId("close"));
        await user.click(screen.getByTestId("close"));
        // `requestClose` is a no-op against `intended()`: one dispatch. No own run, so no
        // pending and no aria-disabled on the Close.
        expect(action).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("close")).not.toHaveAttribute("aria-disabled");
        expectNotPending(screen.getByTestId("close"));
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledTimes(1);
      });
    });

    it("JS-free: action pending, closed by Escape and re-opened natively: the dialog stays open", async () => {
      const user = setupUser();
      const work = deferred();
      const close = spyClose();
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Close data-testid="delete" action={() => work.promise}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      await act(async () => popup().showModal());
      await user.click(screen.getByTestId("delete"));
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      close.mockClear();
      // The action may settle after the native re-open but before its queued `toggle` task (the
      // order varied in CI when the guard counted opens at `toggle`). Hold that task's event
      // back for good, so only the synchronous `beforetoggle` can count the re-open.
      const holdToggle = (event: Event) => event.stopImmediatePropagation();
      window.addEventListener("toggle", holdToggle, true);
      try {
        await act(async () => popup().showModal());
        await act(async () => work.resolve());
        await flushTasks(2);
      } finally {
        window.removeEventListener("toggle", holdToggle, true);
      }
      expect(popup().open).toBe(true);
      expect(close).not.toHaveBeenCalled();
    });
  });

  describe("library-owned closes", () => {
    renderBoth("Close part", (mode) => {
      it("with action: openChangeAction(false) runs after it; the Close is pending until the close commits", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const work = deferred();
        const closeAction = vi.fn(() => work.promise);
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
                Delete
              </Dialog.Close>
            }
          />,
        );
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByTestId("delete"));
        expect(closeAction).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledTimes(1); // the open only
        expectPending(screen.getByTestId("delete"));
        expectNotPending(trigger());
        await act(async () => work.resolve());
        // The action resolved: the Root dispatched, the dialog is still open.
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "deleted",
        });
        expect(action.mock.calls[1]![1].event!.type).toBe("click");
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expectPending(trigger());
        // React entangles the Root's transition with the Close's async action.
        expectPending(screen.getByTestId("delete"));
        await act(async () => closing.resolve());
        expect(close).toHaveBeenCalledWith("deleted");
        expect(popup().open).toBe(false);
        expectNotPending(trigger());
      });

      it("a Close part's close is not a close request: `cancel` neither fires nor blocks it", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const onCancel = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
        render(<Harness mode={mode} action={action} popup={{ onCancel }} />);
        await openThroughTrigger(user);
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        // The veto point of a part's close is openChangeAction, not `cancel` (design 7).
        expect(onCancel).not.toHaveBeenCalled();
        expect(popup().open).toBe(false);
        // A later dismissal being labelled as one is a suite row ("close intents").
      });
    });

    it("a vetoed close's returnValue does not leak into a later controlled close", async () => {
      const user = setupUser();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          refuseClose
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("close")); // value "x", vetoed
      await flushTasks(2);
      expect(popup().open).toBe(true);
      const close = spyClose();
      await act(async () => setOpen(false));
      expect(close).toHaveBeenCalledWith("");
      expect(popup().returnValue).toBe("");
    });

    it("a re-open between the library's close() and its close event is not superseded", async () => {
      const action = vi.fn<ActionFn>();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          action={action}
          modal={false}
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await act(async () => trigger().click());
      await flushTasks(2);
      expect(popup().open).toBe(true);
      const close = spyClose();
      act(() => setOpen(false));
      expect(close).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
      // The Trigger, in the task gap before the `close` event.
      act(() => trigger().click());
      await flushTasks(2);
      await flushTasks(2);
      expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
        [true, "activate"],
        [true, "activate"],
      ]);
      expect(popup().open).toBe(true);
      expect(committedText()).toBe("true");
    });

    it("walkthrough 11.16: a controlled close while a Close action runs closes once", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const work = deferred();
      let setOpen!: (open: boolean) => void;
      render(
        <Harness
          mode="controlled"
          action={action}
          content={
            <>
              <span data-testid="content">content</span>
              <Dialog.Close data-testid="delete" value="v" action={() => work.promise}>
                Delete
              </Dialog.Close>
            </>
          }
          outside={(set) => {
            setOpen = set;
            return null;
          }}
        />,
      );
      await openThroughTrigger(user);
      const close = spyClose();
      await user.click(screen.getByTestId("delete"));
      await act(async () => setOpen(false));
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(action.mock.calls.filter(([next]) => !next)).toHaveLength(1);
      expect(action.mock.calls[1]![1]).toMatchObject({ reason: "activate", returnValue: "v" });
      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith("v");
      expect(popup().open).toBe(false);
      expect(committedText()).toBe("false");
    });

    // Uncontrolled: a controlled parent that adopts every resolution in arrival order ends
    // with the slower, superseded `false` (conventions 2.5).
    describe("re-open during a pending part close", () => {
      it("non-modal: the Trigger re-opens while openChangeAction(false) runs; the dialog stays open", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode="uncontrolled" action={action} modal={false} />);
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation((next) => (next ? undefined : closing.promise));
        const close = spyClose();
        await user.click(screen.getByTestId("close"));
        expect(trigger()).not.toHaveAttribute("data-open");
        await user.click(trigger());
        await act(async () => closing.resolve());
        await flushTasks(2);
        expect(action.mock.calls.map(([next]) => next)).toEqual([true, false, true]);
        expect(close).not.toHaveBeenCalled();
        expect(popup().open).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expect(content()).toBeInTheDocument();
        expectNotPending(trigger());
      });

      // #116: with `lightDismiss` the Trigger click is also a click outside the still-open
      // dialog. Its `requestOpen` dispatches during the click; the dismissal's queued `close`
      // event dispatches after it, so the dismissal is the last intent and the dialog ends
      // closed, on the JS path and the native one alike.
      it.each([
        ["without experimental_closedBy", false],
        ["with experimental_closedBy (JS fallback)", true],
      ])(
        "non-modal lightDismiss: the Trigger click is a dismissal too; the dialog ends closed (%s)",
        async (_label, experimental_closedBy) => {
          const user = setupUser();
          const action = vi.fn<ActionFn>();
          render(
            <Harness
              mode="uncontrolled"
              action={action}
              modal={false}
              popup={{ lightDismiss: true, experimental_closedBy }}
            />,
          );
          await openThroughTrigger(user);
          await flushTasks(2); // the `toggle` task attaches the document listeners
          const closing = deferred();
          action.mockImplementation((next) => (next ? undefined : closing.promise));
          await user.click(screen.getByTestId("close"));
          expect(popup().open).toBe(true);
          await user.click(trigger());
          await flushTasks(2);
          await act(async () => closing.resolve());
          await flushTasks(2);
          expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [true, "activate"],
            [false, "activate"],
            [true, "activate"],
            [false, "dismiss"],
          ]);
          expect(action.mock.calls[3]![1].event!.type).toBe("close");
          expect(popup().open).toBe(false);
          expect(trigger()).not.toHaveAttribute("data-open");
          expect(content()).toBeNull();
          expectNotPending(trigger());
        },
      );
    });

    it("a render={<a href />} Close closes through the click handler in library mode", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Close data-testid="link-close" value="link" render={<a href="#close" />}>
              Close
            </Dialog.Close>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByTestId("link-close"));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("link");
      expect(action.mock.calls[1]![1].returnValue).toBe("link");
    });
  });

  describe("a controlled parent that vetoes the Close part's close (walkthrough 11.14)", () => {
    /**
     * A controlled parent following 11.14: it vetoes a Close part's close (reason
     * "activate") and adopts everything else, a dismissal included.
     */
    function VetoCloseParent({
      action,
      modal,
      content,
    }: {
      action: ActionFn;
      modal?: boolean;
      content?: ReactNode;
    }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Dialog.Root
            open={open}
            modal={modal}
            openChangeAction={async (next, details) => {
              await action(next, details);
              if (!next && details.reason === "activate") return; // veto
              startTransition(() => setOpen(next));
            }}
          >
            <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
            <Dialog.Popup data-testid="popup" aria-label="Edit">
              <span data-testid="content">content</span>
              {content ?? (
                <Dialog.Close data-testid="close" value="x">
                  Cancel
                </Dialog.Close>
              )}
            </Dialog.Popup>
          </Dialog.Root>
          <output data-testid="committed">{String(open)}</output>
        </>
      );
    }

    it("an Escape during the pending close, then the veto: the dismissal is notified, not undone", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const showModal = spyShowModal();
      render(<VetoCloseParent action={action} />);
      await openThroughTrigger(user);
      expect(showModal).toHaveBeenCalledTimes(1);
      const closing = deferred();
      action.mockImplementation((next) => (next ? undefined : closing.promise));
      await user.click(screen.getByTestId("close"));
      expect(popup().open).toBe(true);
      // Escape while openChangeAction(false) runs: the platform closes at once.
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      // Nothing more yet: the user's intent is already "close" (11.13).
      expect(action).toHaveBeenCalledTimes(2);
      action.mockImplementation(() => undefined);
      await act(async () => closing.resolve());
      await flushTasks(2);
      // The parent vetoed the Close; the dismissal stands and is notified now.
      expect(action.mock.calls.map(([next, d]) => [next, d.reason, d.returnValue])).toEqual([
        [true, "activate", undefined],
        [false, "activate", "x"],
        [false, "dismiss", ""],
      ]);
      expect(action.mock.calls[2]![1].event!.type).toBe("close");
      expect(showModal).toHaveBeenCalledTimes(1); // never re-opened
      expect(popup().open).toBe(false);
      expect(committedText()).toBe("false");
      expect(content()).toBeNull();
      expectNotPending(trigger());
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("an Escape during the pending close, then a re-open through the Trigger: superseded", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<VetoCloseParent action={action} />);
      await openThroughTrigger(user);
      const closing = deferred();
      action.mockImplementation((next) => (next ? undefined : closing.promise));
      await user.click(screen.getByTestId("close"));
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      await user.click(trigger());
      await act(async () => closing.resolve());
      await flushTasks(2);
      expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
        [true, "activate"],
        [false, "activate"],
        [true, "activate"],
      ]);
      expect(popup().open).toBe(true);
      expect(committedText()).toBe("true");
    });

    it("with a Close action: the action runs, the close is vetoed, no blink", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      const showModal = spyShowModal();
      const work = deferred();
      const closeAction = vi.fn(() => work.promise);
      render(
        <VetoCloseParent
          action={action}
          content={
            <Dialog.Close data-testid="delete" value="deleted" action={closeAction}>
              Delete
            </Dialog.Close>
          }
        />,
      );
      await openThroughTrigger(user);
      showModal.mockClear();
      const close = spyClose();
      await user.click(screen.getByTestId("delete"));
      expectPending(screen.getByTestId("delete"));
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(closeAction).toHaveBeenCalledTimes(1);
      expect(action.mock.calls.map(([next, d]) => [next, d.reason, d.returnValue])).toEqual([
        [true, "activate", undefined],
        [false, "activate", "deleted"],
      ]);
      expect(close).not.toHaveBeenCalled();
      expect(showModal).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
      expect(content()).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("data-open", "");
      expectNotPending(screen.getByTestId("delete"));
      expectNotPending(trigger());
      // A later close is not affected by the vetoed one's value.
      action.mockImplementation(() => undefined);
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("");
    });
  });

  describe("foreign close commands", () => {
    renderBoth("foreign close command", (mode) => {
      it.each(["request-close", "close"])(
        "%s is cancelled and closes through the Root with the invoker's value",
        async (command) => {
          const user = setupUser();
          const action = vi.fn<ActionFn>();
          render(<Harness mode={mode} action={action} />);
          await openThroughTrigger(user);
          const d = deferred();
          action.mockImplementation(() => d.promise);
          const close = spyClose();
          const source = document.createElement("button");
          source.value = "foreign";
          document.body.append(source);
          let event!: Event;
          await act(async () => {
            event = dispatchCommand(popup(), command, source);
          });
          expect(event.defaultPrevented).toBe(true);
          expect(popup().open).toBe(true);
          const [next, details] = action.mock.calls[1]!;
          expect(next).toBe(false);
          expect(details).toMatchObject({ reason: "activate", returnValue: "foreign" });
          expect(details.event).toBe(event);
          await act(async () => d.resolve());
          expect(close).toHaveBeenCalledWith("foreign");
          expect(popup().open).toBe(false);
        },
      );
    });

    it("a foreign close command without a source closes with ''", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await act(async () => {
        dispatchCommand(popup(), "request-close", null);
      });
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(action.mock.calls[1]![1].returnValue).toBe("");
    });

    it("JS-free: a foreign request-close invoker closes natively", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="static"
          content={
            <button type="button" data-testid="foreign" command="request-close" value="native">
              Foreign
            </button>
          }
        />,
      );
      screen.getByTestId("foreign").setAttribute("commandfor", popup().id);
      await user.click(trigger());
      await user.click(screen.getByTestId("foreign"));
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("native");
    });
  });

  // The shared rows are in the open-state suite (overlay-open-state-suite.tsx, "held content");
  // these need Dialog's `requestClose()` and a stubbed exit animation.
  describe("held content (design 4.4)", () => {
    it("a dismissal held for an exit animation is released by a normal update, not a view transition", async () => {
      const calls = vi.fn<() => never>(() => {
        throw new Error("startViewTransition stub");
      });
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value: calls,
      });
      try {
        const user = setupUser();
        render(<Harness mode="uncontrolled" popup={{ transition: "pop" }} />);
        await openThroughTrigger(user);
        const fade = deferred();
        const animation = {
          effect: { getComputedTiming: () => ({ endTime: 150 }) },
          finished: fade.promise,
        } as unknown as Animation;
        // The exit starts with the close: an animation already running at `beforetoggle` is
        // the baseline, not the exit (#64).
        vi.spyOn(popup(), "getAnimations").mockImplementation(() =>
          popup().open ? [] : [animation],
        );
        calls.mockClear();
        await act(async () => popup().requestClose());
        await flushTasks(2);
        // The notification commit (one document view transition); the content is held.
        expect(calls).toHaveBeenCalledTimes(1);
        expect(content()).toBeInTheDocument();
        await act(async () => fade.resolve());
        await flushTasks(2);
        expect(content()).toBeNull();
        expect(calls).toHaveBeenCalledTimes(1);
      } finally {
        Reflect.deleteProperty(document, "startViewTransition");
      }
    });

    it("an animation already running before the close does not hold the content", async () => {
      const user = setupUser();
      render(<Harness mode="uncontrolled" />);
      await openThroughTrigger(user);
      const running = {
        effect: { getComputedTiming: () => ({ endTime: 10_000 }) },
        finished: new Promise<never>(() => {}),
      } as unknown as Animation;
      // The same object before and after the close: a progress bar, not the exit.
      vi.spyOn(popup(), "getAnimations").mockReturnValue([running]);
      await act(async () => popup().requestClose());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(content()).toBeNull();
    });
  });

  describe.each([
    [false, "none", false],
    [false, "none", true],
    [false, undefined, false],
    [true, "none", false],
  ] as const)(
    "focus return: modal=%s transition=%s keepMounted=%s",
    (modal, transition, keepMounted) => {
      it("a Close activated with Enter returns focus to the Trigger (design 6.2 rule 2)", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" modal={modal} popup={{ transition, keepMounted }} />);
        await openThroughTrigger(user);
        screen.getByTestId("close").focus();
        await user.keyboard("{Enter}");
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(trigger()).toHaveFocus();
      });
    },
  );
});
