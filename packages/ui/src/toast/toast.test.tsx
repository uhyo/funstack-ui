// Toast tests (jsdom), mapped to design/components/toast.md section 16.1. jsdom has no Popover
// API (`src/__tests__/popover-shim.ts`), no `<dialog>` modality (`dialog-shim.ts`), no
// `ariaNotify` (stubbed on `document` per test) and no `getAnimations` (exit drops at once).
//
// N/A rows (conventions 10.1), with the reason:
// - Controlled / uncontrolled parity and the post-await rule: no controlled state; the queue is
//   not an `x` / `defaultX` triple, its input is the imperative `toast()`.
// - Optimistic + rollback: nothing in Toast is optimistic (design 3.6).
// - Platform path: no residual browser path (the region is driven by the library both ways).
// - Urgent action: the queue is urgent but has no `UrgentChangeAction` prop; the urgency is
//   tested under "Lanes".
//
// In `toast.browser.test.tsx`: top layer and re-raise, the move into a real modal dialog, enter /
// exit animations, `ariaNotify` existence, no view transition, real focus.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { StrictMode, Suspense, startTransition, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  setupUser,
} from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { createToastManager, Toast, toast } from "./index.js";
import type {
  ToastActionDetails,
  ToastCloseDetails,
  ToastItem,
  ToastManager,
  ToastViewportProps,
  ToastViewportState,
} from "./index.js";
import { resetToastServerWarning } from "./toast.js";

// --- Harness -----------------------------------------------------------------------------------

function renderToast(t: ToastItem, extra?: ReactNode) {
  return (
    <Toast.Root key={t.id} toast={t} data-testid={`toast-${t.id}`}>
      <Toast.Title data-testid={`title-${t.id}`} />
      <Toast.Description data-testid={`description-${t.id}`} />
      {extra}
      <Toast.Action data-testid={`action-${t.id}`} />
      <Toast.Close data-testid={`close-${t.id}`} aria-label="Close">
        ×
      </Toast.Close>
    </Toast.Root>
  );
}

interface HarnessProps extends Partial<Omit<ToastViewportProps, "children">> {
  /** The Viewport's children; default: `renderToast` for every toast. */
  list?: ToastViewportProps["children"];
  /** Wrap the Viewport's list in an `ErrorCatcher` reporting here. */
  boundary?: (error: unknown) => void;
  before?: ReactNode;
}

function Harness({ boundary, before, list, ...viewport }: HarnessProps) {
  return (
    <>
      <button type="button" data-testid="outside">
        Outside
      </button>
      {before}
      <Toast.Viewport data-testid="viewport" {...viewport}>
        {list ??
          (({ toasts }: ToastViewportState) => {
            const items = toasts.map((t) => renderToast(t));
            return boundary ? <ErrorCatcher onError={boundary}>{items}</ErrorCatcher> : items;
          })}
      </Toast.Viewport>
    </>
  );
}

const region = () => screen.getByTestId("viewport");
const root = (id: string) => screen.getByTestId(`toast-${id}`);
const queryRoot = (id: string) => screen.queryByTestId(`toast-${id}`);
const roots = () => [...region().querySelectorAll('[role="dialog"], [role="alertdialog"]')];

/** Lets the manager's microtask and React's work after it run. */
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/** Calls into the manager and lets the microtask dispatch commit. */
async function call<T>(fn: () => T): Promise<T> {
  let result!: T;
  await act(async () => {
    result = fn();
    await Promise.resolve();
  });
  return result;
}

/** Runs the shim's queued `toggle` tasks. */
const tasks = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

let ariaNotify: ReturnType<typeof vi.fn>;
let manager: ToastManager;

