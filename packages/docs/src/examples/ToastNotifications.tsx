"use client";
import { Toast } from "@funstack/ui/toast";
import type { ToastItem } from "@funstack/ui/toast";

// The toast region, rendered once (here: once on this page; in an app, near the root). It is a
// `<section popover="manual">` in the top layer, shown while it has toasts, and moves into an
// open modal Dialog by itself. The Viewport's children map the queue to parts.
function renderToast(t: ToastItem) {
  return (
    <div className="demo-toast-slot" key={t.id}>
      <Toast.Root toast={t} className="demo-toast">
        <div className="demo-toast-text">
          <Toast.Title className="demo-toast-title" />
          <Toast.Description className="demo-toast-description" />
        </div>
        <Toast.Action className="demo-button demo-toast-action">
          {({ pending }) => (pending ? "Undoing…" : t.action?.label)}
        </Toast.Action>
        <Toast.Close className="demo-toast-close" aria-label="Close">
          ×
        </Toast.Close>
      </Toast.Root>
    </div>
  );
}

export function ToastNotifications() {
  return (
    <Toast.Viewport className="demo-toasts">
      {({ toasts, queued }) => (
        <>
          {toasts.map(renderToast)}
          {queued > 0 && <p className="demo-toast-queued">+{queued} more</p>}
        </>
      )}
    </Toast.Viewport>
  );
}
