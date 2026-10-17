"use client";
import { useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { toast } from "@funstack/ui/toast";
import { fakeSave } from "./fake-api.js";

// One promise feeds both the menu item and the toast: `toast.promise` shows "Archiving…" at once
// (data-pending on the toast), swaps to the success or error toast when the fake server call
// settles, and returns a promise that settles with it, so the item stays pending exactly as long
// and the menu closes when it is done. The success toast's Undo is an action prop: pending while
// it runs, then the toast closes. With `error` given, a failure is the toast's to show: the
// returned promise resolves and nothing reaches an Error Boundary.
export function ToastArchive() {
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <div className="demo-row">
        <span>Quarterly report.pdf</span>
        <Menu.Root>
          <Menu.Trigger className="demo-button" aria-label="Actions for Quarterly report.pdf">
            {({ pending }) => (pending ? <span className="demo-spinner" aria-hidden /> : "⋯")}
          </Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.Item
              action={() =>
                toast.promise(fakeSave("the archive", { ms: 1500, fail }), {
                  pending: { title: "Archiving…" },
                  success: {
                    title: "Archived",
                    description: "Quarterly report.pdf",
                    type: "success",
                    action: {
                      label: "Undo",
                      action: () => fakeSave("the undo", { ms: 800 }),
                    },
                  },
                  error: (e) => ({
                    title: "Could not archive",
                    description: e instanceof Error ? e.message : String(e),
                    type: "error",
                    priority: "high",
                  }),
                })
              }
            >
              {({ pending }) => (pending ? "Archiving…" : "Archive")}
            </Menu.Item>
            <Menu.Item action={() => toast({ title: "Link copied" })}>Copy link</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </div>
      <label className="demo-row">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make Archive fail
      </label>
    </div>
  );
}
