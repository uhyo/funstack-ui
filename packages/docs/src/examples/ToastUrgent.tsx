"use client";
import { useTransition } from "react";
import { toast } from "@funstack/ui/toast";
import { sleep } from "./fake-api.js";

// React holds every transition update while an async action is pending anywhere in the app. A
// toast pushed as a transition would therefore appear only after the action it reports on. The
// queue is urgent instead: `toast()` dispatches from a microtask, so the "Saving…" toast shows at
// once, from inside the action's own transition, while the button is still pending.
export function ToastUrgent() {
  const [pending, startTransition] = useTransition();
  return (
    <div className="demo-row">
      <button
        type="button"
        className="demo-button"
        data-pending={pending ? "" : undefined}
        onClick={() =>
          startTransition(async () => {
            const id = toast({ title: "Saving…", duration: null });
            await sleep(2000);
            toast.update(id, { title: "Saved", type: "success", duration: 3000 });
          })
        }
      >
        {pending ? "Saving (2 s)…" : "Save"}
      </button>
      <button
        type="button"
        className="demo-button"
        onClick={() => {
          for (let i = 1; i <= 5; i++) toast({ title: `Message ${i} of 5` });
        }}
      >
        Burst of five
      </button>
    </div>
  );
}
