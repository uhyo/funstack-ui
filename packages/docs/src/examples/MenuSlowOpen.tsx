"use client";
import { startTransition, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import type { MenuOpenChangeDetails } from "@funstack/ui/menu";
import { sleep } from "./fake-api.js";

// A slow `openChangeAction` on the menu and on its submenu (a nested Root has its own): a
// pretend server call of 2 seconds. Opening: the Trigger (or SubmenuTrigger) gets data-open and
// data-pending at once, the menu is shown when the action settles. Choosing an item closes the
// menu when the close's action settles. Escape and a click outside are the browser's: the menu
// hides at once and the action only hears about it. The browser exposes each trigger as
// expanded exactly while its menu is shown. The readout is plain text, not a live region.
export function MenuSlowOpen() {
  const [log, setLog] = useState("(none yet)");
  const [view, setView] = useState("List");
  const slow =
    (menu: string) =>
    async (open: boolean, { reason }: MenuOpenChangeDetails) => {
      const call = `${menu} openChangeAction(${open}, "${reason}")`;
      setLog(`${call}: running…`);
      await sleep(2000);
      // After an await: wrap the update in startTransition (React limitation).
      startTransition(() => setLog(`${call}: settled`));
    };
  const choose = (next: string) => () => startTransition(() => setView(next));

  return (
    <div className="demo-stack">
      <div className="demo-row">
        <span>View: {view}</span>
        <Menu.Root openChangeAction={slow("menu")}>
          <Menu.Trigger className="demo-button">
            {({ pending }) => (
              <>Options{pending && <span className="demo-spinner" aria-hidden />}</>
            )}
          </Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.Item action={choose("List")}>List</Menu.Item>
            <Menu.Item action={choose("Grid")}>Grid</Menu.Item>
            <Menu.Separator />
            <Menu.Root openChangeAction={slow("submenu")}>
              <Menu.SubmenuTrigger>
                {({ pending }) => (
                  <>Sort by{pending && <span className="demo-spinner" aria-hidden />}</>
                )}
              </Menu.SubmenuTrigger>
              <Menu.Popup className="demo-menu">
                <Menu.Item action={choose("List, by name")}>Name</Menu.Item>
                <Menu.Item action={choose("List, by date")}>Date</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          </Menu.Popup>
        </Menu.Root>
      </div>
      <p className="demo-readout">
        Last: <code>{log}</code>
      </p>
    </div>
  );
}
