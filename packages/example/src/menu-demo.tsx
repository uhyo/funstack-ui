import { startTransition, use, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import type { MenuOpenChangeDetails } from "@funstack/ui/menu";
import "./menu-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function logChange(label: string) {
  return (open: boolean, { reason }: MenuOpenChangeDetails) => {
    console.log(`[${label}] open=${open} reason=${reason}`);
  };
}

/* 1. Row actions: async items, a failing one, a submenu -------------------------------------- */

function RowActions() {
  const [log, setLog] = useState<readonly string[]>([]);
  const note = (line: string) => startTransition(() => setLog((l) => [line, ...l].slice(0, 5)));

  return (
    <section>
      <h3>Row actions</h3>
      <p>
        Each item's <code>action</code> runs in the item's own transition: "Archive" shows{" "}
        <code>data-pending</code> on the item for a second, then the whole menu closes (with a view
        transition). "Move to" is a submenu: hover it (100 ms), or press ArrowRight. Tab or a click
        outside closes everything. "Refresh" keeps the menu open (<code>closeOnActivate=false</code>
        ).
      </p>
      <Menu.Root openChangeAction={logChange("row menu")}>
        <Menu.Trigger className="menu-btn">Actions ▾</Menu.Trigger>
        <Menu.Popup
          className="menu"
          transition={{
            "fsui-menu-open": "menu-in",
            "fsui-menu-close": "menu-out",
            default: "none",
          }}
        >
          <Menu.Item action={() => note("Renamed")}>Rename</Menu.Item>
          <Menu.Item
            action={async () => {
              await sleep(1000);
              note("Archived");
            }}
          >
            {({ pending }) => (pending ? "Archiving…" : "Archive")}
          </Menu.Item>
          <Menu.Item disabled>Share (disabled)</Menu.Item>
          <Menu.Separator />
          <Menu.Root openChangeAction={logChange("move to")}>
            <Menu.SubmenuTrigger>Move to ▸</Menu.SubmenuTrigger>
            <Menu.Popup className="menu">
              <Menu.Item action={() => note("Moved to Inbox")}>Inbox</Menu.Item>
              <Menu.Item action={() => note("Moved to Later")}>Later</Menu.Item>
              <Menu.Item action={() => note("Moved to Archive")}>Archive</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Menu.Item
            action={() => sleep(400).then(() => note("Refreshed (menu kept open)"))}
            closeOnActivate={false}
          >
            {({ pending }) => (pending ? "Refreshing…" : "Refresh")}
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item className="danger" action={() => note("Deleted")}>
            Delete
          </Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <ul className="menu-log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

/* 2. View options: checkbox and radio items that stay open ---------------------------------- */

function ViewOptions() {
  const [dense, setDense] = useState(false);
  const [sort, setSort] = useState("name");
  return (
    <section>
      <h3>View options</h3>
      <p>
        Checkbox and radio items flip <code>aria-checked</code> at once, show{" "}
        <code>data-pending</code> while the (fake, 600 ms) save runs, and keep the menu open.
        Typeahead: press "n" or "l" inside the menu.
      </p>
      <Menu.Root>
        <Menu.Trigger className="menu-btn">View ▾</Menu.Trigger>
        <Menu.Popup className="menu" experimental_focusgroup>
          <Menu.CheckboxItem
            checked={dense}
            checkedChangeAction={async (next) => {
              await sleep(600);
              startTransition(() => setDense(next));
            }}
          >
            Dense rows
          </Menu.CheckboxItem>
          <Menu.Separator />
          <Menu.RadioGroup
            value={sort}
            valueChangeAction={async (next) => {
              await sleep(600);
              startTransition(() => setSort(next));
            }}
          >
            <Menu.GroupLabel className="menu-label">Sort by</Menu.GroupLabel>
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="modified">Last modified</Menu.RadioItem>
            <Menu.RadioItem value="size">Size</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
      <p>
        dense: <code>{String(dense)}</code>, sort: <code>{sort}</code>
      </p>
    </section>
  );
}

/* 3. Items that load on open --------------------------------------------------------------- */

let recentFiles: Promise<readonly string[]> | undefined;
function loadRecent(): Promise<readonly string[]> {
  recentFiles ??= sleep(800).then(() => ["notes.md", "budget.xlsx", "plan.key"]);
  return recentFiles;
}

function RecentFiles() {
  const files = use(loadRecent());
  return files.map((file) => (
    <Menu.Item key={file} action={() => console.log(`[recent] open ${file}`)}>
      {file}
    </Menu.Item>
  ));
}

function SuspendingMenu() {
  return (
    <section>
      <h3>Items that suspend</h3>
      <p>
        The "Open recent" submenu's items suspend on first open: the SubmenuTrigger shows{" "}
        <code>data-pending</code> until they are ready, then the submenu opens.
      </p>
      <Menu.Root>
        <Menu.Trigger className="menu-btn">File ▾</Menu.Trigger>
        <Menu.Popup className="menu">
          <Menu.Item>New</Menu.Item>
          <Menu.Root>
            <Menu.SubmenuTrigger>Open recent ▸</Menu.SubmenuTrigger>
            <Menu.Popup className="menu">
              <RecentFiles />
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>
    </section>
  );
}

/* 4. Context menu: Menu.ContextTrigger ------------------------------------------------------- */

const cards = ["Inbox", "Drafts", "Archive"] as const;

function ContextMenuCards() {
  const [log, setLog] = useState<readonly string[]>([]);
  const note = (line: string) => startTransition(() => setLog((l) => [line, ...l].slice(0, 5)));

  return (
    <section>
      <h3>Context menu</h3>
      <p>
        Right-click a card (or Tab to its "⋯" button and press Shift+F10, or long-press on touch):
        the same menu as the button opens at the pointer. Right-click elsewhere on the card to move
        it; right- or middle-click outside to close it. The text field keeps the browser's own menu.
        The inner box is a nested region: it wins over the card. Press-drag-release (Linux, macOS):
        hold the right button, slide onto an item, release to choose it; on touch, keep the finger
        down after the long-press (the menu opens above it). Scrolling the page closes a menu opened
        at the pointer; a wheel over a menu never scrolls the page.
      </p>
      <div className="cm-cards">
        {cards.map((name) => (
          <Menu.Root key={name} openChangeAction={logChange(`context ${name}`)}>
            <Menu.ContextTrigger className="cm-card">
              <strong>{name}</strong>
              <Menu.Trigger className="menu-btn" aria-label={`Actions for ${name}`}>
                ⋯
              </Menu.Trigger>
              <input aria-label={`Note for ${name}`} placeholder="Note (native menu)" />
              {name === "Archive" && (
                <Menu.Root openChangeAction={logChange("nested region")}>
                  <Menu.ContextTrigger className="cm-nested">Nested region</Menu.ContextTrigger>
                  <Menu.Popup className="menu" aria-label="Nested actions">
                    <Menu.Item action={() => note("Nested action")}>Nested action</Menu.Item>
                  </Menu.Popup>
                </Menu.Root>
              )}
            </Menu.ContextTrigger>
            <Menu.Popup className="menu" align="end">
              <Menu.Item action={() => note(`Opened ${name}`)}>Open</Menu.Item>
              <Menu.Item
                action={async () => {
                  await sleep(1000);
                  note(`Emptied ${name}`);
                }}
              >
                {({ pending }) => (pending ? "Emptying…" : "Empty")}
              </Menu.Item>
              <Menu.Separator />
              <Menu.Root>
                <Menu.SubmenuTrigger>Color</Menu.SubmenuTrigger>
                <Menu.Popup className="menu">
                  <Menu.Item action={() => note(`${name}: red`)}>Red</Menu.Item>
                  <Menu.Item action={() => note(`${name}: blue`)}>Blue</Menu.Item>
                </Menu.Popup>
              </Menu.Root>
            </Menu.Popup>
          </Menu.Root>
        ))}
      </div>
      <ul>
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function MenuDemo() {
  return (
    <section className="demo">
      <h2>Menu</h2>
      <RowActions />
      <ViewOptions />
      <SuspendingMenu />
      <ContextMenuCards />
    </section>
  );
}
