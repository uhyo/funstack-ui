import { useState, useTransition } from "react";
import { Dialog } from "@funstack/ui/dialog";
import { Menu } from "@funstack/ui/menu";
import { Toast, toast } from "@funstack/ui/toast";
import type { ToastItem } from "@funstack/ui/toast";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./toast-demo.css";

/* The Viewport, rendered once. It moves into an open modal Dialog by itself. ------------------- */

function renderToast(t: ToastItem) {
  return (
    <div className="toast-slot" key={t.id}>
      <Toast.Root toast={t} className="toast">
        <Toast.Title className="toast-title" />
        <Toast.Description className="toast-description" />
        <div className="toast-buttons">
          <Toast.Action className="toast-action">
            {({ pending }) => (pending ? "Undoing…" : t.action?.label)}
          </Toast.Action>
          <Toast.Close className="toast-close" aria-label="Close">
            ×
          </Toast.Close>
        </div>
        {t.duration !== null && t.action === undefined && !t.pending && (
          <div className="toast-progress" />
        )}
      </Toast.Root>
    </div>
  );
}

export function Notifications() {
  return (
    <Toast.Viewport className="toasts">
      {({ toasts, queued }) => (
        <>
          {toasts.map(renderToast)}
          {queued > 0 && <p className="toast-queued">+{queued} more</p>}
        </>
      )}
    </Toast.Viewport>
  );
}

/* The demo ------------------------------------------------------------------------------------ */

let counter = 0;

function archive(fail: boolean): Promise<string> {
  console.log("[toast] archive…");
  return sleep(1500).then(() => {
    if (fail) throw new Error("The server is unreachable");
    return `Message ${++counter}`;
  });
}

function SlowAction() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      data-pending={pending ? "" : undefined}
      onClick={() =>
        startTransition(async () => {
          toast({ title: "Saving…", description: "This toast appears while the action runs." });
          await sleep(2000);
          toast({ title: "Saved", type: "success" });
        })
      }
    >
      {pending ? "Saving (2 s)…" : "Save (slow action)"}
    </button>
  );
}

export function ToastDemo() {
  const [deleted, setDeleted] = useState<readonly string[]>([]);
  return (
    <Demo title="Toast">
      <p>
        <code>toast()</code> is urgent: a toast shows at once even while the action it reports on is
        pending. Hover or focus the stack to pause the timers; press F8 to jump into it, arrows to
        move, Escape to dismiss. Open the Dialog to see the toasts stay clickable above a modal.
      </p>
      <div className="toast-demo-buttons">
        <button type="button" onClick={() => toast({ title: "Link copied" })}>
          Simple
        </button>
        <SlowAction />
        <Menu.Root>
          <Menu.Trigger>Archive ▾</Menu.Trigger>
          <Menu.Popup className="toast-demo-menu">
            <Menu.Item
              action={() =>
                toast.promise(archive(false), {
                  pending: { title: "Archiving…" },
                  success: (name) => ({
                    title: `${name} archived`,
                    type: "success",
                    action: {
                      label: "Undo",
                      action: () => sleep(800).then(() => console.log("[toast] unarchived")),
                    },
                  }),
                })
              }
            >
              {({ pending }) => (pending ? "Archiving…" : "Archive (succeeds)")}
            </Menu.Item>
            <Menu.Item
              action={() =>
                toast.promise(archive(true), {
                  pending: { title: "Archiving…" },
                  error: (e) => ({
                    title: "Could not archive",
                    description: e instanceof Error ? e.message : String(e),
                    type: "error",
                    priority: "high",
                  }),
                })
              }
            >
              {({ pending }) => (pending ? "Archiving…" : "Archive (fails)")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <button
          type="button"
          onClick={() => {
            const name = `Draft ${deleted.length + 1}`;
            toast({
              title: `${name} deleted`,
              description: "Deleted for real in 8 s unless you undo.",
              duration: 8000,
              action: { label: "Undo", action: () => console.log(`[toast] ${name} restored`) },
              closeAction: ({ reason }) => {
                if (reason === "activate") return;
                console.log(`[toast] ${name} deleted for real (${reason})`);
                setDeleted((d) => [...d, name]);
              },
            });
          }}
        >
          Delete with Undo window
        </button>
        <button
          type="button"
          onClick={() => {
            for (let i = 1; i <= 5; i++) toast({ title: `Burst ${i}` });
          }}
        >
          Burst of 5 (limit 3)
        </button>
        <button type="button" onClick={() => toast.dismiss()}>
          Dismiss all
        </button>
        <Dialog.Root>
          <Dialog.Trigger>Open a modal Dialog</Dialog.Trigger>
          <Dialog.Popup className="toast-demo-dialog">
            <Dialog.Title>Modal</Dialog.Title>
            <p>Toasts move into this dialog while it is open, so they stay interactive.</p>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: "From inside the dialog",
                  action: { label: "Undo", action: () => sleep(500) },
                })
              }
            >
              Toast with Undo
            </button>{" "}
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>
      </div>
      {deleted.length > 0 && <p>Deleted for real: {deleted.join(", ")}</p>}
    </Demo>
  );
}
