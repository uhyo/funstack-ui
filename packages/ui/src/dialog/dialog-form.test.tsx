// Dialog tests (jsdom): Dialog.Form and `method="dialog"` submits (design/components/dialog.md
// 3.5, 8). The shim closes the nearest dialog for an uncancelled `method="dialog"` submit; see
// dialog.test.tsx for what jsdom cannot test.
import { act, render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushTasks,
  silenceErrors,
} from "../__tests__/helpers.js";
import { Dialog } from "./index.js";
import {
  Harness,
  openThroughTrigger,
  popup,
  spyClose,
  trigger,
} from "../__tests__/dialog-harness.js";
import type { ActionFn } from "../__tests__/dialog-harness.js";

afterEach(() => {
  // Restored here as well as in the setup file: the DOM is cleared below with real methods.
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Dialog", () => {
  describe("Form part", () => {
    it("without action: method='dialog'", () => {
      render(<Harness mode="static" content={<Dialog.Form data-testid="form" />} />);
      expect(screen.getByTestId("form")).toHaveAttribute("method", "dialog");
    });

    renderBoth("with action", (mode) => {
      it("runs the action with FormData, then closes with the submitter's value", async () => {
        const user = setupUser();
        const close = spyClose();
        const saving = deferred();
        const save = vi.fn((_formData: FormData) => saving.promise);
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form data-testid="form" action={save}>
                <input name="name" defaultValue="Ada" />
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        expect(screen.getByTestId("form")).not.toHaveAttribute("method");
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0]![0].get("name")).toBe("Ada");
        expect(popup().open).toBe(true); // the dialog waits for the action
        expect(close).not.toHaveBeenCalled();
        await act(async () => saving.resolve());
        await flushTasks(2);
        expect(close).toHaveBeenCalledWith("save");
        expect(popup().open).toBe(false);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        expect(details.returnValue).toBe("save");
        expect(details.event!.type).toBe("submit");
        // The dialog does not re-open from commits that land after the close.
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });
    });

    it("with an action that throws: the dialog stays open", async () => {
      const user = setupUser();
      silenceErrors();
      const close = spyClose();
      const caught = vi.fn();
      render(
        <Harness
          mode="uncontrolled"
          content={
            <ErrorCatcher onError={caught}>
              <Dialog.Form
                action={async () => {
                  throw new Error("invalid");
                }}
              >
                <button type="submit">Save</button>
              </Dialog.Form>
            </ErrorCatcher>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "invalid" }));
      expect(close).not.toHaveBeenCalled();
      expect(popup().open).toBe(true);
    });

    it("works in JS-free mode too (the watcher closes after the action)", async () => {
      const user = setupUser();
      const save = vi.fn();
      render(
        <Harness
          mode="static"
          content={
            <Dialog.Form action={save}>
              <button type="submit">Save</button>
            </Dialog.Form>
          }
        />,
      );
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await flushTasks(2);
      expect(save).toHaveBeenCalledTimes(1);
      expect(popup().open).toBe(false);
    });

    it("keeps `method` with a string action; owns it otherwise", () => {
      render(
        <Harness
          mode="static"
          content={
            <>
              <Dialog.Form data-testid="navigating" action="/profile" method="post" />
              <Dialog.Form data-testid="closing" method="post" />
            </>
          }
        />,
      );
      expect(screen.getByTestId("navigating")).toHaveAttribute("method", "post");
      expect(screen.getByTestId("navigating")).toHaveAttribute("action", "/profile");
      expect(screen.getByTestId("closing")).toHaveAttribute("method", "dialog");
    });

    describe("closeOnSettle", () => {
      function ValidatingForm({ closeOnSettle }: { closeOnSettle?: boolean }) {
        const [error, formAction] = useActionState(
          async (_previous: string | null, formData: FormData) =>
            String(formData.get("name")) === "" ? "Name is required" : null,
          null,
        );
        return (
          <Dialog.Form action={formAction} closeOnSettle={closeOnSettle}>
            <input name="name" defaultValue="" />
            {error !== null && <p role="alert">{error}</p>}
            <button type="submit" value="save">
              Save
            </button>
          </Dialog.Form>
        );
      }

      it("default: a non-throwing validation result still closes the dialog", async () => {
        const user = setupUser();
        render(<Harness mode="uncontrolled" content={<ValidatingForm />} />);
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(popup().open).toBe(false);
      });

      it("closeOnSettle={false}: the dialog stays open with the result; the consumer closes it", async () => {
        const user = setupUser();
        const close = spyClose();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            content={
              <>
                <ValidatingForm closeOnSettle={false} />
                <Dialog.Close data-testid="close" value="cancel">
                  Cancel
                </Dialog.Close>
              </>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        await user.click(screen.getByTestId("close"));
        await flushTasks(2);
        expect(popup().open).toBe(false);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "cancel",
        });
      });
    });
  });

  describe("method='dialog' submits", () => {
    renderBoth("method='dialog' submit", (mode) => {
      it("is cancelled and closes through the Root once openChangeAction(false) settled", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        let submitEvent: Event | undefined;
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form data-testid="form" onSubmit={(e) => (submitEvent = e.nativeEvent)}>
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        const d = deferred();
        action.mockImplementation(() => d.promise);
        const close = spyClose();
        await user.click(screen.getByRole("button", { name: "OK" }));
        expect(submitEvent?.defaultPrevented).toBe(true);
        expect(popup().open).toBe(true);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details).toMatchObject({ reason: "activate", returnValue: "ok" });
        expect(details.event).toBe(submitEvent);
        expectPending(trigger());
        await act(async () => d.resolve());
        expect(close).toHaveBeenCalledWith("ok");
        expect(popup().open).toBe(false);
        expect(popup().returnValue).toBe("ok");
      });

      it("a consumer onSubmit that prevents the submission keeps the dialog open, no dispatch", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form onSubmit={(e) => e.preventDefault()}>
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "OK" }));
        await flushTasks(2);
        expect(popup().open).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it("is 'activate' with the submitter's value", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form data-testid="form">
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "OK" }));
        expect(popup().open).toBe(false);
        await flushTasks(2);
        const [next, details] = action.mock.calls[1]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        expect(details.returnValue).toBe("ok");
        expect(details.event!.type).toBe("submit");
      });
    });

    it("a plain <form method='dialog'> and a formMethod='dialog' submitter are intercepted too", async () => {
      const user = setupUser();
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <>
              <form method="dialog">
                <button type="submit" value="plain">
                  Plain
                </button>
              </form>
              <form onSubmit={(e) => e.preventDefault()}>
                <button type="submit" value="ignored">
                  Not a dialog submit
                </button>
              </form>
              <form>
                <button type="submit" formMethod="dialog" value="submitter">
                  Submitter
                </button>
              </form>
            </>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Not a dialog submit" }));
      await flushTasks(2);
      expect(popup().open).toBe(true);
      await user.click(screen.getByRole("button", { name: "Plain" }));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("plain");
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "Submitter" }));
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("submitter");
      expect(
        action.mock.calls.filter(([next]) => !next).map(([, d]) => [d.reason, d.returnValue]),
      ).toEqual([
        ["activate", "plain"],
        ["activate", "submitter"],
      ]);
    });

    it("stopPropagation() in onSubmit opts out: the browser closes, notified as a dismissal", async () => {
      const user = setupUser();
      silenceErrors(); // jsdom: "Not implemented: requestSubmit()" for the uncancelled submit
      const action = vi.fn<ActionFn>();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Form onSubmit={(e) => e.stopPropagation()}>
              <button type="submit" value="ok">
                OK
              </button>
            </Dialog.Form>
          }
        />,
      );
      await openThroughTrigger(user);
      await user.click(screen.getByRole("button", { name: "OK" }));
      // Closed natively, at once.
      expect(popup().open).toBe(false);
      await flushTasks(2);
      expect(action.mock.calls[1]![1]).toMatchObject({ reason: "dismiss", returnValue: "ok" });
    });

    it("a document listener that runs first and stops propagation opts out (React root on the document)", async () => {
      const user = setupUser();
      silenceErrors(); // jsdom: "Not implemented: requestSubmit()" for the uncancelled submit
      // Stands in for React's own listener when the root is the document (FUNSTACK Static
      // hydrates `document`): registered before the Popup's, on the same node.
      const stop = (event: Event) => event.stopPropagation();
      document.addEventListener("submit", stop);
      try {
        const action = vi.fn<ActionFn>();
        render(
          <Harness
            mode="uncontrolled"
            action={action}
            content={
              <Dialog.Form>
                <button type="submit" value="ok">
                  OK
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "OK" }));
        // Not cancelled by the library: closed natively, at once.
        expect(popup().open).toBe(false);
        await flushTasks(2);
        expect(action.mock.calls[1]![1]).toMatchObject({ reason: "dismiss", returnValue: "ok" });
      } finally {
        document.removeEventListener("submit", stop);
      }
    });

    it("a method='dialog' submit inside a shadow root goes through the Root", async () => {
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      shadow.append(container);
      const action = vi.fn<ActionFn>();
      const closing = deferred();
      render(
        <Harness
          mode="uncontrolled"
          action={action}
          content={
            <Dialog.Form>
              <button type="submit" data-testid="ok" value="ok">
                OK
              </button>
            </Dialog.Form>
          }
        />,
        { container },
      );
      const dialog = shadow.querySelector<HTMLDialogElement>("[data-testid=popup]")!;
      await act(async () => shadow.querySelector<HTMLElement>("[data-testid=trigger]")!.click());
      await flushTasks(2);
      expect(dialog.open).toBe(true);
      action.mockImplementation(() => closing.promise);
      await act(async () => shadow.querySelector<HTMLButtonElement>("[data-testid=ok]")!.click());
      // Intercepted: still open until openChangeAction(false) settles.
      expect(dialog.open).toBe(true);
      expect(action.mock.calls[1]![1]).toMatchObject({ reason: "activate", returnValue: "ok" });
      await act(async () => closing.resolve());
      await flushTasks(2);
      expect(dialog.open).toBe(false);
      expect(dialog.returnValue).toBe("ok");
    });

    describe("nested dialogs and the shared submit listener", () => {
      function Nested({
        outerAction,
        innerAction,
        innerStatic,
      }: {
        outerAction: ActionFn;
        innerAction: ActionFn;
        innerStatic: boolean;
      }) {
        return (
          <Dialog.Root defaultOpen={false} openChangeAction={outerAction}>
            <Dialog.Trigger data-testid="outer-trigger">Outer</Dialog.Trigger>
            <Dialog.Popup data-testid="outer" aria-label="Outer">
              <Dialog.Form>
                <button type="submit" value="outer-ok">
                  Outer OK
                </button>
              </Dialog.Form>
              <Dialog.Root
                {...(innerStatic ? {} : { defaultOpen: false, openChangeAction: innerAction })}
              >
                <Dialog.Trigger data-testid="inner-trigger">Inner</Dialog.Trigger>
                <Dialog.Popup data-testid="inner" aria-label="Inner">
                  <Dialog.Form>
                    <button type="submit" value="inner-ok">
                      Inner OK
                    </button>
                  </Dialog.Form>
                </Dialog.Popup>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Root>
        );
      }

      it.each([
        ["a library", false],
        ["a JS-free", true],
      ])("%s inner Root: its submit closes the inner dialog only", async (_, innerStatic) => {
        const user = setupUser();
        const outerAction = vi.fn<ActionFn>();
        const innerAction = vi.fn<ActionFn>();
        render(
          <Nested outerAction={outerAction} innerAction={innerAction} innerStatic={innerStatic} />,
        );
        const outer = () => screen.getByTestId("outer") as HTMLDialogElement;
        const inner = () => screen.getByTestId("inner") as HTMLDialogElement;
        await user.click(screen.getByTestId("outer-trigger"));
        await flushTasks(2);
        expect(outer().open).toBe(true);
        await user.click(screen.getByTestId("inner-trigger"));
        await flushTasks(2);
        expect(inner().open).toBe(true);
        await user.click(screen.getByRole("button", { name: "Inner OK" }));
        await flushTasks(2);
        expect(inner().open).toBe(false);
        expect(inner().returnValue).toBe("inner-ok");
        expect(outer().open).toBe(true);
        expect(outer().returnValue).toBe("");
        expect(outerAction.mock.calls.map(([next]) => next)).toEqual([true]);
        if (!innerStatic) {
          expect(innerAction.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
            [true, "activate"],
            [false, "activate"],
          ]);
        }
        // The outer form still closes the outer dialog through its own Root.
        await user.click(screen.getByRole("button", { name: "Outer OK" }));
        await flushTasks(2);
        expect(outer().open).toBe(false);
        expect(outer().returnValue).toBe("outer-ok");
        expect(outerAction.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
          [true, "activate"],
          [false, "activate"],
        ]);
      });
    });

    renderBoth("Form action settle close", (mode) => {
      it("goes through the Root: the dialog stays open until openChangeAction(false) settles", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const saving = deferred();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form action={() => saving.promise}>
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        const closing = deferred();
        action.mockImplementation(() => closing.promise);
        const close = spyClose();
        await user.click(screen.getByRole("button", { name: "Save" }));
        await act(async () => saving.resolve());
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![1]).toMatchObject({
          reason: "activate",
          returnValue: "save",
        });
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        await act(async () => closing.resolve());
        expect(close).toHaveBeenCalledWith("save");
        expect(popup().open).toBe(false);
      });
    });

    renderBoth("re-open while a dismissal's notification waits for a Form save", (mode) => {
      it("Escape, then the Trigger: pending until the save settles, then open; no extra close", async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const saving = deferred();
        const close = spyClose();
        render(
          <Harness
            mode={mode}
            action={action}
            content={
              <Dialog.Form action={() => saving.promise}>
                <button type="submit" value="save">
                  Save
                </button>
              </Dialog.Form>
            }
          />,
        );
        await openThroughTrigger(user);
        await user.click(screen.getByRole("button", { name: "Save" }));
        await flushTasks(2);
        // Escape while the save runs: closed natively; the notification is entangled with the
        // form's async action (React holds it until the save settles).
        await act(async () => popup().requestClose());
        await flushTasks(2);
        expect(action).toHaveBeenCalledTimes(2);
        expect(action.mock.calls[1]![0]).toBe(false);
        expect(action.mock.calls[1]![1].reason).toBe("dismiss");
        expectPending(trigger());
        // The user re-opens: still held, and shown as pending.
        await user.click(trigger());
        expect(action).toHaveBeenCalledTimes(3);
        expect(action.mock.calls[2]![0]).toBe(true);
        expect(trigger()).toHaveAttribute("data-open", "");
        expectPending(trigger());
        expect(popup().open).toBe(false);
        close.mockClear();
        await act(async () => saving.resolve());
        await flushTasks(2);
        // The save settled: the dialog opens (the user's latest intent) and the Form does not
        // close it again, because it was closed after the submit.
        expect(popup().open).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(action).toHaveBeenCalledTimes(3);
        expectNotPending(trigger());
        expect(trigger()).toHaveAttribute("data-open", "");
      });
    });
  });
});
