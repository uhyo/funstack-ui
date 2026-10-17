"use client";
import { startTransition, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import type { MenuOpenChangeDetails } from "@funstack/ui/menu";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Each item's `action` runs in the item's own transition: the item shows data-pending (here a
// "…" label) while the fake server call runs, and the whole menu closes when it settles, with a
// view transition (`transition` on the Popup). "Move to" is a submenu: hover it, or press
// ArrowRight. A rejection reaches the Error Boundary inside the Popup and the menu stays open.
export function MenuRowActions() {
  const [status, setStatus] = useState("Report.pdf");
  const [last, setLast] = useState("(none yet)");
  const [fail, setFail] = useState(false);
  const record = (open: boolean, { reason }: MenuOpenChangeDetails) => {
    setLast(`open=${open} reason="${reason}"`);
  };
  const done = (text: string) => () => startTransition(() => setStatus(text));

  return (
    <div className="demo-stack">
      <div className="demo-row">
        <span>{status}</span>
        <Menu.Root openChangeAction={record}>
          <Menu.Trigger className="demo-button" aria-label="Actions for Report.pdf">
            {({ pending }) => (pending ? <span className="demo-spinner" aria-hidden /> : "⋯")}
          </Menu.Trigger>
          <Menu.Popup
            className="demo-menu"
            transition={{
              "fsui-menu-open": "menu-in",
              "fsui-menu-close": "menu-out",
              default: "none",
            }}
          >
            <DemoErrorBoundary>
              <Menu.Item action={done("Report.pdf (renamed)")}>Rename</Menu.Item>
              <Menu.Item
                action={async () => {
                  await fakeSave("the archive", { ms: 1200, fail });
                  done("Report.pdf (archived)")();
                }}
              >
                {({ pending }) => (pending ? "Archiving…" : "Archive")}
              </Menu.Item>
              <Menu.Item disabled>Share</Menu.Item>
              <Menu.Separator />
              <Menu.Root>
                <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                <Menu.Popup className="demo-menu">
                  <Menu.Item action={done("Report.pdf (in Inbox)")}>Inbox</Menu.Item>
                  <Menu.Item action={done("Report.pdf (in Later)")}>Later</Menu.Item>
                </Menu.Popup>
              </Menu.Root>
              <Menu.Separator />
              <Menu.Item className="demo-menu-danger" action={done("(deleted)")}>
                Delete
              </Menu.Item>
            </DemoErrorBoundary>
          </Menu.Popup>
        </Menu.Root>
      </div>
      <label className="demo-row">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make Archive fail
      </label>
      <p className="demo-readout">Last openChangeAction: {last}</p>
    </div>
  );
}