beforeEach(() => {
  ariaNotify = vi.fn();
  (document as unknown as { ariaNotify: unknown }).ariaNotify = ariaNotify;
  manager = createToastManager();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as unknown as { ariaNotify?: unknown }).ariaNotify;
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

// --- Tests ---------------------------------------------------------------------------------------

describe("Toast", () => {
  describe("roles and ARIA", () => {
    it("renders the region: a named section with popover=manual, hidden while empty", () => {
      render(<Harness manager={manager} />);
      const r = region();
      expect(r.tagName).toBe("SECTION");
      expect(r).toHaveAttribute("popover", "manual");
      expect(r).toHaveAttribute("aria-label", "Notifications (F8)");
      expect(r).toHaveAttribute("data-empty", "");
      expect(r).not.toHaveAttribute("data-paused");
      expect(r).not.toHaveAttribute("tabindex");
      expect(r.matches(":popover-open")).toBe(false);
      expect(screen.getByRole("region", { hidden: true })).toBe(r);
    });

    it("lets aria-label override the name verbatim and follows a custom or disabled hotkey", () => {
      const { unmount } = render(
        <Harness manager={manager} aria-label="Benachrichtigungen (F8)" />,
      );
      expect(region()).toHaveAttribute("aria-label", "Benachrichtigungen (F8)");
      unmount();
      const { unmount: u2 } = render(<Harness manager={manager} hotkey={["altKey", "KeyT"]} />);
      expect(region()).toHaveAttribute("aria-label", "Notifications (Alt+T)");
      u2();
      render(<Harness manager={manager} hotkey={null} />);
      expect(region()).toHaveAttribute("aria-label", "Notifications");
    });

    it("renders a Root as a focusable dialog named by its Title and described by its Description", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({ title: "Saved", description: "All changes stored", type: "success" }),
      );
      const r = root(id);
      expect(r.tagName).toBe("DIV");
      expect(r).toHaveAttribute("role", "dialog");
      expect(r).toHaveAttribute("tabindex", "0");
      expect(r).toHaveAttribute("data-type", "success");
      expect(r).not.toHaveAttribute("data-pending");
      expect(r).not.toHaveAttribute("data-ending");
      const title = screen.getByTestId(`title-${id}`);
      const description = screen.getByTestId(`description-${id}`);
      expect(title.tagName).toBe("DIV");
      expect(description.tagName).toBe("P");
      expect(r.getAttribute("aria-labelledby")).toBe(title.id);
      expect(r.getAttribute("aria-describedby")).toBe(description.id);
      expect(screen.getByRole("dialog", { name: "Saved" })).toBe(r);
      expect(r).toHaveAccessibleDescription("All changes stored");
      // Not a heading: transient notifications stay out of heading navigation.
      expect(screen.queryByRole("heading")).toBeNull();
      expect(region()).not.toHaveAttribute("data-empty");
    });

    it("renders priority high as an alertdialog", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Failed", priority: "high" }));
      expect(root(id)).toHaveAttribute("role", "alertdialog");
      expect(screen.getByRole("alertdialog", { name: "Failed" })).toBe(root(id));
    });

    it("omits the Description and the Action when the toast has neither", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Hello" }));
      expect(screen.queryByTestId(`description-${id}`)).toBeNull();
      expect(screen.queryByTestId(`action-${id}`)).toBeNull();
      // Both IDREFs are emitted anyway (a dangling one falls through).
      expect(root(id)).toHaveAttribute("aria-describedby");
    });
  });

  describe("queue", () => {
    it("toast() returns an id and renders a Root; the region shows", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Link copied" }));
      expect(id).toMatch(/^fsui-toast-\d+$/);
      expect(root(id)).toHaveTextContent("Link copied");
      expect(region().matches(":popover-open")).toBe(true);
    });

    it("updates in place: same element, same position; an explicit existing id updates", async () => {
      render(<Harness manager={manager} />);
      const a = await call(() => manager({ title: "A" }));
      const b = await call(() => manager({ title: "B" }));
      const element = root(a);
      await call(() => manager.update(a, { title: "A2", description: "more" }));
      expect(root(a)).toBe(element);
      expect(root(a)).toHaveTextContent("A2");
      expect(screen.getByTestId(`description-${a}`)).toHaveTextContent("more");
      await call(() => manager({ id: b, title: "B2" }));
      expect(roots().map((r) => r.textContent)).toEqual([
        expect.stringContaining("A2"),
        expect.stringContaining("B2"),
      ]);
      expect(roots()).toHaveLength(2);
    });

    it("toast.update can remove a field with undefined", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({ title: "A", action: { label: "Undo", action: () => {} } }),
      );
      expect(screen.getByTestId(`action-${id}`)).toHaveTextContent("Undo");
      await call(() => manager.update(id, { action: undefined }));
      expect(screen.queryByTestId(`action-${id}`)).toBeNull();
    });

    it("dismiss(id) closes one toast, dismiss() closes all; the region hides when empty", async () => {
      render(<Harness manager={manager} />);
      const a = await call(() => manager({ title: "A" }));
      const b = await call(() => manager({ title: "B" }));
      const c = await call(() => manager({ title: "C" }));
      await call(() => manager.dismiss(b));
      expect(queryRoot(b)).toBeNull();
      expect(roots()).toHaveLength(2);
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      await call(() => manager.dismiss());
      expect(queryRoot(a)).toBeNull();
      expect(queryRoot(c)).toBeNull();
      expect(hide).toHaveBeenCalled();
      expect(region().matches(":popover-open")).toBe(false);
      expect(region()).toHaveAttribute("data-empty", "");
    });

    it("dismiss() then toast() in one tick shows the new toast (dismissals apply in order)", async () => {
      const first = vi.fn();
      const second = vi.fn();
      render(<Harness manager={manager} />);
      const a = await call(() => manager({ title: "A", closeAction: first }));
      const b = await call(() => {
        manager.dismiss();
        return manager({ title: "Saved", closeAction: second });
      });
      await flush();
      expect(queryRoot(a)).toBeNull();
      expect(root(b)).toHaveTextContent("Saved");
      expect(root(b)).not.toHaveAttribute("data-ending");
      expect(first).toHaveBeenCalledTimes(1);
      expect(first.mock.calls[0]![0]).toMatchObject({ id: a, reason: "dismiss" });
      expect(second).not.toHaveBeenCalled();
    });

    it("dismiss(id) then toast({ id }) in one tick replaces the toast; the old one closes", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const first = vi.fn();
      const second = vi.fn();
      render(<Harness manager={manager} />);
      await call(() => manager({ id: "sync", title: "Syncing", closeAction: first }));
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      await call(() => {
        manager.dismiss("sync");
        manager({ id: "sync", title: "Synced", closeAction: second });
      });
      await flush();
      expect(root("sync")).toHaveTextContent("Synced");
      expect(root("sync")).not.toHaveAttribute("data-ending");
      expect(first).toHaveBeenCalledTimes(1);
      expect(first.mock.calls[0]![0]).toMatchObject({ id: "sync", reason: "dismiss" });
      expect(second).not.toHaveBeenCalled();
      // A fresh timer: not what was left of the replaced toast's.
      await act(async () => {
        vi.advanceTimersByTime(4999);
      });
      expect(queryRoot("sync")).not.toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      await flush();
      expect(queryRoot("sync")).toBeNull();
      expect(second.mock.calls[0]![0]).toMatchObject({ reason: "timeout" });
    });

    it("toast() then dismiss() in one tick closes the new toast too", async () => {
      const closeAction = vi.fn();
      render(<Harness manager={manager} />);
      const id = await call(() => {
        const added = manager({ title: "Gone", closeAction });
        manager.dismiss();
        return added;
      });
      await flush();
      expect(queryRoot(id)).toBeNull();
      expect(closeAction.mock.calls[0]![0]).toMatchObject({ id, reason: "dismiss" });
    });

    it("renders `limit` toasts in chronological order and queues the rest in order", async () => {
      let last: ToastViewportState | undefined;
      render(
        <Harness
          manager={manager}
          limit={2}
          list={(s) => {
            last = s;
            return s.toasts.map((t) => renderToast(t));
          }}
        />,
      );
      const ids = await call(() => [1, 2, 3, 4].map((n) => manager({ title: `T${n}` })));
      expect(roots().map((r) => r.textContent?.slice(0, 2))).toEqual(["T1", "T2"]);
      expect(last?.queued).toBe(2);
      await call(() => manager.dismiss(ids[0]));
      expect(roots().map((r) => r.textContent?.slice(0, 2))).toEqual(["T2", "T3"]);
      expect(last?.queued).toBe(1);
      expect(last?.toasts.map((t) => t.id)).toEqual([ids[1], ids[2]]);
    });

    it("warns on an update of an unknown id and ignores it", async () => {
      const error = silenceErrors();
      render(<Harness manager={manager} />);
      await call(() => manager.update("nope", { title: "x" }));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('no toast with id "nope"'));
      expect(roots()).toHaveLength(0);
    });
  });

  describe("lanes", () => {
    function Pending({ gate }: { gate: Promise<void> }) {
      const [pending, start] = useTransition();
      return (
        <button
          type="button"
          data-testid="slow"
          data-pending={pending ? "" : undefined}
          onClick={() =>
            start(async () => {
              manager({ title: "From the sync prefix" });
              startTransition(() => {
                manager({ title: "From a consumer startTransition" });
              });
              await gate;
            })
          }
        >
          Slow
        </button>
      );
    }

    it("toast() commits while an unrelated action is pending, in every scope, in order", async () => {
      const gate = deferred();
      render(<Harness manager={manager} before={<Pending gate={gate.promise} />} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId("slow"));
        manager({ title: "Plain" });
        await Promise.resolve();
      });
      await flush();
      expectPending(screen.getByTestId("slow"));
      expect(roots().map((r) => r.querySelector("div")?.textContent)).toEqual([
        "From the sync prefix",
        "From a consumer startTransition",
        "Plain",
      ]);
      await act(async () => gate.resolve());
      expectNotPending(screen.getByTestId("slow"));
    });

    it("keeps the order of several calls in one tick", async () => {
      render(<Harness manager={manager} limit={10} />);
      await call(() => {
        const a = manager({ title: "1" });
        manager({ title: "2" });
        manager.update(a, { title: "1b" });
        manager({ title: "3" });
      });
      expect(roots().map((r) => r.querySelector("div")?.textContent)).toEqual(["1b", "2", "3"]);
    });
  });

  describe("promise", () => {
    it("shows pending at once, then success (object form); resolves with the value", async () => {
      render(<Harness manager={manager} />);
      const d = deferred<number>();
      let returned!: Promise<number | undefined>;
      await call(() => {
        returned = manager.promise(d.promise, {
          pending: { title: "Saving…" },
          success: { title: "Saved", type: "success" },
        });
      });
      const r = roots()[0]!;
      expect(r).toHaveTextContent("Saving…");
      expectPending(r);
      await act(async () => d.resolve(42));
      await expect(returned).resolves.toBe(42);
      expect(roots()[0]).toBe(r);
      expect(r).toHaveTextContent("Saved");
      expect(r).toHaveAttribute("data-type", "success");
      expectNotPending(r);
    });

    it("uses the function forms with the value and the reason", async () => {
      render(<Harness manager={manager} />);
      const ok = deferred<string>();
      const bad = deferred<string>();
      await call(() => {
        void manager.promise(ok.promise, {
          pending: { title: "1…" },
          success: (v) => ({ title: `ok ${v}` }),
        });
        void manager.promise(bad.promise, {
          pending: { title: "2…" },
          error: (e) => ({ title: `bad ${(e as Error).message}`, priority: "high" }),
        });
      });
      await act(async () => {
        ok.resolve("A");
        bad.reject(new Error("B"));
      });
      await flush();
      expect(roots().map((r) => r.querySelector("div")?.textContent)).toEqual(["ok A", "bad B"]);
      expect(roots()[1]).toHaveAttribute("role", "alertdialog");
    });

    it("resolves undefined on rejection when error is given", async () => {
      render(<Harness manager={manager} />);
      const d = deferred<number>();
      let returned!: Promise<number | undefined>;
      await call(() => {
        returned = manager.promise(d.promise, {
          pending: { title: "…" },
          error: { title: "Failed" },
        });
      });
      await act(async () => d.reject(new Error("x")));
      await expect(returned).resolves.toBeUndefined();
      expect(roots()[0]).toHaveTextContent("Failed");
    });

    it("dismisses and rethrows without error; dismisses on fulfilment without success", async () => {
      render(<Harness manager={manager} />);
      const bad = deferred<number>();
      const ok = deferred<number>();
      let r1!: Promise<number | undefined>;
      let r2!: Promise<number | undefined>;
      await call(() => {
        r1 = manager.promise(bad.promise, { pending: { title: "bad…" } });
        r2 = manager.promise(ok.promise, { pending: { title: "ok…" } });
      });
      expect(roots()).toHaveLength(2);
      const r1Settled = r1.then(
        () => "fulfilled",
        (e: unknown) => e,
      );
      const failure = new Error("nope");
      await act(async () => {
        bad.reject(failure);
        ok.resolve(1);
      });
      await expect(r1Settled).resolves.toBe(failure);
      await expect(r2).resolves.toBe(1);
      await flush();
      expect(roots()).toHaveLength(0);
    });

    it("a throwing success function dismisses the toast; the returned promise rejects", async () => {
      render(<Harness manager={manager} />);
      const bug = new TypeError("r is undefined");
      const d = deferred<undefined>();
      let result!: Promise<unknown>;
      await call(() => {
        result = manager.promise(d.promise, {
          id: "p",
          pending: { title: "Saving" },
          success: () => {
            throw bug;
          },
          error: { title: "Failed" },
        });
      });
      expectPending(root("p"));
      const settled = result.then(
        () => "resolved",
        (e: unknown) => e,
      );
      await act(async () => d.resolve(undefined));
      await flush();
      expect(await settled).toBe(bug);
      expect(queryRoot("p")).toBeNull();
    });

    it("a throwing error function dismisses the toast; the returned promise rejects", async () => {
      render(<Harness manager={manager} />);
      const bug = new TypeError("bad message");
      const d = deferred();
      let result!: Promise<unknown>;
      await call(() => {
        result = manager.promise(d.promise, {
          id: "p",
          pending: { title: "Saving" },
          error: () => {
            throw bug;
          },
        });
      });
      const settled = result.then(
        () => "resolved",
        (e: unknown) => e,
      );
      await act(async () => d.reject(new Error("network")));
      await flush();
      expect(await settled).toBe(bug);
      expect(queryRoot("p")).toBeNull();
    });

    it("announces on settle with the new text and priority", async () => {
      render(<Harness manager={manager} />);
      const d = deferred();
      await call(() => {
        void manager.promise(d.promise, {
          pending: { title: "Archiving…" },
          error: { title: "Could not archive", priority: "high" },
        });
      });
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Archiving…", { priority: "normal" });
      await act(async () => d.reject(new Error("x")));
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Could not archive", { priority: "high" });
      expect(ariaNotify).toHaveBeenCalledTimes(2);
    });
  });

  describe("sync action", () => {
    it("calls the toast's action with details.id and the native click; closes with activate", async () => {
      const user = setupUser();
      const action = vi.fn();
      const closeAction = vi.fn();
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({ title: "Archived", action: { label: "Undo", action }, closeAction }),
      );
      await user.click(screen.getByTestId(`action-${id}`));
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      const details = action.mock.calls[0]![0] as ToastActionDetails;
      expect(details.id).toBe(id);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event?.type).toBe("click");
      expect(Object.keys(details)).toEqual(["id"]);
      expect(queryRoot(id)).toBeNull();
      expect(closeAction).toHaveBeenCalledTimes(1);
      const close = closeAction.mock.calls[0]![0] as ToastCloseDetails;
      expect(close.id).toBe(id);
      expect(close.reason).toBe("activate");
      expect(close.event?.type).toBe("click");
    });

    it("the part's action prop overrides; Enter on the Action dispatches", async () => {
      const user = setupUser();
      const action = vi.fn();
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t}>
                <Toast.Title />
                <Toast.Action data-testid="act" action={action}>
                  Retry
                </Toast.Action>
              </Toast.Root>
            ))
          }
        />,
      );
      await call(() => manager({ title: "Offline" }));
      const button = screen.getByTestId("act");
      expect(button).toHaveTextContent("Retry");
      expect(button).toHaveAttribute("type", "button");
      button.focus();
      await user.keyboard("{Enter}");
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a disabled Action never dispatches", async () => {
      const user = setupUser();
      const action = vi.fn();
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t}>
                <Toast.Action data-testid="act" action={action} disabled>
                  Retry
                </Toast.Action>
              </Toast.Root>
            ))
          }
        />,
      );
      await call(() => manager({ title: "x" }));
      await user.click(screen.getByTestId("act"));
      expect(action).not.toHaveBeenCalled();
    });

    it("Close dispatches dismiss with the click", async () => {
      const user = setupUser();
      const closeAction = vi.fn();
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Hi", closeAction }));
      const button = screen.getByTestId(`close-${id}`);
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toHaveAttribute("command");
      await user.click(button);
      await flush();
      expect(queryRoot(id)).toBeNull();
      expect(closeAction).toHaveBeenCalledTimes(1);
      expect(closeAction.mock.calls[0]![0]).toMatchObject({ id, reason: "dismiss" });
      expect((closeAction.mock.calls[0]![0] as ToastCloseDetails).event?.type).toBe("click");
    });
  });

  describe("async action", () => {
    it("pending on Action and Root while the Undo runs; the timer does not elapse; closes after", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const d = deferred();
      const closeAction = vi.fn();
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({
          title: "Archived",
          duration: 1000,
          action: { label: "Undo", action: () => d.promise },
          closeAction,
        }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      expectPending(screen.getByTestId(`action-${id}`));
      expectPending(root(id));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(queryRoot(id)).not.toBeNull();
      await act(async () => d.resolve());
      await flush();
      expect(queryRoot(id)).toBeNull();
      expect(closeAction.mock.calls[0]![0]).toMatchObject({ reason: "activate" });
    });

    it("closeOnSettle={false} keeps the toast", async () => {
      const d = deferred();
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t} data-testid="root">
                <Toast.Action data-testid="act" closeOnSettle={false} />
              </Toast.Root>
            ))
          }
        />,
      );
      await call(() => manager({ title: "x", action: { label: "View", action: () => d.promise } }));
      await act(async () => {
        fireEvent.click(screen.getByTestId("act"));
      });
      expectPending(screen.getByTestId("root"));
      await act(async () => d.resolve());
      await flush();
      expect(screen.getByTestId("root")).toBeInTheDocument();
      expectNotPending(screen.getByTestId("root"));
    });
  });

  describe("rejection", () => {
    it("an Undo that rejects keeps the toast and reaches the boundary above the Viewport's list", async () => {
      silenceErrors();
      const errors: unknown[] = [];
      const d = deferred();
      render(<Harness manager={manager} boundary={(e) => errors.push(e)} />);
      const id = await call(() =>
        manager({ title: "Archived", action: { label: "Undo", action: () => d.promise } }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      const failure = new Error("undo failed");
      await act(async () => d.reject(failure));
      await flush();
      expect(errors).toEqual([failure]);
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("undo failed");
    });

    it("the toast stays in the queue after a rejected Undo (a reset boundary re-renders it)", async () => {
      silenceErrors();
      const d = deferred();
      let last: ToastViewportState | undefined;
      render(
        <Harness
          manager={manager}
          list={(s) => {
            last = s;
            return <ErrorCatcher>{s.toasts.map((t) => renderToast(t))}</ErrorCatcher>;
          }}
        />,
      );
      const id = await call(() =>
        manager({ title: "A", action: { label: "Undo", action: () => d.promise } }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      await act(async () => d.reject(new Error("x")));
      await flush();
      expect(last?.toasts.map((t) => [t.id, t.ending, t.pending])).toEqual([[id, false, false]]);
    });

    it("caught inside: the action resolves and the toast closes (the documented trap)", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({
          title: "A",
          action: {
            label: "Undo",
            action: async (details) => {
              try {
                await Promise.reject(new Error("x"));
              } catch {
                manager.update(details.id, { title: "Could not undo" });
              }
            },
          },
        }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      await flush();
      expect(queryRoot(id)).toBeNull();
    });

    it("caught and rethrown: the toast stays with the failure visible", async () => {
      silenceErrors();
      const errors: unknown[] = [];
      let last: ToastViewportState | undefined;
      render(
        <Harness
          manager={manager}
          list={(s) => {
            last = s;
            return (
              <ErrorCatcher onError={(e) => errors.push(e)}>
                {s.toasts.map((t) => renderToast(t))}
              </ErrorCatcher>
            );
          }}
        />,
      );
      const id = await call(() =>
        manager({
          title: "Archived",
          action: {
            label: "Undo",
            action: async ({ id: own }) => {
              try {
                await Promise.reject(new Error("offline"));
              } catch (e) {
                manager.update(own, { title: "Could not undo", action: undefined });
                throw e;
              }
            },
          },
        }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      await flush();
      expect(errors).toHaveLength(1);
      expect(last?.toasts.map((t) => t.title)).toEqual(["Could not undo"]);
    });
  });

  describe("overlap and superseded rejection", () => {
    it("two Undo dispatches resolved out of order close the toast once", async () => {
      const first = deferred();
      const second = deferred();
      const closeAction = vi.fn();
      const queue = [first, second];
      render(<Harness manager={manager} />);
      const id = await call(() =>
        manager({
          title: "A",
          action: { label: "Undo", action: () => queue.shift()!.promise },
          closeAction,
        }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${id}`));
        fireEvent.click(screen.getByTestId(`action-${id}`));
      });
      await act(async () => second.resolve());
      await act(async () => first.resolve());
      await flush();
      expect(queryRoot(id)).toBeNull();
      expect(closeAction).toHaveBeenCalledTimes(1);
    });

    it("an older rejection after the newer resolved reaches the boundary", async () => {
      silenceErrors();
      const errors: unknown[] = [];
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      render(
        <Harness
          manager={manager}
          list={({ toasts }) => (
            <ErrorCatcher onError={(e) => errors.push(e)}>
              {toasts.map((t) => (
                <Toast.Root key={t.id} toast={t}>
                  <Toast.Action data-testid="act" closeOnSettle={false} />
                </Toast.Root>
              ))}
            </ErrorCatcher>
          )}
        />,
      );
      await call(() =>
        manager({ title: "A", action: { label: "Undo", action: () => queue.shift()!.promise } }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId("act"));
        fireEvent.click(screen.getByTestId("act"));
      });
      await act(async () => second.resolve());
      const failure = new Error("older");
      await act(async () => first.reject(failure));
      await flush();
      expect(errors).toEqual([failure]);
    });

    it("an older rejection while the newer is pending reaches the boundary", async () => {
      silenceErrors();
      const errors: unknown[] = [];
      const first = deferred();
      const second = deferred();
      const queue = [first, second];
      render(
        <Harness
          manager={manager}
          list={({ toasts }) => (
            <ErrorCatcher onError={(e) => errors.push(e)}>
              {toasts.map((t) => (
                <Toast.Root key={t.id} toast={t}>
                  <Toast.Action data-testid="act" />
                </Toast.Root>
              ))}
            </ErrorCatcher>
          )}
        />,
      );
      await call(() =>
        manager({ title: "A", action: { label: "Undo", action: () => queue.shift()!.promise } }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId("act"));
        fireEvent.click(screen.getByTestId("act"));
      });
      const failure = new Error("older");
      await act(async () => first.reject(failure));
      await flush();
      expect(errors).toEqual([failure]);
      await act(async () => second.resolve());
    });
  });

  describe("closeAction", () => {
    it("is called once per close with each reason", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const reasons: string[] = [];
      const closeAction = (d: ToastCloseDetails) => {
        reasons.push(`${d.id}:${d.reason}`);
      };
      render(<Harness manager={manager} limit={10} />);
      const a = await call(() => manager({ id: "a", title: "A", closeAction }));
      const b = await call(() => manager({ id: "b", title: "B", closeAction, duration: null }));
      const c = await call(() => manager({ id: "c", title: "C", closeAction, duration: null }));
      const e = await call(() => manager({ id: "e", title: "E", closeAction, duration: null }));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await flush();
      expect(reasons).toEqual(["a:timeout"]);
      expect(queryRoot(a)).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByTestId(`close-${b}`));
      });
      await flush();
      act(() => root(c).focus());
      await act(async () => {
        fireEvent.keyDown(root(c), { key: "Escape" });
      });
      await flush();
      await call(() => manager.dismiss(e));
      await flush();
      expect(reasons).toEqual(["a:timeout", "b:dismiss", "c:dismiss", "e:dismiss"]);
      // Idempotent: a second dismissal of a gone toast does nothing.
      await call(() => manager.dismiss(e));
      await flush();
      expect(reasons).toHaveLength(4);
    });

    it("is not called synchronously inside the dismissal click", async () => {
      const closeAction = vi.fn();
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", closeAction }));
      let calledDuringClick = false;
      const button = screen.getByTestId(`close-${id}`);
      await act(async () => {
        fireEvent.click(button);
        calledDuringClick = closeAction.mock.calls.length > 0;
        await Promise.resolve();
      });
      expect(calledDuringClick).toBe(false);
      expect(closeAction).toHaveBeenCalledTimes(1);
    });

    it("runs in a transition: its rejection reaches the boundary above the Viewport", async () => {
      silenceErrors();
      const errors: unknown[] = [];
      const failure = new Error("delete failed");
      render(
        <ErrorCatcher onError={(e) => errors.push(e)}>
          <Harness manager={manager} />
        </ErrorCatcher>,
      );
      const id = await call(() =>
        manager({
          title: "A",
          closeAction: async () => {
            await Promise.resolve();
            throw failure;
          },
        }),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(`close-${id}`));
      });
      await flush();
      expect(errors).toEqual([failure]);
    });

    it("is not called when the Viewport unmounts; the queue survives for the next Viewport", async () => {
      const closeAction = vi.fn();
      const { unmount } = render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Keep me", closeAction }));
      unmount();
      await flush();
      expect(closeAction).not.toHaveBeenCalled();
      render(<Harness manager={manager} />);
      await flush();
      expect(root(id)).toHaveTextContent("Keep me");
    });
  });

  describe("viewport remount", () => {
    it("does not announce a restored toast again", async () => {
      const { unmount } = render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "Archived", duration: null }));
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      unmount();
      render(<Harness manager={manager} />);
      await flush();
      expect(root(id)).toHaveTextContent("Archived");
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      // A changed text is still announced.
      await call(() => manager.update(id, { title: "Archived 2" }));
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Archived 2", { priority: "normal" });
    });
  });

  describe("timers", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    });

    const advance = (ms: number) =>
      act(async () => {
        vi.advanceTimersByTime(ms);
      });

    it("defaults to 5000 ms", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A" }));
      await advance(4999);
      expect(queryRoot(id)).not.toBeNull();
      await advance(1);
      expect(queryRoot(id)).toBeNull();
    });

    it("uses the Viewport duration, a per-toast duration, and null for persistent", async () => {
      render(<Harness manager={manager} duration={2000} limit={10} />);
      const a = await call(() => manager({ title: "A" }));
      const b = await call(() => manager({ title: "B", duration: 500 }));
      const c = await call(() => manager({ title: "C", duration: null }));
      await advance(500);
      expect(queryRoot(b)).toBeNull();
      expect(queryRoot(a)).not.toBeNull();
      await advance(1500);
      expect(queryRoot(a)).toBeNull();
      await advance(60_000);
      expect(queryRoot(c)).not.toBeNull();
    });

    it("an action toast is persistent unless it has a duration", async () => {
      render(<Harness manager={manager} limit={10} />);
      const a = await call(() => manager({ title: "A", action: { label: "Undo", action() {} } }));
      const b = await call(() =>
        manager({ title: "B", duration: 8000, action: { label: "Undo", action() {} } }),
      );
      await advance(8000);
      expect(queryRoot(b)).toBeNull();
      await advance(60_000);
      expect(queryRoot(a)).not.toBeNull();
    });

    it("starts only when visible: a queued toast's timer starts when it is shown", async () => {
      render(<Harness manager={manager} limit={1} />);
      const a = await call(() => manager({ title: "A", duration: 1000 }));
      const b = await call(() => manager({ title: "B", duration: 1000 }));
      await advance(1000);
      expect(queryRoot(a)).toBeNull();
      expect(queryRoot(b)).not.toBeNull();
      await advance(999);
      expect(queryRoot(b)).not.toBeNull();
      await advance(1);
      expect(queryRoot(b)).toBeNull();
    });

    it("an update with a new duration restarts the timer", async () => {
      render(<Harness manager={manager} />);
      const a = await call(() => manager({ title: "A", duration: 1000 }));
      await advance(800);
      await call(() => manager.update(a, { duration: 1000 }));
      await advance(300);
      expect(queryRoot(a)).toBeNull();
      const b = await call(() => manager({ title: "B", duration: 1000 }));
      await advance(800);
      await call(() => manager.update(b, { duration: 2000 }));
      await advance(1500);
      expect(queryRoot(b)).not.toBeNull();
      await advance(500);
      expect(queryRoot(b)).toBeNull();
    });

    it("a pending promise toast has no timer; it starts on settle", async () => {
      render(<Harness manager={manager} />);
      const d = deferred();
      await call(() => {
        void manager.promise(d.promise, {
          pending: { title: "…" },
          success: { title: "Done", duration: 1000 },
        });
      });
      await advance(10_000);
      expect(roots()).toHaveLength(1);
      await act(async () => d.resolve());
      await flush();
      await advance(1000);
      expect(roots()).toHaveLength(0);
    });
  });

  describe("pausing", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    });

    const advance = (ms: number) =>
      act(async () => {
        vi.advanceTimersByTime(ms);
      });

    it("pauses on pointer over the region and resumes with the remaining time", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: 1000 }));
      await advance(600);
      act(() => {
        fireEvent.pointerEnter(region());
      });
      expect(region()).toHaveAttribute("data-paused", "");
      await advance(5000);
      expect(queryRoot(id)).not.toBeNull();
      act(() => {
        fireEvent.pointerLeave(region());
      });
      expect(region()).not.toHaveAttribute("data-paused");
      await advance(399);
      expect(queryRoot(id)).not.toBeNull();
      await advance(1);
      expect(queryRoot(id)).toBeNull();
    });

    it("pauses while focus is inside the region", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: 1000 }));
      act(() => root(id).focus());
      expect(region()).toHaveAttribute("data-paused", "");
      await advance(5000);
      expect(queryRoot(id)).not.toBeNull();
      act(() => screen.getByTestId("outside").focus());
      expect(region()).not.toHaveAttribute("data-paused");
      await advance(1000);
      expect(queryRoot(id)).toBeNull();
    });

    it("pauses while the document is hidden", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: 1000 }));
      const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(region()).toHaveAttribute("data-paused", "");
      await advance(5000);
      expect(queryRoot(id)).not.toBeNull();
      state.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await advance(1000);
      expect(queryRoot(id)).toBeNull();
    });

    it("pauses while the window is blurred", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: 1000 }));
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(region()).toHaveAttribute("data-paused", "");
      await advance(5000);
      expect(queryRoot(id)).not.toBeNull();
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      await advance(1000);
      expect(queryRoot(id)).toBeNull();
    });

    it("pauses only the pending toast's timer while its siblings run", async () => {
      const d = deferred();
      render(<Harness manager={manager} />);
      const a = await call(() =>
        manager({ title: "A", duration: 1000, action: { label: "Undo", action: () => d.promise } }),
      );
      const b = await call(() => manager({ title: "B", duration: 1000 }));
      await act(async () => {
        fireEvent.click(screen.getByTestId(`action-${a}`));
      });
      expect(region()).not.toHaveAttribute("data-paused");
      await advance(1000);
      expect(queryRoot(b)).toBeNull();
      expect(queryRoot(a)).not.toBeNull();
      await act(async () => d.resolve());
    });
  });

  describe("keyboard and focus", () => {
    it("F8 focuses the newest toast and prevents the default", async () => {
      const user = setupUser();
      render(<Harness manager={manager} />);
      await call(() => manager({ title: "A", duration: null }));
      const b = await call(() => manager({ title: "B", duration: null }));
      act(() => screen.getByTestId("outside").focus());
      const event = new KeyboardEvent("keydown", {
        key: "F8",
        code: "F8",
        cancelable: true,
        bubbles: true,
      });
      act(() => {
        document.activeElement!.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(root(b)).toHaveFocus();
      // Escape returns focus to where it was before F8.
      await user.keyboard("{ArrowUp}");
      await user.keyboard("{Escape}");
      await flush();
      expect(root(b)).toHaveFocus();
      await user.keyboard("{Escape}");
      await flush();
      expect(screen.getByTestId("outside")).toHaveFocus();
    });

    it("F8 does nothing without toasts; hotkey={null} installs no listener", async () => {
      const { unmount } = render(<Harness manager={manager} />);
      const event = new KeyboardEvent("keydown", {
        key: "F8",
        code: "F8",
        cancelable: true,
        bubbles: true,
      });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      unmount();
      const add = vi.spyOn(document, "addEventListener");
      render(<Harness manager={manager} hotkey={null} />);
      expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
    });

    it("supports a modifier hotkey", async () => {
      render(<Harness manager={manager} hotkey={["altKey", "KeyT"]} />);
      const id = await call(() => manager({ title: "A", duration: null }));
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "t", code: "KeyT", bubbles: true }),
        );
      });
      expect(root(id)).not.toHaveFocus();
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "†", code: "KeyT", altKey: true, bubbles: true }),
        );
      });
      expect(root(id)).toHaveFocus();
    });

    it("ignores the hotkey with an unlisted modifier held (Ctrl+F8 is not F8)", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: null }));
      for (const modifier of ["ctrlKey", "altKey", "shiftKey", "metaKey"]) {
        const event = new KeyboardEvent("keydown", {
          key: "F8",
          code: "F8",
          [modifier]: true,
          cancelable: true,
          bubbles: true,
        });
        act(() => {
          document.body.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
        expect(root(id)).not.toHaveFocus();
      }
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "F8", code: "F8", bubbles: true }),
        );
      });
      expect(root(id)).toHaveFocus();
    });

    it("ArrowDown / ArrowUp move between toasts without wrapping", async () => {
      const user = setupUser();
      render(<Harness manager={manager} />);
      const ids = await call(() =>
        ["A", "B", "C"].map((t) => manager({ title: t, duration: null })),
      );
      act(() => root(ids[0]!).focus());
      await user.keyboard("{ArrowUp}");
      expect(root(ids[0]!)).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(root(ids[1]!)).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(root(ids[2]!)).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(root(ids[2]!)).toHaveFocus();
      // From a button inside a toast too.
      act(() => screen.getByTestId(`close-${ids[1]!}`).focus());
      await user.keyboard("{ArrowUp}");
      expect(root(ids[0]!)).toHaveFocus();
    });

    it("Escape dismisses the toast containing focus and moves focus to the next, else the previous", async () => {
      const user = setupUser();
      render(<Harness manager={manager} />);
      const ids = await call(() =>
        ["A", "B", "C"].map((t) => manager({ title: t, duration: null })),
      );
      act(() => screen.getByTestId(`close-${ids[1]!}`).focus());
      await user.keyboard("{Escape}");
      await flush();
      expect(queryRoot(ids[1]!)).toBeNull();
      expect(root(ids[2]!)).toHaveFocus();
      await user.keyboard("{Escape}");
      await flush();
      expect(root(ids[0]!)).toHaveFocus();
    });

    it("returns focus to the element focused before a Tab into the region, else the body", async () => {
      const user = setupUser();
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A", duration: null }));
      const outside = screen.getByTestId("outside");
      act(() => outside.focus());
      await user.tab();
      expect(root(id)).toHaveFocus();
      await user.click(screen.getByTestId(`close-${id}`));
      await flush();
      expect(outside).toHaveFocus();

      const other = await call(() => manager({ title: "B", duration: null }));
      act(() => (document.activeElement as HTMLElement).blur());
      act(() => root(other).focus()); // relatedTarget is null: nothing to return to
      await call(() => manager.dismiss(other));
      expect(document.activeElement).toBe(document.body);
    });
  });

  describe("suspending content", () => {
    it("guards a suspending toast: empty Root, nothing announced, no timer; then reveals", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const { Suspender, resolve } = createSuspender();
      render(
        <Suspense fallback={<div data-testid="app-fallback" />}>
          <Harness manager={manager} limit={10} />
        </Suspense>,
      );
      const plain = await call(() => manager({ title: "Plain", duration: null }));
      const slow = await call(() =>
        manager({ title: <Suspender value="avatar" />, duration: 1000 }),
      );
      expect(screen.queryByTestId("app-fallback")).toBeNull();
      expect(root(plain)).toBeVisible();
      const r = root(slow);
      expectNotPending(r);
      expect(r).not.toHaveTextContent("avatar");
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenLastCalledWith("Plain", { priority: "normal" });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(queryRoot(slow)).not.toBeNull();
      await act(async () => {
        resolve("avatar", "Ada");
        await vi.advanceTimersByTimeAsync(400);
      });
      await flush();
      expect(root(slow)).toHaveTextContent("Ada");
      expect(ariaNotify).toHaveBeenLastCalledWith("Ada", { priority: "normal" });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(queryRoot(slow)).toBeNull();
    });

    it("a consumer Suspense inside the Root shows its own fallback", async () => {
      const { Suspender } = createSuspender();
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t} data-testid="root">
                <Suspense fallback={<span>Loading…</span>}>
                  <Toast.Title />
                </Suspense>
              </Toast.Root>
            ))
          }
        />,
      );
      await call(() => manager({ title: <Suspender value="x" /> }));
      expect(screen.getByTestId("root")).toHaveTextContent("Loading…");
    });
  });

  describe("fallback on Toast.Root", () => {
    function fallbackList(fallback: ReactNode): ToastViewportProps["children"] {
      return ({ toasts }) =>
        toasts.map((t) => (
          <Toast.Root key={t.id} toast={t} data-testid={`toast-${t.id}`} fallback={fallback}>
            <Toast.Title />
            <Toast.Description />
          </Toast.Root>
        ));
    }

    it("renders the fallback while the content suspends: not pending, silent, no timer; then reveals", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const { Suspender, resolve } = createSuspender();
      render(
        <Suspense fallback={<div data-testid="app-fallback" />}>
          <Harness
            manager={manager}
            list={fallbackList(<span data-testid="skeleton">Skeleton</span>)}
          />
        </Suspense>,
      );
      const id = await call(() =>
        manager({ title: <Suspender value="avatar" />, description: "joined", duration: 1000 }),
      );
      await flush();
      expect(screen.queryByTestId("app-fallback")).toBeNull();
      const r = root(id);
      // In the same commit as the add: the boundary is new, so its fallback shows at once.
      expect(r).toContainElement(screen.getByTestId("skeleton"));
      expectNotPending(r);
      expect(r).not.toHaveAttribute("data-pending");
      expect(ariaNotify).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(queryRoot(id)).not.toBeNull();
      await act(async () => {
        resolve("avatar", "Ada");
        await vi.advanceTimersByTimeAsync(400);
      });
      await flush();
      expect(screen.queryByTestId("skeleton")).toBeNull();
      expect(root(id)).toHaveTextContent("Adajoined");
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenCalledWith("Ada joined", { priority: "normal" });
      // The timer started at the reveal, not at the mount.
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(queryRoot(id)).not.toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(queryRoot(id)).toBeNull();
    });

    it("an update whose content suspends shows the fallback again and pauses the timer", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const { Suspender, resolve } = createSuspender();
      render(
        <Harness
          manager={manager}
          list={fallbackList(
            <>
              <span data-testid="skeleton">Skeleton</span>
              {/* Committed after the first announcement: still announces nothing. */}
              <Toast.Title>Loading…</Toast.Title>
            </>,
          )}
        />,
      );
      const id = await call(() => manager({ title: "Uploading", duration: 1000 }));
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Uploading", { priority: "normal" });
      expect(screen.queryByTestId("skeleton")).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      await call(() => manager.update(id, { title: <Suspender value="done" /> }));
      await flush();
      expect(root(id)).toContainElement(screen.getByTestId("skeleton"));
      expectNotPending(root(id));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(queryRoot(id)).not.toBeNull();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      // The hidden committed Title keeps the shared id first in tree order, so the name stays
      // "Uploading" here (not "Loading…"): the fallback Title names the toast on mount only.
      expect(root(id)).toHaveAccessibleName("Uploading");
      await act(async () => {
        resolve("done", "Uploaded");
        await vi.advanceTimersByTimeAsync(400);
      });
      await flush();
      expect(screen.queryByTestId("skeleton")).toBeNull();
      expect(root(id)).toHaveTextContent("Uploaded");
      expect(ariaNotify).toHaveBeenCalledTimes(2);
      expect(ariaNotify).toHaveBeenLastCalledWith("Uploaded", { priority: "normal" });
      // Running again after the reveal; it closes within a full duration.
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(queryRoot(id)).toBeNull();
    });

    it("a Title inside the fallback names the toast but gates nothing", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const { Suspender, resolve } = createSuspender();
      render(
        <Harness manager={manager} list={fallbackList(<Toast.Title>Loading…</Toast.Title>)} />,
      );
      const id = await call(() => manager({ title: <Suspender value="avatar" />, duration: 1000 }));
      await flush();
      const r = root(id);
      expect(r).toHaveAccessibleName("Loading…");
      expect(ariaNotify).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(queryRoot(id)).not.toBeNull();
      expect(ariaNotify).not.toHaveBeenCalled();
      await act(async () => {
        resolve("avatar", "Ada");
        await vi.advanceTimersByTimeAsync(400);
      });
      await flush();
      expect(root(id)).toHaveAccessibleName("Ada");
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenCalledWith("Ada", { priority: "normal" });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(queryRoot(id)).toBeNull();
    });
  });

  describe("suspending content inside a consumer boundary", () => {
    it("announces once the consumer's Suspense reveals the Title", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const { Suspender, resolve } = createSuspender();
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root key={t.id} toast={t} data-testid="root">
                <Suspense fallback={<span>Loading…</span>}>
                  <Toast.Title />
                  <Toast.Description />
                </Suspense>
              </Toast.Root>
            ))
          }
        />,
      );
      await call(() =>
        manager({ title: <Suspender value="x" />, description: "joined", duration: null }),
      );
      await flush();
      expect(screen.getByTestId("root")).toHaveTextContent("Loading…");
      expect(ariaNotify).not.toHaveBeenCalled();
      await act(async () => {
        resolve("x", "Ada");
        await vi.advanceTimersByTimeAsync(400);
      });
      await flush();
      expect(screen.getByTestId("root")).toHaveTextContent("Ada");
      // One announcement for the Title and Description revealed together.
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenCalledWith("Ada joined", { priority: "normal" });
    });
  });

  describe("announcements", () => {
    it("announces after the add commit, not synchronously, with Title and Description text", async () => {
      render(<Harness manager={manager} />);
      act(() => {
        manager({ title: "Saved", description: "All good" });
      });
      expect(ariaNotify).not.toHaveBeenCalled();
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenCalledWith("Saved All good", { priority: "normal" });
    });

    it("the toast's announce option, then the Viewport's prop, override; null silences", async () => {
      render(
        <Harness manager={manager} limit={10} announce={(t) => `Viewport: ${String(t.title)}`} />,
      );
      await call(() => manager({ title: "A" }));
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Viewport: A", { priority: "normal" });
      await call(() => manager({ title: "B", announce: (t) => `Own: ${String(t.title)}` }));
      await flush();
      expect(ariaNotify).toHaveBeenLastCalledWith("Own: B", { priority: "normal" });
      await call(() => manager({ title: "C", announce: () => null }));
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(2);
    });

    it("coalesces several adds in one tick into one call with the higher priority", async () => {
      render(<Harness manager={manager} />);
      await call(() => {
        manager({ title: "One" });
        manager({ title: "Two", priority: "high" });
      });
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
      expect(ariaNotify).toHaveBeenCalledWith("One Two", { priority: "high" });
    });

    it("does not announce an update with unchanged text, nor a dismissal", async () => {
      render(<Harness manager={manager} />);
      const id = await call(() => manager({ title: "A" }));
      await flush();
      await call(() => manager.update(id, { type: "info" }));
      await flush();
      await call(() => manager.dismiss(id));
      await flush();
      expect(ariaNotify).toHaveBeenCalledTimes(1);
    });

    it("announces a queued toast on add", async () => {
      render(<Harness manager={manager} limit={1} />);
      await call(() => {
        manager({ title: "Shown" });
        manager({ title: "Waiting", description: "in line" });
      });
      await flush();
      expect(ariaNotify).toHaveBeenCalledWith("Shown Waiting in line", { priority: "normal" });
    });

    it("does not throw without ariaNotify", async () => {
      delete (document as unknown as { ariaNotify?: unknown }).ariaNotify;
      render(<Harness manager={manager} />);
      await call(() => manager({ title: "A" }));
      await flush();
      expect(roots()).toHaveLength(1);
    });
  });

  describe("exit", () => {
    it("keeps the closing Root with data-ending and inert until dropped (same effect in jsdom)", async () => {
      const seen: [boolean, boolean][] = [];
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root
                key={t.id}
                toast={t}
                ref={(el) => {
                  if (el && t.ending) {
                    seen.push([el.hasAttribute("data-ending"), el.hasAttribute("inert")]);
                  }
                }}
              >
                <Toast.Title />
              </Toast.Root>
            ))
          }
        />,
      );
      const id = await call(() => manager({ title: "A" }));
      await call(() => manager.dismiss(id));
      expect(seen).toEqual([[true, true]]);
      expect(roots()).toHaveLength(0);
      expect(region().matches(":popover-open")).toBe(false);
    });

    it("drops an ending toast the consumer did not render a Root for", async () => {
      render(
        <Harness
          manager={manager}
          list={({ toasts }) => toasts.map((t) => <p key={t.id}>{String(t.title)}</p>)}
        />,
      );
      const id = await call(() => manager({ title: "A" }));
      await call(() => manager.dismiss(id));
      expect(region().matches(":popover-open")).toBe(false);
    });

    it("waits only for animations the ending state started, not a running progress bar", async () => {
      const timing = { getComputedTiming: () => ({ endTime: 5000 }) };
      // A progress bar that never finishes while the test runs (paused under data-paused).
      const progress = { finished: new Promise<void>(() => {}), effect: timing };
      let finishExit!: () => void;
      const exit = {
        finished: new Promise<void>((resolve) => {
          finishExit = resolve;
        }),
        effect: { getComputedTiming: () => ({ endTime: 200 }) },
      };
      let withExit = true;
      vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
        if (!this.hasAttribute("role")) return [];
        const list: unknown[] = [progress];
        if (withExit && this.hasAttribute("data-ending")) list.push(exit);
        return list as Animation[];
      });
      render(<Harness manager={manager} />);
      const a = await call(() => manager({ title: "A", duration: null }));
      await call(() => manager.dismiss(a));
      expect(root(a)).toHaveAttribute("data-ending", "");
      await act(async () => finishExit());
      await flush();
      expect(queryRoot(a)).toBeNull();

      // No exit animation of its own: dropped at once, the progress bar notwithstanding.
      withExit = false;
      const b = await call(() => manager({ title: "B", duration: null }));
      await act(async () => {
        fireEvent.click(screen.getByTestId(`close-${b}`));
      });
      expect(queryRoot(b)).toBeNull();
    });

    it("keeps ending toasts in position (exiting toasts stay in state.toasts)", async () => {
      let last: ToastViewportState | undefined;
      const animations = new Map<string, () => void>();
      vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
        const id = this.getAttribute("data-testid")?.replace("toast-", "");
        if (id === undefined || !this.hasAttribute("data-ending")) return [];
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        animations.set(id, finish);
        return [
          { finished, effect: { getComputedTiming: () => ({ endTime: 200 }) } },
        ] as unknown as Animation[];
      });
      render(
        <Harness
          manager={manager}
          list={(s) => {
            last = s;
            return s.toasts.map((t) => renderToast(t));
          }}
        />,
      );
      const ids = await call(() => ["A", "B", "C"].map((t) => manager({ title: t })));
      await call(() => manager.dismiss(ids[1]));
      expect(last?.toasts.map((t) => [t.id, t.ending])).toEqual([
        [ids[0], false],
        [ids[1], true],
        [ids[2], false],
      ]);
      expect(root(ids[1]!)).toHaveAttribute("data-ending", "");
      await act(async () => animations.get(ids[1]!)!());
      await flush();
      expect(last?.toasts.map((t) => t.id)).toEqual([ids[0], ids[2]]);
    });
  });

  describe("function props and render", () => {
    it("passes the documented state to Viewport, Root, Action and Close", async () => {
      const d = deferred();
      render(
        <Toast.Viewport
          manager={manager}
          data-testid="viewport"
          className={(s) => `viewport q${s.queued} n${s.toasts.length}`}
          style={(s) => ({ opacity: s.paused ? 0.5 : 1 })}
          limit={1}
        >
          {({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root
                key={t.id}
                toast={t}
                data-testid="root"
                className={(s) =>
                  `root ${s.type ?? "none"} ${s.priority} ${s.pending ? "busy" : "idle"}`
                }
                style={(s) => ({ zIndex: s.ending ? 0 : 1 })}
              >
                {(s) => (
                  <>
                    <Toast.Title className={(rs) => `title-${rs.priority}`} />
                    <span data-testid="root-child">{s.toast.id === t.id ? "same" : "other"}</span>
                    <Toast.Action
                      data-testid="act"
                      className={(as) => (as.pending ? "act busy" : "act idle")}
                    >
                      {(as) => `Undo ${as.toast.id === t.id}`}
                    </Toast.Action>
                    <Toast.Close data-testid="x" className={(cs) => `x-${cs.toast.type}`}>
                      Close
                    </Toast.Close>
                  </>
                )}
              </Toast.Root>
            ))
          }
        </Toast.Viewport>,
      );
      await call(() => {
        manager({
          title: "A",
          type: "warn",
          priority: "high",
          action: { label: "Undo", action: () => d.promise },
        });
        manager({ title: "B" });
      });
      expect(region()).toHaveClass("viewport", "q1", "n1");
      expect(region().style.opacity).toBe("1");
      expect(screen.getByTestId("root")).toHaveClass("root", "warn", "high", "idle");
      expect(screen.getByTestId("root").style.zIndex).toBe("1");
      expect(screen.getByTestId("root-child")).toHaveTextContent("same");
      expect(screen.getByTestId("act")).toHaveTextContent("Undo true");
      expect(screen.getByTestId("x")).toHaveClass("x-warn");
      expect(screen.getByText("A")).toHaveClass("title-high");
      await act(async () => {
        fireEvent.click(screen.getByTestId("act"));
      });
      expect(screen.getByTestId("act")).toHaveClass("act", "busy");
      expect(screen.getByTestId("root")).toHaveClass("busy");
      await act(async () => {
        fireEvent.pointerEnter(region());
      });
      expect(region().style.opacity).toBe("0.5");
      await act(async () => d.resolve());
    });

    it("render={<article />} keeps the handlers and forwards ref", async () => {
      const user = setupUser();
      let element: HTMLElement | null = null;
      render(
        <Harness
          manager={manager}
          list={({ toasts }) =>
            toasts.map((t) => (
              <Toast.Root
                key={t.id}
                toast={t}
                data-testid="root"
                render={<article className="extra" />}
                ref={(el) => {
                  element = el;
                }}
              >
                <Toast.Title />
                <Toast.Close render={<button className="close" />}>Close</Toast.Close>
              </Toast.Root>
            ))
          }
        />,
      );
      const id = await call(() => manager({ title: "A", duration: null }));
      const r = screen.getByTestId("root");
      expect(r.tagName).toBe("ARTICLE");
      expect(r).toHaveClass("extra");
      expect(r).toHaveAttribute("role", "dialog");
      expect(element).toBe(r);
      act(() => r.focus());
      await user.keyboard("{Escape}");
      await flush();
      expect(screen.queryByTestId("root")).toBeNull();
      void id;
    });

    it("accepts a node as the Viewport's children", async () => {
      render(
        <Toast.Viewport manager={manager} data-testid="viewport">
          <p>Fixed</p>
        </Toast.Viewport>,
      );
      expect(region()).toHaveTextContent("Fixed");
    });
  });

  describe("manager", () => {
    it("isolates managers: two Viewports, two managers, no cross-talk", async () => {
      const other = createToastManager();
      render(
        <>
          <Toast.Viewport manager={manager} data-testid="one">
            {({ toasts }) => toasts.map((t) => <p key={t.id}>{String(t.title)}</p>)}
          </Toast.Viewport>
          <Toast.Viewport manager={other} data-testid="two">
            {({ toasts }) => toasts.map((t) => <p key={t.id}>{String(t.title)}</p>)}
          </Toast.Viewport>
        </>,
      );
      await call(() => {
        manager({ title: "first" });
        other({ title: "second" });
      });
      expect(screen.getByTestId("one").textContent).toBe("first");
      expect(screen.getByTestId("two").textContent).toBe("second");
    });

    it("a second Viewport on the same manager warns and renders nothing", async () => {
      const error = silenceErrors();
      render(
        <>
          <Toast.Viewport manager={manager} data-testid="one" />
          <Toast.Viewport manager={manager} data-testid="two" />
        </>,
      );
      await flush();
      expect(screen.getByTestId("one")).toBeInTheDocument();
      expect(screen.queryByTestId("two")).toBeNull();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("another Toast.Viewport"));
    });

    it("a second Viewport added later never renders its region", async () => {
      const error = silenceErrors();
      const seen: HTMLElement[] = [];
      const { rerender } = render(<Toast.Viewport manager={manager} data-testid="one" />);
      await flush();
      rerender(
        <>
          <Toast.Viewport manager={manager} data-testid="one" />
          <Toast.Viewport
            manager={manager}
            data-testid="two"
            ref={(el) => {
              if (el) seen.push(el);
            }}
          />
        </>,
      );
      await flush();
      expect(seen).toHaveLength(0);
      expect(screen.queryByTestId("two")).toBeNull();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("another Toast.Viewport"));
    });

    it("buffers calls made before the Viewport mounts, rendered once under StrictMode", async () => {
      await act(async () => {
        manager({ title: "Early 1" });
        manager({ title: "Early 2" });
        await Promise.resolve();
      });
      render(
        <StrictMode>
          <Harness manager={manager} />
        </StrictMode>,
      );
      await flush();
      expect(roots().map((r) => r.querySelector("div")?.textContent)).toEqual([
        "Early 1",
        "Early 2",
      ]);
    });

    it("the default manager `toast` works with a Viewport that has no manager prop", async () => {
      render(<Harness />);
      const id = await call(() => toast({ title: "Default" }));
      expect(root(id)).toHaveTextContent("Default");
      await call(() => toast.dismiss());
    });

    it("toast.promise without a Viewport still mirrors the input", async () => {
      await expect(manager.promise(Promise.resolve(3), { pending: { title: "…" } })).resolves.toBe(
        3,
      );
    });
  });

  describe("server", () => {
    it("every method is a no-op with one warning, and nothing is buffered", async () => {
      const error = silenceErrors();
      resetToastServerWarning();
      const original = globalThis.document;
      const server = createToastManager();
      // @ts-expect-error -- simulate a server environment
      delete globalThis.document;
      let id: string;
      let mirrored: Promise<number | undefined>;
      try {
        expect(typeof document).toBe("undefined");
        id = server({ title: "From the server" });
        server.update(id, { title: "x" });
        server.dismiss(id);
        mirrored = server.promise(Promise.reject(new Error("e")), {
          pending: { title: "…" },
          error: { title: "x" },
        });
        await Promise.resolve();
        await Promise.resolve();
      } finally {
        globalThis.document = original;
      }
      expect(typeof id).toBe("string");
      await expect(mirrored).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("called on the server"));
      render(<Harness manager={server} />);
      await flush();
      expect(roots()).toHaveLength(0);
    });

    it("server-renders the empty region", () => {
      const html = renderToString(
        <Toast.Viewport manager={manager} className="toasts">
          {({ toasts }) => toasts.map((t) => renderToast(t))}
        </Toast.Viewport>,
      );
      expect(html).toBe(
        '<section class="toasts" popover="manual" aria-label="Notifications (F8)" data-empty=""></section>',
      );
    });
    it("hydrates the server's inline region, then portals it and renders toasts", async () => {
      const app = (
        <div data-testid="app">
          <Toast.Viewport manager={manager} data-testid="viewport">
            {({ toasts }) => toasts.map((t) => renderToast(t))}
          </Toast.Viewport>
        </div>
      );
      const container = document.createElement("div");
      container.innerHTML = renderToString(app);
      document.body.append(container);
      const recoverable: unknown[] = [];
      const error = vi.spyOn(console, "error");
      let hydrated!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        hydrated = hydrateRoot(container, app, {
          onRecoverableError: (e) => recoverable.push(e),
        });
      });
      try {
        const id = await call(() => manager({ title: "Hydrated", duration: null }));
        expect(recoverable).toEqual([]);
        expect(error).not.toHaveBeenCalled();
        expect(root(id)).toHaveTextContent("Hydrated");
        expect(screen.getByTestId("app").contains(region())).toBe(true);
        expect(region().matches(":popover-open")).toBe(true);
      } finally {
        act(() => hydrated.unmount());
      }
    });
  });

  describe("modal registry", () => {
    function WithDialog({ children }: { children?: ReactNode }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Dialog.Root open={open} openChangeAction={setOpen}>
            <Dialog.Trigger data-testid="open-dialog">Open</Dialog.Trigger>
            <Dialog.Popup data-testid="dialog">
              <Dialog.Title>Edit</Dialog.Title>
              <Dialog.Close data-testid="close-dialog">Done</Dialog.Close>
              {children}
            </Dialog.Popup>
          </Dialog.Root>
        </>
      );
    }

    it("moves the region into an open modal Dialog and back when it closes", async () => {
      const user = setupUser();
      render(<Harness manager={manager} before={<WithDialog />} />);
      const id = await call(() => manager({ title: "A", duration: null }));
      expect(region().closest("dialog")).toBeNull();
      await user.click(screen.getByTestId("open-dialog"));
      await tasks();
      await flush();
      const dialog = screen.getByTestId("dialog");
      expect(dialog.matches(":modal")).toBe(true);
      expect(dialog.contains(region())).toBe(true);
      expect(region().matches(":popover-open")).toBe(true);
      expect(root(id)).toHaveTextContent("A");
      await user.click(screen.getByTestId("close-dialog"));
      await tasks();
      await flush();
      expect(region().closest("dialog")).toBeNull();
      expect(region().matches(":popover-open")).toBe(true);
    });

    it("shows the region again after a move hid it (a removal hides a popover)", async () => {
      const user = setupUser();
      render(<Harness manager={manager} before={<WithDialog />} />);
      await call(() => manager({ title: "A", duration: null }));
      // The shim keeps a popover open across a synchronous move; a browser hides it.
      const append = Element.prototype.append;
      vi.spyOn(Element.prototype, "append").mockImplementation(function (
        this: Element,
        ...nodes: (Node | string)[]
      ) {
        for (const node of nodes) {
          if (node instanceof HTMLElement) {
            for (const popover of node.querySelectorAll<HTMLElement>("[popover]")) {
              if (popover.matches(":popover-open")) popover.hidePopover();
            }
          }
        }
        append.apply(this, nodes);
      });
      const show = vi.spyOn(HTMLElement.prototype, "showPopover");
      await user.click(screen.getByTestId("open-dialog"));
      await tasks();
      await flush();
      expect(screen.getByTestId("dialog").contains(region())).toBe(true);
      expect(show).toHaveBeenCalled();
      expect(region().matches(":popover-open")).toBe(true);
    });

    it("keeps the toasts' state across the move: an Undo in flight stays pending", async () => {
      // The Undo opens a confirmation dialog with an urgent update while it is still pending (a
      // transition update would wait for the Undo itself).
      const d = deferred();
      const closeAction = vi.fn();
      function UrgentDialog() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" data-testid="urgent-open" onClick={() => setOpen(true)}>
              Confirm
            </button>
            <Dialog.Root open={open} openChangeAction={setOpen}>
              <Dialog.Popup data-testid="dialog">
                <Dialog.Title>Confirm undo?</Dialog.Title>
              </Dialog.Popup>
            </Dialog.Root>
          </>
        );
      }
      render(<Harness manager={manager} before={<UrgentDialog />} />);
      const id = await call(() =>
        manager({
          title: "Archived",
          duration: 30,
          action: { label: "Undo", action: () => d.promise },
          closeAction,
        }),
      );
      const element = root(id);
      const action = screen.getByTestId(`action-${id}`);
      await act(async () => {
        fireEvent.click(action);
      });
      expectPending(action);
      act(() => {
        fireEvent.click(screen.getByTestId("urgent-open"));
      });
      await tasks();
      await flush();
      expect(screen.getByTestId("dialog").contains(region())).toBe(true);
      // The same elements, still pending, so the timer stays paused.
      expect(root(id)).toBe(element);
      expect(screen.getByTestId(`action-${id}`)).toBe(action);
      expectPending(action);
      expectPending(element);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      expect(queryRoot(id)).not.toBeNull();
      expect(closeAction).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      await flush();
      expect(queryRoot(id)).toBeNull();
      expect(closeAction.mock.calls[0]![0]).toMatchObject({ reason: "activate" });
    });

    it("warns when the Viewport is rendered inside a Dialog", async () => {
      const error = silenceErrors();
      const user = setupUser();
      render(
        <WithDialog>
          <Toast.Viewport manager={manager} />
        </WithDialog>,
      );
      await user.click(screen.getByTestId("open-dialog"));
      await tasks();
      await flush();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("rendered inside a Dialog"));
    });
  });
});
