// AlertDialog rows that need a real engine (design/components/alert-dialog.md): real Invoker
// Commands and `showModal()`, a real backdrop click (no light dismiss, with no attribute and no
// listener), real Escape (a fact), the platform's dialog focusing steps on the Cancel's
// `autofocus` (JS-free and library mode), and the two points the design entry left to verify:
// a disabled element carrying `autofocus` is skipped by the focusing steps, and React's
// `autoFocus` on a Cancel that mounts into an already open JS-free dialog takes focus (it did;
// the Cancel now renders the prop only in the server and hydration render, so it does not). Chromium
// also reads the role, name and description from its accessibility tree.
import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { axNodeOf } from "../__tests__/ax-tree.js";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { flushFor, settle } from "../__tests__/browser-helpers.js";
import { deferred } from "../__tests__/helpers.js";
import { AlertDialog } from "./index.js";
import type { AlertDialogOpenChangeDetails, AlertDialogRootProps } from "./index.js";

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup") as HTMLDialogElement;
const cancel = () => screen.getByTestId("cancel");
const confirm = () => screen.getByTestId("confirm");

function Confirm({ root, children }: { root?: AlertDialogRootProps; children?: ReactNode }) {
  return (
    <div style={{ padding: 40 }}>
      <AlertDialog.Root {...root}>
        <AlertDialog.Trigger data-testid="trigger">Delete project</AlertDialog.Trigger>
        <AlertDialog.Popup data-testid="popup" style={{ width: 300, height: 200 }}>
          <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
          <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
          {children ?? (
            <>
              <AlertDialog.Action data-testid="confirm" action={() => {}}>
                Delete
              </AlertDialog.Action>
              <AlertDialog.Cancel data-testid="cancel">Cancel</AlertDialog.Cancel>
            </>
          )}
        </AlertDialog.Popup>
      </AlertDialog.Root>
    </div>
  );
}

/** A real click on the ::backdrop: on the dialog, outside its border box. */
async function clickBackdrop() {
  await user.click(popup(), { position: { x: -20, y: -20 }, force: true });
}

