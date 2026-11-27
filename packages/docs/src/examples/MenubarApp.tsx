"use client";
import { startTransition, use, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { Menubar } from "@funstack/ui/menubar";
import { fakeSave, sleep } from "./fake-api.js";

// An application menu: ordinary Menu.Roots inside a Menubar. Each menu keeps its own open state;
// the bar gives one Tab stop and the arrow keys between the menus. "Open recent" reads its list
// with use(): the submenu opens when the list has loaded. "Save" runs a fake server call with
// data-pending on the item; the menu closes when it settles.
let recentFiles: Promise<string[]> | null = null;
function loadRecentFiles(): Promise<string[]> {
  recentFiles ??= sleep(800).then(() => ["Quarterly report.txt", "Notes.md", "Budget.csv"]);
  return recentFiles;
}

function RecentFiles({ onOpen }: { onOpen: (name: string) => void }) {
  const files = use(loadRecentFiles());
  return files.map((name) => (
    <Menu.Item key={name} action={() => onOpen(name)}>
      {name}
    </Menu.Item>
  ));
}

export function MenubarApp() {
  const [log, setLog] = useState("Nothing yet");
  const [wrap, setWrap] = useState(true);
  const [zoom, setZoom] = useState("100");
  const did = (what: string) => setLog(what);
  return (
    <div className="demo-stack">
      <Menubar aria-label="Application" className="demo-menubar">
        <Menu.Root>
          <Menu.Trigger className="demo-menubar-trigger">File</Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.Item action={() => did("New file")}>New</Menu.Item>
            <Menu.Root>
              <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
              <Menu.Popup className="demo-menu">
                <RecentFiles onOpen={(name) => did(`Opened ${name}`)} />
              </Menu.Popup>
            </Menu.Root>
            <Menu.Separator />
            <Menu.Item
              action={async () => {
                await fakeSave("the file", { ms: 1200 });
                startTransition(() => did("Saved"));
              }}
            >
              Save
            </Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger className="demo-menubar-trigger">Edit</Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.Item action={() => did("Undo")}>Undo</Menu.Item>
            <Menu.Item action={() => did("Redo")}>Redo</Menu.Item>
            <Menu.Separator />
            <Menu.Item action={() => did("Cut")}>Cut</Menu.Item>
            <Menu.Item action={() => did("Copy")}>Copy</Menu.Item>
            <Menu.Item action={() => did("Paste")}>Paste</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger className="demo-menubar-trigger">View</Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.CheckboxItem checked={wrap} checkedChangeAction={(next) => setWrap(next)}>
              Word wrap
            </Menu.CheckboxItem>
            <Menu.Separator />
            <Menu.RadioGroup value={zoom} valueChangeAction={(next) => setZoom(next)}>
              <Menu.GroupLabel className="demo-menu-label">Zoom</Menu.GroupLabel>
              <Menu.RadioItem value="75">75%</Menu.RadioItem>
              <Menu.RadioItem value="100">100%</Menu.RadioItem>
              <Menu.RadioItem value="150">150%</Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger className="demo-menubar-trigger" disabled>
            Help
          </Menu.Trigger>
          <Menu.Popup className="demo-menu">
            <Menu.Item>About</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <p className="demo-readout">
        Last command: {log}. Word wrap: {wrap ? "on" : "off"}, zoom: {zoom}%.
      </p>
    </div>
  );
}
