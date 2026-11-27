import { startTransition, use, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import type { MenuOpenChangeDetails } from "@funstack/ui/menu";
import { Menubar } from "@funstack/ui/menubar";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
// The popups reuse the Menu demo's .menu rules.
import "./menu-demo.css";
import "./menubar-demo.css";

/** A request (`openChangeAction`): a switch opens the new menu with reason "activate". */
function logRequest(label: string, ms = 0) {
  return async (open: boolean, { reason, event }: MenuOpenChangeDetails) => {
    console.log(`[menubar ${label}] openChangeAction open=${open} reason=${reason}`, event?.type);
    if (ms > 0 && open) await sleep(ms);
  };
}

/** A fact (`onOpenChange`): the menu a switch leaves is dismissed. */
function logFact(label: string) {
  return (open: boolean, { reason }: MenuOpenChangeDetails) => {
    console.log(`[menubar ${label}] onOpenChange open=${open} reason=${reason}`);
  };
}

let recent: Promise<string[]> | null = null;
function RecentFiles({ onOpen }: { onOpen: (name: string) => void }) {
  // Suspends the first time: the submenu opens once the list has loaded.
  recent ??= sleep(1000).then(() => ["Quarterly report.txt", "Notes.md", "Budget.csv"]);
  return use(recent).map((name) => (
    <Menu.Item key={name} action={() => onOpen(name)}>
      {name}
    </Menu.Item>
  ));
}

export function MenubarDemo() {
  const [log, setLog] = useState<readonly string[]>([]);
  const note = (line: string) => startTransition(() => setLog((l) => [line, ...l].slice(0, 5)));
  const [wrap, setWrap] = useState(true);

  return (
    <Demo title="Menubar">
      <p>
        A row of ordinary <code>Menu.Root</code>s in a <code>Menubar</code>. Tab enters on one
        Trigger; Left / Right move between them. Open a menu, then Left / Right inside it (or move
        the pointer across the bar) to switch menus. The old menu is dismissed (
        <code>onOpenChange</code>), the new one requested (<code>openChangeAction</code>): Edit's
        takes a second, so its Trigger shows <code>data-pending</code> and no menu is shown
        meanwhile. "Open recent" loads its list on first open. Help is disabled but focusable.
      </p>
      <Menubar aria-label="Application" className="menubar">
        <Menu.Root openChangeAction={logRequest("file")} onOpenChange={logFact("file")}>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Popup className="menu">
            <Menu.Item action={() => note("New file")}>New</Menu.Item>
            <Menu.Root>
              <Menu.SubmenuTrigger>Open recent ▸</Menu.SubmenuTrigger>
              <Menu.Popup className="menu">
                <RecentFiles onOpen={(name) => note(`Opened ${name}`)} />
              </Menu.Popup>
            </Menu.Root>
            <Menu.Separator />
            <Menu.Item
              action={async () => {
                await sleep(1000);
                note("Saved");
              }}
            >
              {({ pending }) => (pending ? "Saving…" : "Save")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root openChangeAction={logRequest("edit", 1000)} onOpenChange={logFact("edit")}>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Popup className="menu">
            <Menu.Item action={() => note("Undo")}>Undo</Menu.Item>
            <Menu.Item action={() => note("Redo")}>Redo</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root openChangeAction={logRequest("view")} onOpenChange={logFact("view")}>
          <Menu.Trigger>View</Menu.Trigger>
          <Menu.Popup className="menu">
            <Menu.CheckboxItem checked={wrap} checkedChangeAction={(next) => setWrap(next)}>
              Word wrap
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger disabled>Help</Menu.Trigger>
          <Menu.Popup className="menu">
            <Menu.Item>About</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <ul className="menu-log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </Demo>
  );
}