describe("AlertDialog (browser)", () => {
  describe("JS-free mode", () => {
    it("the command opens it modally with focus on the Cancel (the Action comes first)", async () => {
      render(<Confirm />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      expect(popup().matches(":modal")).toBe(true);
      expect(cancel()).toHaveFocus();
    });

    it("a backdrop click does not close it; Escape does and returns focus to the Trigger", async () => {
      render(<Confirm />);
      await user.click(trigger());
      await clickBackdrop();
      await flushFor();
      expect(popup().open).toBe(true);
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
      expect(trigger()).toHaveFocus();
    });

    it("the Cancel closes it natively; the Action runs its action, then closes", async () => {
      const work = deferred();
      render(
        <Confirm>
          <AlertDialog.Cancel data-testid="cancel">Cancel</AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" value="delete" action={() => work.promise}>
            Delete
          </AlertDialog.Action>
        </Confirm>,
      );
      await user.click(trigger());
      await user.click(cancel());
      expect(popup().open).toBe(false);
      await user.click(trigger());
      await user.click(confirm());
      expect(confirm()).toHaveAttribute("data-pending");
      expect(popup().open).toBe(true);
      work.resolve();
      await settle(() => expect(popup().open).toBe(false));
      expect(popup().returnValue).toBe("delete");
    });

    it("an Action with action is no invoker: a click with the handler absent does nothing", async () => {
      // The server HTML of an Action with `action` before hydration: a plain button. Rendered as
      // static markup next to a live JS-free dialog: the engine runs no command for it.
      render(<Confirm />);
      await user.click(trigger());
      const dialog = popup();
      const plain = document.createElement("button");
      plain.type = "button";
      plain.textContent = "Delete (not hydrated)";
      dialog.append(plain);
      await user.click(plain);
      await flushFor();
      expect(dialog.open).toBe(true);
      plain.remove();
    });
  });

  describe("library mode", () => {
    it("opens with focus on the Cancel; a backdrop click does nothing; Escape is a 'dismiss' fact", async () => {
      const request = vi.fn<(next: boolean, details: AlertDialogOpenChangeDetails) => void>();
      const fact = vi.fn<(next: boolean, details: AlertDialogOpenChangeDetails) => void>();
      render(
        <Confirm root={{ defaultOpen: false, openChangeAction: request, onOpenChange: fact }} />,
      );
      await user.click(trigger());
      await settle(() => expect(popup().open).toBe(true));
      expect(popup().matches(":modal")).toBe(true);
      expect(cancel()).toHaveFocus();
      expect(cancel()).not.toHaveAttribute("autofocus");
      await clickBackdrop();
      await flushFor();
      expect(popup().open).toBe(true);
      expect(fact).not.toHaveBeenCalled();
      request.mockClear();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(false);
      await settle(() => expect(fact).toHaveBeenCalledTimes(1));
      expect(fact.mock.calls[0]![1]).toMatchObject({ reason: "dismiss", returnValue: "" });
      expect(request).not.toHaveBeenCalled();
      expect(trigger()).toHaveFocus();
    });

    it("Enter on the focused Cancel closes it through the Root; focus returns to the Trigger", async () => {
      render(<Confirm root={{ defaultOpen: false }} />);
      await user.click(trigger());
      await settle(() => expect(popup().open).toBe(true));
      await user.keyboard("{Enter}");
      await settle(() => expect(popup().open).toBe(false));
      expect(trigger()).toHaveFocus();
    });

    it("a nested confirm: each Popup focuses its own Cancel", async () => {
      render(
        <AlertDialog.Root defaultOpen={false}>
          <AlertDialog.Trigger data-testid="trigger">Outer</AlertDialog.Trigger>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Outer</AlertDialog.Title>
            <AlertDialog.Description>Outer text</AlertDialog.Description>
            <AlertDialog.Root>
              <AlertDialog.Trigger data-testid="inner-trigger">Inner</AlertDialog.Trigger>
              <AlertDialog.Popup data-testid="inner">
                <AlertDialog.Title>Inner</AlertDialog.Title>
                <AlertDialog.Description>Inner text</AlertDialog.Description>
                <AlertDialog.Cancel data-testid="inner-cancel">Inner cancel</AlertDialog.Cancel>
              </AlertDialog.Popup>
            </AlertDialog.Root>
            <AlertDialog.Cancel data-testid="cancel">Outer cancel</AlertDialog.Cancel>
          </AlertDialog.Popup>
        </AlertDialog.Root>,
      );
      await user.click(trigger());
      await settle(() => expect(popup().open).toBe(true));
      // The inner (closed) dialog's Cancel carries `autofocus` but is no focusable area.
      expect(cancel()).toHaveFocus();
      await user.click(screen.getByTestId("inner-trigger"));
      expect((screen.getByTestId("inner") as HTMLDialogElement).open).toBe(true);
      expect(screen.getByTestId("inner-cancel")).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(popup().open).toBe(true);
      expect(screen.getByTestId("inner-trigger")).toHaveFocus();
    });
  });

  describe("points to verify (2026-11-26 #167 entry)", () => {
    it("the dialog focusing steps skip a disabled element carrying autofocus", async () => {
      // Plain markup: the case of a server-rendered Cancel that is disabled when the dialog is
      // opened (the library removes the attribute after hydration, the platform is the backstop).
      const dialog = document.createElement("dialog");
      dialog.innerHTML =
        '<button type="button" disabled autofocus>Not now</button>' +
        '<button type="button" id="other">Delete</button>' +
        '<button type="button" id="next" autofocus>Cancel</button>';
      document.body.append(dialog);
      try {
        dialog.showModal();
        // The next element carrying autofocus, not the first focusable one.
        expect(document.activeElement?.id).toBe("next");
        dialog.close();
        dialog.querySelector("#next")!.removeAttribute("autofocus");
        dialog.showModal();
        // No enabled autofocus element: the first focusable one.
        expect(document.activeElement?.id).toBe("other");
        dialog.close();
      } finally {
        dialog.remove();
      }
    });

    it("a Cancel mounting into an open JS-free dialog carries autofocus but takes no focus", async () => {
      // React's `autoFocus` on a client-created element calls `.focus()` (it took focus in all
      // three engines, 2026-11-26 #167 entry); the Cancel renders it only in the server and
      // hydration render, so a client mount leaves focus where the user put it.
      let mount = () => {};
      function App() {
        const [mounted, setMounted] = useState(false);
        useEffect(() => {
          mount = () => setMounted(true);
        }, []);
        return (
          <Confirm>
            <input data-testid="field" />
            {mounted && <AlertDialog.Cancel data-testid="cancel">Close</AlertDialog.Cancel>}
          </Confirm>
        );
      }
      render(<App />);
      await user.click(trigger());
      expect(popup().open).toBe(true);
      await user.click(screen.getByTestId("field"));
      expect(screen.getByTestId("field")).toHaveFocus();
      await act(async () => mount());
      await settle(() => expect(cancel()).toBeInTheDocument());
      expect(cancel()).toHaveAttribute("autofocus");
      expect(screen.getByTestId("field")).toHaveFocus();
    });

    it("a Cancel mounting into a closed JS-free dialog does not take focus from the page", async () => {
      function App() {
        const [more, setMore] = useState(false);
        return (
          <>
            <button type="button" data-testid="page" onClick={() => setMore(true)}>
              Page
            </button>
            <Confirm>
              {more && <AlertDialog.Cancel data-testid="cancel">Cancel</AlertDialog.Cancel>}
            </Confirm>
          </>
        );
      }
      render(<App />);
      await user.click(screen.getByTestId("page"));
      await settle(() => expect(cancel()).toBeInTheDocument());
      // Safari does not focus a button on click; the page button keeps focus elsewhere.
      if (browserName !== "webkit") expect(screen.getByTestId("page")).toHaveFocus();
      expect(cancel()).not.toHaveFocus();
    });
  });

  describe.runIf(browserName === "chromium")("accessibility tree (Chromium)", () => {
    it("exposes role alertdialog, the Title as name and the Description as description", async () => {
      render(<Confirm />);
      await user.click(trigger());
      const node = await axNodeOf(popup());
      expect(node.role?.value).toBe("alertdialog");
      expect(node.name?.value).toBe('Delete "Atlas"?');
      expect(node.properties?.find((p) => p.name === "modal")?.value.value).toBe(true);
      const description = (node as { description?: { value?: unknown } }).description?.value;
      expect(description).toBe("This cannot be undone.");
    });
  });
});
